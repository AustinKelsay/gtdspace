/**
 * @fileoverview Advanced data visualization components with enhanced charts
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Advanced data visualization and analytics
 */

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Zap,
  Download,
  Info,
  ArrowUp,
  ArrowDown,
  Layers,
  BookOpen,
  Eye,
  Globe
} from 'lucide-react';

// === TYPES ===
export interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface RadarChartData {
  axis: string;
  value: number;
  fullMark: number;
}

export interface BubbleChartData {
  x: number;
  y: number;
  size: number;
  label: string;
  color?: string;
}

// === ENHANCED CHART COMPONENTS ===

/**
 * Advanced pie chart with interactive slices
 */
function PieChartAdvanced({ 
  data, 
  title, 
  innerRadius = 0,
  showLegend = true,
  interactive = true 
}: { 
  data: PieChartData[]; 
  title?: string;
  innerRadius?: number;
  showLegend?: boolean;
  interactive?: boolean;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  
  const radius = 80;
  const center = 100;
  let currentAngle = -90; // Start from top

  return (
    <div className="space-y-4">
      {title && <h4 className="text-sm font-medium">{title}</h4>}
      
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              
              // Calculate path for slice
              const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
              const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
              const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
              const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              
              const pathData = [
                `M ${center} ${center}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ');
              
              currentAngle = endAngle;
              
              return (
                <g key={index}>
                  <path
                    d={pathData}
                    fill={item.color}
                    opacity={hoveredSlice !== null && hoveredSlice !== index ? 0.6 : 1}
                    stroke="white"
                    strokeWidth="2"
                    className={cn(
                      "transition-all duration-200",
                      interactive && "cursor-pointer"
                    )}
                    onMouseEnter={() => interactive && setHoveredSlice(index)}
                    onMouseLeave={() => interactive && setHoveredSlice(null)}
                    transform={hoveredSlice === index ? `scale(1.05) translate(-${center * 0.05}, -${center * 0.05})` : ''}
                    style={{ transformOrigin: `${center}px ${center}px` }}
                  />
                  
                  {/* Show percentage on hover */}
                  {hoveredSlice === index && (
                    <text
                      x={center}
                      y={center}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white text-sm font-medium pointer-events-none"
                    >
                      {percentage.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
            
            {/* Inner circle for donut chart */}
            {innerRadius > 0 && (
              <circle
                cx={center}
                cy={center}
                r={radius * innerRadius}
                fill="hsl(var(--background))"
              />
            )}
          </svg>
        </div>
        
        {showLegend && (
          <div className="space-y-2">
            {data.map((item, index) => (
              <div 
                key={index} 
                className="flex items-center gap-2 text-sm"
                onMouseEnter={() => interactive && setHoveredSlice(index)}
                onMouseLeave={() => interactive && setHoveredSlice(null)}
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className={cn(
                  "transition-opacity",
                  hoveredSlice !== null && hoveredSlice !== index && "opacity-60"
                )}>
                  {item.label}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Writing activity heatmap
 */
function ActivityHeatmap({ 
  data, 
  title = "Writing Activity Heatmap" 
}: { 
  data: HeatmapData[];
  title?: string;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxValue = Math.max(...data.map(d => d.value));
  
  const getIntensity = (value: number) => {
    if (maxValue === 0) return 0;
    return (value / maxValue) * 100;
  };
  
  const getColor = (intensity: number) => {
    if (intensity === 0) return 'bg-muted';
    if (intensity < 25) return 'bg-blue-200 dark:bg-blue-900';
    if (intensity < 50) return 'bg-blue-400 dark:bg-blue-700';
    if (intensity < 75) return 'bg-blue-600 dark:bg-blue-500';
    return 'bg-blue-800 dark:bg-blue-400';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>
          Your writing patterns throughout the week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Hour labels */}
          <div className="flex gap-1 ml-12 text-xs text-muted-foreground">
            {hours.map(hour => (
              <div key={hour} className="w-5 text-center">
                {hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>
          
          {/* Heatmap grid */}
          {days.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1">
              <div className="w-10 text-xs text-muted-foreground text-right">
                {day}
              </div>
              {hours.map(hour => {
                const item = data.find(d => d.day === day && d.hour === hour);
                const value = item?.value || 0;
                const intensity = getIntensity(value);
                
                return (
                  <TooltipProvider key={`${day}-${hour}`}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-sm transition-all cursor-pointer hover:ring-2 hover:ring-primary",
                            getColor(intensity)
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {day} {hour}:00 - {value} words
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          ))}
          
          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 25, 50, 75, 100].map(intensity => (
                <div
                  key={intensity}
                  className={cn("w-4 h-4 rounded-sm", getColor(intensity))}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Radar chart for document complexity analysis
 */
function RadarChart({ 
  data, 
  title = "Document Complexity Analysis" 
}: { 
  data: RadarChartData[];
  title?: string;
}) {
  const angleStep = (2 * Math.PI) / data.length;
  const center = { x: 150, y: 150 };
  const radius = 120;
  
  // Create polygon points for data
  const dataPoints = data.map((item, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const value = (item.value / item.fullMark) * radius;
    return {
      x: center.x + value * Math.cos(angle),
      y: center.y + value * Math.sin(angle),
      label: item.axis,
      percentage: (item.value / item.fullMark) * 100
    };
  });
  
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <svg width="300" height="300" viewBox="0 0 300 300">
          {/* Grid circles */}
          {[20, 40, 60, 80, 100].map(percent => (
            <circle
              key={percent}
              cx={center.x}
              cy={center.y}
              r={(percent / 100) * radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
          ))}
          
          {/* Axis lines and labels */}
          {data.map((item, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            const labelX = center.x + (radius + 20) * Math.cos(angle);
            const labelY = center.y + (radius + 20) * Math.sin(angle);
            
            return (
              <g key={index}>
                <line
                  x1={center.x}
                  y1={center.y}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-muted-foreground"
                >
                  {item.axis}
                </text>
              </g>
            );
          })}
          
          {/* Data polygon */}
          <polygon
            points={polygonPoints}
            fill="hsl(var(--primary))"
            fillOpacity="0.2"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          
          {/* Data points */}
          {dataPoints.map((point, index) => (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="hsl(var(--primary))"
                    className="cursor-pointer hover:r-6 transition-all"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {point.label}: {point.percentage.toFixed(0)}%
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

/**
 * Time series chart with trend line
 */
function TimeSeriesChart({ 
  data, 
  title,
  showTrend = true,
  interval = 'daily'
}: { 
  data: TimeSeriesData[];
  title: string;
  showTrend?: boolean;
  interval?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}) {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;
  
  // Calculate trend line using simple linear regression
  const trendLine = useMemo(() => {
    if (!showTrend || data.length < 2) return null;
    
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }, [data, showTrend]);
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (interval) {
      case 'hourly':
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case 'weekly':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'monthly':
        return date.toLocaleDateString('en-US', { month: 'short' });
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>
          {showTrend && trendLine && (
            <span className="flex items-center gap-1">
              Trend: {trendLine.slope > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{(trendLine.slope * 100).toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{(trendLine.slope * 100).toFixed(1)}%</span>
                </>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-48 border rounded-lg p-4 bg-muted/20">
          <svg className="w-full h-full" viewBox="0 0 400 150">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100, 125, 150].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1"
              />
            ))}
            
            {/* Data line */}
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              points={data.map((item, index) => {
                const x = (index / (data.length - 1)) * 400;
                const y = range > 0 ? ((maxValue - item.value) / range) * 150 : 75;
                return `${x},${y}`;
              }).join(' ')}
            />
            
            {/* Trend line */}
            {showTrend && trendLine && (
              <line
                x1="0"
                y1={range > 0 ? ((maxValue - trendLine.intercept) / range) * 150 : 75}
                x2="400"
                y2={range > 0 ? ((maxValue - (trendLine.intercept + trendLine.slope * (data.length - 1))) / range) * 150 : 75}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                strokeDasharray="5,5"
                opacity="0.5"
              />
            )}
            
            {/* Data points */}
            {data.map((item, index) => {
              const x = (index / (data.length - 1)) * 400;
              const y = range > 0 ? ((maxValue - item.value) / range) * 150 : 75;
              
              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger>
                      <circle
                        cx={x}
                        cy={y}
                        r="3"
                        fill="hsl(var(--primary))"
                        className="hover:r-5 transition-all cursor-pointer"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className="font-medium">{item.value}</p>
                        <p className="text-muted-foreground">{formatDate(item.timestamp)}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </svg>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground -ml-8">
            <span>{maxValue}</span>
            <span>{Math.round((maxValue + minValue) / 2)}</span>
            <span>{minValue}</span>
          </div>
        </div>
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1)
            .map((item, index) => (
              <span key={index}>{formatDate(item.timestamp)}</span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Bubble chart for document relationships
 */
function BubbleChart({ 
  data, 
  title = "Document Relationships",
  xLabel = "Words",
  yLabel = "Complexity"
}: { 
  data: BubbleChartData[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
}) {
  const maxX = Math.max(...data.map(d => d.x));
  const maxY = Math.max(...data.map(d => d.y));
  const maxSize = Math.max(...data.map(d => d.size));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-64 border rounded-lg p-4 bg-muted/20">
          <svg className="w-full h-full" viewBox="0 0 400 200">
            {/* Grid */}
            {[0, 50, 100, 150, 200].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1"
              />
            ))}
            {[0, 100, 200, 300, 400].map(x => (
              <line
                key={x}
                x1={x}
                y1="0"
                x2={x}
                y2="200"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1"
              />
            ))}
            
            {/* Bubbles */}
            {data.map((item, index) => {
              const x = (item.x / maxX) * 380 + 10;
              const y = 190 - (item.y / maxY) * 180;
              const r = (item.size / maxSize) * 30 + 5;
              
              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger>
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={item.color || 'hsl(var(--primary))'}
                        fillOpacity="0.6"
                        stroke={item.color || 'hsl(var(--primary))'}
                        strokeWidth="2"
                        className="hover:fill-opacity-80 transition-all cursor-pointer"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className="font-medium">{item.label}</p>
                        <p>{xLabel}: {item.x}</p>
                        <p>{yLabel}: {item.y}</p>
                        <p>Size: {item.size}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </svg>
          
          {/* Axis labels */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
            {xLabel}
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground -ml-12">
            {yLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Enhanced document analytics dashboard
 */
export function AdvancedVisualization() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [exportFormat, setExportFormat] = useState('pdf');

  // Sample data for demonstrations
  const documentTypesData: PieChartData[] = [
    { label: 'Technical Docs', value: 45, color: '#3b82f6' },
    { label: 'Blog Posts', value: 30, color: '#10b981' },
    { label: 'Notes', value: 15, color: '#f59e0b' },
    { label: 'Research', value: 10, color: '#8b5cf6' }
  ];

  const complexityData: RadarChartData[] = [
    { axis: 'Vocabulary', value: 75, fullMark: 100 },
    { axis: 'Sentence Length', value: 60, fullMark: 100 },
    { axis: 'Structure', value: 85, fullMark: 100 },
    { axis: 'Readability', value: 70, fullMark: 100 },
    { axis: 'Technical Terms', value: 40, fullMark: 100 },
    { axis: 'Formatting', value: 90, fullMark: 100 }
  ];

  const heatmapData: HeatmapData[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days.forEach(day => {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({
        day,
        hour,
        value: Math.random() * 1000 * (hour > 8 && hour < 18 ? 2 : 0.5)
      });
    }
  });

  const timeSeriesData: TimeSeriesData[] = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 24 * 60 * 60 * 1000,
    value: Math.floor(Math.random() * 2000) + 500
  }));

  const bubbleData: BubbleChartData[] = [
    { x: 1200, y: 85, size: 50, label: 'README.md' },
    { x: 3500, y: 70, size: 120, label: 'documentation.md' },
    { x: 800, y: 40, size: 30, label: 'notes.md' },
    { x: 2200, y: 60, size: 80, label: 'guide.md' },
    { x: 1800, y: 75, size: 60, label: 'tutorial.md' }
  ];

  const handleExport = () => {
    // Export functionality would be implemented here
    console.log(`Exporting analytics as ${exportFormat}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Advanced Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Deep insights into your writing patterns and document metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Words</p>
                <p className="text-2xl font-bold">42,156</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                  <ArrowUp className="h-3 w-3" />
                  12.5% from last period
                </p>
              </div>
              <Hash className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Session</p>
                <p className="text-2xl font-bold">47min</p>
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <ArrowDown className="h-3 w-3" />
                  5.2% from last period
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">128</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                  <ArrowUp className="h-3 w-3" />
                  8 new this period
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Productivity</p>
                <p className="text-2xl font-bold">89%</p>
                <Progress value={89} className="h-1 mt-2" />
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <PieChartAdvanced 
          data={documentTypesData}
          title="Document Types Distribution"
          innerRadius={0.4}
        />
        
        <RadarChart 
          data={complexityData}
          title="Document Complexity Analysis"
        />
      </div>

      <ActivityHeatmap data={heatmapData} />

      <TimeSeriesChart 
        data={timeSeriesData}
        title="Daily Word Count Trend"
        interval="daily"
      />

      <BubbleChart 
        data={bubbleData}
        title="Document Size vs Complexity"
        xLabel="Word Count"
        yLabel="Complexity Score"
      />

      {/* Writing Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Writing Goals Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Daily Goal</span>
                <span className="text-sm font-medium">1,250 / 1,500 words</span>
              </div>
              <Progress value={83} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Weekly Goal</span>
                <span className="text-sm font-medium">8,400 / 10,000 words</span>
              </div>
              <Progress value={84} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Monthly Goal</span>
                <span className="text-sm font-medium">32,156 / 40,000 words</span>
              </div>
              <Progress value={80} className="h-2" />
            </div>
          </div>
          
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Current Streak: <span className="font-medium">12 days</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Best Streak: <span className="font-medium">28 days</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdvancedVisualization;