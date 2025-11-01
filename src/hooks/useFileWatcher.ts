/**
 * @fileoverview File watcher hook for detecting external file changes
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - File watching service integration
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { listen } from '@tauri-apps/api/event';
// Memory leak prevention removed during simplification
import type { FileChangeEvent } from '@/types';

export interface FileWatcherState {
  /** Whether the watcher is currently active */
  isWatching: boolean;
  /** Currently watched folder path */
  watchedPath: string | null;
  /** Recent file change events */
  recentEvents: FileChangeEvent[];
  /** Error message if watcher failed */
  error: string | null;
}

export interface FileWatcherHookResult {
  /** Current watcher state */
  state: FileWatcherState;
  /** Start watching a folder */
  startWatching: (folderPath: string) => Promise<void>;
  /** Stop watching */
  stopWatching: () => Promise<void>;
  /** Clear recent events */
  clearEvents: () => void;
  /** Get events for a specific file */
  getEventsForFile: (filePath: string) => FileChangeEvent[];
}

/**
 * Custom hook for managing file watching functionality
 * 
 * Provides integration with the Rust file watcher service and handles
 * file change events from the backend. Includes debouncing and event
 * management for smooth UX.
 * 
 * @returns File watcher hook result with state and control functions
 */
export function useFileWatcher(): FileWatcherHookResult {
  // === EVENT MANAGEMENT ===
  const maxEvents = 50; // Limit to 50 events
  
  // === STATE ===
  
  const [state, setState] = useState<FileWatcherState>({
    isWatching: false,
    watchedPath: null,
    recentEvents: [],
    error: null,
  });
  
  const unlistenRef = useRef<(() => void) | null>(null);
  
  // === EVENT HANDLERS ===
  
  /**
   * Handle file change events from the backend
   */
  const handleFileChange = useCallback((event: FileChangeEvent) => {
    console.log('File change detected:', event);
    
    setState(prev => ({
      ...prev,
      recentEvents: [event, ...prev.recentEvents].slice(0, maxEvents),
    }));
  }, []);
  
  // === WATCHER CONTROL FUNCTIONS ===
  
  /**
   * Stop the file watcher
   */
  const stopWatching = useCallback(async () => {
    try {
      // Stop listening to events
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      
      // Stop the backend watcher
      if (state.isWatching) {
        await safeInvoke('stop_file_watcher', undefined, null);
      }
      
      setState(prev => ({
        ...prev,
        isWatching: false,
        watchedPath: null,
        error: null,
      }));
      
      console.log('File watcher stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to stop file watcher:', errorMessage);
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [state.isWatching]);

  /**
   * Start watching a folder for file changes
   */
  const startWatching = useCallback(async (folderPath: string) => {
    try {
      // Stop existing watcher if running
      if (state.isWatching) {
        await stopWatching();
      }
      
      setState(prev => ({
        ...prev,
        error: null,
      }));

      const normalizedPath = folderPath.trim();
      const directoryExists = await safeInvoke<boolean>('check_directory_exists', { path: normalizedPath }, null);
      if (directoryExists === false) {
        console.warn('Skipping file watcher; directory missing:', normalizedPath);
        setState(prev => ({
          ...prev,
          isWatching: false,
          watchedPath: null,
          error: 'Folder is unavailable. Select or initialize a GTD workspace first.',
        }));
        return;
      }
      
      // Start the backend file watcher
      await safeInvoke('start_file_watcher', { folderPath: normalizedPath }, null);
      
      // Listen for file change events
      const unlisten = await listen<FileChangeEvent>('file-changed', (event) => {
        handleFileChange(event.payload);
      });
      
      unlistenRef.current = unlisten;
      
      // Clear previous events
      
      setState(prev => ({
        ...prev,
        isWatching: true,
        watchedPath: normalizedPath,
        recentEvents: [],
      }));
      
      console.log('File watcher started for:', normalizedPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start file watcher:', errorMessage);
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isWatching: false,
        watchedPath: null,
      }));
    }
  }, [state.isWatching, stopWatching, handleFileChange]);
  
  /**
   * Clear recent events
   */
  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      recentEvents: [],
    }));
  }, []);
  
  /**
   * Get events for a specific file path
   */
  const getEventsForFile = useCallback((filePath: string) => {
    return state.recentEvents.filter(event => event.file_path === filePath);
  }, [state.recentEvents]);
  
  // === CLEANUP ON UNMOUNT ===
  
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);
  
  // === HOOK RESULT ===
  
  return {
    state,
    startWatching,
    stopWatching,
    clearEvents,
    getEventsForFile,
  };
}

export default useFileWatcher;
