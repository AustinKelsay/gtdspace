import type React from 'react';
import type { GTDProject, GTDSpace, MarkdownFile } from '@/types';

export interface GTDWorkspaceSidebarProps {
  currentFolder: string | null;
  onFolderSelect: (folderPath: string) => void;
  onFileSelect: (file: MarkdownFile) => void;
  onRefresh: () => void;
  className?: string;
  gtdSpace?: GTDSpace | null;
  checkGTDSpace?: (path: string) => Promise<boolean>;
  loadProjects?: (path: string) => Promise<GTDProject[]>;
  activeFilePath?: string | null;
}

export interface GTDSection {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  aliases?: string[];
  description: string;
  color: string;
}

export type PageDialogDirectory = {
  path: string;
  name: string;
  sectionId: string;
  spacePath: string;
};

export type SidebarDeleteItem = {
  type: 'project' | 'action' | 'file';
  path: string;
  name: string;
};

export type SidebarProjectMetadata = {
  status?: string;
  title?: string;
  currentPath?: string;
  due_date?: string;
};

export type SidebarActionMetadata = SidebarProjectMetadata;

export type SidebarSectionFileMetadata = {
  title?: string;
  currentPath?: string;
};

export type SidebarSearchResults = {
  projects: GTDProject[];
  actions: Array<{ project: string; projectPath: string; actions: MarkdownFile[] }>;
  sections: Array<{ section: GTDSection; files: MarkdownFile[] }>;
};
