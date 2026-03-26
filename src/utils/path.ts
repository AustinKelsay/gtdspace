export function canonicalizeLegacySectionAliases(path?: string | null): string | null | undefined {
  if (path == null) {
    return path;
  }

  return path
    .replace(/\\/g, '/')
    .replace(/(^|\/)Purpose and Principles(?=(\/|$))/gi, '$1Purpose & Principles');
}

export function norm(path?: string | null): string | null | undefined {
  return canonicalizeLegacySectionAliases(path);
}

/**
 * Returns true when `childPath` is equal to or nested under `parentPath`.
 * Both inputs should already be normalized (forward-slash, no trailing slash
 * quirks). Passing nullish values returns false.
 */
export function isUnder(childPath?: string | null, parentPath?: string | null): boolean {
  if (!childPath || !parentPath) {
    return false;
  }

  if (childPath === parentPath) {
    return true;
  }

  const parentWithSlash = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  return childPath.startsWith(parentWithSlash);
}
