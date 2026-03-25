import { describe, expect, it } from 'vitest';
import { validateAndCoerceSettings } from '@/utils/settings-validation';

const baseSettings = {
  theme: 'dark',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  editor_mode: 'split',
  font_family: 'inter',
  line_height: 1.5,
  keybindings: {
    save: 'mod+s',
    open: 'mod+o',
    commandPalette: 'mod+k',
    newNote: 'mod+shift+n',
  },
};

describe('settings validation for MCP server defaults', () => {
  it('accepts persisted MCP server defaults when they are valid', () => {
    const result = validateAndCoerceSettings({
      ...baseSettings,
      mcp_server_workspace_path: '/Users/me/GTD Space',
      mcp_server_read_only: true,
      mcp_server_log_level: 'debug',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.coercedSettings.mcp_server_workspace_path).toBe('/Users/me/GTD Space');
    expect(result.coercedSettings.mcp_server_read_only).toBe(true);
    expect(result.coercedSettings.mcp_server_log_level).toBe('debug');
  });

  it('rejects invalid MCP server log levels and coerces them to info', () => {
    const result = validateAndCoerceSettings({
      ...baseSettings,
      mcp_server_log_level: 'loud',
    });

    expect(result.isValid).toBe(false);
    expect(result.coercedSettings.mcp_server_log_level).toBe('info');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'mcp_server_log_level',
          severity: 'fatal',
        }),
      ]),
    );
  });

  it('coerces supported boolean-like read-only values', () => {
    const result = validateAndCoerceSettings({
      ...baseSettings,
      mcp_server_read_only: 'yes',
    });

    expect(result.isValid).toBe(true);
    expect(result.coercedSettings.mcp_server_read_only).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects unrecognized read-only values as fatal validation errors', () => {
    const result = validateAndCoerceSettings({
      ...baseSettings,
      mcp_server_read_only: 'sometimes',
    });

    expect(result.isValid).toBe(false);
    expect(result.coercedSettings.mcp_server_read_only).toBeNull();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'mcp_server_read_only',
          severity: 'fatal',
        }),
      ]),
    );
  });
});
