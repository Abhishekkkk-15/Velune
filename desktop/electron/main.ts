import { app, BrowserWindow, ipcMain, shell, nativeTheme, session } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let apiProcess: ChildProcess | null = null

const DEV_PORT = 5000
const isDev = !app.isPackaged

function startApiServer() {
  if (isDev) {
    console.log('[API] Dev mode: relying on external API server started by concurrently')
    return
  }

  const serverScript = path.join(__dirname, '..', 'server', 'index.js')
  const cmd = 'node'
  const args = [serverScript]

  apiProcess = spawn(cmd, args, {
    stdio: 'pipe',
    env: { ...process.env },
    shell: process.platform === 'win32',
  })
  apiProcess.stdout?.on('data', (d: Buffer) => console.log('[API]', d.toString().trim()))
  apiProcess.stderr?.on('data', (d: Buffer) => console.error('[API ERR]', d.toString().trim()))
  apiProcess.on('exit', (code: number | null) => console.log(`[API] exited with code ${code}`))
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${DEV_PORT}`)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }: { url: string }) => {
    shell.openExternal(targetUrl)
    return { action: 'deny' as const }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.googlevideo.com/*', 'https://*.youtube.com/*'] },
    (details, callback) => {
      console.log(`[WebRequest Interceptor] Intercepted URL: ${details.url}`)
      details.requestHeaders['Referer'] = 'https://www.youtube.com/'
      delete details.requestHeaders['Origin']
      console.log(`[WebRequest Interceptor] Modified Request Headers:`, details.requestHeaders)
      callback({ cancel: false, requestHeaders: details.requestHeaders })
    }
  )

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.googlevideo.com/*', 'https://*.youtube.com/*'] },
    (details, callback) => {
      console.log(`[WebRequest Interceptor] Response URL: ${details.url} | Status: ${details.statusCode}`)
      callback({ cancel: false, responseHeaders: details.responseHeaders })
    }
  )

  startApiServer()
  setTimeout(createWindow, 1500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill()
    apiProcess = null
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)
ipcMain.handle('open-external', (_event: any, url: string) => shell.openExternal(url))
ipcMain.handle('minimize-window', () => mainWindow?.minimize())
ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('close-window', () => mainWindow?.close())
