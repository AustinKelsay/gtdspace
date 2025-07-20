/**
 * @fileoverview Main App component for GTD Space markdown editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Basic app shell with theme management and backend communication
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layout } from './components/Layout';
import type { AppState, PermissionStatus, Theme } from '@/types';
import './styles/globals.css';

/**
 * Main application component
 * 
 * Manages global application state, theme, and initializes backend communication.
 * Provides the root component structure for the entire application.
 * 
 * In Phase 0, this handles:
 * - Theme management (dark/light mode)
 * - Backend connectivity testing
 * - Basic application state
 * - Error boundary setup
 * 
 * @returns Main application JSX structure
 */
export const App: React.FC = () => {
  // === APPLICATION STATE ===
  const [appState, setAppState] = useState<AppState>({
    theme: 'dark', // Default to dark theme
    isReady: false,
    isLoading: true,
    error: null
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);

  // === THEME MANAGEMENT ===
  
  /**
   * Apply theme to document root
   */
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto theme - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    const newTheme: Theme = appState.theme === 'dark' ? 'light' : 'dark';
    setAppState(prev => ({ ...prev, theme: newTheme }));
  };

  // === BACKEND COMMUNICATION ===
  
  /**
   * Test backend connectivity and get app version
   */
  const initializeApp = async () => {
    try {
      setAppState(prev => ({ ...prev, isLoading: true, error: null }));

      // Test basic connectivity
      console.log('Testing backend connectivity...');
      const pingResponse = await invoke<string>('ping');
      console.log('Ping response:', pingResponse);

      // Get app version
      const version = await invoke<string>('get_app_version');
      console.log('App version:', version);

      // Check permissions
      const permissionStatus = await invoke<PermissionStatus>('check_permissions');
      console.log('Permissions:', permissionStatus);
      setPermissions(permissionStatus);

      // Mark app as ready
      setAppState(prev => ({
        ...prev,
        isReady: true,
        isLoading: false,
        error: null
      }));

      console.log('App initialization completed successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setAppState(prev => ({
        ...prev,
        isReady: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  };

  // === EFFECTS ===

  /**
   * Initialize app on mount
   */
  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Apply theme when it changes
   */
  useEffect(() => {
    applyTheme(appState.theme);
  }, [appState.theme]);

  /**
   * Listen for system theme changes when in auto mode
   */
  useEffect(() => {
    if (appState.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('auto');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [appState.theme]);

  // === LOADING STATE ===
  
  if (appState.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Initializing GTD Space...</p>
        </div>
      </div>
    );
  }

  // === ERROR STATE ===
  
  if (appState.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
            <span className="text-red-600 dark:text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Initialization Failed
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {appState.error}
          </p>
          <button
            onClick={initializeApp}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // === MAIN APPLICATION ===
  
  return (
    <div className="App">
      <Layout
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      >
        {/* Theme toggle button - temporary for Phase 0 testing */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-50 p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-accent transition-colors"
          title={`Switch to ${appState.theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {appState.theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Debug info - temporary for Phase 0 */}
        {import.meta.env.DEV && permissions && (
          <div className="fixed bottom-4 right-4 z-50 p-3 bg-card border border-border rounded-lg shadow-lg text-xs max-w-xs">
            <h4 className="font-semibold mb-1">Debug Info (Phase 0)</h4>
            <p>Backend: Connected ✅</p>
            <p>Theme: {appState.theme}</p>
            <p>Permissions: {permissions.can_read_files ? '✅' : '❌'} Read, {permissions.can_write_files ? '✅' : '❌'} Write</p>
          </div>
        )}
      </Layout>
    </div>
  );
};

export default App;