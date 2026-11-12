import Contatti from './components/Contatti'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import Officina from './components/Officina'
import Orologi from './components/Orologi'
import PercheZito from './components/PercheZito'
import Profumi from './components/Profumi'
import SectionButtons from './components/SectionButtons'
import Storia from './components/Storia'
import Territorio from './components/Territorio'
import Admin from './components/Admin'
import Cart from './components/Cart'
import OrderPage, { orderToken } from './components/OrderPage'
import { ShopProvider, STATIC_PREVIEW } from './lib/shop'
import { t, useLocale } from './lib/i18n'

export default function App() {
  useLocale()
  const isAdmin = location.pathname.replace(/\/$/, '') === '/admin' ||
    (STATIC_PREVIEW && new URLSearchParams(location.search).has('admin-preview'))
  const order = isAdmin ? null : orderToken()
  return (
    <ShopProvider>
      {isAdmin ? <Admin /> : <>
      {STATIC_PREVIEW && <aside className="container-site border-b border-line py-3 text-small">
        {t("Anteprima GitHub Pages: nessuna modifica pubblicata, accesso e pagamenti non disponibili.")}{' '}
        <a className="underline" href={`${import.meta.env.BASE_URL}?admin-preview`}>{t("Prova l’interfaccia amministratore")}</a>
      </aside>}
      <Header />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        {order ? <OrderPage token={order} /> : <>
        <Hero />
        {/* Order follows the numbered sections of the client's layout; Perché Zito closes before the contacts. */}
        <div className="container-site mt-10 flex flex-col md:mt-14">
          <SectionButtons />
          <Storia />
          <Orologi />
          <Profumi />
          <Officina />
          <Territorio />
          <PercheZito />
          <Contatti />
        </div>
        </>}
      </main>
      <Footer />
      <Cart />
      </>}
    </ShopProvider>
  )
}
