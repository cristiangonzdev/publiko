'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { TextInput, TextArea, SelectField, TagsInput, FieldRow } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

export function Step5Visual({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.visual_identity ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('visual_identity', debouncedState)
  }, [debouncedState, onSave])

  const colors = (state.colors as Record<string, unknown>) ?? {}
  const photo = (state.photo_style as Record<string, unknown>) ?? {}
  const music = (state.music_style as Record<string, unknown>) ?? {}
  const camera = (state.on_camera as Record<string, unknown>) ?? {}

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">5. Identidad visual</h2>
      <p className="text-sm text-ink-500">Guía para el grabador y el editor. Garantiza coherencia visual en todo el contenido.</p>

      <h3 className="text-sm font-semibold text-ink-700">Colores</h3>
      <FieldRow>
        <TextInput label="Color primario" placeholder="#1A1A1A o Negro mate" value={colors.primary as string ?? ''} onChange={(v) => update('colors', { ...colors, primary: v })} />
        <TextInput label="Color secundario" placeholder="#C9A84C o Dorado" value={colors.secondary as string ?? ''} onChange={(v) => update('colors', { ...colors, secondary: v })} />
      </FieldRow>
      <FieldRow>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Color acento</label>
          <p className="mb-2 text-[11px] text-ink-400">Se usa en textos superpuestos, CTAs y elementos destacados del vídeo</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={(colors.accent as string)?.startsWith('#') ? colors.accent as string : '#000000'}
              onChange={(e) => update('colors', { ...colors, accent: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-md border border-ink-200 p-0.5"
            />
            <input
              type="text"
              placeholder="#FF4500 o Naranja vibrante"
              value={colors.accent as string ?? ''}
              onChange={(e) => update('colors', { ...colors, accent: e.target.value })}
              className="flex-1 rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
        <TextInput label="Color de fondo" placeholder="Tonos oscuros y tierra" value={colors.background as string ?? ''} onChange={(v) => update('colors', { ...colors, background: v })} />
      </FieldRow>
      <TagsInput label="Colores a evitar" placeholder="Neón, Azul brillante…" value={colors.avoid as string[] ?? []} onChange={(v) => update('colors', { ...colors, avoid: v })} />

      <h3 className="text-sm font-semibold text-ink-700 pt-2">Fotografía</h3>
      <TextInput label="Mood / atmósfera" placeholder="Cálido, íntimo, con luz natural" value={photo.mood as string ?? ''} onChange={(v) => update('photo_style', { ...photo, mood: v })} />
      <FieldRow>
        <TextInput label="Iluminación" placeholder="Natural, golden hour" value={photo.lighting as string ?? ''} onChange={(v) => update('photo_style', { ...photo, lighting: v })} />
        <TextInput label="Color grade" placeholder="Tonos cálidos, ligeramente desaturados" value={photo.color_grade as string ?? ''} onChange={(v) => update('photo_style', { ...photo, color_grade: v })} />
      </FieldRow>
      <TagsInput label="Qué evitar en fotos" placeholder="Fondo blanco de estudio…" value={photo.avoid as string[] ?? []} onChange={(v) => update('photo_style', { ...photo, avoid: v })} />

      <h3 className="text-sm font-semibold text-ink-700 pt-2">Música para vídeos</h3>
      <FieldRow>
        <SelectField label="Energía" value={music.energy as string ?? 'calm'} options={['calm','moderate','energetic']} onChange={(v) => update('music_style', { ...music, energy: v })} />
        <TagsInput label="Estilos preferidos" placeholder="Jazz, Lo-fi, Acústico…" value={music.preferred as string[] ?? []} onChange={(v) => update('music_style', { ...music, preferred: v })} />
      </FieldRow>

      <h3 className="text-sm font-semibold text-ink-700 pt-2">¿Quién puede salir en cámara?</h3>
      <FieldRow>
        <div>
          <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={camera.owner_willing as boolean ?? false} onChange={(e) => update('on_camera', { ...camera, owner_willing: e.target.checked })} className="rounded" />
            El dueño/a quiere salir en cámara
          </label>
          {Boolean(camera.owner_willing) && (
            <TextInput label="Nombre del dueño/a" value={camera.owner_name as string ?? ''} onChange={(v) => update('on_camera', { ...camera, owner_name: v })} />
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={camera.staff_willing as boolean ?? false} onChange={(e) => update('on_camera', { ...camera, staff_willing: e.target.checked })} className="rounded" />
            El equipo puede salir en cámara
          </label>
        </div>
      </FieldRow>
      <TextArea label="¿Qué NO mostrar?" placeholder="No mostrar cocina en obras, no al encargado X…" value={Array.isArray(camera.avoid_showing) ? (camera.avoid_showing as string[]).join('\n') : ''} onChange={(v) => update('on_camera', { ...camera, avoid_showing: v.split('\n').filter(Boolean) })} />
    </div>
  )
}
