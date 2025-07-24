# Frequently Asked Questions (FAQ)

> **Quick answers to common questions about GTD Space**

## Table of Contents

1. [Getting Started](#getting-started)
2. [File Management](#file-management)
3. [Editor Features](#editor-features)
4. [Performance & Troubleshooting](#performance--troubleshooting)
5. [Platform-Specific Issues](#platform-specific-issues)
6. [Advanced Features](#advanced-features)
7. [Data & Privacy](#data--privacy)

---

## Getting Started

### Q: How do I open my first markdown file?
**A:** Click the folder icon in the sidebar or use `Ctrl+O` to select a folder containing markdown files. GTD Space will automatically scan and display all `.md` and `.markdown` files in that folder.

### Q: Can I use GTD Space without selecting a folder?
**A:** No, GTD Space is designed to work with local folders containing markdown files. You need to select a folder to begin editing. This ensures all your files stay organized and local.

### Q: Why isn't my file showing up in the file list?
**A:** GTD Space only displays files with `.md` and `.markdown` extensions. Make sure your file has the correct extension. If you just created the file outside GTD Space, try refreshing the file list with `F5`.

### Q: How do I create a new file?
**A:** Use `Ctrl+N` or click the "+" button next to the search bar in the sidebar. GTD Space will create a new markdown file in your selected folder.

---

## File Management

### Q: Where are my files saved?
**A:** All files remain in the original location on your computer. GTD Space doesn't move or copy your files - it edits them directly where they are.

### Q: Does GTD Space auto-save my work?
**A:** Yes! GTD Space automatically saves your changes every few seconds. You'll see a green "Saved" indicator in the header when your work is saved. You can also manually save with `Ctrl+S`.

### Q: Can I rename files within GTD Space?
**A:** Yes, right-click on any file in the sidebar and select "Rename" or press `F2` when a file is selected.

### Q: How do I delete a file?
**A:** Right-click on a file in the sidebar and select "Delete" or press `Delete` when a file is selected. This will permanently delete the file from your system.

### Q: Why did my file disappear from the list?
**A:** This usually happens when:
- The file was moved or deleted outside of GTD Space
- The file extension was changed to something other than `.md` or `.markdown`
- There was a permission issue accessing the file
- The folder path has changed

---

## Editor Features

### Q: How do I switch between editor modes?
**A:** Use the mode toggle buttons in the editor toolbar:
- **WYSIWYG Mode**: Rich text editing with formatting toolbar
- **Source Mode**: Raw markdown editing with syntax highlighting
- **Preview Mode**: Read-only preview of formatted content
- **Split Mode**: Side-by-side source and preview

Keyboard shortcuts: `Ctrl+Shift+W` (WYSIWYG), `Ctrl+Shift+S` (Source), `Ctrl+Shift+P` (Preview)

### Q: How do I insert tables, images, or links?
**A:** In WYSIWYG mode, use the toolbar buttons or:
- **Tables**: `Ctrl+Shift+T` or toolbar table icon
- **Links**: `Ctrl+K` or toolbar link icon
- **Images**: Use markdown syntax `![alt text](path/to/image.jpg)` in source mode

### Q: Can I have multiple files open at once?
**A:** Yes! GTD Space supports tabbed editing. Open files appear as tabs at the top of the editor. Use `Ctrl+Tab` to switch between tabs and `Ctrl+W` to close the current tab.

### Q: How do I search within a file?
**A:** Use `Ctrl+F` to open the in-file search. Use `Ctrl+Shift+F` to search across all files in your workspace.

### Q: Can I use custom keyboard shortcuts?
**A:** GTD Space comes with predefined keyboard shortcuts optimized for markdown editing. Custom shortcut configuration is planned for a future release.

---

## Performance & Troubleshooting

### Q: GTD Space is running slowly. What can I do?
**A:** Try these solutions:
1. **Close unused tabs** - Each open file uses memory
2. **Restart the application** - This clears any memory leaks
3. **Check your folder size** - Folders with thousands of files may slow down the file browser
4. **Update GTD Space** - Performance improvements are released regularly

### Q: My file won't save. What's wrong?
**A:** Common causes:
- **File permissions** - Make sure you have write access to the file
- **File in use** - The file might be open in another application
- **Disk space** - Check if your drive has available space
- **File corruption** - Try copying the content to a new file

### Q: The application crashed. Will I lose my work?
**A:** GTD Space has auto-save and crash recovery features:
- **Auto-save** runs every few seconds while you type
- **Crash recovery** attempts to restore unsaved changes when you restart
- **Tab restoration** reopens your previously open files

### Q: Why can't I see my changes in preview mode?
**A:** Make sure:
- Your changes are saved (check the save indicator in the header)
- You're not in source-only mode
- Refresh the preview with `Ctrl+R` if needed

---

## Platform-Specific Issues

### Q: [Windows] The application won't start. What should I do?
**A:** Try these steps:
1. **Run as Administrator** - Right-click the GTD Space icon and select "Run as administrator"
2. **Check Windows Defender** - Add GTD Space to your antivirus exclusions
3. **Update Windows** - Ensure you have the latest Windows updates
4. **Reinstall** - Download the latest version from the official website

### Q: [macOS] I get a security warning when opening GTD Space
**A:** This is normal for downloaded applications:
1. Go to **System Preferences > Security & Privacy**
2. Click **"Open Anyway"** next to the GTD Space warning
3. Or right-click the app and select **"Open"** to bypass Gatekeeper

### Q: [Linux] The application won't launch
**A:** Ensure you have the required dependencies:
```bash
# For Ubuntu/Debian:
sudo apt install libgtk-3-0 libwebkit2gtk-4.0-37

# For Fedora:
sudo dnf install gtk3 webkit2gtk3

# Make the AppImage executable:
chmod +x GTDSpace.AppImage
```

### Q: [All Platforms] Font rendering looks poor
**A:** GTD Space uses system fonts for the best native experience:
- **Windows**: Segoe UI
- **macOS**: San Francisco
- **Linux**: System default (usually Ubuntu/Roboto)

If fonts look poor, check your system font rendering settings.

---

## Advanced Features

### Q: How do I view document analytics?
**A:** Click the chart icon (📊) in the header to open the Analytics dashboard. This shows:
- Word count and reading time
- Document complexity analysis
- Writing productivity metrics
- Activity heatmaps

### Q: Can I export my documents to other formats?
**A:** Yes! GTD Space supports:
- **PDF export** - Professional formatted documents
- **HTML export** - Standalone web pages
- **Raw markdown** - Copy formatted markdown text

Access export options through the File menu or `Ctrl+E`.

### Q: How do I use the writing goals feature?
**A:** Writing goals are tracked automatically:
- Set daily word count targets in Settings
- View progress in the Analytics dashboard
- Track your writing streaks and productivity patterns

### Q: What is the document outline for?
**A:** The document outline automatically generates a table of contents from your headings (`#`, `##`, `###`). Click any heading in the outline to jump to that section.

---

## Data & Privacy

### Q: Is my data secure?
**A:** Yes! GTD Space is designed with privacy in mind:
- **Local-only** - All files stay on your computer
- **No cloud sync** - Nothing is uploaded to external servers
- **No tracking** - No personal data is collected or transmitted
- **Open source** - The code is available for review

### Q: Can I use GTD Space offline?
**A:** Absolutely! GTD Space is a desktop application that works entirely offline. No internet connection is required for any features.

### Q: How do I backup my files?
**A:** Since all files remain in their original locations:
- Use your regular backup solution (Time Machine, Windows Backup, etc.)
- Copy your markdown folder to another location
- Use git for version control of your documents

### Q: Can multiple people edit the same files?
**A:** GTD Space doesn't include real-time collaboration features. However, you can:
- Use git for version control and collaboration
- Share files through cloud storage (Dropbox, OneDrive, etc.)
- Take turns editing files

---

## Still Need Help?

If your question isn't answered here:

1. **Check the in-app help** - Press `F1` or click Help in the menu
2. **Search keyboard shortcuts** - Press `Ctrl+Shift+K` for the shortcuts reference
3. **Report a bug** - Use Help > Report Issue to file bug reports
4. **Feature requests** - Submit ideas through Help > Feature Request

### Emergency Data Recovery

If you experience data loss:

1. **Check auto-save** - Look for `.gtdspace-backup` files in your folder
2. **System recovery** - Use your operating system's file recovery tools
3. **Previous versions** - Check if your OS has file version history enabled

Remember: GTD Space never deletes your original files - they remain exactly where you put them!