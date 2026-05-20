# Módulos del sistema — Especificación completa

---

## MÓDULO 1 — Admin CRM

### Ruta: `/admin`

### Panel principal (dashboard)

**Métricas en tiempo real:**
```
MRR Total          → sum(monthly_fee) WHERE status='active'
Clientes activos   → count WHERE status='active'
Churn del mes      → clientes que pasaron a 'churned' este mes
MRR en riesgo      → clientes con status='paused' o sin pago reciente
Pipeline valor     → sum(monthly_fee) WHERE status IN ('lead','proposal_sent','negotiation')
```

**Widgets del dashboard:**
- Gráfica MRR últimos 6 meses (línea)
- Lista de tareas de contenido vencidas o sin asignar
- Posts que se publican hoy
- Renovaciones próximas en 30 días
- Reseñas sin responder (todas las cuentas)
- Clientes sin informe semanal generado

### Vista de pipeline CRM

Kanban con columnas:
```
[ Lead ] → [ Propuesta enviada ] → [ Negociación ] → [ Activo ] → [ Pausado / Churned ]
```

Cada tarjeta muestra:
- Nombre del negocio
- Ticket mensual estimado
- Última actividad
- Próxima acción pendiente

### Ficha de cliente (vista admin)

- Datos de contacto + contrato
- Brand Brain (acceso directo para editar)
- Timeline de actividades CRM
- Historial de facturas
- Métricas de rendimiento en redes
- Contenido en producción esta semana
- Log de todas las publicaciones

### Gestión de facturas

- Generación manual o automática de facturas mensuales
- Estados: pendiente / enviada / pagada / vencida
- Vista mensual de cobros esperados vs recibidos

---

## MÓDULO 2 — Brand Brain (formulario de onboarding)

### Ruta: `/admin/clients/[id]/brand-brain`

### UX del formulario

- 6 pasos progresivos con barra de progreso
- Guardado automático en cada cambio (debounce 2s)
- El cliente puede completar el formulario desde su portal (`/cliente/onboarding`)
- Preguntas con tooltips explicativos para clientes no técnicos
- Campos de texto libre + selects + tags input

### Generación automática tras completar

Cuando `onboarding_completed = true`:
1. n8n recibe webhook `client.onboarding_completed`
2. Crea estructura de carpetas en Google Drive
3. Genera primera tanda de 10 ideas de contenido
4. Notifica al admin por Telegram
5. Envía email de bienvenida al cliente

---

## MÓDULO 3 — Generador de ideas

### Ruta: `/admin/clients/[id]/ideas`

### Flujo de generación semanal (n8n cron, lunes 9:00)

```
Para cada cliente activo:
  1. Lee brand_brain completo
  2. Lee recent_ideas (últimas 30) para anti-repetición
  3. Lee eventos especiales del mes (desde operations.seasonal_calendar)
  4. Lee top_performing para priorizar formatos que funcionan
  5. Llama Claude API con system prompt construido desde brand brain
  6. Solicita: 5 ideas SISTEMA + 2 ideas HUMANO sugeridas
  7. Guarda cada idea en content_ideas con concept_hash
  8. Notifica al admin: "Plan semanal [cliente] listo"
```

### Prompt de generación de ideas (estructura)

```
System: {buildSystemPrompt(brandBrain)}

User: Genera el plan de contenido para la semana del {fecha}.

CONTEXTO DE LA SEMANA:
- Eventos especiales: {eventos_del_mes}
- Mejor formato reciente: {top_performing.best_format}
- Mejor hora reciente: {top_performing.best_time}

GENERA:
5 ideas SISTEMA (content_origin: system):
  - Varía los tipos: mezcla product_hero, social_proof, educational, behind_scenes
  - Para cada idea: concept (1 línea) + full_description + content_type + angle + content_pillar
  
2 ideas HUMANO (content_origin: human):
  - Sugiere el ÁNGULO Y FORMATO, no el contenido
  - El humano aportará la historia real
  - Para cada idea: concept + por qué encajaría ahora + qué debe aportar el humano

Responde SOLO en JSON con este formato:
{
  "system_ideas": [...],
  "human_ideas": [...]
}
```

### Vista de ideas en el dashboard

- Columnas: `Sugerida | Aprobada | En producción | Publicada | Descartada`
- Filtros por cliente, tipo, semana, origen (sistema/humano)
- Acción rápida: aprobar idea → se crea automáticamente un `content_task`
- Banco de ideas descartadas (recuperables después de 60 días)

---

## MÓDULO 4 — Coordinación de grabación

### Ruta: `/grabador` (rol grabador) + vista en `/admin`

### Ficha de grabación (auto-generada al aprobar idea)

```typescript
recording_brief: {
  concept: string,           // "Terraza al atardecer con copa de vino"
  objective: string,         // "Transmitir la experiencia premium de Nero"
  planes: string[],          // ["Gran angular terraza", "Detalle copa", "Plano picado mesa"]
  duracion_estimada: string, // "30-45 segundos de material bruto"
  preparacion: string[],     // ["Mesa montada", "Luz natural (antes de las 20:30)", "Copa de vino tinto"]
  musica_referencia: string, // "Jazz suave, tipo lo que suena en el local"
  referencia_visual: string, // Link o descripción de cuenta de referencia
  notas_tecnicas: string,    // "Grabar en horizontal para IG feed y vertical para stories"
  deadline: string           // "Subir brutos antes del martes 20:00"
}
```

### Flujo del grabador

```
Recibe notificación Telegram con resumen de tarea
→ Abre dashboard grabador → ve sus tareas pendientes
→ Descarga ficha de grabación (PDF o vista web)
→ Graba
→ Sube brutos a Google Drive (carpeta /brutos/ del cliente)
→ En el dashboard: marca "Brutos listos"
→ Sistema notifica al editor automáticamente
```

### Vista del grabador (`/grabador`)

Solo ve:
- Sus tareas asignadas con status y deadline
- Ficha técnica de cada tarea
- Enlace directo a carpeta Drive del cliente
- Botón "Marcar brutos listos"
- Historial de tareas completadas

---

## MÓDULO 5 — Workspace del editor

### Ruta: `/editor`

### Flujo del editor

```
Recibe notificación Telegram: "Brutos listos — [cliente] — [concepto]"
→ Abre dashboard editor
→ Ve la tarea con:
   - Brief de edición detallado
   - Enlace directo a Drive (carpeta /brutos/)
   - Copy aprobado para usar en el vídeo
   - Deadline
→ Descarga brutos de Drive
→ Edita en CapCut/Premiere
→ En el dashboard: sube el vídeo editado directamente al sistema
→ Sistema guarda en Supabase Storage (vídeo final ligero) o Drive (/editados/)
→ Marca "Entregado"
→ Admin recibe notificación para revisar
```

### Brief de edición (auto-generado por Claude)

```typescript
editing_brief: {
  duracion_final: string,         // "15-20 segundos"
  ritmo: string,                  // "Lento y contemplativo, sin cortes bruscos"
  transiciones: string,           // "Fade suave entre planos, sin efectos"
  texto_pantalla: string | null,  // "Solo el copy final en los últimos 3 segundos"
  tipografia: string | null,      // "Serif elegante, color dorado, centro"
  musica_exacta: string,          // "Track 'Jazz Cafe' de CapCut o similar"
  color_grade: string,            // "Tonos cálidos, ligeramente desaturados"
  formato_exportacion: string,    // "MP4 H.264, 1080x1920 para stories, 1080x1080 para feed"
  notas_especiales: string        // Cualquier instrucción específica
}
```

### Vista del editor

Kanban personal:
```
[ Esperando brutos ] → [ Brutos disponibles ] → [ En edición ] → [ Entregado ] → [ Publicado ]
```

Cada tarea muestra:
- Cliente + concepto
- Brief de edición (expandible)
- Enlace Drive
- Copy final para referencia
- Deadline con color (verde/amarillo/rojo)
- Botón de subida de entregable

### Subida del entregable: Drive vs. sistema directo

**Decisión: el editor sube directamente al sistema (API Route de Next.js)**

Motivo: trigger limpio e inmediato. El archivo llega al servidor → se guarda en Supabase Storage o se sube a Drive via Google API → se crea el asset en la tabla `assets` → se actualiza el `content_task` → se dispara notificación al admin. Sin polling ni watchers frágiles.

Flujo técnico:
```
Editor → POST /api/upload/deliverable
  → Recibe archivo
  → Upload a Supabase Storage (/deliverables/{client_id}/{task_id}/)
  → Copia a Google Drive (/editados/)
  → Crea registro en assets
  → Actualiza content_task.status = 'delivered', final_asset_id
  → Llama n8n webhook: task.delivered
  → n8n notifica al admin por Telegram
```

---

## MÓDULO 6 — Revisión y aprobación

### Ruta: `/admin/review`

### Vista de revisión

Lista de entregables pendientes de aprobación, ordenados por deadline.

Cada ítem muestra:
- Reproductor de vídeo inline (Supabase Storage URL firmada)
- Copy seleccionado al lado
- Hashtags
- Plataformas destino
- Fecha/hora de publicación propuesta
- Historial de revisiones previas (si hay)

### Acciones del admin

- **✅ Aprobar** → `status = 'approved'`, entra al scheduler
- **✏️ Comentar y devolver** → nota al editor + `status = 'revision'` + notificación
- **📅 Cambiar fecha de publicación** → picker inline
- **❌ Rechazar** → vuelve a 'idea' con nota

---

## MÓDULO 7 — Scheduler y publicación

### n8n cron: cada 30 minutos

```
Llama RPC Supabase: get_posts_to_publish()
→ Para cada post devuelto:
   1. Obtiene asset (vídeo/imagen) desde Supabase Storage
   2. Según plataforma:
      
      INSTAGRAM/FACEBOOK:
      → POST a Meta Graph API /me/media (upload container)
      → Espera processing (polling o webhook)
      → POST a /me/media_publish
      → Guarda external_post_id
      
      TIKTOK:
      → POST a TikTok Content Posting API
      → Guarda external_post_id
      
   3. Actualiza post: status='published', published_at, external_post_id, external_url
   4. Actualiza content_task: status='published', published_at
   5. Notificación Telegram al admin: "✅ Publicado — [cliente] — [concepto]"
   6. En caso de error:
      → status='failed', failure_reason
      → Notificación urgente al admin
```

### Manejo de errores de publicación

- Reintento automático a los 15 minutos (máx 3 intentos)
- Tras 3 fallos: notificación urgente + status='failed'
- Log de todos los errores en tabla notifications

---

## MÓDULO 8 — Portal del cliente

### Ruta: `/cliente`

### Lo que el cliente puede ver y hacer

**Ver:**
- Contenido programado esta semana y próxima (con preview)
- Estado de cada pieza: en producción / aprobada / publicada
- Métricas básicas de la semana (reach, likes, seguidores ganados)
- Informe semanal PDF descargable
- Historial de publicaciones

**Hacer:**
- Subir fotos y vídeos propios al banco de assets
- Añadir eventos especiales del mes (con fecha y descripción)
- Ver y descargar facturas
- Dejar comentarios en contenido programado

**NO puede:**
- Ver otras cuentas de clientes
- Editar el brand brain directamente (solicita cambios al admin)
- Cancelar publicaciones programadas

---

## MÓDULO 9 — Analytics y retroalimentación

### n8n cron: lunes 8:00

```
Para cada cliente activo:
  1. Llama Meta Graph API: insights de todos los posts de la semana pasada
     → reach, impressions, likes, comments, shares, saves por post
  2. Guarda/actualiza en tabla posts (métricas)
  3. Calcula engagement_rate por post
  4. Identifica top_post (mayor reach o saves)
  5. Agrega métricas en weekly_reports
  6. Actualiza brand_brain.performance_learning:
     - top_performing.best_format (formato del post con más saves)
     - top_performing.best_time (hora del post con más reach)
     - avg_engagement_rate (media de la semana)
  7. Llama Claude API para generar:
     - ai_summary (párrafo narrativo del rendimiento)
     - ai_recommendations (qué hacer diferente la próxima semana)
  8. Genera PDF del informe
  9. Sube PDF a Drive (/reportes/)
  10. Guarda URL en weekly_reports.pdf_url
  11. Envía email al cliente con el PDF adjunto
  12. Marca weekly_reports.sent_to_client = true
```

---

## MÓDULO 10 — Gestión de reseñas

### n8n cron: diario 10:00

```
Para cada cliente con GMB activo:
  1. Llama Google My Business API: nuevas reseñas desde última comprobación
  2. Para cada reseña nueva:
     → Guarda en tabla reviews
     → Claude clasifica: sentimiento + urgencia
     → Claude genera 2 opciones de respuesta (en tono del brand brain)
     → Notificación al admin con la reseña y las opciones
  3. Admin selecciona opción (o edita) desde el panel
  4. n8n publica la respuesta via GMB API
  5. Actualiza reviews.status = 'responded'
```

---

## MÓDULO 11 — Banco de ideas con input humano

### Ruta: `/admin/ideas/human-input`

### Flujo de idea humana

```
Admin abre "Nueva idea humana"
→ Selecciona cliente
→ Escribe en campo libre: la idea en bruto, la historia, el ángulo
   Ejemplo: "Kenny me contó que abrió Nero en pandemia cuando todo el mundo le dijo que estaba loco"
→ Selecciona formato sugerido: Reel / Post / Story
→ Envía

Claude recibe:
  - Brand brain del cliente
  - El input humano en bruto
  - Instrucción: "Convierte esto en un guión estructurado manteniendo la autenticidad"

Claude genera:
  - Gancho de apertura (primeros 3 segundos)
  - Desarrollo (qué contar y cómo, sin ser un script rígido)
  - Cierre + CTA
  - Formato recomendado y duración
  - Notas para el grabador

Se guarda como content_idea con:
  - content_origin: 'human'
  - human_input: el texto original
  - full_description: el guión de Claude
```

### Banco de ideas descartadas

- Ideas descartadas no se eliminan
- Se pueden recuperar pasados 60 días (`can_recycle_after`)
- Filtro "Ideas reciclables" en la vista de ideas
