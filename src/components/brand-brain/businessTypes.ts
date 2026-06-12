// Presets por tipo de negocio para el Brand Brain.
// Cambian el copy, los placeholders y los ejemplos de cada paso para que el
// formulario hable el idioma del negocio (restaurante, gimnasio, concesionario…)
// sin tocar el schema: todo se guarda en los mismos JSONB.

export interface BusinessTypePreset {
  label: string
  // Paso 1 — Identidad
  subsectorPlaceholder: string
  priceContextPlaceholder: string
  oneLinerPlaceholder: string
  // Paso 2 — Audiencia
  occupationPlaceholder: string
  lifestylePlaceholder: string
  // Paso 3 — Voz
  emojiStylePlaceholder: string
  toneReferencesPlaceholder: string
  // Paso 4 — Productos
  productsTitle: string
  productsHint: string
  itemNoun: string
  addItemLabel: string
  itemPricePlaceholder: string
  dontPromotePlaceholder: string
  // Paso 6 — Operaciones
  bookingCtaPlaceholder: string
  primaryGoalPlaceholder: string
}

export const DEFAULT_BUSINESS_TYPE = 'otro'

export const BUSINESS_TYPES: Record<string, BusinessTypePreset> = {
  restaurante: {
    label: 'Restaurante',
    subsectorPlaceholder: 'Gourmet, tapas, asador, fusión…',
    priceContextPlaceholder: 'Menú del día 12€, carta media 35€',
    oneLinerPlaceholder: 'Cocina de mercado con producto local en el centro de…',
    occupationPlaceholder: 'Profesionales, turistas de nivel medio-alto',
    lifestylePlaceholder: 'Salen a cenar 2-3 veces al mes, valoran el producto…',
    emojiStylePlaceholder: 'Solo gastronómicos: 🍷🥩',
    toneReferencesPlaceholder: '@DiverXO, @StreetXO…',
    productsTitle: 'Platos y experiencias estrella',
    productsHint: 'Los platos que el grabador debe priorizar y la IA debe mencionar.',
    itemNoun: 'plato',
    addItemLabel: '+ Añadir plato / experiencia estrella',
    itemPricePlaceholder: '28€',
    dontPromotePlaceholder: 'El menú del día, precios sin contexto… (una línea cada uno)',
    bookingCtaPlaceholder: 'Reserva tu mesa en…',
    primaryGoalPlaceholder: 'Aumentar reservas para eventos privados',
  },
  bar_cafeteria: {
    label: 'Bar / Cafetería',
    subsectorPlaceholder: 'Bar de tapas, cafetería de especialidad, cocktail bar…',
    priceContextPlaceholder: 'Café 2,50€, brunch 14€, cócteles 9-12€',
    oneLinerPlaceholder: 'Café de especialidad y brunch en el barrio de…',
    occupationPlaceholder: 'Jóvenes profesionales, estudiantes, vecinos del barrio',
    lifestylePlaceholder: 'Desayunan fuera, quedan para el afterwork…',
    emojiStylePlaceholder: '☕🥐 o 🍸🍋 según la carta',
    toneReferencesPlaceholder: '@cafetería_referente, @bar_referente…',
    productsTitle: 'Productos y momentos estrella',
    productsHint: 'Lo que mejor funciona: el brunch, el cóctel firma, la tostada viral…',
    itemNoun: 'producto',
    addItemLabel: '+ Añadir producto / momento estrella',
    itemPricePlaceholder: '4,50€',
    dontPromotePlaceholder: 'Ofertas agresivas, 2x1 que devalúan la marca…',
    bookingCtaPlaceholder: 'Ven a probarlo — sin reserva',
    primaryGoalPlaceholder: 'Llenar las mañanas entre semana',
  },
  gimnasio: {
    label: 'Gimnasio / Centro deportivo',
    subsectorPlaceholder: 'CrossFit, boutique, pilates, artes marciales…',
    priceContextPlaceholder: 'Cuota mensual 45€, bono 10 sesiones 120€',
    oneLinerPlaceholder: 'Entrenamiento personalizado en grupos reducidos en…',
    occupationPlaceholder: 'Profesionales 25-45 que buscan resultados y comunidad',
    lifestylePlaceholder: 'Entrenan 3-4 días/semana, cuidan la alimentación…',
    emojiStylePlaceholder: '💪🔥 con moderación',
    toneReferencesPlaceholder: '@gymshark, @centro_referente…',
    productsTitle: 'Planes, clases y servicios estrella',
    productsHint: 'Los planes y clases que más convierten: PT, clases colectivas, retos…',
    itemNoun: 'plan o clase',
    addItemLabel: '+ Añadir plan / clase estrella',
    itemPricePlaceholder: '45€/mes',
    dontPromotePlaceholder: 'Descuentos permanentes, antes/después sin consentimiento…',
    bookingCtaPlaceholder: 'Reserva tu clase de prueba gratis',
    primaryGoalPlaceholder: 'Conseguir 20 altas nuevas al mes',
  },
  concesionario: {
    label: 'Concesionario / Automoción',
    subsectorPlaceholder: 'Multimarca, km0, ocasión, taller oficial…',
    priceContextPlaceholder: 'Vehículos 15.000-45.000€, financiación desde 250€/mes',
    oneLinerPlaceholder: 'Vehículos de ocasión revisados con garantía en…',
    occupationPlaceholder: 'Familias y profesionales que renuevan coche cada 5-8 años',
    lifestylePlaceholder: 'Comparan mucho online antes de visitar, valoran la confianza…',
    emojiStylePlaceholder: '🚗✨ con moderación',
    toneReferencesPlaceholder: '@concesionario_referente…',
    productsTitle: 'Stock y servicios destacados',
    productsHint: 'Los vehículos o servicios a empujar: modelos top, financiación, tasación…',
    itemNoun: 'vehículo o servicio',
    addItemLabel: '+ Añadir vehículo / servicio destacado',
    itemPricePlaceholder: '24.900€ o desde 250€/mes',
    dontPromotePlaceholder: 'Precios sin financiación detallada, unidades ya vendidas…',
    bookingCtaPlaceholder: 'Reserva tu prueba de conducción',
    primaryGoalPlaceholder: 'Generar visitas a exposición y pruebas de conducción',
  },
  clinica_estetica: {
    label: 'Clínica / Estética / Salud',
    subsectorPlaceholder: 'Medicina estética, fisioterapia, dental, dermatología…',
    priceContextPlaceholder: 'Primera consulta gratis, tratamientos 60-300€',
    oneLinerPlaceholder: 'Tratamientos de medicina estética con resultados naturales en…',
    occupationPlaceholder: 'Mujeres y hombres 30-55 que cuidan su imagen y salud',
    lifestylePlaceholder: 'Se informan a fondo, valoran credenciales y resultados reales…',
    emojiStylePlaceholder: '✨ muy sobrio o ninguno',
    toneReferencesPlaceholder: '@clinica_referente…',
    productsTitle: 'Tratamientos y servicios estrella',
    productsHint: 'Los tratamientos que más demanda tienen o más margen dejan.',
    itemNoun: 'tratamiento',
    addItemLabel: '+ Añadir tratamiento estrella',
    itemPricePlaceholder: '120€/sesión',
    dontPromotePlaceholder: 'Resultados exagerados, antes/después sin consentimiento, precios de choque…',
    bookingCtaPlaceholder: 'Pide tu valoración gratuita',
    primaryGoalPlaceholder: 'Llenar la agenda de primeras consultas',
  },
  peluqueria_barberia: {
    label: 'Peluquería / Barbería',
    subsectorPlaceholder: 'Barbería clásica, salón de color, unisex…',
    priceContextPlaceholder: 'Corte 18€, color desde 45€',
    oneLinerPlaceholder: 'Barbería con cita previa y atención al detalle en…',
    occupationPlaceholder: 'Clientes recurrentes del barrio + nuevos por Instagram',
    lifestylePlaceholder: 'Repiten cada 3-5 semanas, valoran puntualidad y resultado…',
    emojiStylePlaceholder: '✂️ con moderación',
    toneReferencesPlaceholder: '@barberia_referente…',
    productsTitle: 'Servicios estrella',
    productsHint: 'Los servicios que más se piden o que mejor lucen en vídeo.',
    itemNoun: 'servicio',
    addItemLabel: '+ Añadir servicio estrella',
    itemPricePlaceholder: '18€',
    dontPromotePlaceholder: 'Huecos libres de última hora con descuento…',
    bookingCtaPlaceholder: 'Reserva tu cita por WhatsApp',
    primaryGoalPlaceholder: 'Llenar la agenda de la semana con cita previa',
  },
  retail: {
    label: 'Tienda / Retail',
    subsectorPlaceholder: 'Moda, deportes, decoración, alimentación gourmet…',
    priceContextPlaceholder: 'Ticket medio 35€',
    oneLinerPlaceholder: 'Moda sostenible seleccionada a mano en…',
    occupationPlaceholder: 'Compradores locales + online, 25-50 años',
    lifestylePlaceholder: 'Descubren marcas por Instagram, valoran lo único…',
    emojiStylePlaceholder: '🛍️✨ con moderación',
    toneReferencesPlaceholder: '@tienda_referente…',
    productsTitle: 'Productos y colecciones estrella',
    productsHint: 'Novedades, básicos que siempre funcionan y productos con historia.',
    itemNoun: 'producto',
    addItemLabel: '+ Añadir producto / colección estrella',
    itemPricePlaceholder: '39,90€',
    dontPromotePlaceholder: 'Liquidaciones constantes, stock que no llega…',
    bookingCtaPlaceholder: 'Visítanos o compra online en…',
    primaryGoalPlaceholder: 'Tráfico a tienda física y ventas online',
  },
  inmobiliaria: {
    label: 'Inmobiliaria',
    subsectorPlaceholder: 'Residencial, lujo, alquiler, obra nueva…',
    priceContextPlaceholder: 'Viviendas 150.000-600.000€ en zona…',
    oneLinerPlaceholder: 'Vendemos tu casa en menos de 90 días en…',
    occupationPlaceholder: 'Propietarios que venden + compradores 30-55',
    lifestylePlaceholder: 'La decisión más grande de su vida: necesitan confianza…',
    emojiStylePlaceholder: '🏡🔑 muy sobrio',
    toneReferencesPlaceholder: '@inmobiliaria_referente…',
    productsTitle: 'Inmuebles y servicios destacados',
    productsHint: 'Captaciones estrella, servicios (tasación, home staging) y zonas fuertes.',
    itemNoun: 'inmueble o servicio',
    addItemLabel: '+ Añadir inmueble / servicio destacado',
    itemPricePlaceholder: '285.000€',
    dontPromotePlaceholder: 'Inmuebles ya vendidos, precios sin zona…',
    bookingCtaPlaceholder: 'Pide tu valoración gratuita',
    primaryGoalPlaceholder: 'Captar propietarios vendedores en la zona',
  },
  hotel_alojamiento: {
    label: 'Hotel / Alojamiento',
    subsectorPlaceholder: 'Hotel boutique, apartamentos turísticos, casa rural…',
    priceContextPlaceholder: 'Habitación desde 95€/noche',
    oneLinerPlaceholder: 'Hotel boutique con encanto a 5 min de…',
    occupationPlaceholder: 'Parejas, viajeros internacionales, escapadas de fin de semana',
    lifestylePlaceholder: 'Buscan experiencias, reservan con antelación, miran reseñas…',
    emojiStylePlaceholder: '🌅🥂 con moderación',
    toneReferencesPlaceholder: '@hotel_referente…',
    productsTitle: 'Experiencias y servicios estrella',
    productsHint: 'Lo que diferencia la estancia: desayuno, spa, terraza, late checkout…',
    itemNoun: 'experiencia',
    addItemLabel: '+ Añadir experiencia / servicio estrella',
    itemPricePlaceholder: 'Desde 95€/noche',
    dontPromotePlaceholder: 'Fechas ya completas, ofertas que canibalizan temporada alta…',
    bookingCtaPlaceholder: 'Reserva directa con el mejor precio en…',
    primaryGoalPlaceholder: 'Aumentar la reserva directa frente a Booking',
  },
  academia_formacion: {
    label: 'Academia / Formación',
    subsectorPlaceholder: 'Idiomas, oposiciones, música, formación online…',
    priceContextPlaceholder: 'Matrícula 50€, mensualidad 89€',
    oneLinerPlaceholder: 'Preparamos tu B2 de inglés con grupos de máximo 6 en…',
    occupationPlaceholder: 'Estudiantes, opositores, profesionales que se reciclan',
    lifestylePlaceholder: 'Comparan academias, valoran resultados demostrables…',
    emojiStylePlaceholder: '📚✅ con moderación',
    toneReferencesPlaceholder: '@academia_referente…',
    productsTitle: 'Cursos y programas estrella',
    productsHint: 'Los cursos con más demanda y mejores resultados (% aprobados…).',
    itemNoun: 'curso',
    addItemLabel: '+ Añadir curso / programa estrella',
    itemPricePlaceholder: '89€/mes',
    dontPromotePlaceholder: 'Promesas de aprobado garantizado…',
    bookingCtaPlaceholder: 'Reserva tu clase de prueba',
    primaryGoalPlaceholder: 'Llenar los grupos del próximo trimestre',
  },
  otro: {
    label: 'Otro',
    subsectorPlaceholder: 'Especialidad del negocio…',
    priceContextPlaceholder: 'Ticket medio, rangos de precio…',
    oneLinerPlaceholder: 'Qué hace el negocio en una línea…',
    occupationPlaceholder: 'Perfil del cliente ideal…',
    lifestylePlaceholder: 'Cómo es su vida, qué valoran…',
    emojiStylePlaceholder: 'Estilo de emojis si se usan…',
    toneReferencesPlaceholder: '@cuenta_referente…',
    productsTitle: 'Productos y servicios estrella',
    productsHint: 'Lo que el grabador debe priorizar y la IA debe mencionar.',
    itemNoun: 'producto o servicio',
    addItemLabel: '+ Añadir producto / servicio estrella',
    itemPricePlaceholder: 'Precio (opcional)',
    dontPromotePlaceholder: 'Qué no comunicar nunca… (una línea cada uno)',
    bookingCtaPlaceholder: 'CTA principal (reserva, compra, visita…)',
    primaryGoalPlaceholder: 'Objetivo principal en redes…',
  },
}

export function getPreset(businessType: string | undefined | null): BusinessTypePreset {
  return BUSINESS_TYPES[businessType ?? ''] ?? BUSINESS_TYPES[DEFAULT_BUSINESS_TYPE]
}

export const BUSINESS_TYPE_OPTIONS = Object.entries(BUSINESS_TYPES).map(
  ([value, preset]) => ({ value, label: preset.label })
)
