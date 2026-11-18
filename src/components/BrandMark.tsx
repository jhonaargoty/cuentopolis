interface BrandMarkProps {
  className?: string
}

const brandMarkSrc = `${import.meta.env.BASE_URL}favicon-96x96.png`

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      className={className}
      src={brandMarkSrc}
      alt=""
      width={32}
      height={32}
      decoding="async"
    />
  )
}
