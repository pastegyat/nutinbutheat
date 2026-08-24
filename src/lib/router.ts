import { useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'admin' } | { name: 'albums' } | { name: 'album'; slug: string } | { name: 'trending' } | { name: 'about' } | { name: 'privacy' } | { name: 'terms' } | { name: 'contact' } | { name: 'categories' } | { name: 'category'; category: string } | { name: 'post'; slug: string }

export function parseRoute(): Route {
  const path = window.location.pathname
  if (path === '/') return { name: 'home' }
  if (path === '/nadmin') return { name: 'admin' }
  if (path === '/albums' || path === '/albums/') return { name: 'albums' }
  if (path === '/trending' || path === '/trending/') return { name: 'trending' }
  if (path === '/about' || path === '/about/') return { name: 'about' }
  if (path === '/privacy' || path === '/privacy/') return { name: 'privacy' }
  if (path === '/terms' || path === '/terms/') return { name: 'terms' }
  if (path === '/contact' || path === '/contact/') return { name: 'contact' }
  if (path === '/categories' || path === '/categories/') return { name: 'categories' }
  if (path.startsWith('/categories/')) { const c = decodeURIComponent(path.slice('/categories/'.length).replace(/^\/+|\/+$/g, '')); if (c) return { name: 'category', category: c } }
  if (path.startsWith('/a/')) { const s = path.slice(3).replace(/^\/+|\/+$/g, ''); if (s && !s.includes('/')) return { name: 'album', slug: s } }
  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '')
  return { name: 'post', slug }
}

export function navigate(path: string) {
  if (window.location.pathname === path) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new CustomEvent('nbh:navigate'))
}

export function linkTo(path: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(path)
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute)
  useEffect(() => {
    const sync = () => setRoute(parseRoute())
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])
  return route
}