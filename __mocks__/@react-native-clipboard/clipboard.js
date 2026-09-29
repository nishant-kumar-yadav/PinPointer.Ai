/**
 * Mock of @react-native-clipboard/clipboard
 */
const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn(async () => ''),
  getStrings: jest.fn(async () => []),
  setStrings: jest.fn(),
  hasString: jest.fn(async () => false),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
};

module.exports = { __esModule: true, default: Clipboard };
module.exports.Clipboard = Clipboard;
