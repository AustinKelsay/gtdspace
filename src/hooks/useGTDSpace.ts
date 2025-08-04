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
                console.warn(`Error checking directory ${dirName}:`, error);
                return { dirName, exists: false };
              }
            })
          );
          
          // If all directories exist, we're done
          const allExist = dirChecks.every(check => check.exists);
          if (allExist) {
            console.log('All GTD directories confirmed to exist');
            return;
          }
          
          // Log which directories are still missing
          const missingDirs = dirChecks.filter(check => !check.exists).map(check => check.dirName);
          if (missingDirs.length > 0) {
            console.log(`Waiting for directories: ${missingDirs.join(', ')}`);
          }
          
        } catch (error) {
          console.warn('Error during directory structure check:', error);
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
        console.error('spacePath is empty or undefined');
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
            console.error('Failed to wait for directory structure:', error);
            // Continue anyway - the user can refresh manually if needed
          }
          
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
          });
          
          // Create project object for state update
          const newProject: GTDProject = {
            name: params.project_name,
            description: params.description,
            due_date: params.due_date,
            status: 'Active',
            path: projectPath,
            created_date: new Date().toISOString().split('T')[0],
            action_count: 0,
          };
          
          // Update space state if it exists
          if (gtdSpace) {
            setGTDSpace({
              ...gtdSpace,
              projects: [...(gtdSpace.projects || []), newProject],
            });
          }
          
          return projectPath;
        },
        'Failed to create project',
        'gtd'
      );

      if (result) {
        showSuccess(`Project "${params.project_name}" created successfully`);
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
          // For now, we'll check by trying to list files in the expected directories
          // In the future, we might want a dedicated command for this
          try {
            const requiredDirs = ['Projects', 'Habits', 'Someday Maybe', 'Cabinet'];
            
            // Try to list files in each required directory
            for (const dir of requiredDirs) {
              try {
                await invoke('list_markdown_files', { 
                  path: `${path}/${dir}` 
                });
              } catch {
                // Directory doesn't exist
                return false;
              }
            }
            
            setGTDSpace({
              root_path: path,
              is_initialized: true,
              isGTDSpace: true,
              projects: [], // Will be loaded separately
              total_actions: 0,
            });
            
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
      setIsLoading(true);
      
      const result = await withErrorHandling(
        async () => {
          const projects = await invoke<GTDProject[]>('list_gtd_projects', {
            spacePath: spacePath,
          });
          
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
          
          return projects;
        },
        'Failed to load projects',
        'gtd'
      );
      
      setIsLoading(false);
      return result || [];
    },
    [withErrorHandling]
  );

  return {
    gtdSpace,
    isLoading,
    initializeSpace,
    createProject,
    createAction,
    checkGTDSpace,
    loadProjects,
  };
}