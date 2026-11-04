---
title: AgriScan 3D
emoji: 🌱
colorFrom: green
colorTo: blue
sdk: gradio
app_file: app.py
---

# AgriScan 3D — Crop Disease Classifier

Dedicated inference Space for the existing **AgriScan 3D** trained YOLOv8
classifier (PlantVillage, 38 crop/disease classes).

Upload a leaf image → the trained model (`models/best.pt`) classifies it on
ZeroGPU → you get the structured prediction (crop, disease, confidence,
healthy flag, class name/index) plus the real top-5 class probabilities.

This Space performs **AI inference only** — no database, no authentication,
no cloud storage. The full AgriScan 3D FastAPI backend (history, auth,
persistence) runs separately.
