interface UpdateBannerProps {
  isReading: boolean
  onUpdate: () => void
}

export function UpdateBanner({ isReading, onUpdate }: UpdateBannerProps) {
  return (
    <aside className="app-banner app-banner--update" role="status" aria-live="polite">
      <div className="app-banner__copy">
        <p className="eyebrow">Versión nueva</p>
        <p>
          {isReading
            ? 'Hay una versión nueva. Vuelve a la biblioteca para actualizar sin interrumpir el cuento.'
            : 'Hay una versión nueva de Cuentópolis lista para instalar.'}
        </p>
      </div>
      {!isReading ? (
        <button className="primary-button" type="button" onClick={onUpdate}>
          Actualizar
        </button>
      ) : null}
    </aside>
  )
}
