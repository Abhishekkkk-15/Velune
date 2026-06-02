/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare global {
  interface Window {
    electron: {
      getAppVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      minimizeWindow: () => Promise<void>
      maximizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      toggleMiniPlayer: (theme?: string) => Promise<boolean>
      resizeWidget: (width: number, height: number) => Promise<void>
      setThumbarButtons: (isPlaying: boolean) => void
      onMediaCommand: (cb: (cmd: string) => void) => void
      offMediaCommand: () => void
    }
  }
}
