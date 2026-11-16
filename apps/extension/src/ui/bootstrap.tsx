import { useState } from 'react';
import { browser } from 'wxt/browser';
import {
  Button,
  OptionsSurface,
  PopupSurface,
  createDemoSession,
  createOptionsController,
  createPopupController,
  createUnavailableClient,
  UNAVAILABLE_ENVIRONMENT,
} from '@clearedin/ui';
import '@clearedin/ui/styles.css';

/** Task 11 supplies real clients/capabilities. This build has no credential or network path. */
export function OptionsApp() {
  const [demo, setDemo] = useState(false);
  const [controller, setController] = useState(() =>
    createOptionsController(createUnavailableClient(), UNAVAILABLE_ENVIRONMENT),
  );
  return (
    <>
      <div className="ci-app ci-options">
        <Button
          className="ci-secondary"
          onClick={() => {
            controller.dispose();
            if (demo)
              setController(
                createOptionsController(
                  createUnavailableClient(),
                  UNAVAILABLE_ENVIRONMENT,
                ),
              );
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
        key={demo ? 'demo' : 'unavailable'}
        controller={controller}
      />
    </>
  );
}

export function PopupApp() {
  const [controller] = useState(() =>
    createPopupController(createUnavailableClient()),
  );
  return (
    <PopupSurface
      controller={controller}
      mode="unavailable"
      openSettings={() => {
        void browser.runtime.openOptionsPage();
      }}
    />
  );
}
