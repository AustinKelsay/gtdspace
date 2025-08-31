# Data Migration Guide

## Overview

GTD Space includes automatic data migration to handle breaking changes and ensure backward compatibility with older file formats.

## Breaking Changes Handled

### 1. Field Rename: `created_date` → `created_date_time`

**Old Format:**
```markdown
[!datetime:created_date:2025-01-15]
```

**New Format:**
```markdown
[!datetime:created_date_time:2025-01-15]
```

**Migration:** Automatically renames the field in markdown content and GTD objects.

### 2. Status Field: Array → Single Value

**Old Format:**
```markdown
[!multiselect:status:in-progress,waiting]
```

**New Format:**
```markdown
[!singleselect:status:in-progress]
```

**Migration:** Takes the first status value and converts to single-select format.

### 3. Status Token Mapping

**Old Tokens → New Canonical Tokens:**
- `not-started` → `in-progress`
- `active` → `in-progress`
- `planning` → `in-progress`
- `on-hold` → `waiting`
- `waiting-for` → `waiting`
- `cancelled` → `completed`
- `done` → `completed`
- `complete` → `completed`

## How Migration Works

### Automatic Migration on Read

When files are opened or data is loaded:

1. **File Content Migration** - Applied when reading markdown files
   - Detected via `needsMigration()` function
   - Applied via `migrateMarkdownContent()` function
   - Automatically saves migrated content back to disk

2. **GTD Object Migration** - Applied when loading from backend
   - Applied via `migrateGTDObjects()` function
   - Ensures field names match current TypeScript interfaces

### Migration Locations

Migration is applied in these hooks:

- **useTabManager** - When opening files in tabs
- **useCalendarData** - When reading files for calendar view
- **useGTDSpace** - When loading project lists
- **useFileManager** - When loading file content (if needed)

## Migration Functions

### `needsMigration(content: string): boolean`

Checks if content needs migration by looking for:
- Old `[!datetime:created_date:` fields
- Multiselect status fields
- Old status tokens

### `migrateMarkdownContent(content: string): string`

Applies all migrations to markdown content:
- Renames datetime fields
- Converts multiselect to singleselect
- Maps old status values

### `migrateGTDObjects<T>(objects: T[]): T[]`

Migrates an array of JavaScript/TypeScript objects:
- Renames object properties
- Ensures status is single value
- Maps status tokens

This function is invoked by the `useGTDSpace` hook to automatically migrate GTD objects retrieved from storage.

## Example Migration

### Before Migration
```markdown
# My Project

## Status
[!multiselect:project-status:active,planning]

## Created Date
[!datetime:created_date:2025-01-15]

# My Action

## Status
[!multiselect:status:not-started]
```

### After Migration
```markdown
# My Project

## Status
[!singleselect:project-status:in-progress]

## Created Date/Time
[!datetime:created_date_time:2025-01-15]

# My Action

## Status
[!singleselect:status:in-progress]
```

## Testing Migration

To test migration on existing files:

1. Create a file with old format markers
2. Open it in GTD Space
3. The file will be automatically migrated and saved
4. Verify the new format is correct

## Backward Compatibility

The system maintains backward compatibility through:

1. **Field Mapping** - metadata-extractor.ts maps both old and new field names
2. **Auto-Save** - Migrated content is saved to prevent repeated migrations
3. **Non-Destructive** - Only specific patterns are changed, preserving other content

## Future Migrations

When adding new breaking changes:

1. Update `needsMigration()` to detect old format
2. Add migration logic to `migrateMarkdownContent()`
3. Update `migrateGTDObjects()` if object structure changes
4. Document the change in this file
5. Test with real user data before release

## Performance Considerations

- Migration check is fast (simple string contains)
- Migration only runs once per file (auto-saved)
- Bulk operations migrate all objects in one pass
- No user intervention required

## Rollback Strategy

If migration causes issues:

1. Users can restore from backup (if they have one)
2. Git users can revert changes
3. Future versions could include undo migration feature

## Support

If users encounter migration issues:

1. Check console for migration logs
2. Verify file permissions for auto-save
3. Report issues with example files
4. Manual migration possible via find-replace