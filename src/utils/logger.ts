type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

type LogMethod = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const METHOD_TO_LEVEL: Record<LogMethod, LogLevel> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
};

const STORAGE_KEY = 'gtdspace:log-level';

const onceCache = new Set<string>();

const isBrowser = () => typeof window !== 'undefined';

const isValidLevel = (level: string): level is LogLevel =>
  Object.prototype.hasOwnProperty.call(LOG_LEVEL_ORDER, level);

const resolveInitialLevel = (): LogLevel => {
  const envLevel =
    import.meta?.env?.VITE_GTDSPACE_LOG_LEVEL ??
    import.meta?.env?.VITE_LOG_LEVEL ??
    '';

  if (isValidLevel(envLevel)) {
    return envLevel;
  }

  if (isBrowser()) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isValidLevel(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage access issues
    }
  }

  return import.meta.env.MODE === 'production' ? 'error' : 'warn';
};

let currentLevel: LogLevel = resolveInitialLevel();

const persistLevel = (level: LogLevel) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Ignore persistence failures
  }
};

export const getLogLevel = (): LogLevel => currentLevel;

export const setLogLevel = (level: LogLevel, options?: { persist?: boolean }) => {
  if (!isValidLevel(level) || currentLevel === level) {
    return currentLevel;
  }

  currentLevel = level;

  if (options?.persist ?? true) {
    persistLevel(level);
  }

  return currentLevel;
};

const shouldLog = (method: LogMethod) => {
  return (
    LOG_LEVEL_ORDER[currentLevel] >= LOG_LEVEL_ORDER[METHOD_TO_LEVEL[method]]
  );
};

const formatScope = (scope: string) => (scope ? `[${scope}]` : '');

const consoleMethodFor = (method: LogMethod) => {
  switch (method) {
    case 'error':
      return console.error.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'info':
      return console.info ? console.info.bind(console) : console.log.bind(console);
    case 'debug':
    default:
      return console.debug ? console.debug.bind(console) : console.log.bind(console);
  }
};

const logInternal = (
  scope: string,
  method: LogMethod,
  args: unknown[],
  onceKey?: string
) => {
  if (!shouldLog(method)) {
    return;
  }

  if (onceKey) {
    const cacheKey = `${scope}:${method}:${onceKey}`;
    if (onceCache.has(cacheKey)) {
      return;
    }
    onceCache.add(cacheKey);
  }

  const prefix = formatScope(scope);
  const consoleMethod = consoleMethodFor(method);

  if (prefix) {
    consoleMethod(prefix, ...args);
  } else {
    consoleMethod(...args);
  }
};

export interface ScopedLogger {
  debug: (...args: unknown[]) => void;
  debugOnce: (key: string, ...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  infoOnce: (key: string, ...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  warnOnce: (key: string, ...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  errorOnce: (key: string, ...args: unknown[]) => void;
  scope: string;
}

const onceWrapper = (
  scope: string,
  method: LogMethod,
  key: string,
  args: unknown[]
) => logInternal(scope, method, args, key);

export const createScopedLogger = (scope: string): ScopedLogger => {
  return {
    scope,
    debug: (...args) => logInternal(scope, 'debug', args),
    debugOnce: (key, ...args) => onceWrapper(scope, 'debug', key, args),
    info: (...args) => logInternal(scope, 'info', args),
    infoOnce: (key, ...args) => onceWrapper(scope, 'info', key, args),
    warn: (...args) => logInternal(scope, 'warn', args),
    warnOnce: (key, ...args) => onceWrapper(scope, 'warn', key, args),
    error: (...args) => logInternal(scope, 'error', args),
    errorOnce: (key, ...args) => onceWrapper(scope, 'error', key, args),
  };
};

if (isBrowser()) {
  const globalConfig = {
    get level(): LogLevel {
      return getLogLevel();
    },
    set level(next: LogLevel) {
      setLogLevel(next);
    },
    levels: { ...LOG_LEVEL_ORDER },
  };

  const descriptor = Object.getOwnPropertyDescriptor(window, '__GTDSPACE_LOGGER__');

  if (descriptor) {
    let existingLevel: unknown;

    if ('value' in descriptor && descriptor.value) {
      const existing = descriptor.value as { level?: LogLevel };
      existingLevel = existing?.level;
    } else if (descriptor.get) {
      try {
        existingLevel = descriptor.get.call(window);
      } catch {
        existingLevel = undefined;
      }
    }

    if (typeof existingLevel === 'string' && isValidLevel(existingLevel)) {
      currentLevel = existingLevel;
    }

    if (descriptor.configurable) {
      Object.defineProperty(window, '__GTDSPACE_LOGGER__', {
        value: globalConfig,
        writable: false,
        configurable: true,
      });
    }
  } else {
    Object.defineProperty(window, '__GTDSPACE_LOGGER__', {
      value: globalConfig,
      writable: false,
      configurable: true,
    });
  }
}
