import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID 

// Suppress FedCM errors in console (these are expected and handled by fallback)
// These errors occur when:
// - Google Sign-In components unmount during navigation (AbortError)
// - FedCM is disabled or network issues occur (NetworkError - browser falls back to popup)
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  // Suppress FedCM/GSI errors - these are harmless and handled by browser fallback
  if ((message.includes('FedCM') || message.includes('GSI_LOGGER')) && 
      (message.includes('AbortError') || 
       message.includes('NetworkError') || 
       message.includes('aborted') ||
       message.includes('Error retrieving a token'))) {
    return; // Don't log these specific FedCM/GSI errors
  }
  // Preserve all other console errors
  originalError.apply(console, args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
