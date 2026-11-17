const audioUrlCache = new Map<string, Promise<string>>()

export function preloadAudio(audioUrl: string): Promise<string> {
  const cachedAudio = audioUrlCache.get(audioUrl)
  if (cachedAudio) {
    return cachedAudio
  }

  const audioPromise = fetch(audioUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo descargar el audio (${response.status}).`)
      }

      return response.blob()
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => {
      audioUrlCache.delete(audioUrl)
      return audioUrl
    })

  audioUrlCache.set(audioUrl, audioPromise)
  return audioPromise
}
