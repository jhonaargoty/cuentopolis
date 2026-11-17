import { getAudioBlob } from './audioCache'

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext
}

const audioBuffers = new Map<string, AudioBuffer>()
const inFlightBuffers = new Map<string, Promise<AudioBuffer>>()
let audioContext: AudioContext | null = null
let activeSource: AudioBufferSourceNode | null = null

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const audioWindow = window as AudioWindow
  if (typeof AudioContext !== 'undefined') {
    return AudioContext
  }

  return audioWindow.webkitAudioContext
}

function getAudioContext(): AudioContext {
  if (audioContext) {
    return audioContext
  }

  const AudioContextConstructor = getAudioContextConstructor()
  if (!AudioContextConstructor) {
    throw new Error('Este navegador no soporta Web Audio API.')
  }

  audioContext = new AudioContextConstructor()
  return audioContext
}

export async function unlockAudio(): Promise<void> {
  const context = getAudioContext()

  if (context.state === 'suspended') {
    await context.resume()
  }

  const silentBuffer = context.createBuffer(1, 1, context.sampleRate)
  const source = context.createBufferSource()
  source.buffer = silentBuffer
  source.connect(context.destination)
  source.start(0)
}

export function isAudioUnlocked(): boolean {
  return audioContext?.state === 'running'
}

export function loadAudioBuffer(audioUrl: string): Promise<AudioBuffer> {
  const decodedBuffer = audioBuffers.get(audioUrl)
  if (decodedBuffer) {
    return Promise.resolve(decodedBuffer)
  }

  const existingBuffer = inFlightBuffers.get(audioUrl)
  if (existingBuffer) {
    return existingBuffer
  }

  const bufferPromise = (async () => {
    const context = getAudioContext()
    const blob = await getAudioBlob(audioUrl)
    const arrayBuffer = await blob.arrayBuffer()

    return new Promise<AudioBuffer>((resolve, reject) => {
      context.decodeAudioData(arrayBuffer, resolve, reject)
    })
  })()
    .then((buffer) => {
      audioBuffers.set(audioUrl, buffer)
      return buffer
    })
    .finally(() => {
      inFlightBuffers.delete(audioUrl)
    })

  inFlightBuffers.set(audioUrl, bufferPromise)
  return bufferPromise
}

export function stopCurrentAudio(): void {
  if (!activeSource) {
    return
  }

  try {
    activeSource.stop()
  } catch {
    // La fuente ya puede haber terminado.
  }

  activeSource = null
}

export async function playAudio(
  audioUrl: string,
  onStarted?: () => void,
): Promise<void> {
  const context = getAudioContext()

  if (context.state === 'suspended') {
    await context.resume()
  }

  const buffer = await loadAudioBuffer(audioUrl)
  stopCurrentAudio()

  await new Promise<void>((resolve) => {
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.onended = () => {
      if (activeSource === source) {
        activeSource = null
      }
      resolve()
    }

    activeSource = source
    source.start(0)
    onStarted?.()
  })
}

export async function preloadAudioBuffers(
  audioUrls: string[],
  concurrency = 3,
): Promise<void> {
  const uniqueUrls = [...new Set(audioUrls)]
  let nextIndex = 0

  async function worker() {
    while (nextIndex < uniqueUrls.length) {
      const audioUrl = uniqueUrls[nextIndex]
      nextIndex += 1

      try {
        await loadAudioBuffer(audioUrl)
      } catch {
        // El lector reintentará al reproducir; no bloquea la preparación.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, () => worker()),
  )
}
