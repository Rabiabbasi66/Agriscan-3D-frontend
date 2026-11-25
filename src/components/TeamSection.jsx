import React, { useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'

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
  color: 'var(--neon-gold)',

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
  focus: 'Three.js · WebGL · 3D Farm Visualization',
  bio: 'Designs and develops the interactive 3D farm visualization system using Three.js and WebGL. Responsible for terrain rendering, realistic lighting, camera controls, field visualization, and performance optimization to deliver an immersive crop monitoring experience.',
  skills: [
    'Three.js',
    'WebGL',
    'GLSL Shaders',
    '3D Rendering',
    'Terrain Generation',
    'Lighting & Shadows',
    'Animation',
    'Performance Optimization'
  ],
  avatar: 'SJ',
  color: '#10b981',
  tasks: [
    '3D farm terrain',
    'Field visualization',
    'Camera controls',
    'Lighting & shadows',
    'WebGL rendering',
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

  color: '#f97316',

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

function TiltCard({ member, index }) {
  const cardRef = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 })
  const [glare, setGlare] = useState({ x: 50, y: 50 })

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY

    x.set(mouseX / (rect.width / 2))
    y.set(mouseY / (rect.height / 2))

    const glareX = ((e.clientX - rect.left) / rect.width) * 100
    const glareY = ((e.clientY - rect.top) / rect.height) * 100
    setGlare({ x: glareX, y: glareY })
  }, [x, y])

  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
    setGlare({ x: 50, y: 50 })
  }, [x, y])

  return (
    <motion.div
      ref={cardRef}
      className="agri-card p-6 flex flex-col gap-5 relative overflow-hidden group"
      style={{
        border: '1px solid var(--border)',
        transformStyle: 'preserve-3d',
        rotateX,
        rotateY,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = member.color + '44'
        e.currentTarget.style.boxShadow = `0 0 40px ${member.color}18, 0 0 80px ${member.color}08`
      }}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Glow effect behind card */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, ${member.color}15 0%, transparent 60%)`,
          transform: 'translateZ(-1px)',
        }}
      />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${member.color}, transparent)` }} />

      {/* Floating avatar container */}
      <motion.div
        className="flex items-start gap-4"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.5 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center relative"
          style={{
            border: `3px solid ${member.color}44`,
            background: 'var(--card)',
            transformStyle: 'preserve-3d',
          }}
          whileHover={{ scale: 1.1, rotateY: 360 }}
          transition={{ duration: 0.6 }}
        >
          <img
            src={member.img}
            alt={member.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={e => { e.target.style.display = 'none' }}
          />
          {/* Avatar glow ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `inset 0 0 20px ${member.color}30, 0 0 20px ${member.color}20`,
            }}
          />
        </motion.div>
        <div style={{ transform: 'translateZ(30px)' }}>
          <div className="font-display font-700 text-xl" style={{ color: 'var(--foreground)', letterSpacing: '0.04em' }}>
            {member.name}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: member.color, letterSpacing: '0.08em', marginTop: '4px' }}>
            {member.role}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
            {member.focus}
          </div>
        </div>
      </motion.div>

      {/* Bio with 3D depth */}
      <motion.p
        style={{ color: 'var(--card-foreground)', fontSize: '13px', lineHeight: '1.7', transform: 'translateZ(20px)' }}
        whileHover={{ scale: 1.01 }}
      >
        {member.bio}
      </motion.p>

      {/* Tech skills with floating animation */}
      <motion.div
        style={{ transform: 'translateZ(25px)' }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
      >
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Tech Stack
        </div>
        <div className="flex flex-wrap gap-2">
          {member.skills.map((s, i) => (
            <motion.span
              key={s}
              className="px-2.5 py-1 rounded-md"
              style={{
                fontFamily: 'monospace',
                fontSize: '10px',
                background: `${member.color}15`,
                border: `1px solid ${member.color}40`,
                color: member.color,
                letterSpacing: '0.04em',
              }}
              whileHover={{ scale: 1.1, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              {s}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Task list with 3D depth */}
      <motion.div
        style={{ transform: 'translateZ(15px)' }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 }}
      >
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Responsibilities
        </div>
        <div className="grid grid-cols-2 gap-2">
          {member.tasks.map((t, i) => (
            <motion.div
              key={t}
              className="flex items-center gap-2"
              whileHover={{ x: 4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: member.color }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--foreground)' }}>{t}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Bottom glow accent */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, transparent, ${member.color}, transparent)`,
          opacity: 0.6,
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

export default function TeamSection() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto" id="team">
      <motion.div
        className="mb-14"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className="w-8 h-px"
            style={{ background: 'var(--primary)' }}
            animate={{ width: [32, 48, 32] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>The Team</span>
        </div>
        <h2 className="font-display text-5xl font-700 tracking-wide" style={{ color: 'var(--foreground)' }}>
          Built by 3 specialists
        </h2>
        <p className="mt-3 max-w-xl" style={{ color: 'var(--muted-foreground)', fontSize: '15px', lineHeight: '1.7' }}>
          Frontend, 3D visualization, and AI backend — each role engineered to make AgriScan 3D production-ready from day one.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {TEAM.map((member, index) => (
          <TiltCard key={member.name} member={member} index={index} />
        ))}
      </div>
    </section>
  )
}