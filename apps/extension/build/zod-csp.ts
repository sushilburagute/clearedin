import { config } from 'zod/v4';

// Use Zod's interpreted parser before constructing any extension schemas.
// This skips its dynamic-code probe under the extension-pages CSP.
config({ jitless: true });
export * from 'zod/v4';
export { default } from 'zod/v4';
