import type {
  ClassificationInput,
  ClassificationResult,
  PublicError,
  Usage,
} from './classification';
import type {
  BroadcastMessage,
  ContentRequest,
  DiagnosticEvent,
  OptionsRequest,
  PopupRequest,
} from './messaging';
import type { ExtractedPost, PostIdentity } from './post';
import type {
  CategoryId,
  CategoryModes,
  ExtractionCompleteness,
  ProviderId,
} from './primitives';
import type { EstimatedCostCap, MoneyAmount, Settings } from './settings';

/** Inject time so restart, day rollover, deadlines, and backoff have deterministic tests. */
export interface Clock {
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
}

/** Provider modules receive this port; production must enforce its endpoint allowlist. */
export interface NetworkClient {
  fetch(
    url: string,
    init: RequestInit & { signal: AbortSignal },
  ): Promise<Response>;
}

export interface BrowserCapabilities {
  family: 'chrome' | 'firefox';
  trustedSessionStorage: boolean;
  sessionSurvivesBackgroundRestart: boolean;
}

/** Browser storage wrappers implement this; raw post bodies must never be written. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** Trusted metadata comes from the browser, never from request payload fields. */
export interface MessageSender {
  extensionId: string;
  url: string;
  tabId: number | null;
  frameId: number | null;
}

export interface BrowserPorts {
  capabilities: BrowserCapabilities;
  localStorage: KeyValueStore;
  // null means unavailable, never an invitation to fall back to localStorage.
  trustedSessionStorage: KeyValueStore | null;
  hasProviderPermission(provider: ProviderId): Promise<boolean>;
  requestProviderPermission(provider: ProviderId): Promise<boolean>;
  broadcast(event: BroadcastMessage): Promise<void>;
}

export interface ProviderContext {
  model: string;
  credential: string;
  signal: AbortSignal;
}

/** Adapters handle wire formats. The coordinator handles retries, budgets, and consent. */
export interface ClassifierAdapter {
  readonly id: ProviderId;
  classify(
    input: ClassificationInput,
    context: ProviderContext,
  ): Promise<ClassificationResult>;
}

export interface ProviderDependencies {
  network: NetworkClient;
  clock: Clock;
}

export interface ProviderConfiguration {
  provider: ProviderId;
  model: string;
  adapterVersion: string;
  promptVersion: string;
  taxonomyVersion: string;
}

export interface ThresholdPair {
  hide: number;
  protect: number;
}

/** A null category entry disables remote automated actions for that category. */
export interface ThresholdProfile {
  provider: ProviderId;
  model: string;
  version: string;
  validation: 'experimental' | 'evaluated';
  categories: Readonly<Record<CategoryId, ThresholdPair | null>>;
}

export interface PolicyInput {
  enabled: boolean;
  consentGranted: boolean;
  supportedRoute: boolean;
  validIdentity: boolean;
  extractorHealthy: boolean;
  revealed: boolean;
  extraction: ExtractionCompleteness;
  localSponsored: boolean;
  categoryModes: Readonly<CategoryModes>;
  classification: ClassificationResult | null;
  thresholds: ThresholdProfile | null;
}

export type VisibilityReason =
  | 'disabled'
  | 'consent_required'
  | 'unsupported_route'
  | 'stale_identity'
  | 'extractor_unhealthy'
  | 'revealed'
  | 'insufficient'
  | 'protected'
  | 'category_hidden'
  | 'no_matching_rule';

export interface VisibilityDecision {
  action: 'show' | 'collapse';
  reason: VisibilityReason;
  matchedCategories: readonly CategoryId[];
}

export type EvaluateVisibility = (input: PolicyInput) => VisibilityDecision;

export interface ExtractionCallbacks {
  onPost(post: ExtractedPost): void;
  onRemoved(identity: PostIdentity): void;
  onHealthChanged(healthy: boolean): void;
  onReveal(identity: PostIdentity): void;
}

/** Nodes remain inside the adapter; callers use local identities, never DOM references over IPC. */
export interface ExtractionAdapter {
  readonly version: string;
  supportsRoute(url: URL): boolean;
  observe(
    root: Element,
    callbacks: ExtractionCallbacks,
    signal: AbortSignal,
  ): () => void;
  apply(identity: PostIdentity, decision: VisibilityDecision): void;
  restore(identity: PostIdentity): void;
  restoreAll(): void;
  dispose(): void;
}

export interface SettingsSnapshot {
  settings: Settings;
  enablementGeneration: number;
}

/** Mutations are serialized by the background owner; stale generations must be rejected. */
export interface SettingsStore {
  read(): Promise<SettingsSnapshot>;
  write(
    settings: Settings,
    expectedGeneration: number,
  ): Promise<SettingsSnapshot>;
  invalidate(expectedGeneration: number): Promise<SettingsSnapshot>;
  clear(expectedGeneration: number): Promise<SettingsSnapshot>;
}

/** This port is usable only in privileged extension contexts, never in a UI/status response. */
export interface CredentialStore {
  get(provider: ProviderId): Promise<string | null>;
  set(
    provider: ProviderId,
    credential: string,
    expectedGeneration: number,
  ): Promise<void>;
  remove(provider: ProviderId, expectedGeneration: number): Promise<void>;
  clear(expectedGeneration: number): Promise<void>;
}

export interface UsageReservation {
  requestId: string;
  provider: ProviderId;
  accountingDay: string;
  timeZone: string;
  reservedAt: number;
  enablementGeneration: number;
  estimatedCost: MoneyAmount | null;
  // No post identity, body, digest, or provider request headers belong here.
}

export type ReserveUsageResult =
  | { accepted: true; reservation: UsageReservation }
  | { accepted: false; error: PublicError };

export interface UsageSnapshot {
  accountingDay: string;
  timeZone: string;
  attempts: number;
  estimatedCost: MoneyAmount | null;
  resetAt: number;
}

export interface UsageStore {
  reserve(input: {
    requestId: string;
    provider: ProviderId;
    expectedGeneration: number;
    dailyRequestLimit: number;
    estimatedCostCap: EstimatedCostCap | null;
    requestCostEstimate: MoneyAmount | null;
  }): Promise<ReserveUsageResult>;
  // Unknown/failed outcomes keep conservative reservations; no automatic refund.
  reconcile(
    requestId: string,
    usage: Usage | null,
    expectedGeneration: number,
  ): Promise<void>;
  read(): Promise<UsageSnapshot>;
  clear(expectedGeneration: number): Promise<void>;
}

export interface ClassificationCacheKey extends ProviderConfiguration {
  contentDigest: string;
  extraction: ExtractionCompleteness;
  extractorVersion: string;
}

export interface ClassificationCache {
  // Rebind requestId to the current subscriber when forming a validated response.
  get(key: ClassificationCacheKey): ClassificationResult | null;
  set(key: ClassificationCacheKey, value: ClassificationResult): void;
  clear(): void;
}

export interface DiagnosticsBuffer {
  append(event: DiagnosticEvent): void;
  read(): readonly DiagnosticEvent[];
  clear(): void;
}

/** Authorization validates both browser sender metadata and the surface-specific schema. */
export type AuthorizedRequest =
  | { surface: 'content'; sender: MessageSender; request: ContentRequest }
  | { surface: 'popup'; sender: MessageSender; request: PopupRequest }
  | { surface: 'options'; sender: MessageSender; request: OptionsRequest }
  | { surface: 'rejected'; error: PublicError };
