export function norm(path?: string | null): string | null | undefined {
  return path?.toLowerCase().replace(/\\/g, '/');
}
