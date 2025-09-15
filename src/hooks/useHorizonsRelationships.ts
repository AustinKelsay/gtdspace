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
 * Ensure a file path has a markdown extension
 */
const ensureMd = (filename: string): string => {
  // If already has .md or .markdown extension, return as-is
  if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
    return filename;
  }
  // Otherwise append .md
  return `${filename}.md`;
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
                    
                    const linkedTo: string[] = [];
                    
                    // Build linked paths from references
                    Object.entries(references).forEach(([refLevel, refFiles]) => {
                      refFiles.forEach(refFile => {
                        // Convert reference to probable path
                        const levelName = refLevel === 'areas' ? 'Areas of Focus' :
                                        refLevel === 'goals' ? 'Goals' :
                                        refLevel === 'vision' ? 'Vision' :
                                        refLevel === 'purpose' ? 'Purpose & Principles' :
                                        'Projects';
                        const possiblePath = `${spacePath}/${levelName}/${ensureMd(refFile)}`;
                        linkedTo.push(possiblePath);
                      });
                    });
                    
                    const file: HorizonFile = {
                      id: readmePath,
                      name: project.name,
                      path: readmePath,
                      size: 0,
                      last_modified: Date.now(),
                      extension: 'md',
                      horizonLevel: 'Projects',
                      linkedTo,
                      linkedFrom: [],
                      content: project.description || extractContentPreview(content),
                      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
                      status: project.status,
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
                    
                    const linkedTo: string[] = [];
                    
                    // Build linked paths
                    Object.entries(references).forEach(([refLevel, refFiles]) => {
                      refFiles.forEach(refFile => {
                        const levelName = refLevel === 'areas' ? 'Areas of Focus' :
                                        refLevel === 'goals' ? 'Goals' :
                                        refLevel === 'vision' ? 'Vision' :
                                        refLevel === 'purpose' ? 'Purpose & Principles' :
                                        'Projects';

                        if (refLevel === 'projects' && refFile.includes('/')) {
                          // Project reference includes folder name
                          linkedTo.push(`${spacePath}/Projects/${refFile}/README.md`);
                        } else {
                          // Regular file reference
                          const possiblePath = `${spacePath}/${levelName}/${ensureMd(refFile)}`;
                          linkedTo.push(possiblePath);
                        }
                      });
                    });
                    
                    const file: HorizonFile = {
                      ...mdFile,
                      horizonLevel: horizon.name,
                      linkedTo,
                      linkedFrom: [],
                      content: extractContentPreview(content),
                      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
                      status: metadata.status as string || undefined,
                      dueDate: metadata.dueDate as string || undefined
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
  }, [autoLoad]); // eslint-disable-line react-hooks/exhaustive-deps
  
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