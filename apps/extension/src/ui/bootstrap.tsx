import { useState } from 'react';
import { browser } from 'wxt/browser';
import { PROVIDER_IDS } from '@clearedin/contracts';
import {
  Button,
  OptionsSurface,
  PopupSurface,
  createDemoSession,
  createOptionsController,
  createPopupController,
  type UiEnvironment,
} from '@clearedin/ui';
import '@clearedin/ui/styles.css';
import { createRuntimeClient } from '../messaging/runtime-client';
import { LIVE_PROVIDERS, providerPermissions } from '../live-providers';

const liveEnvironment: UiEnvironment = {
  mode: 'connected',
  credentialEntry: true,
  now: () => Date.now(),
  providers: PROVIDER_IDS.map((id) => {
    const { model, origin, label, recipientId, retentionUrl } =
      LIVE_PROVIDERS[id];
    return {
      id,
      label,
      recipientId,
      retentionUrl,
      permissionLabel: origin,
      models: [{ id: model, label: model }],
      available: true,
      unavailableReason: '',
    };
  }),
  hasPermission: (provider) =>
    browser.permissions.contains(providerPermissions(provider)),
  requestPermission: (provider) =>
    browser.permissions.request(providerPermissions(provider)),
};

function liveOptions() {
  return createOptionsController(createRuntimeClient(), liveEnvironment);
}

export function OptionsApp() {
  const [demo, setDemo] = useState(false);
  const [controller, setController] = useState(liveOptions);
  return (
    <>
      <div className="ci-app ci-mode-switch">
        <Button
          className="ci-secondary"
          onClick={() => {
            if (demo) setController(liveOptions());
            else {
              const session = createDemoSession();
              setController(
                createOptionsController(session.client, session.environment),
              );
            }
            setDemo(!demo);
          }}
        >
          {demo
            ? 'Exit synthetic demo and discard changes'
            : 'Explore synthetic UI demo (no provider connection)'}
        </Button>
      </div>
      <OptionsSurface
        key={demo ? 'demo' : 'connected'}
        controller={controller}
      />
    </>
  );
}

export function PopupApp() {
  const [controller] = useState(() =>
    createPopupController(createRuntimeClient()),
  );
  return (
    <PopupSurface
      controller={controller}
      openSettings={() => {
        void browser.runtime.openOptionsPage();
      }}
    />
  );
}
