#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const versionType = args[0]; // 'major', 'minor', 'patch', or specific version like '1.2.3'

if (!versionType) {
  console.error('Usage: npm run version:bump <major|minor|patch|x.y.z>');
  process.exit(1);
}

// Helper function to read file
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Helper function to write file
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

// Helper function to bump version
function bumpVersion(currentVersion, type) {
  const parts = currentVersion.replace('v', '').split('.').map(Number);
  
  if (type === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1]++;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2]++;
  } else if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  } else {
    console.error(`Invalid version type: ${type}`);
    process.exit(1);
  }
  
  return parts.join('.');
}

// Update package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFile(packageJsonPath));
const currentVersion = packageJson.version;
const newVersion = bumpVersion(currentVersion, versionType);

packageJson.version = newVersion;
writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ Updated package.json: ${currentVersion} → ${newVersion}`);

// Update src-tauri/Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = readFile(cargoTomlPath);
cargoToml = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${newVersion}"`
);
writeFile(cargoTomlPath, cargoToml);
console.log(`✓ Updated src-tauri/Cargo.toml to version ${newVersion}`);

// Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFile(tauriConfPath));
tauriConf.version = newVersion;
writeFile(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✓ Updated src-tauri/tauri.conf.json to version ${newVersion}`);

// Create git commit and tag
const commitMessage = `chore: bump version to v${newVersion}`;
const tagName = `v${newVersion}`;

try {
  // Stage the changed files
  execSync('git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json', { stdio: 'inherit' });
  
  // Create commit
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  console.log(`✓ Created commit: ${commitMessage}`);
  
  // Create tag
  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
  console.log(`✓ Created tag: ${tagName}`);
  
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