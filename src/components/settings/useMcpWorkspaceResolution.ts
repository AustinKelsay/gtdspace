import React from 'react';
import { getMcpWorkspaceAncestors } from '@/utils/mcp-settings';
import type { InvokeWithHandling, WorkspaceResolutionSource } from './mcp-server-settings-contract';

type WorkspaceFallbackCandidate = {
  path: string;
  source: 'last-folder' | 'default-space' | 'platform-default';
};

type WorkspaceResolution = {
  path: string | null;
  source: WorkspaceResolutionSource;
};

const isValidWorkspaceCandidate = async (
  path: string,
  invokeWithHandling: InvokeWithHandling
) => {
  for (const candidate of getMcpWorkspaceAncestors(path)) {
    const isValid = await invokeWithHandling<boolean>(
      'check_is_gtd_space',
      { path: candidate },
      { errorMessage: 'Failed to validate the MCP workspace path.' }
    );

    if (isValid === null) {
      return null;
    }

    if (isValid) {
      return candidate;
    }
  }

  return false;
};

export const useMcpWorkspaceResolution = ({
  workspaceOverride,
  lastFolder,
  defaultSpacePath,
  platformDefaultPath,
  invokeWithHandling,
}: {
  workspaceOverride: string | null;
  lastFolder?: string | null;
  defaultSpacePath?: string | null;
  platformDefaultPath?: string | null;
  invokeWithHandling: InvokeWithHandling;
}) => {
  const [workspaceResolution, setWorkspaceResolution] = React.useState<WorkspaceResolution>({
    path: null,
    source: 'unavailable',
  });
  const [isCheckingWorkspace, setIsCheckingWorkspace] = React.useState(false);
  const [resolvedWorkspaceIsValid, setResolvedWorkspaceIsValid] = React.useState<boolean | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const workspaceValidationRequestRef = React.useRef(0);

  const fallbackWorkspaceCandidates = React.useMemo<WorkspaceFallbackCandidate[]>(
    () =>
      [lastFolder?.trim() || null, defaultSpacePath?.trim() || null, platformDefaultPath?.trim() || null]
        .filter((path): path is string => Boolean(path))
        .map((path) => {
          if (path === lastFolder?.trim()) {
            return { path, source: 'last-folder' as const };
          }
          if (path === defaultSpacePath?.trim()) {
            return { path, source: 'default-space' as const };
          }
          return { path, source: 'platform-default' as const };
        }),
    [defaultSpacePath, lastFolder, platformDefaultPath]
  );

  React.useEffect(() => {
    const requestId = workspaceValidationRequestRef.current + 1;
    workspaceValidationRequestRef.current = requestId;
    let isActive = true;

    const validateWorkspace = async () => {
      if (workspaceOverride) {
        setWorkspaceResolution({ path: workspaceOverride, source: 'override' });
        setIsCheckingWorkspace(true);
        setValidationError(null);
        const resolvedPath = await isValidWorkspaceCandidate(workspaceOverride, invokeWithHandling);

        if (!isActive || workspaceValidationRequestRef.current !== requestId) {
          return;
        }

        if (resolvedPath === null) {
          setResolvedWorkspaceIsValid(null);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }

        if (resolvedPath) {
          setWorkspaceResolution({ path: resolvedPath, source: 'resolved' });
        }
        setResolvedWorkspaceIsValid(Boolean(resolvedPath));
        setValidationError(resolvedPath ? null : 'Workspace path is not a valid GTD space');
        setIsCheckingWorkspace(false);
        return;
      }

      if (fallbackWorkspaceCandidates.length === 0) {
        setWorkspaceResolution({ path: null, source: 'unavailable' });
        setIsCheckingWorkspace(false);
        setResolvedWorkspaceIsValid(null);
        setValidationError(null);
        return;
      }

      setIsCheckingWorkspace(true);
      setValidationError(null);

      for (const candidate of fallbackWorkspaceCandidates) {
        const isValid = await isValidWorkspaceCandidate(candidate.path, invokeWithHandling);
        if (!isActive || workspaceValidationRequestRef.current !== requestId) {
          return;
        }

        if (isValid === null) {
          setWorkspaceResolution({ path: null, source: 'unavailable' });
          setResolvedWorkspaceIsValid(null);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }

        if (isValid) {
          setWorkspaceResolution({ ...candidate, path: isValid });
          setResolvedWorkspaceIsValid(true);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }
      }

      setWorkspaceResolution({ path: null, source: 'unavailable' });
      setResolvedWorkspaceIsValid(false);
      setValidationError('Workspace path is not a valid GTD space');
      setIsCheckingWorkspace(false);
    };

    void validateWorkspace();

    return () => {
      isActive = false;
    };
  }, [fallbackWorkspaceCandidates, invokeWithHandling, workspaceOverride]);

  return {
    workspaceResolution,
    isCheckingWorkspace,
    resolvedWorkspaceIsValid,
    validationError,
  };
};
