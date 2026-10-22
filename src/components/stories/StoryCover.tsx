import { useState } from 'react'

interface StoryCoverProps {
  src: string
  title: string
  className?: string
}

export function StoryCover({ src, title, className = '' }: StoryCoverProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUnavailable = !src || hasImageError

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
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      ) : null}
      {imageUnavailable ? (
        <span className="story-cover__fallback" aria-hidden="true" />
      ) : null}
    </div>
  )
}