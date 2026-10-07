import { useEffect } from 'react'
import Contatti from './components/Contatti'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import Orologi from './components/Orologi'
import Profumi from './components/Profumi'
import Storia from './components/Storia'
import { initSmooth } from './lib/smooth'

export default function App() {
  useEffect(() => initSmooth(), [])

  return (
    <>
      {/* Fixed header stays outside the smoothed layer. */}
      <Header />
      <div id="smooth-wrapper">
        <div id="smooth-content" className="pt-[var(--header-h)]">
          <main id="contenuto" tabIndex={-1} className="outline-none">
            <Hero />
            <Storia />
            <Orologi />
            <Profumi />
            <Contatti />
          </main>
          <Footer />
        </div>
      </div>
    </>
  )
}
