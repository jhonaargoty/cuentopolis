import type { Story } from '../types/story'
import { getApiBaseUrl } from '../config/api'

interface ApiStory {
  id: number
  title: string
  description: string
  cover: string
  content: string
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

function toStory(story: ApiStory): Story {
  return {
    ...story,
    cover: new URL(story.cover, `${getApiBaseUrl()}/`).toString(),
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