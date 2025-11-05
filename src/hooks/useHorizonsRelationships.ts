/**
 * @fileoverview Hook for loading GTD horizon levels and their relationships
 * Maps connections between Purpose, Vision, Goals, Areas, and Projects
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata, extractHorizonReferences as extractHorizonReferencesUtil } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import type { GTDProject, MarkdownFile } from '@/types';

export interface HorizonFile extends MarkdownFile {
  horizonLevel: string;
  linkedTo: string[]; // Files this links to (lower levels)
  linkedFrom: string[]; // Files that link to this (higher levels)
  content?: string; // First paragraph or description
  tags?: string[];
  status?: string;
  dueDate?: string;
}

export interface HorizonRelationship {
  from: string; // File path
  to: string; // File path
  fromLevel: string;
  toLevel: string;
  fromName: string;
  toName: string;
}

export interface HorizonLevel {
  name: string;
  altitude: string;
  files: HorizonFile[];
  linkedCount: number; // Files with relationships
  unlinkedCount: number; // Files without relationships
}

interface UseHorizonsRelationshipsOptions {
  autoLoad?: boolean;
  includeProjects?: boolean;
  includeCabinet?: boolean;
  includeSomedayMaybe?: boolean;
}

interface UseHorizonsRelationshipsReturn {
  horizons: Record<string, HorizonLevel>;
  relationships: HorizonRelationship[];
  isLoading: boolean;
  error: string | null;
  graph: {
    nodes: Array<{ id: string; label: string; level: string; group: number }>;
    edges: Array<{ from: string; to: string }>;
  };
  loadHorizons: (spacePath: string, projects?: GTDProject[]) => Promise<void>;
  findRelated: (filePath: string) => {
    parents: HorizonFile[];
    children: HorizonFile[];
    siblings: HorizonFile[];
  };
  refresh: () => Promise<void>;
}

const HORIZON_DEFINITIONS = [
  { name: 'Purpose & Principles', altitude: '50,000 ft', order: 1 },
  { name: 'Vision', altitude: '40,000 ft', order: 2 },
  { name: 'Goals', altitude: '30,000 ft', order: 3 },
  { name: 'Areas of Focus', altitude: '20,000 ft', order: 4 },
  { name: 'Projects', altitude: 'Runway', order: 5 },
  { name: 'Someday Maybe', altitude: 'Parking Lot', order: 6 },
  { name: 'Cabinet', altitude: 'Reference', order: 7 }
];

type HorizonReferenceKey = 'projects' | 'areas' | 'goals' | 'vision' | 'purpose';

const HORIZON_DIR_MAP: Record<HorizonReferenceKey, string> = {
  projects: 'Projects',
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles'
};

const ABSOLUTE_PATH_REGEX = /^(?:[A-Za-z]:\/|\/)/;
const VALID_REFERENCE_KEYS: HorizonReferenceKey[] = ['projects', 'areas', 'goals', 'vision', 'purpose'];

const joinPathPreservingUNC = (base: string, ...segments: string[]): string => {
  let acc = base;
  segments.forEach((segment) => {
    if (!segment) return;
    const cleaned = segment.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleaned) return;
    if (!acc) {
      acc = cleaned;
    } else if (acc.endsWith('/')) {
      acc += cleaned;
    } else {
      acc += `/${cleaned}`;
    }
  });
  return acc;
};

/**
 * Extract horizon references from content
 */
const extractHorizonReferences = (content: string, _currentLevel: string) => {
  const extracted = extractHorizonReferencesUtil(content);
  return {
    purpose: extracted.purpose,
    vision: extracted.vision,
    goals: extracted.goals,
    areas: extracted.areas,
    projects: extracted.projects
  };
};

/**
 * Extract content preview from markdown
 */
const extractContentPreview = (content: string): string => {
  const lines = content.split('\n');
  const previewLines: string[] = [];
  let foundContent = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip metadata, headers, and special blocks
    if (trimmed.startsWith('[!') || 
        trimmed.startsWith('#') || 
        trimmed.startsWith('|') ||
        trimmed.startsWith('---')) {
      continue;
    }
    
    if (trimmed) {
      foundContent = true;
      previewLines.push(trimmed);
      if (previewLines.join(' ').length > 150) break;
    } else if (foundContent) {
      break;
    }
  }
  
  return previewLines.join(' ').substring(0, 200);
};

/**
 * Ensure markdown extension for non-project references.
 */
const ensureMarkdownFile = (input: string): string => {
  if (/\.(md|markdown)$/i.test(input)) {
    return input;
  }
  return `${input}.md`;
};

/**
 * Normalize project references to README paths.
 */
const ensureProjectReadme = (input: string): string => {
  const normalized = input.replace(/\/+$/, '');

  const lower = normalized.toLowerCase();
  if (lower.endsWith('/readme.md') || lower.endsWith('/readme.markdown')) {
    return normalized;
  }
  if (/\.(md|markdown)$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/README.md`;
};

/**
 * Resolve a horizon reference token into a fully-qualified markdown path.
 */
const resolveReferencePath = (
  spacePath: string,
  refLevel: HorizonReferenceKey,
  rawValue: string
): string | null => {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\\/g, '/');
  const isAbsolute = ABSOLUTE_PATH_REGEX.test(normalized);
  const dirName = HORIZON_DIR_MAP[refLevel];

  if (refLevel === 'projects') {
    if (isAbsolute) {
      return ensureProjectReadme(normalized);
    }

    let relative = normalized.replace(/^\/+/, '');
    if (relative.toLowerCase().startsWith('projects/')) {
      relative = relative.slice('Projects/'.length);
    }

    const ensured = ensureProjectReadme(relative);
    return joinPathPreservingUNC(spacePath, dirName, ensured);
  }

  if (isAbsolute) {
    return ensureMarkdownFile(normalized);
  }

  let relative = normalized.replace(/^\/+/, '');

  const dirLower = dirName.toLowerCase();
  if (relative.toLowerCase().startsWith(`${dirLower}/`)) {
    relative = relative.slice(dirLower.length + 1);
  }

  const ensured = ensureMarkdownFile(relative);
  return joinPathPreservingUNC(spacePath, dirName, ensured);
};

/**
 * Derive a status-like value for display purposes based on horizon level.
 */
const deriveStatusForLevel = (levelName: string, metadata: Record<string, unknown>): string | undefined => {
  switch (levelName) {
    case 'Projects':
      return (metadata.projectStatus as string) || (metadata.status as string) || undefined;
    case 'Goals':
      return (metadata.goalStatus as string) || (metadata.status as string) || undefined;
    case 'Areas of Focus':
      return (metadata.areaStatus as string) || (metadata.status as string) || undefined;
    case 'Vision':
      return (metadata.visionHorizon as string) || (metadata.status as string) || undefined;
    default:
      return (metadata.status as string) || undefined;
  }
};

/**
 * Build bidirectional relationships from references
 */
const buildRelationships = (
  horizonFiles: Record<string, HorizonFile[]>,
  allFiles: Map<string, HorizonFile>
): HorizonRelationship[] => {
  const relationships: HorizonRelationship[] = [];
  const processedPairs = new Set<string>();
  
  // Process each horizon level
  Object.entries(horizonFiles).forEach(([level, files]) => {
    files.forEach(file => {
      // Process each type of reference
      file.linkedTo.forEach(linkedPath => {
        const pairKey = `${file.path}::${linkedPath}`;
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);
        
        const linkedFile = allFiles.get(linkedPath);
        if (linkedFile) {
          relationships.push({
            from: file.path,
            to: linkedPath,
            fromLevel: level,
            toLevel: linkedFile.horizonLevel,
            fromName: file.name,
            toName: linkedFile.name
          });
          
          // Update linkedFrom on the target
          if (!linkedFile.linkedFrom.includes(file.path)) {
            linkedFile.linkedFrom.push(file.path);
          }
        }
      });
    });
  });
  
  return relationships;
};

export function useHorizonsRelationships(
  options: UseHorizonsRelationshipsOptions = {}
): UseHorizonsRelationshipsReturn {
  const {
    autoLoad = false,
    includeProjects = true,
    includeCabinet = false,
    includeSomedayMaybe = true
  } = options;
  
  const [horizons, setHorizons] = useState<Record<string, HorizonLevel>>({});
  const [relationships, setRelationships] = useState<HorizonRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedSpacePath, setCachedSpacePath] = useState<string>('');
  const [cachedProjects, setCachedProjects] = useState<GTDProject[]>([]);
  const [allFilesMap, setAllFilesMap] = useState<Map<string, HorizonFile>>(new Map());
  
  const loadHorizons = useCallback(async (spacePath: string, projects?: GTDProject[]) => {
    setIsLoading(true);
    setError(null);
    setCachedSpacePath(spacePath);
    if (projects) setCachedProjects(projects);
    
    try {
      const horizonFiles: Record<string, HorizonFile[]> = {};
      const fileMap = new Map<string, HorizonFile>();
      
      // Define which horizons to load
      const horizonsToLoad = HORIZON_DEFINITIONS.filter(def => {
        if (def.name === 'Projects' && !includeProjects) return false;
        if (def.name === 'Cabinet' && !includeCabinet) return false;
        if (def.name === 'Someday Maybe' && !includeSomedayMaybe) return false;
        return true;
      });
      
      // Load files for each horizon level
      await Promise.all(
        horizonsToLoad.map(async (horizon) => {
          const horizonPath = `${spacePath}/${horizon.name}`;
          
          try {
            let files: HorizonFile[] = [];
            
            if (horizon.name === 'Projects' && projects) {
              // Use provided projects
              files = await Promise.all(
                projects.map(async (project) => {
                  try {
                    const readmePath = `${project.path}/README.md`;
                    const content = await readFileText(readmePath);
                    const metadata = extractMetadata(content);
                    const references = extractHorizonReferences(content, 'Projects');
                    const linkedSet = new Set<string>();

                    Object.entries(references).forEach(([refLevel, refFiles]) => {
                      if (!Array.isArray(refFiles) || refFiles.length === 0) {
                        return;
                      }
                      const keyStr = refLevel as string;
                      if (!VALID_REFERENCE_KEYS.includes(keyStr as HorizonReferenceKey)) {
                        return;
                      }
                      const key = keyStr as HorizonReferenceKey;
                      refFiles.forEach(refFile => {
                        const resolved = resolveReferencePath(spacePath, key, refFile);
                        if (resolved) {
                          linkedSet.add(resolved);
                        }
                      });
                    });
                    
                    const file: HorizonFile = {
                      id: readmePath,
                      name: project.name,
                      path: readmePath,
                      size: 0,
                      last_modified: Math.floor(Date.now() / 1000),
                      extension: 'md',
                      horizonLevel: 'Projects',
                      linkedTo: Array.from(linkedSet),
                      linkedFrom: [],
                      content: project.description || extractContentPreview(content),
                      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
                      status: project.status ?? deriveStatusForLevel('Projects', metadata),
                      dueDate: project.dueDate || undefined
                    };
                    
                    return file;
                  } catch (err) {
                    console.error(`Failed to load project ${project.name}:`, err);
                    return null;
                  }
                })
              );
              
              files = files.filter((f): f is HorizonFile => f !== null);
            } else {
              // Load markdown files from directory
              const markdownFiles = await safeInvoke<MarkdownFile[]>(
                'list_markdown_files',
                { path: horizonPath },
                []
              );
              
              files = await Promise.all(
                markdownFiles.map(async (mdFile) => {
                  try {
                    const content = await readFileText(mdFile.path);
                    const metadata = extractMetadata(content);
                    const references = extractHorizonReferences(content, horizon.name);
                    
                    const linkedSet = new Set<string>();

                    Object.entries(references).forEach(([refLevel, refFiles]) => {
                      if (!Array.isArray(refFiles) || refFiles.length === 0) {
                        return;
                      }
                      const keyStr = refLevel as string;
                      if (!VALID_REFERENCE_KEYS.includes(keyStr as HorizonReferenceKey)) {
                        return;
                      }
                      const key = keyStr as HorizonReferenceKey;
                      refFiles.forEach(refFile => {
                        const resolved = resolveReferencePath(spacePath, key, refFile);
                        if (resolved) {
                          linkedSet.add(resolved);
                        }
                      });
                    });

                    const derivedStatus = deriveStatusForLevel(horizon.name, metadata as Record<string, unknown>);
                    const derivedDueDate =
                      horizon.name === 'Goals'
                        ? (metadata.goalTargetDate as string) ||
                          (metadata.targetDate as string) ||
                          (metadata.dueDate as string) ||
                          undefined
                        : (metadata.dueDate as string) || undefined;
                    
                    const file: HorizonFile = {
                      ...mdFile,
                      horizonLevel: horizon.name,
                      linkedTo: Array.from(linkedSet),
                      linkedFrom: [],
                      content: extractContentPreview(content),
                      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
                      status: derivedStatus,
                      dueDate: derivedDueDate
                    };
                    
                    return file;
                  } catch (err) {
                    console.error(`Failed to load file ${mdFile.name}:`, err);
                    return null;
                  }
                })
              );
              
              files = files.filter((f): f is HorizonFile => f !== null);
            }
            
            horizonFiles[horizon.name] = files;
            files.forEach(file => fileMap.set(file.path, file));
          } catch (err) {
            console.error(`Failed to load horizon ${horizon.name}:`, err);
            horizonFiles[horizon.name] = [];
          }
        })
      );
      
      // Build relationships
      const allRelationships = buildRelationships(horizonFiles, fileMap);
      
      // Create horizon level summaries
      const horizonLevels: Record<string, HorizonLevel> = {};
      
      horizonsToLoad.forEach(horizon => {
        const files = horizonFiles[horizon.name] || [];
        const linkedCount = files.filter(f => f.linkedTo.length > 0 || f.linkedFrom.length > 0).length;
        const unlinkedCount = files.length - linkedCount;
        
        horizonLevels[horizon.name] = {
          name: horizon.name,
          altitude: horizon.altitude,
          files,
          linkedCount,
          unlinkedCount
        };
      });
      
      setHorizons(horizonLevels);
      setRelationships(allRelationships);
      setAllFilesMap(fileMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load horizons');
      setHorizons({});
      setRelationships([]);
    } finally {
      setIsLoading(false);
    }
  }, [includeProjects, includeCabinet, includeSomedayMaybe]);
  
  const findRelated = useCallback((filePath: string) => {
    const file = allFilesMap.get(filePath);
    if (!file) {
      return { parents: [], children: [], siblings: [] };
    }
    
    const parents = file.linkedFrom
      .map(path => allFilesMap.get(path))
      .filter((f): f is HorizonFile => f !== undefined);
    
    const children = file.linkedTo
      .map(path => allFilesMap.get(path))
      .filter((f): f is HorizonFile => f !== undefined);
    
    // Siblings are files at the same level that share a parent
    const parentPaths = new Set(file.linkedFrom);
    const siblings = Array.from(allFilesMap.values())
      .filter(f => 
        f.horizonLevel === file.horizonLevel &&
        f.path !== file.path &&
        f.linkedFrom.some(p => parentPaths.has(p))
      );
    
    return { parents, children, siblings };
  }, [allFilesMap]);
  
  const refresh = useCallback(async () => {
    if (cachedSpacePath) {
      await loadHorizons(cachedSpacePath, cachedProjects);
    }
  }, [cachedSpacePath, cachedProjects, loadHorizons]);
  
  const graph = useMemo(() => {
    const nodes = Array.from(allFilesMap.values()).map((file) => ({
      id: file.path,
      label: file.name.replace('.md', ''),
      level: file.horizonLevel,
      group: HORIZON_DEFINITIONS.findIndex(h => h.name === file.horizonLevel)
    }));
    
    const edges = relationships.map(rel => ({
      from: rel.from,
      to: rel.to
    }));
    
    return { nodes, edges };
  }, [allFilesMap, relationships]);
  
  useEffect(() => {
    if (autoLoad && cachedSpacePath) {
      loadHorizons(cachedSpacePath, cachedProjects);
    }
  }, [autoLoad, cachedSpacePath, cachedProjects, loadHorizons]);
  
  return {
    horizons,
    relationships,
    isLoading,
    error,
    graph,
    loadHorizons,
    findRelated,
    refresh
  };
}
