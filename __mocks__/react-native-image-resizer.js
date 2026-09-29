/**
 * Mock of react-native-image-resizer
 */
const createResizedImage = jest.fn(async (uri, _w, _h, _format, _quality) => ({
  uri: `${uri}`,
  path: `${uri}`,
  name: 'resized.jpg',
  size: 1024,
}));

module.exports = { __esModule: true, default: { createResizedImage } };
module.exports.createResizedImage = createResizedImage;
