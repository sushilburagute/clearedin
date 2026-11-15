import type {
  AuthorizedRequest,
  ContentClient,
  OptionsClient,
  PopupClient,
} from '../src';

// Compiled by the workspace typecheck; these functions are never invoked in tests.
export async function verifyPopupBoundary(client: PopupClient): Promise<void> {
  const response = await client.send({
    protocolVersion: 1,
    requestId: 'typecheck',
    type: 'GET_PUBLIC_STATUS',
  });
  if (response.type === 'PUBLIC_STATUS') {
    const enabled: boolean = response.status.enabled;
    void enabled;
    // @ts-expect-error Public status never contains a credential.
    void response.status.credential;
  }
  await client.send({
    protocolVersion: 1,
    requestId: 'typecheck',
    // @ts-expect-error Popup cannot mutate credentials.
    type: 'SET_CREDENTIAL',
    provider: 'typesafe',
    credential: 'synthetic',
  });
  await client.send({
    protocolVersion: 1,
    requestId: 'typecheck',
    // @ts-expect-error Popup cannot read full settings.
    type: 'GET_SETTINGS',
  });
}

export async function verifyOptionsReply(client: OptionsClient): Promise<void> {
  const response = await client.send({
    protocolVersion: 1,
    requestId: 'typecheck',
    type: 'GET_SETTINGS',
  });
  if (response.type === 'SETTINGS') {
    const requestLimit: number = response.settings.dailyRequestLimit;
    void requestLimit;
    // @ts-expect-error Settings never contain a credential.
    void response.settings.credential;
  }
  // @ts-expect-error GET_SETTINGS cannot return classification evidence.
  if (response.type === 'CLASSIFICATION_RESULT')
    throw new Error('Invalid reply type');
}

export async function verifyContentBoundary(
  client: ContentClient,
): Promise<void> {
  await client.send({
    protocolVersion: 1,
    requestId: 'typecheck',
    // @ts-expect-error Content scripts cannot change enablement.
    type: 'SET_ENABLED',
    enabled: true,
  });
}

export function verifyAuthorizedSurface(request: AuthorizedRequest): void {
  if (request.surface === 'popup') {
    // @ts-expect-error Popup authorization cannot produce options-only commands.
    if (request.request.type === 'SET_CREDENTIAL')
      throw new Error('Invalid authorization');
  }
}
