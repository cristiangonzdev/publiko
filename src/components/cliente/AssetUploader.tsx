'use client'

import { useRef, useState } from 'react'

interface Props {
  clientId: string
}

export function AssetUploader({ clientId }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    setUploading(true)
    let count = 0
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('client_id', clientId)
      form.append('category', 'client_upload')

      try {
        const res = await fetch('/api/upload/asset', { method: 'POST', body: form })
        if (res.ok) count++
      } catch {
        // skip on error
      }
    }
    setUploaded(count)
    setUploading(false)
    if (count > 0) window.location.reload()
  }

  return (
    <div className="mt-4">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div
        className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 px-8 py-10 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
        }}
      >
        {uploading ? (
          <p className="text-sm text-ink-600">Subiendo… {uploaded} subidos</p>
        ) : (
          <>
            <p className="text-sm font-medium text-ink-700">Arrastra archivos aquí o haz clic para subir</p>
            <p className="mt-1 text-xs text-ink-400">Fotos y vídeos. Máx. 100 MB por archivo.</p>
          </>
        )}
      </div>
    </div>
  )
}
