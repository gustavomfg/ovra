import { lazy, type ReactNode } from 'react'

const LiquidEther = lazy(() => import('@/components/LiquidEther'))
const Iridescence = lazy(() => import('@/components/Iridescence'))
const Ferrofluid = lazy(() => import('@/components/Ferrofluid'))
const MoltenMetal = lazy(() => import('@/components/MoltenMetal'))
const DarkVeil = lazy(() => import('@/components/DarkVeil'))
const Prism = lazy(() => import('@/components/Prism'))
const LightPillar = lazy(() => import('@/components/LightPillar'))
const Topography = lazy(() => import('@/components/Topography'))
const FaultyTerminal = lazy(() => import('@/components/FaultyTerminal'))
const PixelBlast = lazy(() => import('@/components/PixelBlast'))
const Balatro = lazy(() => import('@/components/Balatro'))
const Galaxy = lazy(() => import('@/components/Galaxy'))

export { LiquidEther }

export type Family = 'Fluido' | 'Luz' | 'Matéria' | 'Sinal' | 'Cosmos'

export interface Control {
  key: string
  label: string
  min: number
  max: number
  step: number
}

export type Values = Record<string, number>

export interface Specimen {
  id: string
  name: string
  latin: string
  family: Family
  note: string
  /** Dominant hue, used for placeholders and the chamber's ambient light. */
  tint: string
  /** Grid footprint in the catalogue. */
  span: 'wide' | 'tall' | 'base'
  controls: Control[]
  values: Values
  /** `live` is false for catalogue thumbnails: they skip intros and stay calm. */
  render: (values: Values, live: boolean) => ReactNode
}

export const FAMILIES: Family[] = ['Fluido', 'Luz', 'Matéria', 'Sinal', 'Cosmos']

export const SPECIMENS: Specimen[] = [
  {
    id: 'eter',
    name: 'Éter',
    latin: 'Aether fluens',
    family: 'Fluido',
    note: 'Simulação de fluido Navier–Stokes. A cor nasce da velocidade: quanto mais rápido, mais quente.',
    tint: '#ff5b1f',
    span: 'wide',
    controls: [
      { key: 'mouseForce', label: 'Força', min: 4, max: 60, step: 1 },
      { key: 'cursorSize', label: 'Raio', min: 30, max: 260, step: 1 },
      { key: 'autoIntensity', label: 'Deriva', min: 0.5, max: 5, step: 0.1 },
      { key: 'intensity', label: 'Brilho', min: 0.3, max: 2, step: 0.05 },
    ],
    values: { mouseForce: 22, cursorSize: 110, autoIntensity: 2.4, intensity: 1.1 },
    render: (v, live) => (
      <LiquidEther
        colors={['#2b1d6b', '#ff5b1f', '#f4efe6']}
        mouseForce={v.mouseForce}
        cursorSize={v.cursorSize}
        autoIntensity={v.autoIntensity}
        intensity={v.intensity}
        intro={live}
        resolution={live ? 0.5 : 0.35}
      />
    ),
  },
  {
    id: 'iris',
    name: 'Iridescência',
    latin: 'Iris mutabilis',
    family: 'Luz',
    note: 'Película fina sobre um líquido. Interferência de onda, dobras que mudam de matiz com o ângulo.',
    tint: '#9bb8ff',
    span: 'base',
    controls: [
      { key: 'speed', label: 'Tempo', min: 0, max: 3, step: 0.05 },
      { key: 'amplitude', label: 'Amplitude', min: 0, max: 0.6, step: 0.01 },
      { key: 'warp', label: 'Torção', min: 0, max: 3, step: 0.05 },
      { key: 'hueShift', label: 'Matiz', min: 0, max: 360, step: 1 },
    ],
    values: { speed: 0.6, amplitude: 0.14, warp: 1.2, hueShift: 0 },
    render: (v) => (
      <Iridescence
        color={[0.62, 0.55, 1]}
        speed={v.speed}
        amplitude={v.amplitude}
        warp={v.warp}
        hueShift={v.hueShift}
        sheen={0.6}
        grain={0.05}
        brightness={0.95}
        contrast={1.25}
        saturation={0.85}
      />
    ),
  },
  {
    id: 'ferro',
    name: 'Ferrofluido',
    latin: 'Ferrum liquidum',
    family: 'Matéria',
    note: 'Óleo carregado de ferro sob um campo magnético. O cursor é o ímã: aproxime-se e ele se ergue.',
    tint: '#c9ccd6',
    span: 'tall',
    controls: [
      { key: 'spikeHeight', label: 'Espinhos', min: 0, max: 2.5, step: 0.05 },
      { key: 'sharpness', label: 'Agudeza', min: 0.5, max: 6, step: 0.1 },
      { key: 'turbulence', label: 'Turbulência', min: 0, max: 3, step: 0.05 },
      { key: 'magnetism', label: 'Magnetismo', min: 0, max: 3, step: 0.05 },
    ],
    values: { spikeHeight: 1.1, sharpness: 2.8, turbulence: 1, magnetism: 1.4 },
    render: (v, live) => (
      <Ferrofluid
        colors={['#f4efe6', '#7d8597']}
        spikeHeight={v.spikeHeight}
        sharpness={v.sharpness}
        turbulence={v.turbulence}
        magnetism={v.magnetism}
        intro={live}
      />
    ),
  },
  {
    id: 'metal',
    name: 'Metal Fundido',
    latin: 'Metallum fusum',
    family: 'Matéria',
    note: 'Filamentos cáusticos com núcleo incandescente. Clique para provocar uma erupção.',
    tint: '#ff7a2f',
    span: 'tall',
    controls: [
      { key: 'glow', label: 'Calor', min: 0.2, max: 4, step: 0.05 },
      { key: 'thickness', label: 'Espessura', min: 0.2, max: 3, step: 0.05 },
      { key: 'swirl', label: 'Redemoinho', min: 0, max: 3, step: 0.05 },
      { key: 'turbulence', label: 'Turbulência', min: 0, max: 1.5, step: 0.01 },
    ],
    values: { glow: 1.8, thickness: 1, swirl: 1.1, turbulence: 0.25 },
    render: (v, live) => (
      <MoltenMetal
        colors={['#ff5b1f', '#ffb347', '#6a1b0a']}
        glow={v.glow}
        thickness={v.thickness}
        swirl={v.swirl}
        turbulence={v.turbulence}
        intro={live}
      />
    ),
  },
  {
    id: 'veu',
    name: 'Véu',
    latin: 'Velum obscurum',
    family: 'Luz',
    note: 'Um tecido de luz que respira no escuro e se curva ao redor de quem o observa.',
    tint: '#6b4bff',
    span: 'tall',
    controls: [
      { key: 'speed', label: 'Tempo', min: 0, max: 2, step: 0.05 },
      { key: 'warp', label: 'Torção', min: 0, max: 3, step: 0.05 },
      { key: 'flow', label: 'Fluxo', min: 0, max: 3, step: 0.05 },
      { key: 'sheen', label: 'Lustre', min: 0, max: 1.5, step: 0.05 },
    ],
    values: { speed: 0.45, warp: 0.6, flow: 1.2, sheen: 0.5 },
    render: (v, live) => (
      <DarkVeil color="#5b3bff" speed={v.speed} warp={v.warp} flow={v.flow} sheen={v.sheen} intro={live} />
    ),
  },
  {
    id: 'prisma',
    name: 'Prisma',
    latin: 'Prisma spectrale',
    family: 'Luz',
    note: 'Pirâmide de vidro que decompõe a luz branca. Passe o cursor para incliná-la.',
    tint: '#ff9ffc',
    span: 'base',
    controls: [
      { key: 'glow', label: 'Brilho', min: 0, max: 3, step: 0.05 },
      { key: 'noise', label: 'Ruído', min: 0, max: 1, step: 0.01 },
      { key: 'hueShift', label: 'Matiz', min: -3.14, max: 3.14, step: 0.01 },
      { key: 'colorFrequency', label: 'Frequência', min: 0.2, max: 4, step: 0.05 },
    ],
    values: { glow: 1, noise: 0.08, hueShift: 0, colorFrequency: 1 },
    render: (v, live) => (
      <Prism
        animationType="rotate"
        glow={v.glow}
        noise={v.noise}
        hueShift={v.hueShift}
        colorFrequency={v.colorFrequency}
        scale={3.4}
        intro={live}
      />
    ),
  },
  {
    id: 'terra',
    name: 'Topografia',
    latin: 'Terra lineata',
    family: 'Cosmos',
    note: 'Uma paisagem desenhada apenas em curvas de nível. Ela se eleva sob o cursor.',
    tint: '#e8e2d2',
    span: 'wide',
    controls: [
      { key: 'elevation', label: 'Elevação', min: 0, max: 3, step: 0.05 },
      { key: 'lineCount', label: 'Linhas', min: 6, max: 60, step: 1 },
      { key: 'morph', label: 'Metamorfose', min: 0, max: 1, step: 0.01 },
      { key: 'tilt', label: 'Inclinação', min: 0, max: 70, step: 1 },
    ],
    values: { elevation: 1.2, lineCount: 28, morph: 0.25, tilt: 34 },
    render: (v, live) => (
      <Topography
        color="#e8e2d2"
        elevation={v.elevation}
        lineCount={v.lineCount}
        morph={v.morph}
        tilt={v.tilt}
        markers={live ? 'plus' : 'none'}
        intro={live}
      />
    ),
  },
  {
    id: 'pilar',
    name: 'Pilar',
    latin: 'Columna lucis',
    family: 'Luz',
    note: 'Coluna volumétrica de luz torcida. Ray-marching em um cilindro de ruído.',
    tint: '#ff5b1f',
    span: 'base',
    controls: [
      { key: 'intensity', label: 'Intensidade', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'twist', label: 'Torção', min: -2, max: 2, step: 0.05 },
      { key: 'pillarWidth', label: 'Largura', min: 0.8, max: 6, step: 0.1 },
      { key: 'rotationSpeed', label: 'Rotação', min: 0, max: 1.5, step: 0.05 },
    ],
    values: { intensity: 1, twist: 0.5, pillarWidth: 3, rotationSpeed: 0.3 },
    render: (v, live) => (
      <LightPillar
        topColor="#ff5b1f"
        bottomColor="#5b3bff"
        intensity={v.intensity}
        twist={v.twist}
        pillarWidth={v.pillarWidth}
        rotationSpeed={v.rotationSpeed}
        quality={live ? 'high' : 'medium'}
        intro={live}
      />
    ),
  },
  {
    id: 'terminal',
    name: 'Terminal',
    latin: 'Signum corruptum',
    family: 'Sinal',
    note: 'Um CRT em falha, com fósforo persistente e glifos que se embaralham. Clique para desmagnetizar.',
    tint: '#b9ff66',
    span: 'base',
    controls: [
      { key: 'glitchAmount', label: 'Falha', min: 0, max: 3, step: 0.05 },
      { key: 'flickerAmount', label: 'Cintilação', min: 0, max: 3, step: 0.05 },
      { key: 'curvature', label: 'Curvatura', min: 0, max: 0.6, step: 0.01 },
      { key: 'scale', label: 'Escala', min: 0.5, max: 3, step: 0.05 },
    ],
    values: { glitchAmount: 1, flickerAmount: 1, curvature: 0.18, scale: 1.4 },
    render: (v, live) => (
      <FaultyTerminal
        tint="#b9ff66"
        glyphs="characters"
        clickEffect="degauss"
        glitchAmount={v.glitchAmount}
        flickerAmount={v.flickerAmount}
        curvature={v.curvature}
        scale={v.scale}
        chromaticAberration={1.5}
        pageLoadAnimation={live}
        brightness={0.9}
      />
    ),
  },
  {
    id: 'pixel',
    name: 'Poeira',
    latin: 'Pulvis pixelis',
    family: 'Sinal',
    note: 'Nuvens de pixels pontilhados com dithering de Bayer. O toque gera ondas de choque.',
    tint: '#9bb8ff',
    span: 'base',
    controls: [
      { key: 'pixelSize', label: 'Pixel', min: 1, max: 12, step: 0.5 },
      { key: 'patternDensity', label: 'Densidade', min: 0.2, max: 2, step: 0.05 },
      { key: 'speed', label: 'Tempo', min: 0, max: 2, step: 0.05 },
      { key: 'glow', label: 'Brilho', min: 0, max: 1.5, step: 0.05 },
    ],
    values: { pixelSize: 4, patternDensity: 1.3, speed: 0.6, glow: 0.9 },
    render: (v, live) => (
      <PixelBlast
        variant="circle"
        color="#c4d4ff"
        accentColor="#ff5b1f"
        pixelSize={v.pixelSize}
        patternDensity={v.patternDensity}
        speed={v.speed}
        glow={v.glow}
        intro={live}
      />
    ),
  },
  {
    id: 'vortice',
    name: 'Vórtice',
    latin: 'Vortex ludens',
    family: 'Fluido',
    note: 'Tinta girando em pixels nítidos, como num jogo de cartas esquecido. Clique para agitar.',
    tint: '#ff4d4d',
    span: 'base',
    controls: [
      { key: 'swirl', label: 'Redemoinho', min: 0, max: 1, step: 0.01 },
      { key: 'contrast', label: 'Contraste', min: 1, max: 6, step: 0.05 },
      { key: 'pixelSize', label: 'Pixel', min: 0.5, max: 8, step: 0.25 },
      { key: 'speed', label: 'Tempo', min: 0, max: 3, step: 0.05 },
    ],
    values: { swirl: 0.3, contrast: 3.2, pixelSize: 2, speed: 0.8 },
    render: (v, live) => (
      <Balatro
        color1="#ff5b1f"
        color2="#2b1d6b"
        color3="#0b0b10"
        swirl={v.swirl}
        contrast={v.contrast}
        pixelSize={v.pixelSize}
        speed={v.speed}
        intro={live}
      />
    ),
  },
  {
    id: 'galaxia',
    name: 'Galáxia',
    latin: 'Via lactea',
    family: 'Cosmos',
    note: 'Voo contínuo por um campo estelar em camadas. Clique para um salto de dobra.',
    tint: '#f4efe6',
    span: 'wide',
    controls: [
      { key: 'density', label: 'Densidade', min: 0.2, max: 3, step: 0.05 },
      { key: 'starSpeed', label: 'Velocidade', min: 0, max: 3, step: 0.05 },
      { key: 'glowIntensity', label: 'Brilho', min: 0, max: 1.5, step: 0.05 },
      { key: 'hueShift', label: 'Matiz', min: 0, max: 360, step: 1 },
    ],
    values: { density: 1.2, starSpeed: 0.5, glowIntensity: 0.4, hueShift: 220 },
    render: (v, live) => (
      <Galaxy
        density={v.density}
        starSpeed={v.starSpeed}
        glowIntensity={v.glowIntensity}
        hueShift={v.hueShift}
        saturation={0.35}
        twinkleIntensity={0.4}
        intro={live}
      />
    ),
  },
]
