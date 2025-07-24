/**
 * @fileoverview Mini visualization component for document stats panel
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Mini analytics preview
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Target,
  Clock,
  Hash,
  FileText,
  Eye
} from 'lucide-react';

// === TYPES ===
export interface DocumentMetrics {
  wordCount: number;
  readingTime: number;
  complexityScore: number;
  structureScore: number;
  paragraphs: number;
  sentences: number;
}

export interface WritingGoals {
  dailyTarget: number;
  currentProgress: number;
  weeklyStreak: number;
}

interface MiniVisualizationProps {
  metrics: DocumentMetrics;
  goals?: WritingGoals;
  onOpenFullAnalytics?: () => void;
  compact?: boolean;
}

// === UTILITY FUNCTIONS ===
function getComplexityColor(score: number): string {
  if (score < 30) return 'text-green-600 dark:text-green-400';
  if (score < 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getComplexityLabel(score: number): string {
  if (score < 30) return 'Simple';
  if (score < 60) return 'Moderate';
  return 'Complex';
}

// === COMPONENTS ===

/**
 * Mini metric card for displaying key statistics
 */
function MiniMetricCard({ 
  icon, 
  label, 
  value, 
  subtitle,
  color = 'default'
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colorClasses = {
    default: 'text-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400'
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
      <div className="text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium leading-none", colorClasses[color])}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/80 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Mini progress ring component
 */
function MiniProgressRing({ 
  percentage, 
  size = 32, 
  strokeWidth = 3,
  color = 'hsl(var(--primary))'
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Mini bar chart for structure visualization
 */
function MiniBarChart({ 
  data, 
  labels,
  height = 40 
}: { 
  data: number[];
  labels: string[];
  height?: number;
}) {
  const maxValue = Math.max(...data);
  
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((value, index) => {
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const barHeight = (percentage / 100) * height;
          
          return (
            <div
              key={index}
              className="flex flex-col items-center gap-1 flex-1 min-w-0"
            >
              <div 
                className="bg-primary/60 rounded-sm w-full transition-all duration-300 hover:bg-primary/80"
                style={{ height: Math.max(barHeight, 2) }}
                title={`${labels[index]}: ${value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {labels.map((label, index) => (
          <div key={index} className="text-xs text-muted-foreground text-center flex-1 min-w-0">
            <span className="truncate block">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main mini visualization component
 */
export function MiniVisualization({ 
  metrics, 
  goals,
  onOpenFullAnalytics,
  compact = false 
}: MiniVisualizationProps) {
  const complexityColor = metrics.complexityScore < 30 ? 'success' : 
                         metrics.complexityScore < 60 ? 'warning' : 'danger';
  
  const dailyProgress = goals ? (goals.currentProgress / goals.dailyTarget) * 100 : 0;
  
  // Sample structure data based on metrics
  const structureData = [
    Math.floor(metrics.paragraphs * 0.1), // H1s
    Math.floor(metrics.paragraphs * 0.2), // H2s  
    Math.floor(metrics.paragraphs * 0.1), // H3s
    Math.floor(metrics.wordCount * 0.05), // Links (rough estimate)
  ];
  const structureLabels = ['H1', 'H2', 'H3', 'Links'];

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Quick Stats
            </CardTitle>
            {onOpenFullAnalytics && (
              <Button variant="ghost" size="sm" onClick={onOpenFullAnalytics}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MiniMetricCard
              icon={<Hash className="h-3 w-3" />}
              label="Words"
              value={metrics.wordCount.toLocaleString()}
            />
            <MiniMetricCard
              icon={<Clock className="h-3 w-3" />}
              label="Read Time"
              value={`${metrics.readingTime}min`}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Complexity</p>
              <Badge variant={complexityColor === 'success' ? 'default' : 'secondary'}>
                {getComplexityLabel(metrics.complexityScore)}
              </Badge>
            </div>
            <MiniProgressRing 
              percentage={metrics.complexityScore} 
              size={28}
              strokeWidth={2}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Document Analytics
          </CardTitle>
          {onOpenFullAnalytics && (
            <Button variant="outline" size="sm" onClick={onOpenFullAnalytics}>
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MiniMetricCard
            icon={<Hash className="h-4 w-4" />}
            label="Words"
            value={metrics.wordCount.toLocaleString()}
            subtitle={`${metrics.sentences} sentences`}
          />
          <MiniMetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Reading Time"
            value={`${metrics.readingTime}min`}
            subtitle="Average reader"
          />
          <MiniMetricCard
            icon={<FileText className="h-4 w-4" />}
            label="Paragraphs"
            value={metrics.paragraphs}
            subtitle="Structure units"
          />
          <MiniMetricCard
            icon={<Target className="h-4 w-4" />}
            label="Complexity"
            value={getComplexityLabel(metrics.complexityScore)}
            subtitle={`${metrics.complexityScore}/100`}
            color={complexityColor}
          />
        </div>

        {/* Structure Visualization */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Document Structure</p>
          <MiniBarChart 
            data={structureData}
            labels={structureLabels}
            height={32}
          />
        </div>

        {/* Writing Goals (if provided) */}
        {goals && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Daily Goal</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {goals.currentProgress} / {goals.dailyTarget}
                </span>
                <MiniProgressRing 
                  percentage={dailyProgress} 
                  size={24}
                  strokeWidth={2}
                  color={dailyProgress >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
                />
              </div>
            </div>
            <Progress value={dailyProgress} className="h-1" />
            {goals.weeklyStreak > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>{goals.weeklyStreak} day writing streak</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MiniVisualization;