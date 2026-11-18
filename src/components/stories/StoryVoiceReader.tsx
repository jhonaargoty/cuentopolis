import { useEffect, useRef, useState } from 'react'
import type { PageSound } from '../../data/storySounds'
import { findLastSoundInText } from '../../data/storySounds'
import { playAudio, stopCurrentAudio, unlockAudio } from '../../services/audioPlayback'
import { isDebugEnabled, recordMetric } from '../../services/perf'

interface StoryVoiceReaderProps {
  sounds: PageSound[]
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
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

const WORD_COOLDOWN_MS = 1500
const MIN_CONFIDENCE = 0.5

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
      return 'No detecté voz en este intento. La escucha continúa.'
    default:
      return 'No se pudo iniciar el reconocimiento. Inténtalo de nuevo.'
  }
}

function hasUsableConfidence(alternative: SpeechRecognitionAlternativeLike): boolean {
  return alternative.confidence === 0 || alternative.confidence >= MIN_CONFIDENCE
}

export function StoryVoiceReader({ sounds }: StoryVoiceReaderProps) {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(getRecognitionConstructor()),
  )
  const [isListening, setIsListening] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [statusMessage, setStatusMessage] = useState('La escucha aún no ha iniciado.')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastLatency, setLastLatency] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const isPlayingRef = useRef(false)
  const isMountedRef = useRef(true)
  const restartTimerRef = useRef<number | null>(null)
  const rapidRestartCountRef = useRef(0)
  const lastRestartAtRef = useRef(0)
  const sessionIdRef = useRef(0)
  const processedFinalRef = useRef<Set<string>>(new Set())
  const lastPlayedRef = useRef<{ word: string; at: number } | null>(null)
  const soundsRef = useRef(sounds)
  const debugEnabled = isDebugEnabled()

  useEffect(() => {
    soundsRef.current = sounds
  }, [sounds])

  function clearRestartTimer() {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }

  function stopListening() {
    shouldListenRef.current = false
    clearRestartTimer()
    stopCurrentAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    const recognition = recognitionRef.current
    recognitionRef.current = null

    try {
      recognition?.stop()
    } catch {
      // La sesión ya puede haber terminado en Safari.
    }

    if (isMountedRef.current) {
      setIsListening(false)
      setStatusMessage('Escucha detenida.')
    }
  }

  function startRecognition() {
    if (!shouldListenRef.current || isPlayingRef.current) {
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
    const sessionId = sessionIdRef.current + 1
    sessionIdRef.current = sessionId
    recognitionRef.current = recognition
    recognition.lang = 'es-CO'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    recognition.onstart = () => {
      if (!isMountedRef.current) {
        return
      }

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

      if (isMountedRef.current) {
        setRecognizedText(phrases.join(' '))
      }

      for (
        let index = speechEvent.resultIndex;
        index < speechEvent.results.length;
        index += 1
      ) {
        const result = speechEvent.results[index]
        const finalKey = `${sessionId}:${index}`

        if (result.isFinal && processedFinalRef.current.has(finalKey)) {
          continue
        }

        const detectedAt = performance.now()
        let matchedSound: PageSound | undefined

        for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
          const alternative = result[alternativeIndex]
          if (!alternative || !hasUsableConfidence(alternative)) {
            continue
          }

          const candidate = findLastSoundInText(
            alternative.transcript,
            soundsRef.current,
          )

          if (candidate) {
            matchedSound = candidate
            break
          }
        }

        if (result.isFinal) {
          processedFinalRef.current.add(finalKey)
        }

        if (!matchedSound) {
          continue
        }

        const lastPlayed = lastPlayedRef.current
        if (
          lastPlayed &&
          lastPlayed.word === matchedSound.word &&
          detectedAt - lastPlayed.at < WORD_COOLDOWN_MS
        ) {
          continue
        }

        lastPlayedRef.current = { word: matchedSound.word, at: detectedAt }
        rapidRestartCountRef.current = 0
        playSound(matchedSound, detectedAt)
      }
    }

    recognition.onerror = (event) => {
      const recognitionError = event as SpeechRecognitionErrorEventLike
      if (recognitionError.error === 'aborted' && !shouldListenRef.current) {
        return
      }

      if (isMountedRef.current) {
        setErrorMessage(describeRecognitionError(recognitionError.error))
      }

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
      if (isMountedRef.current) {
        setIsListening(false)
      }

      if (!shouldListenRef.current || isPlayingRef.current) {
        return
      }

      const now = performance.now()
      if (now - lastRestartAtRef.current < 1000) {
        rapidRestartCountRef.current += 1
      } else {
        rapidRestartCountRef.current = 0
      }
      lastRestartAtRef.current = now

      const delay = rapidRestartCountRef.current > 10 ? 1000 : 0
      if (delay > 0) {
        rapidRestartCountRef.current = 0
      }

      if (isMountedRef.current) {
        setStatusMessage(
          delay > 0
            ? 'Reanudando la escucha…'
            : 'La sesión terminó; reanudando la escucha…',
        )
      }

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        startRecognition()
      }, delay)
    }

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      shouldListenRef.current = false
      if (isMountedRef.current) {
        setIsListening(false)
        setErrorMessage('Safari no pudo abrir la sesión de voz. Toca Iniciar para intentarlo otra vez.')
      }
    }
  }

  function playSound(sound: PageSound, detectedAt: number) {
    isPlayingRef.current = true
    setIsPlaying(true)

    const recognition = recognitionRef.current
    recognitionRef.current = null
    try {
      recognition?.stop()
    } catch {
      // La sesión ya puede estar cerrada.
    }

    setErrorMessage(null)
    setStatusMessage(`Detecté «${sound.word}», reproduciendo su sonido…`)

    void playAudio(sound.audioUrl, () => {
      const latency = performance.now() - detectedAt
      recordMetric('transcript-to-audio', latency)
      if (isMountedRef.current) {
        setLastLatency(Math.round(latency))
      }
    })
      .then(() => {
        if (isMountedRef.current) {
          setStatusMessage(`Detecté «${sound.word}» y reproduje su sonido.`)
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setErrorMessage(
            `Detecté «${sound.word}», pero no se pudo reproducir el audio.`,
          )
        }
      })
      .finally(() => {
        isPlayingRef.current = false
        if (!isMountedRef.current) {
          return
        }

        setIsPlaying(false)
        if (shouldListenRef.current) {
          startRecognition()
        }
      })
  }

  async function handleStart() {
    if (!isSupported) {
      setErrorMessage('Este navegador no ofrece reconocimiento de voz.')
      return
    }

    setErrorMessage(null)
    setRecognizedText('')
    rapidRestartCountRef.current = 0
    shouldListenRef.current = true

    try {
      await unlockAudio()
    } catch {
      setErrorMessage('Safari bloqueó el audio. Toca Iniciar otra vez y permite el sonido.')
      shouldListenRef.current = false
      return
    }

    startRecognition()
  }

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      shouldListenRef.current = false
      clearRestartTimer()
      stopCurrentAudio()

      try {
        recognitionRef.current?.stop()
      } catch {
        // La sesión puede estar cerrada al desmontar.
      }
      recognitionRef.current = null
    }
  }, [])

  const canStart = isSupported && sounds.length > 0
  const isActive = isListening || isPlaying
  const hint = errorMessage
    ? { text: errorMessage, tone: 'error' as const }
    : !isSupported
      ? { text: 'Voz no soportada en este navegador.', tone: 'error' as const }
      : null

  return (
    <div className="voice-bar">
      <button
        className={`voice-bar__toggle${isActive ? ' is-active' : ''}`}
        type="button"
        onClick={isActive ? stopListening : () => void handleStart()}
        disabled={!canStart && !isActive}
        title={
          isActive
            ? 'Detener la escucha'
            : canStart
              ? 'Activar lectura con voz'
              : 'Esta página no tiene palabras con sonido'
        }
        aria-pressed={isActive}
      >
        <span
          className={`voice-bar__light${isListening ? ' is-listening' : ''}${isPlaying ? ' is-playing' : ''}`}
          aria-hidden="true"
        />
        <span className="voice-bar__label">
          {isActive ? 'Escuchando' : 'Activar voz'}
        </span>
      </button>

      <p
        className={`voice-bar__hint${hint ? ` is-${hint.tone}` : ''}`}
        role="status"
        aria-live="polite"
      >
        {hint?.text ?? ''}
      </p>

      {debugEnabled ? (
        <span className="voice-bar__debug">
          {lastLatency !== null ? `${lastLatency} ms` : '—'}
          {recognizedText ? ` · ${recognizedText.slice(-40)}` : ''}
          {statusMessage ? ` · ${statusMessage}` : ''}
        </span>
      ) : null}
    </div>
  )
}
