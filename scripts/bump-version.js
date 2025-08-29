#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function bumpVersion(currentVersion, type) {
  const sanitize = (v) => String(v).trim().replace(/^v/i, '');
  const base = (v) => sanitize(v).replace(/[+-].*$/, ''); // strip prerelease/build for bump math
  const parse = (v) => {
    const parts = base(v).split('.');
    if (parts.length !== 3) {
      console.error(`Invalid semantic version: ${v}`);
      process.exit(1);
    }
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
      console.error(`Invalid semantic version: ${v}`);
      process.exit(1);
    }
    return nums;
  };

  // Strict SemVer with optional v-prefix, prerelease and build metadata
  const semverFull = /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (semverFull.test(type)) return sanitize(type);

  const parts = parse(currentVersion);
  if (type === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1]++;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2]++;
  } else {
    console.error(`Invalid version type: ${type}`);
    process.exit(1);
  }
  return parts.join('.');
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0];

  if (!versionType) {
    console.error('Usage: npm run version:bump <major|minor|patch|x.y.z>');
    process.exit(1);
  }

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFile(packageJsonPath));
  const currentVersion = packageJson.version;
  const newVersion = bumpVersion(currentVersion, versionType);

  // Check if version is unchanged (no-op case)
  if (newVersion === currentVersion) {
    console.log(`Version is already ${currentVersion}. No changes needed.`);
    return;
  }

  packageJson.version = newVersion;
  writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✓ Updated package.json: ${currentVersion} → ${newVersion}`);

  try {
    console.log('⟳ Syncing package-lock.json...');
    execSync('npm install --package-lock-only', { stdio: 'inherit' });
    console.log('✓ Synced package-lock.json');
  } catch (error) {
    console.error('❌ Failed to sync package-lock.json:', error.message);
    process.exit(1);
  }

  const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
  let cargoToml = readFile(cargoTomlPath);
  const packageSectionRegex = /(\[package\][\s\S]*?^\s*version\s*=\s*")[^"]+(")/m;
  if (!packageSectionRegex.test(cargoToml)) {
    console.error('Could not find version in [package] section of Cargo.toml');
    process.exit(1);
  }
  cargoToml = cargoToml.replace(packageSectionRegex, `$1${newVersion}$2`);
  writeFile(cargoTomlPath, cargoToml);
  console.log(`✓ Updated src-tauri/Cargo.toml to version ${newVersion}`);

  const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFile(tauriConfPath));
  tauriConf.version = newVersion;
  if (tauriConf.package && tauriConf.package.version) {
    tauriConf.package.version = newVersion;
  }
  writeFile(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✓ Updated src-tauri/tauri.conf.json to version ${newVersion}`);

  const commitMessage = `chore: bump version to v${newVersion}`;
  const tagName = `v${newVersion}`;

  // Pre-check if tag already exists before staging files and committing
  try {
    execSync(`git rev-parse --verify refs/tags/${tagName}`, { stdio: 'ignore' });
    // If the command succeeds, the tag exists.
    console.error(`❌ Error: Git tag '${tagName}' already exists. Aborting.`);
    process.exit(1);
  } catch (error) {
    // This is expected if the tag does not exist. We can proceed.
  }

  try {
    execSync('git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json', { stdio: 'inherit' });
    let preCommitHash = null;
    try {
      preCommitHash = execSync('git rev-parse --verify HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch {
      // No previous commit in the repository (fresh repo)
    }
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log(`✓ Created commit: ${commitMessage}`);
    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
      console.log(`✓ Created tag: ${tagName}`);
    } catch (tagError) {
      console.error('Failed to create tag. Undoing the version bump commit while keeping your changes staged...');
      if (preCommitHash) {
        execSync(`git reset --soft ${preCommitHash}`, { stdio: 'inherit' });
        console.error('\n⚠️  The version bump commit has been undone; your changes remain staged.');
      } else {
        console.error('No previous commit detected; skip reset. Your changes remain in the new commit — amend or revert manually.');
      }
      console.error('You can either:');
      console.error(`  1. Retry creating the tag: git tag -a ${tagName} -m "Release ${tagName}"`);
      console.error(`  2. Or commit and tag manually with the commands shown below.`);
      throw tagError;
    }
    console.log('\n🎉 Version bump complete!');
    console.log(`\nNext steps:`);
    console.log(`  1. Push the changes: git push`);
    console.log(`  2. Push the tag: git push origin ${tagName}`);
    console.log(`  3. The GitHub Action will automatically build and create a release`);
  } catch (error) {
    console.error('Failed to create git commit/tag:', error.message);
    console.log('\nYou can manually commit and tag the changes:');
    console.log(`  git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json`);
    console.log(`  git commit -m "${commitMessage}"`);
    console.log(`  git tag -a ${tagName} -m "Release ${tagName}"`);
  }
}

const isDirectRun = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main();