/**
 * Mock of @react-native-async-storage/async-storage
 * In-memory implementation so hook tests get realistic persistence.
 */
const store = new Map();

const AsyncStorage = {
  setItem: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  getItem: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  removeItem: jest.fn(async (key) => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => [...store.keys()]),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, store.has(k) ? store.get(k) : null])),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([k, v]) => store.set(k, v));
  }),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((k) => store.delete(k));
  }),
  // Test helper — wipe the in-memory store between tests
  __reset: () => store.clear(),
};

module.exports = { __esModule: true, default: AsyncStorage };
module.exports.AsyncStorage = AsyncStorage;
