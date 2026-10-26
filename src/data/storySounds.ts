import type { AudioTrigger } from '../types/story'

export interface PageSound {
  word: string
  audioUrl: string
}

export function normalizeWord(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
}

export function textContainsWord(text: string, word: string): boolean {
  const normalizedText = normalizeWord(text)
  const normalizedWord = normalizeWord(word).trim()

  if (!normalizedWord) {
    return false
  }

  const escapedWord = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapedWord}(?:$|[^\\p{L}\\p{N}_])`, 'u').test(
    normalizedText,
  )
}

export function getPageSounds(
  triggers: AudioTrigger[],
  pageText: string,
): PageSound[] {
  return triggers.flatMap((trigger) => {
    if (!trigger.enabled) {
      return []
    }

    return trigger.words
      .filter((word) => textContainsWord(pageText, word))
      .map((word) => ({ word, audioUrl: trigger.audioUrl }))
  })
}
