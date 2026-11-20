import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  // The site's Content Security Policy allows scripts loaded from local files.
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
