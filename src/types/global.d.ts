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
    readonly prototype: WeakRef<any>;
    new <T extends object>(target: T): WeakRef<T>;
  }

  var WeakRef: WeakRefConstructor;
}

export {};