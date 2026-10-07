import Contatti from './components/Contatti'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import Orologi from './components/Orologi'
import Profumi from './components/Profumi'
import Storia from './components/Storia'
import Admin from './components/Admin'
import Cart from './components/Cart'
import { ShopProvider, STATIC_PREVIEW } from './lib/shop'

export default function App() {
  const isAdmin = location.pathname.replace(/\/$/, '') === '/admin' ||
    (STATIC_PREVIEW && new URLSearchParams(location.search).has('admin-preview'))
  return (
    <ShopProvider>
      {isAdmin ? <Admin /> : <>
      {STATIC_PREVIEW && <aside className="container-site border-b border-line py-3 text-small">
        Anteprima GitHub Pages: nessuna modifica pubblicata, accesso e pagamenti non disponibili.{' '}
        <a className="underline" href={`${import.meta.env.BASE_URL}?admin-preview`}>Prova l’interfaccia amministratore</a>
      </aside>}
      <Header />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <Hero />
        <Storia />
        <Orologi />
        <Profumi />
        <Contatti />
      </main>
      <Footer />
      <Cart />
      </>}
    </ShopProvider>
  )
}
