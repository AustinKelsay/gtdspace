# Settings System

GTD Space provides a comprehensive settings system that persists user preferences across sessions using Tauri's store plugin.

## Architecture Overview

```
┌─────────────────────┐
│   React Frontend    │
│   (useSettings)     │
└──────────┬──────────┘
           │
      Tauri IPC
           │
┌──────────▼──────────┐
│    Rust Backend     │
│  (Settings Store)   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   File System       │
│ (settings.json)     │
└─────────────────────┘
```

## Settings Structure

### TypeScript Interface

```typescript
export interface UserSettings {
  // Appearance
  theme: Theme;                    // 'light' | 'dark' | 'auto'
  font_size: number;              // 12-20 pixels
  
  // Editor
  tab_size: number;               // 2 or 4 spaces
  word_wrap: boolean;             // Wrap long lines
  editor_mode: EditorMode;        // 'source' | 'preview' | 'split' | 'wysiwyg' (Note: Only 'wysiwyg' is implemented)
  
  // Application
  last_folder: string | null;     // Last opened folder
  
  // Window (future use)
  window_width?: number;          // Window dimensions
  window_height?: number;
}
```

### Rust Structure

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSettings {
    pub theme: String,
    pub font_size: u32,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub last_folder: Option<String>,
    pub editor_mode: String,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
}
```

## Storage Location

Settings are stored in platform-specific locations:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/com.gtdspace.app/settings.json` |
| Windows | `%APPDATA%\com.gtdspace.app\settings.json` |
| Linux | `~/.config/com.gtdspace.app/settings.json` |

## Settings Hook Implementation

### useSettings Hook

```typescript
export const useSettings = () => {
  const [settings, setSettingsState] = useState<UserSettings>(defaultSettings);
  const { withErrorHandling, showSuccess } = useErrorHandler();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await withErrorHandling(
        async () => await invoke<UserSettings>('load_settings'),
        'Failed to load settings'
      );
      
      if (loaded) {
        setSettingsState(loaded);
      }
    };
    
    loadSettings();
  }, []);

  // Save settings helper
  const saveSettings = async (newSettings: UserSettings) => {
    const success = await withErrorHandling(
      async () => await invoke('save_settings', { settings: newSettings }),
      'Failed to save settings'
    );
    
    if (success) {
      setSettingsState(newSettings);
      showSuccess('Settings saved');
    }
  };

  // Individual setters
  const setTheme = (theme: Theme) => 
    saveSettings({ ...settings, theme });
    
  const setFontSize = (font_size: number) => 
    saveSettings({ ...settings, font_size });
    
  const setTabSize = (tab_size: number) => 
    saveSettings({ ...settings, tab_size });
    
  const setWordWrap = (word_wrap: boolean) => 
    saveSettings({ ...settings, word_wrap });
    
  const setEditorMode = (editor_mode: EditorMode) => 
    saveSettings({ ...settings, editor_mode });

  return {
    settings,
    setTheme,
    setFontSize,
    setTabSize,
    setWordWrap,
    setEditorMode,
    resetToDefaults: () => saveSettings(defaultSettings),
  };
};
```

## Backend Implementation

### Load Settings Command

```rust
#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<UserSettings, String> {
    log::info!("Loading user settings");
    
    // Get or create store
    let store = match tauri_plugin_store::StoreExt::get_store(
        &app, 
        PathBuf::from("settings.json")
    ) {
        Some(store) => store,
        None => {
            // Create new store if it doesn't exist
            match StoreBuilder::new(&app, PathBuf::from("settings.json")).build() {
                Ok(store) => store,
                Err(e) => {
                    log::error!("Failed to create settings store: {}", e);
                    return Ok(get_default_settings());
                }
            }
        }
    };
    
    // Load settings from store
    match store.get("user_settings") {
        Some(value) => {
            match serde_json::from_value::<UserSettings>(value) {
                Ok(settings) => {
                    log::info!("Loaded existing settings");
                    Ok(settings)
                }
                Err(e) => {
                    log::warn!("Failed to parse settings, using defaults: {}", e);
                    Ok(get_default_settings())
                }
            }
        }
        None => {
            log::info!("No existing settings found, using defaults");
            Ok(get_default_settings())
        }
    }
}
```

### Save Settings Command

```rust
#[tauri::command]
pub async fn save_settings(
    app: AppHandle, 
    settings: UserSettings
) -> Result<String, String> {
    log::info!("Saving user settings");
    
    let store = get_or_create_store(&app)?;
    
    // Save settings to store
    match serde_json::to_value(&settings) {
        Ok(value) => {
            store.set("user_settings", value);
            
            if let Err(e) = store.save() {
                return Err(format!("Failed to persist settings: {}", e));
            }
            
            log::info!("Settings saved successfully");
            Ok("Settings saved successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to serialize settings: {}", e);
            Err(format!("Failed to serialize settings: {}", e))
        }
    }
}
```

## Important Note on Editor Modes

**Current Implementation Status:**
- `wysiwyg` - ✅ Fully functional (BlockNote editor)
- `source` - ❌ Not implemented (shows in UI but does nothing)
- `preview` - ❌ Not implemented (shows in UI but does nothing)
- `split` - ❌ Not implemented (shows in UI but does nothing)

The settings UI displays all four options, but changing the editor mode has no effect. The application always uses BlockNote's WYSIWYG editor.

## Settings UI Component

### Settings Manager Modal

```typescript
export const SettingsManager: React.FC<SettingsManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, setTheme, setFontSize, setTabSize, setWordWrap } = useSettings();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Theme Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Appearance</h3>
            
            <div className="space-y-4">
              <div>
                <Label>Theme</Label>
                <Select value={settings.theme} onValueChange={setTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Font Size</Label>
                <Slider
                  value={[settings.font_size]}
                  onValueChange={([value]) => setFontSize(value)}
                  min={12}
                  max={20}
                  step={1}
                />
                <span className="text-sm text-muted-foreground">
                  {settings.font_size}px
                </span>
              </div>
            </div>
          </div>
          
          {/* Editor Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Editor</h3>
            
            <div className="space-y-4">
              <div>
                <Label>Tab Size</Label>
                <RadioGroup 
                  value={settings.tab_size.toString()} 
                  onValueChange={(v) => setTabSize(parseInt(v))}
                >
                  <RadioGroupItem value="2">2 spaces</RadioGroupItem>
                  <RadioGroupItem value="4">4 spaces</RadioGroupItem>
                </RadioGroup>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Word Wrap</Label>
                <Switch
                  checked={settings.word_wrap}
                  onCheckedChange={setWordWrap}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

## Default Settings

```typescript
const defaultSettings: UserSettings = {
  theme: 'dark',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  editor_mode: 'wysiwyg', // Only functional mode
  last_folder: null,
  window_width: undefined,
  window_height: undefined,
};
```

## Theme Application

### Theme Logic

```typescript
// In App.tsx
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // Auto theme - detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
};

// Apply on settings change
useEffect(() => {
  applyTheme(settings.theme);
}, [settings.theme]);
```

### System Theme Detection

```typescript
// Listen for system theme changes
useEffect(() => {
  if (settings.theme !== 'auto') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => applyTheme('auto');
  
  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}, [settings.theme]);
```

## Settings Migration

### Version Management

```typescript
interface VersionedSettings extends UserSettings {
  version: number;
}

const CURRENT_VERSION = 1;

const migrateSettings = (settings: any): UserSettings => {
  const version = settings.version || 0;
  
  if (version < 1) {
    // Migrate from v0 to v1
    settings = {
      ...defaultSettings,
      ...settings,
      version: 1,
    };
  }
  
  // Future migrations here
  
  return settings;
};
```

## Validation

### Frontend Validation

```typescript
const validateSettings = (settings: Partial<UserSettings>): boolean => {
  // Theme validation
  if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
    return false;
  }
  
  // Font size validation
  if (settings.font_size && (settings.font_size < 12 || settings.font_size > 20)) {
    return false;
  }
  
  // Tab size validation
  if (settings.tab_size && ![2, 4].includes(settings.tab_size)) {
    return false;
  }
  
  return true;
};
```

### Backend Validation

```rust
fn validate_settings(settings: &UserSettings) -> Result<(), String> {
    // Theme validation
    match settings.theme.as_str() {
        "light" | "dark" | "auto" => {},
        _ => return Err("Invalid theme".to_string()),
    }
    
    // Font size validation
    if settings.font_size < 12 || settings.font_size > 20 {
        return Err("Font size must be between 12 and 20".to_string());
    }
    
    // Tab size validation
    if settings.tab_size != 2 && settings.tab_size != 4 {
        return Err("Tab size must be 2 or 4".to_string());
    }
    
    Ok(())
}
```

## Performance Considerations

### Debounced Saves

For frequently changing settings:

```typescript
const debouncedSave = useMemo(
  () => debounce((newSettings: UserSettings) => {
    saveSettings(newSettings);
  }, 500),
  []
);

// Use for slider changes
const handleFontSizeChange = (size: number) => {
  setSettingsState(prev => ({ ...prev, font_size: size }));
  debouncedSave({ ...settings, font_size: size });
};
```

### Caching

Settings are cached in memory to avoid repeated file reads:

```rust
lazy_static! {
    static ref SETTINGS_CACHE: Mutex<Option<UserSettings>> = Mutex::new(None);
}

pub async fn load_settings_cached(app: AppHandle) -> Result<UserSettings, String> {
    // Check cache first
    if let Some(cached) = SETTINGS_CACHE.lock().unwrap().as_ref() {
        return Ok(cached.clone());
    }
    
    // Load from disk
    let settings = load_settings(app).await?;
    
    // Update cache
    *SETTINGS_CACHE.lock().unwrap() = Some(settings.clone());
    
    Ok(settings)
}
```

## Best Practices

### 1. Atomic Updates

Always save complete settings objects:

```typescript
// ✅ Good
saveSettings({ ...settings, theme: 'dark' });

// ❌ Bad
saveSettings({ theme: 'dark' }); // Missing other fields
```

### 2. Error Recovery

Gracefully handle settings corruption:

```typescript
const loadSettings = async () => {
  try {
    const loaded = await invoke<UserSettings>('load_settings');
    setSettingsState(loaded);
  } catch (error) {
    console.error('Settings load failed, using defaults:', error);
    setSettingsState(defaultSettings);
  }
};
```

### 3. User Feedback

Provide clear feedback on settings changes:

```typescript
const handleSettingChange = async (newSettings: UserSettings) => {
  const saved = await saveSettings(newSettings);
  if (saved) {
    showSuccess('Settings saved');
  } else {
    showError('Failed to save settings');
  }
};
```

### 4. Immediate Application

Apply settings immediately for instant feedback:

```typescript
const setTheme = async (theme: Theme) => {
  // Apply immediately
  applyTheme(theme);
  
  // Then persist
  await saveSettings({ ...settings, theme });
};
```

## Future Enhancements

1. **Export/Import Settings**
   - Export settings to JSON file
   - Import settings from file
   - Share settings between devices

2. **Profiles**
   - Multiple settings profiles
   - Quick switching between profiles
   - Profile-specific shortcuts

3. **Advanced Editor Settings**
   - Line height
   - Font family
   - Cursor style
   - Indent guides

4. **Workspace Settings**
   - Per-folder settings
   - Project-specific preferences
   - Settings inheritance