import Home from './Home'
import SlugPage from './SlugPage'
import Albums from './Albums'
import AlbumDetail from './AlbumDetail'
import Trending from './Trending'
import About from './About'
import Privacy from './Privacy'
import Terms from './Terms'
import Contact from './Contact'
import Categories from './Categories'
import CategoryDetail from './CategoryDetail'
import AdminDashboard from './admin/AdminDashboard'
import { useRoute } from './lib/router'
import { trackPageView } from './lib/appwrite'
import { useEffect, useState, type ReactNode } from 'react'

// Full location key (pathname + search) so query-only navigations (?page=N)
// count as section visits. The route object alone ignores query strings.
function useLocationKey() {
  const [key, setKey] = useState(() => location.pathname + location.search)
  useEffect(() => {
    const sync = () => setKey(location.pathname + location.search)
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])
  return key
}

// Halloween overlay window: Oct 1 through end of Oct (checked in the visitor's
// local time so it flips on the right day regardless of server timezone).
function isHalloweenSeason() {
  const now = new Date()
  const m = now.getMonth()
  return m === 9 || (m === 10 && now.getDate() === 1)
}

function App() {
  const route = useRoute()
  const locKey = useLocationKey()
  useEffect(() => {
    if (route.name === 'admin') return
    trackPageView(locKey)
  }, [locKey, route])
  let page: ReactNode
  if (route.name === 'admin') return <AdminDashboard />
  else if (route.name === 'albums') page = <Albums />
  else if (route.name === 'album') page = <AlbumDetail slug={route.slug} />
  else if (route.name === 'trending') page = <Trending />
  else if (route.name === 'about') page = <About />
  else if (route.name === 'privacy') page = <Privacy />
  else if (route.name === 'terms') page = <Terms />
  else if (route.name === 'contact') page = <Contact />
  else if (route.name === 'categories') page = <Categories />
  else if (route.name === 'category') page = <CategoryDetail category={route.category} />
  else if (route.name === 'post') page = <SlugPage slug={route.slug} />
  else page = <Home />
  return (
    <>
      {isHalloweenSeason() && <img className="halloween-pumpkin" src="/halloween/pumpkin.png" alt="" aria-hidden="true" />}
      {page}
    </>
  )
}

export default App