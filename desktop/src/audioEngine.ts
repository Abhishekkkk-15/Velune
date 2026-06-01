const engine = {
  element: null as HTMLAudioElement | null,

  seek(time: number) {
    if (this.element) {
      this.element.currentTime = time
    }
  },

  get currentTime() {
    return this.element?.currentTime ?? 0
  },

  get duration() {
    return this.element?.duration ?? 0
  },
}

export default engine
