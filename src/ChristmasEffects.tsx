import { useEffect } from 'react'
import { useChristmasEnabled } from './lib/settings'

export function ChristmasHat() {
  const enabled = useChristmasEnabled()
  return enabled ? <img className="santa-hat" src="/santa-hat.png" alt="" aria-hidden="true" /> : null
}

export default function ChristmasEffects() {
  const enabled = useChristmasEnabled()
  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const container = document.createElement('div')
    container.id = 'snowfall'
    document.body.appendChild(container)
    const symbols = ['❄', '❅', '❆', '•']
    for (let i = 0; i < 40; i++) {
      const snow = document.createElement('span')
      snow.className = 'snowflake'
      snow.textContent = symbols[Math.floor(Math.random() * symbols.length)]
      const duration = 3 + Math.random() * 7
      snow.style.left = Math.random() * 100 + 'vw'
      snow.style.fontSize = 8 + Math.random() * 15 + 'px'
      snow.style.animationDuration = duration + 's'
      snow.style.animationDelay = -(Math.random() * Math.min(duration, 3)) + 's'
      container.appendChild(snow)
    }
    const timer = window.setTimeout(() => {
      container.classList.add('snowfall-settling')
      container.querySelectorAll<HTMLElement>('.snowflake').forEach((snow, index) => {
        const rect = snow.getBoundingClientRect()
        const opacity = getComputedStyle(snow).opacity
        snow.style.animation = 'none'
        snow.style.top = `${rect.top}px`
        snow.style.left = `${rect.left}px`
        snow.style.opacity = opacity
        snow.style.setProperty('--settle-x', `${(index % 2 ? 1 : -1) * (8 + Math.random() * 20)}px`)
        snow.style.setProperty('--settle-y', `${12 + Math.random() * 36}px`)
        snow.style.animation = 'snowfallSettle 2.5s ease-out forwards'
      })
      window.setTimeout(() => container.remove(), 2_600)
    }, 10_000)
    return () => { window.clearTimeout(timer); container.remove() }
  }, [enabled])

  return null
}
