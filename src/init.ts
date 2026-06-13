// Bulletproof check to verify and mock localStorage if access is restricted (e.g. Incognito or blocked cookies)
try {
  const testKey = '__amphy_storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn('LocalStorage is blocked or unavailable. Falling back to safe in-memory store.', e);
  const memoryStore: Record<string, string> = {};
  
  try {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string): string | null => {
          return key in memoryStore ? memoryStore[key] : null;
        },
        setItem: (key: string, value: string): void => {
          memoryStore[key] = String(value);
        },
        removeItem: (key: string): void => {
          delete memoryStore[key];
        },
        clear: (): void => {
          for (const key in memoryStore) {
            delete memoryStore[key];
          }
        },
        key: (index: number): string | null => {
          return Object.keys(memoryStore)[index] || null;
        },
        get length(): number {
          return Object.keys(memoryStore).length;
        }
      },
      writable: true,
      configurable: true
    });
  } catch (err) {
    console.error('Failed to redefine localStorage:', err);
  }
}
