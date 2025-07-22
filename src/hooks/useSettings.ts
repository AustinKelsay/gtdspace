/**
 * @fileoverview Settings management hook for Phase 2 functionality
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Enhanced settings persistence and management
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { UserSettings } from '@/types';

/**
 * Settings manager hook for handling user preferences
 * 
 * Provides functionality for loading and saving user settings with
 * automatic persistence to Tauri's store. Settings include theme,
 * editor preferences, and last folder selection.
 * 
 * @returns Settings state and management functions
 * 
 * @example
 * ```tsx
 * const {
 *   settings,
 *   isLoading,
 *   updateSettings,
 *   setTheme,
 *   setEditorMode,
 *   error
 * } = useSettings();
 * ```
 */
export const useSettings = () => {
  // === STATE ===
  
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    font_size: 14,
    tab_size: 2,
    word_wrap: true,
    last_folder: null,
    editor_mode: 'split',
    window_width: 1200,
    window_height: 800,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // === SETTINGS OPERATIONS ===
  
  /**
   * Load settings from persistent storage
   */
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading user settings...');
      const loadedSettings = await invoke<UserSettings>('load_settings');
      
      setSettings(loadedSettings);
      console.log('Settings loaded successfully:', loadedSettings);
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError(typeof error === 'string' ? error : 'Failed to load settings');
      
      // Keep default settings on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save settings to persistent storage
   */
  const saveSettings = useCallback(async (newSettings: UserSettings) => {
    try {
      setError(null);
      
      console.log('Saving user settings...', newSettings);
      await invoke<string>('save_settings', { settings: newSettings });
      
      setSettings(newSettings);
      console.log('Settings saved successfully');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError(typeof error === 'string' ? error : 'Failed to save settings');
    }
  }, []);

  /**
   * Update specific settings properties
   */
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  /**
   * Set theme preference
   */
  const setTheme = useCallback(async (theme: string) => {
    await updateSettings({ theme });
  }, [updateSettings]);

  /**
   * Set editor mode preference
   */
  const setEditorMode = useCallback(async (editor_mode: 'source' | 'preview' | 'split') => {
    await updateSettings({ editor_mode });
  }, [updateSettings]);

  /**
   * Set last folder for quick access
   */
  const setLastFolder = useCallback(async (last_folder: string | null) => {
    await updateSettings({ last_folder });
  }, [updateSettings]);

  /**
   * Set font size preference
   */
  const setFontSize = useCallback(async (font_size: number) => {
    await updateSettings({ font_size });
  }, [updateSettings]);

  /**
   * Set tab size preference
   */
  const setTabSize = useCallback(async (tab_size: number) => {
    await updateSettings({ tab_size });
  }, [updateSettings]);

  /**
   * Set word wrap preference
   */
  const setWordWrap = useCallback(async (word_wrap: boolean) => {
    await updateSettings({ word_wrap });
  }, [updateSettings]);

  // === INITIALIZATION ===
  
  /**
   * Load settings on hook initialization
   */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // === RETURN STATE AND OPERATIONS ===
  
  return {
    settings,
    isLoading,
    error,
    updateSettings,
    setTheme,
    setEditorMode,
    setLastFolder,
    setFontSize,
    setTabSize,
    setWordWrap,
    reload: loadSettings,
  };
};

export default useSettings;