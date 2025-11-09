/**
 * @fileoverview Application header component with save status and controls
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Extracted header component for better organization
 */

import React from 'react';
import {
    Save,
    Settings,
    Target,
    Sun,
    Moon,
    Calendar,
    LayoutDashboard,
    Keyboard,
    UploadCloud,
    DownloadCloud,
    ShieldCheck,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Theme, GitSyncStatus } from '@/types';
import { formatRelativeTimeShort } from '@/utils/time';

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
    /** Whether the current folder is a GTD space */
    isGTDSpace: boolean;
    /** Callback to save the active file */
    onSaveActiveFile: () => Promise<void>;
    /** Callback to save all files */
    onSaveAllFiles: () => Promise<void>;
    /** Callback to open settings */
    onOpenSettings: () => void;
    /** Callback to toggle theme */
    onToggleTheme: () => Promise<void>;
    /** Callback to open calendar view (optional) */
    onOpenCalendar?: () => void;
    /** Callback to open GTD dashboard (optional) */
    onOpenDashboard?: () => void;
    /** Callback to open keyboard shortcuts (optional) */
    onOpenKeyboardShortcuts?: () => void;
    /** Whether git sync/backups are enabled */
    gitSyncEnabled?: boolean;
    /** Current git sync status payload */
    gitSyncStatus?: GitSyncStatus;
    /** Whether a git operation is currently running */
    gitSyncBusy?: boolean;
    /** Which git operation is in-flight */
    gitSyncOperation?: 'push' | 'pull' | null;
    /** Trigger a manual git push backup */
    onGitPush?: () => Promise<void> | void;
    /** Trigger a manual git pull restore */
    onGitPull?: () => Promise<void> | void;
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
    isGTDSpace,
    onSaveActiveFile,
    onSaveAllFiles,
    onOpenSettings,
    onToggleTheme,
    onOpenCalendar,
    onOpenDashboard,
    onOpenKeyboardShortcuts,
    gitSyncEnabled,
    gitSyncStatus,
    gitSyncBusy,
    gitSyncOperation,
    onGitPush,
    onGitPull,
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

    const syncConfigured = Boolean(
        gitSyncEnabled &&
        gitSyncStatus?.configured &&
        gitSyncStatus?.encryptionConfigured,
    );
    const syncDisabledReason = (() => {
        if (!gitSyncEnabled) return 'Git sync disabled';
        if (!gitSyncStatus?.configured) {
            return gitSyncStatus?.message ?? 'Git sync not configured';
        }
        if (!gitSyncStatus.encryptionConfigured) {
            return 'Encryption key missing';
        }
        return null;
    })();

    const lastPushRelative = formatRelativeTimeShort(gitSyncStatus?.lastPush);
    const lastPullRelative = formatRelativeTimeShort(gitSyncStatus?.lastPull);
    const latestBackupRelative = formatRelativeTimeShort(gitSyncStatus?.latestBackupAt);
    const pushDisabled = !syncConfigured || gitSyncBusy || !onGitPush;
    const pullDisabled = !syncConfigured || gitSyncBusy || !onGitPull;

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
                {isGTDSpace && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        GTD Space
                    </span>
                )}
            </div>

            {gitSyncEnabled && (
                <div className="flex items-center space-x-1 border-r border-border pr-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onGitPush}
                                    disabled={pushDisabled}
                                    className="h-8 w-8 p-0"
                                    aria-label="Push encrypted backup"
                                >
                                    {gitSyncOperation === 'push' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <UploadCloud className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>
                                    {syncConfigured
                                        ? gitSyncStatus?.hasRemote
                                            ? 'Push encrypted backup to remote'
                                            : 'Create local encrypted backup'
                                        : syncDisabledReason || 'Configure git sync in Settings'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Last push: {lastPushRelative}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onGitPull}
                                    disabled={pullDisabled}
                                    className="h-8 w-8 p-0"
                                    aria-label="Pull encrypted backup"
                                >
                                    {gitSyncOperation === 'pull' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <DownloadCloud className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>
                                    {syncConfigured
                                        ? 'Pull and decrypt latest backup'
                                        : syncDisabledReason || 'Configure git sync in Settings'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Last pull: {lastPullRelative}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 border border-border/60 rounded-md select-none">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span>
                                        {syncConfigured
                                            ? `Latest: ${latestBackupRelative}`
                                            : syncDisabledReason || 'Not ready'}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>
                                    Latest file:{' '}
                                    {gitSyncStatus?.latestBackupFile || 'None yet'}
                                </p>
                                {gitSyncStatus?.message && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {gitSyncStatus.message}
                                    </p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}

            <div className="flex items-center space-x-2">
                {/* Save Status */}
                <span className="text-xs text-muted-foreground mr-2">
                    {getSaveStatus()}
                </span>

                <div className="flex items-center space-x-1 border-r border-border pr-2">
                    {/* Save Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onSaveActiveFile}
                                    disabled={!hasCurrentFileUnsavedChanges}
                                    className="h-8 w-8 p-0"
                                >
                                    <Save className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Save File (⌘S)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Save All Button */}
                    {hasAnyUnsavedChanges && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onSaveAllFiles}
                                        className="text-xs px-2"
                                    >
                                        Save All
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Save All Files (⌘⇧S)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                {/* GTD Actions Group */}
                {isGTDSpace && (
                    <div className="flex items-center space-x-1 border-r border-border pr-2">
                        {/* Dashboard Button */}
                        {onOpenDashboard && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onOpenDashboard}
                                            className="h-8 w-8 p-0"
                                        >
                                            <LayoutDashboard className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>GTD Dashboard</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Calendar Button */}
                        {onOpenCalendar && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onOpenCalendar}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Calendar View</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                )}

                <div className="flex items-center space-x-1">
                    {/* Keyboard Shortcuts Button */}
                    {onOpenKeyboardShortcuts && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onOpenKeyboardShortcuts}
                                        className="h-8 w-8 p-0"
                                    >
                                        <Keyboard className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Keyboard Shortcuts (⌘K)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Settings Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onOpenSettings}
                                    className="h-8 w-8 p-0"
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Settings (⌘,)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Theme Toggle */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onToggleTheme}
                                    className="h-8 w-8 p-0"
                                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                                >
                                    {theme === 'dark' ? (
                                        <Sun className="h-4 w-4" />
                                    ) : (
                                        <Moon className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Toggle Theme ({theme === 'dark' ? 'Light' : 'Dark'} Mode)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </header>
    );
}; 
