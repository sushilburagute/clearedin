import { createRoot } from 'react-dom/client';
import { OptionsApp } from '../../src/ui/bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Missing settings root');
createRoot(root).render(<OptionsApp />);
