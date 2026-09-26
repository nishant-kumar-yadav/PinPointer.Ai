#!/usr/bin/env python3
"""
export_mobileclip.py — Export MobileCLIP2-S0 to ONNX with INT8 quantization.

Run on a dev machine (not on Android). Requires:
  pip install mobileclip torch onnx onnxruntime

Usage:
  python scripts/export_mobileclip.py

Outputs:
  models/clip/vision_encoder.onnx
  models/clip/vision_encoder_int8.onnx
  models/clip/text_encoder.onnx
  models/clip/text_encoder_int8.onnx
"""

import os
import time
import torch
import numpy as np


def export():
    try:
        import mobileclip
    except ImportError:
        print("ERROR: Install mobileclip first: pip install mobileclip")
        return

    output_dir = os.path.join(os.path.dirname(__file__), '..', 'models', 'clip')
    os.makedirs(output_dir, exist_ok=True)

    print("[1/5] Loading MobileCLIP2-S0 checkpoint...")
    model, preprocess, tokenizer = mobileclip.create_model_and_transforms(
        'mobileclip2_s0', pretrained='checkpoints/mobileclip2_s0.pt'
    )

    print("[2/5] Reparameterizing model (CRITICAL — do not skip)...")
    # Merges multi-branch conv blocks into single efficient convolutions
    model = mobileclip.reparameterize_model(model)
    model.eval()

    # ── Export Vision Encoder ────────────────────────────────────────
    print("[3/5] Exporting vision encoder to ONNX...")
    dummy_image = torch.randn(1, 3, 256, 256)
    vision_path = os.path.join(output_dir, 'vision_encoder.onnx')

    with torch.no_grad():
        torch.onnx.export(
            model.visual,
            dummy_image,
            vision_path,
            input_names=['pixel_values'],
            output_names=['image_embeds'],
            dynamic_axes={'pixel_values': {0: 'batch'}},
            opset_version=17,
            do_constant_folding=True,
        )
    print(f"  Saved: {vision_path} ({os.path.getsize(vision_path) / 1e6:.1f} MB)")

    # ── Export Text Encoder ──────────────────────────────────────────
    print("[4/5] Exporting text encoder to ONNX...")
    dummy_tokens = torch.randint(0, 49408, (1, 77), dtype=torch.long)
    text_path = os.path.join(output_dir, 'text_encoder.onnx')

    with torch.no_grad():
        torch.onnx.export(
            model.text,
            dummy_tokens,
            text_path,
            input_names=['input_ids'],
            output_names=['text_embeds'],
            dynamic_axes={'input_ids': {0: 'batch'}},
            opset_version=17,
            do_constant_folding=True,
        )
    print(f"  Saved: {text_path} ({os.path.getsize(text_path) / 1e6:.1f} MB)")

    # ── INT8 Dynamic Quantization ────────────────────────────────────
    print("[5/5] Applying INT8 dynamic quantization...")
    from onnxruntime.quantization import quantize_dynamic, QuantType

    vision_int8 = os.path.join(output_dir, 'vision_encoder_int8.onnx')
    text_int8 = os.path.join(output_dir, 'text_encoder_int8.onnx')

    quantize_dynamic(vision_path, vision_int8, weight_type=QuantType.QInt8)
    print(f"  Vision INT8: {os.path.getsize(vision_int8) / 1e6:.1f} MB")

    quantize_dynamic(text_path, text_int8, weight_type=QuantType.QInt8)
    print(f"  Text INT8: {os.path.getsize(text_int8) / 1e6:.1f} MB")

    # ── Verify ───────────────────────────────────────────────────────
    print("\n✅ Export complete!")
    print(f"   Vision: {vision_int8}")
    print(f"   Text:   {text_int8}")
    print("\nNext steps:")
    print("  1. Upload INT8 models to Hugging Face")
    print("  2. Update URLs in download-models.js")
    print("  3. Run: node download-models.js")


if __name__ == '__main__':
    export()
