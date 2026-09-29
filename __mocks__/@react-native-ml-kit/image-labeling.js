/**
 * Mock of @react-native-ml-kit/image-labeling
 */
const label = jest.fn(async (_uri) => []);

module.exports = {
  default: { label },
  __esModule: true,
};
