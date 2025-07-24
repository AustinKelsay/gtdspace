/**
 * @fileoverview Application header component with save status and controls
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Extracted header component for better organization
 */

import React from 'react';
import { Save, Settings, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartTooltip } from '@/components/help/TooltipManager';
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
    /** Callback to open analytics */
    onOpenAnalytics: () => void;
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
    onOpenAnalytics,
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
                <SmartTooltip
                    id="save-active-file"
                    title="Save File"
                    content="Save the current file. Your changes are also auto-saved every few seconds."
                    type="shortcut"
                    shortcut="Ctrl+S"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveActiveFile}
                        disabled={!hasCurrentFileUnsavedChanges}
                    >
                        <Save className="h-4 w-4" />
                    </Button>
                </SmartTooltip>

                {/* Save All Button */}
                {hasAnyUnsavedChanges && (
                    <SmartTooltip
                        id="save-all-files"
                        title="Save All Files"
                        content="Save all open files with unsaved changes at once."
                        type="shortcut"
                        shortcut="Ctrl+Shift+S"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSaveAllFiles}
                            className="text-xs"
                        >
                            Save All
                        </Button>
                    </SmartTooltip>
                )}

                {/* Analytics Button */}
                <SmartTooltip
                    id="open-analytics"
                    title="Analytics"
                    content="View detailed insights about your writing habits, document metrics, and productivity."
                    type="feature"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenAnalytics}
                    >
                        <BarChart3 className="h-4 w-4" />
                    </Button>
                </SmartTooltip>

                {/* Settings Button */}
                <SmartTooltip
                    id="open-settings"
                    title="Settings"
                    content="Configure application preferences, keyboard shortcuts, and editor options."
                    type="feature"
                    shortcut="Ctrl+,"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenSettings}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </SmartTooltip>

                {/* Theme Toggle */}
                <SmartTooltip
                    id="toggle-theme"
                    title="Toggle Theme"
                    content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme for better visibility and comfort.`}
                    type="feature"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleTheme}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </Button>
                </SmartTooltip>
            </div>
        </header>
    );
}; 