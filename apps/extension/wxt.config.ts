import { createRequire } from 'node:module';
import { defineConfig } from 'wxt';

// WXT forwards these to unimport/unplugin, but its public type omits the
// plugin's exclude option. Keep a structural value with the shared dirs field.
const explicitImports = { dirs: [], exclude: [/.*/] };

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // All imports are explicit. Auto-import rewriting can mistake injected
  // browser ports in shared packages for the privileged WXT browser global.
  imports: explicitImports,
  vite: () => ({
    resolve: {
      alias: {
        'wxt/browser': createRequire(import.meta.url).resolve('wxt/browser'),
      },
    },
  }),
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'ClearedIn Development',
    description:
      'Development preview with local category settings and synthetic demos. Live filtering is unavailable.',
    action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' } },
    permissions: ['storage'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Development identity only. Review before public distribution.
              id: 'development@clearedin.invalid',
              strict_min_version: '140.0',
              // No remote data transmission. Revisit before enabling providers.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  }),
});
