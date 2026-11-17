const AUDIO_CACHE_NAME = 'cuentopolis-audio-v1'
const blobCache = new Map<string, Blob>()
const inFlightDownloads = new Map<string, Promise<Blob>>()

function getCacheStorage(): CacheStorage | null {
  if (typeof caches === 'undefined') {
    return null
  }

  return caches
}

async function getCachedBlob(audioUrl: string): Promise<Blob | null> {
  const cacheStorage = getCacheStorage()
  if (!cacheStorage) {
    return null
  }

  try {
    const response = await cacheStorage.match(audioUrl)
    return response ? response.blob() : null
  } catch {
    return null
  }
}

async function storeBlob(audioUrl: string, blob: Blob): Promise<void> {
  const cacheStorage = getCacheStorage()
  if (!cacheStorage) {
    return
  }

  try {
    const cache = await cacheStorage.open(AUDIO_CACHE_NAME)
    await cache.put(audioUrl, new Response(blob))
  } catch {
    // Safari en modo privado puede rechazar Cache API; seguimos con memoria.
  }
}

export function primeAudioBlob(audioUrl: string, blob: Blob): void {
  blobCache.set(audioUrl, blob)
}

export function getAudioBlob(audioUrl: string): Promise<Blob> {
  const cachedBlob = blobCache.get(audioUrl)
  if (cachedBlob) {
    return Promise.resolve(cachedBlob)
  }

  const existingDownload = inFlightDownloads.get(audioUrl)
  if (existingDownload) {
    return existingDownload
  }

  const download = (async () => {
    const cached = await getCachedBlob(audioUrl)
    if (cached) {
      blobCache.set(audioUrl, cached)
      return cached
    }

    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`No se pudo descargar el audio (${response.status}).`)
    }

    const blob = await response.blob()
    blobCache.set(audioUrl, blob)
    void storeBlob(audioUrl, blob)
    return blob
  })().finally(() => {
    inFlightDownloads.delete(audioUrl)
  })

  inFlightDownloads.set(audioUrl, download)
  return download
}

export function hasAudioBlob(audioUrl: string): boolean {
  return blobCache.has(audioUrl)
}
