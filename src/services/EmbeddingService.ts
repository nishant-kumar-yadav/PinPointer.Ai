/**
 * EmbeddingService.ts — MobileCLIP2-S0 ONNX inference bridge.
 *
 * Wraps the native MobileCLIPModule to provide:
 *   - encodeImage(path) → Float32Array (512-dim, ~40-65ms background)
 *   - encodeText(query) → Float32Array (512-dim, ~15-25ms at search time)
 *
 * Models are lazy-loaded on first call to avoid blocking app startup.
 */

import { NativeModules } from 'react-native';
import { AppLogger } from '../utils/AppLogger';

const { MobileCLIPModule } = NativeModules;

/** Generate a 512-dim image embedding (runs vision encoder, ~40-65ms) */
export const encodeImage = async (imagePath: string): Promise<Float32Array | null> => {
  try {
    if (!MobileCLIPModule) {
      AppLogger.warn('EmbeddingService', 'MobileCLIPModule not available');
      return null;
    }
    const rawArray: number[] = await MobileCLIPModule.encodeImage(imagePath);
    return new Float32Array(rawArray);
  } catch (e) {
    AppLogger.warn('EmbeddingService', 'Image encoding failed', e);
    return null;
  }
};

/** Generate a 512-dim text embedding for search queries (runs text encoder, ~15-25ms) */
export const encodeText = async (text: string): Promise<Float32Array | null> => {
  try {
    if (!MobileCLIPModule) {
      AppLogger.warn('EmbeddingService', 'MobileCLIPModule not available');
      return null;
    }
    const rawArray: number[] = await MobileCLIPModule.encodeText(text);
    return new Float32Array(rawArray);
  } catch (e) {
    AppLogger.warn('EmbeddingService', 'Text encoding failed', e);
    return null;
  }
};
