/**
 * @fileoverview Main application layout component for GTD Space
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Basic layout structure with sidebar and main content area
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import type { LayoutProps } from '@/types';

/**
 * Main application layout component
 * 
 * Provides the overall structure for the GTD Space application including
 * sidebar for file browser and main content area for editor. Implements
 * responsive design and theme support.
 * 
 * @param props - Layout configuration props
 * @returns Main layout JSX structure
 * 
 * @example
 * ```tsx
 * <Layout 
 *   sidebarOpen={true}
 *   onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
 * />
 * ```
 */
export const Layout: React.FC<LayoutProps> = ({
  sidebarOpen = true,
  onSidebarToggle,
  className = '',
  children
}) => {
  return (
    <div className={`flex h-screen bg-background text-foreground ${className}`}>
      {/* Sidebar - File Browser Area */}
      <aside 
        className={`sidebar transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden`}
      >
        <Sidebar 
          isOpen={sidebarOpen}
          onToggle={onSidebarToggle}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 editor-area">
          <Editor />
        </div>
      </main>

      {/* Children for modal overlays, dialogs, etc. */}
      {children}
    </div>
  );
};

export default Layout;