import { createClient } from '@supabase/supabase-js'

// Credenciales desde el entorno (NUNCA hardcodear la service_role key).
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-nero.mjs
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const CLIENT_ID = '65ffd885-77e3-463e-961f-f0526e14d535'

const { error } = await supabase.from('brand_brains').upsert({
  client_id: CLIENT_ID,
  onboarding_completed: true,
  onboarding_step: 6,
  identity: {
    business_name: 'Nero Restaurante',
    sector: 'Hosteleria',
    subsector: 'Restaurante gourmet con terraza',
    location_city: 'Salamanca',
    location_neighborhood: 'Plaza Mayor',
    founded_year: null,
    founding_story: 'Kenny Daniela aposto por ocupar uno de los espacios mas iconicos de Salamanca cuando nadie esperaba que funcionara a ese nivel. Un riesgo calculado que hoy tiene 35 empleados en temporada alta.',
    one_liner: 'Gastronomia de nivel en el corazon de la Plaza Mayor de Salamanca.',
    unique_value_proposition: 'El unico restaurante gourmet con terraza propia en Plaza Mayor. No vendes comida, vendes estar en el centro de Salamanca con una copa en la mano y una mesa que vale la pena reservar.',
    price_tier: 'premium',
    price_context: 'Carta media 35-50 euros por persona. Menus especiales para eventos desde 60 euros.',
    team_size: '25 fijos, 35 en temporada alta',
    has_physical_location: true,
    has_online_sales: false,
    locations_count: 1,
  },
  audience: {
    primary: {
      age_range: '30-55',
      gender_focus: 'mixed',
      occupation: 'Turista nacional e internacional, ejecutivo, profesional liberal, pareja en fecha especial, empresario que celebra',
      lifestyle: 'Viajan con criterio, valoran la experiencia por encima del precio, buscan lugares con historia y con algo que contar despues. No improvisan, reservan con antelacion.',
      income_level: 'high',
      location_type: 'tourist',
      pain_before: 'Llegan a Salamanca y no saben donde comer bien de verdad. TripAdvisor les muestra lo mismo de siempre. Quieren algo memorable pero sin arriesgarse a decepcionar a quien les acompana.',
      desire: 'Una experiencia que este a la altura del sitio. Comer bien, en un lugar con personalidad, con vistas a la plaza, que sea el momento del viaje que mas recuerden.',
      fear: 'Pagar caro y que no valga la pena. Que la comida sea mediocre disfrazada de ambiente. Que la terraza este llena y no hayan reservado.',
      transformation: 'Salen con la sensacion de haber acertado. Tienen fotos, tienen historia que contar, sienten que conocieron Salamanca de verdad.',
      how_they_talk: 'Hablan de experiencias, de merecer la pena, de uno de esos sitios. Dicen estaba buenisimo y hay que volver.',
      what_they_search: 'restaurante Plaza Mayor Salamanca, donde comer bien Salamanca, terraza Plaza Mayor restaurante',
    },
    secondary: {
      description: 'Empresas y grupos que buscan espacio para eventos privados, cenas de empresa, celebraciones familiares de hasta 60 personas.',
      why_different_approach: 'Este perfil no busca experiencia personal sino impresionar a otros. El argumento es la exclusividad del espacio.',
    },
    never_says: ['Esta bien de precio', 'Las raciones son grandes', 'Nada del otro mundo', 'No hace falta reservar'],
    they_say: ['La mejor terraza de Salamanca sin duda', 'Imprescindible si vienes a Salamanca', 'El servicio es de otro nivel', 'Reservad con tiempo, siempre esta lleno'],
  },
  voice: {
    personality_traits: ['elegante', 'seguro', 'cercano sin perder clase', 'con criterio', 'sin pretensiones innecesarias'],
    formality_level: 4,
    emoji_usage: 'minimal',
    emoji_style: 'Solo ocasional: vino y carne',
    humor_allowed: false,
    humor_type: null,
    primary_language: 'es',
    secondary_languages: ['en'],
    forbidden_words: ['barato', 'economico', 'asequible', 'riquisimo', 'mega', 'brutal', 'flipar', 'oferta', 'promocion', '2x1', 'outlet'],
    forbidden_topics: ['comparaciones directas con otros restaurantes', 'precios en el copy salvo contexto de evento', 'humor grueso', 'politica'],
    preferred_words: ['experiencia', 'temporada', 'producto', 'reserva', 'espacio', 'terraza', 'cocina', 'cuidado', 'seleccion'],
    signature_expressions: ['En el corazon de Salamanca', 'Una mesa que vale la pena reservar', 'Cocina con criterio'],
    tone_references: ['@diverxo', '@elkeller', '@restaurantemugaritz'],
    anti_tone: 'No sonar como un menu impreso. No ser frio ni distante. No usar superlativos vacios. La clase no se anuncia, se demuestra.',
  },
  products: {
    hero_items: [
      {
        name: 'Entrecot de vaca rubia gallega',
        description: 'Corte premium con maduracion propia. El plato que mas repiten los que vienen por primera vez.',
        price: 'desde 32 euros',
        why_special: 'Producto de origen trazado, punto de coccion trabajado al detalle.',
        season: 'Todo el año',
        visual_description: 'Carne con costra dorada exterior, interior rosado, emplatado limpio sobre tabla o plato oscuro.',
        content_angle: 'El proceso desde la seleccion hasta el plato. Primer plano del corte.',
      },
      {
        name: 'Terraza Plaza Mayor',
        description: 'La mesa en terraza con la plaza al fondo es lo que diferencia a Nero de cualquier otro restaurante.',
        price: null,
        why_special: 'Pocas terrazas en Espana tienen este fondo. Es un activo visual que se vende solo.',
        season: 'Primavera, verano y otono',
        visual_description: 'Gran angular desde la terraza hacia la plaza, luz dorada de tarde o noche, copas en mesa.',
        content_angle: 'Atardecer, luz de vela por la noche, mesa llena con ambiente.',
      },
      {
        name: 'Cocina de temporada',
        description: 'Carta que cambia segun producto disponible. Argumento de visita recurrente para clientes locales.',
        price: null,
        why_special: 'Lo que hay hoy no estara manana. Genera urgencia sin decirlo explicitamente.',
        season: 'Rotacion trimestral',
        visual_description: 'Plato de temporada con elementos naturales del ingrediente principal.',
        content_angle: 'Presentacion del plato nuevo con la historia del ingrediente de temporada.',
      },
    ],
    special_services: [
      {
        name: 'Espacio para eventos privados',
        description: 'Capacidad hasta 60 comensales. Espacio propio diferenciado del restaurante principal.',
        target: 'Empresas para cenas de equipo, familias para celebraciones, bodas civiles pequenas.',
        cta: 'Consulta disponibilidad para tu fecha, hablamos sin compromiso.',
      },
      {
        name: 'Reserva de terraza',
        description: 'Terraza con vistas directas a Plaza Mayor. Limitada, siempre bajo reserva previa.',
        target: 'Parejas, grupos de amigos, turistas que quieren el momento Salamanca.',
        cta: 'Reserva tu mesa en terraza antes de que no quede ninguna.',
      },
    ],
  },
}, { onConflict: 'client_id' })

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('Brand Brain de Nero insertado correctamente.')
}
