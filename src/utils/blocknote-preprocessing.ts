/**
 * @fileoverview Preprocessing utilities for BlockNote editor
 * @author Development Team
 * @created 2025-01-XX
 */

// Using any for Block type due to complex type constraints in BlockNote

/**
 * Preprocesses markdown content to handle custom multiselect blocks
 * Converts custom HTML elements into BlockNote block format
 */
export function preprocessMarkdownForBlockNote(markdown: string): string {
  // Pattern to match our custom multiselect HTML
  // Pattern to match multiselect markers in markdown (e.g., [!multiselect:status:not-started])
  const multiSelectMarkerPattern = /\[!multiselect:([^:]+):([^\]]+)\]/g;
  // Pattern to match HTML multiselect blocks (legacy support)
  const multiSelectHTMLPattern = /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;
  
  let processedMarkdown = markdown;
  let match;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocksToInsert: Array<{ position: number; block: any }> = [];
  
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postProcessBlockNoteBlocks(blocks: any[], markdown: string): any[] {
  console.log('postProcessBlockNoteBlocks called');
  console.log('Number of blocks:', blocks.length);
  console.log('Markdown contains multiselect?', markdown.includes('data-multiselect'));
  console.log('Markdown contains singleselect?', markdown.includes('data-singleselect'));
  
  // Debug: Log all blocks to see what BlockNote parsed
  blocks.forEach((block, index) => {
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
  
  // Find all multiselect blocks in the original markdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multiSelectBlocks: Array<{ text: string; type: string; value: string[]; label?: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const singleSelectBlocks: Array<{ text: string; type: string; value: string; label?: string }> = [];
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
  
  console.log('Found multiselect blocks in markdown:', multiSelectBlocks.length);
  console.log('Found singleselect blocks in markdown:', singleSelectBlocks.length);
  
  if (multiSelectBlocks.length === 0 && singleSelectBlocks.length === 0) {
    console.log('No custom select blocks found, returning original blocks');
    return blocks;
  }
  
  // Process blocks and insert multiselect blocks where needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedBlocks: any[] = [];
  // let multiSelectIndex = 0; // Keeping for potential future use
  
  for (const block of blocks) {
    let blockReplaced = false;
    
    // Check if this block contains multiselect or singleselect markers or HTML
    if (block.type === 'paragraph' && block.content) {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
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
            // Replace this paragraph with a singleselect block
            processedBlocks.push({
              type: 'singleselect',
              props: {
                type: ssBlock.type || 'status',
                value: ssBlock.value || '',
                label: ssBlock.label || '',
                placeholder: '',
                customOptionsJson: '[]',
              },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            blockReplaced = true;
            console.log('Replaced paragraph with singleselect block:', ssBlock);
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
  
  return processedBlocks;
}

/**
 * Helper function to extract text from a block
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextFromBlock(block: any): string {
  if (!block.content) return '';
  
  if (typeof block.content === 'string') {
    return block.content;
  }
  
  if (Array.isArray(block.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return block.content.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item.text) return item.text;
      return '';
    }).join('');
  }
  
  return '';
}