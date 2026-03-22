/**
 * Global type definitions and polyfills
 */

// WeakRef polyfill for TypeScript
declare global {
  interface WeakRef<T extends object> {
    readonly [Symbol.toStringTag]: "WeakRef";
    deref(): T | undefined;
  }

  interface WeakRefConstructor {
    readonly prototype: WeakRef<object>;
    new <T extends object>(target: T): WeakRef<T>;
  }

  const WeakRef: WeakRefConstructor;

  // Window extensions for GTD Space
  interface Window {
    onTabFileSaved?: (
      filePath: string,
      fileName: string,
      content: string,
      metadata: Record<string, unknown>
    ) => void;
    applyBacklinkChange?: (
      filePath: string,
      mutator: (content: string | null | undefined) => string
    ) => {
      handled: boolean;
      wasDirty: boolean;
    };
  }
}

export {};
