import { describe, expect, it } from 'vitest'
import {
  findLastSoundInText,
  getPageSounds,
  normalizeWord,
  textContainsWord,
} from './storySounds'
import type { AudioTrigger } from '../types/story'

const triggers: AudioTrigger[] = [
  {
    words: ['elefante', 'Tito'],
    audioUrl: 'https://example.com/elefante.m4a',
    enabled: true,
  },
  {
    words: ['río'],
    audioUrl: 'https://example.com/rio.m4a',
    enabled: true,
  },
  {
    words: ['rana'],
    audioUrl: 'https://example.com/rana.m4a',
    enabled: false,
  },
]

describe('storySounds', () => {
  it('normaliza mayúsculas y acentos', () => {
    expect(normalizeWord('RÍO')).toBe('rio')
    expect(normalizeWord('Elefante')).toBe('elefante')
  })

  it('detecta palabras completas sin confundir subcadenas', () => {
    expect(textContainsWord('El elefante camina.', 'elefante')).toBe(true)
    expect(textContainsWord('Los elefantes caminan.', 'elefante')).toBe(false)
    expect(textContainsWord('Un río de agua.', 'rio')).toBe(true)
  })

  it('devuelve los sonidos activos presentes en la página', () => {
    const sounds = getPageSounds(triggers, 'Tito vio un río con una rana.')

    expect(sounds.map((sound) => sound.word)).toEqual(['Tito', 'río'])
  })

  it('encuentra la última palabra mencionada en el texto', () => {
    const sounds = getPageSounds(triggers, 'Tito y el elefante llegaron al río.')
    const lastSound = findLastSoundInText('Tito y el elefante llegaron al río.', sounds)

    expect(lastSound?.word).toBe('río')
  })
})
