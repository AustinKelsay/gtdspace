import { describe, expect, it } from 'vitest';
import {
  classifySidebarPath,
  extractProjectPathFromReadme,
  isProjectActionPath,
  isProjectReadmePath,
  isReadmePath,
  isSectionFilePath,
  matchesSectionPathVariants,
  normalizeSidebarPath,
} from '@/hooks/sidebar/path-classification';

const rootPath = '/tmp/gtd-space';

describe('sidebar path classification', () => {
  it('classifies project README paths for md and markdown files', () => {
    const markdownPath = `${rootPath}\\Projects\\Project Alpha\\README.markdown`;

    expect(isReadmePath(markdownPath)).toBe(true);
    expect(isProjectReadmePath(markdownPath, rootPath)).toBe(true);
    expect(extractProjectPathFromReadme(markdownPath)).toBe(
      `${rootPath}/Projects/Project Alpha`
    );
    expect(classifySidebarPath(markdownPath, rootPath)).toMatchObject({
      kind: 'project-readme',
      normalizedPath: `${rootPath}/Projects/Project Alpha/README.markdown`,
      projectPath: `${rootPath}/Projects/Project Alpha`,
    });
  });

  it('classifies project action files and excludes README files', () => {
    const actionPath = `${rootPath}/Projects/Project Alpha/Write spec.md`;
    const readmePath = `${rootPath}/Projects/Project Alpha/README.md`;
    const rootLevelProjectFile = `${rootPath}/Projects/notes.md`;

    expect(isProjectActionPath(actionPath, rootPath)).toBe(true);
    expect(isProjectActionPath(readmePath, rootPath)).toBe(false);
    expect(isProjectActionPath(rootLevelProjectFile, rootPath)).toBe(false);
    expect(classifySidebarPath(actionPath, rootPath)).toMatchObject({
      kind: 'project-action',
      projectPath: `${rootPath}/Projects/Project Alpha`,
    });
  });

  it('rejects nested and root-level project README files', () => {
    const rootReadmePath = `${rootPath}/Projects/README.md`;
    const nestedReadmePath = `${rootPath}/Projects/Project Alpha/Docs/README.md`;

    expect(isProjectReadmePath(rootReadmePath, rootPath)).toBe(false);
    expect(isProjectReadmePath(nestedReadmePath, rootPath)).toBe(false);
    expect(extractProjectPathFromReadme(rootReadmePath, rootPath)).toBeNull();
    expect(extractProjectPathFromReadme(nestedReadmePath, rootPath)).toBeNull();
    expect(classifySidebarPath(rootReadmePath, rootPath)).toMatchObject({
      kind: 'other',
      normalizedPath: rootReadmePath,
    });
    expect(classifySidebarPath(nestedReadmePath, rootPath)).toMatchObject({
      kind: 'other',
      normalizedPath: nestedReadmePath,
    });
  });

  it('classifies section files across canonical and alias section folders', () => {
    const canonicalPath = `${rootPath}/Purpose & Principles/Focus.md`;
    const aliasPath = `${rootPath}/Purpose and Principles/Focus.markdown`;

    expect(isSectionFilePath(canonicalPath, rootPath)).toBe(true);
    expect(isSectionFilePath(aliasPath, rootPath)).toBe(true);
    expect(matchesSectionPathVariants(aliasPath, ['purpose'], rootPath)).toBe(true);
    expect(classifySidebarPath(canonicalPath, rootPath)).toMatchObject({
      kind: 'section-file',
      sectionId: 'purpose',
      sectionPath: `${rootPath}/Purpose & Principles`,
    });
  });

  it('supports rootless alias classification before the workspace root is hydrated', () => {
    const aliasPath = `${rootPath}/Purpose and Principles/Focus.markdown`;
    const canonicalPath = `${rootPath}/Purpose & Principles/Focus.markdown`;

    expect(normalizeSidebarPath(aliasPath)).toBe(canonicalPath);
    expect(isSectionFilePath(aliasPath)).toBe(true);
    expect(classifySidebarPath(aliasPath)).toMatchObject({
      kind: 'section-file',
      sectionId: 'purpose',
      normalizedPath: canonicalPath,
      sectionPath: `${rootPath}/Purpose & Principles`,
    });
  });

  it('returns other for unrelated files', () => {
    expect(classifySidebarPath('/tmp/notes/README.md', rootPath)).toEqual({
      kind: 'other',
      normalizedPath: '/tmp/notes/README.md',
    });
  });
});
