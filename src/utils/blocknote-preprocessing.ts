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
    includeTime: boolean;
    label: string;
    optional: boolean;
  };
}

interface ReferencesBlock {
  type: 'references';
  props: {
    references: string; // comma-separated file paths
  };
}

type ProcessedBlock =
  | UnknownBlock
  | ParagraphBlock
  | MultiselectBlock
  | SingleselectBlock
  | CheckboxBlock
  | DatetimeBlock
  | ReferencesBlock;

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

/**
 * Post-processes BlockNote blocks after markdown parsing to insert custom blocks
 */
export function postProcessBlockNoteBlocks(blocks: unknown[], markdown: string): unknown[] {
  console.log('postProcessBlockNoteBlocks called');
  console.log('Number of blocks:', blocks.length);
  console.log('Markdown contains multiselect?', markdown.includes('data-multiselect'));
  console.log('Markdown contains singleselect?', markdown.includes('data-singleselect'));
  
  // Debug: Log all blocks to see what BlockNote parsed
  (blocks as UnknownBlock[]).forEach((block, index) => {
    console.log(`Block ${index}:`, {
      type: block.type,
      content: block.content,
      props: block.props,
      // Get text content if it's a paragraph
      text: block.type === 'paragraph' ? getTextFromBlock(block) : undefined
    });
  });
  
  // Pattern to match multiselect markers in markdown (e.g., [!multiselect:status:not-started])
  const multiSelectMarkerPattern = /\[!multiselect:([^:]+):([^\]]+)\]/g;
  // Pattern to match HTML multiselect blocks (legacy support)
  const multiSelectHTMLPattern = /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;
  
  // Pattern to match singleselect markers in markdown (e.g., [!singleselect:status:in-progress])
  const singleSelectMarkerPattern = /\[!singleselect:([^:]+):([^\]]+)\]/g;
  // Pattern to match HTML singleselect blocks
  const singleSelectHTMLPattern = /<div\s+data-singleselect='([^']+)'\s+class="singleselect-block">([^<]+)<\/div>/g;
  
  // Pattern to match checkbox markers in markdown (e.g., [!checkbox:habit-status:true])
  const checkboxMarkerPattern = /\[!checkbox:([^:]+):([^\]]+)\]/g;
  // Pattern to match HTML checkbox blocks
  const checkboxHTMLPattern = /<div\s+data-checkbox='([^']+)'\s+class="checkbox-block">([^<]+)<\/div>/g;
  
  // Pattern to match datetime markers in markdown (e.g., [!datetime:due_date:2025-01-17T10:30:00])
  const dateTimeMarkerPattern = /\[!datetime:([^:]+):([^\]]*)\]/g;
  // Pattern to match HTML datetime blocks
  const dateTimeHTMLPattern = /<div\s+data-datetime='([^']+)'\s+class="datetime-block">([^<]+)<\/div>/g;
  
  // Pattern to match references markers in markdown (e.g., [!references:path1.md,path2.md])
  const referencesMarkerPattern = /\[!references:([^\]]*)\]/g;
  // Pattern to match HTML references blocks
  const referencesHTMLPattern = /<div\s+data-references='([^']+)'\s+class="references-block">([^<]+)<\/div>/g;
  
  // Find all multiselect blocks in the original markdown
  const multiSelectBlocks: Array<{ text: string; type: string; value: string[]; label?: string }> = [];
  const singleSelectBlocks: Array<{ text: string; type: string; value: string; label?: string }> = [];
  const checkboxBlocks: Array<{ text: string; type: string; checked: boolean; label?: string }> = [];
  const dateTimeBlocks: Array<{ text: string; type: string; value: string; includeTime?: boolean; label?: string }> = [];
  const referencesBlocks: Array<{ text: string; references: string }> = [];
  let match;
  
  // First check for new marker syntax
  while ((match = multiSelectMarkerPattern.exec(markdown)) !== null) {
    const type = match[1];
    const value = match[2].split(',');
    const label = type === 'status' ? 'Status' : type === 'effort' ? 'Effort' : type === 'project-status' ? 'Project Status' : '';
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
      multiSelectBlocks.push({ 
        text: match[0], 
        type: data.type || 'status', 
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
    // Check if type ends with _time OR if the value contains time (T followed by time)
    const hasTimeInValue = value && value.includes('T') && /T\d{2}:\d{2}/.test(value);
    const includeTime = type.endsWith('_time') || hasTimeInValue;
    const baseType = includeTime ? type.replace('_time', '') : type;
    dateTimeBlocks.push({ text: match[0], type: baseType, value, includeTime });
  }
  
  // Check for datetime HTML syntax
  while ((match = dateTimeHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      // Normalize type and includeTime semantics
      const rawType = (data.type ?? 'due_date') as string;
      const includeTimeFromType = /_time$/.test(rawType);
      const normalizedType = rawType.replace(/_time$/, '');

      dateTimeBlocks.push({
        text: match[0],
        type: normalizedType,
        value: data.value ?? '',
        includeTime: data.includeTime ?? includeTimeFromType,
        label: data.label
      });
    } catch (e) {
      console.error('Error parsing datetime data:', e, 'JSON string:', match[1]);
    }
  }
  
  // Check for references marker syntax
  while ((match = referencesMarkerPattern.exec(markdown)) !== null) {
    const references = match[1];
    referencesBlocks.push({ text: match[0], references });
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
  
  console.log('Found multiselect blocks in markdown:', multiSelectBlocks.length);
  console.log('Found singleselect blocks in markdown:', singleSelectBlocks.length);
  console.log('Found checkbox blocks in markdown:', checkboxBlocks.length);
  console.log('Found datetime blocks in markdown:', dateTimeBlocks.length);
  console.log('Found references blocks in markdown:', referencesBlocks.length);
  
  if (multiSelectBlocks.length === 0 && singleSelectBlocks.length === 0 && checkboxBlocks.length === 0 && dateTimeBlocks.length === 0 && referencesBlocks.length === 0) {
    console.log('No custom blocks found, returning original blocks');
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
        if (blockText.includes(msBlock.text) || 
            blockText.includes(`[!multiselect:${msBlock.type}:`) ||
            (msBlock.label && blockText.includes(msBlock.label))) {
          // Replace this paragraph with a multiselect block
          processedBlocks.push({
            type: 'multiselect',
            props: {
              type: msBlock.type || 'status',
              value: (msBlock.value || []).join(','),
              label: msBlock.label || '',
              placeholder: '',
              maxCount: 0,
              customOptionsJson: '[]',
            },
          });
          blockReplaced = true;
          console.log('Replaced paragraph with multiselect block:', msBlock);
          break; // Exit the inner loop once we've replaced the block
        }
      }
      
      // Check if this paragraph contains our singleselect markers or HTML
      if (!blockReplaced) {
        for (const ssBlock of singleSelectBlocks) {
          if (blockText.includes(ssBlock.text) || 
              blockText.includes(`[!singleselect:${ssBlock.type}:`) ||
              (ssBlock.label && blockText.includes(ssBlock.label))) {
            // Special handling for habit-status: convert to checkbox block
            if (ssBlock.type === 'habit-status') {
              // Convert old habit status to checkbox
              const checked = ssBlock.value === 'complete' || ssBlock.value === 'true';
              processedBlocks.push({
                type: 'checkbox',
                props: {
                  type: 'habit-status',
                  checked: checked,
                  label: '',
                },
              });
              blockReplaced = true;
              console.log('Replaced habit-status singleselect with checkbox block:', { checked });
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
              console.log('Replaced paragraph with singleselect block:', ssBlock);
            }
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our checkbox markers or HTML
      if (!blockReplaced) {
        for (const cbBlock of checkboxBlocks) {
          if (blockText.includes(cbBlock.text) || 
              blockText.includes(`[!checkbox:${cbBlock.type}:`) ||
              (cbBlock.label && blockText.includes(cbBlock.label))) {
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
            console.log('Replaced paragraph with checkbox block:', cbBlock);
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our datetime markers or HTML
      if (!blockReplaced) {
        for (const dtBlock of dateTimeBlocks) {
          if (blockText.includes(dtBlock.text) || 
              blockText.includes(`[!datetime:${dtBlock.type}:`) ||
              (dtBlock.label && blockText.includes(dtBlock.label))) {
            // Replace this paragraph with a datetime block
            processedBlocks.push({
              type: 'datetime',
              props: {
                type: dtBlock.type || 'due_date',
                value: dtBlock.value || '',
                includeTime: dtBlock.includeTime || false,
                label: dtBlock.label || '',
                optional: true,
              },
            });
            blockReplaced = true;
            console.log('Replaced paragraph with datetime block:', dtBlock);
            break; // Exit the inner loop once we've replaced the block
          }
        }
      }
      
      // Check if this paragraph contains our references markers or HTML
      if (!blockReplaced) {
        for (const refBlock of referencesBlocks) {
          if (blockText.includes(refBlock.text) || 
              blockText.includes(`[!references:`) ||
              blockText.includes('References')) {
            // Replace this paragraph with a references block
            processedBlocks.push({
              type: 'references',
              props: {
                references: refBlock.references || '',
              },
            });
            blockReplaced = true;
            console.log('Replaced paragraph with references block:', refBlock);
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
  
  return processedBlocks as unknown[];
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