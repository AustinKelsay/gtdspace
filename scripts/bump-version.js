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
  const parse = (v) => {
    const parts = sanitize(v).split('.');
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

  if (/^v?\d+\.\d+\.\d+$/.test(type)) return sanitize(type);

  const parts = parse(currentVersion);
  if (type === 'major') parts[0]++, parts[1] = 0, parts[2] = 0;
  else if (type === 'minor') parts[1]++, parts[2] = 0;
  else if (type === 'patch') parts[2]++;
  else {
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

  packageJson.version = newVersion;
  writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✓ Updated package.json: ${currentVersion} → ${newVersion}`);

  const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
  let cargoToml = readFile(cargoTomlPath);
  const packageSectionRegex = /(\[package\][^[]*version\s*=\s*")[^"]*(")/m;
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
    execSync('git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json', { stdio: 'inherit' });
    const preCommitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log(`✓ Created commit: ${commitMessage}`);
    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
      console.log(`✓ Created tag: ${tagName}`);
    } catch (tagError) {
      console.error('Failed to create tag. Undoing the version bump commit while keeping your changes staged...');
      execSync(`git reset --soft ${preCommitHash}`, { stdio: 'inherit' });
      console.error('\n⚠️  The version bump commit has been undone; your changes remain staged.');
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
    console.log(`  git add .`);
    console.log(`  git commit -m "${commitMessage}"`);
    console.log(`  git tag -a ${tagName} -m "Release ${tagName}"`);
  }
}

const isDirectRun = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main();