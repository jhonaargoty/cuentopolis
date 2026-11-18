import type { AudioTrigger, Story, StoryResource } from '../types/story'
import { getApiBaseUrl } from '../config/api'

interface ApiStory {
  id: number
  title: string
  description: string
  cover: string
  content: string
  audio_triggers?: unknown
  resources?: unknown
}

function parseAudioTriggers(value: unknown): AudioTrigger[] {
  let parsedValue = value

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const trigger = item as Record<string, unknown>
    if (
      !Array.isArray(trigger.words) ||
      !trigger.words.every((word) => typeof word === 'string') ||
      typeof trigger.audioUrl !== 'string'
    ) {
      return []
    }

    return [
      {
        words: trigger.words,
        audioUrl: trigger.audioUrl,
        enabled: trigger.enabled !== false,
      },
    ]
  })
}

function parseStoryResources(value: unknown): StoryResource[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const resource = item as Record<string, unknown>
    const page = resource.page
    const word = resource.word
    const audioUrl = resource.audioUrl ?? resource.audio_url

    if (
      typeof page !== 'number' ||
      !Number.isInteger(page) ||
      page < 0 ||
      typeof word !== 'string' ||
      !word.trim() ||
      typeof audioUrl !== 'string' ||
      !audioUrl.trim()
    ) {
      return []
    }

    return [{ page, word: word.trim(), audioUrl: audioUrl.trim() }]
  })
}

function isApiStory(value: unknown): value is ApiStory {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const story = value as Record<string, unknown>

  return (
    typeof story.id === 'number' &&
    typeof story.title === 'string' &&
    typeof story.description === 'string' &&
    typeof story.cover === 'string' &&
    typeof story.content === 'string'
  )
}

const DRIVE_IMAGE_HOSTS = [
  'lh3.googleusercontent.com',
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
]

function toCoverUrl(value: string, apiBaseUrl: string): string {
  if (/^(?:https?:)?\/\//i.test(value)) {
    const url = new URL(value, window.location.origin)

    if (DRIVE_IMAGE_HOSTS.includes(url.hostname)) {
      return `${apiBaseUrl}/api/image?src=${encodeURIComponent(url.toString())}`
    }

    return url.toString()
  }

  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${baseUrl}${value.replace(/^\/+/, '')}`
}

function toAudioUrl(value: string, apiBaseUrl: string): string {
  const audioUrl = new URL(value, `${apiBaseUrl}/`)
  const driveHosts = [
    'drive.google.com',
    'docs.google.com',
    'drive.usercontent.google.com',
  ]

  if (driveHosts.includes(audioUrl.hostname)) {
    const pathMatch = audioUrl.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    const fileId = audioUrl.searchParams.get('id') ?? pathMatch?.[1]

    if (fileId) {
      return `${apiBaseUrl}/api/audio?id=${encodeURIComponent(fileId)}`
    }
  }

  return audioUrl.toString()
}

function toStory(story: ApiStory): Story {
  const apiBaseUrl = getApiBaseUrl()

  return {
    id: story.id,
    title: story.title,
    description: story.description,
    content: story.content,
    cover: toCoverUrl(story.cover, apiBaseUrl),
    audioTriggers: parseAudioTriggers(story.audio_triggers).map((trigger) => ({
      ...trigger,
      audioUrl: toAudioUrl(trigger.audioUrl, apiBaseUrl),
    })),
    resources: parseStoryResources(story.resources).map((resource) => ({
      ...resource,
      audioUrl: toAudioUrl(resource.audioUrl, apiBaseUrl),
    })),
  }
}

interface StoriesCacheEntry {
  savedAt: number
  stories: Story[]
}

export const STORIES_CACHE_TTL_MS = 5 * 60 * 1000
const STORIES_CACHE_KEY = 'cuentopolis-stories-v1'

let storiesCache: StoriesCacheEntry | null = null
let isCacheLoaded = false

function isStoriesCacheEntry(value: unknown): value is StoriesCacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entry = value as Record<string, unknown>

  return (
    typeof entry.savedAt === 'number' &&
    Array.isArray(entry.stories) &&
    entry.stories.every(
      (story) =>
        typeof story === 'object' &&
        story !== null &&
        typeof (story as Record<string, unknown>).id === 'number' &&
        typeof (story as Record<string, unknown>).title === 'string',
    )
  )
}

function loadStoriesCache(): StoriesCacheEntry | null {
  if (isCacheLoaded) {
    return storiesCache
  }

  isCacheLoaded = true

  if (typeof sessionStorage === 'undefined') {
    return null
  }

  try {
    const rawValue = sessionStorage.getItem(STORIES_CACHE_KEY)
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : null

    if (isStoriesCacheEntry(parsedValue)) {
      storiesCache = parsedValue
    }
  } catch {
    storiesCache = null
  }

  return storiesCache
}

function saveStoriesCache(stories: Story[]): void {
  storiesCache = { savedAt: Date.now(), stories }
  isCacheLoaded = true

  if (typeof sessionStorage === 'undefined') {
    return
  }

  try {
    sessionStorage.setItem(STORIES_CACHE_KEY, JSON.stringify(storiesCache))
  } catch {
    // sessionStorage lleno o bloqueado: la caché en memoria sigue funcionando.
  }
}

/** Lista guardada (aunque esté vencida), para pintar el home sin esperar la red. */
export function getCachedStories(): Story[] | null {
  return loadStoriesCache()?.stories ?? null
}

function isStoriesCacheFresh(entry: StoriesCacheEntry): boolean {
  return Date.now() - entry.savedAt < STORIES_CACHE_TTL_MS
}

export async function getStories(
  options: { force?: boolean } = {},
): Promise<Story[]> {
  const cached = loadStoriesCache()

  if (cached && !options.force && isStoriesCacheFresh(cached)) {
    return cached.stories
  }

  const apiBaseUrl = getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/api/stories`)

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los cuentos (${response.status}).`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data) || !data.every(isApiStory)) {
    throw new Error('La respuesta de cuentos tiene un formato no válido.')
  }

  const stories = data.map(toStory)
  saveStoriesCache(stories)

  return stories
}