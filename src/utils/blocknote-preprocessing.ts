/**
 * @fileoverview Preprocessing utilities for BlockNote editor
 * @author Development Team
 * @created 2025-01-XX
 */

// Local minimal BlockNote-like types to avoid using `any`
type TextChild = string | { text?: string; type?: string };

interface UnknownBlock {
  id?: string;
  type: string;
  content?: unknown;
  props?: Record<string, unknown>;
}

interface ParagraphBlock {
  type: 'paragraph';
  content?: TextChild[] | string;
  props?: Record<string, unknown>;
}

interface MultiselectBlock {
  type: 'multiselect';
  props: {
    type: string;
    value: string; // comma-separated values
    label: string;
    placeholder: string;
    maxCount: number;
    customOptionsJson: string;
  };
}

interface SingleselectBlock {
  type: 'singleselect';
  props: {
    type: string;
    value: string;
    label: string;
    placeholder: string;
    customOptionsJson: string;
  };
}

interface CheckboxBlock {
  type: 'checkbox';
  props: {
    type: string;
    checked: boolean;
    label: string;
  };
}

interface DatetimeBlock {
  type: 'datetime';
  props: {
    type: string;
    value: string;
    label: string;
    optional: boolean;
  };
}

interface ReferencesBlock {
  type: 'references' | 'areas-references' | 'goals-references' | 'vision-references' | 'purpose-references';
  props: {
    references: string; // comma-separated file paths
  };
}

interface ListBlock {
  type: 'projects-list' | 'areas-list' | 'goals-list' | 'visions-list' | 
        'projects-and-areas-list' | 'goals-and-areas-list' | 'visions-and-goals-list';
  props: {
    listType: string;
    currentPath?: string;
  };
}

type ProcessedBlock =
  | UnknownBlock
  | ParagraphBlock
  | MultiselectBlock
  | SingleselectBlock
  | CheckboxBlock
  | DatetimeBlock
  | ReferencesBlock
  | ListBlock;

function isParagraphBlock(block: UnknownBlock): block is ParagraphBlock {
  return block.type === 'paragraph';
}

/**
 * Preprocesses markdown content to handle custom multiselect blocks
 * Converts custom HTML elements into BlockNote block format
 */
export function preprocessMarkdownForBlockNote(markdown: string): string {
  // Pattern to match HTML multiselect blocks (legacy support)
  const multiSelectHTMLPattern = /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;
  
  let processedMarkdown = markdown;
  let match;
  const blocksToInsert: Array<{ position: number; block: { type: string; props: Record<string, unknown> } }> = [];
  
  while ((match = multiSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      const jsonData = match[1];
      // const textContent = match[2]; // Keeping for potential future use
      const data = JSON.parse(jsonData);
      
      // Create a placeholder that BlockNote can replace
      const placeholder = `{{MULTISELECT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}}}`;
      
      // Replace the HTML with the placeholder
      processedMarkdown = processedMarkdown.replace(match[0], placeholder);
      
      // Store the block data for later insertion
      blocksToInsert.push({
        position: processedMarkdown.indexOf(placeholder),
        block: {
          type: 'multiselect',
          props: {
            type: data.type || 'status',
            value: (data.value || []).join(','),
            label: data.label || '',
            placeholder: data.placeholder || '',
            maxCount: data.maxCount || 0,
            customOptionsJson: JSON.stringify(data.customOptions || []),
          },
        },
      });
    } catch (e) {
      console.error('Error parsing multiselect HTML:', e);
    }
  }
  
  return processedMarkdown;
}

// Cache for memoization
const blockProcessingCache = new Map<string, { blocks: unknown[]; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 second cache to allow for reasonable updates

// Cross-environment base64 encoding helper
function toBase64(str: string): string {
  // Ensure we have a string input
  const input = String(str);
  
  // Use btoa if available (browser environment)
  if (typeof btoa !== 'undefined') {
    return btoa(input);
  }
  
  // Fallback to Buffer for Node.js environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).Buffer.from(input, 'utf-8').toString('base64');
  }
  
  // If neither is available, use a simple hash alternative
  // This provides a stable but non-base64 hash for testing environments
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Create a hash of the content for efficient caching - focus on structural elements
function createContentHash(markdown: string, blockCount: number): string {
  // Extract only GTD field markers and structural elements for stable caching
  const gtdFieldMarkers = markdown.match(/\[!(?:multiselect|singleselect|checkbox|datetime|references|areas-references|goals-references|vision-references|purpose-references|projects-list|areas-list|goals-list|visions-list|projects-areas-list|goals-areas-list|visions-goals-list|projects-and-areas-list|goals-and-areas-list|visions-and-goals-list):[^\]]*\]/g) || [];
  
  // Create a structural signature based on:
  // 1. Block count (structural changes)
  // 2. GTD field markers (what we actually process)
  // 3. Number of each type of marker (for changes in GTD fields)
  const structuralElements = gtdFieldMarkers.join('|');
  const gtdFieldCount = gtdFieldMarkers.length;
  
  // For empty content or no GTD fields, include content hash to detect changes
  if (gtdFieldCount === 0) {
    // Include a lightweight content hash to detect changes in non-GTD content
    const contentHash = toBase64(markdown.trim()).slice(0, 8);
    return `empty-${blockCount}-${contentHash}`;
  }
  
  // Create hash that's stable for text-only changes but changes for structural modifications
  const structuralHash = toBase64(structuralElements).slice(0, 12);
  return `${blockCount}-${gtdFieldCount}-${structuralHash}`;
}

/**
 * Post-processes BlockNote blocks after markdown parsing to insert custom blocks
 * Now memoized to prevent excessive re-processing during typing
 */
export function postProcessBlockNoteBlocks(blocks: unknown[], markdown: string): unknown[] {
  // Create cache key
  const cacheKey = createContentHash(markdown, blocks.length);
  const now = Date.now();
  
  // Check cache first
  const cached = blockProcessingCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.blocks;
  }
  
  // Clean up old cache entries periodically
  if (blockProcessingCache.size > 50) {
    for (const [key, value] of blockProcessingCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        blockProcessingCache.delete(key);
      }
    }
  }
  
  // Only log when actually processing (not using cache)
  if (import.meta.env.DEV) {
    console.log('postProcessBlockNoteBlocks: Processing new content');
  }
  
  // Only log block details in development and when actually processing
  if (import.meta.env.DEV) {
    console.log('Number of blocks:', blocks.length);
  }
  
  // Pattern to match multiselect markers in markdown (e.g., [!multiselect:tags:urgent,important])
  const multiSelectMarkerPattern = /\[!multiselect:([^:]+):([^\]]*)\]/g;
  // Pattern to match HTML multiselect blocks (legacy support)
  const multiSelectHTMLPattern = /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;
  
  // Pattern to match singleselect markers in markdown (e.g., [!singleselect:status:in-progress])
  const singleSelectMarkerPattern = /\[!singleselect:([^:]+):([^\]]*)\]/g;
  // Pattern to match HTML singleselect blocks
  const singleSelectHTMLPattern = /<div\s+data-singleselect='([^']+)'\s+class="singleselect-block">([^<]+)<\/div>/g;
  
  // Pattern to match checkbox markers in markdown (e.g., [!checkbox:habit-status:true])
  const checkboxMarkerPattern = /\[!checkbox:([^:]+):([^\]]*)\]/g;
  // Pattern to match HTML checkbox blocks
  const checkboxHTMLPattern = /<div\s+data-checkbox='([^']+)'\s+class="checkbox-block">([^<]+)<\/div>/g;
  
  // Pattern to match datetime markers in markdown (e.g., [!datetime:due_date:2025-01-17T10:30:00])
  const dateTimeMarkerPattern = /\[!datetime:([^:]+):([^\]]*)\]/g;
  // Pattern to match HTML datetime blocks
  const dateTimeHTMLPattern = /<div\s+data-datetime='([^']+)'\s+class="datetime-block">([^<]+)<\/div>/g;
  
  // Pattern to match references markers in markdown (e.g., [!references:path1.md,path2.md])
  // Note: Specifically look for [! prefix to avoid matching regular markdown lists
  const referencesMarkerPattern = /\[!references:([^\]]*)\]/g;
  // Pattern to match horizon references markers
  const areasReferencesPattern = /\[!areas-references:([^\]]*)\]/g;
  const goalsReferencesPattern = /\[!goals-references:([^\]]*)\]/g;
  const visionReferencesPattern = /\[!vision-references:([^\]]*)\]/g;
  const purposeReferencesPattern = /\[!purpose-references:([^\]]*)\]/g;
  // Pattern to match list markers in markdown (e.g., [!projects-list])
  const projectsListPattern = /\[!projects-list\]/g;
  const areasListPattern = /\[!areas-list\]/g;
  const goalsListPattern = /\[!goals-list\]/g;
  const visionsListPattern = /\[!visions-list\]/g;
  const projectsAreasListPattern = /\[!projects-areas-list\]/g;
  const goalsAreasListPattern = /\[!goals-areas-list\]/g;
  const visionsGoalsListPattern = /\[!visions-goals-list\]/g;
  // New patterns with "and" for compatibility
  const projectsAndAreasListPattern = /\[!projects-and-areas-list\]/g;
  const goalsAndAreasListPattern = /\[!goals-and-areas-list\]/g;
  const visionsAndGoalsListPattern = /\[!visions-and-goals-list\]/g;
  // Pattern to match HTML references blocks
  const referencesHTMLPattern = /<div\s+data-references='([^']+)'\s+class="references-block">([^<]+)<\/div>/g;
  
  // Find all multiselect blocks in the original markdown
  const multiSelectBlocks: Array<{ text: string; type: string; value: string[]; label?: string }> = [];
  const singleSelectBlocks: Array<{ text: string; type: string; value: string; label?: string }> = [];
  const checkboxBlocks: Array<{ text: string; type: string; checked: boolean; label?: string }> = [];
  const dateTimeBlocks: Array<{ text: string; type: string; value: string; label?: string }> = [];
  const referencesBlocks: Array<{ text: string; references: string; blockType?: string }> = [];
  let match;
  
  // First check for new marker syntax
  while ((match = multiSelectMarkerPattern.exec(markdown)) !== null) {
    const type = match[1];
    if (['status', 'effort', 'project-status'].includes(type)) {
        console.warn(`Legacy multiselect type "${type}" found in markdown. Skipping.`);
        continue;
    }
    const value = match[2].split(',');
    const label = type === 'tags' ? 'Tags' : type === 'contexts' ? 'Contexts' : type === 'categories' ? 'Categories' : '';
    multiSelectBlocks.push({ text: match[0], type, value, label });
  }
  
  // Also check for HTML syntax (for existing files)
  while ((match = multiSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      // Handle both escaped and unescaped JSON
      let jsonStr = match[1];
      // Replace escaped quotes with regular quotes if they exist
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      const type = data.type || 'tags';
      if (['status', 'effort', 'project-status'].includes(type)) {
        console.warn(`Legacy multiselect type "${type}" found in HTML. Skipping.`);
        continue;
      }
      multiSelectBlocks.push({ 
        text: match[0], 
        type: type, 
        value: data.value || [], 
        label: data.label 
      });
    } catch (e) {
      console.error('Error parsing multiselect data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Check for single select marker syntax
  while ((match = singleSelectMarkerPattern.exec(markdown)) !== null) {
    const type = match[1];
    const value = match[2];
    const label = type === 'status' ? 'Status' : type === 'effort' ? 'Effort' : type === 'project-status' ? 'Project Status' : '';
    singleSelectBlocks.push({ text: match[0], type, value, label });
  }
  
  // Check for single select HTML syntax
  while ((match = singleSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      singleSelectBlocks.push({ 
        text: match[0], 
        type: data.type || 'status', 
        value: data.value || '', 
        label: data.label 
      });
    } catch (e) {
      console.error('Error parsing singleselect data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Check for checkbox marker syntax
  while ((match = checkboxMarkerPattern.exec(markdown)) !== null) {
    const type = match[1];
    const checked = match[2] === 'true';
    checkboxBlocks.push({ text: match[0], type, checked });
  }
  
  // Check for checkbox HTML syntax
  while ((match = checkboxHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      checkboxBlocks.push({ 
        text: match[0], 
        type: data.type || 'habit-status', 
        checked: data.checked || false,
        label: data.label 
      });
    } catch (e) {
      console.error('Error parsing checkbox data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Check for datetime marker syntax
  while ((match = dateTimeMarkerPattern.exec(markdown)) !== null) {
    const type = match[1];
    const value = match[2];
    // Preserve the original type string - don't strip _time suffix
    dateTimeBlocks.push({ text: match[0], type: type, value });
  }
  
  // Check for datetime HTML syntax
  while ((match = dateTimeHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      // Preserve the original full type from HTML data
      const rawType = (data.type ?? 'due_date') as string;

      dateTimeBlocks.push({
        text: match[0],
        type: rawType,
        value: data.value ?? '',
        label: data.label
      });
    } catch (e) {
      console.error('Error parsing datetime data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Check for references marker syntax
  while ((match = referencesMarkerPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references, blockType: 'references' });
  }
  
  // Check for horizon references markers
  while ((match = areasReferencesPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references, blockType: 'areas-references' });
  }
  
  while ((match = goalsReferencesPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references, blockType: 'goals-references' });
  }
  
  while ((match = visionReferencesPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references, blockType: 'vision-references' });
  }
  
  while ((match = purposeReferencesPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references, blockType: 'purpose-references' });
  }
  
  // Check for list markers
  const listBlocks: Array<{ text: string; listType: string; blockType: string }> = [];
  
  while ((match = projectsListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'projects', blockType: 'projects-list' });
  }
  
  while ((match = areasListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'areas', blockType: 'areas-list' });
  }
  
  while ((match = goalsListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'goals', blockType: 'goals-list' });
  }
  
  while ((match = visionsListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'visions', blockType: 'visions-list' });
  }
  
  while ((match = projectsAreasListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'projects', blockType: 'projects-areas-list' });
  }
  
  while ((match = goalsAreasListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'goals', blockType: 'goals-areas-list' });
  }
  
  while ((match = visionsGoalsListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'visions', blockType: 'visions-goals-list' });
  }
  
  // New patterns with "and" for compatibility
  while ((match = projectsAndAreasListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'projects', blockType: 'projects-and-areas-list' });
  }
  
  while ((match = goalsAndAreasListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'goals', blockType: 'goals-and-areas-list' });
  }
  
  while ((match = visionsAndGoalsListPattern.exec(markdown)) !== null) {
    listBlocks.push({ text: match[0], listType: 'visions', blockType: 'visions-and-goals-list' });
  }
  
  // Check for references HTML syntax
  while ((match = referencesHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      referencesBlocks.push({
        text: match[0],
        references: data.references || ''
      });
    } catch (e) {
      console.error('Error parsing references data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Log summary only in development
  if (import.meta.env.DEV) {
    const totalCustomBlocks = multiSelectBlocks.length + singleSelectBlocks.length + 
                              checkboxBlocks.length + dateTimeBlocks.length + referencesBlocks.length;
    if (totalCustomBlocks > 0) {
      console.log(`Found ${totalCustomBlocks} custom GTD blocks to process`);
    }
  }
  
  if (multiSelectBlocks.length === 0 && singleSelectBlocks.length === 0 && checkboxBlocks.length === 0 && dateTimeBlocks.length === 0 && referencesBlocks.length === 0) {
    // Cache the result even if no processing needed
    blockProcessingCache.set(cacheKey, { blocks, timestamp: now });
    return blocks;
  }
  
  // Process blocks and insert multiselect blocks where needed
  const processedBlocks: ProcessedBlock[] = [];
  // let multiSelectIndex = 0; // Keeping for potential future use
  
  for (const block of blocks as UnknownBlock[]) {
    let blockReplaced = false;
    
    // Check if this block contains multiselect or singleselect markers or HTML
    if (isParagraphBlock(block) && block.content) {
      const blockText = getTextFromBlock(block);
      
      // Check if this paragraph contains our multiselect markers or HTML
      for (const msBlock of multiSelectBlocks) {
        // Use exact-token match to avoid partial replacements
        const normalizedBlockText = (blockText ?? '').trim();
        const normalizedMSText = (msBlock.text ?? '').trim();
        if (normalizedMSText.length > 0 && normalizedBlockText === normalizedMSText) {
          // Replace this paragraph with a multiselect block
          processedBlocks.push({
            type: 'multiselect',
            props: {
              type: msBlock.type || 'tags',
              value: (msBlock.value || []).join(','),
              label: msBlock.label || '',
              placeholder: '',
              maxCount: 0,
              customOptionsJson: '[]',
            },
          });
          blockReplaced = true;
          // Multiselect block replaced
          break; // Exit the inner loop once we've replaced the block
        }
      }
      
      // Check if this paragraph contains our singleselect markers or HTML
      if (!blockReplaced) {
        for (const ssBlock of singleSelectBlocks) {
          // Only match on exact text, not partial matches or labels
          const normalizedBlockText = (blockText ?? '').trim();
          const normalizedSSText = (ssBlock.text ?? '').trim();
          if (normalizedSSText.length > 0 && normalizedBlockText === normalizedSSText) {
            // Special handling for habit-status: convert to checkbox block
            if (ssBlock.type === 'habit-status') {
              // Convert old habit status to checkbox
              const checked = ssBlock.value === 'completed' || ssBlock.value === 'true';
              processedBlocks.push({
                type: 'checkbox',
                props: {
                  type: 'habit-status',
                  checked: checked,
                  label: '',
                },
              });
              blockReplaced = true;
              // Habit status converted to checkbox
            } else {
              // Keep as singleselect for other types
              processedBlocks.push({
                type: 'singleselect',
                props: {
                  type: ssBlock.type || 'status',
                  value: ssBlock.value || '',
                  label: ssBlock.label || '',
                  placeholder: '',
                  customOptionsJson: '[]',
                },
              });
              blockReplaced = true;
              // Singleselect block replaced
            }
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our checkbox markers or HTML
      if (!blockReplaced) {
        for (const cbBlock of checkboxBlocks) {
          // Only match on exact text, not partial matches or labels
          const normalizedCBText = (cbBlock.text ?? '').trim();
          const normalizedBlockText = (blockText ?? '').trim();
          if (normalizedCBText.length > 0 && normalizedBlockText === normalizedCBText) {
            // Replace this paragraph with a checkbox block
            processedBlocks.push({
              type: 'checkbox',
              props: {
                type: cbBlock.type || 'habit-status',
                checked: cbBlock.checked || false,
                label: cbBlock.label || '',
              },
            });
            blockReplaced = true;
            // Checkbox block replaced
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our datetime markers or HTML
      if (!blockReplaced) {
        for (const dtBlock of dateTimeBlocks) {
          // Only match on exact text match (trimmed for whitespace tolerance)
          if (dtBlock.text && blockText.trim() === dtBlock.text.trim()) {
            // Replace this paragraph with a datetime block
            processedBlocks.push({
              type: 'datetime',
              props: {
                type: dtBlock.type || 'due_date',
                value: dtBlock.value || '',
                label: dtBlock.label || '',
                optional: true,
              },
            });
            blockReplaced = true;
            // DateTime block replaced
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our references markers or HTML
      if (!blockReplaced) {
        for (const refBlock of referencesBlocks) {
          // Only match if the text exactly equals our custom syntax
          // refBlock.text should be the full match like "[!references:...]"
          // Use exact match to prevent partial replacements
          const normalizedRefText = (refBlock.text ?? '').trim();
          const normalizedBlockText = (blockText ?? '').trim();
          if (normalizedRefText.length > 0 && normalizedBlockText === normalizedRefText) {
            // Replace this paragraph with a references block
            processedBlocks.push({
              type: (refBlock.blockType || 'references') as ReferencesBlock['type'],
              props: {
                references: refBlock.references || '',
              },
            });
            blockReplaced = true;
            // References block replaced
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our list markers
      if (!blockReplaced) {
        for (const listBlock of listBlocks) {
          // Only match if the text explicitly contains our exact custom syntax
          // listBlock.text should be the full match like "[!projects-list]"
          // We should only match on the exact text, not on partial matches
          if (listBlock.text && blockText.trim() === listBlock.text.trim()) {
            // Replace this paragraph with a list block
            processedBlocks.push({
              type: listBlock.blockType as ListBlock['type'],
              props: {
                listType: listBlock.listType,
              },
            });
            blockReplaced = true;
            // List block replaced
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
    }
    
    // Only add the original block if it wasn't replaced
    if (!blockReplaced) {
      processedBlocks.push(block);
    }
  }
  
  // Cache the processed result
  const result = processedBlocks as unknown[];
  blockProcessingCache.set(cacheKey, { blocks: result, timestamp: now });
  
  return result;
}

/**
 * Helper function to extract text from a block
 */
function getTextFromBlock(block: ParagraphBlock | UnknownBlock): string {
  if (!block.content) return '';
  
  if (typeof (block as ParagraphBlock).content === 'string') {
    return (block as ParagraphBlock).content as string;
  }
  
  if (Array.isArray((block as ParagraphBlock).content)) {
    const arr = (block as ParagraphBlock).content as TextChild[];
    return arr.map((item: { text?: string; type?: string } | string) => {
      if (typeof item === 'string') return item;
      if (item.text) return item.text;
      return '';
    }).join('');
  }
  
  return '';
}