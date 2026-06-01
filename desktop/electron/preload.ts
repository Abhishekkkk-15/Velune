import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  toggleMiniPlayer: () => ipcRenderer.invoke('toggle-mini-player'),
  setThumbarButtons: (isPlaying: boolean) => ipcRenderer.send('set-thumbar-buttons', { isPlaying }),
  onMediaCommand: (callback: (cmd: string) => void) => {
    ipcRenderer.on('media-command', (_event, cmd) => callback(cmd))
  },
  offMediaCommand: () => {
    ipcRenderer.removeAllListeners('media-command')
  }
}

contextBridge.exposeInMainWorld('electron', api)

export type ElectronAPI = typeof api
