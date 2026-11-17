import type { Story } from '../types/story'
import { createStoryPages, getStoryAudioUrls } from './storyPages'
import { primeAudioBlob } from './audioCache'

const STORY_CACHE_PREFIX = 'cuentopolis-story-'
const STORY_INDEX_KEY = 'cuentopolis:story-index:v1'
const MAX_CACHED_STORY_BYTES = 20 * 1024 * 1024
const DOWNLOAD_CONCURRENCY = 4
const DOWNLOAD_ATTEMPTS = 3

interface PreparationItem {
  kind: 'cover' | 'audio'
  url: string
}

interface StoryIndexEntry {
  hash: string
  cacheName: string
  complete: boolean
  updatedAt: number
}

interface StoryIndex {
  [storyId: string]: StoryIndexEntry
}

export interface StoryPreparationProgress {
  completed: number
  total: number
  loadedBytes: number
  totalBytes: number
  failedCount: number
}

export interface StoryPreparationResult extends StoryPreparationProgress {
  cacheName: string
  coverBlob: Blob | null
  failedUrls: string[]
  fromCache: boolean
}

export interface PrepareStoryOptions {
  onProgress?: (progress: StoryPreparationProgress) => void
}

function getCacheStorage(): CacheStorage | null {
  if (typeof caches === 'undefined') {
    return null
  }

  return caches
}

function readStoryIndex(): StoryIndex {
  try {
    const rawIndex = window.localStorage.getItem(STORY_INDEX_KEY)
    const parsedIndex: unknown = rawIndex ? JSON.parse(rawIndex) : {}

    if (typeof parsedIndex !== 'object' || parsedIndex === null) {
      return {}
    }

    return parsedIndex as StoryIndex
  } catch {
    return {}
  }
}

function writeStoryIndex(index: StoryIndex): void {
  try {
    window.localStorage.setItem(STORY_INDEX_KEY, JSON.stringify(index))
  } catch {
    // localStorage puede estar deshabilitado; la Cache API sigue funcionando.
  }
}

function hashString(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

export function getStoryHash(story: Story): string {
  return hashString(
    JSON.stringify({
      cover: story.cover,
      content: story.content,
      audioTriggers: story.audioTriggers,
      resources: story.resources,
    }),
  )
}

function getCacheName(story: Story, hash: string): string {
  return `${STORY_CACHE_PREFIX}${story.id}-${hash}`
}

function getPreparationItems(story: Story): PreparationItem[] {
  const pages = createStoryPages(story)
  const items: PreparationItem[] = []

  if (story.cover) {
    items.push({ kind: 'cover', url: story.cover })
  }

  for (const audioUrl of getStoryAudioUrls(story, pages)) {
    items.push({ kind: 'audio', url: audioUrl })
  }

  return items
}

async function openStoryCache(cacheName: string): Promise<Cache | null> {
  const cacheStorage = getCacheStorage()
  if (!cacheStorage) {
    return null
  }

  try {
    return await cacheStorage.open(cacheName)
  } catch {
    return null
  }
}

async function readCachedResponse(
  cache: Cache | null,
  item: PreparationItem,
): Promise<Response | null> {
  if (!cache) {
    return null
  }

  try {
    return (await cache.match(item.url)) ?? null
  } catch {
    return null
  }
}

async function readResponseWithProgress(
  response: Response,
  onBytes: (bytes: number) => void,
): Promise<Blob> {
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!response.body) {
    const blob = await response.blob()
    onBytes(blob.size)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: BlobPart[] = []

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    chunks.push(new Uint8Array(value))
    onBytes(value.byteLength)
  }

  return new Blob(chunks, { type: contentType })
}

async function downloadItem(
  cache: Cache | null,
  item: PreparationItem,
  onBytes: (bytes: number) => void,
): Promise<Blob> {
  const response = await fetch(item.url, {
    cache: 'reload',
    headers: {
      Accept: item.kind === 'audio' ? 'audio/*' : 'image/*',
    },
  })

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${item.url} (${response.status}).`)
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  if (item.kind === 'cover' && !contentType.startsWith('image/')) {
    throw new Error('La portada remota no es una imagen.')
  }

  const blob = await readResponseWithProgress(response, onBytes)

  if (cache) {
    try {
      await cache.put(
        item.url,
        new Response(blob, {
          headers: {
            'Content-Type': contentType || (item.kind === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
          },
        }),
      )
    } catch {
      // Si la cuota falla, mantenemos el blob en memoria para esta sesión.
    }
  }

  return blob
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

async function downloadWithRetries(
  cache: Cache | null,
  item: PreparationItem,
  onBytes: (bytes: number) => void,
): Promise<Blob> {
  let lastError: unknown

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await downloadItem(cache, item, onBytes)
    } catch (error) {
      lastError = error
      if (attempt < DOWNLOAD_ATTEMPTS) {
        await delay(400 * attempt)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No se pudo descargar ${item.url}.`)
}

export async function prepareStory(
  story: Story,
  options: PrepareStoryOptions = {},
): Promise<StoryPreparationResult> {
  const hash = getStoryHash(story)
  const cacheName = getCacheName(story, hash)
  const items = getPreparationItems(story)
  const index = readStoryIndex()
  const previousEntry = index[String(story.id)]

  if (previousEntry && previousEntry.cacheName !== cacheName) {
    const cacheStorage = getCacheStorage()
    try {
      await cacheStorage?.delete(previousEntry.cacheName)
    } catch {
      // La caché anterior se limpiará cuando el navegador necesite espacio.
    }
  }

  const cache = await openStoryCache(cacheName)
  const total = items.length
  let completed = 0
  let loadedBytes = 0
  let totalBytes = 0
  let failedCount = 0
  let coverBlob: Blob | null = null
  const failedUrls: string[] = []
  const pendingItems: PreparationItem[] = []

  for (const item of items) {
    const cachedResponse = await readCachedResponse(cache, item)

    if (!cachedResponse) {
      pendingItems.push(item)
      continue
    }

    try {
      const blob = await cachedResponse.blob()
      loadedBytes += blob.size
      totalBytes += blob.size
      completed += 1

      if (item.kind === 'cover') {
        coverBlob = blob
      } else {
        primeAudioBlob(item.url, blob)
      }
    } catch {
      pendingItems.push(item)
    }
  }

  const fromCache = pendingItems.length === 0
  const reportProgress = () => {
    options.onProgress?.({
      completed,
      total,
      loadedBytes,
      totalBytes,
      failedCount,
    })
  }

  reportProgress()

  let nextIndex = 0

  async function downloadWorker() {
    while (nextIndex < pendingItems.length) {
      const item = pendingItems[nextIndex]
      nextIndex += 1

      try {
        const blob = await downloadWithRetries(cache, item, (bytes) => {
          loadedBytes += bytes
          reportProgress()
        })

        totalBytes += blob.size
        completed += 1

        if (item.kind === 'cover') {
          coverBlob = blob
        } else {
          primeAudioBlob(item.url, blob)
        }
      } catch {
        failedCount += 1
        failedUrls.push(item.url)
        completed += 1
      }

      reportProgress()
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, pendingItems.length) },
      () => downloadWorker(),
    ),
  )

  const exceedsCacheLimit = loadedBytes > MAX_CACHED_STORY_BYTES
  if (exceedsCacheLimit && cache) {
    const cacheStorage = getCacheStorage()
    try {
      await cacheStorage?.delete(cacheName)
    } catch {
      // Sin caché persistente; se volverá a descargar en la próxima visita.
    }
  }

  index[String(story.id)] = {
    hash,
    cacheName,
    complete: failedCount === 0 && !exceedsCacheLimit,
    updatedAt: Date.now(),
  }
  writeStoryIndex(index)

  return {
    cacheName,
    completed,
    total,
    loadedBytes,
    totalBytes,
    failedCount,
    failedUrls,
    coverBlob,
    fromCache,
  }
}
