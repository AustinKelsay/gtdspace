#!/usr/bin/env node

import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
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

function exitWithError(message) {
  log(`❌ ${message}`, 'red');
  process.exit(1);
}

function execCommand(command, silent = false) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (silent) {
      return null;
    }
    throw error;
  }
}

function execCommandFile(file, args = [], silent = false) {
  try {
    const result = execFileSync(file, args, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (silent) {
      return null;
    }
    throw error;
  }
}

async function main() {
  // Parse command line arguments
  const rawArgs = process.argv.slice(2);
  const flags = new Set(rawArgs.filter((arg) => arg.startsWith('-')));
  const versionType = rawArgs.find((arg) => !arg.startsWith('-')) || 'patch'; // Default to patch

  // Validate version type
  const incrementKeywords = new Set(['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
  // Strict SemVer with optional v-prefix, prerelease and build metadata
  const semverRegex = /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

  const isIncrementKeyword = incrementKeywords.has(versionType);
  const isSemver = semverRegex.test(versionType);

  if (!isIncrementKeyword && !isSemver) {
    exitWithError(
      `Invalid version: ${versionType}. Use one of patch, minor, major, prepatch, preminor, premajor, prerelease, or an explicit semver like 1.2.3 or 1.2.3-beta.1`
    );
  }

  log('🚀 Starting safe release process...', 'blue');

  // Step 1: Check for uncommitted changes
  log('\n📋 Checking git status...', 'yellow');
  const gitStatus = execCommand('git status --porcelain', true);
  if (gitStatus === null || gitStatus === undefined) {
    exitWithError('Failed to check git status. Ensure git is installed and you are in a git repository');
  } else if (gitStatus) {
    log('Uncommitted changes detected:', 'red');
    console.log(gitStatus);
    exitWithError('Please commit or stash all changes before releasing');
  }
  log('✓ Working directory is clean', 'green');

  // Step 2: Fetch latest changes from remote
  log('\n🔄 Fetching latest changes from remote...', 'yellow');
  try {
    const fetchResult = execCommand('git fetch', true);
    if (!fetchResult) {
      exitWithError('Failed to fetch from remote. Check your internet connection and repository access');
    }
    log('✓ Fetched latest changes', 'green');
  } catch (error) {
    exitWithError('Failed to fetch from remote. Check your internet connection and repository access');
  }

  // Step 3: Check if local branch is up to date with remote
  log('\n🔍 Checking if branch is up to date...', 'yellow');
  const currentBranch = execCommand('git rev-parse --abbrev-ref HEAD', true);
  if (!currentBranch) {
    exitWithError('Failed to get current branch name. Ensure you are in a git repository');
  }

  // Validate branch name using git check-ref-format to prevent shell injection
  try {
    execFileSync('git', ['check-ref-format', '--branch', currentBranch], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (error) {
    exitWithError(`Invalid branch name detected: "${currentBranch}". Git reports this as an invalid refname. Aborting for safety.`);
  }

  const localCommit = execCommandFile('git', ['rev-parse', 'HEAD'], true);
  if (!localCommit) {
    exitWithError('Failed to get local commit hash. Ensure you have at least one commit');
  }

  const remoteCommit = execCommandFile('git', ['rev-parse', `origin/${currentBranch}`], true);
  if (!remoteCommit) {
    exitWithError(`Remote branch origin/${currentBranch} not found. Ensure the branch exists on remote`);
  }

  if (localCommit !== remoteCommit) {
    const behindStr = execCommandFile('git', ['rev-list', '--count', `HEAD..origin/${currentBranch}`], true);
    const aheadStr = execCommandFile('git', ['rev-list', '--count', `origin/${currentBranch}..HEAD`], true);

    // Parse and normalize the counts
    const behind = parseInt((behindStr || '0').trim(), 10) || 0;
    const ahead = parseInt((aheadStr || '0').trim(), 10) || 0;

    if (behind !== 0) {
      exitWithError(`Local branch is ${behind} commits behind origin/${currentBranch}. Please pull latest changes`);
    }
    if (ahead !== 0) {
      exitWithError(`Local branch is ${ahead} commits ahead of origin/${currentBranch}. Please push your changes first`);
    }
  }
  log(`✓ Branch '${currentBranch}' is up to date with remote`, 'green');

  // Step 4: Check if we have a test script
  log('\n🧪 Checking for test suite...', 'yellow');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const hasTestScript = Boolean(packageJson.scripts && packageJson.scripts.test);
  if (hasTestScript) {
    log('Running test suite...', 'yellow');
    try {
      execCommand('npm test');
      log('✓ All tests passed', 'green');
    } catch (error) {
      exitWithError('Tests failed. Please fix all failing tests before releasing');
    }
  } else {
    // No test script present: require explicit confirmation or CLI flag to proceed
    if (flags.has('--no-tests')) {
      log("⚠ Proceeding without tests due to '--no-tests' flag", 'yellow');
    } else if (process.stdin.isTTY && process.stdout.isTTY && !process.env.CI) {
      const confirmed = await new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(
          "No 'test' script found in package.json. Releases should not proceed silently without tests.\nTo continue without tests, type 'yes' and press Enter (recommended: add tests and a 'test' npm script). Continue? ",
          (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'yes');
          }
        );
      });
      if (!confirmed) {
        exitWithError(
          "Release aborted. Add tests and a 'test' script, or re-run with the '--no-tests' flag to bypass explicitly."
        );
      }
      log('⚠ Continuing without tests (user confirmed)', 'yellow');
    } else {
      exitWithError(
        "No 'test' script found. In non-interactive environments, a release requires tests. Add tests and a 'test' script, or re-run with the '--no-tests' flag to bypass explicitly."
      );
    }
  }

  // Step 5: Run type checking
  if (packageJson.scripts && packageJson.scripts['type-check']) {
    log('\n📝 Running type check...', 'yellow');
    try {
      execCommand('npm run type-check');
      log('✓ Type check passed', 'green');
    } catch (error) {
      exitWithError('Type checking failed. Please fix all type errors before releasing');
    }
  }

  // Step 6: Run linting
  if (packageJson.scripts && packageJson.scripts.lint) {
    log('\n🔍 Running linter...', 'yellow');
    try {
      execCommand('npm run lint');
      log('✓ Linting passed', 'green');
    } catch (error) {
      exitWithError('Linting failed. Please fix all lint errors before releasing');
    }
  }

  // Step 7: Get current version
  const currentVersion = packageJson.version;
  log(`\n📦 Current version: ${currentVersion}`, 'blue');

  // Step 8: Run version bump
  log(`\n⬆️ Bumping version (${versionType})...`, 'yellow');
  try {
    const cleanVersion = versionType.startsWith('v') ? versionType.slice(1) : versionType;

    if (isSemver) {
      // Explicit semver provided: use the centralized bump-version script
      // This ensures all files (package.json, Cargo.toml, tauri.conf.json) are updated
      const bumpScriptPath = path.join(__dirname, 'bump-version.js');
      execCommandFile('node', [bumpScriptPath, cleanVersion]);
    } else if (isIncrementKeyword) {
      // Keyword provided: use namespaced script (e.g., version:patch)
      const scriptName = `version:${versionType}`;
      const hasScript = Boolean(packageJson.scripts && Object.prototype.hasOwnProperty.call(packageJson.scripts, scriptName));
      if (!hasScript) {
        exitWithError(
          `Missing npm script '${scriptName}'. Define it in package.json or provide an explicit version like 1.2.3`
        );
      }
      // Run npm script without shell interpolation
      execCommandFile('npm', ['run', scriptName]);
    } else {
      exitWithError(
        `Invalid version input: ${versionType}. Use an increment keyword (patch, minor, major, prepatch, preminor, premajor, prerelease) or an explicit semver (e.g., 1.2.3)`
      );
    }

    // Read new version
    const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const newVersion = updatedPackageJson.version;
    log(`✓ Version bumped to ${newVersion}`, 'green');
  } catch (error) {
    exitWithError(`Failed to bump version: ${error.message}`);
  }

  // Note: The bump-version.js script already creates the commit and tag,
  // so we don't need to do it again here

  // Step 9: Get the tag name that was created
  const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const newVersion = updatedPackageJson.version;
  const tagName = `v${newVersion}`;

  // Step 10: Push changes and the specific tag
  log('\n📤 Pushing changes to remote...', 'yellow');
  try {
    execCommand('git push');
    log('✓ Pushed commits to remote', 'green');
  } catch (error) {
    exitWithError(`Failed to push commits: ${error.message}`);
  }

  log(`\n📤 Pushing tag ${tagName} to remote...`, 'yellow');
  try {
    execCommandFile('git', ['push', 'origin', tagName]);
    log(`✓ Pushed tag ${tagName} to remote`, 'green');
  } catch (error) {
    exitWithError(`Failed to push tag ${tagName}: ${error.message}`);
  }

  // Success!

  log('\n' + '='.repeat(50), 'green');
  log('🎉 Release completed successfully!', 'green');
  log('='.repeat(50), 'green');
  log(`\n📦 Released version: v${newVersion}`, 'blue');
  log('\n🚀 Next steps:', 'yellow');
  log('  1. The GitHub Action will automatically build and create a release');
  log('  2. Once the build completes, the release will be available on GitHub');
  log('  3. Users can download the built application from the Releases page');
}

const isDirectRun = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main();