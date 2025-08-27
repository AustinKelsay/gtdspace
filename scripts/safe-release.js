#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
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

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch'; // Default to patch

  // Validate version type
  const incrementKeywords = new Set(['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
  const semverRegex = /^\d+\.\d+\.\d+(?:-.+)?$/; // e.g., 1.2.3 or 1.2.3-beta.1

  const isIncrementKeyword = incrementKeywords.has(versionType);
  const isSemver = semverRegex.test(versionType) || (versionType.startsWith('v') && semverRegex.test(versionType.slice(1)));

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
    execCommand('git fetch', true);
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

  const localCommit = execCommand('git rev-parse HEAD', true);
  if (!localCommit) {
    exitWithError('Failed to get local commit hash. Ensure you have at least one commit');
  }

  const remoteCommit = execCommand(`git rev-parse origin/${currentBranch}`, true);
  if (!remoteCommit) {
    exitWithError(`Remote branch origin/${currentBranch} not found. Ensure the branch exists on remote`);
  }

  if (localCommit !== remoteCommit) {
    const behindStr = execCommand(`git rev-list --count HEAD..origin/${currentBranch}`, true);
    const aheadStr = execCommand(`git rev-list --count origin/${currentBranch}..HEAD`, true);

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

  if (packageJson.scripts && packageJson.scripts.test) {
    log('Running test suite...', 'yellow');
    try {
      execCommand('npm test');
      log('✓ All tests passed', 'green');
    } catch (error) {
      exitWithError('Tests failed. Please fix all failing tests before releasing');
    }
  } else {
    log('⚠ No test script found, skipping tests', 'yellow');
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
      // Explicit semver provided: use npm version directly
      execCommand(`npm version ${cleanVersion}`);
    } else if (isIncrementKeyword) {
      // Keyword provided: use namespaced script (e.g., version:patch)
      const scriptName = `version:${versionType}`;
      const hasScript = Boolean(packageJson.scripts && Object.prototype.hasOwnProperty.call(packageJson.scripts, scriptName));
      if (!hasScript) {
        exitWithError(
          `Missing npm script '${scriptName}'. Define it in package.json or provide an explicit version like 1.2.3`
        );
      }
      execCommand(`npm run ${scriptName}`);
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

  // Step 9: Push changes and tags
  log('\n📤 Pushing changes to remote...', 'yellow');
  try {
    execCommand('git push');
    log('✓ Pushed commits to remote', 'green');
  } catch (error) {
    exitWithError(`Failed to push commits: ${error.message}`);
  }

  log('\n📤 Pushing tags to remote...', 'yellow');
  try {
    execCommand('git push --tags');
    log('✓ Pushed tags to remote', 'green');
  } catch (error) {
    exitWithError(`Failed to push tags: ${error.message}`);
  }

  // Success!
  const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const newVersion = updatedPackageJson.version;

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