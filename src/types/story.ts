export interface AudioTrigger {
  words: string[]
  audioUrl: string
  enabled: boolean
}

export interface Story {
  id: number
  title: string
  description: string
  cover: string
  content: string
  audioTriggers: AudioTrigger[]
}