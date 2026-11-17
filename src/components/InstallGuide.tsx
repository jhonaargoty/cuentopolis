import { useState } from 'react'

const DISMISS_KEY = 'cuentopolis:install-guide-dismissed'

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

function getPlatform(): 'ios' | 'android' | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  const userAgent = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return 'ios'
  }

  if (/Android/i.test(userAgent)) {
    return 'android'
  }

  return null
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as NavigatorWithStandalone
  return (
    navigatorWithStandalone.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallGuide() {
  const [visible, setVisible] = useState(
    () => !isStandalone() && !isDismissed() && getPlatform() !== null,
  )
  const platform = getPlatform()

  if (!visible || !platform) {
    return null
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Sin persistencia, la guía se oculta en esta sesión.
    }

    setVisible(false)
  }

  return (
    <aside className="app-banner app-banner--install" aria-labelledby="install-title">
      <div className="app-banner__copy">
        <p className="eyebrow">Para leer mejor</p>
        <h2 id="install-title">Lleva Cuentópolis contigo</h2>
        <p>
          {platform === 'ios'
            ? 'Toca el botón Compartir y elige «Añadir a pantalla de inicio».'
            : 'Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».'}
        </p>
      </div>
      <button className="secondary-button" type="button" onClick={dismiss}>
        Entendido
      </button>
    </aside>
  )
}
