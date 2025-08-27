#!/usr/bin/env node

import { execSync, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd,
      ...options
    });
    return { success: true, output: result ? result.trim() : '' };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      stderr: error.stderr ? error.stderr.toString() : ''
    };
  }
}

function findPythonExecutable() {
  // Try common Python executable names in order of preference
  const pythonCommands = ['python3', 'python', 'py'];
  
  for (const cmd of pythonCommands) {
    const result = execCommand(`${cmd} --version`, { silent: true });
    if (result.success) {
      log(`Found Python: ${cmd} (${result.output})`, 'green');
      return cmd;
    }
  }
  
  return null;
}

function findTauriCLI() {
  // Check if Tauri CLI is installed locally first (preferred)
  const localTauriPath = join(__dirname, '..', 'node_modules', '.bin');
  
  // Check for platform-specific executable
  const isWindows = process.platform === 'win32';
  const tauriCmd = isWindows ? 'tauri.cmd' : 'tauri';
  const localTauri = join(localTauriPath, tauriCmd);
  
  if (existsSync(localTauri)) {
    log('Found local Tauri CLI installation', 'green');
    return localTauri;
  }
  
  // Try global tauri command
  const result = execCommand('tauri --version', { silent: true });
  if (result.success) {
    log('Found global Tauri CLI installation', 'green');
    return 'tauri';
  }
  
  // Try using npx as last resort (will download if needed)
  log('Tauri CLI not found locally, will use npx to run it', 'yellow');
  return 'npx @tauri-apps/cli';
}

async function main() {
  log('🎨 Starting icon generation process...', 'blue');
  
  const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');
  const iconPath = join(iconsDir, 'icon.png');
  
  // Step 1: Check if source icon exists
  if (!existsSync(iconPath)) {
    log(`⚠️  Warning: icon.png not found at ${iconPath}`, 'yellow');
    log('Please ensure src-tauri/icons/icon.png exists before running this script', 'yellow');
    process.exit(1);
  }
  log('✓ Found source icon.png', 'green');
  
  // Step 2: Try Python-based generation scripts
  const pythonCmd = findPythonExecutable();
  if (pythonCmd) {
    log('\n📐 Attempting Python-based icon generation...', 'blue');
    
    // Try generate_icons.py first (comprehensive solution)
    const generateScript = join(iconsDir, 'generate_icons.py');
    let pythonGenSucceeded = false;
    if (existsSync(generateScript)) {
      const result = execCommand(`${pythonCmd} "${generateScript}"`, { 
        cwd: iconsDir,
        silent: false 
      });
      if (result.success) {
        log('✓ Successfully generated icons with Python script', 'green');
        pythonGenSucceeded = true;
      } else {
        log('⚠️  Python icon generation failed, will continue with Tauri CLI', 'yellow');
      }
    }
    
    // Try create_minimal_ico.py as fallback
    const minimalScript = join(iconsDir, 'create_minimal_ico.py');
    if (!pythonGenSucceeded && !existsSync(join(iconsDir, 'icon.ico')) && existsSync(minimalScript)) {
      const result = execCommand(`${pythonCmd} "${minimalScript}"`, { 
        cwd: iconsDir,
        silent: false 
      });
      if (result.success) {
        log('✓ Successfully created minimal ICO with Python', 'green');
      }
    }
  } else {
    log('⚠️  Python not found, skipping Python-based icon generation', 'yellow');
  }
  
  // Step 3: Use Tauri CLI to generate icons
  log('\n🔧 Running Tauri CLI icon generation...', 'blue');
  const tauriCmd = findTauriCLI();
  
  let tauriResult;
  try {
    let command;
    let args;

    if (tauriCmd.startsWith('npx')) {
      const parts = tauriCmd.split(' ');
      command = parts[0];
      args = [...parts.slice(1), 'icon', iconPath];
    } else {
      command = tauriCmd;
      args = ['icon', iconPath];
    }

    execFileSync(command, args, {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      encoding: 'utf8',
    });
    tauriResult = { success: true };
  } catch (error) {
    tauriResult = {
      success: false,
      error: error.message,
      stderr: error.stderr ? error.stderr.toString() : '',
    };
  }
  
  if (tauriResult.success) {
    log('✓ Successfully generated icons with Tauri CLI', 'green');
  } else {
    log('⚠️  Tauri CLI icon generation failed', 'yellow');
    if (tauriResult.stderr) {
      log(`Error details: ${tauriResult.stderr}`, 'red');
    }
  }
  
  // Step 4: Verify results
  log('\n📊 Checking generated icons...', 'blue');
  const expectedIcons = [
    'icon.ico',
    'icon.icns',
    '32x32.png',
    '128x128.png',
    '128x128@2x.png'
  ];
  
  let successCount = 0;
  for (const iconFile of expectedIcons) {
    const iconFilePath = join(iconsDir, iconFile);
    if (existsSync(iconFilePath)) {
      log(`  ✓ ${iconFile}`, 'green');
      successCount++;
    } else {
      log(`  ✗ ${iconFile} (missing)`, 'yellow');
    }
  }
  
  if (successCount === 0) {
    log('\n❌ Icon generation failed - no icons were created', 'red');
    log('Please ensure you have the necessary tools installed:', 'yellow');
    log('  - Python 3 with PIL/Pillow library', 'yellow');
    log('  - OR Tauri CLI (@tauri-apps/cli)', 'yellow');
    process.exit(1);
  } else if (successCount < expectedIcons.length) {
    log(`\n⚠️  Partial success: ${successCount}/${expectedIcons.length} icons generated`, 'yellow');
    log('Some icons may be missing, but build should proceed', 'yellow');
  } else {
    log('\n✨ All icons generated successfully!', 'green');
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});