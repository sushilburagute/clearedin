import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('Missing settings root');
createRoot(root).render(
  <main>
    <h1>ClearedIn settings</h1>
    <p>
      Setup and provider connections are not implemented. Do not enter API keys
      into this development build.
    </p>
  </main>,
);
