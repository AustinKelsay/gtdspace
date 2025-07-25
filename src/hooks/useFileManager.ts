/**
 * @fileoverview File management hook for Phase 1 functionality
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - File operations, folder management, and state handling
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '@/hooks/useSettings';
import { startTiming, endTiming, recordFileOperation } from '@/services/performance/PerformanceMonitor';
import { cacheManager } from '@/services/caching';
import { useResourceCleanup, useMemoryLeakDetection } from '@/services/performance/memoryLeakPrevention';
import type { 
  MarkdownFile, 
  FileOperationResult, 
  FileOperation, 
  AppStatePhase1,
  EditorMode 
} from '@/types';

/**
 * File manager hook for handling all file operations
 * 
 * Provides functionality for folder selection, file listing, file operations
 * (create, read, save, rename, delete), and state management for the Phase 1 MVP.
 * 
 * @returns File manager state and operations
 * 
 * @example
 * ```tsx
 * const {
 *   state,
 *   selectFolder,
 *   loadFile,
 *   saveCurrentFile,
 *   handleFileOperation,
 *   updateContent,
 *   setSearchQuery
 * } = useFileManager();
 * ```
 */
export const useFileManager = () => {
  // === MEMORY LEAK PREVENTION ===
  const { safeSetTimeout, safeAddEventListener } = useResourceCleanup();
  // Memory leak detection for this hook
  useMemoryLeakDetection('useFileManager');
  
  // === SETTINGS INTEGRATION ===
  
  const { settings, setLastFolder, setEditorMode } = useSettings();
  
  // === STATE ===
  
  const [state, setState] = useState<AppStatePhase1>({
    // Base app state
    theme: settings.theme as 'light' | 'dark' | 'auto',
    isReady: true,
    isLoading: false,
    error: null,
    
    // Phase 1 file management state
    currentFolder: settings.last_folder || null,
    files: [],
    currentFile: null,
    fileContent: '',
    hasUnsavedChanges: false,
    editorMode: settings.editor_mode as EditorMode,
    searchQuery: '',
    autoSaveStatus: 'idle',
  });

  // === FOLDER OPERATIONS ===
  
  /**
   * Load a folder by path and display its markdown files
   */
  const loadFolder = useCallback(async (folderPath: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('Loading folder:', folderPath);
      
      // Load files from selected folder
      const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
        path: folderPath 
      });
      console.log(`Loaded ${files.length} markdown files`);
      
      setState(prev => ({
        ...prev,
        currentFolder: folderPath,
        files,
        isLoading: false,
        currentFile: null,
        fileContent: '',
        hasUnsavedChanges: false,
      }));
      
      // Save folder to settings for persistence
      await setLastFolder(folderPath);
      
    } catch (error) {
      console.log('Failed to load folder:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: typeof error === 'string' ? error : 'Failed to load folder',
      }));
    }
  }, [setLastFolder]);
  
  /**
   * Select a folder and load its markdown files
   */
  const selectFolder = useCallback(async () => {
    try {
      console.log('Opening folder selection dialog...');
      const folderPath = await invoke<string>('select_folder');
      console.log('Folder selected:', folderPath);
      
      await loadFolder(folderPath);
      
    } catch (error) {
      console.log('Folder selection cancelled or failed:', error);
      setState(prev => ({
        ...prev,
        error: typeof error === 'string' ? error : 'Folder selection cancelled',
      }));
    }
  }, [loadFolder]);

  /**
   * Refresh the current folder's file list
   */
  const refreshFiles = useCallback(async () => {
    if (!state.currentFolder) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
        path: state.currentFolder 
      });
      
      setState(prev => ({
        ...prev,
        files,
        isLoading: false,
      }));
      
    } catch (error) {
      console.error('Failed to refresh files:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh files',
      }));
    }
  }, [state.currentFolder]);

  // === FILE OPERATIONS ===
  
  /**
   * Load a file's content into the editor
   */
  const loadFile = useCallback(async (file: MarkdownFile) => {
    const timingId = `file_load_${file.id}`;
    startTiming(timingId);
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('Loading file:', file.path);
      
      // Check cache first
      let content = cacheManager.getFileContent(file.path);
      
      if (content === undefined) {
        // Load from file system if not cached
        content = await invoke<string>('read_file', { path: file.path });
        // Cache the content
        cacheManager.setFileContent(file.path, content);
      }
      
      // Record performance metrics
      endTiming(timingId, 'file_operation', { 
        fileSize: file.size,
        fileName: file.name 
      });
      recordFileOperation('open', performance.now() - performance.timeOrigin, file.size);
      
      setState(prev => ({
        ...prev,
        currentFile: file,
        fileContent: content,
        hasUnsavedChanges: false,
        isLoading: false,
      }));
      
      console.log('File loaded successfully');
      
    } catch (error) {
      console.error('Failed to load file:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load file: ${error}`,
      }));
    }
  }, []);

  /**
   * Save the current file's content
   */
  const saveCurrentFile = useCallback(async () => {
    if (!state.currentFile || !state.hasUnsavedChanges) return;
    
    const timingId = `file_save_${state.currentFile.id}`;
    startTiming(timingId);
    
    try {
      setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));
      
      console.log('Saving file:', state.currentFile.path);
      await invoke<string>('save_file', {
        path: state.currentFile.path,
        content: state.fileContent,
      });
      
      // Update cache with new content
      cacheManager.setFileContent(state.currentFile.path, state.fileContent);
      
      // Record performance metrics
      endTiming(timingId, 'file_operation', { 
        fileSize: state.currentFile.size,
        fileName: state.currentFile.name,
        contentLength: state.fileContent.length
      });
      recordFileOperation('save', performance.now() - performance.timeOrigin, state.fileContent.length);
      
      setState(prev => ({
        ...prev,
        hasUnsavedChanges: false,
        autoSaveStatus: 'saved',
      }));
      
      console.log('File saved successfully');
      
      // Reset save status after 2 seconds
      safeSetTimeout(() => {
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
      }, 2000);
      
    } catch (error) {
      console.error('Failed to save file:', error);
      setState(prev => ({
        ...prev,
        autoSaveStatus: 'error',
        error: `Failed to save file: ${error}`,
      }));
    }
  }, [state.currentFile, state.fileContent, state.hasUnsavedChanges]);

  /**
   * Handle file operations (create, rename, delete)
   */
  const handleFileOperation = useCallback(async (operation: FileOperation) => {
    if (!state.currentFolder) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      let result: FileOperationResult;
      
      switch (operation.type) {
        case 'create':
          console.log('Creating file:', operation.name);
          result = await invoke<FileOperationResult>('create_file', {
            directory: state.currentFolder,
            name: operation.name,
          });
          break;
          
        case 'rename':
          console.log('Renaming file:', operation.oldPath, 'to', operation.newName);
          result = await invoke<FileOperationResult>('rename_file', {
            old_path: operation.oldPath,
            new_name: operation.newName,
          });
          break;
          
        case 'delete':
          console.log('Deleting file:', operation.path);
          result = await invoke<FileOperationResult>('delete_file', {
            path: operation.path,
          });
          break;
          
        case 'copy':
          console.log('Copying file from:', operation.sourcePath, 'to:', operation.destPath);
          const copyResult = await invoke<string>('copy_file', {
            source_path: operation.sourcePath,
            dest_path: operation.destPath,
          });
          result = { success: true, message: copyResult };
          break;
          
        case 'move':
          console.log('Moving file from:', operation.sourcePath, 'to:', operation.destPath);
          const moveResult = await invoke<string>('move_file', {
            source_path: operation.sourcePath,
            dest_path: operation.destPath,
          });
          result = { success: true, message: moveResult };
          break;
          
        default:
          throw new Error('Unknown file operation');
      }
      
      if (result.success) {
        console.log('File operation successful:', result.message);
        // Refresh file list after successful operation
        await refreshFiles();
        
        // If we deleted the current file, clear the editor and cache
        if (operation.type === 'delete' && state.currentFile?.path === operation.path) {
          cacheManager.invalidateFileContent(operation.path);
          setState(prev => ({
            ...prev,
            currentFile: null,
            fileContent: '',
            hasUnsavedChanges: false,
          }));
        }
        
        // Handle rename operation cache invalidation
        if (operation.type === 'rename' && operation.oldPath) {
          cacheManager.invalidateFileContent(operation.oldPath);
        }
      } else {
        throw new Error(result.message || 'Operation failed');
      }
      
    } catch (error) {
      console.error('File operation failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `File operation failed: ${error}`,
      }));
    }
  }, [state.currentFolder, state.currentFile, refreshFiles]);

  // === CONTENT MANAGEMENT ===
  
  /**
   * Update file content and mark as unsaved
   */
  const updateContent = useCallback((content: string) => {
    setState(prev => ({
      ...prev,
      fileContent: content,
      hasUnsavedChanges: prev.fileContent !== content,
    }));
  }, []);

  /**
   * Set search query for file filtering
   */
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  /**
   * Set editor mode
   */
  const setEditorModeLocal = useCallback(async (mode: EditorMode) => {
    setState(prev => ({ ...prev, editorMode: mode }));
    await setEditorMode(mode);
  }, [setEditorMode]);

  // === AUTO-SAVE EFFECT ===
  
  /**
   * Auto-save file content after 2 seconds of inactivity
   */
  useEffect(() => {
    if (!state.hasUnsavedChanges) return;
    
    const timeoutId = safeSetTimeout(() => {
      saveCurrentFile();
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [state.fileContent, state.hasUnsavedChanges, saveCurrentFile, safeSetTimeout]);

  // === INITIALIZATION ===
  
  /**
   * Load last folder on startup if available
   */
  useEffect(() => {
    if (settings.last_folder && !state.currentFolder) {
      // Auto-load the last folder
      (async () => {
        try {
          const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
            path: settings.last_folder 
          });
          setState(prev => ({
            ...prev,
            currentFolder: settings.last_folder || null,
            files,
          }));
        } catch (error) {
          console.log('Failed to load last folder:', error);
        }
      })();
    }
  }, [settings.last_folder, state.currentFolder]);

  // === KEYBOARD SHORTCUTS ===
  
  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveCurrentFile();
      }
      
      // Ctrl/Cmd + O to open folder
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        selectFolder();
      }
    };

    safeAddEventListener(document, 'keydown', handleKeyDown as EventListener);
    // Cleanup handled automatically by useResourceCleanup
  }, [saveCurrentFile, selectFolder]);

  // === RETURN STATE AND OPERATIONS ===
  
  return {
    state,
    selectFolder,
    loadFolder,
    loadFile,
    saveCurrentFile,
    handleFileOperation,
    updateContent,
    setSearchQuery,
    setEditorMode: setEditorModeLocal,
    refreshFiles,
  };
};

export default useFileManager;