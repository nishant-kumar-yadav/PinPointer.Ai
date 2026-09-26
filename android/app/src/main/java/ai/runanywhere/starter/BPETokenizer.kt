package ai.runanywhere.starter

import android.content.Context
import java.io.BufferedReader
import java.io.InputStreamReader

class BPETokenizer(context: Context) {
    private val bpeRanks = mutableMapOf<Pair<String, String>, Int>()
    private val encoder = mutableMapOf<String, Int>()
    private val byteEncoder = getByteEncoder()
    private val cache = mutableMapOf<String, String>()

    init {
        // Init base tokens
        for (i in 0 until 256) {
            val charStr = byteEncoder[i]!!
            encoder[charStr] = i
        }

        val vocabStream = context.assets.open("models/clip/bpe_simple_vocab_16e6.txt")
        val reader = BufferedReader(InputStreamReader(vocabStream))
        var lineNum = 0
        reader.forEachLine { line ->
            if (lineNum >= 256) {
                val parts = line.split(" ")
                if (parts.size == 2) {
                    val p = Pair(parts[0], parts[1])
                    bpeRanks[p] = lineNum - 256
                    val merged = parts[0] + parts[1]
                    encoder[merged] = lineNum
                } else if (line.isNotEmpty()) {
                    encoder[line.trimEnd('\n', '\r')] = lineNum
                }
            }
            lineNum++
        }
        reader.close()
    }

    private fun getByteEncoder(): Map<Int, String> {
        val bs = mutableListOf<Int>()
        bs.addAll(33..126)
        bs.addAll(161..172)
        bs.addAll(174..255)

        val cs = bs.toMutableList()
        var n = 0
        for (b in 0 until 256) {
            if (!bs.contains(b)) {
                bs.add(b)
                cs.add(256 + n)
                n++
            }
        }
        val dict = mutableMapOf<Int, String>()
        for (i in bs.indices) {
            dict[bs[i]] = cs[i].toChar().toString()
        }
        return dict
    }

    private fun bpe(token: String): String {
        if (cache.containsKey(token)) {
            return cache[token]!!
        }

        val word = token.map { it.toString() }.toMutableList()
        if (word.isNotEmpty()) {
            word[word.size - 1] = word.last() + "</w>"
        }
        
        var currentWord = word
        while (true) {
            if (currentWord.size < 2) break
            var bestPair: Pair<String, String>? = null
            var bestRank = Int.MAX_VALUE

            for (i in 0 until currentWord.size - 1) {
                val p = Pair(currentWord[i], currentWord[i + 1])
                val rank = bpeRanks[p]
                if (rank != null && rank < bestRank) {
                    bestRank = rank
                    bestPair = p
                }
            }

            if (bestPair == null) break

            val newWord = mutableListOf<String>()
            var i = 0
            while (i < currentWord.size) {
                if (i < currentWord.size - 1 && currentWord[i] == bestPair.first && currentWord[i+1] == bestPair.second) {
                    newWord.add(bestPair.first + bestPair.second)
                    i += 2
                } else {
                    newWord.add(currentWord[i])
                    i++
                }
            }
            currentWord = newWord
        }

        val result = currentWord.joinToString(" ")
        cache[token] = result
        return result
    }

    fun tokenize(text: String): LongArray {
        val lowerText = text.lowercase()
        val pat = """<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+""".toRegex()
        val words = pat.findAll(lowerText).map { it.value }.toList()

        val bpeTokens = mutableListOf<String>()

        for (w in words) {
            val bytes = w.toByteArray(Charsets.UTF_8)
            val tokenStr = bytes.map { byteEncoder[it.toInt() and 0xFF]!! }.joinToString("")
            val bpeResult = bpe(tokenStr)
            bpeTokens.addAll(bpeResult.split(" "))
        }

        val resultIds = mutableListOf<Long>()
        resultIds.add(49406L)
        for (token in bpeTokens) {
            encoder[token]?.let {
                resultIds.add(it.toLong())
            }
        }
        resultIds.add(49407L)

        val padded = LongArray(77)
        for (i in 0 until 77) {
            if (i < resultIds.size) {
                padded[i] = resultIds[i]
            } else {
                padded[i] = 0L
            }
        }
        return padded
    }
}
