/**
 * @fileoverview GTD-aware workspace sidebar component
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import { flushSync } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { onMetadataChange, onContentSaved, onContentChange } from '@/utils/content-event-bus';
import {
  Briefcase,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDot,
  FolderOpen,
  ChevronRight,
  Target,
  Archive,
  Lightbulb,
  FileText,
  Search,
  RefreshCw,
  Folder,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectDialog, GTDActionDialog, CreatePageDialog, CreateHabitDialog } from '@/components/gtd';
import { FileSearch } from '@/components/file-browser/FileSearch';
import type { GTDProject, MarkdownFile, GTDSpace } from '@/types';

interface GTDWorkspaceSidebarProps {
  currentFolder: string | null;
  onFolderSelect: (folderPath: string) => void;
  onFileSelect: (file: MarkdownFile) => void;
  onRefresh: () => void;
  className?: string;
  gtdSpace?: GTDSpace | null;
  checkGTDSpace?: (path: string) => Promise<boolean>;
  loadProjects?: (path: string) => Promise<GTDProject[]>;
}

interface GTDSection {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description: string;
  color: string;
}

const GTD_SECTIONS: GTDSection[] = [
  {
    id: 'purpose',
    name: 'Purpose & Principles',
    icon: Target,
    path: 'Purpose & Principles',
    description: 'Core values and life mission (50,000 ft)',
    color: 'text-purple-600'
  },
  {
    id: 'vision',
    name: 'Vision',
    icon: Target,
    path: 'Vision',
    description: '3-5 year aspirations (40,000 ft)',
    color: 'text-indigo-600'
  },
  {
    id: 'goals',
    name: 'Goals',
    icon: Target,
    path: 'Goals',
    description: '1-2 year objectives (30,000 ft)',
    color: 'text-violet-600'
  },
  {
    id: 'areas',
    name: 'Areas of Focus',
    icon: Target,
    path: 'Areas of Focus',
    description: 'Ongoing responsibilities (20,000 ft)',
    color: 'text-blue-700'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    path: '::calendar::', // Special virtual path
    description: 'View all dated items',
    color: 'text-orange-600'
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: Briefcase,
    path: 'Projects',
    description: 'Active projects and their actions',
    color: 'text-blue-600'
  },
  {
    id: 'habits',
    name: 'Habits',
    icon: RefreshCw,
    path: 'Habits',
    description: 'Daily and weekly routines',
    color: 'text-green-600'
  },
  {
    id: 'someday',
    name: 'Someday Maybe',
    icon: Lightbulb,
    path: 'Someday Maybe',
    description: 'Ideas for future consideration',
    color: 'text-purple-600'
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    icon: Archive,
    path: 'Cabinet',
    description: 'Reference materials',
    color: 'text-gray-600'
  }
];

export const GTDWorkspaceSidebar: React.FC<GTDWorkspaceSidebarProps> = ({
  currentFolder,
  onFolderSelect,
  onFileSelect,
  onRefresh,
  className = '',
  gtdSpace: propGtdSpace,
  checkGTDSpace: propCheckGTDSpace,
  loadProjects: propLoadProjects
}) => {
  const {
    gtdSpace: hookGtdSpace,
    isLoading,
    checkGTDSpace: hookCheckGTDSpace,
    loadProjects: hookLoadProjects,
  } = useGTDSpace();

  // Use props if provided, otherwise fall back to hook
  const gtdSpace = propGtdSpace ?? hookGtdSpace;
  const checkGTDSpace = propCheckGTDSpace ?? hookCheckGTDSpace;
  const loadProjects = propLoadProjects ?? hookLoadProjects;

  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['areas', 'projects', 'habits']);
  const [expandedProjects, setExpandedProjects] = React.useState<string[]>([]);
  const [projectActions, setProjectActions] = React.useState<{ [projectPath: string]: MarkdownFile[] }>({});
  const [actionStatuses, setActionStatuses] = React.useState<{ [actionPath: string]: string }>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [showPageDialog, setShowPageDialog] = React.useState(false);
  const [pageDialogDirectory, setPageDialogDirectory] = React.useState<{ path: string; name: string } | null>(null);
  const [showHabitDialog, setShowHabitDialog] = React.useState(false);
  const [sectionFiles, setSectionFiles] = React.useState<{ [sectionPath: string]: MarkdownFile[] }>({});
  const [sectionRefreshKey, setSectionRefreshKey] = React.useState(0);
  // Track preloading and in-flight loads to avoid janky duplicate fetches
  const lastRootRef = React.useRef<string | null>(null);
  const preloadedRef = React.useRef<boolean>(false);
  const loadingSectionsRef = React.useRef<Set<string>>(new Set());
  // Track which sections have been loaded at least once
  const [loadedSections, setLoadedSections] = React.useState<Set<string>>(new Set());

  // Delete dialog state
  const [deleteItem, setDeleteItem] = React.useState<{ type: 'project' | 'action' | 'file'; path: string; name: string } | null>(null);

  // Local state for project metadata that can be updated dynamically
  const [projectMetadata, setProjectMetadata] = React.useState<{ [projectPath: string]: { status?: string; title?: string; currentPath?: string; due_date?: string } }>({});

  // Local state for action metadata that can be updated dynamically
  const [actionMetadata, setActionMetadata] = React.useState<{ [actionPath: string]: { status?: string; title?: string; currentPath?: string; due_date?: string } }>({});

  // Local state for section file metadata that can be updated dynamically
  const [sectionFileMetadata, setSectionFileMetadata] = React.useState<{ [filePath: string]: { title?: string; currentPath?: string } }>({});
  // Optimistic list of projects added before backend reload confirms them
  const [pendingProjects, setPendingProjects] = React.useState<GTDProject[]>([]);

  const loadSectionFiles = React.useCallback(async (sectionPath: string, force: boolean = false) => {
    try {
      // Skip if already loaded and not forcing
      if (!force && sectionFiles[sectionPath] && sectionFiles[sectionPath].length >= 0) {
        return sectionFiles[sectionPath];
      }
      // Prevent duplicate concurrent loads
      if (loadingSectionsRef.current.has(sectionPath)) {
        return sectionFiles[sectionPath] || [];
      }
      loadingSectionsRef.current.add(sectionPath);
      const files = await invoke<MarkdownFile[]>('list_markdown_files', {
        path: sectionPath
      });

      // Sort files alphabetically by default
      const sortedFiles = files.sort((a, b) => {
        const aName = a.name.replace('.md', '');
        const bName = b.name.replace('.md', '');
        return aName.localeCompare(bName);
      });

      setSectionFiles(prev => ({
        ...prev,
        [sectionPath]: sortedFiles
      }));
      // Mark this section as loaded
      setLoadedSections(prev => new Set(prev).add(sectionPath));
      // Force a re-render by updating the refresh key (kept lightweight)
      setSectionRefreshKey(prev => prev + 1);

      return sortedFiles;
    } catch (error) {
      return [];
    } finally {
      loadingSectionsRef.current.delete(sectionPath);
    }
  }, [sectionFiles]);

  // Parse YYYY-MM-DD as a local date to avoid timezone off-by-one issues
  function parseLocalDateString(dateStr: string): Date | null {
    const trimmed = dateStr?.trim();
    if (!trimmed) return null;
    if (/\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const dt = new Date(trimmed);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      const dt = new Date(year, month, day);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(trimmed);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const loadProjectActions = React.useCallback(async (projectPath: string) => {
    try {
      // Use dedicated backend command to list actions only
      let files: MarkdownFile[] = [];
      try {
        files = await invoke<MarkdownFile[]>('list_project_actions', { projectPath });
      } catch (e) {
        const all = await invoke<MarkdownFile[]>('list_markdown_files', { path: projectPath });
        files = all.filter(f => f.name !== 'README.md');
      }

      const actions = files;

      setProjectActions(prev => ({
        ...prev,
        [projectPath]: actions
      }));

      // Load status and due date for all actions in parallel
      const statusPromises = actions.map(async (action) => {
        try {
          const content = await invoke<string>('read_file', { path: action.path });
          // Extract status from the markdown content
          // Look for [!singleselect:status:xxx] pattern
          const match = content.match(/\[!singleselect:status:(in-progress|waiting|completed?|done)\]/i);
          const raw = (match?.[1] ?? 'in-progress').trim().toLowerCase();
          // Normalize to the canonical set used by the UI
          const normalized = (raw === 'completed' || raw === 'done') ? 'complete' : raw;

          // Extract due date from the markdown content
          // Look for [!datetime:due_date:xxx] pattern
          const dueDateMatch = content.match(/\[!datetime:due_date:([^\]]*)\]/i);
          const dueDate = dueDateMatch?.[1]?.trim() || '';

          return {
            path: action.path,
            status: normalized,
            due_date: dueDate
          };
        } catch (error) {
          return {
            path: action.path,
            status: 'in-progress'
          };
        }
      });

      const statusResults = await Promise.all(statusPromises);
      const statuses: { [path: string]: string } =
        Object.fromEntries(statusResults.map(r => [r.path, r.status]));

      setActionStatuses(prev => ({
        ...prev,
        ...statuses
      }));

      // Update action metadata with due dates
      statusResults.forEach(({ path, due_date }) => {
        if (due_date) {
          setActionMetadata(prev => ({
            ...prev,
            [path]: {
              ...prev[path],
              due_date
            }
          }));
        }
      });
    } catch (error) {
      // Silently handle action status loading errors
    }
  }, []);

  // Check if current folder is a GTD space and preload section files
  React.useEffect(() => {
    const checkSpace = async () => {
      // Only use gtdSpace.root_path when available to prevent loading from wrong workspace
      const pathToCheck = gtdSpace?.root_path;
      
      // Skip if no valid GTD space path or if currentFolder doesn't match
      if (!pathToCheck || !currentFolder?.startsWith(pathToCheck)) {
        return;
      }

      // Avoid duplicate preloads for same root
      if (lastRootRef.current !== pathToCheck) {
        preloadedRef.current = false;
        lastRootRef.current = pathToCheck;
        // Reset loaded sections when workspace changes
        setLoadedSections(new Set());
      }

      const isGTD = await checkGTDSpace(pathToCheck);
      if (isGTD) {
        // Load projects only if not present yet or root changed
        if (!gtdSpace?.projects || gtdSpace.projects.length === 0) {
          await loadProjects(pathToCheck);
        }

        if (!preloadedRef.current) {
          preloadedRef.current = true;
          // Preload files for all non-project sections with staggered timing
          const habitsPath = `${pathToCheck}/Habits`;
          const areasPath = `${pathToCheck}/Areas of Focus`;
          const goalsPath = `${pathToCheck}/Goals`;
          const somedayPath = `${pathToCheck}/Someday Maybe`;
          const cabinetPath = `${pathToCheck}/Cabinet`;
          const visionPath = `${pathToCheck}/Vision`;
          const purposePath = `${pathToCheck}/Purpose & Principles`;

          // Load high-priority sections first
          await Promise.allSettled([
            loadSectionFiles(habitsPath),
            loadSectionFiles(areasPath),
            loadSectionFiles(goalsPath)
          ]);
          
          // Load remaining sections after a small delay to reduce UI jank (no dangling timer)
          await new Promise((r) => setTimeout(r, 150));
          await Promise.allSettled([
            loadSectionFiles(somedayPath),
            loadSectionFiles(cabinetPath),
            loadSectionFiles(visionPath),
            loadSectionFiles(purposePath)
          ]);
        }
      }
    };
    checkSpace();
  }, [currentFolder, gtdSpace?.root_path, gtdSpace?.projects, checkGTDSpace, loadProjects, loadSectionFiles]);

  // Listen for content changes to update sidebar dynamically
  React.useEffect(() => {
    // Subscribe to metadata changes for live UI updates
    const unsubscribeMetadata = onMetadataChange((event) => {
      const { filePath, metadata, changedFields } = event;

      // Check if this is a project README
      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));

        // Update project status if it changed
        if (changedFields?.status || changedFields?.projectStatus) {
          const newStatus = metadata.projectStatus || metadata.status;
          if (newStatus) {
            // Update local state immediately for instant UI update
            setProjectMetadata(prev => ({
              ...prev,
              [projectPath]: {
                ...prev[projectPath],
                status: newStatus
              }
            }));
          }
        }

        // Update project due date if it changed
        if (changedFields?.due_date || changedFields?.dueDate || changedFields?.datetime) {
          const meta = metadata as { due_date?: string; dueDate?: string };
          const newDue = meta.due_date || meta.dueDate;
          if (typeof newDue === 'string') {
            setProjectMetadata(prev => ({
              ...prev,
              [projectPath]: {
                ...prev[projectPath],
                due_date: newDue
              }
            }));
          }
        }

        // Don't update title on metadata change - wait for save to keep in sync with folder name
        // Title changes are handled in the content:saved event when folder is renamed
      }

      // Check if this is an action file
      if (filePath.includes('/Projects/') && !filePath.endsWith('/README.md') && filePath.endsWith('.md')) {
        // Update action status if it changed (status updates immediately)
        if (changedFields?.status) {
          const newStatus = metadata.status;
          if (newStatus) {
            // Update the action status in our local state
            setActionStatuses(prev => ({
              ...prev,
              [filePath]: newStatus
            }));

            // Also update action metadata
            setActionMetadata(prev => ({
              ...prev,
              [filePath]: {
                ...prev[filePath],
                status: newStatus
              }
            }));
          }
        }

        // Don't update title on metadata change - wait for save to keep in sync with file name
        // Title changes are handled in the content:saved event when file is renamed
      }

      // Check if this is a file in Someday Maybe, Cabinet, Habits, or horizon folders
      const sectionPaths = ['/Someday Maybe/', '/Cabinet/', '/Habits/', '/Areas of Focus/', '/Goals/', '/Vision/', '/Purpose & Principles/'];
      for (const sectionPath of sectionPaths) {
        if (filePath.includes(sectionPath)) {
          // Reload the section files to get updated titles
          const sectionFullPath = filePath.substring(0, filePath.lastIndexOf('/'));
          loadSectionFiles(sectionFullPath);
          break;
        }
      }
    });

    // Also respond to generic content changes (live typing) for immediate date updates
    const unsubscribeChanged = onContentChange((event) => {
      const { filePath, metadata, changedFields } = event;
      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (changedFields?.dueDate || changedFields?.due_date || changedFields?.datetime) {
          const meta = metadata as { due_date?: string; dueDate?: string };
          const newDue = meta.dueDate || meta.due_date;
          if (typeof newDue === 'string') {
            setProjectMetadata(prev => ({
              ...prev,
              [projectPath]: {
                ...prev[projectPath],
                due_date: newDue
              }
            }));
          }
        }
      }
    });

    // Subscribe to content saved events for folder renaming
    const unsubscribeSaved = onContentSaved(async (event) => {
      const { filePath, metadata } = event;

      // Check if this is a project README
      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const newTitle = metadata.title;

        if (newTitle) {
          // Get the current project name from the path
          const currentProjectName = projectPath.split('/').pop();

          // Only rename if the title actually differs from folder name
          if (currentProjectName && currentProjectName !== newTitle) {

            // Call rename synchronously to avoid issues with async event handlers
            invoke<string>('rename_gtd_project', {
              oldProjectPath: projectPath,
              newProjectName: newTitle
            })
              .then(async (newProjectPath) => {

                // Only update UI after successful rename
                // Update local state - keep both old and new paths until projects reload
                setProjectMetadata(prev => {
                  const updated = { ...prev };
                  // Update the title and current path at the OLD path (for UI display until reload)
                  updated[projectPath] = {
                    ...prev[projectPath],
                    title: newTitle,
                    currentPath: newProjectPath  // Track the new path for the folder button
                  };
                  // Also set at new path for after reload
                  updated[newProjectPath] = {
                    ...prev[projectPath],
                    title: newTitle,
                    currentPath: newProjectPath
                  };
                  return updated;
                });

                // Update expanded projects list if this project was expanded
                setExpandedProjects(prev => prev.map(path =>
                  path === projectPath ? newProjectPath : path
                ));

                // Update project actions if they were loaded
                if (projectActions[projectPath]) {
                  setProjectActions(prev => {
                    const updated = { ...prev };
                    // Move actions to new path
                    updated[newProjectPath] = prev[projectPath];
                    // Keep old path temporarily for UI until reload
                    return updated;
                  });
                }

                // Reload projects to update paths in the main state
                if (gtdSpace?.root_path) {
                  await loadProjects(gtdSpace.root_path);

                  // After reload, clean up old path metadata
                  setProjectMetadata(prev => {
                    const updated = { ...prev };
                    delete updated[projectPath];
                    return updated;
                  });

                  // Clean up old project actions
                  setProjectActions(prev => {
                    const updated = { ...prev };
                    delete updated[projectPath];
                    return updated;
                  });
                }

                // Update any open tabs with files from the renamed project
                window.dispatchEvent(new CustomEvent('project-renamed', {
                  detail: {
                    oldPath: projectPath,
                    newPath: newProjectPath,
                    newName: newTitle
                  }
                }));
              })
              .catch((_error) => {
                // Silently handle project rename errors
              });
          }
        }
        // Also update due date from saved metadata and refresh projects so sidebar reflects persisted values
        const meta = metadata as { due_date?: string; dueDate?: string };
        const newDue = meta.due_date || meta.dueDate;
        if (typeof newDue === 'string') {
          setProjectMetadata(prev => ({
            ...prev,
            [projectPath]: {
              ...prev[projectPath],
              due_date: newDue
            }
          }));
        }
        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      }

      // Check if this is an action file that was saved
      if (filePath.includes('/Projects/') && !filePath.endsWith('/README.md') && filePath.endsWith('.md')) {
        const newTitle = metadata.title;

        if (newTitle) {
          // Get the current action name from the file path
          const currentActionName = filePath.split('/').pop()?.replace('.md', '');

          // Only rename if the title actually differs from file name
          if (currentActionName && currentActionName !== newTitle) {

            // Call rename_gtd_action command
            invoke<string>('rename_gtd_action', {
              oldActionPath: filePath,
              newActionName: newTitle
            })
              .then(async (newActionPath) => {

                // Update local state with new path
                setActionMetadata(prev => {
                  const updated = { ...prev };
                  // Update the title and current path at the OLD path (for UI display until reload)
                  updated[filePath] = {
                    ...prev[filePath],
                    title: newTitle,
                    currentPath: newActionPath  // Track the new path
                  };
                  // Also set at new path for after reload
                  updated[newActionPath] = {
                    ...prev[filePath],
                    title: newTitle,
                    currentPath: newActionPath
                  };
                  return updated;
                });

                // Reload actions for the project
                const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
                await loadProjectActions(projectPath);

                // Clean up old path metadata after reload
                setActionMetadata(prev => {
                  const updated = { ...prev };
                  delete updated[filePath];
                  return updated;
                });

                // Update any open tabs with the renamed action
                window.dispatchEvent(new CustomEvent('action-renamed', {
                  detail: {
                    oldPath: filePath,
                    newPath: newActionPath,
                    newName: newTitle
                  }
                }));
              })
              .catch((_error) => {
                // Silently handle action rename errors
              });
          }
        }
      }

      // Check if this is a file in Someday Maybe, Cabinet, Habits, or horizon folders that was saved
      const sectionPaths = ['/Someday Maybe/', '/Cabinet/', '/Habits/', '/Areas of Focus/', '/Goals/', '/Vision/', '/Purpose & Principles/'];
      for (const sectionPath of sectionPaths) {
        if (filePath.includes(sectionPath) && filePath.endsWith('.md')) {
          const newTitle = metadata.title;

          if (newTitle) {
            // Get the current file name from the file path
            const currentFileName = filePath.split('/').pop()?.replace('.md', '');

            // Only rename if the title actually differs from file name
            if (currentFileName && currentFileName !== newTitle) {

              // Call rename_gtd_action command (works for any markdown file)
              invoke<string>('rename_gtd_action', {
                oldActionPath: filePath,
                newActionName: newTitle
              })
                .then(async (newFilePath) => {

                  // Update local state with new path
                  setSectionFileMetadata(prev => {
                    const updated = { ...prev };
                    // Update the title and current path at the OLD path (for UI display until reload)
                    updated[filePath] = {
                      ...prev[filePath],
                      title: newTitle,
                      currentPath: newFilePath  // Track the new path
                    };
                    // Also set at new path for after reload
                    updated[newFilePath] = {
                      ...prev[filePath],
                      title: newTitle,
                      currentPath: newFilePath
                    };
                    return updated;
                  });

                  // Reload section files
                  const sectionFullPath = filePath.substring(0, filePath.lastIndexOf('/'));
                  await loadSectionFiles(sectionFullPath);

                  // Clean up old path metadata after reload
                  setSectionFileMetadata(prev => {
                    const updated = { ...prev };
                    delete updated[filePath];
                    return updated;
                  });

                  // Update any open tabs with the renamed file
                  window.dispatchEvent(new CustomEvent('section-file-renamed', {
                    detail: {
                      oldPath: filePath,
                      newPath: newFilePath,
                      newName: newTitle
                    }
                  }));
                })
                .catch((_error) => {
                  // Silently handle file rename errors
                });
            }
          }
          break;
        }
      }
    });

    // Listen for GTD project/action creation events
    const handleProjectCreated = async (event: CustomEvent) => {
      // Project created event received
      const { projectPath, projectName } = event.detail as { projectPath?: string; projectName?: string };

      // Optimistically show the new project immediately
      if (projectPath && projectName) {
        const optimistic: GTDProject = {
          name: projectName,
          description: '',
          due_date: undefined,
          status: ['in-progress'],
          path: projectPath,
          created_date: new Date().toISOString().split('T')[0],
          action_count: 0,
        };
        setPendingProjects(prev => (prev.some(p => p.path === optimistic.path) ? prev : [...prev, optimistic]));
      }

      if (gtdSpace?.root_path) {
        // Reload projects from event
        const projects = await loadProjects(gtdSpace.root_path);
        // Projects reloaded
        // Remove any pending projects that are now present
        setPendingProjects(prev => prev.filter(p => !projects.some(lp => lp.path === p.path)));
      } else {
        // No GTD space root path in event handler
      }
    };

    const handleActionCreated = async (event: CustomEvent) => {
      const { projectPath } = event.detail;
      if (projectPath) {
        await loadProjectActions(projectPath);
        // Also reload projects to update action counts
        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      }
    };

    window.addEventListener('gtd-project-created', handleProjectCreated as EventListener);
    window.addEventListener('gtd-action-created', handleActionCreated as EventListener);

    return () => {
      unsubscribeMetadata();
      unsubscribeChanged();
      unsubscribeSaved();
      window.removeEventListener('gtd-project-created', handleProjectCreated as EventListener);
      window.removeEventListener('gtd-action-created', handleActionCreated as EventListener);
    };
  }, [gtdSpace, loadProjects, loadProjectActions, loadSectionFiles, projectActions]);

  // Prefetch actions after projects load so the UI always has items ready
  React.useEffect(() => {
    const prefetch = async () => {
      if (!gtdSpace?.projects || gtdSpace.projects.length === 0) return;
      // Load all project actions in parallel
      const projectsToLoad = gtdSpace.projects.filter(
        project => !projectActions[project.path]
      );
      await Promise.all(
        projectsToLoad.map(project => loadProjectActions(project.path))
      );
    };
    prefetch();
  }, [gtdSpace?.projects, loadProjectActions, projectActions]);

  const toggleProjectExpand = async (project: GTDProject) => {
    const isExpanded = expandedProjects.includes(project.path);

    if (isExpanded) {
      setExpandedProjects(prev => prev.filter(path => path !== project.path));
    } else {
      setExpandedProjects(prev => [...prev, project.path]);
      // Load actions if not already loaded
      if (!projectActions[project.path]) {
        await loadProjectActions(project.path);
      }
    }
  };

  const handleProjectClick = async (project: GTDProject) => {
    setSelectedProject(project);
    // Do not switch the global current folder; just open the README and keep GTD root stable
    // Preload actions for this project to ensure the list is populated
    if (!projectActions[project.path]) {
      await loadProjectActions(project.path);
    }

    // Open the project's README.md file
    const readmeFile: MarkdownFile = {
      id: `${project.path}/README.md`,
      name: 'README.md',
      path: `${project.path}/README.md`,
      size: 0, // Size will be determined when reading
      last_modified: Date.now(),
      extension: 'md'
    };

    onFileSelect(readmeFile);
  };

  const handleCreatePage = (section: GTDSection) => {
    if (section.id === 'habits') {
      // Show habit dialog for habits section
      setShowHabitDialog(true);
    } else {
      // Show page dialog for other sections
      const fullPath = `${gtdSpace?.root_path || currentFolder}/${section.path}`;
      setPageDialogDirectory({ path: fullPath, name: section.name });
      setShowPageDialog(true);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getProjectStatusColor = (statusInput: string | string[]) => {
    // Handle both string and array inputs
    const status = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    const normalizedStatus = status || 'in-progress';
    switch (normalizedStatus) {
      case 'completed': return 'text-green-600 dark:text-green-500';
      case 'waiting': return 'text-purple-600 dark:text-purple-500';
      case 'in-progress': return 'text-blue-600 dark:text-blue-500';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProjectStatusIcon = (statusInput: string | string[]) => {
    // Handle both string and array inputs
    const status = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    const normalizedStatus = status || 'in-progress';
    switch (normalizedStatus) {
      case 'completed': return CheckCircle2; // Filled circle with checkmark for completed
      case 'waiting': return CircleDot; // Filled circle (dot in center) for waiting
      case 'in-progress': return Circle; // Outline circle for in-progress
      default: return Circle;
    }
  };

  const getActionStatusIcon = (status: string) => {
    const normalizedStatus = status || 'in-progress';
    switch (normalizedStatus) {
      case 'complete': return CheckCircle2;
      case 'waiting': return CircleDot;
      case 'in-progress': return Circle;
      default: return Circle;
    }
  };

  const getActionStatusColor = (status: string) => {
    const normalizedStatus = status || 'in-progress';
    switch (normalizedStatus) {
      case 'complete': return 'text-green-600 dark:text-green-500';
      case 'waiting': return 'text-purple-600 dark:text-purple-500';
      case 'in-progress': return 'text-blue-600 dark:text-blue-500';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Generic search results across all sections
  const searchResults = React.useMemo(() => {
    if (!searchQuery) {
      return null;
    }

    const query = searchQuery.toLowerCase();
    const results: {
      projects: GTDProject[];
      actions: { project: string; actions: MarkdownFile[] }[];
      sections: { section: GTDSection; files: MarkdownFile[] }[];
    } = {
      projects: [],
      actions: [],
      sections: []
    };

    // Search projects
    if (gtdSpace?.projects) {
      results.projects = gtdSpace.projects.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      );
    }

    // Search project actions
    Object.entries(projectActions).forEach(([projectPath, actions]) => {
      const matchingActions = actions.filter(action => {
        const name = action.name.replace('.md', '');
        return name.toLowerCase().includes(query);
      });
      if (matchingActions.length > 0) {
        const projectName = projectPath.split('/').pop() || projectPath;
        results.actions.push({ project: projectName, actions: matchingActions });
      }
    });

    // Search all sections
    GTD_SECTIONS.forEach(section => {
      if (section.id === 'calendar' || section.id === 'projects') return; // Skip special sections

      const sectionPath = `${gtdSpace?.root_path || currentFolder}/${section.path}`;
      const files = sectionFiles[sectionPath] || [];
      const matchingFiles = files.filter(file => {
        const name = file.name.replace('.md', '');
        return name.toLowerCase().includes(query);
      });

      if (matchingFiles.length > 0) {
        results.sections.push({ section, files: matchingFiles });
      }
    });

    return results;
  }, [searchQuery, gtdSpace?.projects, projectActions, sectionFiles, currentFolder, gtdSpace?.root_path]);

  const filteredProjects = React.useMemo(() => {
    // Merge confirmed projects with any optimistic pending ones
    const base = gtdSpace?.projects || [];
    const merged = [...base];
    for (const p of pendingProjects) if (!merged.some(m => m.path === p.path)) merged.push(p);

    if (searchQuery) return merged.filter(project => {
      const q = searchQuery.toLowerCase();
      return project.name.toLowerCase().includes(q) || (project.description || '').toLowerCase().includes(q);
    });

    return merged;
  }, [gtdSpace?.projects, pendingProjects, searchQuery]);

  const handleSelectFolder = async () => {
    try {
      const folderPath = await invoke<string>('select_folder');
      onFolderSelect(folderPath);
    } catch (error) {
      // Silently handle folder selection errors (user cancelled)
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      if (deleteItem.type === 'project') {
        // For projects, we need to delete the entire folder
        const result = await invoke<{ success: boolean; path?: string | null; message?: string | null }>('delete_folder', { path: deleteItem.path });

        if (!result || !result.success) {
          alert(`Failed to delete project: ${result?.message || 'Unknown error'}`);
          return;
        }


        // Update local state
        setExpandedProjects(prev => prev.filter(p => p !== deleteItem.path));
        setProjectActions(prev => {
          const updated = { ...prev };
          delete updated[deleteItem.path];
          return updated;
        });
        setProjectMetadata(prev => {
          const updated = { ...prev };
          delete updated[deleteItem.path];
          return updated;
        });

        // Reload projects
        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
          // Force a re-render
          setSectionRefreshKey(prev => prev + 1);
        }
      } else {
        // For actions and other files, use delete_file

        try {
          // Add a timeout to the invoke call
          const deletePromise = invoke<{ success: boolean; path?: string | null; message?: string | null }>('delete_file', { path: deleteItem.path });

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Delete operation timed out after 5 seconds')), 5000);
          });

          // Race between the delete and timeout
          const result = await Promise.race([deletePromise, timeoutPromise]) as { success: boolean; path?: string | null; message?: string | null };

          if (!result || !result.success) {
            alert(`Failed to delete file: ${result?.message || 'Unknown error'}`);
            return;
          }


          // Update UI based on type
          if (deleteItem.type === 'action') {
            // Update action state
            setActionStatuses(prev => {
              const updated = { ...prev };
              delete updated[deleteItem.path];
              return updated;
            });
            setActionMetadata(prev => {
              const updated = { ...prev };
              delete updated[deleteItem.path];
              return updated;
            });

            // Reload actions for the project
            const projectPath = deleteItem.path.substring(0, deleteItem.path.lastIndexOf('/'));

            // First remove the action from the local state for immediate UI update
            setProjectActions(prev => ({
              ...prev,
              [projectPath]: prev[projectPath]?.filter(a => a.path !== deleteItem.path) || []
            }));

            // Then reload from disk
            await loadProjectActions(projectPath);
          } else {
            // For section files (Habits, Someday Maybe, Cabinet)
            // Clear metadata for the deleted file
            setSectionFileMetadata(prev => {
              const updated = { ...prev };
              delete updated[deleteItem.path];
              return updated;
            });

            const sectionPath = deleteItem.path.substring(0, deleteItem.path.lastIndexOf('/'));

            // First clear the section files to force UI update
            setSectionFiles(prev => ({
              ...prev,
              [sectionPath]: prev[sectionPath]?.filter(f => f.path !== deleteItem.path) || []
            }));

            // Then reload from disk
            await loadSectionFiles(sectionPath);

            // Force a re-render of the section
            setSectionRefreshKey(prev => prev + 1);
          }

          // Close any open tabs for the deleted item
          window.dispatchEvent(new CustomEvent('file-deleted', {
            detail: { path: deleteItem.path }
          }));

        } catch (invokeError) {
          alert(`Error deleting file: ${invokeError}`);
          return;
        }
      }

      setDeleteItem(null);
    } catch (error) {
      // Silently handle deletion errors
    }
  };

  const handleOpenFolderInExplorer = async () => {
    if (!currentFolder) return;

    try {
      await invoke('open_folder_in_explorer', { path: currentFolder });
    } catch (error) {
      // Silently handle explorer open errors
    }
  };

  if (!currentFolder) {
    return (
      <Card className={`flex flex-col h-full border-r ${className}`}>
        <div className="p-6 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">Welcome to GTD Space</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select a folder to create or open a GTD workspace
          </p>
          <Button onClick={handleSelectFolder} variant="default" size="sm">
            <Folder className="h-4 w-4 mr-2" />
            Select Folder
          </Button>
        </div>
      </Card>
    );
  }

  // If not a GTD space, show a simple message
  if (!gtdSpace?.isGTDSpace) {
    return (
      <Card className={`flex flex-col h-full border-r ${className}`}>
        <div className="p-6 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>This is not a GTD workspace</p>
          <p className="text-sm mt-2">Initialize from the prompt</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col h-full border-r ${className}`}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-1">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">GTD Workspace</span>
          </h3>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              onClick={handleOpenFolderInExplorer}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Open in File Explorer"
            >
              <Folder className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={async () => {
                // Call the original refresh
                if (onRefresh) {
                  onRefresh();
                }

                // Refresh projects list
                const rootPath = gtdSpace?.root_path || currentFolder;
                if (rootPath) {
                  await loadProjects(rootPath);

                  // Also refresh all section files
                  const promises = GTD_SECTIONS.filter(s => s.id !== 'calendar').map(section => {
                    const sectionPath = `${rootPath}/${section.path}`;
                    return loadSectionFiles(sectionPath, true);
                  });
                  await Promise.all(promises);
                }
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{gtdSpace.projects?.length || 0} Projects</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">
              {gtdSpace.projects?.reduce((sum, p) => sum + (p.action_count || 0), 0) || 0} Actions
            </span>
          </div>
        </div>
      </div>

      {/* Search Toggle */}
      <div className="px-3 pt-2">
        <Button
          onClick={() => setShowSearch(!showSearch)}
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Search className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
          <span className="truncate">Search</span>
        </Button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-3 py-2">
          <FileSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search..."
          />
        </div>
      )}

      {/* GTD Sections */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Show search results when searching */}
          {searchQuery && searchResults ? (
            <div className="space-y-4">
              {/* Projects Results */}
              {searchResults.projects.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-sm font-medium">Projects</span>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {searchResults.projects.length}
                    </Badge>
                  </div>
                  <div className="space-y-1 pl-2">
                    {searchResults.projects.map((project) => {
                      const currentStatus = projectMetadata[project.path]?.status || project.status || 'in-progress';
                      const currentTitle = projectMetadata[project.path]?.title || project.name;
                      const StatusIcon = getProjectStatusIcon(currentStatus);

                      return (
                        <div
                          key={project.path}
                          className="group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                          onClick={() => handleProjectClick(project)}
                        >
                          <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${getProjectStatusColor(currentStatus)}`} />
                          <span className="text-sm truncate">{currentTitle}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions Results */}
              {searchResults.actions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <FileText className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-sm font-medium">Actions</span>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {searchResults.actions.reduce((sum, p) => sum + p.actions.length, 0)}
                    </Badge>
                  </div>
                  <div className="space-y-2 pl-2">
                    {searchResults.actions.map(({ project, actions }) => (
                      <div key={project}>
                        <div className="text-xs text-muted-foreground mb-1">{project}</div>
                        {actions.map((action) => {
                          const currentStatus = actionMetadata[action.path]?.status || actionStatuses[action.path] || 'in-progress';
                          const currentTitle = actionMetadata[action.path]?.title || action.name.replace('.md', '');
                          const StatusIcon = getActionStatusIcon(currentStatus);

                          return (
                            <div
                              key={action.path}
                              className="group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                              onClick={() => onFileSelect(action)}
                            >
                              <StatusIcon className={`h-3 w-3 flex-shrink-0 ${getActionStatusColor(currentStatus)}`} />
                              <span className="text-sm truncate">{currentTitle}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Sections Results */}
              {searchResults.sections.map(({ section, files }) => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <section.icon className={`h-3.5 w-3.5 ${section.color}`} />
                    <span className="text-sm font-medium">{section.name}</span>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {files.length}
                    </Badge>
                  </div>
                  <div className="space-y-1 pl-2">
                    {files.map((file) => {
                      const metadata = sectionFileMetadata[file.path];
                      const displayName = metadata?.title || file.name.replace('.md', '');

                      return (
                        <div
                          key={file.path}
                          className="group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                          onClick={() => onFileSelect(file)}
                        >
                          <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{displayName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* No results message */}
              {searchResults.projects.length === 0 &&
                searchResults.actions.length === 0 &&
                searchResults.sections.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No results found for "{searchQuery}"
                  </div>
                )}
            </div>
          ) : (
            /* Normal sections view when not searching */
            <>
              {/* Calendar Section - Special non-collapsible section */}
              {/* GTD Sections in correct order: Horizon folders (highest to lowest), Calendar, Projects, etc. */}
              {GTD_SECTIONS.map((section) => {
                const isExpanded = expandedSections.includes(section.id);
                const sectionPath = `${gtdSpace?.root_path || currentFolder}/${section.path}`;
                const files = sectionFiles[sectionPath] || [];

                // Handle Calendar section specially
                if (section.id === 'calendar') {
                  return (
                    <div
                      key={section.id}
                      className="group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                      onClick={() => {
                        // Open calendar as a special tab
                        const calendarFile: MarkdownFile = {
                          id: '::calendar::',
                          name: 'Calendar',
                          path: '::calendar::',
                          size: 0,
                          last_modified: Date.now(),
                          extension: 'calendar'
                        };
                        onFileSelect(calendarFile);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                        <span className="font-medium text-sm">Calendar</span>
                      </div>
                    </div>
                  );
                }

                // Handle Projects section specially
                if (section.id === 'projects') {
                  return (
                    <Collapsible
                      key={`${section.id}-${sectionRefreshKey}`}
                      open={isExpanded}
                      onOpenChange={() => toggleSection('projects')}
                    >
                      <div className="group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors">
                        <CollapsibleTrigger className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <section.icon className={`h-3.5 w-3.5 ${section.color} flex-shrink-0`} />
                            <span className="font-medium text-sm truncate">{section.name}</span>
                            {(!isLoading && filteredProjects.length > 0) && (
                              <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                                {filteredProjects.length}
                              </Badge>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowProjectDialog(true);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Add Project"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <CollapsibleContent>
                        <div className="pl-6 pr-2 py-1 space-y-1">
                          {isLoading ? (
                            <div className="space-y-2 py-2">
                              {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center gap-2 animate-pulse">
                                  <div className="h-3 w-3 bg-muted rounded"></div>
                                  <div className="h-4 bg-muted rounded flex-1 max-w-[180px]"></div>
                                </div>
                              ))}
                            </div>
                          ) : filteredProjects.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">
                              {searchQuery ? 'No projects match your search' : 'No projects yet'}
                            </div>
                          ) : (
                            filteredProjects.map((project) => {
                              const isProjectExpanded = expandedProjects.includes(project.path);
                              const actions = projectActions[project.path] || [];
                              const currentStatus = projectMetadata[project.path]?.status || project.status || 'in-progress';
                              const currentTitle = projectMetadata[project.path]?.title || project.name;
                              const StatusIcon = getProjectStatusIcon(currentStatus);

                              return (
                                <div key={project.path}>
                                  <div className="group flex items-center justify-between py-1 px-1 hover:bg-accent rounded-lg transition-colors">
                                    <div
                                      className="flex items-center gap-0.5 flex-1 min-w-0 cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        handleProjectClick(project)
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleProjectClick(project);
                                        }
                                      }}
                                    >
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleProjectExpand(project);
                                        }}
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 flex-shrink-0"
                                      >
                                        <ChevronRight className={`h-3 w-3 transition-transform ${isProjectExpanded ? 'rotate-90' : ''}`} />
                                      </Button>
                                      <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${getProjectStatusColor(currentStatus)}`} />
                                      <div className="flex-1 min-w-0 ml-1">
                                        <div className="font-medium text-sm truncate">{currentTitle}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <span className="truncate">{project.action_count || 0} actions</span>
                                          {(() => {
                                            const dueStr = projectMetadata[project.path]?.due_date ?? project.due_date ?? '';
                                            if (!dueStr || dueStr.trim() === '') return null;
                                            const date = parseLocalDateString(dueStr);
                                            return date ? (
                                              <span className="flex items-center flex-shrink-0">
                                                <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                                <span className="truncate">{date.toLocaleDateString()}</span>
                                              </span>
                                            ) : null;
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProject(project);
                                          setShowActionDialog(true);
                                        }}
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Add Action"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <MoreHorizontal className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuItem
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await invoke('open_file_location', { file_path: project.path });
                                              } catch (error) {
                                                // Silently handle file location open errors
                                              }
                                            }}
                                          >
                                            <Folder className="h-3 w-3 mr-2" />
                                            Open Project Folder
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteItem({
                                                type: 'project',
                                                path: project.path,
                                                name: project.name
                                              });
                                            }}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete Project
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  {isProjectExpanded && (
                                    <div className="pl-8 py-0.5">
                                      {actions.length === 0 ? (
                                        <div className="text-xs text-muted-foreground py-1 px-1">No actions yet</div>
                                      ) : (
                                        actions
                                          .filter(action => !action.name.toLowerCase().includes('readme'))
                                          .map((action) => {
                                            const currentStatus = actionMetadata[action.path]?.status || actionStatuses[action.path] || 'in-progress';
                                            const currentTitle = actionMetadata[action.path]?.title || action.name.replace('.md', '');
                                            const currentPath = actionMetadata[action.path]?.currentPath || action.path;

                                            return (
                                              <div
                                                key={action.path}
                                                className="group flex items-center justify-between gap-1 px-1 py-0.5 hover:bg-accent/50 rounded text-xs"
                                              >
                                                <div
                                                  className="flex items-center gap-1 flex-1 cursor-pointer"
                                                  role="button"
                                                  tabIndex={0}
                                                  onClick={() => {
                                                    onFileSelect({ ...action, path: currentPath });
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      onFileSelect({ ...action, path: currentPath });
                                                    }
                                                  }}
                                                >
                                                  <FileText className={`h-2.5 w-2.5 flex-shrink-0 ${getActionStatusColor(currentStatus)}`} />
                                                  <span className="truncate flex-1">{currentTitle}</span>
                                                  {actionMetadata[action.path]?.due_date && actionMetadata[action.path].due_date.trim() !== '' && (() => {
                                                    const date = new Date(actionMetadata[action.path].due_date);
                                                    return !isNaN(date.getTime()) ? (
                                                      <span className="flex items-center flex-shrink-0 ml-1 text-muted-foreground">
                                                        <Calendar className="h-2 w-2 mr-0.5" />
                                                        <span className="text-[10px]">{date.toLocaleDateString()}</span>
                                                      </span>
                                                    ) : null;
                                                  })()}
                                                </div>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <MoreHorizontal className="h-2.5 w-2.5" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          await invoke('open_file_location', { file_path: currentPath });
                                                        } catch (error) {
                                                          // Silently handle file location open errors
                                                        }
                                                      }}
                                                    >
                                                      <Folder className="h-3 w-3 mr-2" />
                                                      Open File Location
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteItem({
                                                          type: 'action',
                                                          path: currentPath,
                                                          name: currentTitle
                                                        });
                                                      }}
                                                      className="text-destructive focus:text-destructive"
                                                    >
                                                      <Trash2 className="h-3 w-3 mr-2" />
                                                      Delete
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            );
                                          })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                // Regular sections (Horizon folders, Habits, Someday Maybe, Cabinet)
                return (
                  <Collapsible
                    key={`${section.id}-${sectionRefreshKey}`}
                    open={isExpanded}
                    onOpenChange={() => {
                      toggleSection(section.id);
                      if (!isExpanded && !sectionFiles[sectionPath]) {
                        loadSectionFiles(sectionPath);
                      }
                    }}
                  >
                    <div className="group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors">
                      <CollapsibleTrigger
                        className="flex-1 min-w-0"
                        onClick={() => {
                          // For horizon folders, also open the README when clicking the header
                          if (section.id === 'areas' || section.id === 'goals' || section.id === 'vision' || section.id === 'purpose') {
                            // Open the README.md file
                            const readmeFile: MarkdownFile = {
                              id: `${sectionPath}/README.md`,
                              name: 'README.md',
                              path: `${sectionPath}/README.md`,
                              size: 0,
                              last_modified: Date.now(),
                              extension: 'md'
                            };
                            onFileSelect(readmeFile);
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <section.icon className={`h-3.5 w-3.5 ${section.color} flex-shrink-0`} />
                          <span className="font-medium text-sm truncate">{section.name}</span>
                          {loadedSections.has(sectionPath) && files.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                              {files.length}
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      {(section.id === 'someday' || section.id === 'cabinet' || section.id === 'habits' || section.id === 'areas' || section.id === 'goals' || section.id === 'vision' || section.id === 'purpose') && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreatePage(section);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Add ${section.name} Page`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <CollapsibleContent>
                      <div className="pl-6 pr-2 py-1 space-y-1">
                        {!loadedSections.has(sectionPath) && loadingSectionsRef.current.has(sectionPath) ? (
                          <div className="space-y-2 py-2">
                            {[...Array(2)].map((_, i) => (
                              <div key={i} className="flex items-center gap-2 animate-pulse">
                                <div className="h-2.5 w-2.5 bg-muted rounded"></div>
                                <div className="h-3.5 bg-muted rounded flex-1 max-w-[160px]"></div>
                              </div>
                            ))}
                          </div>
                        ) : files.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">No pages yet</div>
                        ) : (
                          files.map((file) => {
                            // Use metadata for title if available
                            const currentTitle = sectionFileMetadata[file.path]?.title || file.name.replace('.md', '');
                            const currentPath = sectionFileMetadata[file.path]?.currentPath || file.path;

                            return (
                              <div
                                key={file.path}
                                className="group flex items-center justify-between gap-1 px-1 py-0.5 hover:bg-accent/50 rounded text-xs"
                              >
                                <div
                                  className="flex items-center gap-1 flex-1 cursor-pointer"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    // Create a modified file object with the current path
                                    onFileSelect({ ...file, path: currentPath });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      onFileSelect({ ...file, path: currentPath });
                                    }
                                  }}
                                >
                                  <FileText className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate">{currentTitle}</span>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-2.5 w-2.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await invoke('open_file_location', { file_path: currentPath });
                                        } catch (error) {
                                          // Silently handle file location open errors
                                        }
                                      }}
                                    >
                                      <Folder className="h-3 w-3 mr-2" />
                                      Open File Location
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteItem({
                                          type: 'file',
                                          path: currentPath,  // Use currentPath instead of file.path
                                          name: currentTitle
                                        });
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      {/* GTD Dialogs */}
      <GTDProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        spacePath={gtdSpace?.root_path || currentFolder || ''}
        onSuccess={() => { /* rely on event-driven refresh */ }}
      />

      {selectedProject && (
        <GTDActionDialog
          isOpen={showActionDialog}
          onClose={() => {
            setShowActionDialog(false);
            setSelectedProject(null);
          }}
          projectPath={selectedProject.path}
          projectName={selectedProject.name}
          onSuccess={async () => {
            // Reload project actions after successful creation
            await loadProjectActions(selectedProject.path);
            // Also reload projects to update action counts
            if (gtdSpace?.root_path) {
              await loadProjects(gtdSpace.root_path);
            }
          }}
        />
      )}

      {pageDialogDirectory && (
        <CreatePageDialog
          isOpen={showPageDialog}
          onClose={() => {
            setShowPageDialog(false);
            setPageDialogDirectory(null);
          }}
          directory={pageDialogDirectory.path}
          directoryName={pageDialogDirectory.name}
          onSuccess={async (filePath) => {

            // Create the new file object immediately
            const newFile: MarkdownFile = {
              id: filePath,
              name: filePath.split('/').pop() || '',
              path: filePath,
              size: 0,
              last_modified: Date.now() / 1000, // Convert to seconds
              extension: 'md'
            };

            // Immediately add the file to the section files state
            flushSync(() => {
              setSectionFiles(prev => {
                const currentFiles = prev[pageDialogDirectory.path] || [];
                const updatedFiles = [...currentFiles, newFile].sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
                return {
                  ...prev,
                  [pageDialogDirectory.path]: updatedFiles
                };
              });

              // Force a re-render
              setSectionRefreshKey(prev => prev + 1);
            });

            // Ensure the section is expanded (Cabinet -> cabinet, Someday Maybe -> someday-maybe)
            const sectionId = pageDialogDirectory.name.toLowerCase().replace(/\s+/g, '-');
            setExpandedSections(prev => {
              if (!prev.includes(sectionId)) {
                return [...prev, sectionId];
              }
              return prev;
            });

            // Open the newly created file
            onFileSelect(newFile);

            // Also reload from disk to ensure consistency (but don't wait for it)
            loadSectionFiles(pageDialogDirectory.path).then(_files => {
              // Files loaded successfully
            });
          }}
        />
      )}

      <CreateHabitDialog
        isOpen={showHabitDialog}
        onClose={() => setShowHabitDialog(false)}
        spacePath={gtdSpace?.root_path || currentFolder || ''}
        onSuccess={async (habitPath) => {
          // Optimistically add the new habit to the UI
          const habitsSection = GTD_SECTIONS.find(s => s.id === 'habits');
          if (habitsSection) {
            const habitsPath = `${gtdSpace?.root_path || currentFolder}/${habitsSection.path}`;

            // Create the new file object
            const newFile: MarkdownFile = {
              id: habitPath,
              name: habitPath.split('/').pop() || '',
              path: habitPath,
              size: 0,
              last_modified: Date.now(),
              extension: 'md'
            };

            // Optimistically update the sectionFiles state
            setSectionFiles(prev => {
              const currentHabits = prev[habitsPath] || [];
              const updatedHabits = [...currentHabits, newFile].sort((a, b) =>
                a.name.localeCompare(b.name)
              );
              return {
                ...prev,
                [habitsPath]: updatedHabits
              };
            });

            // Force a refresh to ensure UI updates
            setSectionRefreshKey(prev => prev + 1);

            // Ensure the habits section is expanded
            setExpandedSections(prev =>
              prev.includes('habits') ? prev : [...prev, 'habits']
            );

            // Open the newly created habit
            onFileSelect(newFile);

            // Sync with actual files from disk after a short delay
            setTimeout(async () => {
              try {
                const _files = await invoke<MarkdownFile[]>('list_markdown_files', {
                  path: habitsPath
                });
                setSectionFiles(prev => ({
                  ...prev,
                  [habitsPath]: _files
                }));
              } catch (error) {
                // Silently handle file list sync errors
              }
            }, 500);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteItem !== null} onOpenChange={(open) => {
        if (!open) setDeleteItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteItem?.type === 'project' ? 'Project' : deleteItem?.type === 'action' ? 'Action' : 'File'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"?
              {deleteItem?.type === 'project' && ' This will delete the project folder and all its contents including actions.'}
              {' This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default GTDWorkspaceSidebar;