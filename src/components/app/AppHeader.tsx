/**
 * @fileoverview Application header component with save status and controls
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Extracted header component for better organization
 */

import React from 'react';
import { Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Theme } from '@/types';

/**
 * Props for the AppHeader component
 */
export interface AppHeaderProps {
    /** Current file name being edited */
    fileName: string;
    /** Whether the current file has unsaved changes */
    hasCurrentFileUnsavedChanges: boolean;
    /** Whether any files have unsaved changes */
    hasAnyUnsavedChanges: boolean;
    /** Number of open tabs */
    tabCount: number;
    /** Current theme */
    theme: Theme;
    /** Callback to save the active file */
    onSaveActiveFile: () => Promise<void>;
    /** Callback to save all files */
    onSaveAllFiles: () => Promise<void>;
    /** Callback to open settings */
    onOpenSettings: () => void;
    /** Callback to toggle theme */
    onToggleTheme: () => Promise<void>;
}

/**
 * Application header component
 * 
 * Displays the current file name, save status, and provides quick access
 * to save operations, settings, and theme toggle functionality.
 * 
 * @param props - Component props
 * @returns Header JSX element
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
    fileName,
    hasCurrentFileUnsavedChanges,
    hasAnyUnsavedChanges,
    tabCount,
    theme,
    onSaveActiveFile,
    onSaveAllFiles,
    onOpenSettings,
    onToggleTheme,
}) => {
    /**
     * Get save status text
     */
    const getSaveStatus = () => {
        if (hasCurrentFileUnsavedChanges) {
            return 'Unsaved changes';
        }

        if (hasAnyUnsavedChanges) {
            // Count would need to be passed in if we want exact count
            return 'Some files unsaved';
        }

        return 'All saved';
    };

    /**
     * Get current file display name
     */
    const getCurrentFileName = () => {
        if (!fileName) return 'GTD Space';
        return fileName.replace(/\.(md|markdown)$/i, '');
    };

    return (
        <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center space-x-4">
                <h1 className="text-lg font-semibold">
                    {getCurrentFileName()}
                </h1>
                {hasCurrentFileUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-destructive" title="Unsaved changes" />
                )}
                {tabCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                        ({tabCount} file{tabCount !== 1 ? 's' : ''})
                    </span>
                )}
            </div>

            <div className="flex items-center space-x-2">
                {/* Save Status */}
                <span className="text-xs text-muted-foreground">
                    {getSaveStatus()}
                </span>

                {/* Save Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSaveActiveFile}
                    disabled={!hasCurrentFileUnsavedChanges}
                    title="Save file (Ctrl+S)"
                >
                    <Save className="h-4 w-4" />
                </Button>

                {/* Save All Button */}
                {hasAnyUnsavedChanges && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveAllFiles}
                        title="Save all files (Ctrl+Shift+S)"
                        className="text-xs"
                    >
                        Save All
                    </Button>
                )}

                {/* Settings Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenSettings}
                    title="Open settings"
                >
                    <Settings className="h-4 w-4" />
                </Button>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </Button>
            </div>
        </header>
    );
}; 