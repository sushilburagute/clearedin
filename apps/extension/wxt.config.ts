import { createRequire } from 'node:module';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
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
      'Development foundation for user-controlled feed filtering. Filtering is not implemented.',
    permissions: ['storage'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Development identity only. Review before public distribution.
              id: 'development@clearedin.invalid',
              strict_min_version: '140.0',
              // Accurate only for this inert scaffold. Revisit before adding providers.
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
