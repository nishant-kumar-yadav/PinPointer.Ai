/**
 * Mock of @react-native-ml-kit/text-recognition
 * Default `recognize` resolves empty text; tests override per-case via
 * jest.mocked(...).mockResolvedValue / mockRejectedValue.
 */
const TextRecognitionScript = {
  LATIN: 'latin',
  DEVANAGARI: 'devanagari',
};

const recognize = jest.fn(async (_uri, _script) => ({ text: '' }));

module.exports = {
  default: { recognize },
  TextRecognitionScript,
  __esModule: true,
};
