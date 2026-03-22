import type { FileTab, MarkdownFile } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import { migrateMarkdownContent, needsMigration } from '@/utils/data-migration';
import { createScopedLogger } from '@/utils/logger';
import { safeInvoke } from '@/utils/safe-invoke';
import { CALENDAR_FILE_ID } from '@/utils/special-files';

const log = createScopedLogger('tabRuntimeLifecycle');

function safelyNotifyTabSave(file: MarkdownFile, content: string): void {
  const metadata = extractMetadata(content);

  try {
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
    window.onTabFileSaved?.(file.path, file.name, content, metadata);
  } catch (error) {
    log.error('Failed to notify tab listeners', error);
  }
}

export async function readTabFile(filePath: string): Promise<string | null> {
  return safeInvoke<string>('read_file', { path: filePath }, null);
}

export async function loadTabForOpen(file: MarkdownFile): Promise<Pick<FileTab, 'content' | 'originalContent'>> {
  if (file.path === CALENDAR_FILE_ID) {
    return {
      content: '',
      originalContent: '',
    };
  }

  const initialContent = await safeInvoke<string>('read_file', { path: file.path }, null);
  if (initialContent == null) {
    throw new Error(`Failed to read file: ${file.path}`);
  }

  let content = initialContent;

  if (needsMigration(content)) {
    try {
      const migratedContent = migrateMarkdownContent(content);
      const backupResult = await safeInvoke<string>(
        'save_file',
        { path: `${file.path}.backup`, content },
        null,
      );
      if (backupResult === null) {
        throw new Error('Failed to save migration backup');
      }

      const migratedSaveResult = await safeInvoke<string>(
        'save_file',
        { path: file.path, content: migratedContent },
        null,
      );
      if (migratedSaveResult === null) {
        throw new Error('Failed to save migrated content');
      }

      content = migratedContent;

      safelyNotifyTabSave(file, content);
    } catch (error) {
      log.error('Failed to persist migrated tab content', error);
    }
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

  safelyNotifyTabSave(file, content);
}

export async function emitReloadedTabContent(file: MarkdownFile, content: string): Promise<void> {
  safelyNotifyTabSave(file, content);
}

export async function tabHasExternalConflict(tab: FileTab): Promise<boolean> {
  if (!tab.hasUnsavedChanges || tab.file.path === CALENDAR_FILE_ID) {
    return false;
  }

  const currentFileContent = await readTabFile(tab.file.path);
  if (currentFileContent === null || currentFileContent === undefined) {
    throw new Error('Failed to read file');
  }

  const originalContent = tab.originalContent ?? tab.content;
  return currentFileContent !== originalContent;
}
