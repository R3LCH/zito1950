import Contatti from './components/Contatti'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import Orologi from './components/Orologi'
import Profumi from './components/Profumi'
import Storia from './components/Storia'

export default function App() {
  return (
    <>
      <Header />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <Hero />
        <Storia />
        <Orologi />
        <Profumi />
        <Contatti />
      </main>
      <Footer />
    </>
  )
}
