import type { Contatti, Img, Model, Orologi, Profumo, Site, Storia } from './types'

export const site: Site = {
  name: 'ZITO 1950',
  tagline: 'Casa fondata nel 1950 dal Cav. Luigi Antonio Zito',
  description:
    'Zito1950 è una lunga storia che inizia più di mezzo secolo fa, a Scalea, sulla Riviera dei Cedri.',
  nav: [
    { href: '#storia', label: 'Storia' },
    { href: '#orologi', label: 'Orologi' },
    { href: '#profumi', label: 'Profumi' },
    { href: '#contatti', label: 'Contatti' },
  ],
  cta: {
    collection: 'Scopri la collezione',
    info: 'Richiedi informazioni',
    whereToFind: 'Dove trovarci',
    visit: 'Chiamaci o scrivici',
    story: 'La nostra storia',
  },
  hero: {
    image: {
      src: 'img/hero/new_hero.jpg',
      alt: 'La boutique OROincenso&mirra ZITO 1950, facciata e ingresso in bianco e nero',
    },
  },
  labels: {
    code: 'Codice',
    codes: 'Codici',
    price: 'Prezzo',
    specs: 'Caratteristiche',
    backToTop: 'Torna su',
    menu: 'Menu',
    close: 'Chiudi',
    skipToContent: 'Vai al contenuto',
    mainNav: 'Navigazione principale',
    footerNav: 'Navigazione nel piè di pagina',
    home: 'ZITO 1950, torna all’inizio',
  },
  footer: { copyright: '© Granalida s.r.l. – P. IVA 03012360784' },
}

/** Photo set `img/models/{id}.jpg`, `{id}-2.jpg`, … (count = number of files on disk). */
const img = (id: string, alt: string, count = 3): Img[] =>
  Array.from({ length: count }, (_, i) => ({
    src: `img/models/${id}${i ? `-${i + 1}` : ''}.jpg`,
    alt: i ? `${alt} – dettaglio ${i}` : alt,
  }))

export const models: Model[] = [
  {
    id: 'tutus-ab-uno',
    codes: ['ZP18K16'],
    name: 'Tutus ab uno',
    price: '3.890 EUR',
    specs: [
      'Movimento carica manuale ETA 7001',
      'Peso cassa 22 g oro rosa 18 Kt ø 40 mm',
      'Edizione limitata 30 pz.',
      'Cinturino in coccodrillo',
      'Fondello smaltato rigorosamente dai nostri orafi a mano',
      'Secondi a ore 6',
    ],
    images: img('tutus-ab-uno', 'Orologio Tutus ab uno in oro rosa con quadrante crema e cinturino in coccodrillo nero'),
  },
  {
    id: 'takimo',
    codes: ['ZPTAK15'],
    name: 'Takimo 65°',
    price: '2.390 EUR',
    quote: { text: 'Destinato a chi della passione ne fa uno stile di vita', author: 'L.A.Z.' },
    description:
      "In occasione del sessantacinquesimo anno, ZITO1950 ha creato in edizione limitata sessantacinque esemplari che riprendono un tachimetro tra i più belli degli anni '30.",
    specs: [
      'Peseux Eta 7001 carica manuale.',
      'Misura 10 linee e mezzo (23,3 mm) per 2,5 di spessore.',
      'Lavora a 21.600 a/h, 17 rubini, antiurto Incabloc ed una riserva di carica di 42 ore.',
      'Edizione limitata 65 pz.',
      'Cassa in acciaio 40mm spessore 7 mm.',
      'Vetro minerale antigraffio cinturino in pelle.',
    ],
    images: img('takimo', 'Orologio Takimo in acciaio con quadrante bianco tachimetrico e cinturino in pelle'),
  },
  {
    id: 'n2',
    codes: ['ZP0213'],
    name: 'N°2',
    price: '750 EUR',
    quote: { text: 'La felicità dipende da noi', author: 'Aristotele' },
    specs: [
      'Movimento Chronografo carica manuale',
      'Frequenza 21600 A/O 33 rubini',
      'Diametro di movimento 31,30 mm',
      'Spessore movimento 7,70',
      'Cassa in acciaio 41 mm',
      'Numeri arabi',
      'Luminor al buio',
      'Quadrante bianco',
      'Vetro zaffiro convesso',
      'Fondello zaffiro',
    ],
    images: img('n2', 'Cronografo N°2 in acciaio con quadrante bianco e lunetta tachimetrica blu'),
  },
  {
    id: 'n3',
    codes: ['ZP0313'],
    name: 'N°3',
    price: '750 EUR',
    quote: { text: 'Chi non crede nella magia è destinato a non incontrarla mai', author: 'Roald Dahl' },
    specs: [
      'Movimento Chronografo carica manuale',
      'Frequenza 21600 A/O 33 rubini',
      'Diametro di movimento 31,30 mm',
      'Spessore movimento 7,70',
      'Cassa in acciaio 41 mm',
      'Numeri arabi',
      'Luminor al buio',
      'Quadrante nero',
      'Vetro zaffiro convesso',
      'Fondello zaffiro',
    ],
    images: img('n3', 'Cronografo N°3 in acciaio con quadrante nero e cinturino traforato'),
  },
  ...(['n5', 'n6'] as const).map((id): Model => ({
    id,
    codes: [id === 'n5' ? 'ZP0513' : 'ZP0613'],
    name: id === 'n5' ? 'N°5' : 'N°6',
    price: '550 EUR',
    quote:
      id === 'n5'
        ? { text: "Divenire uomo è un'arte", author: 'Novalis' }
        : { text: 'Ogni felicità è un capolavoro', author: 'M. Yourcenar' },
    specs: [
      'Eta 2824. Ore, minuti, secondi, data a rimessa rapida, 25 rubini, diametro 25,60 mm (11 linee e 1/2), spessore 4,60 mm 28.800 a/h (4hz) angolo d\'oscillazione 50°, regolazione ETACHRON con vite micrometrica, riserva di carica 38h.',
      'Antiurto Incabloc.',
      'Quindi robusto e affidabile.',
      'Cassa in acciaio 40mm vetro zaffiro convesso cinturino in coccodrillo.',
    ],
    images: img(
      id,
      id === 'n5'
        ? 'Orologio automatico N°5 in acciaio con quadrante nero e cinturino in coccodrillo nero'
        : 'Orologio automatico N°6 in acciaio con quadrante bianco e cinturino in coccodrillo marrone',
    ),
  })),
  {
    id: 'n7',
    codes: ['ZP0713'],
    name: 'N°7',
    price: '630 EUR',
    quote: { text: 'A chi serve passare dei giorni se non si ricordano?', author: 'Cesare Pavese' },
    specs: [
      'Movimento meccanico a carica automatica eta 2824',
      'Frequenza 21600 A/O 33 rubini',
      'Cassa 38 mm e bracciale in acciaio',
      'Quadrante in smalto blu o bianco',
      'Indici a bacchetta',
      'Datario al 3',
      'Giorno al 12',
      'Corona a vite',
      'Vetro zaffiro convesso',
      'Fondello a vite',
      'Impermeabile 10 atm',
    ],
    images: [],
    variants: [
      {
        id: 'n7-blu',
        label: 'Blu',
        swatch: ['#2b3f73'],
        codes: ['ZP0713'],
        price: '630 EUR',
        images: [
          { src: 'img/models/n7-2.jpg', alt: 'Orologio N°7 con quadrante in smalto blu e bracciale in acciaio' },
          { src: 'img/models/n7.jpg', alt: 'Orologi N°7 con quadrante bianco e blu, bracciale in acciaio' },
        ],
      },
      {
        id: 'n7-bianco',
        label: 'Bianco',
        swatch: ['#f4f2ec'],
        codes: ['ZP0713'],
        price: '630 EUR',
        images: [
          { src: 'img/models/n7-3.jpg', alt: 'Orologio N°7 con quadrante in smalto bianco, giorno e data, bracciale in acciaio' },
          { src: 'img/models/n7.jpg', alt: 'Orologi N°7 con quadrante bianco e blu, bracciale in acciaio' },
        ],
      },
    ],
  },
  {
    id: 'n9',
    codes: ['ZP0913'],
    name: 'N°9',
    price: '780 EUR',
    quote: { text: 'I diamanti sono i migliori amici di una donna', author: 'Marilyn Monroe' },
    specs: [
      'Movimento meccanico a carica automatica eta 2671',
      'Frequenza 21600 A/O 33 rubini',
      'Cassa 30 mm e bracciale in acciaio',
      'Quadrante in madreperla',
      'Indici a castone con 11 diamanti',
      'H color VS 0,10ct',
      'Datario al 3',
      'Corona a vite',
      'Vetro zaffiro',
      'Fondello zaffiro a vite',
      'Impermeabile 5 atm',
    ],
    images: img('n9', 'Orologio da donna N°9 con quadrante in madreperla e indici con diamanti'),
  },
  {
    id: 'n12-tourbillon',
    codes: ['ZPTO13'],
    name: 'N°12 Tourbillon',
    price: '3.300 EUR',
    quote: { text: 'Possibilità e miracoli hanno lo stesso significato', author: 'Prentice Nulford' },
    description:
      'In un articolo Jean Baptiste Le Rond d\'Alembert, riprendeva l\'ideale cartesiano per il quale la rotazione dei pianeti attorno al Sole era dovuta alla presenza di un Tourbillon che li sostenesse, allargando la stessa all\'intero universo che era concepito come un\'espansione del sistema solare.',
    specs: [
      'Movimento meccanico a carica manuale Tourbillon che consiste nell\'inserire il meccanismo regolatore dell\'orologio (ovvero il "treno" bilanciere - ancora - scappamento) in una gabbia che ruota lentamente su sé stessa, generalmente una volta al minuto.',
      'Diamantino al puntatore secondi Tourbillon',
      'Vetro zaffiro',
      'Solo tre esemplari',
      'Cassa in acciaio 45mm',
    ],
    images: img('n12-tourbillon', 'Orologio N°12 Tourbillon in acciaio con quadrante bianco e tourbillon a vista'),
  },
  {
    id: '900-donna',
    codes: ['ZP9016L'],
    name: "'900 Donna",
    price: '420 EUR',
    quote: { text: 'Nel futuro ognuno sarà famoso per quindici minuti', author: 'Andy Warhol' },
    specs: [
      'Movimento al quarzo svizzero ETA 902.002',
      'Cassa in acciaio carré cambré laminata in oro',
      'Numeri e lancette laminati in oro',
      'Fondello con viti',
      'Cinturino coccodrillo marrone',
    ],
    images: img('900-donna', "Orologio '900 Donna con cassa carré laminata in oro e cinturino in coccodrillo marrone"),
  },
  {
    id: '900-uomo',
    codes: ['ZP9016'],
    name: "'900 Uomo",
    price: '600 EUR',
    quote: { text: 'Nel futuro ognuno sarà famoso per quindici minuti', author: 'Andy Warhol' },
    specs: [
      'Movimento ETA 277.001',
      'Carica manuale',
      'Cassa in acciaio carré cambré 38 mm',
      'Vetro minerale',
      'Fondello con viti',
      'Cinturino coccodrillo',
      'Numeri e sfere cobalto',
    ],
    images: img('900-uomo', "Orologio '900 Uomo in acciaio con quadrante bianco, numeri blu cobalto e cinturino in coccodrillo nero"),
  },
  {
    id: 'n20',
    codes: ['ZP2013S'],
    name: 'N°20',
    price: '900 EUR',
    quote: {
      text: "Nel blu profondo le emozioni galleggiano... Sei fuori dal tempo e dallo spazio, ma puoi accarezzare l'idea della perfezione",
      author: 'Homar Leuci per il N° 20',
    },
    specs: [
      'Movimento meccanico a carica automatica',
      'Con Data ETA Swiss Made 2824',
      'Cassa in acciaio 42 mm',
      'Vetro Zaffiro',
      '200 mt',
      'Ghiera unidirezionale',
      'Corona a vite',
      'Fondo a vite',
      'Datario ore tre',
      'Cinturino in acciaio',
      'Pacchetto prolunga sub',
    ],
    images: img('n20', 'Orologio subacqueo N°20 in acciaio con quadrante nero e bracciale in acciaio'),
  },
  {
    id: 'shockproof-1970',
    codes: ['ZPSP16', 'ZPSP16B', 'ZPSP16P'],
    name: 'Shockproof 1970',
    price: '325 EUR',
    quote: { text: 'Il tempo che ti piace buttare non è buttato', author: 'John Lennon' },
    specs: [],
    images: [],
    variants: (
      [
        ['shockproof-16', 'Acciaio, caucciù', ['#c9c9c6', '#141414'], 'ZPSP16', '325 EUR', 'Cassa in acciaio spazzolato', 'Cinturino acciaio e caucciù', 'cassa in acciaio spazzolato e cinturino in caucciù nero'],
        ['shockproof-16b', 'Acciaio, maglia', ['#c9c9c6'], 'ZPSP16B', '385 EUR', 'Cassa in acciaio spazzolato', 'Cinturino acciaio maglia rolò', 'cassa in acciaio spazzolato e bracciale a maglia'],
        ['shockproof-16p', 'PVD nero', ['#141414'], 'ZPSP16P', '325 EUR', 'Cassa in acciaio PVD nero', 'Cinturino caucciù', 'cassa in acciaio PVD nero e cinturino in caucciù'],
      ] as const
    ).map(([id, label, swatch, code, price, cassa, cinturino, alt]) => ({
      id,
      label,
      swatch: [...swatch],
      codes: [code],
      price,
      specs: [
        cassa,
        'Corona a vite',
        '200 mt',
        'Movimento Miyota 2305',
        'Indici e sfere luminescenti',
        'Vetro minerale',
        'Fondello a vite',
        cinturino,
        'Chiusura déployante',
        'Diametro cassa 45 mm',
        'Spessore cassa 13,5 mm',
      ],
      images: img(id, `Orologio Shockproof 1970 ${code} con ${alt}`, id === 'shockproof-16' ? 2 : 3),
    })),
  },
  {
    id: 'italy',
    codes: ['ZPIT15'],
    name: 'Italy',
    price: '1.450 EUR',
    quote: { text: "L'Italia è fatta, tutto è a posto", author: 'Camillo Benso Conte di Cavour' },
    specs: [
      'Cassa in acciaio 46 mm',
      'Vetro minerale',
      'Blocco ghiera ore nove',
      'Chrono automatico Valjoux 7750',
      'Limited Edition',
      '3 cinturini: cuoio passante, coccodrillo, caucciù',
    ],
    images: img('italy', 'Cronografo Italy in acciaio con quadrante nero e cinturino nero'),
  },
  {
    id: 'cafe-racer',
    codes: ['ZPCR14'],
    name: 'Cafè Racer',
    price: '550 EUR',
    quote: { text: 'LA tua passione al polso', author: 'L.A. Zito' },
    specs: [
      'Movimento cronografo al quarzo',
      "Quadrante tachimetro moto anni '50",
      'Cinturino pelle traforato cucito a mano',
      'Fondello acciaio inox con incisione seriale',
      'Solo 50 esemplari',
      'Cassa in acciaio invecchiata a mano con accurata lavorazione',
    ],
    images: img('cafe-racer', 'Cronografo Cafè Racer con cassa invecchiata, quadrante blu tachimetro e cinturino in pelle traforata'),
  },
  {
    id: 'gentleman',
    codes: ['ZPGM16'],
    name: 'Gentleman',
    price: '285 EUR',
    quote: { text: 'Gentiluomo una volta gentiluomo per sempre', author: 'Charles Dickens' },
    specs: [
      'Cassa in acciaio satinato',
      '50 mt impermeabile',
      'Movimento Miyota 2039',
      'Vetro minerale curveé',
      'Cinturino in cuoio, invecchiato con processo a mano, con stampe a fuoco e a freddo',
      'Fondello a pressione',
      'Diametro cassa 41 mm',
      'Spessore cassa 15 mm',
    ],
    images: img('gentleman', 'Orologio Gentleman in acciaio satinato con quadrante nero e cinturino in cuoio invecchiato'),
  },
  {
    id: '40000um',
    codes: ['ZP4015'],
    name: '40.000 µm',
    price: '470 EUR',
    quote: { text: 'Se potessi avere mille lire al mese', author: 'Gilberto Mazzi' },
    specs: [
      'Movimento meccanico carica automatica',
      'Frequenza 21600 A/O 21 rubini',
      'Diametro movimento 28 mm',
      'Spessore movimento 3,75 mm',
      'Vetro zaffiro convesso',
      'Cassa in acciaio 40 mm',
      'Fondello zaffiro con impressa la famosa 10 lire',
      'Quadrante argenté o nero',
      'Cinturino nato e pelle',
    ],
    images: img('40000um', 'Orologio 40.000 µm in acciaio con quadrante argenté e fondello con la moneta da 10 lire'),
  },
  {
    id: 'casuale',
    codes: ['ZPCA13'],
    name: 'Casuale',
    price: '190 EUR',
    quote: { text: "Con l'immobilità, l'acqua torbida ritorna limpida", author: 'Lao Tzu' },
    specs: ['Movimento al quarzo', 'Cassa in acciaio 40 mm', 'Datario in posizione ore 6'],
    images: img('casuale', 'Orologi Casuale in acciaio con quadrante bianco e nero e cinturino nero'),
  },
  {
    id: 'high-flight',
    codes: ['ZPHF16', 'ZPHF16B'],
    name: 'High Flight',
    price: '220 EUR',
    specs: [],
    images: [],
    variants: [
      {
        id: 'high-flight-16',
        label: 'Acciaio, cordura',
        swatch: ['#c9c9c6', '#141414'],
        codes: ['ZPHF16'],
        price: '220 EUR',
        specs: [
          'Cassa in acciaio 40mm',
          'Spessore 13mm',
          'Vetro in esalite',
          'Movimenti al quarzo Myota 2115',
          'Cinturino in cordura',
        ],
        images: img('high-flight-16', 'Orologio High Flight in acciaio con quadrante bianco e cinturino in cordura nero'),
      },
      {
        id: 'high-flight-16b',
        label: 'Oro rosa',
        swatch: ['#d9a982'],
        codes: ['ZPHF16B'],
        price: '260 EUR',
        specs: [
          'Cassa in acciaio 40mm laminata in oro rosa',
          'Spessore 13mm',
          'Vetro in esalite',
          'Movimenti al quarzo Myota 2115',
          'Cinturino in acciaio laminato in oro rosa',
        ],
        images: img('high-flight-16b', 'Orologio High Flight laminato in oro rosa con quadrante bianco e bracciale a maglia'),
      },
    ],
  },
  {
    id: 'tasca',
    codes: ['ZTOR0013', 'ZTAR0013'],
    name: 'Tasca N°0',
    price: '380 EUR',
    quote: { text: 'Cambiare emozioni equivale a cambiare il destino', author: 'Neville Goddard' },
    specs: [
      'Movimento meccanico a carica manuale',
      'Frequenza 21600 A/O 33 rubini',
      'Cassa laminata in oro 36 mm (ZTOR0013) o cassa in acciaio 36 mm (ZTAR0013)',
      'Vetro zaffiro',
    ],
    images: [],
    variants: [
      {
        id: 'tasca-oro',
        label: 'Oro',
        swatch: ['#d4b26a'],
        codes: ['ZTOR0013'],
        price: '380 EUR',
        specs: ['Movimento meccanico a carica manuale', 'Frequenza 21600 A/O 33 rubini', 'Cassa laminata in oro 36 mm', 'Vetro zaffiro'],
        images: [
          { src: 'img/models/tasca.jpg', alt: 'Orologio da tasca N°0 laminato in oro, rettangolare, con numeri romani e fasi lunari' },
          { src: 'img/models/tasca-3.jpg', alt: 'Dettaglio del quadrante del Tasca N°0 in oro con fasi lunari' },
        ],
      },
      {
        id: 'tasca-acciaio',
        label: 'Acciaio',
        swatch: ['#c9c9c6'],
        codes: ['ZTAR0013'],
        price: '380 EUR',
        specs: ['Movimento meccanico a carica manuale', 'Frequenza 21600 A/O 33 rubini', 'Cassa in acciaio 36 mm', 'Vetro zaffiro'],
        images: [{ src: 'img/models/tasca-2.jpg', alt: 'Orologio da tasca N°0 in acciaio, rettangolare, con numeri romani e fasi lunari' }],
      },
    ],
  },
  {
    id: 'bauletto',
    codes: ['ZVBA13'],
    name: 'Bauletto',
    price: '420 EUR',
    quote: {
      text: 'Viaggiate con anima e cuore, portate un bagaglio vuoto, e non tornate finché non è pieno',
    },
    specs: [
      'Movimento swiss made quarzo',
      'Vetro minerale',
      'Cassa in acciaio -aperta 89 mm-chiusa 53 mm',
      'Sveglia',
      'Rivestimento coccodrillo',
      'Appoggio estraibile',
      'Edizione limitata',
    ],
    images: img('bauletto', 'Sveglia da viaggio Bauletto in custodia di coccodrillo nero con quadrante bianco'),
  },
  {
    id: 'vintage',
    codes: ['ZPV14U', 'ZPV15L'],
    name: 'Vintage',
    price: '220 EUR',
    quote: { text: 'La moda passa lo stile resta', author: 'C. Chanel' },
    specs: [
      'Movimento al quarzo con datario',
      'Corona e fondo a vite',
      'Bracciale e Cassa laminata',
      'Quadrante in madreperla',
      'Cassa 36 mm (ZPV14U - Uomo) o 28 mm (ZPV15L - Donna)',
    ],
    images: img('vintage', 'Orologi Vintage con bracciale, lunetta zigrinata e numeri romani'),
  },
]

export const storia: Storia = {
  eyebrow: 'Storia',
  title: 'Una famiglia di orologiai a Scalea',
  intro: 'Zito1950 è una lunga storia che inizia più di mezzo secolo fa.',
  chapters: [
    {
      eyebrow: 'Il fondatore',
      title: 'Cav. Luigi Antonio Zito',
      paragraphs: [
        'L. A. Zito entra come orologiaio nelle ferrovie italiane. La sua grande passione, la forte determinazione e la grande abilità di maestro orologiaio lo stimolano a fondare nel 1950 la ditta Zito.',
      ],
      image: {
        src: 'img/storia/luigi-antonio-zito-cavaliere.jpg',
        alt: 'Ritratto in bianco e nero del Cav. Luigi Antonio Zito in abito scuro',
        caption: 'Cav. Luigi Antonio Zito',
      },
    },
    {
      eyebrow: '1945 · Scalea',
      title: 'Il primo negozio',
      paragraphs: [
        'Siamo nel 1945 a Scalea, piccolo e incontaminato borgo della Riviera dei Cedri, oggi rinomata meta turistica internazionale.',
        "Un piccolo negozio le cui vetrine mostrano pochi ma preziosi orologi organizzati in gruppetto; sullo sfondo un ambiente dal sapore familiare: comode poltroncine su cui accomodarsi per scambiare due chiacchiere e gustare un dolcetto preparato da mia nonna, tipico dei negozi d'allora... dove il tempo scorreva lento.",
      ],
      image: {
        src: 'img/storia/scalea-borgo.jpg',
        alt: 'Fotografia d’epoca in bianco e nero di Scalea, il borgo sulla collina sopra il mare',
        caption: 'Scalea, Riviera dei Cedri',
      },
    },
    {
      eyebrow: 'Fine anni Cinquanta',
      title: 'Francesco Zito',
      paragraphs: [
        "Verso la fine degli anni Cinquanta è Francesco Zito, mio padre, competente orologiaio, che ha il compito di traghettare l'azienda familiare verso il nuovo millennio.",
        'E ci riesce benissimo con geniali intuizioni, ancora oggi punti fermi in ZITO1950.',
        'Nel 1970 apre lo showroom creato da un famoso architetto senese e brevetta, fra le tante creazioni, anche un ciondolo in oro giallo di notevole successo. Una storia, per certi versi sorprendente, che dà inizio alla mia più grande passione: gli orologi!',
      ],
      image: {
        src: 'img/storia/francesco-zito-scooter.jpg',
        alt: 'Francesco Zito in giacca e cravatta seduto su uno scooter, foto in bianco e nero',
        caption: 'Francesco Zito',
      },
    },
    {
      eyebrow: 'Anni Sessanta',
      title: 'Il tempo e le mode',
      paragraphs: [
        "Col passare del tempo, le mode impongono nuovi standard e i misuratori meccanici rimangono, a giusta ragione, desiderio esclusivo d'intenditori.",
        'Nuovi materiali vengono utilizzati all\'interno dell\'orologio: alcuni marchi, negli anni Sessanta, inseriscono uno scappamento di plastica in un movimento metallico colorandone le parti per evidenziarle ancor di più. Inizia cosi l\'epoca "moderna", dove il bilanciere viene mosso elettronicamente da una grossa batteria, fino ad arrivare qualche decennio fa, al movimento al quarzo.',
        'Qualcuno dice, però, che la differenza fra un orologio meccanico ed uno al quarzo è la stessa che esiste fra un ritratto ad olio ed una fototessera.',
      ],
      image: {
        src: 'img/storia/francesco-zito-1955-laboratorio.jpg',
        alt: 'Francesco Zito al banco da orologiaio, sullo sfondo l’insegna Zito 1950',
        caption: 'Francesco Zito, 1955',
      },
    },
    {
      eyebrow: '1957',
      title: 'Una dedica',
      paragraphs: [
        'Scritta a mano sulla fotografia: «a Zito 1950. Grazie per la precisione e la bellezza dei suoi prodotti con simpatia e ammirazione. Vittorio Zito»',
      ],
      image: {
        src: 'img/storia/vittorio-zito-ducati-1957.jpg',
        alt: 'Vittorio Zito in gara su una Ducati Marianna 125 tra gli spruzzi d’acqua, foto in bianco e nero con dedica',
        caption: 'Vittorio Zito su Ducati Marianna 125 1957 – (Foto Breveglieri)',
      },
    },
    {
      eyebrow: 'Una nuova era',
      title: 'Passione Zito 1950',
      paragraphs: [
        'Da bambino, spesso seduto accanto a mio nonno nel suo laboratorio, passavo ore a osservarlo mentre ricostruiva parti di orologio al tornio, alimentando sempre più la mia già smisurata curiosità!',
        "Inizia dunque una nuova era, caratterizzata dall'idea di Luigi Antonio Zito nipote, di trasferire la passione ai propri clienti attraverso creazioni vicine alle loro esigenze come il non voler rinunciare a un accessorio a volte elegante, a volte informale, a volte unico: in un mercato globalizzato, dove molto sembra uniformarsi alle regole di mercato, non basta più seguire le mode, bisogna proporle. In altri termini, bisogna avere la capacità di innovare ed essere originali.",
        "Una storia che abbiamo voluto concretizzare oggi in due momenti: uno da indossare al polso con affidabilità e tanto carattere, l'altro da custodire nel taschino o sullo scrittoio.",
      ],
      image: {
        src: 'img/storia/luigi-antonio-zito.jpg',
        alt: 'Luigi Antonio Zito alla scrivania mentre disegna un orologio, circondato da sagome e orologi, foto in bianco e nero',
        caption: 'Luigi Antonio Zito',
      },
    },
  ],
  closing: {
    text: "Il tempo fugge e l'orologio non ha il potere di fermarlo, ha solo la funzione di ricordare che il prima non esiste più e che la vita va vissuta nel preciso secondo indicato sul quadrante.",
    author: 'L. A. Z.',
  },
}

export const orologi: Orologi = {
  eyebrow: 'Orologi',
  title: 'La collezione',
  intro:
    'L\'orologio era per me, allo stesso tempo, uno strumento meraviglioso e un compagno fedele. Il primo battito, il primo "tic" era un\'esperienza unica come l\'inizio di una nuova vita.',
  pillars: [
    {
      title: 'Movimenti meccanici',
      text: 'Dopo aver assemblato e data la prima carica al complesso insieme di ruote e bilanciere, l\'orecchio entra in una sorta di "melodia galattica", dove ogni parte dipende dall\'altra come in un "universo microscopico"! Calibri ETA 2824, 7001 e 2671, Valjoux 7750, Tourbillon.',
    },
    {
      title: 'Cassa e movimento',
      text: "Cassa e movimento si accoppiano diventando un tutt'uno armonico con albero e corona. Ogni elemento funziona alla perfezione: gli ingranaggi cominciano a ruotare e la lancetta dei secondi inizia le sue infinite rotazioni, in sincronia e con la complicità di quella dei minuti e delle ore.",
    },
    {
      title: 'Antiurto Incabloc',
      text: 'Eta 2824, 25 rubini, 28.800 a/h (4hz), regolazione ETACHRON con vite micrometrica, riserva di carica 38h. Antiurto Incabloc. Quindi robusto e affidabile.',
    },
    {
      title: 'Vetro zaffiro',
      text: 'Vetro zaffiro convesso e fondello zaffiro: sul 40.000 µm il fondello zaffiro porta impressa la famosa 10 lire.',
    },
  ],
  catalog: {
    eyebrow: 'Catalogo',
    title: 'I modelli',
    details: 'Dettagli',
    viewImage: 'Mostra immagine',
    prevImage: 'Foto precedente',
    nextImage: 'Foto successiva',
    colors: 'Colori disponibili',
    mailSubject: 'Richiesta informazioni – ',
  },
}

export const profumo: Profumo = {
  id: 'n7-oud',
  eyebrow: 'Profumi',
  code: 'ZPR07',
  name: 'N°7 Oud',
  price: '120 EUR',
  quote: { text: 'Non si è mai completamente vestiti senza profumo!', author: 'C. JoyBell C' },
  paragraphs: [
    "Selvaggio, primitivo e misterioso, l'oud noto anche come Agarwood, è perfino citato nella Bibbia nel Cantico dei Cantici. Pochi profumi al mondo possono vantare origini così nobili e remote.",
    'L’oud, noto anche come Agarwood, è il profumo per eccellenza nel Medioriente: le elite dei Paesi del Golfo pagano cifre astronomiche per aggiudicarsi piccole ampolle di questo olio, di cui poche gocce sono sufficienti a diffondere una fragranza intensa.',
    'E pensare che invece l’oud è originario del sud-est asiatico. Questa resina è infatti una delle più curiose produzioni della natura: è una essudazione aromatica che gli alberi del tipo Aquilaria producono per proteggersi dagli attacchi di muffe, funghi o insetti che intacchino la loro corteccia.',
  ],
  specs: ['Eau de parfum', 'Vaporisateur natural spray', '50 ml – 1,7 fl. oz'],
  ingredients: [
    'Alcohol denat.',
    'Aqua',
    'Parfum',
    'Hydroxyisohexyl',
    '3-cyclohexene carboxaldehyde',
    'Limonene',
    'Eugenol',
    'BHT',
  ],
  images: [
    { src: 'img/profumo/n7-oud.jpg', alt: 'Flacone di eau de parfum N°7 Oud con il marchio Z' },
    { src: 'img/profumo/n7-oud-journal.jpg', alt: 'Flacone di N°7 Oud eau de parfum su fondo bianco' },
  ],
  labels: {
    ingredients: 'Ingredienti',
    mailSubject: 'Richiesta informazioni',
  },
}

export const contatti: Contatti = {
  eyebrow: 'Contatti',
  title: 'Vieni a trovarci',
  intro: 'Scalea, piccolo borgo della Riviera dei Cedri.',
  company: 'GRANALIDA s.r.l. soc. unipers.',
  address: 'via Michele Bianchi n. 23',
  city: 'Scalea (CS)',
  numeroVerde: '800 58 67 08',
  numeroVerdeHref: 'tel:+39800586708',
  pec: 'granalida@pec.it',
  piva: '03012360784',
  website: 'www.zito1950.it',
  instagram: 'https://www.instagram.com/zito1950lifestyle/',
  facebook: 'http://www.facebook.com/zito1950',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Via+Michele+Bianchi+23+Scalea+CS',
  labels: {
    address: 'Indirizzo',
    phone: 'Numero Verde',
    pec: 'PEC',
    social: 'Social',
    piva: 'P. IVA',
    maps: 'Apri in Google Maps',
    mapTitle: 'Mappa: via Michele Bianchi n. 23, Scalea (CS)',
    instagram: 'Instagram',
    facebook: 'Facebook',
    newTab: '(si apre in una nuova scheda)',
  },
}

/*
 * Fonti (journal = journal_photos/photo_53439824439811193NN; old = research/old-site.md)
 * Prezzi: journal 355 (listino). Il listino stampa "3.890 EUR" e "2.390 EUR" con il punto,
 *   ma "3,300 EUR" (N°12 Tourbillon) e "1,450 EUR" (Italy) con la virgola: uniformati qui
 *   al separatore italiano "." (conferma old site: italy € 1.450,00).
 * tutus-ab-uno: journal 28 (codice ZP18K16, testo 1970), 29 (nome, specs)
 * takimo: journal 30 (codice, citazione L.A.Z.), 31 (Takimo 65°, intro, specs)
 * n2, n3: journal 33 · n5, n6: journal 35 · n7, n9: journal 36 e 358 (specs riletti)
 * n12-tourbillon: journal 39 (specs, citazione), 38 (d'Alembert)
 * 900-uomo, 900-donna: journal 40 · n20: journal 43 · shockproof-16/16b/16p: journal 44 e 359_y
 * italy: journal 45 · cafe-racer: journal 46 · gentleman: journal 49 · 40000um: journal 50
 * casuale, high-flight-16b, high-flight-16: journal 51 ("Myota" come stampato)
 * tasca, bauletto: journal 52 (citazione bauletto senza autore) · vintage: journal 53
 * storia: fondatore journal 15 + old storia.html (ferrovie, 1950); Scalea 1945 journal 25-26;
 *   Francesco Zito journal 27, 32 (1955); epoca moderna journal 32-34 + old passione-zito.html
 *   (ritratto ad olio / fototessera, "due momenti" da old storia.html); Vittorio Zito 1957
 *   journal 47; laboratorio del nonno journal 28-29; nuova era journal 34-35; chiusura journal 36.
 * orologi: intro journal 29-30; pillars journal 30-31 (cassa e movimento), 35 (Eta 2824,
 *   Incabloc), calibri dagli specs 29, 31, 36, 39, 45; zaffiro journal 33, 50.
 * profumo: journal 354 (citazione, nome, ZPR07, testo, 50 ml), 355 (120 EUR);
 *   paragrafi 2-3 e ingredienti da old zpr07.html.
 * contatti: old contatti.html (GRANALIDA, indirizzo, P. IVA, PEC), old index/header (social);
 *   Numero Verde e www.zito1950.it: journal 357. CAP non presente nelle fonti.
 * site.tagline: old storia.html; nav/cta: microcopy UI.
 */

