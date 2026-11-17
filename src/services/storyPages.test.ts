import { describe, expect, it } from 'vitest'
import { createStoryPageTexts, createStoryPages } from './storyPages'
import type { Story } from '../types/story'

const baseStory: Story = {
  id: 1,
  title: 'Cuento de prueba',
  description: 'Un cuento para probar las páginas.',
  cover: 'https://example.com/cover.jpg',
  content:
    'Había un elefante. El elefante vivía en la selva. Un día encontró un río. El río sonaba fuerte. Al final volvió a casa.',
  audioTriggers: [
    {
      words: ['elefante'],
      audioUrl: 'https://example.com/elefante.m4a',
      enabled: true,
    },
    {
      words: ['río'],
      audioUrl: 'https://example.com/rio.m4a',
      enabled: true,
    },
  ],
  resources: [],
}

describe('storyPages', () => {
  it('agrupa las frases de dos en dos', () => {
    const pages = createStoryPageTexts(baseStory.content)

    expect(pages).toHaveLength(3)
    expect(pages[0]).toBe('Había un elefante. El elefante vivía en la selva.')
    expect(pages[1]).toBe('Un día encontró un río. El río sonaba fuerte.')
  })

  it('usa los recursos guardados por página cuando existen', () => {
    const pages = createStoryPages({
      ...baseStory,
      resources: [
        {
          page: 0,
          word: 'elefante',
          audioUrl: 'https://example.com/guardado.m4a',
        },
        {
          page: 9,
          word: 'fuera',
          audioUrl: 'https://example.com/fuera.m4a',
        },
      ],
    })

    expect(pages[0].resources).toEqual([
      { word: 'elefante', audioUrl: 'https://example.com/guardado.m4a' },
    ])
    expect(pages[1].resources).toEqual([
      { word: 'río', audioUrl: 'https://example.com/rio.m4a' },
    ])
  })

  it('cae en los audioTriggers si la página no tiene recursos guardados', () => {
    const pages = createStoryPages(baseStory)

    expect(pages[0].resources.map((resource) => resource.word)).toEqual(['elefante'])
    expect(pages[1].resources.map((resource) => resource.word)).toEqual(['río'])
  })
})
