'use client'

import { useEffect, useRef, useState } from 'react'

export function IsbnScanner({
  onDetected,
  onClose,
}: {
  onDetected: (isbn: string) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const scannerControls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current!,
          (result) => {
            const isbn = result?.getText().replace(/[-\s]/g, '')
            if (isbn && /^\d{10,13}$/.test(isbn)) {
              controls.current?.stop()
              controls.current = null
              onDetected(isbn)
            }
          },
        )
        if (disposed) scannerControls.stop()
        else controls.current = scannerControls
      } catch {
        if (!disposed)
          setError('Camera scanning is unavailable. Enter the ISBN instead.')
      }
    }

    void start()
    return () => {
      disposed = true
      controls.current?.stop()
      controls.current = null
    }
  }, [onDetected])

  function close() {
    controls.current?.stop()
    controls.current = null
    onClose()
  }

  return (
    <div id="isbn-scanner" className="space-y-4">
      <video
        ref={video}
        className="aspect-video w-full rounded-xl bg-black object-cover"
        muted
        playsInline
      />
      <p className="text-sm text-ink/60" role="status">
        Point the rear camera at an ISBN barcode.
      </p>
      {error && (
        <p className="text-sm text-rust" role="alert">
          {error}
        </p>
      )}
      <button
        className="button-secondary w-full"
        type="button"
        autoFocus
        onClick={close}
      >
        Close camera
      </button>
    </div>
  )
}
