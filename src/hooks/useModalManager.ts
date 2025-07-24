/**
 * @fileoverview Modal manager hook for centralized modal state management
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Consolidation of modal states
 */

import { useState, useCallback } from 'react';

/**
 * Available modal types in the application
 */
export type ModalType = 
  | 'settings'
  | 'globalSearch'
  | 'commandPalette'
  | 'writingMode'
  | 'debugPanel'
  | 'helpDocumentation'
  | 'keyboardShortcuts'
  | 'analytics'
  | null;

/**
 * Modal manager state
 */
export interface ModalManagerState {
  /** Currently open modal (null if none) */
  activeModal: ModalType;
  /** Whether any modal is currently open */
  isAnyModalOpen: boolean;
}

/**
 * Modal manager hook result
 */
export interface UseModalManagerResult {
  /** Current modal state */
  state: ModalManagerState;
  /** Whether a specific modal is open */
  isModalOpen: (modalType: ModalType) => boolean;
  /** Open a specific modal */
  openModal: (modalType: ModalType) => void;
  /** Close the currently open modal */
  closeModal: () => void;
  /** Close a specific modal (same as closeModal but more explicit) */
  closeSpecificModal: (modalType: ModalType) => void;
  /** Toggle a specific modal */
  toggleModal: (modalType: ModalType) => void;
}

/**
 * Hook for managing modal states across the application
 * 
 * Provides a centralized way to manage multiple modal states, ensuring
 * only one modal can be open at a time and providing consistent
 * open/close/toggle functionality.
 * 
 * @returns Modal manager state and operations
 * 
 * @example
 * ```tsx
 * const { 
 *   isModalOpen, 
 *   openModal, 
 *   closeModal 
 * } = useModalManager();
 * 
 * // Check if settings modal is open
 * const isSettingsOpen = isModalOpen('settings');
 * 
 * // Open settings modal
 * const handleOpenSettings = () => openModal('settings');
 * 
 * // Close any open modal
 * const handleClose = () => closeModal();
 * ```
 */
export function useModalManager(): UseModalManagerResult {
  // === STATE ===
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // === COMPUTED STATE ===
  
  const state: ModalManagerState = {
    activeModal,
    isAnyModalOpen: activeModal !== null,
  };

  // === OPERATIONS ===
  
  /**
   * Check if a specific modal is open
   */
  const isModalOpen = useCallback((modalType: ModalType): boolean => {
    return activeModal === modalType;
  }, [activeModal]);

  /**
   * Open a specific modal (closes any currently open modal)
   */
  const openModal = useCallback((modalType: ModalType) => {
    setActiveModal(modalType);
  }, []);

  /**
   * Close the currently open modal
   */
  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  /**
   * Close a specific modal (only if it's the one currently open)
   */
  const closeSpecificModal = useCallback((modalType: ModalType) => {
    if (activeModal === modalType) {
      setActiveModal(null);
    }
  }, [activeModal]);

  /**
   * Toggle a specific modal
   */
  const toggleModal = useCallback((modalType: ModalType) => {
    if (activeModal === modalType) {
      setActiveModal(null);
    } else {
      setActiveModal(modalType);
    }
  }, [activeModal]);

  // === RETURN INTERFACE ===
  
  return {
    state,
    isModalOpen,
    openModal,
    closeModal,
    closeSpecificModal,
    toggleModal,
  };
} 