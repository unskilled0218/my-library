'use client'

import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '@/components/icons'
import { useLanguage } from '@/components/locale-provider'
import { searchMessages } from '@/lib/i18n/search'

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
  const messages = searchMessages[useLanguage()]

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
        if (!disposed) setError(messages.cameraUnavailable)
      }
    }

    void start()
    return () => {
      disposed = true
      controls.current?.stop()
      controls.current = null
    }
  }, [messages.cameraUnavailable, onDetected])

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
        {messages.cameraInstruction}
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
        aria-label={messages.closeCamera}
        onClick={close}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
