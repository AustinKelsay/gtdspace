#!/usr/bin/env node
/* eslint-env node */

import { execSync } from 'child_process';
import { existsSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');
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

console.log('🎨 Generating icons from icon.png...');

try {
  // Use Tauri CLI to generate all icon formats
  execSync(`npx -y @tauri-apps/cli@^2 icon "${iconPath}" -o "${iconsDir}"`, {
    stdio: 'inherit',
    cwd: join(__dirname, '..')
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
  console.error('❌ Failed to generate icons');
  console.error('Make sure @tauri-apps/cli is installed');
  process.exit(1);
}