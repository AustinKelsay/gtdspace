/**
 * @fileoverview Custom BlockNote block for habit history tracking
 * @author Development Team
 * @created 2025-01-17
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define prop schema for history block
const historyPropSchema = {
  entries: {
    default: '', // Store as newline-separated list of entries
  },
} satisfies PropSchema;

interface HistoryEntry {
  date: string;
  time: string;
  status: string;
  action: string;
  notes: string;
}

// Parse a history entry string
function parseHistoryEntry(entry: string): HistoryEntry | null {
  // New table format: | 2025-09-01 | 8:40 PM | Complete | Manual | Changed from To Do |
  const tableMatch = entry.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/);
  if (tableMatch) {
    const cells = tableMatch.slice(1, 6).map((c) => c.trim());
    const header = cells.map((c) => c.toLowerCase());
    // Skip header row (supports "Notes" or "Details")
    if (
      header[0] === 'date' &&
      header[1] === 'time' &&
      header[2] === 'status' &&
      header[3] === 'action' &&
      (header[4] === 'notes' || header[4] === 'details')
    ) {
      return null;
    }
    return {
      date: cells[0],
      time: cells[1],
      status: cells[2],
      action: cells[3],
      notes: cells[4],
    };
  }

  // Old list format: - **2025-09-01** at **8:40 PM**: Complete (Manual - Changed from To Do)
  const listMatch = entry.match(/^- \*\*(\d{4}-\d{2}-\d{2})\*\* at \*\*([^*]+)\*\*: ([^(]+) \(([^)]+) - ([^)]+)\)$/);
  if (listMatch) {
    return {
      date: listMatch[1],
      time: listMatch[2],
      status: listMatch[3].trim(),
      action: listMatch[4],
      notes: listMatch[5],
    };
  }

  // Also support plain format without markdown
  const plainMatch = entry.match(/^- (\d{4}-\d{2}-\d{2}) at ([^:]+): ([^(]+) \(([^)]+) - ([^)]+)\)$/);
  if (plainMatch) {
    return {
      date: plainMatch[1],
      time: plainMatch[2],
      status: plainMatch[3].trim(),
      action: plainMatch[4],
      notes: plainMatch[5],
    };
  }

  return null;
}

// Get icon for status
function getStatusIcon(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus.includes('complete')) {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  } else if (normalizedStatus.includes('miss')) {
    return <XCircle className="h-4 w-4 text-red-600" />;
  } else {
    return <RefreshCw className="h-4 w-4 text-blue-600" />;
  }
}

// Get action badge color
function getActionColor(action: string) {
  const normalizedAction = action.toLowerCase();
  if (normalizedAction.includes('manual')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  } else if (normalizedAction.includes('auto')) {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  } else if (normalizedAction.includes('backfill')) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  } else {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

export const HistoryBlock = createReactBlockSpec(
  {
    type: 'history' as const,
    propSchema: historyPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const { block } = props;
      const entriesText = (block.props?.entries as string) || '';


      // Parse entries - support both list format (old) and table format (new)
      const entries = entriesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
          const isListRow = line.startsWith('-');
          const isTableRow = line.startsWith('|');
          // Divider-only lines: either only dashes, or markdown table separator (pipes + dashes/colons/spaces)
          const isDashOnlyDivider = /^-+$/.test(line);
          const isMarkdownTableDivider = /^\|\s*[:\-\s|]+\|\s*$/.test(line);
          const isDivider = isDashOnlyDivider || isMarkdownTableDivider;
          return (isListRow || isTableRow) && !isDivider;
        })
        .map(parseHistoryEntry)
        .filter((entry): entry is HistoryEntry => entry !== null);


      if (entries.length === 0) {
        return (
          <div className="my-2 p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="italic">No history entries yet</span>
            </div>
          </div>
        );
      }

      return (
        <div className="my-2 border rounded-lg bg-card overflow-hidden">
          <ScrollArea className="max-h-96">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="border-b">
                  <th className="text-left p-2 text-sm font-medium">Date</th>
                  <th className="text-left p-2 text-sm font-medium">Time</th>
                  <th className="text-left p-2 text-sm font-medium">Status</th>
                  <th className="text-left p-2 text-sm font-medium">Action</th>
                  <th className="text-left p-2 text-sm font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={index}
                    className="border-b hover:bg-accent/50 transition-colors"
                  >
                    <td className="p-2 text-sm">{entry.date}</td>
                    <td className="p-2 text-sm text-muted-foreground">{entry.time}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(entry.status)}
                        <span className="text-sm">{entry.status}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        getActionColor(entry.action)
                      )}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      );
    },
    toExternalHTML: () => {
      // Return null to let the markdown exporter handle it
      return null;
    },
    parse: (element) => {
      // Parse history content from HTML element
      const textContent = element.textContent || '';
      return {
        entries: textContent
      };
    },
  }
);

export default HistoryBlock;