import {
  ClassificationResultSchema,
  ErrorCodeSchema,
  REMOTE_CATEGORY_IDS,
  matchesProviderConfiguration,
  type BrowserPorts,
  type ClassifierAdapter,
  type Clock,
  type ConsentRecord,
  type ErrorCode,
  type ExtractedPost,
  type ProviderConfiguration,
  type ProviderId,
  type Settings,
} from '@clearedin/contracts';
import { StorageError, type Storage } from '@clearedin/storage';
import { createClassificationCoordinator } from './coordinator';

/** The browser entry point supplies only packaged configurations and adapters. */
export interface LiveProviders {
  configuration(provider: ProviderId): ProviderConfiguration | null;
  adapter(provider: ProviderId): ClassifierAdapter;
  recipientId(provider: ProviderId): string;
}

export function errorCode(cause: unknown): ErrorCode {
  const code = ErrorCodeSchema.safeParse(
    cause instanceof StorageError
      ? cause.code
      : cause instanceof Error
        ? cause.message
        : null,
  );
  return code.success ? code.data : 'internal_error';
}

export function createLiveInference(
  providers: LiveProviders,
  storage: Storage,
  browser: BrowserPorts,
  clock: Clock,
) {
  const subscriptions = new Map<string, AbortController>();
  let coordinator:
    ReturnType<typeof createClassificationCoordinator> | undefined;
  let activeProvider: ProviderId | undefined;
  let connectionTest: AbortController | undefined;

  function configuration(provider: ProviderId | null, model: string | null) {
    if (!provider) throw new Error('unsupported_provider');
    const config = providers.configuration(provider);
    if (!config || config.provider !== provider)
      throw new Error('unsupported_provider');
    if (model !== config.model) throw new Error('unsupported_model');
    return config;
  }

  function validConsent(
    config: ProviderConfiguration,
    consent: ConsentRecord | null,
  ) {
    return (
      !!consent &&
      consent.status === 'granted' &&
      consent.version === '1' &&
      consent.provider === config.provider &&
      consent.recipientId === providers.recipientId(config.provider) &&
      consent.dataClasses.includes('post_text') &&
      consent.dataClasses.includes('classification_instructions')
    );
  }

  async function credential(provider: ProviderId) {
    if (!(await browser.hasProviderPermission(provider)))
      throw new Error('permission_denied');
    const key = await storage.credentials.get(provider);
    if (!key) throw new Error('credential_required');
    return key;
  }

  function reset() {
    for (const controller of subscriptions.values()) controller.abort();
    subscriptions.clear();
    coordinator?.invalidate();
    coordinator = undefined;
    activeProvider = undefined;
    connectionTest?.abort();
  }

  function cancel(owner: string) {
    subscriptions.get(owner)?.abort();
    subscriptions.delete(owner);
    coordinator?.cancel(owner);
  }

  function coordinatorFor(config: ProviderConfiguration) {
    if (coordinator && activeProvider === config.provider) return coordinator;
    coordinator?.invalidate();
    activeProvider = config.provider;
    coordinator = createClassificationCoordinator({
      storage,
      clock,
      configuration: config,
      consentVersion: '1',
      recipientId: providers.recipientId(config.provider),
      async isAvailable() {
        await credential(config.provider);
        return true;
      },
      async digest(text) {
        const bytes = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(text),
        );
        return Array.from(new Uint8Array(bytes), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      },
      attemptId: () => crypto.randomUUID(),
      // A configured monetary cap blocks dispatch until a conservative estimate is available.
      estimate: () => null,
      async classify(input, signal) {
        const key = await credential(config.provider);
        signal.throwIfAborted();
        return providers
          .adapter(config.provider)
          .classify(input, { model: config.model, credential: key, signal });
      },
    });
    return coordinator;
  }

  async function classify(
    owner: string,
    requestId: string,
    post: ExtractedPost,
    generation: number,
  ) {
    if (post.localSponsored || post.extraction !== 'complete')
      throw new Error('invalid_request');
    cancel(owner);
    if (subscriptions.size >= 100) throw new Error('queue_full');
    const operation = new AbortController();
    subscriptions.set(owner, operation);
    try {
      const snapshot = await storage.settings.read();
      if (
        operation.signal.aborted ||
        generation !== snapshot.enablementGeneration
      )
        throw new Error('cancelled');
      if (
        !snapshot.settings.enabled ||
        !REMOTE_CATEGORY_IDS.some(
          (id) => snapshot.settings.categoryModes[id] === 'hide',
        )
      )
        throw new Error('not_enabled');
      const config = configuration(
        snapshot.settings.provider,
        snapshot.settings.model,
      );
      return await coordinatorFor(config).classify(
        owner,
        requestId,
        post,
        generation,
      );
    } finally {
      if (subscriptions.get(owner) === operation) subscriptions.delete(owner);
    }
  }

  // A gesture in the options page tests a fixed synthetic post before feed consent.
  // Reserve the attempt using the same durable ledger as ordinary classifications.
  async function test() {
    if (connectionTest) throw new Error('queue_full');
    const controller = new AbortController();
    connectionTest = controller;
    const stop = clock.schedule(
      () => controller.abort(new Error('timeout')),
      10_000,
    );
    try {
      const { settings, enablementGeneration } = await storage.settings.read();
      const config = configuration(settings.provider, settings.model);
      await credential(config.provider);
      if (controller.signal.aborted) throw new Error('cancelled');
      const requestId = crypto.randomUUID();
      const reserved = await storage.usage.reserve({
        requestId,
        provider: config.provider,
        expectedGeneration: enablementGeneration,
        dailyRequestLimit: settings.dailyRequestLimit,
        estimatedCostCap: settings.estimatedCostCap,
        requestCostEstimate: null,
      });
      if (!reserved.accepted) throw new Error(reserved.error.code);
      const key = await credential(config.provider);
      controller.signal.throwIfAborted();
      const response = await providers.adapter(config.provider).classify(
        {
          requestId,
          extraction: 'complete',
          taxonomyVersion: config.taxonomyVersion,
          promptVersion: config.promptVersion,
          text: 'Our example team is hiring a software engineer to build a database.',
        },
        { model: config.model, credential: key, signal: controller.signal },
      );
      controller.signal.throwIfAborted();
      const parsed = ClassificationResultSchema.safeParse(response);
      if (
        !parsed.success ||
        parsed.data.requestId !== requestId ||
        !matchesProviderConfiguration(parsed.data, config)
      )
        throw new Error('invalid_response');
      await storage.usage.reconcile(
        requestId,
        parsed.data.usage ?? null,
        enablementGeneration,
      );
      controller.signal.throwIfAborted();
      return config;
    } catch (cause) {
      if (controller.signal.aborted)
        throw new Error(
          controller.signal.reason?.message === 'timeout'
            ? 'timeout'
            : 'cancelled',
          { cause },
        );
      throw cause;
    } finally {
      stop();
      if (connectionTest === controller) connectionTest = undefined;
    }
  }

  async function requireEnabledSetup(settings: Settings) {
    const config = configuration(settings.provider, settings.model);
    if (!validConsent(config, settings.consent))
      throw new Error('consent_required');
    await credential(config.provider);
  }

  return {
    configuration,
    validConsent,
    requireEnabledSetup,
    reset,
    classify,
    cancel,
    test,
  };
}
