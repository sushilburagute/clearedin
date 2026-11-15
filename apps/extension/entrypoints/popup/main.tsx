import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('Missing popup root');
createRoot(root).render(
  <main>
    <h1>ClearedIn</h1>
    <p>Development foundation. Filtering is not available yet.</p>
  </main>,
);
