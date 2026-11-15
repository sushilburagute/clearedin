import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  zip: { excludeSources: ['results/**', 'profiles/**'] },
  manifest: ({ browser }) => ({
    name: 'ClearedIn Synthetic Browser Probe',
    description: 'Task 02 mechanics only; no LinkedIn or provider access.',
    permissions: ['storage'],
    optional_host_permissions: ['https://example.com/*'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'browser-probe@clearedin.invalid',
              strict_min_version: '140.0',
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
