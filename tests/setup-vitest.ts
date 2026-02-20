import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
  }

  if (!window.matchMedia) {
    window.matchMedia = (_query: string) =>
      ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
