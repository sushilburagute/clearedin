import {
  ContentRequestSchema,
  OptionsRequestSchema,
  type MessageSender,
} from '@clearedin/contracts';
import { supportsFixture } from './routes.ts';

export type Surface = 'options' | 'content' | 'rejected';

export function senderSurface(
  sender: MessageSender,
  extensionId: string,
  optionsUrl: string,
): Surface {
  if (sender.extensionId !== extensionId) return 'rejected';
  // A tab id alone does not mean content: options pages may be opened in tabs.
  // Require the exact packaged URL, with no suffix/query/fragment, and no subframe.
  if (
    sender.url === optionsUrl &&
    (sender.frameId === null || sender.frameId === 0)
  )
    return 'options';
  if (
    sender.tabId !== null &&
    sender.frameId === 0 &&
    supportsFixture(sender.url)
  )
    return 'content';
  return 'rejected';
}

export function authorizeCanonical(
  surface: Surface,
  message: unknown,
): boolean {
  if (surface === 'options')
    return OptionsRequestSchema.safeParse(message).success;
  if (surface === 'content')
    return ContentRequestSchema.safeParse(message).success;
  return false;
}

// Separate experiment-only commands, never additions to the frozen wire contract.
export function isProbeCommand(message: unknown, type: string): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    Object.keys(message).length === 1 &&
    'type' in message &&
    message.type === type
  );
}
