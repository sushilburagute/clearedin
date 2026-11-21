import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';
import { FIREFOX_DATA_PERMISSIONS, LIVE_PROVIDERS } from './src/live-providers';

// WXT forwards these to unimport/unplugin, but its public type omits the
// plugin's exclude option. Keep a structural value with the shared dirs field.
const explicitImports = { dirs: [], exclude: [/.*/] };
const providerOrigins = Object.values(LIVE_PROVIDERS).map(
  ({ origin }) => origin,
);

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // All imports are explicit. Auto-import rewriting can mistake injected
  // browser ports in shared packages for the privileged WXT browser global.
  imports: explicitImports,
  vite: () => ({
    resolve: {
      alias: [
        {
          find: 'wxt/browser',
          replacement: createRequire(import.meta.url).resolve('wxt/browser'),
        },
        {
          find: /^zod$/,
          replacement: fileURLToPath(
            new URL('./build/zod-csp.ts', import.meta.url),
          ),
        },
      ],
    },
  }),
  manifestVersion: 3,
  // release:prepare archives the whole workspace from the reviewed Git tree.
  zip: { zipSources: false },
  manifest: ({ browser }) => ({
    name: 'ClearedIn Development',
    description:
      'Choose which LinkedIn home-feed posts to hide using your own provider key. Filtering starts only after setup and consent.',
    action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' } },
    permissions: ['storage'],
    optional_host_permissions: providerOrigins.map((origin) => origin + '/*'),
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Development identity only. Review before public distribution.
              id: 'development@clearedin.invalid',
              strict_min_version: '140.0',
              data_collection_permissions: {
                required: ['none'],
                optional: FIREFOX_DATA_PERMISSIONS,
              },
            },
          },
        }
      : {}),
    content_security_policy: {
      extension_pages: [
        "default-src 'self'",
        "script-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        'connect-src ' + providerOrigins.join(' '),
      ].join('; '),
    },
  }),
});
