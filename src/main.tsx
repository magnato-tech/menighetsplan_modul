import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { NotConfiguredNotice } from './components/NotConfiguredNotice';
import { missingInstallationSettings } from './installation';
import { clearChunkReloadAttempt } from './utils/lazyImport';
import './index.css';

clearChunkReloadAttempt();

// An installation that has not been told which database it belongs to says so, and draws nothing else
const missingSettings = missingInstallationSettings(import.meta.env);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {missingSettings.length > 0 ? <NotConfiguredNotice missing={missingSettings} /> : <App />}
  </StrictMode>,
);
