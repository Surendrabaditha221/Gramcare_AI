import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { PatientProvider } from './context/PatientContext'
import { ConnectivityProvider } from './context/ConnectivityContext'

// Register PWA Service Worker for Offline App Shell
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[GramCare AI] ServiceWorker registered with scope:', reg.scope))
      .catch((err) => console.warn('[GramCare AI] ServiceWorker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectivityProvider>
      <AuthProvider>
        <LanguageProvider>
          <PatientProvider>
            <App />
          </PatientProvider>
        </LanguageProvider>
      </AuthProvider>
    </ConnectivityProvider>
  </StrictMode>,
)
