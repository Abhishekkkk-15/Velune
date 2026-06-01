export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

class AudioEngine {
  element: HTMLAudioElement | null = null
  context: AudioContext | null = null
  filters: BiquadFilterNode[] = []
  analyser: AnalyserNode | null = null
  sources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

  init() {
    if (this.context) return
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Analyser for the visualizer
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.82

    // 10-band EQ filters
    this.filters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = this.context!.createBiquadFilter()
      filter.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking'
      filter.frequency.value = freq
      filter.Q.value = 1.0
      filter.gain.value = 0
      return filter
    })

    // Filters in series
    this.filters.reduce((prev, curr) => { prev.connect(curr); return curr })

    // Last filter → analyser → speakers
    this.filters[this.filters.length - 1].connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  connectElement(el: HTMLAudioElement) {
    this.init()
    if (this.sources.has(el)) return
    const source = this.context!.createMediaElementSource(el)
    source.connect(this.filters[0])
    this.sources.set(el, source)
  }

  /** Returns frequency magnitude data (0–255) for all bins, or null before init. */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  setEqBand(index: number, gain: number) {
    if (this.filters[index]) this.filters[index].gain.value = gain
  }

  seek(time: number) {
    if (this.element) this.element.currentTime = time
  }

  get currentTime() { return this.element?.currentTime ?? 0 }
  get duration()    { return this.element?.duration    ?? 0 }
}

const engine = new AudioEngine()
export default engine
