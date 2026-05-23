// Cliente: detecta aspect ratio de un File antes de subirlo.
// Devuelve null si no se puede determinar (formato no estándar, error de decodificación).

export interface AspectRatioInfo {
  width: number
  height: number
  ratio: number
  isPortrait916: boolean
  label: string
}

const TARGET_RATIO = 9 / 16
const TOLERANCE = 0.04

export async function detectAspectRatio(file: File): Promise<AspectRatioInfo | null> {
  if (file.type.startsWith('image/')) {
    return detectImage(file)
  }
  if (file.type.startsWith('video/')) {
    return detectVideo(file)
  }
  return null
}

function detectImage(file: File): Promise<AspectRatioInfo | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(buildInfo(img.naturalWidth, img.naturalHeight))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function detectVideo(file: File): Promise<AspectRatioInfo | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(buildInfo(video.videoWidth, video.videoHeight))
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

function buildInfo(width: number, height: number): AspectRatioInfo | null {
  if (!width || !height) return null
  const ratio = width / height
  const isPortrait916 = Math.abs(ratio - TARGET_RATIO) < TOLERANCE

  let label = `${width}×${height}`
  if (isPortrait916) label += ' (9:16 ✓)'
  else if (Math.abs(ratio - 1) < 0.04) label += ' (1:1 cuadrado)'
  else if (Math.abs(ratio - 4 / 5) < 0.04) label += ' (4:5 vertical)'
  else if (Math.abs(ratio - 16 / 9) < 0.04) label += ' (16:9 horizontal)'
  else label += ` (ratio ${ratio.toFixed(2)})`

  return { width, height, ratio, isPortrait916, label }
}
