import React, { useState, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import debounce from 'lodash.debounce';
import { useErrorHandler } from './useErrorHandler';
import { useToast } from './useToast';
import {
  GTDSpace,
  GTDProject,
  GTDProjectCreate,
  GTDActionCreate,
} from '@/types';
import { migrateGTDObjects } from '@/utils/data-migration';

/**
 * Hook for managing GTD space operations
 * 
 * Provides functionality for:
 * - Initializing GTD space structure
 * - Creating projects and actions
 * - Managing GTD-specific operations
 */
export function useGTDSpace() {
  const [gtdSpace, setGTDSpace] = useState<GTDSpace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();

  /**
   * Waits for the expected GTD directory structure to be created
   * @param spacePath - Path to the GTD space root
   * @param maxAttempts - Maximum number of polling attempts (default: 50)
   * @param intervalMs - Polling interval in milliseconds (default: 100)
   * @returns Promise that resolves when all expected directories exist
   */
  const waitForDirectoryStructure = useCallback(
    async (
      spacePath: string,
      maxAttempts: number = 50,
      intervalMs: number = 100
    ): Promise<void> => {
      const expectedDirs = ['Projects', 'Habits', 'Someday Maybe', 'Cabinet'];
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          // Check if all expected directories exist
          const dirChecks = await Promise.all(
            expectedDirs.map(async (dirName) => {
              try {
                const dirPath = `${spacePath}/${dirName}`;
                const result = await invoke<boolean>('check_directory_exists', { path: dirPath });
                return { dirName, exists: result };
              } catch (error) {
                return { dirName, exists: false };
              }
            })
          );
          
          // If all directories exist, we're done
          const allExist = dirChecks.every(check => check.exists);
          if (allExist) {
            return;
          }
          
          // Log which directories are still missing
          const missingDirs = dirChecks.filter(check => !check.exists).map(check => check.dirName);
          if (missingDirs.length > 0) {
            // Some directories are still missing, wait for next check
          }
          
        } catch (error) {
          // Silently handle directory check errors
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
      
      throw new Error(`Directory structure not ready after ${maxAttempts} attempts`);
    },
    []
  );

  /**
   * Initialize a new GTD space
   */
  const initializeSpace = useCallback(
    async (spacePath: string) => {
      if (!spacePath) {
        return false;
      }
      
      setIsLoading(true);
      
      try {
        const result = await withErrorHandling(
          async () => {
            const message = await invoke<string>('initialize_gtd_space', { spacePath });
            
            // Wait for directory structure to be fully created
            try {
              await waitForDirectoryStructure(spacePath);
            } catch (error) {
              // Continue anyway - the user can refresh manually if needed
            }
            
            // Store the GTD space path for references component
            localStorage.setItem('gtdspace-current-path', spacePath);
            
            // Update state with initialized space
            setGTDSpace({
              root_path: spacePath,
              is_initialized: true,
              isGTDSpace: true,
              projects: [],
              total_actions: 0,
            });
            
            return message;
          },
          'Failed to initialize GTD space',
          'gtd'
        );

        if (result) {
          showSuccess(result);
        }
        
        return result != null; // Checks for both null and undefined
      } finally {
        setIsLoading(false);
      }
    },
    [withErrorHandling, showSuccess, waitForDirectoryStructure]
  );

  /**
   * Create a new GTD project
   */
  const createProject = useCallback(
    async (params: GTDProjectCreate) => {
      setIsLoading(true);
      
      try {
        const result = await withErrorHandling(
          async () => {
            const projectPath = await invoke<string>('create_gtd_project', {
              spacePath: params.space_path,
              projectName: params.project_name,
              description: params.description,
              dueDate: params.dueDate || undefined,
              status: params.status || 'in-progress',
            });
            
            // Create project object for state update
            const newProject: GTDProject = {
              name: params.project_name,
              description: params.description,
              dueDate: params.dueDate,
              status: params.status || 'in-progress',
              path: projectPath,
              createdDateTime: new Date().toISOString(),
              action_count: 0,
            };
            
            // Update space state using functional form to avoid stale closure
            setGTDSpace(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                projects: [...(prev.projects || []), newProject],
              };
            });
            
            return projectPath;
          },
          'Failed to create project',
          'gtd'
        );

        if (result) {
          showSuccess(`Project "${params.project_name}" created successfully`);
          
          // Emit custom event to trigger sidebar refresh
          window.dispatchEvent(new CustomEvent('gtd-project-created', {
            detail: { projectPath: result, projectName: params.project_name }
          }));
        }
        
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [withErrorHandling, showSuccess]
  );

  /**
   * Create a new GTD action
   */
  const createAction = useCallback(
    async (params: GTDActionCreate) => {
      setIsLoading(true);
      
      try {
        const result = await withErrorHandling(
          async () => {
            // Pass the full contexts array to support multiselect
            const contextsArray = params.contexts && params.contexts.length > 0 
              ? params.contexts 
              : undefined;
            
            const actionPath = await invoke<string>('create_gtd_action', {
              project_path: params.project_path,
              action_name: params.action_name,
              status: params.status,
              due_date: params.dueDate || undefined,
              focus_date: params.focusDate || undefined,
              effort: params.effort,
              contexts: contextsArray,
            });
            
            return actionPath;
          },
          'Failed to create action',
          'gtd'
        );

        if (result) {
          showSuccess(`Action "${params.action_name}" created successfully`);
          
          // Update project action count using functional state update
          setGTDSpace(prev => {
            if (!prev || !prev.projects) return prev;
            
            const updatedProjects = prev.projects.map(project => {
              if (project.path === params.project_path) {
                return {
                  ...project,
                  action_count: (project.action_count || 0) + 1,
                };
              }
              return project;
            });
            
            return {
              ...prev,
              projects: updatedProjects,
              total_actions: (prev.total_actions || 0) + 1,
            };
          });
          
          // Emit custom event to trigger sidebar refresh
          window.dispatchEvent(new CustomEvent('gtd-action-created', {
            detail: { actionPath: result, actionName: params.action_name, projectPath: params.project_path }
          }));
        }
        
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [withErrorHandling, showSuccess]
  );

  /**
   * Check if a directory is a valid GTD space
   */
  const checkGTDSpace = useCallback(
    async (path: string): Promise<boolean> => {
      const result = await withErrorHandling(
        async () => {
          try {
            const requiredDirs = ['Projects', 'Habits', 'Someday Maybe', 'Cabinet'];
            for (const dir of requiredDirs) {
              try {
                await invoke('list_markdown_files', { path: `${path}/${dir}` });
              } catch {
                return false;
              }
            }
            // Store the GTD space path for references component
            localStorage.setItem('gtdspace-current-path', path);
            
            // Preserve existing projects/action counts to avoid flicker
            setGTDSpace(prev => ({
              root_path: path,
              is_initialized: true,
              isGTDSpace: true,
              projects: prev?.projects || [],
              total_actions: prev?.total_actions || 0,
            }));
            return true;
          } catch {
            return false;
          }
        },
        'Failed to check GTD space',
        'gtd'
      );
      return result || false;
    },
    [withErrorHandling]
  );

  /**
   * Internal implementation of loadProjects
   */
  const loadProjectsInternal = useCallback(
    async (spacePath: string) => {
      console.log('[useGTDSpace] loadProjectsInternal called for path:', spacePath);
      setIsLoading(true);
      let result: GTDProject[] | undefined;
      try {
        result = await withErrorHandling(
          async () => {
            let projects = await invoke<GTDProject[]>('list_gtd_projects', {
              spacePath: spacePath,
            });
            
            // Apply migrations to ensure backward compatibility
            projects = migrateGTDObjects(projects);
            
            // Calculate total actions
            const totalActions = projects.reduce((sum, project) => sum + (project.action_count || 0), 0);
            
            // Update space state with loaded projects - use functional update to preserve other state
            console.log('[useGTDSpace] Updating GTDSpace state with', projects.length, 'projects');
            setGTDSpace(prev => {
              // If no previous state, we need to initialize it
              if (!prev) {
                console.log('[useGTDSpace] No previous state - initializing with projects');
                return {
                  root_path: spacePath,
                  is_initialized: true,
                  isGTDSpace: true,
                  projects,
                  total_actions: totalActions,
                };
              }
              
              // If the path doesn't match, skip update (wrong space)
              if (prev.root_path !== spacePath) {
                console.log('[useGTDSpace] Skipping state update - path mismatch');
                return prev;
              }
              
              // Check if the data has actually changed
              const projectsChanged = 
                prev.projects?.length !== projects.length ||
                prev.total_actions !== totalActions ||
                JSON.stringify(prev.projects) !== JSON.stringify(projects);
              
              if (!projectsChanged) {
                console.log('[useGTDSpace] Skipping state update - data unchanged');
                return prev;
              }
              
              console.log('[useGTDSpace] Previous state:', prev);
              const newState = {
                ...prev,
                // Don't update root_path - it's already set and updating it causes re-renders
                is_initialized: true,
                isGTDSpace: true,
                projects,
                total_actions: totalActions,
              };
              console.log('[useGTDSpace] New state:', newState);
              return newState;
            });
            
            return projects;
          },
          'Failed to load projects',
          'gtd'
        );
      } finally {
        setIsLoading(false);
      }
      
      console.log('[useGTDSpace] loadProjectsInternal completed, returning', result?.length || 0, 'projects');
      return result || [];
    },
    [withErrorHandling]
  );

  // Track the last spacePath to avoid redundant calls
  const lastLoadedPath = useRef<string>('');
  const loadPromise = useRef<Promise<GTDProject[]> | null>(null);

  /**
   * Debounced version of loadProjects to prevent rapid re-renders
   */
  const debouncedLoadProjects = useMemo(
    () => debounce(
      async (spacePath: string) => {
        // Skip if we're already loading the same path
        if (lastLoadedPath.current === spacePath && loadPromise.current) {
          console.log('[useGTDSpace] Skipping loadProjects - already loading path:', spacePath);
          return loadPromise.current;
        }

        lastLoadedPath.current = spacePath;
        loadPromise.current = loadProjectsInternal(spacePath);
        
        try {
          const result = await loadPromise.current;
          return result;
        } finally {
          loadPromise.current = null;
        }
      },
      500, // 500ms debounce to batch rapid calls
      { leading: true, trailing: true, maxWait: 1000 } // Run immediately and flush the last call within the window
    ),
    [loadProjectsInternal]
  );

  /**
   * Load projects from a GTD space (debounced)
   */
  const loadProjects = useCallback(
    async (spacePath: string) => {
      console.log('[useGTDSpace] loadProjects called for path:', spacePath);
      return debouncedLoadProjects(spacePath);
    },
    [debouncedLoadProjects]
  );

  /**
   * Initialize default GTD space if user preferences allow it (on app startup)
   * - Derives default path in backend
   * - Ensures GTD structure exists
   * - Seeds example content (first run) if enabled
   * - Returns the path or null if initialization is disabled or failed
   */
  const initializeDefaultSpaceIfNeeded = useCallback(async (): Promise<string | null> => {
    // Allow tests to disable auto init
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return null;

    setIsInitializing(true);
    const result = await withErrorHandling(async () => {
      const path = await invoke<string>('initialize_default_gtd_space');
      return path;
    }, 'Failed to initialize default GTD space', 'gtd');
    setIsInitializing(false);
    return result;
  }, [withErrorHandling]);

  const refreshSpace = useCallback(async () => {
    if (gtdSpace?.root_path) {
      await checkGTDSpace(gtdSpace.root_path);
      await loadProjects(gtdSpace.root_path);
    }
  }, [gtdSpace?.root_path, checkGTDSpace, loadProjects]);

  // Cleanup debounced function on unmount
  React.useEffect(() => {
    return () => {
      debouncedLoadProjects.cancel();
    };
  }, [debouncedLoadProjects]);

  /**
   * Initialize and load a GTD space - used for switching workspaces
   * Combines checking the space and loading projects
   */
  const initializeGTDSpace = useCallback(async (spacePath: string) => {
    setIsLoading(true);
    
    // Check if it's a valid GTD space
    const isValid = await checkGTDSpace(spacePath);
    
    if (isValid) {
      // Load projects if it's a valid space
      await loadProjects(spacePath);
      
      // Store the current workspace path
      localStorage.setItem('gtdspace-current-path', spacePath);
    }
    
    setIsLoading(false);
    return isValid;
  }, [checkGTDSpace, loadProjects]);

  return {
    gtdSpace,
    isLoading,
    isInitializing,
    initializeSpace,
    initializeGTDSpace,
    createProject,
    createAction,
    checkGTDSpace,
    loadProjects,
    initializeDefaultSpaceIfNeeded,
    refreshSpace,
  };
}