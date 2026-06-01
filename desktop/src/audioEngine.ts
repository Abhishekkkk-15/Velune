export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

class AudioEngine {
  element: HTMLAudioElement | null = null
  context: AudioContext | null = null
  filters: BiquadFilterNode[] = []
  sources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

  init() {
    if (this.context) return
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create 10-band EQ filters
    this.filters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = this.context!.createBiquadFilter()
      filter.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking'
      filter.frequency.value = freq
      filter.Q.value = 1.0
      filter.gain.value = 0
      return filter
    })

    // Connect filters in series
    this.filters.reduce((prev, curr) => {
      prev.connect(curr)
      return curr
    })
    
    // Connect last filter to destination
    this.filters[this.filters.length - 1].connect(this.context.destination)
  }

  connectElement(el: HTMLAudioElement) {
    this.init()
    if (this.sources.has(el)) return
    const source = this.context!.createMediaElementSource(el)
    source.connect(this.filters[0])
    this.sources.set(el, source)
  }

  setEqBand(index: number, gain: number) {
    if (this.filters[index]) {
      this.filters[index].gain.value = gain
    }
  }

  seek(time: number) {
    if (this.element) {
      this.element.currentTime = time
    }
  }

  get currentTime() {
    return this.element?.currentTime ?? 0
  }

  get duration() {
    return this.element?.duration ?? 0
  }
}

const engine = new AudioEngine()
export default engine
