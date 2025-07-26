/**
 * @fileoverview Keyboard shortcuts modal wrapper
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Keyboard shortcuts modal
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import type { BaseComponentProps } from '@/types';

export interface KeyboardShortcutsModalProps extends BaseComponentProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
}

/**
 * Modal wrapper for keyboard shortcuts reference
 */
export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-3xl max-h-[80vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <KeyboardShortcuts />
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;