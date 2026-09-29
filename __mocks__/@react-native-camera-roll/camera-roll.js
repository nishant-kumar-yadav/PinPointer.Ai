/**
 * Mock of @react-native-camera-roll/camera-roll
 */
const getPhotos = jest.fn(async (_params) => ({
  edges: [],
  page_info: { has_next_page: false, end_cursor: undefined },
}));
const save = jest.fn(async (_path, _options) => '');

const CameraRoll = { getPhotos, save };

module.exports = { CameraRoll, default: { CameraRoll } };
