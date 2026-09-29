/**
 * Mock of react-native-image-picker
 */
const launchImageLibrary = jest.fn(async (_options) => ({ assets: [] }));
const launchCamera = jest.fn(async (_options) => ({ assets: [] }));

module.exports = { launchImageLibrary, launchCamera };
