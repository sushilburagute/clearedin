import {
  BroadcastMessageSchema,
  ReplyMessageSchema,
  type BroadcastMessage,
  type MessageClient,
  type RequestMessage,
  type ReplyFor,
} from '@clearedin/contracts';

export interface RuntimeTransport {
  sendMessage(message: unknown): Promise<unknown>;
  subscribe(listener: (message: unknown) => void): () => void;
}

/** Every transport boundary validates data and correlation before delivering it. */
export function createMessageClient<Allowed extends RequestMessage>(
  transport: RuntimeTransport,
): MessageClient<Allowed> {
  return {
    async send<R extends Allowed>(
      request: R,
      signal?: AbortSignal,
    ): Promise<ReplyFor<R>> {
      signal?.throwIfAborted();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      try {
        const raw = await Promise.race([
          transport.sendMessage(request),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), 12_000);
            abort = () => reject(new Error('cancelled'));
            signal?.addEventListener('abort', abort, { once: true });
          }),
        ]);
        signal?.throwIfAborted();
        const reply = ReplyMessageSchema.parse(raw);
        const expected =
          {
            GET_PUBLIC_STATUS: 'PUBLIC_STATUS',
            GET_SETTINGS: 'SETTINGS',
            CLASSIFY_POST: 'CLASSIFICATION_RESULT',
            EXPORT_DIAGNOSTICS: 'DIAGNOSTICS',
            TEST_PROVIDER_CONNECTION: 'PROVIDER_TEST_RESULT',
          }[request.type as string] ?? 'ACK';
        if (
          reply.requestId !== request.requestId ||
          (reply.type !== 'ERROR' && reply.type !== expected)
        )
          throw new Error('invalid_response');
        return reply as ReplyFor<R>;
      } finally {
        clearTimeout(timer);
        if (abort) signal?.removeEventListener('abort', abort);
      }
    },
    subscribe(listener: (event: BroadcastMessage) => void) {
      return transport.subscribe((raw) => {
        const event = BroadcastMessageSchema.safeParse(raw);
        if (event.success) listener(event.data);
      });
    },
  };
}
