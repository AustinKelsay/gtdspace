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
   * Initialize a new GTD space
   */
  const initializeSpace = useCallback(
    async (spacePath: string) => {
      setIsLoading(true);
      
      const result = await withErrorHandling(
        async () => {
          const message = await invoke<string>('initialize_gtd_space', {
            spacePath,
          });
          
          // Update state with initialized space
          setGTDSpace({
            root_path: spacePath,
            is_initialized: true,
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
    [withErrorHandling, showSuccess]
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