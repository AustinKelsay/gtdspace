/**
 * @fileoverview File management hook for Phase 1 functionality
 * @author Development Team
 * @created 2024-01-XX
 */

import { useState, useCallback, useEffect } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { useSettings } from '@/hooks/useSettings';
// Performance monitoring and caching removed during simplification
import { serializeMultiselectsToMarkers, deserializeMarkersToMultiselects } from '@/utils/multiselect-block-helpers';
import type { 
  MarkdownFile, 
  FileOperationResult, 
  FileOperation, 
  FileManagerState,
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
  
  // === SETTINGS INTEGRATION ===
  
  const { settings, setLastFolder, setEditorMode } = useSettings();
  
  // === STATE ===
  
  const [state, setState] = useState<FileManagerState>({
    // Base app state
    theme: settings.theme as 'light' | 'dark' | 'auto',
    isReady: true,
    isLoading: false,
    error: null,
    
    // Phase 1 file management state
    currentFolder: null, // Don't auto-load last folder for GTD-first experience
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
  const loadFolder = useCallback(async (folderPath: string, options?: { saveToSettings?: boolean }) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('Loading folder:', folderPath);

      const normalizedPath = folderPath.trim();
      let directoryExists = await safeInvoke<boolean>('check_directory_exists', { path: normalizedPath }, null);

      if (directoryExists === false) {
        console.log('Folder missing, attempting to initialize GTD space at:', normalizedPath);
        await safeInvoke<string>('initialize_gtd_space', { spacePath: normalizedPath }, null);
        directoryExists = await safeInvoke<boolean>('check_directory_exists', { path: normalizedPath }, null);
      }

      if (directoryExists === false) {
        throw new Error(`Directory does not exist: ${normalizedPath}`);
      }
      
      // Load files from selected folder
      const files = await safeInvoke<MarkdownFile[]>('list_markdown_files', { 
        path: normalizedPath 
      }, []);
      console.log(`Loaded ${files.length} markdown files`);
      
      setState(prev => ({
        ...prev,
        currentFolder: normalizedPath,
        files,
        isLoading: false,
        currentFile: null,
        fileContent: '',
        hasUnsavedChanges: false,
      }));
      
      // Store the current folder path for references component
      localStorage.setItem('gtdspace-current-path', normalizedPath);
      
      // Only save to settings if explicitly requested (default is true for backward compatibility)
      if (options?.saveToSettings !== false) {
        await setLastFolder(normalizedPath);
      }
      
    } catch (error) {
      console.log('Failed to load folder:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load folder',
      }));
    }
  }, [setLastFolder]);
  
  /**
   * Select a folder and load its markdown files
   */
  const selectFolder = useCallback(async () => {
    try {
      console.log('Opening folder selection dialog...');
      const folderPath = await safeInvoke<string>('select_folder', undefined, null);
      if (!folderPath) {
        throw new Error('No folder selected');
      }
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
      
      const files = await safeInvoke<MarkdownFile[]>('list_markdown_files', { 
        path: state.currentFolder 
      }, []);
      
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
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('Loading file:', file.path);
      
      // Load from file system
      const rawContent = await safeInvoke<string>('read_file', { path: file.path }, '');
      
      // Convert multiselect markers back to HTML format for the editor
      let content: string;
      try {
        content = deserializeMarkersToMultiselects(rawContent);
      } catch (error) {
        console.warn('Failed to deserialize multiselect markers:', error);
        // Fall back to using raw content if deserialization fails
        content = typeof rawContent === 'string' ? rawContent : String(rawContent);
      }
      
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
    
    
    try {
      setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));
      
      console.log('Saving file:', state.currentFile.path);

      // Serialize multiselects from HTML to marker format before saving
      const contentToSave = serializeMultiselectsToMarkers(state.fileContent);

      const result = await safeInvoke<string>('save_file', {
        path: state.currentFile.path,
        content: contentToSave,
      }, null);
      if (result === null) {
        throw new Error('Failed to save file');
      }
      
      
      setState(prev => ({
        ...prev,
        hasUnsavedChanges: false,
        autoSaveStatus: 'saved',
      }));
      
      console.log('File saved successfully');
      
      // Reset save status after 2 seconds
      setTimeout(() => {
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
          result = await safeInvoke<FileOperationResult>('create_file', {
            directory: state.currentFolder,
            name: operation.name,
          }, { success: false, message: 'Failed to create file' });
          break;
          
        case 'rename':
          console.log('Renaming file:', operation.oldPath, 'to', operation.newName);
          result = await safeInvoke<FileOperationResult>('rename_file', {
            old_path: operation.oldPath,
            new_name: operation.newName,
          }, { success: false, message: 'Failed to rename file' });
          break;
          
        case 'delete':
          console.log('Deleting file:', operation.path);
          result = await safeInvoke<FileOperationResult>('delete_file', {
            path: operation.path,
          }, { success: false, message: 'Failed to delete file' });
          break;
          
        case 'copy': {
          console.log('Copying file from:', operation.sourcePath, 'to:', operation.destPath);
          const copyResult = await safeInvoke<string>('copy_file', {
            source_path: operation.sourcePath,
            dest_path: operation.destPath,
          }, null);
          if (!copyResult) {
            throw new Error('Failed to copy file');
          }
          result = { success: true, message: copyResult };
          break;
        }
          
        case 'move': {
          console.log('Moving file from:', operation.sourcePath, 'to:', operation.destPath);
          const moveResult = await safeInvoke<string>('move_file', {
            source_path: operation.sourcePath,
            dest_path: operation.destPath,
          }, null);
          if (!moveResult) {
            throw new Error('Failed to move file');
          }
          result = { success: true, message: moveResult };
          break;
        }
          
        default:
          throw new Error('Unknown file operation');
      }
      
      if (result.success) {
        console.log('File operation successful:', result.message);
        // Refresh file list after successful operation
        await refreshFiles();
        
        // If we deleted the current file, clear the editor and cache
        if (operation.type === 'delete' && state.currentFile?.path === operation.path) {
          setState(prev => ({
            ...prev,
            currentFile: null,
            fileContent: '',
            hasUnsavedChanges: false,
          }));
        }
        
        // Handle rename operation cache invalidation
        if (operation.type === 'rename' && operation.oldPath) {
          // Cache invalidation would go here if implemented
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
    
    const timeoutId = setTimeout(() => {
      saveCurrentFile();
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [state.fileContent, state.hasUnsavedChanges, saveCurrentFile]);

  // === INITIALIZATION ===
  
  /**
   * Load last folder on startup if available
   * Disabled for GTD-first experience - users should manually select folder
   */
  // useEffect(() => {
  //   if (settings.last_folder && !state.currentFolder) {
  //     // Auto-load the last folder
  //     (async () => {
  //       try {
  //         const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
  //           path: settings.last_folder 
  //         });
  //         setState(prev => ({
  //           ...prev,
  //           currentFolder: settings.last_folder || null,
  //           files,
  //         }));
  //       } catch (error) {
  //         console.log('Failed to load last folder:', error);
  //       }
  //     })();
  //   }
  // }, [settings.last_folder, state.currentFolder]);

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

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveCurrentFile, selectFolder]);

  // === UTILITY FUNCTIONS ===
  
  /**
   * Read file text content directly (for external components)
   * Encapsulates the Tauri invoke call with proper error handling
   */
  const readFileText = useCallback(async (path: string): Promise<string> => {
    // Note: Hook version assumes we're already in Tauri context
    // since the entire useFileManager hook requires Tauri
    try {
      const content = await safeInvoke<string>('read_file', { path }, null);
      if (!content) {
        throw new Error('Failed to read file');
      }
      return content;
    } catch (error) {
      console.error('Failed to read file:', path, error);
      throw new Error(`Failed to read file: ${error}`);
    }
  }, []);

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
    readFileText,
  };
};

// Export the readFileText helper for external use
// This standalone export is intentionally kept for components that need file reading
// without instantiating the entire file manager state
export const readFileText = async (path: string): Promise<string> => {
  // Check if we're in Tauri context first
  const { checkTauriContextAsync } = await import('@/utils/tauri-ready');
  const inTauriContext = await checkTauriContextAsync();

  if (!inTauriContext) {
    console.error('[readFileText] Not in Tauri context');
    throw new Error('readFileText is only available in the Tauri runtime');
  }

  try {
    const content = await safeInvoke<string>('read_file', { path }, null);

    if (content === null || content === undefined) {
      console.error('[readFileText] File read returned null/undefined for path:', path);
      // Return empty string instead of throwing for non-existent files
      // This allows the caller to handle missing files gracefully
      return '';
    }

    return content;
  } catch (error) {
    console.error('[readFileText] Failed to read file:', path, error);
    throw new Error(`Failed to read file at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export default useFileManager;
