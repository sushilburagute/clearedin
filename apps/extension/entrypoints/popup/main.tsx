import { createRoot } from 'react-dom/client';
import { PopupApp } from '../../src/ui/bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Missing popup root');
createRoot(root).render(<PopupApp />);
