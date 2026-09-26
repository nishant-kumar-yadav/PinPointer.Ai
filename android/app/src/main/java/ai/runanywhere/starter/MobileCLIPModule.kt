package ai.runanywhere.starter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.facebook.react.bridge.*
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer
import java.nio.LongBuffer
import kotlin.math.sqrt

class MobileCLIPModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MobileCLIPModule"

    private var env: OrtEnvironment? = null
    private var visionSession: OrtSession? = null
    private var textSession: OrtSession? = null
    private var bpeTokenizer: BPETokenizer? = null

    private fun getEnv(): OrtEnvironment {
        if (env == null) {
            env = OrtEnvironment.getEnvironment()
        }
        return env!!
    }

    private fun getVisionSession(): OrtSession {
        if (visionSession == null) {
            val start = System.currentTimeMillis()
            val modelBytes = reactApplicationContext.assets.open("models/clip/vision_encoder.onnx").readBytes()
            visionSession = getEnv().createSession(modelBytes, OrtSession.SessionOptions())
            val time = System.currentTimeMillis() - start
            Log.i("MobileCLIP", "Vision encoder loaded in ${time}ms")
        }
        return visionSession!!
    }

    private fun getTextSession(): OrtSession {
        if (textSession == null) {
            val start = System.currentTimeMillis()
            val modelBytes = reactApplicationContext.assets.open("models/clip/text_encoder.onnx").readBytes()
            textSession = getEnv().createSession(modelBytes, OrtSession.SessionOptions())
            val time = System.currentTimeMillis() - start
            Log.i("MobileCLIP", "Text encoder loaded in ${time}ms")
        }
        return textSession!!
    }

    private fun getTokenizer(): BPETokenizer {
        if (bpeTokenizer == null) {
            bpeTokenizer = BPETokenizer(reactApplicationContext)
        }
        return bpeTokenizer!!
    }

    private fun l2Normalize(vector: FloatArray): FloatArray {
        var sumSq = 0f
        for (v in vector) {
            sumSq += v * v
        }
        val norm = sqrt(sumSq.toDouble()).toFloat()
        val normalized = FloatArray(vector.size)
        if (norm > 0) {
            for (i in vector.indices) {
                normalized[i] = vector[i] / norm
            }
        } else {
            for (i in vector.indices) {
                normalized[i] = vector[i]
            }
        }
        return normalized
    }

    @ReactMethod
    fun encodeImage(imagePath: String, promise: Promise) {
        try {
            var path = imagePath
            if (path.startsWith("file://")) {
                path = path.substring(7)
            }

            val bitmap = BitmapFactory.decodeFile(path)
            if (bitmap == null) {
                promise.reject("IMAGE_ERROR", "Failed to load image from path")
                return
            }

            val resized = Bitmap.createScaledBitmap(bitmap, 256, 256, true)
            
            val tensorData = FloatBuffer.allocate(3 * 256 * 256)
            // Normalization from preprocessor_config.json: mean=[0,0,0], std=[1,1,1]
            // This model expects pixel values in 0-1 range (no CLIP mean/std subtraction)
            val mean = floatArrayOf(0.0f, 0.0f, 0.0f)
            val std = floatArrayOf(1.0f, 1.0f, 1.0f)

            val pixels = IntArray(256 * 256)
            resized.getPixels(pixels, 0, 256, 0, 0, 256, 256)

            for (i in pixels.indices) {
                val p = pixels[i]
                val r = ((p shr 16) and 0xFF) / 255.0f
                val g = ((p shr 8) and 0xFF) / 255.0f
                val b = (p and 0xFF) / 255.0f

                tensorData.put(i, (r - mean[0]) / std[0]) // R
                tensorData.put(i + 256 * 256, (g - mean[1]) / std[1]) // G
                tensorData.put(i + 2 * 256 * 256, (b - mean[2]) / std[2]) // B
            }

            val shape = longArrayOf(1, 3, 256, 256)
            val tensor = OnnxTensor.createTensor(getEnv(), tensorData, shape)
            
            val session = getVisionSession()
            val inputName = session.inputNames.iterator().next()
            
            val result = session.run(mapOf(inputName to tensor))
            val outputTensor = result[0].value as Array<FloatArray>
            
            val vector = outputTensor[0]
            val normalized = l2Normalize(vector)
            
            val arr = Arguments.createArray()
            for (v in normalized) {
                arr.pushDouble(v.toDouble())
            }
            
            promise.resolve(arr)
            
            tensor.close()
            result.close()
            
        } catch (e: Exception) {
            Log.e("MobileCLIP", "Failed to encode image", e)
            promise.reject("ENCODE_ERROR", "Failed to encode image: ${e.message}", e)
        }
    }

    @ReactMethod
    fun encodeText(text: String, promise: Promise) {
        try {
            val tokens = getTokenizer().tokenize(text)
            
            val tensorData = LongBuffer.wrap(tokens)
            val shape = longArrayOf(1, 77)
            val tensor = OnnxTensor.createTensor(getEnv(), tensorData, shape)
            
            val session = getTextSession()
            val inputName = session.inputNames.iterator().next()
            
            val result = session.run(mapOf(inputName to tensor))
            val outputTensor = result[0].value as Array<FloatArray>
            
            val vector = outputTensor[0]
            val normalized = l2Normalize(vector)
            
            val arr = Arguments.createArray()
            for (v in normalized) {
                arr.pushDouble(v.toDouble())
            }
            
            promise.resolve(arr)
            
            tensor.close()
            result.close()
            
        } catch (e: Exception) {
            Log.e("MobileCLIP", "Failed to encode text", e)
            promise.reject("ENCODE_ERROR", "Failed to encode text: ${e.message}", e)
        }
    }
}
