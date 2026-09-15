import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockAudioElement {
  src: string
  preload: string
  loop: boolean
  volume: number
  muted: boolean
  currentTime: number
  play: ReturnType<typeof vi.fn<() => Promise<void>>>
  pause: ReturnType<typeof vi.fn<() => void>>
}

function installAudioMock() {
  const constructorSpy = vi.fn<(source: string) => void>()
  const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const pause = vi.fn<() => void>()
  const instances: MockAudioElement[] = []

  class AudioMock implements MockAudioElement {
    src: string
    preload = ''
    loop = true
    volume = 1
    muted = false
    currentTime = 12
    play = play
    pause = pause

    constructor(source: string) {
      this.src = source
      constructorSpy(source)
      instances.push(this)
    }
  }

  vi.stubGlobal('Audio', AudioMock)

  return { constructorSpy, instances, pause, play }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('intro audio servisi', () => {
  it('import sırasında Audio oluşturmaz ve stop çağrısı da oluşturmayı tetiklemez', async () => {
    const audioMock = installAudioMock()
    const { stopIntroAudio } = await import('./intro-audio')

    expect(audioMock.constructorSpy).not.toHaveBeenCalled()

    stopIntroAudio()

    expect(audioMock.constructorSpy).not.toHaveBeenCalled()
  })

  it('manuel login hazırlığında sesi muted olarak baştan başlatır', async () => {
    const audioMock = installAudioMock()
    const { INTRO_AUDIO_VOLUME, prepareIntroAudio } = await import(
      './intro-audio'
    )

    prepareIntroAudio()

    expect(audioMock.constructorSpy).toHaveBeenCalledWith(
      '/audio/berecat-intro.mp3',
    )
    expect(audioMock.instances).toHaveLength(1)
    expect(audioMock.instances[0]).toMatchObject({
      currentTime: 0,
      loop: false,
      muted: true,
      preload: 'auto',
      volume: INTRO_AUDIO_VOLUME,
    })
    expect(INTRO_AUDIO_VOLUME).toBe(0.35)
    expect(audioMock.play).toHaveBeenCalledTimes(1)
  })

  it('başarılı login sonrasında aynı sesi baştan ve duyulabilir oynatır', async () => {
    const audioMock = installAudioMock()
    const { INTRO_AUDIO_VOLUME, playIntroAudio, prepareIntroAudio } =
      await import('./intro-audio')

    prepareIntroAudio()
    audioMock.instances[0].currentTime = 8
    playIntroAudio()

    expect(audioMock.instances).toHaveLength(1)
    expect(audioMock.instances[0]).toMatchObject({
      currentTime: 0,
      loop: false,
      muted: false,
      volume: INTRO_AUDIO_VOLUME,
    })
    expect(audioMock.play).toHaveBeenCalledTimes(2)
  })

  it('başarısız login veya logout için sesi durdurup başlangıca alır', async () => {
    const audioMock = installAudioMock()
    const { prepareIntroAudio, stopIntroAudio } = await import('./intro-audio')

    prepareIntroAudio()
    audioMock.instances[0].muted = false
    audioMock.instances[0].currentTime = 6
    stopIntroAudio()

    expect(audioMock.pause).toHaveBeenCalledTimes(1)
    expect(audioMock.instances[0]).toMatchObject({
      currentTime: 0,
      muted: true,
      volume: 0.35,
    })
  })

  it('play Promise rejection veya senkron hata üretirse dışarı hata taşımaz', async () => {
    const audioMock = installAudioMock()
    const { playIntroAudio, prepareIntroAudio } = await import('./intro-audio')

    audioMock.play.mockRejectedValueOnce(new Error('Oynatma engellendi.'))
    expect(() => prepareIntroAudio()).not.toThrow()

    await Promise.resolve()

    audioMock.play.mockImplementationOnce(() => {
      throw new Error('Senkron oynatma hatası.')
    })
    expect(() => playIntroAudio()).not.toThrow()
  })
})
