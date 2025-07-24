/**
 * @fileoverview Hook for managing onboarding tour state
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Onboarding state management
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// === TYPES ===

interface OnboardingState {
  /** Whether the user has completed the onboarding tour */
  hasCompletedTour: boolean;
  /** Whether the tour is currently active */
  isTourActive: boolean;
  /** Number of times the user has visited the app */
  visitCount: number;
  /** Whether to show the tour on app startup */
  shouldShowTour: boolean;
}

interface UseOnboardingResult {
  /** Current onboarding state */
  state: OnboardingState;
  /** Start the onboarding tour */
  startTour: () => void;
  /** Complete the onboarding tour */
  completeTour: () => void;
  /** Skip the onboarding tour */
  skipTour: () => void;
  /** Reset onboarding state (for testing) */
  resetOnboarding: () => void;
  /** Check if user is eligible for tour */
  isEligibleForTour: () => boolean;
}

interface OnboardingSettings {
  hasCompletedTour: boolean;
  visitCount: number;
  lastVisitDate: string;
  tourSkippedDate?: string;
}

// === CONSTANTS ===

const ONBOARDING_STORAGE_KEY = 'onboarding-settings';
const DEFAULT_SETTINGS: OnboardingSettings = {
  hasCompletedTour: false,
  visitCount: 0,
  lastVisitDate: new Date().toISOString(),
};

// === ONBOARDING HOOK ===

/**
 * Hook for managing onboarding tour state and persistence
 * 
 * Handles:
 * - Tracking whether user has completed onboarding
 * - Managing tour visibility and state
 * - Persisting onboarding data locally
 * - Determining eligibility for showing the tour
 * 
 * @returns Onboarding state and control functions
 * 
 * @example
 * ```tsx
 * const { state, startTour, completeTour, isEligibleForTour } = useOnboarding();
 * 
 * useEffect(() => {
 *   if (isEligibleForTour()) {
 *     startTour();
 *   }
 * }, []);
 * ```
 */
export function useOnboarding(): UseOnboardingResult {
  // === STATE ===
  const [state, setState] = useState<OnboardingState>({
    hasCompletedTour: false,
    isTourActive: false,
    visitCount: 0,
    shouldShowTour: false,
  });

  const [settings, setSettings] = useState<OnboardingSettings>(DEFAULT_SETTINGS);

  // === INITIALIZATION ===
  useEffect(() => {
    loadOnboardingSettings();
  }, []);

  // === STORAGE OPERATIONS ===
  const loadOnboardingSettings = async () => {
    try {
      const savedSettings = await invoke<string>('load_settings');
      const parsedSettings = JSON.parse(savedSettings);
      const onboardingData = parsedSettings[ONBOARDING_STORAGE_KEY] || DEFAULT_SETTINGS;
      
      // Update visit count and last visit date
      const updatedSettings: OnboardingSettings = {
        ...onboardingData,
        visitCount: onboardingData.visitCount + 1,
        lastVisitDate: new Date().toISOString(),
      };

      setSettings(updatedSettings);
      await saveOnboardingSettings(updatedSettings);

      // Update component state
      setState({
        hasCompletedTour: updatedSettings.hasCompletedTour,
        isTourActive: false,
        visitCount: updatedSettings.visitCount,
        shouldShowTour: shouldShowTour(updatedSettings),
      });

    } catch (error) {
      console.warn('Failed to load onboarding settings, using defaults:', error);
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveOnboardingSettings = async (newSettings: OnboardingSettings) => {
    try {
      const currentSettings = await invoke<string>('load_settings');
      const parsedSettings = JSON.parse(currentSettings);
      
      const updatedSettings = {
        ...parsedSettings,
        [ONBOARDING_STORAGE_KEY]: newSettings,
      };

      await invoke('save_settings', { 
        settings: JSON.stringify(updatedSettings, null, 2) 
      });
      
    } catch (error) {
      console.error('Failed to save onboarding settings:', error);
    }
  };

  // === ELIGIBILITY LOGIC ===
  const shouldShowTour = (settings: OnboardingSettings): boolean => {
    // Don't show if already completed
    if (settings.hasCompletedTour) return false;
    
    // Don't show if explicitly skipped recently (within 7 days)
    if (settings.tourSkippedDate) {
      const skippedDate = new Date(settings.tourSkippedDate);
      const daysSinceSkipped = (Date.now() - skippedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSkipped < 7) return false;
    }

    // Show for first-time users or users who haven't completed the tour
    return settings.visitCount <= 3; // Show for first 3 visits
  };

  // === ACTIONS ===
  const startTour = useCallback(() => {
    setState(prev => ({
      ...prev,
      isTourActive: true,
    }));
  }, []);

  const completeTour = useCallback(async () => {
    const updatedSettings: OnboardingSettings = {
      ...settings,
      hasCompletedTour: true,
      lastVisitDate: new Date().toISOString(),
    };

    setSettings(updatedSettings);
    await saveOnboardingSettings(updatedSettings);

    setState(prev => ({
      ...prev,
      hasCompletedTour: true,
      isTourActive: false,
      shouldShowTour: false,
    }));
  }, [settings]);

  const skipTour = useCallback(async () => {
    const updatedSettings: OnboardingSettings = {
      ...settings,
      tourSkippedDate: new Date().toISOString(),
      lastVisitDate: new Date().toISOString(),
    };

    setSettings(updatedSettings);
    await saveOnboardingSettings(updatedSettings);

    setState(prev => ({
      ...prev,
      isTourActive: false,
      shouldShowTour: false,
    }));
  }, [settings]);

  const resetOnboarding = useCallback(async () => {
    const resetSettings = {
      ...DEFAULT_SETTINGS,
      visitCount: 1,
      lastVisitDate: new Date().toISOString(),
    };

    setSettings(resetSettings);
    await saveOnboardingSettings(resetSettings);

    setState({
      hasCompletedTour: false,
      isTourActive: false,
      visitCount: 1,
      shouldShowTour: true,
    });
  }, []);

  const isEligibleForTour = useCallback((): boolean => {
    return state.shouldShowTour && !state.hasCompletedTour;
  }, [state.shouldShowTour, state.hasCompletedTour]);

  // === RETURN INTERFACE ===
  return {
    state,
    startTour,
    completeTour,
    skipTour,
    resetOnboarding,
    isEligibleForTour,
  };
}

export default useOnboarding;