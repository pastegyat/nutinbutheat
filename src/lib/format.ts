export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime(); const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`
  const w = Math.floor(d / 7); if (w < 5) return `${w} week${w > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

export function fmtNumber(value: number | null | undefined) { return (value ?? 0).toLocaleString('en-US') }