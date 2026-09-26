# PinPointer — Architecture Decision Record: Hybrid Semantic Search

**Date:** 2026-09-25
**Status:** APPROVED — Implementation Complete

---

## Decision Summary

| Decision | Choice | Rationale |
|:---|:---|:---|
| **Embedding Model** | MobileCLIP2-S0 (INT8 ONNX) | Best Pareto: ~43MB, ~50ms image / ~20ms text on Android CPU. Proven by Ente Photos in production. |
| **Vector Database** | sqlite-vec via op-sqlite | Compiles directly into op-sqlite via `sqliteVec: true`. Brute-force scan fast enough for <50k photos. |
| **Search Architecture** | Two-Tiered Hybrid (FTS5 primary + Vector secondary) | FTS5 exact text matches get 2× RRF weight. Solves "Tiger vs Cat" problem — searching "cat" finds screenshots with text "cat", not tiger photos. |
| **Vector Quantization** | INT8 (1 byte/dim, 512 bytes/photo) | Keeps 50k-photo galleries under 45ms scan. Float32 busts the 100ms budget at scale. |
| **OCR Engine** | Keep Google ML Kit (NOT PaddleOCR) | PaddleOCR has severe Devanagari failures (matra clipping, conjunct fracture, Hinglish garbling). ML Kit V2 Devanagari pack is far superior for Indian documents. |
| **Search UX** | Single merged list ranked by RRF score | FTS5 text matches naturally rank above semantic matches due to 2× weight multiplier. |
| **SQLite Driver** | op-sqlite (replaces react-native-quick-sqlite) | Drop-in JSI replacement. Only driver that natively bundles sqlite-vec. |

## Key Constraints

- **Search latency budget:** < 100ms (current FTS5: 5-25ms, hybrid target: 30-60ms)
- **APK size increase:** ~43MB (INT8 vision + text encoders + BPE vocab)
- **Privacy:** 100% on-device. No cloud APIs, no data leaves the phone.

## Risks Mitigated

1. ~~MobileCLIP ONNX export~~ → Reparameterization trap documented, export script created
2. ~~sqlite-vec at scale~~ → INT8 quantization keeps 50k vectors under 45ms
3. ~~PaddleOCR for Devanagari~~ → Decision reversed, keeping ML Kit
4. ~~Native module complexity~~ → Follows existing SherpaOnnx pattern exactly

## Production Reference

**Ente Photos** (ente-io/ente) ships this exact stack (MobileCLIP + ONNX Runtime + on-device vector search) to real Android/iOS users for their "Magic Search" feature. PinPointer adds FTS5 text layer on top.
