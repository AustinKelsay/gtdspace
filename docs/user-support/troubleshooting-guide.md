# Troubleshooting Guide

> **Comprehensive solutions for common GTD Space issues**

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [File Management Problems](#file-management-problems)
4. [Editor Issues](#editor-issues)
5. [Performance Problems](#performance-problems)
6. [Platform-Specific Issues](#platform-specific-issues)
7. [Data Recovery](#data-recovery)
8. [Advanced Troubleshooting](#advanced-troubleshooting)

---

## Quick Diagnostics

### Before You Start

**First, try these quick fixes (solves 80% of issues):**

1. **Restart GTD Space** - Close completely and reopen
2. **Check file permissions** - Ensure you can read/write to your files
3. **Update GTD Space** - Make sure you have the latest version
4. **Clear browser cache** - If using web version, clear cache and cookies
5. **Check disk space** - Ensure you have at least 1GB free space

### System Requirements Check

**Minimum Requirements:**
- **Windows**: Windows 10 (1903 or later)
- **macOS**: macOS 10.15 Catalina or later
- **Linux**: Ubuntu 18.04 / Fedora 32 / Debian 10 or equivalent
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB for application, 1GB free space recommended

---

## Installation Issues

### Windows Installation Problems

#### Issue: "This app can't run on your PC"
**Cause**: Architecture mismatch or corrupted download
**Solution:**
1. Download the correct version (x64 for 64-bit Windows)
2. Right-click installer → Properties → Unblock
3. Run as Administrator
4. Temporarily disable antivirus during installation

#### Issue: Windows Defender blocks installation
**Cause**: SmartScreen protection for unknown publisher
**Solution:**
1. Click "More info" on the SmartScreen warning
2. Click "Run anyway"
3. Or add GTD Space to Windows Defender exclusions:
   - Windows Security → Virus & threat protection
   - Exclusions → Add exclusion → Folder
   - Select GTD Space installation folder

#### Issue: Installation hangs or fails
**Cause**: Insufficient permissions or corrupted installer
**Solution:**
1. Run installer as Administrator
2. Disable real-time antivirus scanning temporarily
3. Close all other applications
4. Download installer again (may be corrupted)
5. Install to different location (e.g., `C:\GTDSpace\`)

### macOS Installation Problems

#### Issue: "GTD Space is damaged and can't be opened"
**Cause**: Gatekeeper security protection
**Solution:**
1. **Method 1**: System Preferences → Security & Privacy → Click "Open Anyway"
2. **Method 2**: Terminal command:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/GTDSpace.app
   ```
3. **Method 3**: Right-click app → Open (bypasses Gatekeeper)

#### Issue: "Cannot verify developer" error
**Cause**: Application not signed with Apple Developer certificate
**Solution:**
1. System Preferences → Security & Privacy → General
2. Click "Open Anyway" next to GTD Space warning
3. If option not available, open Terminal:
   ```bash
   sudo spctl --master-disable
   ```
   (Re-enable after installation: `sudo spctl --master-enable`)

### Linux Installation Problems

#### Issue: AppImage won't execute
**Cause**: Missing execute permissions or dependencies
**Solution:**
1. Make executable:
   ```bash
   chmod +x GTDSpace-*.AppImage
   ```
2. Install dependencies:
   ```bash
   # Ubuntu/Debian:
   sudo apt install libfuse2 libgtk-3-0 libwebkit2gtk-4.0-37
   
   # Fedora:
   sudo dnf install fuse gtk3 webkit2gtk3
   
   # Arch Linux:
   sudo pacman -S fuse2 gtk3 webkit2gtk
   ```

#### Issue: "No such file or directory" when running AppImage
**Cause**: Missing FUSE or incorrect file format
**Solution:**
1. Install FUSE:
   ```bash
   sudo apt install fuse  # Ubuntu/Debian
   sudo dnf install fuse  # Fedora
   ```
2. Check file integrity:
   ```bash
   file GTDSpace-*.AppImage
   # Should show: ELF 64-bit LSB executable
   ```

---

## File Management Problems

### Files Not Appearing

#### Issue: Markdown files don't show in sidebar
**Diagnostic Steps:**
1. Check file extensions (must be `.md` or `.markdown`)
2. Verify file permissions (should be readable)
3. Check folder permissions (should be accessible)
4. Refresh file list (`F5` or restart app)

**Solution:**
```bash
# Check file permissions (Linux/macOS):
ls -la *.md

# Fix permissions if needed:
chmod 644 *.md        # Files
chmod 755 .           # Folder
```

#### Issue: Files show as empty or corrupted
**Causes & Solutions:**
- **File encoding**: Convert to UTF-8
- **Special characters**: Remove or escape problematic characters
- **File locks**: Close file in other applications
- **Permissions**: Ensure read/write access

### Save/Load Issues

#### Issue: "Failed to save file" error
**Diagnostic Checklist:**
- [ ] File is not read-only
- [ ] Folder has write permissions
- [ ] Disk has available space
- [ ] File not open in another application
- [ ] Valid filename (no special characters)

**Solutions by Error Type:**

**Permission Denied:**
```bash
# Linux/macOS - Fix permissions:
chmod 644 filename.md
chmod 755 folder/

# Windows - Run as Administrator or check file properties
```

**Disk Full:**
- Free up disk space (at least 100MB)
- Move files to different drive if needed

**File in Use:**
- Close file in other applications
- Check for hidden processes using the file
- Restart GTD Space

#### Issue: Changes not saving automatically
**Diagnostic Steps:**
1. Check auto-save indicator in header
2. Verify auto-save is enabled in settings
3. Look for error messages in debug panel (`Ctrl+Shift+D`)

**Solution:**
1. Settings → Editor → Enable Auto-save
2. Adjust auto-save interval (default: 3 seconds)
3. Check file permissions
4. Manually save with `Ctrl+S` to test

---

## Editor Issues

### Display Problems

#### Issue: Text appears corrupted or has weird characters
**Cause**: Character encoding mismatch
**Solution:**
1. Convert file to UTF-8 encoding
2. Use text editor to save with UTF-8 encoding
3. Check for BOM (Byte Order Mark) and remove if present

#### Issue: WYSIWYG mode shows incorrectly formatted content
**Causes & Solutions:**
- **Invalid markdown**: Check syntax in source mode
- **Custom HTML**: GTD Space may not support all HTML tags
- **Complex tables**: Simplify table structure
- **Nested formatting**: Avoid excessive nesting

**Debug Steps:**
1. Switch to source mode to check raw markdown
2. Copy content to new file to test
3. Simplify formatting gradually to isolate issue

### Performance Issues in Editor

#### Issue: Typing lag or slow response
**Diagnostic Steps:**
1. Check file size (large files >10MB may be slow)
2. Count open tabs (limit to 5-10 for best performance)
3. Check system resources (CPU/Memory usage)

**Solutions:**
- **Large files**: Break into smaller documents
- **Too many tabs**: Close unused tabs (`Ctrl+W`)
- **System resources**: Close other applications
- **Restart**: Restart GTD Space to clear memory

#### Issue: Preview mode not updating
**Troubleshooting:**
1. Force refresh: `Ctrl+R` in preview mode
2. Check if file is saving: Look for save indicator
3. Switch modes: Toggle between source and preview
4. Restart editor: Close and reopen the file

---

## Performance Problems

### Application Startup Issues

#### Issue: GTD Space takes long time to start
**Diagnostic Steps:**
1. Check if antivirus is scanning the application
2. Verify system resources (RAM, CPU)
3. Check for conflicting applications
4. Monitor startup time (should be <10 seconds normally)

**Solutions:**
- **Antivirus interference**: Add GTD Space to exclusions
- **Low memory**: Close other applications, restart computer
- **Disk issues**: Run disk cleanup/defrag (Windows) or First Aid (macOS)
- **Corrupted installation**: Reinstall GTD Space

### Runtime Performance Issues

#### Issue: High memory usage
**Normal Usage Patterns:**
- Base application: ~100-200MB
- Per open file: ~10-50MB depending on size
- WYSIWYG mode: Additional ~50-100MB

**Memory Optimization:**
1. Close unused tabs
2. Restart application periodically
3. Use source mode for large files
4. Limit open files to <10 simultaneously

#### Issue: High CPU usage
**Common Causes:**
- **File watching**: Large folders with many files
- **Live preview**: Complex markdown with many elements
- **Search indexing**: Background indexing of file contents

**Solutions:**
1. Reduce folder size being watched
2. Disable live preview if not needed
3. Close unused tabs
4. Update to latest version (performance improvements)

### Memory Leaks

#### Issue: Memory usage keeps increasing
**Symptoms:**
- Application becomes slower over time
- System becomes unresponsive
- Memory usage in Task Manager keeps growing

**Solutions:**
1. **Restart application** every few hours of heavy use
2. **Update GTD Space** (memory leaks are fixed regularly)
3. **Monitor tab usage** (close tabs when done)
4. **Report the issue** with reproduction steps

---

## Platform-Specific Issues

### Windows-Specific Problems

#### Issue: Fonts look blurry or pixelated
**Cause**: DPI scaling issues
**Solution:**
1. Right-click GTD Space shortcut → Properties
2. Compatibility tab → Change high DPI settings
3. Check "Override high DPI scaling behavior"
4. Select "System (Enhanced)" or "Application"

#### Issue: File associations not working
**Cause**: Registry entries not properly set
**Solution:**
1. Right-click `.md` file → Open with → Choose another app
2. Select GTD Space and check "Always use this app"
3. Or manually set in Settings → Apps → Default apps

### macOS-Specific Problems

#### Issue: Touch Bar not working (MacBook Pro)
**Status**: Touch Bar support is not currently implemented
**Workaround**: Use keyboard shortcuts instead

#### Issue: Dark mode not matching system
**Solution:**
1. GTD Space Settings → Appearance → Theme
2. Select "Auto" to match system theme
3. Or manually select "Dark" or "Light"

### Linux-Specific Problems

#### Issue: Application doesn't respect system theme
**Cause**: GTK theme compatibility
**Solution:**
1. Install compatible GTK themes
2. Set GTK_THEME environment variable:
   ```bash
   GTK_THEME=Adwaita:dark ./GTDSpace.AppImage
   ```

#### Issue: Fonts look different from other applications
**Cause**: Font configuration differences
**Solution:**
1. Install Microsoft Core Fonts:
   ```bash
   sudo apt install ttf-mscorefonts-installer
   ```
2. Or configure preferred fonts in system settings

---

## Data Recovery

### Auto-Save Recovery

#### Finding Auto-Save Files
GTD Space creates backup files in these locations:

**Windows:**
```
%APPDATA%\GTDSpace\backups\
C:\Users\[Username]\AppData\Roaming\GTDSpace\backups\
```

**macOS:**
```
~/Library/Application Support/GTDSpace/backups/
```

**Linux:**
```
~/.local/share/GTDSpace/backups/
```

#### Recovery Procedure
1. Navigate to backup folder
2. Look for files named: `[original-filename]-backup-[timestamp].md`
3. Copy content from backup file
4. Paste into new file or restore original

### Crash Recovery

#### When GTD Space Crashes
1. **Restart GTD Space** - It will attempt auto-recovery
2. **Check for recovery notification** - Look for "Recovered unsaved changes"
3. **Manual recovery** - Check backup folders above
4. **Last resort** - Check OS file recovery:
   - Windows: File History or Previous Versions
   - macOS: Time Machine
   - Linux: Check if you have backups enabled

### File Corruption Recovery

#### Signs of File Corruption
- File appears empty when opened
- Random characters or encoding issues
- Application crashes when opening specific file
- File size is 0 bytes or unusually large

#### Recovery Steps
1. **Check backup files** in GTD Space backup folder
2. **System file recovery**:
   ```bash
   # Windows (PowerShell):
   Get-ChildItem -Path "C:\Path\To\Folder" -Recurse | Where-Object {$_.Extension -eq ".md"} | Get-FileVersions
   
   # macOS:
   tmutil listbackups
   
   # Linux (if using rsync backups):
   find /backup/path -name "*.md" -newer /path/to/corrupted/file
   ```
3. **Text recovery tools** - Use file recovery software if needed

---

## Advanced Troubleshooting

### Debug Mode

#### Enabling Debug Mode
1. Open GTD Space
2. Press `Ctrl+Shift+D` to open debug panel
3. Enable "Verbose Logging"
4. Reproduce the issue
5. Check logs for error messages

#### Understanding Log Messages
**Common Log Patterns:**
- `[ERROR]`: Critical issues requiring attention
- `[WARN]`: Warnings that might indicate problems
- `[INFO]`: General information about operations
- `[DEBUG]`: Detailed debugging information

### Performance Profiling

#### Built-in Performance Monitor
1. Open Debug Panel (`Ctrl+Shift+D`)
2. Switch to "Performance" tab
3. Monitor:
   - Memory usage over time
   - File operation timing
   - Render performance

#### Performance Benchmarks
**Normal Performance Metrics:**
- File open time: <500ms for files <1MB
- Save time: <200ms for typical files
- Tab switching: <100ms
- Search: <1s for 1000+ files

### Log Collection for Support

#### Collecting Diagnostic Information
1. **Application logs**:
   - Windows: `%APPDATA%\GTDSpace\logs\`
   - macOS: `~/Library/Logs/GTDSpace/`
   - Linux: `~/.local/share/GTDSpace/logs/`

2. **System information**:
   - OS version
   - GTD Space version
   - Available RAM
   - Free disk space

3. **Error reproduction steps**:
   - Exact steps to reproduce
   - Error messages
   - Files involved (if shareable)

### Clean Installation

#### Complete Removal and Reinstall
1. **Backup your settings** (optional):
   - Export settings from GTD Space
   - Note down your preferences

2. **Uninstall GTD Space**:
   - Windows: Control Panel → Programs → Uninstall
   - macOS: Drag app to Trash, empty Trash
   - Linux: Remove AppImage file

3. **Clear application data**:
   ```bash
   # Windows:
   rd /s /q "%APPDATA%\GTDSpace"
   
   # macOS:
   rm -rf ~/Library/Application\ Support/GTDSpace
   rm -rf ~/Library/Preferences/com.gtdspace.*
   
   # Linux:
   rm -rf ~/.local/share/GTDSpace
   rm -rf ~/.config/GTDSpace
   ```

4. **Reinstall** from fresh download

### Network Diagnostics

#### If Using Web Version
1. **Check network connection**
2. **Clear browser cache and cookies**
3. **Disable browser extensions** temporarily
4. **Try incognito/private mode**
5. **Check firewall/proxy settings**

---

## Getting Additional Help

### When to Contact Support

Contact support if:
- You've tried all relevant troubleshooting steps
- You're experiencing data loss
- The application won't start at all
- You've found a security issue

### Information to Include

When reporting issues, include:

1. **System Information**:
   - Operating system and version
   - GTD Space version
   - Hardware specifications

2. **Issue Details**:
   - Exact error messages
   - Steps to reproduce
   - Screenshots/screen recordings
   - Log files (if available)

3. **Context**:
   - When did the issue start?
   - What changed recently?
   - How frequently does it occur?

### Temporary Workarounds

While waiting for fixes:
- Use alternative markdown editors for critical work
- Export your work regularly
- Keep backups of important files
- Use simpler features if complex ones are problematic

---

## Prevention Best Practices

### Regular Maintenance

1. **Keep GTD Space updated** - Enable auto-updates if available
2. **Regular backups** - Use system backup solutions
3. **Monitor disk space** - Keep at least 1GB free
4. **Restart periodically** - Restart GTD Space every few days
5. **Clean temporary files** - Clear system temp files monthly

### File Organization

1. **Use consistent naming** - Avoid special characters in filenames
2. **Organize in folders** - Don't put too many files in one folder
3. **Regular cleanup** - Archive old files periodically
4. **Version control** - Consider using git for important documents

### System Health

1. **Keep OS updated** - Install security and performance updates
2. **Monitor system resources** - Ensure adequate RAM and storage
3. **Antivirus maintenance** - Keep definitions updated
4. **Regular reboots** - Restart your computer regularly

Remember: Most issues have simple solutions. Work through this guide systematically, and you'll resolve the vast majority of problems quickly!