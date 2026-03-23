#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

export function normalizeVersion(version) {
  const normalized = String(version ?? '').trim().replace(/^v/i, '');
  if (!normalized) {
    throw new Error('Release version is required');
  }

  return normalized;
}

export function normalizeTag(version) {
  return `v${normalizeVersion(version)}`;
}

export function resolveReleaseNotesPath(version, baseDir = repoRoot) {
  const normalizedVersion = normalizeVersion(version);
  const normalizedTag = normalizeTag(version);
  const releasesDir = path.join(baseDir, 'docs', 'releases');
  const candidates = [
    path.join(releasesDir, `${normalizedTag}.md`),
    path.join(releasesDir, `${normalizedVersion}.md`),
  ];
  const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!sourcePath) {
    const expected = candidates
      .map((candidate) => path.relative(baseDir, candidate))
      .join(' or ');
    throw new Error(`Missing release notes for ${normalizedTag}. Expected ${expected}`);
  }

  return sourcePath;
}

export function renderReleaseNotes(template, version) {
  const normalizedVersion = normalizeVersion(version);
  const normalizedTag = normalizeTag(version);
  const replacements = {
    version: normalizedVersion,
    tag: normalizedTag,
    release_name: `GTD Space ${normalizedTag}`,
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const normalizedKey = String(key).toLowerCase();
    return Object.prototype.hasOwnProperty.call(replacements, normalizedKey)
      ? replacements[normalizedKey]
      : match;
  });
}

export function buildReleaseNotes(version, baseDir = repoRoot) {
  const sourcePath = resolveReleaseNotesPath(version, baseDir);
  const template = fs.readFileSync(sourcePath, 'utf8');

  return {
    sourcePath,
    content: renderReleaseNotes(template, version),
  };
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    output: '',
    version: '',
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === '--output') {
      options.output = args.shift() ?? '';
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }

    if (!options.version) {
      options.version = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

function main() {
  const { version, output } = parseArgs(process.argv.slice(2));

  if (!version) {
    console.error('Usage: node scripts/release-notes.js <version> [--output <path>]');
    process.exit(1);
  }

  const { sourcePath, content } = buildReleaseNotes(version, repoRoot);

  if (output) {
    const outputPath = path.resolve(process.cwd(), output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`Release notes written to ${outputPath} from ${path.relative(repoRoot, sourcePath)}`);
    return;
  }

  process.stdout.write(content);
}

const isDirectRun = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
