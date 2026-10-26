import type { AudioTrigger, Story } from '../types/story'
import { getApiBaseUrl } from '../config/api'

interface ApiStory {
  id: number
  title: string
  description: string
  cover: string
  content: string
  audio_triggers?: unknown
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
    cover: new URL(story.cover, `${apiBaseUrl}/`).toString(),
    audioTriggers: parseAudioTriggers(story.audio_triggers).map((trigger) => ({
      ...trigger,
      audioUrl: toAudioUrl(trigger.audioUrl, apiBaseUrl),
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