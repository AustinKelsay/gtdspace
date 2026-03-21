import type { FileTab, MarkdownFile } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import { migrateMarkdownContent, needsMigration } from '@/utils/data-migration';
import { safeInvoke } from '@/utils/safe-invoke';

export async function readTabFile(filePath: string): Promise<string | null> {
  return safeInvoke<string>('read_file', { path: filePath }, null);
}

export async function loadTabForOpen(file: MarkdownFile): Promise<Pick<FileTab, 'content' | 'originalContent'>> {
  if (file.path === '::calendar::') {
    return {
      content: '',
      originalContent: '',
    };
  }

  let content = (await safeInvoke<string>('read_file', { path: file.path }, '')) || '';

  if (needsMigration(content)) {
    const migratedContent = migrateMarkdownContent(content);
    await safeInvoke<void>('save_file', { path: `${file.path}.backup`, content }, null);
    await safeInvoke<void>('save_file', { path: file.path, content: migratedContent }, null);
    content = migratedContent;

    const metadata = extractMetadata(content);
    emitContentSaved({
      filePath: file.path,
      fileName: file.name,
      content,
      metadata,
    });
    emitMetadataChange({
      filePath: file.path,
      fileName: file.name,
      content,
      metadata,
    });
  }

  return {
    content,
    originalContent: content,
  };
}

export async function saveTabFile(file: MarkdownFile, content: string): Promise<void> {
  const result = await safeInvoke<string>('save_file', { path: file.path, content }, null);
  if (result === null) {
    throw new Error('Failed to save file');
  }

  const metadata = extractMetadata(content);
  emitContentSaved({
    filePath: file.path,
    fileName: file.name,
    content,
    metadata,
  });
}

export async function emitReloadedTabContent(file: MarkdownFile, content: string): Promise<void> {
  const metadata = extractMetadata(content);

  emitContentSaved({
    filePath: file.path,
    fileName: file.name,
    content,
    metadata,
  });

  emitMetadataChange({
    filePath: file.path,
    fileName: file.name,
    content,
    metadata,
  });
}

export async function tabHasExternalConflict(tab: FileTab): Promise<boolean> {
  if (!tab.hasUnsavedChanges || tab.file.path === '::calendar::') {
    return false;
  }

  const currentFileContent = await readTabFile(tab.file.path);
  if (currentFileContent === null || currentFileContent === undefined) {
    throw new Error('Failed to read file');
  }

  const originalContent = tab.originalContent ?? tab.content;
  return currentFileContent !== originalContent;
}
