/**
 * @fileoverview React application entry point for GTD Space
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { checkTauriContextAsync } from './utils/tauri-ready';

// Initialize Tauri context check early and cache the result
checkTauriContextAsync().then(inTauri => {
  if (!inTauri) {
    console.warn('GTD Space is designed to run as a Tauri application');
  }
});

/**
 * Initialize React application
 * 
 * Creates the root React component and mounts it to the DOM.
 * Includes error handling for development debugging.
 */
const initializeApp = () => {
  try {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      throw new Error('Root element not found - check index.html');
    }

    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    console.log('GTD Space application initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Show error in DOM if React fails to mount
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: system-ui, -apple-system, sans-serif;
          background: #09090b;
          color: #fafafa;
        ">
          <div style="text-align: center; max-width: 400px; padding: 2rem;">
            <h1 style="margin-bottom: 1rem; color: #ef4444;">Application Error</h1>
            <p style="margin-bottom: 1rem; color: #a1a1aa; font-size: 0.875rem;">
              Failed to initialize GTD Space. Please check the console for details.
            </p>
            <details style="text-align: left; font-size: 0.75rem; color: #71717a;">
              <summary style="cursor: pointer; margin-bottom: 0.5rem;">Error Details</summary>
              <code>${error instanceof Error ? error.message : String(error)}</code>
            </details>
          </div>
        </div>
      `;
    }
  }
};

// Initialize the application
initializeApp();