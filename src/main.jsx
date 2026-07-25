import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Note: intentionally not wrapped in <StrictMode>. Its double effect-invoke in
// dev makes ScrollTrigger register the pin twice, which shows up as a jumpy
// stage on first load. The production build is unaffected either way.
createRoot(document.getElementById('root')).render(<App />);
