import {
  ContentRequestSchema,
  OptionsRequestSchema,
  PopupRequestSchema,
  type AuthorizedRequest,
  type MessageSender,
} from '@clearedin/contracts';

export function authorize(
  raw: unknown,
  sender: MessageSender,
  extensionId: string,
  baseUrl: string,
): AuthorizedRequest {
  const rejected = {
    surface: 'rejected',
    error: { code: 'unauthorized_sender', retryable: false },
  } as const;
  if (sender.extensionId !== extensionId) return rejected;
  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return rejected;
  }
  if (url.search || url.hash || url.username || url.password) return rejected;
  if (
    sender.tabId === null &&
    sender.frameId === null &&
    url.href === `${baseUrl}popup.html`
  ) {
    const parsed = PopupRequestSchema.safeParse(raw);
    return parsed.success
      ? { surface: 'popup', sender, request: parsed.data }
      : rejected;
  }
  if (
    (sender.frameId === null || sender.frameId === 0) &&
    url.href === `${baseUrl}options.html`
  ) {
    const parsed = OptionsRequestSchema.safeParse(raw);
    return parsed.success
      ? { surface: 'options', sender, request: parsed.data }
      : rejected;
  }
  if (
    sender.tabId !== null &&
    sender.frameId === 0 &&
    url.origin === 'https://www.linkedin.com' &&
    /^\/feed\/?$/.test(url.pathname)
  ) {
    const parsed = ContentRequestSchema.safeParse(raw);
    return parsed.success
      ? { surface: 'content', sender, request: parsed.data }
      : rejected;
  }
  return rejected;
}
