/**
 * @fileoverview Document statistics component showing word count, reading time, and more
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useMemo } from 'react';
import { Clock, FileText, Hash, Target, Calendar, BarChart3 } from 'lucide-react';

// Internal imports
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Document statistics data
 */
interface DocumentStatsData {
  /** Total word count */
  wordCount: number;
  /** Total character count (with spaces) */
  characterCount: number;
  /** Total character count (without spaces) */
  characterCountNoSpaces: number;
  /** Total paragraph count */
  paragraphCount: number;
  /** Total heading count */
  headingCount: number;
  /** Total line count */
  lineCount: number;
  /** Estimated reading time in minutes */
  readingTimeMinutes: number;
  /** Estimated speaking time in minutes */
  speakingTimeMinutes: number;
  /** Most common words */
  topWords: Array<{ word: string; count: number }>;
  /** Reading difficulty score (0-100, higher = more difficult) */
  difficultyScore: number;
  /** Average words per sentence */
  averageWordsPerSentence: number;
  /** Average sentence length */
  averageSentenceLength: number;
}

/**
 * Props for the DocumentStats component
 */
interface DocumentStatsProps {
  /** Document content to analyze */
  content: string;
  /** Whether to show detailed statistics */
  showDetailed?: boolean;
  /** Whether to show reading analytics */
  showAnalytics?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

// === CONSTANTS ===
/**
 * Average reading speed in words per minute
 */
const READING_SPEED_WPM = 200;

/**
 * Average speaking speed in words per minute
 */
const SPEAKING_SPEED_WPM = 150;

/**
 * Common words to exclude from top words analysis
 */
const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
  'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would',
  'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
  'who', 'get', 'which', 'go', 'when', 'make', 'can', 'like',
  'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our',
  'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are',
  'been', 'has', 'had', 'were', 'said', 'each', 'which', 'she',
  'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about',
  'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her',
  'would', 'make', 'like', 'into', 'him', 'time', 'has', 'two',
  'more', 'very', 'what', 'know', 'just', 'first', 'get', 'over',
  'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still',
  'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through',
  'when', 'where', 'much', 'go', 'me', 'back', 'with', 'well', 'were'
]);

// === UTILITY FUNCTIONS ===
/**
 * Strips markdown formatting from text
 */
function stripMarkdown(content: string): string {
  return content
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Remove HTML tags if any
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates reading difficulty score using Flesch Reading Ease
 */
function calculateDifficultyScore(_text: string, avgWordsPerSentence: number, avgSyllablesPerWord: number): number {
  // Flesch Reading Ease formula: 206.835 - (1.015 × ASL) - (84.6 × ASW)
  // Where ASL = Average Sentence Length, ASW = Average Syllables per Word
  const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

  // Convert to 0-100 scale where higher = more difficult (inverse of Flesch)
  return Math.max(0, Math.min(100, 100 - fleschScore));
}

/**
 * Estimates syllables in a word (simplified)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let syllables = vowelGroups ? vowelGroups.length : 1;

  // Subtract silent e
  if (word.endsWith('e')) syllables--;

  // Ensure at least 1 syllable
  return Math.max(1, syllables);
}

/**
 * Analyzes document content and returns statistics
 */
function analyzeContent(content: string): DocumentStatsData {
  if (!content.trim()) {
    return {
      wordCount: 0,
      characterCount: 0,
      characterCountNoSpaces: 0,
      paragraphCount: 0,
      headingCount: 0,
      lineCount: 0,
      readingTimeMinutes: 0,
      speakingTimeMinutes: 0,
      topWords: [],
      difficultyScore: 0,
      averageWordsPerSentence: 0,
      averageSentenceLength: 0,
    };
  }

  // Strip markdown for analysis
  const plainText = stripMarkdown(content);

  // Basic counts
  const characterCount = content.length;
  const characterCountNoSpaces = content.replace(/\s/g, '').length;
  const lineCount = content.split('\n').length;

  // Count paragraphs (non-empty lines)
  const paragraphCount = content.split('\n').filter(line => line.trim().length > 0).length;

  // Count headings
  const headingMatches = content.match(/^#{1,6}\s+/gm);
  const headingCount = headingMatches ? headingMatches.length : 0;

  // Word analysis
  const words = plainText.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const wordCount = words.length;

  // Sentence analysis
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const averageSentenceLength = sentenceCount > 0 ? plainText.length / sentenceCount : 0;

  // Calculate reading times
  const readingTimeMinutes = Math.ceil(wordCount / READING_SPEED_WPM);
  const speakingTimeMinutes = Math.ceil(wordCount / SPEAKING_SPEED_WPM);

  // Top words analysis
  const wordFreq = words.reduce((freq, word) => {
    if (!COMMON_WORDS.has(word) && word.length > 2) {
      freq[word] = (freq[word] || 0) + 1;
    }
    return freq;
  }, {} as Record<string, number>);

  const topWords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  // Calculate difficulty score
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgSyllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;
  const difficultyScore = calculateDifficultyScore(plainText, averageWordsPerSentence, avgSyllablesPerWord);

  return {
    wordCount,
    characterCount,
    characterCountNoSpaces,
    paragraphCount,
    headingCount,
    lineCount,
    readingTimeMinutes,
    speakingTimeMinutes,
    topWords,
    difficultyScore,
    averageWordsPerSentence,
    averageSentenceLength,
  };
}

// === MAIN COMPONENT ===
/**
 * Document statistics component showing comprehensive document metrics
 * 
 * Analyzes document content to provide insights including word count,
 * reading time, difficulty score, and content structure analysis.
 * 
 * Features:
 * - Basic statistics (words, characters, paragraphs)
 * - Reading and speaking time estimates
 * - Content difficulty analysis
 * - Top words frequency analysis
 * - Document structure metrics
 * - Compact and detailed display modes
 * 
 * @param props - Component props
 * @returns JSX element containing document statistics
 * 
 * @example
 * ```tsx
 * <DocumentStats
 *   content={documentContent}
 *   showDetailed={true}
 *   showAnalytics={true}
 *   compact={false}
 * />
 * ```
 */
export const DocumentStats: React.FC<DocumentStatsProps> = ({
  content,
  showDetailed = false,
  showAnalytics = false,
  className,
  compact = false,
}) => {
  // === MEMOIZED VALUES ===

  /**
   * Analyzed document statistics
   */
  const stats = useMemo(() => analyzeContent(content), [content]);

  // === RENDER HELPERS ===

  /**
   * Renders a stat item
   */
  const renderStatItem = (
    icon: React.ReactNode,
    label: string,
    value: string | number,
    subtitle?: string
  ) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  );

  /**
   * Renders compact stat item
   */
  const renderCompactStatItem = (
    icon: React.ReactNode,
    value: string | number,
    label: string
  ) => (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm">
        <span className="font-medium">{value}</span>
        <span className="text-muted-foreground ml-1">{label}</span>
      </span>
    </div>
  );

  /**
   * Gets difficulty level description
   */
  const getDifficultyLevel = (score: number): { level: string; color: string } => {
    if (score < 30) return { level: 'Very Easy', color: 'text-green-600' };
    if (score < 50) return { level: 'Easy', color: 'text-green-500' };
    if (score < 60) return { level: 'Standard', color: 'text-yellow-500' };
    if (score < 70) return { level: 'Fairly Difficult', color: 'text-orange-500' };
    if (score < 80) return { level: 'Difficult', color: 'text-red-500' };
    return { level: 'Very Difficult', color: 'text-red-600' };
  };

  // === MAIN RENDER ===

  if (compact) {
    return (
      <div className={cn('document-stats-compact', className)}>
        <div className="flex items-center gap-4 text-xs">
          {renderCompactStatItem(<FileText className="w-3 h-3" />, stats.wordCount.toLocaleString(), 'words')}
          {renderCompactStatItem(<Clock className="w-3 h-3" />, stats.readingTimeMinutes, 'min read')}
          {showDetailed && renderCompactStatItem(<Hash className="w-3 h-3" />, stats.headingCount, 'headings')}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('document-stats p-4', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Document Statistics
          </span>
        </div>

        {/* Basic Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderStatItem(
            <FileText className="w-4 h-4" />,
            'Words',
            stats.wordCount.toLocaleString(),
            `${stats.characterCount.toLocaleString()} characters`
          )}

          {renderStatItem(
            <Clock className="w-4 h-4" />,
            'Reading Time',
            `${stats.readingTimeMinutes} min`,
            `${stats.speakingTimeMinutes} min speaking`
          )}

          {showDetailed && (
            <>
              {renderStatItem(
                <Hash className="w-4 h-4" />,
                'Structure',
                `${stats.headingCount} headings`,
                `${stats.paragraphCount} paragraphs`
              )}

              {renderStatItem(
                <Target className="w-4 h-4" />,
                'Lines',
                stats.lineCount.toLocaleString(),
                `${stats.characterCountNoSpaces.toLocaleString()} chars (no spaces)`
              )}
            </>
          )}
        </div>

        {/* Analytics Section */}
        {showAnalytics && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Reading Analytics</div>

            {/* Difficulty Score */}
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Reading Difficulty</div>
                <div className={cn(
                  'text-sm font-medium',
                  getDifficultyLevel(stats.difficultyScore).color
                )}>
                  {getDifficultyLevel(stats.difficultyScore).level}
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${stats.difficultyScore}%`,
                    backgroundColor: stats.difficultyScore < 50
                      ? '#10b981'
                      : stats.difficultyScore < 70
                        ? '#f59e0b'
                        : '#ef4444'
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(stats.averageWordsPerSentence)} avg words/sentence
              </div>
            </div>

            {/* Top Words */}
            {stats.topWords.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-sm font-medium mb-2">Most Used Words</div>
                <div className="flex flex-wrap gap-2">
                  {stats.topWords.map(({ word, count }) => (
                    <div
                      key={word}
                      className="px-2 py-1 bg-muted rounded text-xs"
                    >
                      <span className="font-mono">{word}</span>
                      <span className="text-muted-foreground ml-1">({count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Last Updated */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Updated {new Date().toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// === EXPORTS ===
export default DocumentStats;