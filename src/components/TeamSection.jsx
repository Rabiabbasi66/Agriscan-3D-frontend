import React from 'react'

const TEAM = [
  {
  name: 'Talal Yousaf',
  role: 'Frontend Developer & AI Consumer',
  focus: 'React.js · API Integration · Responsive UI',

  bio: 'Builds the complete frontend application by integrating FastAPI APIs, authentication, AI prediction results, interactive dashboards, and responsive interfaces that allow farmers to upload drone images, monitor crop health, and visualize disease analysis in real time.',

  skills: [
    'React.js',
    'JavaScript',
    'HTML5',
    'CSS3',
    'Responsive Design',
    'REST APIs',
    'Axios',
    'JWT Authentication'
  ],

  avatar: 'TY',
  color: '#39ff14',

  tasks: [
    'React UI Development',
    'FastAPI API Integration',
    'Authentication',
    'Image Upload',
    'Dashboard',
    'Results Visualization',
    'Responsive Design',
    'AI API Consumer'
  ],

  img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&auto=format',
},
  {
  name: 'Seemab Jadoon',
  role: '3D Visualization Engineer',
  focus: 'Three.js · WebGPU · 3D Farm Visualization',
  bio: 'Designs and develops the interactive 3D farm visualization system using Three.js and WebGPU. Responsible for terrain rendering, realistic lighting, camera controls, field visualization, and performance optimization to deliver an immersive crop monitoring experience.',
  skills: [
    'Three.js',
    'WebGPU',
    'GLSL Shaders',
    '3D Rendering',
    'Terrain Generation',
    'Lighting & Shadows',
    'Animation',
    'Performance Optimization'
  ],
  avatar: 'SJ',
  color: '#a78bfa',
  tasks: [
    '3D farm terrain',
    'Field visualization',
    'Camera controls',
    'Lighting & shadows',
    'WebGPU rendering',
    '3D animations',
    'Performance optimization',
    'Interactive 3D environment'
  ],
  img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&auto=format',
},
 {
  name: 'Fazal -E- Rabbi Abbasi',

  role: 'Lead Backend & AI Engineer',

  focus: 'FastAPI · AI · Computer Vision · Cloud',

  bio: 'Lead developer of the AgriScan 3D backend and AI infrastructure. Responsible for designing scalable FastAPI REST APIs, implementing secure JWT authentication and role-based authorization, designing MongoDB Atlas databases, developing the AI processing pipeline, integrating computer vision for crop disease detection, performing NDVI vegetation analysis, training and deploying YOLOv8 models, generating automated PDF reports, integrating AWS S3 cloud storage, enabling drone image processing, supporting 3D crop visualization, and deploying the complete backend infrastructure for production.',

  skills: [
    'Python',
    'FastAPI',
    'MongoDB Atlas',
    'Database Design',
    'JWT Authentication',
    'REST APIs',
    'YOLOv8',
    'PyTorch',
    'OpenCV',
    'NumPy',
    'Computer Vision',
    'AWS S3',
    'Docker',
    'Celery',
    'Redis',
    'ReportLab',
    'Git',
    'GitHub',
    'Deployment',
    'Render',
    'Vercel',
    'AI Model Deployment'
  ],

  avatar: 'FR',

  color: '#fb923c',

  tasks: [
    'Backend Architecture',
    'FastAPI REST APIs',
    'JWT Authentication & Authorization',
    'MongoDB Atlas Database Design',
    'Database Integration',
    'Image & Video Upload Pipeline',
    'AWS S3 Cloud Storage',
    'YOLOv8 Model Training',
    'YOLOv8 Model Deployment',
    'Crop Disease Detection',
    'NDVI Vegetation Analysis',
    'Drone Image Processing',
    'AI Inference Pipeline',
    '3D Point Cloud Processing',
    'PDF Report Generation',
    'Performance Optimization',
    'API Documentation',
    'Backend Deployment',
    'Cloud Infrastructure',
    'System Integration'
  ],

  img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&auto=format',
}
]

export default function TeamSection() {
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="team">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: '#39ff14' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.12em', textTransform: 'uppercase' }}>The Team</span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: '#e8f5e8' }}>
          Built by 3 specialists
        </h2>
        <p className="mt-2 max-w-xl" style={{ color: '#6b9b6b', fontSize: '14px' }}>
          Frontend, 3D visualization, and AI backend — each role engineered to make AgriScan 3D production-ready from day one.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TEAM.map(member => (
          <div
            key={member.name}
            className="agri-card p-6 flex flex-col gap-5 relative overflow-hidden group transition-all duration-300"
            style={{ border: '1px solid #1c3a1c' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = member.color + '44'
              e.currentTarget.style.boxShadow = `0 0 30px ${member.color}12`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1c3a1c'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${member.color}, transparent)` }} />

            {/* Avatar + info */}
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                style={{ border: `2px solid ${member.color}44`, background: '#122012' }}
              >
                <img
                  src={member.img}
                  alt={member.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
              <div>
                <div className="font-display font-700 text-lg" style={{ color: '#e8f5e8', letterSpacing: '0.04em' }}>
                  {member.name}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: member.color, letterSpacing: '0.08em', marginTop: '2px' }}>
                  {member.role}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', marginTop: '3px' }}>
                  {member.focus}
                </div>
              </div>
            </div>

            {/* Bio */}
            <p style={{ color: '#a8d4a8', fontSize: '13px', lineHeight: '1.6' }}>
              {member.bio}
            </p>

            {/* Tech skills */}
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Tech Stack
              </div>
              <div className="flex flex-wrap gap-2">
                {member.skills.map(s => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-sm"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      background: `${member.color}15`,
                      border: `1px solid ${member.color}30`,
                      color: member.color,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Task list */}
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Responsibilities
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {member.tasks.map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ background: member.color }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#d4ecd4' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}