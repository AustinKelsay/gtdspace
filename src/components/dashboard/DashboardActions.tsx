/**
 * @fileoverview Dashboard Actions Tab - Comprehensive actions list with filtering
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock,
  FileText,
  Filter,
  FolderOpen,
  MoreHorizontal,
  Search,
  Tag,
  Timer,
  X,
  Zap
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/hooks/useActionsData';
import { formatRelativeDate, parseLocalDate } from '@/utils/date-formatting';

// Use ActionItem from hook to prevent drift

interface DashboardActionsProps {
  actions: ActionItem[];
  projects: Array<{ name: string; path: string }>;
  isLoading?: boolean;
  onSelectAction?: (action: ActionItem) => void;
  onUpdateStatus?: (actionId: string, newStatus: string) => void;
  onBulkUpdate?: (actionIds: string[], updates: Partial<ActionItem>, actionPaths?: string[]) => void;
  onDeleteAction?: (actionId: string) => void;
}

// Status options
const STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', icon: CircleDot, color: 'text-blue-600' },
  { value: 'waiting', label: 'Waiting', icon: Clock, color: 'text-yellow-600' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'cancelled', label: 'Cancelled', icon: X, color: 'text-gray-500' }
];

// Effort options
const EFFORT_OPTIONS = [
  { value: 'small', label: 'Small (<30m)', icon: Timer, color: 'text-blue-500' },
  { value: 'medium', label: 'Medium (30-90m)', icon: Timer, color: 'text-yellow-500' },
  { value: 'large', label: 'Large (90m-3h)', icon: Timer, color: 'text-orange-500' },
  { value: 'extra-large', label: 'Extra Large (>3h)', icon: Timer, color: 'text-red-500' }
];

// Compact effort badge style for table
const EFFORT_SHORT: Record<string, string> = {
  'small': 'Small',
  'medium': 'Medium',
  'large': 'Large',
  'extra-large': 'XL'
};

// Sort options
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'project', label: 'Project' },
  { value: 'status', label: 'Status' },
  { value: 'effort', label: 'Effort' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'focusDate', label: 'Focus Date' },
  { value: 'created', label: 'Created Date' },
  { value: 'modified', label: 'Modified Date' }
];

export const DashboardActions: React.FC<DashboardActionsProps> = ({
  actions,
  projects,
  isLoading = false,
  onSelectAction,
  onUpdateStatus,
  onBulkUpdate,
  onDeleteAction
}) => {
  // Debug logger gated in non-production
  const debug = (...args: unknown[]) => {
    if (import.meta.env.MODE !== 'production') {
      console.debug(...args);
    }
  };
  React.useEffect(() => {
    if (actions.length > 0) {
      debug('[DashboardActions] actions length:', actions.length);
      debug('[DashboardActions] sample action:', { id: actions[0]?.id, path: actions[0]?.path });
    }
  }, [actions]);
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['in-progress', 'waiting']);
  const [effortFilter, setEffortFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [hasDeadlineFilter, setHasDeadlineFilter] = useState<boolean | null>(null);
  const [hasFocusDateFilter, setHasFocusDateFilter] = useState<boolean | null>(null);
  const [hasContextsFilter, setHasContextsFilter] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActionItem | null>(null);

  // Filter actions
  const filteredActions = useMemo(() => {
    let filtered = [...actions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(action =>
        action.name.toLowerCase().includes(query) ||
        action.projectName.toLowerCase().includes(query) ||
        action.contexts?.some(c => c.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(action => statusFilter.includes(action.status));
    }

    // Effort filter
    if (effortFilter.length > 0) {
      filtered = filtered.filter(action => action.effort && effortFilter.includes(action.effort));
    }

    // Project filter
    if (projectFilter.length > 0) {
      filtered = filtered.filter(action => {
        // Prefer explicit projectPath; fall back to parent directory of action file
        const projPath = action.projectPath ?? action.path.split('/').slice(0, -1).join('/');
        return projectFilter.includes(projPath);
      });
    }

    // Has deadline filter
    if (hasDeadlineFilter !== null) {
      filtered = filtered.filter(action =>
        hasDeadlineFilter ? !!action.dueDate : !action.dueDate
      );
    }

    // Has focus date filter
    if (hasFocusDateFilter !== null) {
      filtered = filtered.filter(action =>
        hasFocusDateFilter ? !!action.focusDate : !action.focusDate
      );
    }

    // Has contexts filter
    if (hasContextsFilter !== null) {
      filtered = filtered.filter(action => 
        hasContextsFilter ? (action.contexts && action.contexts.length > 0) : (!action.contexts || action.contexts.length === 0)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'project':
          compareValue = a.projectName.localeCompare(b.projectName);
          break;
        case 'status': {
          const order: Record<string, number> = { 'in-progress': 0, 'waiting': 1, 'completed': 2, 'cancelled': 3 };
          const aOrder = order[a.status] ?? 99;
          const bOrder = order[b.status] ?? 99;
          compareValue = aOrder - bOrder;
          break;
        }
        case 'effort': {
          const effortOrder = { 'small': 1, 'medium': 2, 'large': 3, 'extra-large': 4 };
          compareValue = (effortOrder[a.effort as keyof typeof effortOrder] || 0) - 
                        (effortOrder[b.effort as keyof typeof effortOrder] || 0);
        }
          break;
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) compareValue = 0;
          else if (!a.dueDate) compareValue = 1;
          else if (!b.dueDate) compareValue = -1;
          else compareValue = parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime();
          break;
        case 'focusDate':
          if (!a.focusDate && !b.focusDate) compareValue = 0;
          else if (!a.focusDate) compareValue = 1;
          else if (!b.focusDate) compareValue = -1;
          else compareValue = parseLocalDate(a.focusDate).getTime() - parseLocalDate(b.focusDate).getTime();
          break;
        case 'created':
          compareValue = parseLocalDate(a.createdDate || '').getTime() - parseLocalDate(b.createdDate || '').getTime();
          break;
        case 'modified':
          compareValue = parseLocalDate(a.modifiedDate || '').getTime() - parseLocalDate(b.modifiedDate || '').getTime();
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [actions, searchQuery, statusFilter, effortFilter, projectFilter, hasDeadlineFilter, hasFocusDateFilter, hasContextsFilter, sortBy, sortOrder]);

  // Toggle action selection
  const toggleActionSelection = useCallback((actionId: string) => {
    debug('[DashboardActions] toggle selection:', actionId);
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
        debug('[DashboardActions] deselected:', actionId);
      } else {
        newSet.add(actionId);
        debug('[DashboardActions] selected:', actionId);
      }
      debug('[DashboardActions] selected total:', newSet.size);
      return newSet;
    });
  }, []);

  // Select all visible actions
  const selectAllVisible = useCallback(() => {
    setSelectedActions(new Set(filteredActions.map(a => a.id)));
  }, [filteredActions]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedActions(new Set());
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter([]);
    setEffortFilter([]);
    setProjectFilter([]);
    setHasDeadlineFilter(null);
    setHasFocusDateFilter(null);
    setHasContextsFilter(null);
  }, []);

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    if (!option) return { icon: Circle, color: 'text-gray-400' };
    return { icon: option.icon, color: option.color };
  };

  // Get effort display
  const getEffortDisplay = (effort?: string) => {
    if (!effort) return null;
    const option = EFFORT_OPTIONS.find(opt => opt.value === effort);
    if (!option) return effort;
    return option.label;
  };

  // Use shared date formatting utility
  const formatDate = formatRelativeDate;

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (statusFilter.length > 0) count++;
    if (effortFilter.length > 0) count++;
    if (projectFilter.length > 0) count++;
    if (hasDeadlineFilter !== null) count++;
    if (hasFocusDateFilter !== null) count++;
    if (hasContextsFilter !== null) count++;
    return count;
  }, [searchQuery, statusFilter, effortFilter, projectFilter, hasDeadlineFilter, hasFocusDateFilter, hasContextsFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredActions.length;
    const byStatus = STATUS_OPTIONS.reduce((acc, status) => {
      acc[status.value] = filteredActions.filter(a => a.status === status.value).length;
      return acc;
    }, {} as Record<string, number>);
    
    const overdue = filteredActions.filter(a => {
      if (!a.dueDate) return false;
      return parseLocalDate(a.dueDate) < new Date();
    }).length;

    return { total, byStatus, overdue };
  }, [filteredActions]);

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4">
        {/* Search and main controls */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions, projects, or contexts..."
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

          {selectedActions.size > 0 && (
            <>
              {import.meta.env.MODE !== 'production' ? console.debug('[DashboardActions] bulk actions visible, selected:', selectedActions.size) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    Bulk Actions ({selectedActions.size})
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map(status => (
                  <DropdownMenuItem
                    key={status.value}
                    onClick={() => {
                      if (onBulkUpdate) {
                        // Get the selected action IDs and their paths
                        const selectedActionIds = Array.from(selectedActions);
                        const selectedActionPaths = selectedActionIds.map(id => {
                          const action = filteredActions.find(a => a.id === id);
                          debug('[DashboardActions] bulk map action:', { id, path: action?.path });
                          return action?.path || id;
                        });
                        debug('[DashboardActions] bulk update begin:', { count: selectedActionIds.length, status: status.value });
                        onBulkUpdate(selectedActionIds, { status: status.value }, selectedActionPaths);
                        clearSelection();
                      }
                    }}
                  >
                    <status.icon className={cn("h-4 w-4 mr-2", status.color)} />
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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

                {/* Effort filter */}
                <div className="space-y-2">
                  <Label>Effort</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {effortFilter.length > 0 ? `${effortFilter.length} selected` : 'Any'}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-2">
                      {EFFORT_OPTIONS.map(effort => (
                        <div key={effort.value} className="flex items-center space-x-2 p-2">
                          <input
                            type="checkbox"
                            id={`effort-${effort.value}`}
                            checked={effortFilter.includes(effort.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEffortFilter([...effortFilter, effort.value]);
                              } else {
                                setEffortFilter(effortFilter.filter(s => s !== effort.value));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`effort-${effort.value}`} className="flex items-center gap-2 cursor-pointer">
                            <effort.icon className={cn("h-4 w-4", effort.color)} />
                            {effort.label}
                          </Label>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Project filter */}
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {projectFilter.length > 0 ? `${projectFilter.length} selected` : 'Any'}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-2">
                      <ScrollArea className="h-[200px]">
                        {projects.map(project => (
                          <div key={project.path} className="flex items-center space-x-2 p-2">
                            <input
                              type="checkbox"
                              id={`project-${project.path}`}
                              checked={projectFilter.includes(project.path)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProjectFilter([...projectFilter, project.path]);
                                } else {
                                  setProjectFilter(projectFilter.filter(s => s !== project.path));
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={`project-${project.path}`} className="cursor-pointer truncate">
                              {project.name}
                            </Label>
                          </div>
                        ))}
                      </ScrollArea>
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

                {/* Has focus date filter */}
                <div className="space-y-2">
                  <Label>Has Focus Date</Label>
                  <Select
                    value={hasFocusDateFilter === null ? 'any' : hasFocusDateFilter ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      if (value === 'any') setHasFocusDateFilter(null);
                      else setHasFocusDateFilter(value === 'yes');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Has focus date</SelectItem>
                      <SelectItem value="no">No focus date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Has contexts filter */}
                <div className="space-y-2">
                  <Label>Has Contexts</Label>
                  <Select 
                    value={hasContextsFilter === null ? 'any' : hasContextsFilter ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      if (value === 'any') setHasContextsFilter(null);
                      else setHasContextsFilter(value === 'yes');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Has contexts</SelectItem>
                      <SelectItem value="no">No contexts</SelectItem>
                    </SelectContent>
                  </Select>
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">{stats.total} actions</Badge>
          </div>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">{stats.overdue} overdue</span>
            </div>
          )}
          {Object.entries(stats.byStatus).map(([status, count]) => {
            if (count === 0) return null;
            const statusDisplay = getStatusDisplay(status);
            const StatusIcon = statusDisplay.icon;
            return (
              <div key={status} className="flex items-center gap-2">
                <StatusIcon className={cn("h-4 w-4", statusDisplay.color)} />
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading actions...
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {actions.length === 0 ? 'No actions found' : 'No actions match your filters'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={selectedActions.size === filteredActions.length && filteredActions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllVisible();
                        } else {
                          clearSelection();
                        }
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effort</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Focus</TableHead>
                  <TableHead>Contexts</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActions.map((action) => {
                  const statusDisplay = getStatusDisplay(action.status);
                  const StatusIcon = statusDisplay.icon;
                  const isOverdue = action.dueDate && parseLocalDate(action.dueDate) < new Date();
                  
                  return (
                    <TableRow 
                      key={action.id}
                      className={cn(
                        "cursor-pointer hover:bg-accent",
                        selectedActions.has(action.id) && "bg-accent"
                      )}
                      onClick={() => onSelectAction?.(action)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedActions.has(action.id)}
                          onChange={() => toggleActionSelection(action.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {action.references && action.references.length > 0 && (
                            <FileText className="h-3 w-3 text-muted-foreground" />
                          )}
                          {action.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{action.projectName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-auto p-1">
                              <StatusIcon className={cn("h-4 w-4 mr-1", statusDisplay.color)} />
                              <span className="text-xs">{action.status}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            {STATUS_OPTIONS.map(status => (
                              <DropdownMenuItem
                                key={status.value}
                                onClick={() => onUpdateStatus?.(action.id, status.value)}
                              >
                                <status.icon className={cn("h-4 w-4 mr-2", status.color)} />
                                {status.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        {action.effort && (
                          <Badge
                            variant="outline"
                            title={getEffortDisplay(action.effort)}
                            className="h-5 px-2 text-[11px] leading-none font-medium whitespace-nowrap rounded-full border-muted-foreground/30 text-muted-foreground"
                          >
                            {EFFORT_SHORT[action.effort] ?? action.effort}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.dueDate && (
                          <div className={cn(
                            "flex items-center gap-1 text-xs",
                            isOverdue && "text-destructive"
                          )}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(action.dueDate)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.focusDate && (
                          <div className="flex items-center gap-1 text-xs">
                            <Zap className="h-3 w-3" />
                            {formatDate(action.focusDate)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.contexts && action.contexts.length > 0 && (
                          <div className="flex gap-1">
                            {action.contexts.slice(0, 2).map(context => (
                              <Badge key={context} variant="secondary" className="text-xs">
                                <Tag className="h-2 w-2 mr-1" />
                                {context}
                              </Badge>
                            ))}
                            {action.contexts.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{action.contexts.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSelectAction?.(action)}>
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSelectAction?.(action)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeleteTarget(action)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete "{deleteTarget.name}". You can Undo right after deletion.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteAction?.(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardActions;
