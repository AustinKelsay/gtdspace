/**
 * @fileoverview Dashboard Horizons Tab - Hierarchical view of GTD levels with relationships
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronRight,
  Compass,
  Eye,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  MapPin,
  Mountain,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  TreePine
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { GTDProject, MarkdownFile } from '@/types';
import { cn } from '@/lib/utils';

// Horizon level definitions
interface HorizonLevel {
  name: string;
  altitude: string;
  icon: React.ElementType;
  color: string;
  description: string;
  order: number;
}

const HORIZON_LEVELS: HorizonLevel[] = [
  {
    name: 'Purpose & Principles',
    altitude: '50,000 ft',
    icon: Star,
    color: 'text-purple-600',
    description: 'Life mission and core values',
    order: 1
  },
  {
    name: 'Vision',
    altitude: '40,000 ft',
    icon: Eye,
    color: 'text-blue-600',
    description: '3-5 year aspirational picture',
    order: 2
  },
  {
    name: 'Goals',
    altitude: '30,000 ft',
    icon: Target,
    color: 'text-green-600',
    description: '1-2 year objectives',
    order: 3
  },
  {
    name: 'Areas of Focus',
    altitude: '20,000 ft',
    icon: Compass,
    color: 'text-orange-600',
    description: 'Ongoing responsibilities',
    order: 4
  },
  {
    name: 'Projects',
    altitude: 'Runway',
    icon: MapPin,
    color: 'text-red-600',
    description: 'Current active projects',
    order: 5
  }
];

// Extended file with relationships
interface HorizonFile extends MarkdownFile {
  linkedTo?: string[]; // Files this links to (lower levels)
  linkedFrom?: string[]; // Files that link to this (higher levels)
  horizonLevel?: string;
  // Project-specific fields when file is a project
  status?: string;
  action_count?: number;
  description?: string;
  dueDate?: string | null;
  createdDateTime?: string;
}

interface HorizonRelationship {
  from: string;
  to: string;
  fromLevel: string;
  toLevel: string;
}

interface DashboardHorizonsProps {
  horizonFiles: Record<string, HorizonFile[]>;
  projects: GTDProject[];
  relationships?: HorizonRelationship[];
  isLoading?: boolean;
  onSelectFile?: (file: HorizonFile) => void;
  onCreateFile?: (horizon: string) => void;
  className?: string;
}

export const DashboardHorizons: React.FC<DashboardHorizonsProps> = ({
  horizonFiles,
  projects,
  relationships = [],
  isLoading = false,
  onSelectFile,
  onCreateFile,
  className = ''
}) => {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(['Projects']));
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyLinked, setShowOnlyLinked] = useState(false);

  // Toggle level expansion
  const toggleLevel = useCallback((levelName: string) => {
    setExpandedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(levelName)) {
        newSet.delete(levelName);
      } else {
        newSet.add(levelName);
      }
      return newSet;
    });
  }, []);

  // Toggle file expansion
  const toggleFile = useCallback((filePath: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  // Filter files based on search
  const filteredHorizonFiles = useMemo(() => {
    if (!searchQuery && !showOnlyLinked) return horizonFiles;

    const filtered: Record<string, HorizonFile[]> = {};
    
    Object.entries(horizonFiles).forEach(([level, files]) => {
      let levelFiles = [...files];
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        levelFiles = levelFiles.filter(file =>
          file.name.toLowerCase().includes(query)
        );
      }
      
      // Linked filter
      if (showOnlyLinked) {
        levelFiles = levelFiles.filter(file =>
          (file.linkedTo && file.linkedTo.length > 0) ||
          (file.linkedFrom && file.linkedFrom.length > 0)
        );
      }
      
      if (levelFiles.length > 0) {
        filtered[level] = levelFiles;
      }
    });
    
    return filtered;
  }, [horizonFiles, searchQuery, showOnlyLinked]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalFiles = 0;
    let linkedFiles = 0;
    const levelCounts: Record<string, number> = {};
    
    Object.entries(horizonFiles).forEach(([level, files]) => {
      totalFiles += files.length;
      linkedFiles += files.filter(f => 
        (f.linkedTo && f.linkedTo.length > 0) ||
        (f.linkedFrom && f.linkedFrom.length > 0)
      ).length;
      levelCounts[level] = files.length;
    });
    
    // Add projects
    levelCounts['Projects'] = projects.length;
    totalFiles += projects.length;
    
    return {
      totalFiles,
      linkedFiles,
      levelCounts,
      linkageRate: totalFiles > 0 ? Math.round((linkedFiles / totalFiles) * 100) : 0
    };
  }, [horizonFiles, projects]);

  // Get relationships for a file
  const getFileRelationships = useCallback((filePath: string) => {
    return {
      linkedTo: relationships.filter(r => r.from === filePath),
      linkedFrom: relationships.filter(r => r.to === filePath)
    };
  }, [relationships]);

  // Render horizon level
  const renderHorizonLevel = (level: HorizonLevel) => {
    const isExpanded = expandedLevels.has(level.name);
    const files = level.name === 'Projects' 
      ? projects.map(p => ({ 
          id: p.path,
          name: p.name, 
          path: p.path,
          size: 0,
          last_modified: Date.now(),
          extension: '.md',
          description: p.description,
          dueDate: p.dueDate,
          status: p.status,
          createdDateTime: p.createdDateTime,
          action_count: p.action_count
        } as HorizonFile))
      : (filteredHorizonFiles[level.name] || []);
    const fileCount = files.length;
    const LevelIcon = level.icon;

    return (
      <Card key={level.name} className="overflow-hidden">
        <Collapsible open={isExpanded} onOpenChange={() => toggleLevel(level.name)}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-accent transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", 
                    level.color === 'text-purple-600' && "from-purple-600/20 to-purple-600/10",
                    level.color === 'text-blue-600' && "from-blue-600/20 to-blue-600/10",
                    level.color === 'text-green-600' && "from-green-600/20 to-green-600/10",
                    level.color === 'text-orange-600' && "from-orange-600/20 to-orange-600/10",
                    level.color === 'text-red-600' && "from-red-600/20 to-red-600/10"
                  )}>
                    <LevelIcon className={cn("h-5 w-5", level.color)} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{level.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {level.altitude}
                      </Badge>
                      <Badge>{fileCount}</Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      {level.description}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              {fileCount === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No items at this level</p>
                  {level.name !== 'Projects' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => onCreateFile?.(level.name)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create {level.name.slice(0, -1)}
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    {files.map(file => renderHorizonFile(file, level))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  // Render individual file/project
  const renderHorizonFile = (file: HorizonFile, level: HorizonLevel) => {
    const isExpanded = expandedFiles.has(file.path);
    const relationships = getFileRelationships(file.path);
    const hasRelationships = relationships.linkedTo.length > 0 || relationships.linkedFrom.length > 0;

    return (
      <div
        key={file.path}
        className={cn(
          "border rounded-lg p-3 hover:bg-accent transition-colors",
          hasRelationships && "border-primary/30"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {hasRelationships && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => toggleFile(file.path)}
                >
                  <ChevronRight className={cn(
                    "h-3 w-3 transition-transform",
                    isExpanded && "rotate-90"
                  )} />
                </Button>
              )}
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span 
                className="font-medium cursor-pointer hover:text-primary"
                onClick={() => onSelectFile?.(file)}
              >
                {file.name.replace('.md', '')}
              </span>
              {hasRelationships && (
                <Link2 className="h-3 w-3 text-primary" />
              )}
            </div>

            {/* Show relationships if expanded */}
            {isExpanded && hasRelationships && (
              <div className="mt-3 ml-6 space-y-2 text-sm">
                {relationships.linkedTo.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Links to:</p>
                    <div className="space-y-1">
                      {relationships.linkedTo.map((rel, idx) => {
                        const targetLevel = HORIZON_LEVELS.find(l => l.name === rel.toLevel);
                        const TargetIcon = targetLevel?.icon || FileText;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <TargetIcon className={cn("h-3 w-3", targetLevel?.color)} />
                            <span className="text-muted-foreground">{rel.toLevel}:</span>
                            <span className="font-medium">{rel.to}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {relationships.linkedFrom.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Linked from:</p>
                    <div className="space-y-1">
                      {relationships.linkedFrom.map((rel, idx) => {
                        const sourceLevel = HORIZON_LEVELS.find(l => l.name === rel.fromLevel);
                        const SourceIcon = sourceLevel?.icon || FileText;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <SourceIcon className={cn("h-3 w-3", sourceLevel?.color)} />
                            <span className="text-muted-foreground">{rel.fromLevel}:</span>
                            <span className="font-medium">{rel.from}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project-specific badges */}
          {level.name === 'Projects' && 'status' in file && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {file.status}
              </Badge>
              {file.action_count && (
                <Badge variant="secondary" className="text-xs">
                  {file.action_count} actions
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{Object.keys(HORIZON_LEVELS).length}</span>
            </div>
            <p className="text-sm font-medium">Horizon Levels</p>
            <p className="text-xs text-muted-foreground mt-1">From runway to 50,000 ft</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.totalFiles}</span>
            </div>
            <p className="text-sm font-medium">Total Items</p>
            <p className="text-xs text-muted-foreground mt-1">Across all levels</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Link2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.linkedFiles}</span>
            </div>
            <p className="text-sm font-medium">Linked Items</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.linkageRate}% connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FolderOpen className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{projects.filter(p => p.status === 'in-progress').length}</span>
            </div>
            <p className="text-sm font-medium">Active Projects</p>
            <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all horizons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Button
          variant={showOnlyLinked ? "default" : "outline"}
          onClick={() => setShowOnlyLinked(!showOnlyLinked)}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Linked Only
        </Button>
      </div>

      {/* Horizon pyramid visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5" />
            GTD Horizons of Focus
          </CardTitle>
          <CardDescription>
            Navigate your complete productivity system from 50,000 ft to runway
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Visual pyramid */}
          <div className="mb-6">
            <div className="relative">
              {HORIZON_LEVELS.map((level, index) => {
                const width = 100 - (index * 15);
                const LevelIcon = level.icon;
                const count = stats.levelCounts[level.name] || 0;
                
                return (
                  <div
                    key={level.name}
                    className="relative mx-auto mb-1 rounded transition-all hover:scale-105 cursor-pointer"
                    style={{ width: `${width}%` }}
                    onClick={() => toggleLevel(level.name)}
                  >
                    <div className={cn(
                      "p-3 rounded-lg flex items-center justify-between",
                      "bg-gradient-to-r",
                      level.color === 'text-purple-600' && "from-purple-100 to-purple-50 dark:from-purple-950/50 dark:to-purple-950/20",
                      level.color === 'text-blue-600' && "from-blue-100 to-blue-50 dark:from-blue-950/50 dark:to-blue-950/20",
                      level.color === 'text-green-600' && "from-green-100 to-green-50 dark:from-green-950/50 dark:to-green-950/20",
                      level.color === 'text-orange-600' && "from-orange-100 to-orange-50 dark:from-orange-950/50 dark:to-orange-950/20",
                      level.color === 'text-red-600' && "from-red-100 to-red-50 dark:from-red-950/50 dark:to-red-950/20"
                    )}>
                      <div className="flex items-center gap-2">
                        <LevelIcon className={cn("h-4 w-4", level.color)} />
                        <span className="font-medium text-sm">{level.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {level.altitude}
                        </Badge>
                        {count > 0 && (
                          <Badge className="text-xs">{count}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horizon levels list */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-32 bg-muted rounded animate-pulse mt-2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              HORIZON_LEVELS.map(level => renderHorizonLevel(level))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relationship graph placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TreePine className="h-5 w-5" />
            Relationship Map
          </CardTitle>
          <CardDescription>
            Visual connections between your horizons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Interactive relationship graph</p>
              <p className="text-xs mt-1">Coming soon...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardHorizons;