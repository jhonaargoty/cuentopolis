import { useState } from 'react'

interface StoryCoverProps {
  src: string
  title: string
  className?: string
  onLoadSettled?: () => void
}

export function StoryCover({
  src,
  title,
  className = '',
  onLoadSettled,
}: StoryCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imageUnavailable = !src || failedSrc === src

  return (
    <div
      className={`story-cover${imageUnavailable ? ' story-cover--unavailable' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Portada de ${title}`}
    >
      {!imageUnavailable ? (
        <img
          className="story-cover__image"
          src={src}
          alt=""
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onLoad={onLoadSettled}
          onError={() => {
            setFailedSrc(src)
            onLoadSettled?.()
          }}
        />
      ) : null}
      {imageUnavailable ? (
        <span className="story-cover__fallback" aria-hidden="true" />
      ) : null}
    </div>
  )
}