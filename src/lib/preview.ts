export const WATERMARK_TEXT = 'Nutinbutheat.com'

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => { URL.revokeObjectURL(url); resolve(el) }
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    el.src = url
  })
}

// Burns a top-left black "Nutinbutheat.com" mark into the image at natural size.
// JPEG output with a quality ladder to stay under maxBytes (default 10 MB worker limit).
export async function applyWatermark(file: File, maxBytes = 10 * 1024 * 1024): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const fontSize = Math.max(16, Math.round(canvas.width / 28))
  ctx.font = `700 ${fontSize}px Arial, sans-serif`
  ctx.textBaseline = 'top'
  const pad = Math.round(fontSize * 0.6)
  // Faint light shadow so black text stays legible on dark photos.
  ctx.shadowColor = 'rgba(255,255,255,0.65)'; ctx.shadowBlur = Math.max(2, Math.round(fontSize / 12))
  ctx.fillStyle = '#000'
  ctx.fillText(WATERMARK_TEXT, pad, pad)
  for (const q of [0.92, 0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q))
    if (blob && (blob.size <= maxBytes || q === 0.45)) return blob
  }
  throw new Error('Could not compress watermarked image')
}

export async function makePreviewBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read image'))
      el.src = url
    })
    const W = 1200, H = 630
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
    const dx = (W - dw) / 2, dy = (H - dh) / 2
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    ctx.drawImage(img, dx, dy, dw, dh)
    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q))
      if (blob && (blob.size <= 300 * 1024 || q === 0.45)) return blob
    }
    throw new Error('Could not compress preview')
  } finally {
    URL.revokeObjectURL(url)
  }
}
