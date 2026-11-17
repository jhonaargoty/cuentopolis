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

export async function getStories(): Promise<Story[]> {
  const apiBaseUrl = getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/api/stories`)

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los cuentos (${response.status}).`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data) || !data.every(isApiStory)) {
    throw new Error('La respuesta de cuentos tiene un formato no válido.')
  }

  return data.map(toStory)
}