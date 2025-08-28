import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useErrorHandler } from './useErrorHandler';
import { useToast } from './useToast';
import {
  GTDSpace,
  GTDProject,
  GTDProjectCreate,
  GTDActionCreate,
} from '@/types';

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
      
      setIsLoading(false);
      return result !== null;
    },
    [withErrorHandling, showSuccess, waitForDirectoryStructure]
  );

  /**
   * Create a new GTD project
   */
  const createProject = useCallback(
    async (params: GTDProjectCreate) => {
      setIsLoading(true);
      
      const result = await withErrorHandling(
        async () => {
          const projectPath = await invoke<string>('create_gtd_project', {
            spacePath: params.space_path,
            projectName: params.project_name,
            description: params.description,
            dueDate: params.due_date || undefined,
            status: params.status || 'in-progress',
          });
          
          // Create project object for state update
          const newProject: GTDProject = {
            name: params.project_name,
            description: params.description,
            due_date: params.due_date,
            status: params.status || 'in-progress',
            path: projectPath,
            created_date_time: new Date().toISOString(),
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
      
      setIsLoading(false);
      return result;
    },
    [gtdSpace, withErrorHandling, showSuccess]
  );

  /**
   * Create a new GTD action
   */
  const createAction = useCallback(
    async (params: GTDActionCreate) => {
      setIsLoading(true);
      
      const result = await withErrorHandling(
        async () => {
          const actionPath = await invoke<string>('create_gtd_action', {
            projectPath: params.project_path,
            actionName: params.action_name,
            status: params.status,
            focusDate: params.focus_date || undefined,
            dueDate: params.due_date || undefined,
            effort: params.effort,
          });
          
          return actionPath;
        },
        'Failed to create action',
        'gtd'
      );

      if (result) {
        showSuccess(`Action "${params.action_name}" created successfully`);
        
        // Update project action count if space is loaded
        if (gtdSpace && gtdSpace.projects) {
          const updatedProjects = gtdSpace.projects.map(project => {
            if (project.path === params.project_path) {
              return {
                ...project,
                action_count: (project.action_count || 0) + 1,
              };
            }
            return project;
          });
          
          setGTDSpace({
            ...gtdSpace,
            projects: updatedProjects,
            total_actions: (gtdSpace.total_actions || 0) + 1,
          });
        }
        
        // Emit custom event to trigger sidebar refresh
        window.dispatchEvent(new CustomEvent('gtd-action-created', {
          detail: { actionPath: result, actionName: params.action_name, projectPath: params.project_path }
        }));
      }
      
      setIsLoading(false);
      return result;
    },
    [gtdSpace, withErrorHandling, showSuccess]
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
   * Load projects from a GTD space
   */
  const loadProjects = useCallback(
    async (spacePath: string) => {
      // Debug: project load
      setIsLoading(true);
      
      const result = await withErrorHandling(
        async () => {
          const projects = await invoke<GTDProject[]>('list_gtd_projects', {
            spacePath: spacePath,
          });
          
          // Loaded projects count
          
          // Calculate total actions
          const totalActions = projects.reduce((sum, project) => sum + (project.action_count || 0), 0);
          
          // Update space state with loaded projects
          setGTDSpace({
            root_path: spacePath,
            is_initialized: true,
            isGTDSpace: true,
            projects,
            total_actions: totalActions,
          });
          
          // State updated
          
          return projects;
        },
        'Failed to load projects',
        'gtd'
      );
      
      setIsLoading(false);
      // Completed project load
      return result || [];
    },
    [withErrorHandling]
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