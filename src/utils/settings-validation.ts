/**
 * @fileoverview Settings validation utilities for import/export operations
 * @author Development Team
 * @created 2025-01-XX
 */

import type { UserSettings, Theme, EditorMode } from '@/types';

/**
 * Valid theme values
 */
const VALID_THEMES: readonly Theme[] = ['light', 'dark', 'auto'] as const;

/**
 * Valid font size values (in pixels)
 */
const VALID_FONT_SIZES: readonly number[] = [12, 13, 14, 15, 16, 18, 20] as const;

/**
 * Valid tab size values (spaces)
 */
const VALID_TAB_SIZES: readonly number[] = [2, 4] as const;

/**
 * Valid editor mode values
 */
const VALID_EDITOR_MODES: readonly EditorMode[] = ['source', 'preview', 'split', 'wysiwyg'] as const;

/**
 * Valid font family tokens supported by the editor
 */
const VALID_FONT_FAMILIES = ['inter', 'system', 'jetbrains-mono', 'sf-mono', 'space-grotesk'] as const;

/**
 * Supported line height range
 */
const LINE_HEIGHT_RANGE = { min: 1, max: 2.5 } as const;

/**
 * Required keybinding actions that must be present in any import
 */
const REQUIRED_KEYBINDING_ACTIONS = ['save', 'open', 'commandPalette', 'newNote'] as const;

/**
 * Git sync history bounds (mirrors src-tauri/src/commands/git_sync.rs)
 */
const GIT_SYNC_HISTORY_RANGE = { min: 1, max: 20 } as const;

/**
 * Minimum auto pull cadence (minutes)
 */
const GIT_SYNC_AUTO_PULL_MIN = 1;

/**
 * Shortcut value format matcher (e.g., mod+shift+p)
 */
const KEYBINDING_PATTERN = /^[a-z0-9+_\-:/]+$/i;

/**
 * Default settings values used for coercion
 */
const DEFAULT_KEYBINDINGS: Record<string, string> = Object.freeze({
  save: 'mod+s',
  open: 'mod+o',
  commandPalette: 'mod+k',
  newNote: 'mod+shift+n',
});

const DEFAULT_SETTINGS: Required<Pick<UserSettings, 'theme' | 'font_size' | 'tab_size' | 'word_wrap' | 'editor_mode' | 'font_family' | 'line_height' | 'keybindings'>> = {
  theme: 'dark',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  editor_mode: 'split',
  font_family: 'inter',
  line_height: 1.5,
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

/**
 * Validation error details for a single field
 */
interface FieldValidationError {
  field: string;
  reason: string;
  providedValue: unknown;
  defaultValue: unknown;
  severity: 'fatal' | 'warning';
}

/**
 * Settings validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
  coercedSettings: Partial<UserSettings>;
}

/**
 * Validates and coerces imported settings to ensure type safety and acceptable values
 *
 * @param importedData - Raw data from imported JSON file
 * @returns Validation result with coerced settings and any validation errors
 */
export function validateAndCoerceSettings(importedData: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];
  const coercedSettings: Partial<UserSettings> = {};
  const coercedSettingsRecord = coercedSettings as Record<string, unknown>;
  const recordError = (
    field: string,
    reason: string,
    providedValue: unknown,
    defaultValue: unknown,
    severity: 'fatal' | 'warning',
  ) => {
    errors.push({ field, reason, providedValue, defaultValue, severity });
  };

  // Ensure we have an object
  if (typeof importedData !== 'object' || importedData === null || Array.isArray(importedData)) {
    throw new Error('Invalid settings file: expected an object');
  }

  const data = importedData as Record<string, unknown>;

  // === REQUIRED FIELD VALIDATION ===

  // Validate theme
  if (typeof data.theme !== 'string' || !VALID_THEMES.includes(data.theme as Theme)) {
    recordError(
      'theme',
      `must be one of: ${VALID_THEMES.join(', ')}`,
      data.theme,
      DEFAULT_SETTINGS.theme,
      'fatal',
    );
    coercedSettings.theme = DEFAULT_SETTINGS.theme;
  } else {
    coercedSettings.theme = data.theme as Theme;
  }

  // Validate font_size
  if (typeof data.font_size !== 'number' || !VALID_FONT_SIZES.includes(data.font_size)) {
    recordError(
      'font_size',
      `must be a number and one of: ${VALID_FONT_SIZES.join(', ')}`,
      data.font_size,
      DEFAULT_SETTINGS.font_size,
      'fatal',
    );
    coercedSettings.font_size = DEFAULT_SETTINGS.font_size;
  } else {
    coercedSettings.font_size = data.font_size;
  }

  // Validate tab_size
  if (typeof data.tab_size !== 'number' || !VALID_TAB_SIZES.includes(data.tab_size)) {
    recordError(
      'tab_size',
      `must be a number and one of: ${VALID_TAB_SIZES.join(', ')}`,
      data.tab_size,
      DEFAULT_SETTINGS.tab_size,
      'fatal',
    );
    coercedSettings.tab_size = DEFAULT_SETTINGS.tab_size;
  } else {
    coercedSettings.tab_size = data.tab_size;
  }

  // Validate word_wrap
  if (typeof data.word_wrap !== 'boolean') {
    recordError('word_wrap', 'must be a boolean', data.word_wrap, DEFAULT_SETTINGS.word_wrap, 'fatal');
    coercedSettings.word_wrap = DEFAULT_SETTINGS.word_wrap;
  } else {
    coercedSettings.word_wrap = data.word_wrap;
  }

  // Validate editor_mode
  if (typeof data.editor_mode !== 'string' || !VALID_EDITOR_MODES.includes(data.editor_mode as EditorMode)) {
    recordError(
      'editor_mode',
      `must be one of: ${VALID_EDITOR_MODES.join(', ')}`,
      data.editor_mode,
      DEFAULT_SETTINGS.editor_mode,
      'fatal',
    );
    coercedSettings.editor_mode = DEFAULT_SETTINGS.editor_mode;
  } else {
    coercedSettings.editor_mode = data.editor_mode as EditorMode;
  }

  // Validate font_family
  if (data.font_family === undefined) {
    coercedSettings.font_family = DEFAULT_SETTINGS.font_family;
  } else if (typeof data.font_family !== 'string') {
    recordError('font_family', 'must be a string', data.font_family, DEFAULT_SETTINGS.font_family, 'fatal');
    coercedSettings.font_family = DEFAULT_SETTINGS.font_family;
  } else {
    const normalizedFamily = data.font_family.toLowerCase();
    if (!VALID_FONT_FAMILIES.includes(normalizedFamily as (typeof VALID_FONT_FAMILIES)[number])) {
      recordError(
        'font_family',
        `must be one of: ${VALID_FONT_FAMILIES.join(', ')}`,
        data.font_family,
        DEFAULT_SETTINGS.font_family,
        'fatal',
      );
      coercedSettings.font_family = DEFAULT_SETTINGS.font_family;
    } else {
      coercedSettings.font_family = normalizedFamily;
    }
  }

  // Validate line_height
  if (data.line_height === undefined) {
    coercedSettings.line_height = DEFAULT_SETTINGS.line_height;
  } else {
    const parsedLineHeight =
      typeof data.line_height === 'number'
        ? data.line_height
        : typeof data.line_height === 'string'
          ? Number(data.line_height)
          : Number.NaN;
    if (!Number.isFinite(parsedLineHeight) || parsedLineHeight < LINE_HEIGHT_RANGE.min || parsedLineHeight > LINE_HEIGHT_RANGE.max) {
      recordError(
        'line_height',
        `must be between ${LINE_HEIGHT_RANGE.min} and ${LINE_HEIGHT_RANGE.max}`,
        data.line_height,
        DEFAULT_SETTINGS.line_height,
        'fatal',
      );
      coercedSettings.line_height = DEFAULT_SETTINGS.line_height;
    } else {
      coercedSettings.line_height = Number(parsedLineHeight.toFixed(2));
    }
  }

  // Validate keybindings
  if (data.keybindings === undefined) {
    coercedSettings.keybindings = { ...DEFAULT_KEYBINDINGS };
  } else if (typeof data.keybindings !== 'object' || data.keybindings === null || Array.isArray(data.keybindings)) {
    recordError(
      'keybindings',
      'must be an object that maps action ids to shortcut strings',
      data.keybindings,
      DEFAULT_SETTINGS.keybindings,
      'fatal',
    );
    coercedSettings.keybindings = { ...DEFAULT_KEYBINDINGS };
  } else {
    const rawKeybindings = data.keybindings as Record<string, unknown>;
    const normalizedBindings: Record<string, string> = {};
    const invalidActions: string[] = [];

    for (const [action, shortcut] of Object.entries(rawKeybindings)) {
      if (typeof shortcut !== 'string' || !KEYBINDING_PATTERN.test(shortcut.trim())) {
        invalidActions.push(action);
      } else {
        normalizedBindings[action] = shortcut.trim();
      }
    }

    const missingActions = REQUIRED_KEYBINDING_ACTIONS.filter((action) => !(action in normalizedBindings));

    if (invalidActions.length > 0 || missingActions.length > 0) {
      const parts: string[] = [];
      if (invalidActions.length > 0) {
        parts.push(`invalid shortcuts for: ${invalidActions.join(', ')}`);
      }
      if (missingActions.length > 0) {
        parts.push(`missing required actions: ${missingActions.join(', ')}`);
      }
      recordError(
        'keybindings',
        parts.join('; '),
        data.keybindings,
        DEFAULT_SETTINGS.keybindings,
        'fatal',
      );
      coercedSettings.keybindings = { ...DEFAULT_KEYBINDINGS };
    } else {
      coercedSettings.keybindings = normalizedBindings;
    }
  }

  // === OPTIONAL FIELD VALIDATION ===

  // Validate optional string fields
  if (data.last_folder !== undefined && data.last_folder !== null && typeof data.last_folder !== 'string') {
    recordError('last_folder', 'must be a string or null', data.last_folder, null, 'warning');
    coercedSettings.last_folder = null;
  } else if (data.last_folder !== undefined) {
    coercedSettings.last_folder = data.last_folder as string | null;
  }

  // Validate optional number fields
  if (data.window_width !== undefined && data.window_width !== null && typeof data.window_width !== 'number') {
    recordError('window_width', 'must be a number or null', data.window_width, null, 'warning');
    coercedSettings.window_width = null;
  } else if (data.window_width !== undefined) {
    coercedSettings.window_width = data.window_width as number | null;
  }

  if (data.window_height !== undefined && data.window_height !== null && typeof data.window_height !== 'number') {
    recordError('window_height', 'must be a number or null', data.window_height, null, 'warning');
    coercedSettings.window_height = null;
  } else if (data.window_height !== undefined) {
    coercedSettings.window_height = data.window_height as number | null;
  }

  if (data.max_tabs !== undefined && data.max_tabs !== null && typeof data.max_tabs !== 'number') {
    recordError('max_tabs', 'must be a number or null', data.max_tabs, null, 'warning');
    coercedSettings.max_tabs = null;
  } else if (data.max_tabs !== undefined) {
    coercedSettings.max_tabs = data.max_tabs as number | null;
  }

  // Validate optional boolean fields
  if (data.auto_initialize !== undefined && data.auto_initialize !== null && typeof data.auto_initialize !== 'boolean') {
    recordError('auto_initialize', 'must be a boolean or null', data.auto_initialize, null, 'warning');
    coercedSettings.auto_initialize = null;
  } else if (data.auto_initialize !== undefined) {
    coercedSettings.auto_initialize = data.auto_initialize as boolean | null;
  }

  if (data.seed_example_content !== undefined && data.seed_example_content !== null && typeof data.seed_example_content !== 'boolean') {
    recordError('seed_example_content', 'must be a boolean or null', data.seed_example_content, null, 'warning');
    coercedSettings.seed_example_content = null;
  } else if (data.seed_example_content !== undefined) {
    coercedSettings.seed_example_content = data.seed_example_content as boolean | null;
  }

  if (data.git_sync_enabled !== undefined && data.git_sync_enabled !== null && typeof data.git_sync_enabled !== 'boolean') {
    recordError('git_sync_enabled', 'must be a boolean or null', data.git_sync_enabled, null, 'warning');
    coercedSettings.git_sync_enabled = null;
  } else if (data.git_sync_enabled !== undefined) {
    coercedSettings.git_sync_enabled = data.git_sync_enabled as boolean | null;
  }

  if (data.restore_tabs !== undefined && data.restore_tabs !== null && typeof data.restore_tabs !== 'boolean') {
    recordError('restore_tabs', 'must be a boolean or null', data.restore_tabs, null, 'warning');
    coercedSettings.restore_tabs = null;
  } else if (data.restore_tabs !== undefined) {
    coercedSettings.restore_tabs = data.restore_tabs as boolean | null;
  }

  // Validate optional string/null fields
  const optionalStringFields: Array<keyof UserSettings> = [
    'default_space_path',
    'git_sync_repo_path',
    'git_sync_workspace_path',
    'git_sync_remote_url',
    'git_sync_branch',
    'git_sync_encryption_key',
    'git_sync_author_name',
    'git_sync_author_email',
    'git_sync_last_push',
    'git_sync_last_pull',
  ];

  for (const field of optionalStringFields) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') {
      recordError(field, 'must be a string or null', data[field], null, 'warning');
      coercedSettingsRecord[field as string] = null;
    } else if (data[field] !== undefined) {
      coercedSettingsRecord[field as string] = data[field] as string | null;
    }
  }

  // Validate optional number/null fields
  if (data.git_sync_keep_history !== undefined) {
    if (data.git_sync_keep_history === null) {
      coercedSettings.git_sync_keep_history = null;
    } else {
      const value = data.git_sync_keep_history;
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < GIT_SYNC_HISTORY_RANGE.min ||
        value > GIT_SYNC_HISTORY_RANGE.max
      ) {
        recordError(
          'git_sync_keep_history',
          `must be an integer between ${GIT_SYNC_HISTORY_RANGE.min} and ${GIT_SYNC_HISTORY_RANGE.max}`,
          value,
          null,
          'fatal',
        );
        coercedSettings.git_sync_keep_history = null;
      } else {
        coercedSettings.git_sync_keep_history = value;
      }
    }
  }

  if (data.git_sync_auto_pull_interval_minutes !== undefined) {
    if (data.git_sync_auto_pull_interval_minutes === null) {
      coercedSettings.git_sync_auto_pull_interval_minutes = null;
    } else {
      const value = data.git_sync_auto_pull_interval_minutes;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < GIT_SYNC_AUTO_PULL_MIN) {
        recordError(
          'git_sync_auto_pull_interval_minutes',
          `must be a positive integer (minimum ${GIT_SYNC_AUTO_PULL_MIN} minute)`,
          value,
          null,
          'fatal',
        );
        coercedSettings.git_sync_auto_pull_interval_minutes = null;
      } else {
        coercedSettings.git_sync_auto_pull_interval_minutes = value;
      }
    }
  }

  return {
    isValid: !errors.some((error) => error.severity === 'fatal'),
    errors,
    coercedSettings,
  };
}

/**
 * Creates a descriptive error message from validation errors
 *
 * @param errors - Array of field validation errors
 * @returns Formatted error message string
 */
export function formatValidationErrors(errors: FieldValidationError[]): string {
  if (errors.length === 0) {
    return 'Settings validation passed';
  }

  const errorLines = errors.map((error) => {
    const valueStr = JSON.stringify(error.providedValue);
    const defaultStr = JSON.stringify(error.defaultValue);
    const severityLabel = error.severity === 'fatal' ? '[fatal]' : '[warning]';
    return `  • ${severityLabel} ${error.field}: ${error.reason} (provided: ${valueStr}, default: ${defaultStr})`;
  });

  return `Settings validation failed for ${errors.length} field(s):\n${errorLines.join('\n')}`;
}
