export {
  createInitialTabState,
  DEFAULT_MAX_TABS,
  isSameOrDescendantPath,
  pathKey,
  pathsEqual,
  tabStateReducer,
  takeMostRecentlyClosedFile,
} from './state';
export type { RenameMode, TabStateAction } from './state';
export {
  TAB_STORAGE_KEY,
  clearPersistedTabs,
  getPersistedActiveTabFilePath,
  parsePersistedTabSnapshot,
  persistTabState,
  restoreTabStateFromStorage,
  serializeTabState,
} from './persistence';
export {
  emitReloadedTabContent,
  loadTabForOpen,
  readTabFile,
  saveTabFile,
  tabHasExternalConflict,
} from './lifecycle';
export { useTabManagerSubscriptions } from './subscriptions';
