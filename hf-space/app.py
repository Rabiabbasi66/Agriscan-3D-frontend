"""
AgriScan 3D — Hugging Face ZeroGPU inference adapter.

Dedicated inference Space for the existing AgriScan 3D trained YOLOv8
classifier (PlantVillage, 38 crop-disease classes).

Scope (intentionally minimal):
  image upload → PIL → existing DiseasePredictor inference → structured result
  (+ real top-5 class probabilities from the classifier output).

No MongoDB. No authentication. No S3. No FastAPI backend requirement.
The FastAPI backend (app/main.py, routers, database) remains untouched and
separate; its own prediction route keeps using the original module.
"""

from __future__ import annotations

import io
import json
import time
from contextlib import nullcontext

# `spaces` exists only on Hugging Face Spaces (ZeroGPU). Guarded so app.py also
# runs locally without ZeroGPU; the GPU decorator then behaves as a no-op.
try:
    import spaces  # noqa: F401  (import must precede torch/ultralytics on ZeroGPU)
    _HF_SPACES = True
except ImportError:
    spaces = None
    _HF_SPACES = False

import gradio as gr
import torch
from PIL import Image, UnidentifiedImageError

from disease_predictor import DiseasePredictor  # verbatim copy of backend module

# Single global model instance — loaded once at Space startup, reused for every
# request. ZeroGPU attaches/detaches the GPU inside the @spaces.GPU call, so the
# model object must NOT be moved to CUDA at import time.
predictor = DiseasePredictor()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def _gpu_decorator():
    """@spaces.GPU when running on Spaces; transparent no-op locally."""
    return spaces.GPU if _HF_SPACES else (lambda fn: fn)


@_gpu_decorator()  # actual YOLO inference executes here (no-op off Spaces)
def _yolo_infer(image_bytes: bytes):
    """Run the existing classifier (CPU here, ZeroGPU GPU on Spaces)."""
    predictor.model.to(DEVICE)  # ZeroGPU: inside GPU context; CPU no-op locally
    # Same input path as the backend DiseasePredictor.predict():
    # bytes → PIL Image → model(image). (Raw bytes are NOT an accepted
    # ultralytics source type — validated against ultralytics 8.3.56.)
    image = Image.open(io.BytesIO(image_bytes))
    results = predictor.model(image, verbose=False)
    probs = results[0].probs
    return int(probs.top1), float(probs.top1conf.item()), probs.data


def predict(image):
    """Gradio handler: image → structured prediction (existing result fields)."""
    if image is None:
        raise gr.Error("Please upload an image first.")

    # Existing pipeline input: raw image bytes (backend predict() does
    # Image.open(io.BytesIO(...)) internally).
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_bytes = buf.getvalue()

    start = time.perf_counter()
    try:
        top_idx, top_conf, probs_data = _yolo_infer(image_bytes)
    except UnidentifiedImageError as exc:
        # Invalid/corrupt/unsupported image → clear error, never fake data.
        raise gr.Error(f"Invalid image: cannot decode the uploaded file.") from exc
    except Exception as exc:  # model/inference failure surfaced, never masked
        raise gr.Error(f"Inference failed: {exc}") from exc
    inference_time_ms = round((time.perf_counter() - start) * 1000, 2)

    result = _build_result(top_idx, top_conf)
    top5 = _build_top5(probs_data)

    # Same envelope as the backend /api/v1/predict contract; the Space performs
    # no persistence by design (no MongoDB here).
    envelope = {
        "success": True,
        "data": result,
        "inference_time_ms": inference_time_ms,
        "saved_to_db": False,
        "prediction_id": None,
    }
    return envelope, json.dumps(envelope, indent=2), top5


def _build_result(top_idx: int, top_conf: float) -> dict:
    """Existing backend result fields, built from REAL classifier output only."""
    disease_name = predictor.class_names[top_idx]
    crop, disease = predictor._parse_disease_name(disease_name)
    return {
        "disease": disease,
        "crop": crop,
        "confidence": round(top_conf * 100, 2),
        "is_healthy": "healthy" in disease.lower(),
        "class_name": disease_name,
        "class_index": int(top_idx),
    }


def _build_top5(probs_data) -> list:
    """Top-5 from the model's actual probability tensor — never invented."""
    k = min(5, len(predictor.class_names))
    top = torch.topk(probs_data, k)
    return [
        {
            "class_name": predictor.class_names[i],
            "confidence": round(float(c) * 100, 2),
        }
        for c, i in zip(top.values.tolist(), top.indices.tolist())
    ]


def build_ui():
    with gr.Blocks(title="AgriScan 3D") as demo:
        gr.Markdown(
            "## 🌱 AgriScan 3D — Crop Disease Classifier\n"
            "Upload a leaf image to classify crop disease with the trained "
            "YOLOv8 model (38 PlantVillage classes)."
        )
        with gr.Row():
            image_in = gr.Image(type="pil", label="Leaf image")
            with gr.Column():
                result_json = gr.JSON(label="Prediction (structured result)")
                top5_tbl = gr.Dataframe(
                    headers=["class_name", "confidence"],
                    datatype=["str", "number"],
                    label="Top-5 classes (real classifier probabilities)",
                    interactive=False,
                )
        btn = gr.Button("Predict", variant="primary")
        raw = gr.Textbox(label="Raw JSON", lines=6, max_lines=12, interactive=False)

        btn.click(fn=predict, inputs=image_in, outputs=[result_json, raw, top5_tbl])
        image_in.upload(fn=predict, inputs=image_in, outputs=[result_json, raw, top5_tbl])
    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True)
