/**
 * @fileoverview Data visualization components for document analytics
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Document analytics and data visualization
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  FileText, 
  Target,
  Calendar,
  PieChart,
  Activity,
  Hash,
  Users,
  Zap
} from 'lucide-react';

// === TYPES ===
export interface DocumentStats {
  /** Document word count */
  wordCount: number;
  /** Character count including spaces */
  characterCount: number;
  /** Character count excluding spaces */
  characterCountNoSpaces: number;
  /** Number of paragraphs */
  paragraphCount: number;
  /** Number of sentences */
  sentenceCount: number;
  /** Number of headings by level */
  headingCounts: Record<number, number>;
  /** Number of links */
  linkCount: number;
  /** Number of images */
  imageCount: number;
  /** Number of code blocks */
  codeBlockCount: number;
  /** Number of tables */
  tableCount: number;
  /** Estimated reading time in minutes */
  readingTime: number;
  /** Document complexity score (0-100) */
  complexityScore: number;
  /** Average words per sentence */
  avgWordsPerSentence: number;
  /** Average sentences per paragraph */
  avgSentencesPerParagraph: number;
}

export interface WritingSession {
  /** Session start time */
  startTime: number;
  /** Session end time */
  endTime: number;
  /** Words written during session */
  wordsWritten: number;
  /** Characters typed during session */
  charactersTyped: number;
  /** Document being edited */
  documentPath: string;
  /** Session duration in minutes */
  duration: number;
}

export interface ProductivityMetrics {
  /** Words per minute average */
  wordsPerMinute: number;
  /** Daily word count goals */
  dailyGoal: number;
  /** Current daily progress */
  dailyProgress: number;
  /** Weekly writing sessions */
  weeklySessions: WritingSession[];
  /** Most productive day of week */
  mostProductiveDay: string;
  /** Most productive time of day */
  mostProductiveHour: number;
  /** Writing streak in days */
  currentStreak: number;
  /** Longest writing streak */
  longestStreak: number;
}

export interface AnalyticsData {
  /** Current document statistics */
  currentDocument: DocumentStats | null;
  /** All-time productivity metrics */
  productivity: ProductivityMetrics;
  /** File statistics across workspace */
  workspace: {
    totalFiles: number;
    totalWords: number;
    averageFileSize: number;
    largestFile: string;
    mostEditedFile: string;
    fileTypes: Record<string, number>;
  };
  /** Recent activity */
  recentActivity: Array<{
    type: 'created' | 'edited' | 'deleted';
    file: string;
    timestamp: number;
    wordsChanged?: number;
  }>;
}

export interface ChartProps {
  data: number[];
  labels: string[];
  title: string;
  color?: string;
  height?: number;
  showValues?: boolean;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  color?: 'default' | 'success' | 'warning' | 'danger';
}

// === UTILITY FUNCTIONS ===
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function calculateComplexity(stats: DocumentStats): number {
  // Simple complexity algorithm based on various factors
  let score = 0;
  
  // Base score from word count (normalized to 0-30)
  score += Math.min(30, stats.wordCount / 100);
  
  // Sentence complexity (normalized to 0-25)
  const avgWordsPerSentence = stats.avgWordsPerSentence;
  if (avgWordsPerSentence > 20) score += 25;
  else if (avgWordsPerSentence > 15) score += 20;
  else if (avgWordsPerSentence > 10) score += 15;
  else score += 10;
  
  // Structure complexity (normalized to 0-25)
  const structureElements = stats.headingCounts[1] + stats.headingCounts[2] + 
                           stats.linkCount + stats.tableCount + stats.codeBlockCount;
  score += Math.min(25, structureElements * 2);
  
  // Paragraph structure (normalized to 0-20)
  const avgSentencesPerParagraph = stats.avgSentencesPerParagraph;
  if (avgSentencesPerParagraph > 8) score += 20;
  else if (avgSentencesPerParagraph > 5) score += 15;
  else if (avgSentencesPerParagraph > 2) score += 10;
  else score += 5;
  
  return Math.min(100, score);
}

// === CHART COMPONENTS ===

/**
 * Simple bar chart component
 */
function BarChart({ data, labels, title, color = '#3b82f6', height = 200, showValues = false }: ChartProps) {
  const maxValue = Math.max(...data);
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="space-y-2" style={{ height }}>
        {data.map((value, index) => {
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          
          return (
            <div key={index} className="flex items-center gap-3">
              <div className="w-16 text-xs text-muted-foreground text-right">
                {labels[index]}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
                {showValues && (
                  <div className="w-12 text-xs text-right">
                    {formatNumber(value)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Simple line chart visualization
 */
function LineChart({ data, labels, title, color = '#10b981' }: ChartProps) {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="relative h-32 border rounded-lg p-4 bg-muted/20">
        <svg className="w-full h-full" viewBox="0 0 300 100">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="300"
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
          ))}
          
          {/* Data line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={data.map((value, index) => {
              const x = (index / (data.length - 1)) * 300;
              const y = range > 0 ? ((maxValue - value) / range) * 100 : 50;
              return `${x},${y}`;
            }).join(' ')}
          />
          
          {/* Data points */}
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * 300;
            const y = range > 0 ? ((maxValue - value) / range) * 100 : 50;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill={color}
                className="hover:r-4 transition-all cursor-pointer"
              />
            );
          })}
        </svg>
        
        {/* Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {labels.map((label, index) => {
            if (index % Math.ceil(labels.length / 5) === 0 || index === labels.length - 1) {
              return <span key={index}>{label}</span>;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Metric card with trend information
 */
function MetricCard({ title, value, subtitle, icon, trend, color = 'default' }: MetricCardProps) {
  const colorClasses = {
    default: 'text-foreground',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", colorClasses[color])}>
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-muted-foreground">{icon}</div>
            {trend && (
              <div className="flex items-center gap-1 text-xs">
                {trend.direction === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                {trend.direction === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className={cn(
                  trend.direction === 'up' && 'text-green-500',
                  trend.direction === 'down' && 'text-red-500',
                  trend.direction === 'neutral' && 'text-muted-foreground'
                )}>
                  {trend.value}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Document statistics overview
 */
function DocumentOverview({ stats }: { stats: DocumentStats | null }) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No document selected</p>
          <p className="text-sm">Open a file to see statistics</p>
        </CardContent>
      </Card>
    );
  }

  const complexity = calculateComplexity(stats);
  const complexityColor = complexity > 75 ? 'danger' : complexity > 50 ? 'warning' : 'success';
  const complexityLabel = complexity > 75 ? 'Complex' : complexity > 50 ? 'Moderate' : 'Simple';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Words"
          value={stats.wordCount}
          icon={<Hash className="h-5 w-5" />}
          subtitle={`${stats.characterCount} characters`}
        />
        <MetricCard
          title="Reading Time"
          value={`${stats.readingTime}min`}
          icon={<Clock className="h-5 w-5" />}
          subtitle="Average reader"
        />
        <MetricCard
          title="Paragraphs"
          value={stats.paragraphCount}
          icon={<FileText className="h-5 w-5" />}
          subtitle={`${stats.sentenceCount} sentences`}
        />
        <MetricCard
          title="Complexity"
          value={complexityLabel}
          icon={<Target className="h-5 w-5" />}
          subtitle={`${complexity}/100`}
          color={complexityColor}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Document Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                stats.headingCounts[1] || 0,
                stats.headingCounts[2] || 0,
                stats.headingCounts[3] || 0,
                stats.linkCount,
                stats.imageCount,
                stats.codeBlockCount,
                stats.tableCount
              ]}
              labels={['H1', 'H2', 'H3', 'Links', 'Images', 'Code', 'Tables']}
              title=""
              showValues
              height={140}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Writing Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Avg words per sentence</span>
                <span className="font-medium">{stats.avgWordsPerSentence.toFixed(1)}</span>
              </div>
              <Progress value={(stats.avgWordsPerSentence / 25) * 100} />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Avg sentences per paragraph</span>
                <span className="font-medium">{stats.avgSentencesPerParagraph.toFixed(1)}</span>
              </div>
              <Progress value={(stats.avgSentencesPerParagraph / 8) * 100} />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Readability</span>
                <Badge variant={complexity < 50 ? 'default' : complexity < 75 ? 'secondary' : 'destructive'}>
                  {complexityLabel}
                </Badge>
              </div>
              <Progress value={complexity} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Productivity analytics dashboard
 */
function ProductivityDashboard({ metrics }: { metrics: ProductivityMetrics }) {
  const dailyProgressPercent = (metrics.dailyProgress / metrics.dailyGoal) * 100;
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Generate sample weekly data
  const weeklyWords = weekDays.map(() => Math.floor(Math.random() * 2000) + 500);
  const weeklySessions = weekDays.map(() => Math.floor(Math.random() * 5) + 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Daily Goal"
          value={`${metrics.dailyProgress}/${metrics.dailyGoal}`}
          icon={<Target className="h-5 w-5" />}
          subtitle={`${dailyProgressPercent.toFixed(0)}% complete`}
          color={dailyProgressPercent >= 100 ? 'success' : 'default'}
        />
        <MetricCard
          title="Words/Min"
          value={metrics.wordsPerMinute}
          icon={<Zap className="h-5 w-5" />}
          subtitle="Average speed"
          trend={{
            direction: 'up',
            value: '+5.2%'
          }}
        />
        <MetricCard
          title="Current Streak"
          value={`${metrics.currentStreak} days`}
          icon={<Calendar className="h-5 w-5" />}
          subtitle={`Best: ${metrics.longestStreak} days`}
          color={metrics.currentStreak > 7 ? 'success' : 'default'}
        />
        <MetricCard
          title="Peak Hour"
          value={`${metrics.mostProductiveHour}:00`}
          icon={<Clock className="h-5 w-5" />}
          subtitle={`${metrics.mostProductiveDay}s`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Weekly Words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={weeklyWords}
              labels={weekDays}
              title=""
              color="#10b981"
              showValues
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Writing Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={weeklySessions}
              labels={weekDays}
              title=""
              color="#3b82f6"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Today's Writing Goal</span>
              <span className="text-sm font-medium">
                {metrics.dailyProgress} / {metrics.dailyGoal} words
              </span>
            </div>
            <Progress value={dailyProgressPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{Math.floor(metrics.dailyGoal / 2)}</span>
              <span>{metrics.dailyGoal}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main data visualization component
 */
export function DataVisualization({ data }: { data: AnalyticsData }) {
  const [activeTab, setActiveTab] = useState('document');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Insights and metrics for your writing
          </p>
        </div>
        <Button variant="outline" size="sm">
          Export Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="document" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document
          </TabsTrigger>
          <TabsTrigger value="productivity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Productivity
          </TabsTrigger>
          <TabsTrigger value="workspace" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Workspace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="document" className="space-y-4">
          <DocumentOverview stats={data.currentDocument} />
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <ProductivityDashboard metrics={data.productivity} />
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Files"
              value={data.workspace.totalFiles}
              icon={<FileText className="h-5 w-5" />}
              subtitle="Markdown files"
            />
            <MetricCard
              title="Total Words"
              value={data.workspace.totalWords > 0 ? formatNumber(data.workspace.totalWords) : 'N/A'}
              icon={<Hash className="h-5 w-5" />}
              subtitle="Across all files"
            />
            <MetricCard
              title="Avg File Size"
              value={data.workspace.averageFileSize > 0 ? `${Math.round(data.workspace.averageFileSize / 1024)}KB` : 'N/A'}
              icon={<Activity className="h-5 w-5" />}
              subtitle="Average"
            />
            <MetricCard
              title="Largest File"
              value={data.workspace.largestFile?.substring(0, 15) || 'N/A'}
              icon={<Target className="h-5 w-5" />}
              subtitle="Biggest document"
            />
          </div>

          {/* File Types Distribution */}
          {Object.keys(data.workspace.fileTypes).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  File Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={Object.values(data.workspace.fileTypes)}
                  labels={Object.keys(data.workspace.fileTypes)}
                  title=""
                  showValues
                  height={120}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        activity.type === 'created' && "bg-green-500",
                        activity.type === 'edited' && "bg-blue-500",
                        activity.type === 'deleted' && "bg-red-500"
                      )} />
                      <div>
                        <p className="text-sm font-medium">
                          {activity.file.split('/').pop()}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {activity.type}
                          {activity.wordsChanged && ` • ${activity.wordsChanged} words`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DataVisualization;