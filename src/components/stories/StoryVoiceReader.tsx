import { useEffect, useRef, useState } from 'react'
import type { PageSound } from '../../data/storySounds'
import { textContainsWord } from '../../data/storySounds'

interface StoryVoiceReaderProps {
  sounds: PageSound[]
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  readonly results: {
    readonly length: number
    readonly [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike
}

function getRecognitionConstructor(): SpeechRecognitionConstructorLike | undefined {
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function describeRecognitionError(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No hay permiso para usar el micrófono. Revisa los permisos del sitio en Safari.'
    case 'audio-capture':
      return 'No se encontró un micrófono disponible.'
    case 'network':
      return 'El servicio de reconocimiento no está disponible. Comprueba la conexión.'
    case 'no-speech':
      return 'No detecté voz en este intento. Puedes seguir escuchando o iniciar de nuevo.'
    default:
      return 'No se pudo iniciar el reconocimiento. Inténtalo de nuevo.'
  }
}

export function StoryVoiceReader({ sounds }: StoryVoiceReaderProps) {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(getRecognitionConstructor()),
  )
  const [isListening, setIsListening] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [statusMessage, setStatusMessage] = useState('La escucha aún no ha iniciado.')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const restartAttemptsRef = useRef(0)
  const restartTimerRef = useRef<number | null>(null)
  const processedResultIndexesRef = useRef<Set<number>>(new Set())
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const soundsRef = useRef(sounds)

  useEffect(() => {
    soundsRef.current = sounds
  }, [sounds])

  function stopListening() {
    shouldListenRef.current = false
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }

    const recognition = recognitionRef.current
    recognitionRef.current = null
    try {
      recognition?.stop()
    } catch {
      // The recognition session may already have ended in Safari.
    }

    setIsListening(false)
    setStatusMessage('Escucha detenida.')
  }

  function playSound(sound: PageSound) {
    const audio = audioRefs.current[sound.word]
    if (!audio) {
      setErrorMessage(`No se encontró el audio de «${sound.word}».`)
      return
    }

    audio.currentTime = 0
    void audio.play().then(
      () => setStatusMessage(`Detecté «${sound.word}» y reproduje su sonido.`),
      () =>
        setErrorMessage(
          `Detecté «${sound.word}», pero Safari bloqueó la reproducción del audio.`,
        ),
    )
  }

  function startRecognition() {
    if (!shouldListenRef.current) {
      return
    }

    const RecognitionConstructor = getRecognitionConstructor()
    if (!RecognitionConstructor) {
      setErrorMessage('Este navegador no ofrece reconocimiento de voz.')
      shouldListenRef.current = false
      setIsListening(false)
      return
    }

    const recognition = new RecognitionConstructor()
    recognitionRef.current = recognition
    processedResultIndexesRef.current.clear()
    recognition.lang = 'es-CO'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setErrorMessage(null)
      setStatusMessage('Escuchando en español…')
    }

    recognition.onresult = (event) => {
      const speechEvent = event as SpeechRecognitionEventLike
      const phrases: string[] = []

      for (let index = 0; index < speechEvent.results.length; index += 1) {
        const result = speechEvent.results[index]
        const phrase = result[0]?.transcript.trim() ?? ''
        if (phrase) {
          phrases.push(phrase)
        }
      }

      setRecognizedText(phrases.join(' '))

      for (
        let index = speechEvent.resultIndex;
        index < speechEvent.results.length;
        index += 1
      ) {
        const result = speechEvent.results[index]
        if (!result.isFinal || processedResultIndexesRef.current.has(index)) {
          continue
        }

        processedResultIndexesRef.current.add(index)
        restartAttemptsRef.current = 0
        const transcript = result[0]?.transcript ?? ''
        const matchedSound = soundsRef.current.find((sound) =>
          textContainsWord(transcript, sound.word),
        )

        if (matchedSound) {
          playSound(matchedSound)
        }
      }
    }

    recognition.onerror = (event) => {
      const recognitionError = event as SpeechRecognitionErrorEventLike
      if (recognitionError.error === 'aborted' && !shouldListenRef.current) {
        return
      }

      const message = describeRecognitionError(recognitionError.error)
      setErrorMessage(message)

      if (
        recognitionError.error === 'not-allowed' ||
        recognitionError.error === 'service-not-allowed' ||
        recognitionError.error === 'audio-capture'
      ) {
        shouldListenRef.current = false
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) {
        return
      }
      recognitionRef.current = null
      setIsListening(false)

      if (!shouldListenRef.current) {
        return
      }

      if (restartAttemptsRef.current >= 3) {
        shouldListenRef.current = false
        setStatusMessage('La sesión se cerró varias veces. Toca Iniciar para volver a escuchar.')
        return
      }

      restartAttemptsRef.current += 1
      const delay = 350 * 2 ** (restartAttemptsRef.current - 1)
      setStatusMessage('La sesión terminó; intentando reanudar la escucha…')
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        startRecognition()
      }, delay)
    }

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      shouldListenRef.current = false
      setErrorMessage('Safari no pudo abrir la sesión de voz. Toca Iniciar para intentarlo otra vez.')
    }
  }

  function handleStart() {
    if (!isSupported) {
      setErrorMessage('Este navegador no ofrece reconocimiento de voz.')
      return
    }

    setErrorMessage(null)
    setRecognizedText('')
    restartAttemptsRef.current = 0
    shouldListenRef.current = true
    startRecognition()
  }

  useEffect(() => () => {
    shouldListenRef.current = false
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
    }
    try {
      recognitionRef.current?.stop()
    } catch {
      // The session can already be closed when the reader unmounts.
    }
  }, [])

  const words = sounds.map((sound) => `«${sound.word}»`).join(' o ')

  return (
    <section className="voice-test" aria-labelledby="voice-test-title">
      <div className="voice-test__heading">
        <p className="eyebrow">Prueba de voz</p>
        <h2 id="voice-test-title">
          {sounds.length > 0 ? `Di ${words}` : 'Sin sonidos en esta página'}
        </h2>
        <p>
          {sounds.length > 0
            ? 'Al reconocer la palabra completa, escucharás su audio.'
            : 'Esta página todavía no tiene palabras con sonido.'}
        </p>
      </div>

      <div className="voice-test__controls">
        <button
          className="primary-button"
          type="button"
          onClick={handleStart}
          disabled={!isSupported || isListening || sounds.length === 0}
        >
          Iniciar escucha
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={stopListening}
          disabled={!isListening}
        >
          Detener
        </button>
      </div>

      <p className="voice-test__status" role="status" aria-live="polite">
        {isSupported ? statusMessage : 'Reconocimiento de voz no soportado en este navegador.'}
      </p>
      <p className="voice-test__transcript" aria-live="polite" aria-atomic="true">
        <span>Texto reconocido:</span> {recognizedText || '—'}
      </p>
      {errorMessage ? <p className="voice-test__error" role="alert">{errorMessage}</p> : null}
      {sounds.map((sound) => (
        <audio
          key={sound.word}
          ref={(element) => {
            audioRefs.current[sound.word] = element
          }}
          src={sound.audioUrl}
          preload="auto"
          playsInline
          {...{ referrerPolicy: 'no-referrer' }}
        />
      ))}
    </section>
  )
}