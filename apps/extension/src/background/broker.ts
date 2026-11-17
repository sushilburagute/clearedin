import {
  RequestMessageSchema,
  type MessageSender,
  type ReplyMessage,
  type BroadcastMessage,
  type PublicStatus,
} from '@clearedin/contracts';
import type { Storage } from '@clearedin/storage';
import { authorize } from '../messaging/authorize';

export function createBroker(
  storage: Storage,
  extensionId: string,
  baseUrl: string,
  broadcast: (event: BroadcastMessage) => Promise<void>,
) {
  const readStatus = async (): Promise<PublicStatus> => ({
    ...(await storage.public.readStatus()),
    enabled: false,
    state: 'unavailable',
    error: { code: 'provider_unavailable', retryable: false },
  });
  let serial: Promise<unknown> = Promise.resolve();
  return (raw: unknown, sender: MessageSender): Promise<ReplyMessage> => {
    const operation = serial.then(async (): Promise<ReplyMessage> => {
      const parsed = RequestMessageSchema.safeParse(raw);
      const requestId = parsed.success
        ? parsed.data.requestId
        : 'invalid-request';
      const envelope = { protocolVersion: 1 as const, requestId };
      const error = (
        code: 'unauthorized_sender' | 'provider_unavailable' | 'internal_error',
      ): ReplyMessage => ({
        ...envelope,
        type: 'ERROR',
        error: { code, retryable: false },
      });
      const authorized = authorize(raw, sender, extensionId, baseUrl);
      if (authorized.surface === 'rejected')
        return error('unauthorized_sender');
      const request = authorized.request;
      try {
        if (request.type === 'GET_PUBLIC_STATUS') {
          const status = await storage.public.readStatus();
          return {
            ...envelope,
            type: 'PUBLIC_STATUS',
            status: {
              ...status,
              enabled: false,
              state: 'unavailable',
              error: { code: 'provider_unavailable', retryable: false },
            },
          };
        }
        if (request.type === 'GET_SETTINGS')
          return {
            ...envelope,
            type: 'SETTINGS',
            settings: await storage.public.readSettings(),
          };
        const snapshot = await storage.settings.read();
        let next = snapshot;
        let reason: Extract<
          BroadcastMessage,
          { type: 'RESTORE_ALL' }
        >['reason'] = 'paused';
        if (request.type === 'CLEAR_DATA') {
          reason = 'data_cleared';
          next = await storage.clearAll(snapshot.enablementGeneration);
        } else if (request.type === 'SET_ENABLED' && !request.enabled) {
          next = await storage.settings.invalidate(
            snapshot.enablementGeneration,
          );
        } else if (request.type === 'SET_PREFERENCES') {
          next = await storage.settings.write(
            { ...snapshot.settings, ...request.preferences, enabled: false },
            snapshot.enablementGeneration,
          );
        } else if (
          request.type === 'SET_CONSENT' &&
          request.consent.status === 'withdrawn'
        ) {
          reason = 'consent_withdrawn';
          next = await storage.settings.write(
            { ...snapshot.settings, consent: request.consent, enabled: false },
            snapshot.enablementGeneration,
          );
        } else if (request.type === 'DISCONNECT_PROVIDER') {
          reason = 'provider_changed';
          next = await storage.disconnect(
            request.provider,
            snapshot.enablementGeneration,
          );
        } else if (request.type !== 'CANCEL_SUBSCRIPTION')
          return error('provider_unavailable');
        await broadcast({
          ...envelope,
          type: 'RESTORE_ALL',
          enablementGeneration: next.enablementGeneration,
          reason,
        });
        await broadcast({
          ...envelope,
          type: 'STATUS_CHANGED',
          status: await readStatus(),
        });
        return {
          ...envelope,
          type: 'ACK',
          enablementGeneration: next.enablementGeneration,
        };
      } catch {
        return error('internal_error');
      }
    });
    serial = operation.catch(() => undefined);
    return operation;
  };
}
