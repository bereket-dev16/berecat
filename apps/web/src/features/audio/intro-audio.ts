export const INTRO_AUDIO_VOLUME = 0.35

const INTRO_AUDIO_SOURCE = '/audio/berecat-intro.mp3'

let introAudio: HTMLAudioElement | null = null

function safelyRun(action: () => void): void {
  try {
    action()
  } catch {
    // Audio failures must never affect authentication or navigation.
  }
}

function safelyPlay(audio: HTMLAudioElement): void {
  try {
    const playback = audio.play()

    void playback?.catch(() => undefined)
  } catch {
    // Some browsers can throw synchronously before returning a Promise.
  }
}

function getIntroAudio(): HTMLAudioElement | null {
  if (
    typeof window === 'undefined' ||
    typeof Audio === 'undefined'
  ) {
    return null
  }

  if (introAudio) {
    return introAudio
  }

  try {
    const audio = new Audio(INTRO_AUDIO_SOURCE)

    audio.preload = 'auto'
    audio.loop = false
    audio.volume = INTRO_AUDIO_VOLUME
    audio.muted = true
    introAudio = audio

    return audio
  } catch {
    return null
  }
}

export function prepareIntroAudio(): void {
  const audio = getIntroAudio()

  if (!audio) {
    return
  }

  safelyRun(() => {
    audio.currentTime = 0
  })
  safelyRun(() => {
    audio.muted = true
  })
  safelyRun(() => {
    audio.volume = INTRO_AUDIO_VOLUME
  })
  safelyPlay(audio)
}

export function playIntroAudio(): void {
  const audio = getIntroAudio()

  if (!audio) {
    return
  }

  safelyRun(() => {
    audio.currentTime = 0
  })
  safelyRun(() => {
    audio.muted = false
  })
  safelyRun(() => {
    audio.volume = INTRO_AUDIO_VOLUME
  })
  safelyPlay(audio)
}

export function stopIntroAudio(): void {
  if (!introAudio) {
    return
  }

  safelyRun(() => {
    introAudio?.pause()
  })
  safelyRun(() => {
    if (introAudio) {
      introAudio.currentTime = 0
    }
  })
  safelyRun(() => {
    if (introAudio) {
      introAudio.muted = true
    }
  })
  safelyRun(() => {
    if (introAudio) {
      introAudio.volume = INTRO_AUDIO_VOLUME
    }
  })
}
