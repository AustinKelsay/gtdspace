#!/usr/bin/env node
/* eslint-env node */

import { execFileSync } from 'child_process';
import { existsSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'src-tauri', 'icons');
const iconPath = join(iconsDir, 'icon.png');

// Files we want to keep
const KEEP_FILES = [
  'icon.png',
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.ico',
  'icon.icns'
];

// Check if source icon exists
if (!existsSync(iconPath)) {
  console.error('❌ Error: src-tauri/icons/icon.png not found!');
  console.error('Please add your app icon as src-tauri/icons/icon.png');
  process.exit(1);
}

// Check if all required icons already exist
const requiredIcons = ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.ico', 'icon.icns'];
const allIconsExist = requiredIcons.every(icon => existsSync(join(iconsDir, icon)));

if (allIconsExist) {
  console.log('✅ All required icons already exist, skipping generation.');
  console.log('   Found:', requiredIcons.join(', '));
  process.exit(0);
}

console.log('🎨 Generating icons from icon.png...');

// Check if we're in CI or local environment
const isCI = process.env.CI === 'true';

// Use platform-appropriate command
const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';
const args = ['@tauri-apps/cli', 'icon', iconPath, '-o', iconsDir];

console.log(`Running: ${command} ${args.join(' ')}`);
console.log(`Platform: ${process.platform}`);
console.log(`CI Environment: ${isCI}`);

try {
  // Use Tauri CLI to generate all icon formats
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: isWindows // Use shell on Windows for better compatibility
  });
  
  // Clean up unwanted files
  console.log('🧹 Cleaning up extra files...');
  const files = readdirSync(iconsDir);
  for (const file of files) {
    if (!KEEP_FILES.includes(file)) {
      const filePath = join(iconsDir, file);
      rmSync(filePath, { recursive: true, force: true });
    }
  }
  
  console.log('✅ Icons generated successfully!');
  console.log('   Kept only essential files:', KEEP_FILES.join(', '));
} catch (error) {
  console.error('❌ Failed to generate icons.');
  console.error(`Command failed with exit code ${error.status || error.code}:`);
  console.error(`  Command: ${command} ${args.join(' ')}`);
  console.error(`  Working directory: ${projectRoot}`);
  console.error(`  Icon source path: ${iconPath}`);
  
  if (error.stderr) {
    console.error('  Stderr:', error.stderr.toString());
  }
  if (error.message) {
    console.error('  Error message:', error.message);
  }
  
  // Provide more helpful error messages
  if (isWindows && isCI) {
    console.error('\n💡 Note: This appears to be a Windows CI environment.');
    console.error('   The Tauri CLI might not be properly accessible.');
    console.error('   Ensure @tauri-apps/cli is installed via npm ci.');
  }
  
  process.exit(1);
}
