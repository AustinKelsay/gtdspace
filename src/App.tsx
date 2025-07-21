/**
 * @fileoverview Main App component for GTD Space markdown editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Complete MVP with file management and editing functionality
 */

import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Save, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileBrowserSidebar } from '@/components/file-browser/FileBrowserSidebar';
import { TextEditor } from '@/components/editor/TextEditor';
import { useFileManager } from '@/hooks/useFileManager';
import type { PermissionStatus, Theme } from '@/types';
import './styles/globals.css';

/**
 * Main application component for Phase 1 MVP
 * 
 * Integrates file management, editing, and all Phase 1 functionality.
 * Provides a complete markdown editing experience with file browser,
 * text editor, and file operations.
 * 
 * Phase 1 Features:
 * - Folder selection and file listing
 * - File operations (create, rename, delete)
 * - Basic text editor with preview
 * - Auto-save functionality
 * - File search and filtering
 * - Theme management
 * 
 * @returns Complete Phase 1 application
 */
export const App: React.FC = () => {
  // === FILE MANAGEMENT ===
  
  const {
    state,
    selectFolder,
    loadFolder,
    loadFile,
    saveCurrentFile,
    handleFileOperation,
    updateContent,
    setSearchQuery,
  } = useFileManager();

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
    // For now, just toggle between light and dark
    // In Phase 2, we'll add proper theme management
    const newTheme: Theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  };

  // === INITIALIZATION ===
  
  useEffect(() => {
    // Apply initial theme
    applyTheme(state.theme);
    
    // Test backend connectivity on startup
    const testBackend = async () => {
      try {
        console.log('Testing backend connectivity...');
        const pingResponse = await invoke<string>('ping');
        console.log('Backend connected:', pingResponse);
        
        const permissions = await invoke<PermissionStatus>('check_permissions');
        console.log('Permissions:', permissions);
      } catch (error) {
        console.error('Backend connection failed:', error);
      }
    };
    
    testBackend();
  }, [state.theme]);

  // === RENDER HELPERS ===
  
  /**
   * Get save status indicator
   */
  const getSaveStatus = () => {
    switch (state.autoSaveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return state.hasUnsavedChanges ? 'Unsaved changes' : '';
    }
  };

  /**
   * Get current file display name
   */
  const getCurrentFileName = () => {
    if (!state.currentFile) return 'GTD Space';
    return state.currentFile.name.replace(/\.(md|markdown)$/i, '');
  };

  // === MAIN APPLICATION LAYOUT ===
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header Bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">
            {getCurrentFileName()}
          </h1>
          {state.hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-orange-500" title="Unsaved changes" />
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Save Status */}
          <span className="text-xs text-muted-foreground">
            {getSaveStatus()}
          </span>
          
          {/* Manual Save Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={saveCurrentFile}
            disabled={!state.hasUnsavedChanges}
            title="Save file (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
          </Button>
          
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            title={`Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {state.theme === 'dark' ? '☀️' : '🌙'}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* File Browser Sidebar */}
        <div className="w-80 border-r border-border">
          <FileBrowserSidebar
            state={state}
            onFolderSelect={loadFolder}
            onFileSelect={loadFile}
            onFileOperation={handleFileOperation}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Editor Area */}
        <div className="flex-1 min-w-0">
          {state.currentFile ? (
            <TextEditor
              content={state.fileContent}
              onChange={updateContent}
              mode={state.editorMode}
              showLineNumbers={false}
              readOnly={false}
              autoFocus={true}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-lg flex items-center justify-center">
                  <Menu className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-3">
                  Welcome to GTD Space
                </h2>
                <p className="text-muted-foreground mb-6">
                  Select a folder from the sidebar to get started with your markdown files.
                </p>
                {!state.currentFolder && (
                  <Button onClick={selectFolder}>
                    Select Folder
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {state.currentFile && (
        <footer className="h-8 border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground bg-card">
          <div className="flex items-center space-x-4">
            <span>
              {state.files.length} file{state.files.length !== 1 ? 's' : ''}
            </span>
            <span>
              {state.fileContent.length} characters
            </span>
            <span>
              {state.fileContent.split('\n').length} lines
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span>
              Mode: {state.editorMode}
            </span>
            {state.currentFile && (
              <span>
                {state.currentFile.path}
              </span>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;