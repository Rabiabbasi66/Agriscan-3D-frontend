import React from 'react'

// Real class list read from the deployed YOLOv8n-cls checkpoint
// (model.names, 38 PlantVillage classes). Keep in sync with the model —
// do not add crops the checkpoint does not know.
const CROPS = [
  { name: 'Tomato', diseases: ['Bacterial spot', 'Early blight', 'Late blight', 'Leaf mold', 'Septoria leaf spot', 'Spider mites', 'Target spot', 'Mosaic virus', 'Yellow leaf curl', 'Healthy'], accent: true },
  { name: 'Apple', diseases: ['Scab', 'Black rot', 'Cedar apple rust', 'Healthy'] },
  { name: 'Corn', diseases: ['Gray leaf spot', 'Common rust', 'Northern leaf blight', 'Healthy'] },
  { name: 'Potato', diseases: ['Early blight', 'Late blight', 'Healthy'] },
  { name: 'Grape', diseases: ['Black rot', 'Esca', 'Leaf blight', 'Healthy'] },
  { name: 'Pepper', diseases: ['Bacterial spot', 'Healthy'] },
  { name: 'Peach', diseases: ['Bacterial spot', 'Healthy'] },
  { name: 'Cherry', diseases: ['Powdery mildew', 'Healthy'] },
  { name: 'Strawberry', diseases: ['Leaf scorch', 'Healthy'] },
  { name: 'Squash', diseases: ['Powdery mildew'] },
  { name: 'Orange', diseases: ['Citrus greening (HLB)'] },
  { name: 'Blueberry', diseases: ['Healthy'] },
  { name: 'Raspberry', diseases: ['Healthy'] },
  { name: 'Soybean', diseases: ['Healthy'] },
]

const CropCard = ({ crop, index }) => (
  <div
    className="agri-card crop-card"
    style={{ animationDelay: `${index * 40}ms` }}
  >
    <div className="crop-card-head">
      <span className="crop-initial" aria-hidden="true">
        {crop.name[0]}
      </span>
      <div>
        <h3 className="crop-name">{crop.name}</h3>
        <span className="crop-count">
          {crop.diseases.length - 1 > 0
            ? `${crop.diseases.length - 1} disease${crop.diseases.length - 1 > 1 ? 's' : ''} + healthy`
            : 'healthy only'}
        </span>
      </div>
      {crop.accent && <span className="crop-badge">MOST CLASSES</span>}
    </div>
    <div className="crop-chips">
      {crop.diseases.map((d) => (
        <span
          key={d}
          className={`crop-chip ${d === 'Healthy' ? 'chip-healthy' : 'chip-disease'}`}
        >
          {d}
        </span>
      ))}
    </div>
  </div>
)

export default function SupportedCrops() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto" id="supported-crops">
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-px"
            style={{ background: 'var(--primary)' }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--primary)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Model Capabilities
          </span>
        </div>
        <h2
          className="font-display text-5xl font-700 tracking-wide"
          style={{ color: 'var(--foreground)' }}
        >
          Supported Crops &amp; Diseases
        </h2>
        <p
          className="mt-3 max-w-xl"
          style={{ color: 'var(--muted-foreground)', fontSize: '15px', lineHeight: '1.7' }}
        >
          Trained YOLOv8n classifier · 38 PlantVillage classes · disease
          names shown exactly as the model reports them.
        </p>
      </div>

      <div className="crop-grid">
        {CROPS.map((crop, i) => (
          <CropCard key={crop.name} crop={crop} index={i} />
        ))}
      </div>
    </section>
  )
}
