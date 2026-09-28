'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function IsbnScanner() {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => controls.current?.stop(), [])

  async function start() {
    setError('')
    setActive(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      controls.current = await reader.decodeFromVideoDevice(
        undefined,
        video.current!,
        (result) => {
          const isbn = result?.getText().replace(/[-\s]/g, '')
          if (isbn && /^\d{10,13}$/.test(isbn)) {
            controls.current?.stop()
            setActive(false)
            router.push(`?q=${encodeURIComponent(isbn)}`)
          }
        },
      )
    } catch {
      setError('Camera scanning is unavailable. Enter the ISBN below.')
      setActive(false)
    }
  }

  function stop() {
    controls.current?.stop()
    controls.current = null
    setActive(false)
  }

  return (
    <div className="rounded-2xl bg-ink/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Scan an ISBN barcode</p>
          <p className="text-xs text-ink/60">
            Camera access starts only when requested.
          </p>
        </div>
        {active ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" onClick={start}>
            Open camera
          </button>
        )}
      </div>
      {active && (
        <video
          ref={video}
          className="mt-4 aspect-video w-full rounded-xl bg-black object-cover"
          muted
          playsInline
        />
      )}
      {error && (
        <p className="mt-3 text-sm text-rust" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
