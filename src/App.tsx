import Home from './Home'
import PostDetail from './PostDetail'
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
import { useEffect } from 'react'

function App() {
  const route = useRoute()
  useEffect(() => {
    if (route.name === 'admin') return
    trackPageView(location.pathname + location.search)
  }, [route])
  if (route.name === 'admin') return <AdminDashboard />
  if (route.name === 'albums') return <Albums />
  if (route.name === 'album') return <AlbumDetail slug={route.slug} />
  if (route.name === 'trending') return <Trending />
  if (route.name === 'about') return <About />
  if (route.name === 'privacy') return <Privacy />
  if (route.name === 'terms') return <Terms />
  if (route.name === 'contact') return <Contact />
  if (route.name === 'categories') return <Categories />
  if (route.name === 'category') return <CategoryDetail category={route.category} />
  if (route.name === 'post') return <PostDetail slug={route.slug} />
  return <Home />
}

export default App