import { useState } from 'react';
import { browser } from 'wxt/browser';
import {
  Button,
  OptionsSurface,
  PopupSurface,
  createDemoSession,
  createOptionsController,
  createPopupController,
  UNAVAILABLE_ENVIRONMENT,
} from '@clearedin/ui';
import '@clearedin/ui/styles.css';
import { createRuntimeClient } from './client';

/** Real local settings transport; provider and credential capabilities remain gated. */
export function OptionsApp() {
  const [demo, setDemo] = useState(false);
  const [controller, setController] = useState(() =>
    createOptionsController(createRuntimeClient(), UNAVAILABLE_ENVIRONMENT),
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
                  createRuntimeClient(),
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
    createPopupController(createRuntimeClient()),
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
