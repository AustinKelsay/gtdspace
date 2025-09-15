/**
 * @fileoverview Dashboard Projects Tab - Comprehensive project portfolio view
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  Compass,
  Edit,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';
import { cn } from '@/lib/utils';
import { formatCompactDate } from '@/utils/date-formatting';

// Use unified type from hook to avoid drift

interface DashboardProjectsProps {
  projects: ProjectWithMetadata[];
  isLoading?: boolean;
  onSelectProject?: (project: ProjectWithMetadata) => void;
  onCreateProject?: () => void;
  onEditProject?: (project: ProjectWithMetadata) => void;
  // Prefer onCompleteProject; onArchiveProject kept for backward-compat
  onCompleteProject?: (project: ProjectWithMetadata) => void;
  onArchiveProject?: (project: ProjectWithMetadata) => void;
  onAddAction?: (project: ProjectWithMetadata) => void;
}

// Status options
const STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', icon: CircleDot, color: 'text-blue-600' },
  { value: 'waiting', label: 'Waiting', icon: Clock, color: 'text-yellow-600' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-600' }
];

// Sort options
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'created', label: 'Created Date' },
  { value: 'actionCount', label: 'Action Count' },
  { value: 'completion', label: 'Completion %' },
  { value: 'status', label: 'Status' }
];

// View modes
type ViewMode = 'grid' | 'list' | 'kanban';

export const DashboardProjects: React.FC<DashboardProjectsProps> = ({
  projects,
  isLoading = false,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onCompleteProject,
  onArchiveProject,
  onAddAction
}) => {
  const parseLocal = (d: string) => {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(d);
  };
  const isPastDueLocal = (due?: string | null, status?: string) => {
    if (!due || status === 'completed') return false;
    const dt = parseLocal(due);
    if (isNaN(dt.getTime())) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return dueStart < today;
  };
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [hasDeadlineFilter, setHasDeadlineFilter] = useState<boolean | null>(null);
  const [hasHorizonsFilter, setHasHorizonsFilter] = useState<boolean | null>(null);
  const [completionRangeFilter, setCompletionRangeFilter] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(project => statusFilter.includes(project.status));
    }

    // Has deadline filter
    if (hasDeadlineFilter !== null) {
      filtered = filtered.filter(project => 
        hasDeadlineFilter ? !!project.dueDate : !project.dueDate
      );
    }

    // Has horizons filter
    if (hasHorizonsFilter !== null) {
      filtered = filtered.filter(project => {
        const hasHorizons = (project.linkedAreas && project.linkedAreas.length > 0) ||
                           (project.linkedGoals && project.linkedGoals.length > 0) ||
                           (project.linkedVision && project.linkedVision.length > 0) ||
                           (project.linkedPurpose && project.linkedPurpose.length > 0);
        return hasHorizonsFilter ? hasHorizons : !hasHorizons;
      });
    }

    // Completion range filter
    filtered = filtered.filter(project => {
      const completion = project.completionPercentage || 0;
      return completion >= completionRangeFilter[0] && completion <= completionRangeFilter[1];
    });

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) compareValue = 0;
          else if (!a.dueDate) compareValue = 1;
          else if (!b.dueDate) compareValue = -1;
          else compareValue = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'created':
          compareValue = new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime();
          break;
        case 'actionCount':
          compareValue = (a.actionStats?.total || 0) - (b.actionStats?.total || 0);
          break;
        case 'completion':
          compareValue = (a.completionPercentage || 0) - (b.completionPercentage || 0);
          break;
        case 'status': {
          const order: Record<string, number> = { 'in-progress': 0, 'waiting': 1, 'completed': 2 };
          const aOrder = order[a.status] ?? 99;
          const bOrder = order[b.status] ?? 99;
          compareValue = aOrder - bOrder;
          break;
        }
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, hasDeadlineFilter, hasHorizonsFilter, completionRangeFilter, sortBy, sortOrder]);

  // Group projects by status for kanban view
  const projectsByStatus = useMemo(() => {
    const grouped: Record<string, ProjectWithMetadata[]> = {
      'in-progress': [],
      'waiting': [],
      'completed': []
    };

    filteredProjects.forEach(project => {
      if (grouped[project.status]) {
        grouped[project.status].push(project);
      }
    });

    return grouped;
  }, [filteredProjects]);

  // Toggle project expansion
  const toggleProjectExpansion = useCallback((projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter([]);
    setHasDeadlineFilter(null);
    setHasHorizonsFilter(null);
    setCompletionRangeFilter([0, 100]);
  }, []);

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (statusFilter.length > 0) count++;
    if (hasDeadlineFilter !== null) count++;
    if (hasHorizonsFilter !== null) count++;
    if (completionRangeFilter[0] > 0 || completionRangeFilter[1] < 100) count++;
    return count;
  }, [searchQuery, statusFilter, hasDeadlineFilter, hasHorizonsFilter, completionRangeFilter]);

  // Use shared date formatting utility
  const formatDate = formatCompactDate;

  // Get status display
  const getStatusDisplay = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option || { icon: Circle, color: 'text-gray-400', label: status };
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const byStatus = STATUS_OPTIONS.reduce((acc, status) => {
      acc[status.value] = filteredProjects.filter(p => p.status === status.value).length;
      return acc;
    }, {} as Record<string, number>);
    
    const overdue = filteredProjects.filter(p => {
      if (!p.dueDate || p.status === 'completed') return false;
      return new Date(p.dueDate) < new Date();
    }).length;

    const withHorizons = filteredProjects.filter(p =>
      (p.linkedAreas && p.linkedAreas.length > 0) ||
      (p.linkedGoals && p.linkedGoals.length > 0) ||
      (p.linkedVision && p.linkedVision.length > 0) ||
      (p.linkedPurpose && p.linkedPurpose.length > 0)
    ).length;

    const avgCompletion = filteredProjects.length > 0
      ? Math.round(filteredProjects.reduce((acc, p) => acc + (p.completionPercentage || 0), 0) / filteredProjects.length)
      : 0;

    return { total, byStatus, overdue, withHorizons, avgCompletion };
  }, [filteredProjects]);

  // Render project card
  const renderProjectCard = (project: ProjectWithMetadata) => {
    const statusDisplay = getStatusDisplay(project.status);
    const StatusIcon = statusDisplay.icon;
    const isOverdue = isPastDueLocal(project.dueDate, project.status);
    const isExpanded = expandedProjects.has(project.path);
    
    return (
      <Card 
        key={project.path}
        className={cn(
          "transition-all hover:shadow-lg",
          isOverdue && "border-destructive/50"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                {project.name}
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {project.description}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelectProject?.(project)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditProject?.(project)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddAction?.(project)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => (onCompleteProject || onArchiveProject)?.(project)}
                  className="text-green-600"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status and Due Date */}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs">
              <StatusIcon className={cn("h-3 w-3 mr-1", statusDisplay.color)} />
              {statusDisplay.label}
            </Badge>
            {project.dueDate && (
              <Badge 
                variant={isOverdue ? "destructive" : "outline"} 
                className="text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(project.dueDate)}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{project.completionPercentage || 0}%</span>
            </div>
            <Progress value={project.completionPercentage || 0} className="h-2" />
          </div>

          {/* Action Stats */}
          {project.actionStats && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actions:</span>
                <span className="font-medium">{project.actionStats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Complete:</span>
                <span className="font-medium text-green-600">{project.actionStats.completed}</span>
              </div>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created:</span>
            <span>{formatDate(project.createdDateTime)}</span>
          </div>

          {/* Horizons */}
          <Collapsible open={isExpanded} onOpenChange={() => toggleProjectExpansion(project.path)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between p-0 h-auto">
                <span className="text-xs text-muted-foreground">Linked Horizons</span>
                <ChevronRight className={cn(
                  "h-3 w-3 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1">
              {project.linkedAreas && project.linkedAreas.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Compass className="h-3 w-3 text-orange-600" />
                  <span className="text-muted-foreground">Areas:</span>
                  <div className="flex gap-1 flex-wrap">
                    {project.linkedAreas.map(area => (
                      <Badge key={area} variant="secondary" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.linkedGoals && project.linkedGoals.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Target className="h-3 w-3 text-green-600" />
                  <span className="text-muted-foreground">Goals:</span>
                  <div className="flex gap-1 flex-wrap">
                    {project.linkedGoals.map(goal => (
                      <Badge key={goal} variant="secondary" className="text-xs">
                        {goal}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.linkedVision && project.linkedVision.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Eye className="h-3 w-3 text-blue-600" />
                  <span className="text-muted-foreground">Vision:</span>
                  <div className="flex gap-1 flex-wrap">
                    {project.linkedVision.map(vision => (
                      <Badge key={vision} variant="secondary" className="text-xs">
                        {vision}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.linkedPurpose && project.linkedPurpose.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Star className="h-3 w-3 text-purple-600" />
                  <span className="text-muted-foreground">Purpose:</span>
                  <div className="flex gap-1 flex-wrap">
                    {project.linkedPurpose.map(purpose => (
                      <Badge key={purpose} variant="secondary" className="text-xs">
                        {purpose}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {!project.linkedAreas?.length && !project.linkedGoals?.length && !project.linkedVision?.length && !project.linkedPurpose?.length && (
                <p className="text-xs text-muted-foreground italic">No horizon links</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onSelectProject?.(project)}
            >
              <FileText className="h-3 w-3 mr-1" />
              Open
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onAddAction?.(project)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Action
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4">
        {/* Search and controls */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(activeFilterCount > 0 && "border-primary")}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={cn(sortBy === option.value && "bg-accent")}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode selector */}
          <div className="flex gap-1 border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="px-3"
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="px-3"
            >
              List
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="px-3"
            >
              Kanban
            </Button>
          </div>

          <Button onClick={onCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Status filter */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {statusFilter.length > 0 ? `${statusFilter.length} selected` : 'Any'}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-2">
                      {STATUS_OPTIONS.map(status => (
                        <div key={status.value} className="flex items-center space-x-2 p-2">
                          <input
                            type="checkbox"
                            id={`status-${status.value}`}
                            checked={statusFilter.includes(status.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStatusFilter([...statusFilter, status.value]);
                              } else {
                                setStatusFilter(statusFilter.filter(s => s !== status.value));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`status-${status.value}`} className="flex items-center gap-2 cursor-pointer">
                            <status.icon className={cn("h-4 w-4", status.color)} />
                            {status.label}
                          </Label>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Has deadline filter */}
                <div className="space-y-2">
                  <Label>Has Deadline</Label>
                  <Select 
                    value={hasDeadlineFilter === null ? 'any' : hasDeadlineFilter ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      if (value === 'any') setHasDeadlineFilter(null);
                      else setHasDeadlineFilter(value === 'yes');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Has deadline</SelectItem>
                      <SelectItem value="no">No deadline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Has horizons filter */}
                <div className="space-y-2">
                  <Label>Has Horizons</Label>
                  <Select 
                    value={hasHorizonsFilter === null ? 'any' : hasHorizonsFilter ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      if (value === 'any') setHasHorizonsFilter(null);
                      else setHasHorizonsFilter(value === 'yes');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Linked to horizons</SelectItem>
                      <SelectItem value="no">No horizon links</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Completion range filter */}
                <div className="space-y-2">
                  <Label>Completion %</Label>
                  <div className="space-y-1">
                    <Slider
                      value={completionRangeFilter}
                      onValueChange={(value) => setCompletionRangeFilter(value as [number, number])}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{completionRangeFilter[0]}%</span>
                      <span>{completionRangeFilter[1]}%</span>
                    </div>
                  </div>
                </div>

                {/* Clear filters */}
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear all
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats bar */}
        <div className="flex gap-4 text-sm">
          <Badge variant="outline">{stats.total} projects</Badge>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">{stats.overdue} overdue</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>{stats.avgCompletion}% avg completion</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>{stats.withHorizons} with horizons</span>
          </div>
        </div>
      </div>

      {/* Projects display */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[250px]">
              <CardContent className="p-6 space-y-3">
                <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-2 w-full bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {projects.length === 0 ? 'No projects found' : 'No projects match your filters'}
            </p>
            {projects.length === 0 && (
              <Button onClick={onCreateProject} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => renderProjectCard(project))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredProjects.map(project => {
                    const statusDisplay = getStatusDisplay(project.status);
                    const StatusIcon = statusDisplay.icon;
                    const isOverdue = isPastDueLocal(project.dueDate, project.status);
                    
                    return (
                      <div 
                        key={project.path}
                        className="p-4 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => onSelectProject?.(project)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{project.name}</span>
                              <Badge variant="outline" className="text-xs">
                                <StatusIcon className={cn("h-3 w-3 mr-1", statusDisplay.color)} />
                                {statusDisplay.label}
                              </Badge>
                              {project.dueDate && (
                                <Badge
                                  variant={isOverdue ? "destructive" : "outline"}
                                  className="text-xs"
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDate(project.dueDate)}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(project.createdDateTime)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {project.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {project.actionStats?.completed || 0}/{project.actionStats?.total || 0}
                              </div>
                              <div className="text-xs text-muted-foreground">actions</div>
                            </div>
                            <div className="w-24">
                              <Progress value={project.completionPercentage || 0} className="h-2" />
                              <div className="text-xs text-muted-foreground text-center mt-1">
                                {project.completionPercentage || 0}%
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditProject?.(project)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAddAction?.(project)}>
                                  Add Action
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => (onCompleteProject || onArchiveProject)?.(project)}
                                  className="text-green-600"
                                >
                                  Mark Complete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[60vh]">
              {STATUS_OPTIONS.map(status => {
                const StatusIcon = status.icon;
                const projectsInStatus = projectsByStatus[status.value] || [];
                
                return (
                  <div
                    key={status.value}
                    className="flex flex-col rounded-lg border bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                    aria-label={`${status.label} column`}
                  >
                    {/* Sticky column header */}
                    <div className="sticky top-0 z-10 px-3 py-2 border-b bg-background/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={cn("h-4 w-4", status.color)} />
                          <span className="font-medium text-sm">{status.label}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{projectsInStatus.length}</Badge>
                      </div>
                    </div>

                    {/* Column scroll area */}
                    <ScrollArea className="max-h-[65vh] lg:max-h-[70vh] xl:max-h-[75vh] p-3 overscroll-contain">
                      <div className="space-y-3 pr-2">
                        {projectsInStatus.length === 0 ? (
                          <div className="text-sm text-muted-foreground px-2 py-6 text-center select-none">
                            No projects
                          </div>
                        ) : (
                          projectsInStatus.map(project => renderProjectCard(project))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardProjects;
