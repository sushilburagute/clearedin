import {
  ContentRequestSchema,
  OptionsRequestSchema,
  PopupRequestSchema,
  type AuthorizedRequest,
  type MessageSender,
} from '@clearedin/contracts';

export function supportsFeed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'https://www.linkedin.com' &&
      (parsed.pathname === '/feed' || parsed.pathname === '/feed/')
    );
  } catch {
    return false;
  }
}

/** Only browser-supplied metadata grants privileges; payload claims never do. */
export function authorizeRequest(
  raw: unknown,
  sender: MessageSender,
  extension: { id: string; optionsUrl: string; popupUrl: string },
): AuthorizedRequest {
  const reject = (
    code: 'unauthorized_sender' | 'invalid_request' | 'unsupported_route',
  ): AuthorizedRequest => ({
    surface: 'rejected',
    error: { code, retryable: false },
  });
  if (
    sender.extensionId !== extension.id ||
    (sender.frameId !== null && sender.frameId !== 0)
  )
    return reject('unauthorized_sender');
  // Exact packaged page URL, allowing its own query/hash but no path prefix match.
  let page: string;
  try {
    const url = new URL(sender.url);
    page = `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return reject('unauthorized_sender');
  }
  if (page === extension.optionsUrl) {
    const result = OptionsRequestSchema.safeParse(raw);
    return result.success
      ? { surface: 'options', sender, request: result.data }
      : reject('invalid_request');
  }
  if (page === extension.popupUrl && sender.tabId === null) {
    const result = PopupRequestSchema.safeParse(raw);
    return result.success
      ? { surface: 'popup', sender, request: result.data }
      : reject('invalid_request');
  }
  if (sender.tabId === null || sender.frameId !== 0)
    return reject('unauthorized_sender');
  if (!supportsFeed(sender.url)) return reject('unsupported_route');
  const result = ContentRequestSchema.safeParse(raw);
  return result.success
    ? { surface: 'content', sender, request: result.data }
    : reject('unauthorized_sender');
}
