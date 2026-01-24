import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import crypto from 'crypto'
import http from 'http'
import url from 'url'

// Variables globales
let mainWindow = null
let tray = null
let httpServer = null
const HTTP_PORT = 8765

// Estado de la extensión
let extensionConnections = new Set()
let lastExtensionActivity = null
let extensionStats = {
  totalConnections: 0,
  activeConnections: 0,
  lastConnection: null,
  formsDetected: 0,
  formsFilled: 0
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 810,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Prevenir que la ventana se cierre, en su lugar ocultarla
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray() {
  // Crear el tray con el icono de la aplicación
  tray = new Tray(icon)
  
  // Crear el menú contextual
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Cerrar',
      click: () => {
        app.isQuiting = true
        app.quit()
      }
    }
  ])
  
  // Configurar el tray
  tray.setToolTip('Account Manager')
  tray.setContextMenu(contextMenu)
  
  // Hacer doble click para mostrar/ocultar la ventana
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// Crear servidor HTTP para comunicación con la extensión de Chrome
function createHttpServer() {
  httpServer = http.createServer((req, res) => {
    // Configurar CORS para permitir requests desde la extensión
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', 'application/json')

    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // Trackear actividad de extensión
    const clientId = req.headers['x-client-id'] || `${req.connection.remoteAddress}-${Date.now()}`
    lastExtensionActivity = new Date()
    
    if (!extensionConnections.has(clientId)) {
      extensionConnections.add(clientId)
      extensionStats.totalConnections++
      extensionStats.lastConnection = new Date()
    }
    extensionStats.activeConnections = extensionConnections.size

    const parsedUrl = url.parse(req.url, true)
    const pathname = parsedUrl.pathname

    try {
      if (req.method === 'GET' && pathname === '/status') {
        // Endpoint para verificar estado de la aplicación
        res.writeHead(200)
        res.end(JSON.stringify({
          success: true,
          status: 'running',
          version: app.getVersion(),
          vaultLocked: !currentProfile || !vaultKeys.has(currentProfile),
          extensionConnected: true,
          timestamp: new Date().toISOString()
        }))

      } else if (req.method === 'POST' && pathname === '/form-data') {
        // Endpoint para obtener datos de formularios
        let body = ''
        req.on('data', chunk => {
          body += chunk.toString()
        })
        
        req.on('end', async () => {
          try {
            const requestData = JSON.parse(body)
            console.log(`[Extension] Request: /form-data (Status: ${!currentProfile || !vaultKeys.has(currentProfile) ? 'LOCKED' : 'UNLOCKED'})`)
            const formData = await getFormDataForExtension(requestData)
            
            res.writeHead(200)
            res.end(JSON.stringify({
              success: true,
              data: formData
            }))
          } catch (error) {
            console.error('Error procesando datos de formulario:', error)
            res.writeHead(500)
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }))
          }
        })

      } else if (req.method === 'POST' && pathname === '/save-form') {
        // Endpoint para guardar datos de formularios
        let body = ''
        req.on('data', chunk => {
          body += chunk.toString()
        })
        
        req.on('end', async () => {
          try {
            const requestData = JSON.parse(body)
            await saveFormDataFromExtension(requestData)
            
            res.writeHead(200)
            res.end(JSON.stringify({
              success: true,
              message: 'Datos guardados correctamente'
            }))
          } catch (error) {
            console.error('Error guardando datos de formulario:', error)
            res.writeHead(500)
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }))
          }
        })

      } else if (req.method === 'POST' && pathname === '/save-password-settings') {
        // Endpoint para guardar ajustes de contraseña desde la extensión
        let body = ''
        req.on('data', chunk => {
          body += chunk.toString()
        })
        
        req.on('end', async () => {
          try {
            const settings = JSON.parse(body)
            setData('passwordSettings', settings)
            
            // Notificar al renderer de la app que los ajustes cambiaron
            if (mainWindow) {
              mainWindow.webContents.send('storage:updated', { key: 'passwordSettings' })
            }
            
            res.writeHead(200)
            res.end(JSON.stringify({
              success: true,
              message: 'Ajustes de contraseña guardados'
            }))
          } catch (error) {
            console.error('Error guardando ajustes de contraseña:', error)
            res.writeHead(500)
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }))
          }
        })

      } else if (req.method === 'POST' && pathname === '/show-app') {
        // Endpoint para mostrar la aplicación
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
          mainWindow.setAlwaysOnTop(true)
          mainWindow.setAlwaysOnTop(false)
        }
        
        res.writeHead(200)
        res.end(JSON.stringify({
          success: true,
          message: 'Aplicación mostrada'
        }))

      } else {
        // Endpoint no encontrado
        res.writeHead(404)
        res.end(JSON.stringify({
          success: false,
          error: 'Endpoint no encontrado'
        }))
      }
    } catch (error) {
      console.error('Error en servidor HTTP:', error)
      res.writeHead(500)
      res.end(JSON.stringify({
        success: false,
        error: 'Error interno del servidor'
      }))
    }
  })

  httpServer.listen(HTTP_PORT, 'localhost', () => {
    console.log(`Servidor HTTP para extensión ejecutándose en http://localhost:${HTTP_PORT}`)
  })

  httpServer.on('error', (error) => {
    console.error('Error en servidor HTTP:', error)
  })
}

// Función para obtener datos de formularios para la extensión
async function getFormDataForExtension(requestData) {
  // Verificar que el vault esté desbloqueado
  if (!currentProfile || !vaultKeys.has(currentProfile)) {
    throw new Error('Vault bloqueado. Por favor, desbloquea la aplicación primero.')
  }

  // Obtener datos del perfil actual
  const profileData = {
    personal: {},
    email: {},
    address: {}
  }

  try {
    const autoFormData = getData('autoFormData') || {}
    console.log('Extension requesting data. Found autoFormData:', autoFormData)
    
    // Obtener datos de email
    profileData.emails = autoFormData.email || []
    
    // Obtener otros datos si es necesario
    profileData.addresses = autoFormData.address || []
    profileData.personal = autoFormData.personal?.[0] || {}
    profileData.creditCards = autoFormData.creditCard || []
    profileData.passwordSettings = getData('passwordSettings') || {}
    profileData.usernameSettings = getData('usernameSettings') || {}

    // Add accounts and projects for search
    try {
      const projects = getData('projects') || []
      const accounts = getData('accounts') || []
      
      // Map project names for easier search display
      const projectMap = projects.reduce((acc, p) => {
        acc[p.id] = p.name
        return acc
      }, {})

      profileData.searchData = accounts
        .filter(a => !a.deletedAt)
        .map(a => ({
          ...a,
          projectName: projectMap[a.projectId] || 'Unknown Project'
        }))
    } catch (e) {
      console.error('Error attaching accounts to extension data:', e)
      profileData.searchData = []
    }

    return profileData
  } catch (error) {
    console.error('Error obteniendo datos para extensión:', error)
    throw new Error('Error al obtener datos del perfil')
  }
}

// Función para guardar datos de formularios desde la extensión
async function saveFormDataFromExtension(requestData) {
  // Verificar que el vault esté desbloqueado
  if (!currentProfile || !vaultKeys.has(currentProfile)) {
    throw new Error('Vault bloqueado. Por favor, desbloquea la aplicación primero.')
  }

  try {
    const { formData, url, formType } = requestData

    // Guardar según el tipo de formulario detectado
    if (formType === 'email' && formData.email) {
      const existingEmails = getData('autoform_email') || []
      const newEmail = {
        id: Date.now().toString(),
        name: formData.name || 'Perfil desde extensión',
        email: formData.email
      }
      
      // Verificar si el email ya existe
      const emailExists = existingEmails.some(e => e.email === newEmail.email)
      if (!emailExists) {
        existingEmails.push(newEmail)
        setData('autoform_email', existingEmails)
      }
    }

    if (formType === 'address' && (formData.street || formData.city)) {
      const existingAddresses = getData('autoform_address') || []
      const newAddress = {
        id: Date.now().toString(),
        name: 'Dirección desde extensión',
        street: formData.street || '',
        city: formData.city || '',
        state: formData.state || '',
        zipCode: formData.zipCode || '',
        country: formData.country || ''
      }
      
      existingAddresses.push(newAddress)
      setData('autoform_address', existingAddresses)
    }

    if (formType === 'personal' && (formData.name || formData.firstName)) {
      const existingPersonal = getData('autoform_personal') || {}
      const updatedPersonal = {
        ...existingPersonal,
        name: formData.name || existingPersonal.name,
        firstName: formData.firstName || existingPersonal.firstName,
        lastName: formData.lastName || existingPersonal.lastName,
        phone: formData.phone || existingPersonal.phone
      }
      
      setData('autoform_personal', updatedPersonal)
    }

    console.log('Datos guardados desde extensión:', { formType, url })
  } catch (error) {
    console.error('Error guardando datos desde extensión:', error)
    throw new Error('Error al guardar datos del formulario')
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()
  createTray()
  createHttpServer()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// No cerrar la aplicación cuando se cierran todas las ventanas
// La aplicación seguirá corriendo en el tray
app.on('window-all-closed', () => {
  // No hacer nada, mantener la app corriendo en el tray
  // Solo cerrar si se llama explícitamente a quit
})

// Limpiar el tray antes de cerrar la aplicación
app.on('before-quit', () => {
  app.isQuiting = true
  if (tray) {
    tray.destroy()
  }
  if (httpServer) {
    httpServer.close()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
import path from 'path'
import Database from 'better-sqlite3'

const dbFolder = 'C:/AccountManager'
// ensure folders exist
try {
  fs.mkdirSync(dbFolder, { recursive: true })
} catch {}
const dbPath = path.join(dbFolder, 'config')
const db = new Database(dbPath)

try {
  db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`)
} catch (error) {}

// Vault state (in-memory)
let vaultKeys = new Map() // profileId -> Buffer
let currentProfile = 'default' // string id

function getCurrentProfile() {
  try {
    const row = db
      .prepare(`SELECT value FROM app_storage WHERE key = 'vault_current_profile'`)
      .get()
    const id = row ? JSON.parse(row.value) : null
    return typeof id === 'string' && id.length > 0 ? id : 'default'
  } catch {
    return 'default'
  }
}

function setCurrentProfile(id) {
  currentProfile = id || 'default'
  db.prepare(
    `
    INSERT INTO app_storage (key, value)
    VALUES ('vault_current_profile', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(JSON.stringify(currentProfile))
  // Notify renderer that current profile changed
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send('storage:updated', { key: 'vault_current_profile' })
  )
}

currentProfile = getCurrentProfile()

function isEncryptedEnvelope(obj) {
  return obj && typeof obj === 'object' && obj.__enc__ === true && obj.alg === 'aes-256-gcm'
}

function deriveKey(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64')
  return crypto.scryptSync(password, salt, 32)
}

function encryptText(plainText, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    __enc__: true,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    data: enc.toString('base64'),
    tag: tag.toString('base64')
  }
}

function decryptText(envelope, key) {
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const data = Buffer.from(envelope.data, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

function isReservedKey(key) {
  return (
    key === 'vault_meta' ||
    key.startsWith('vault_meta:') ||
    key === 'vault_profiles' ||
    key === 'vault_current_profile' ||
    key === 'vault_stats'
  )
}

function nsKey(key) {
  if (isReservedKey(key)) return key
  return `p:${currentProfile}:${key}`
}

function setData(key, value) {
  // Bypass encryption for vault meta
  if (
    key === 'vault_meta' ||
    key.startsWith('vault_meta:') ||
    key === 'vault_profiles' ||
    key === 'vault_current_profile'
  ) {
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(key, JSON.stringify(value))
    return
  }
  const effectiveKey = nsKey(key)
  const raw = JSON.stringify(value)
  const k = vaultKeys.get(currentProfile)
  const toStore = k ? JSON.stringify(encryptText(raw, k)) : raw
  db.prepare(
    `
    INSERT INTO app_storage (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(effectiveKey, toStore)
  
  // Update vault stats for projects and accounts
  if (key === 'projects' || key === 'accounts') {
    try {
      const projectsKey = nsKey('projects')
      const accountsKey = nsKey('accounts')
      
      let projectCount = 0
      let accountCount = 0
      
      if (key === 'projects') {
        projectCount = Array.isArray(value) ? value.length : 0
        // Get current accounts count
        const accountsRow = db.prepare(`SELECT value FROM app_storage WHERE key = ?`).get(accountsKey)
        if (accountsRow) {
          try {
            const accountsData = k ? JSON.parse(decryptText(JSON.parse(accountsRow.value), k)) : JSON.parse(accountsRow.value)
            const accounts = JSON.parse(accountsData)
            accountCount = Array.isArray(accounts) ? accounts.filter(a => !a.deletedAt).length : 0
          } catch {}
        }
      } else if (key === 'accounts') {
        accountCount = Array.isArray(value) ? value.filter(a => !a.deletedAt).length : 0
        // Get current projects count
        const projectsRow = db.prepare(`SELECT value FROM app_storage WHERE key = ?`).get(projectsKey)
        if (projectsRow) {
          try {
            const projectsData = k ? JSON.parse(decryptText(JSON.parse(projectsRow.value), k)) : JSON.parse(projectsRow.value)
            const projects = JSON.parse(projectsData)
            projectCount = Array.isArray(projects) ? projects.length : 0
          } catch {}
        }
      }
      
      updateVaultStats(currentProfile, projectCount, accountCount)
    } catch (error) {
      console.error('Error updating vault stats in setData:', error)
    }
  }
}
function getData(key) {
  const effectiveKey = nsKey(key)
  const row = db.prepare(`SELECT value FROM app_storage WHERE key = ?`).get(effectiveKey)
  if (!row) return null
  if (isReservedKey(key)) {
    try {
      return JSON.parse(row.value)
    } catch {
      return null
    }
  }
  // Try parse value; decrypt if envelope
  let parsed
  try {
    parsed = JSON.parse(row.value)
  } catch {
    // unexpected raw string
    return null
  }
  if (isEncryptedEnvelope(parsed)) {
    const k = vaultKeys.get(currentProfile)
    if (!k) return null
    try {
      const plain = decryptText(parsed, k)
      return JSON.parse(plain)
    } catch (err) {
      console.error('Vault decrypt error:', err)
      return null
    }
  }
  return parsed
}
function deleteData(key) {
  const effectiveKey = nsKey(key)
  db.prepare(`DELETE FROM app_storage WHERE key = ?`).run(effectiveKey)
}

ipcMain.handle('localStorage', async (e, { event, data }) => {
  console.log('LocalStorage: ', event, data)
  switch (event) {
    case 'set':
      setData(data.key, data.value)
      // broadcast update
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('storage:updated', { key: data.key })
      )
      break
    case 'get':
      return getData(data.key)
    case 'delete':
      deleteData(data.key)
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('storage:updated', { key: data.key })
      )
      break
  }
})

// App info
ipcMain.handle('app:getVersion', async () => {
  return app.getVersion()
})

// Handler para obtener estado de la extensión
ipcMain.handle('extension:getStatus', async () => {
  const now = new Date()
  const isConnected = lastExtensionActivity && (now - lastExtensionActivity) < 30000 // 30 segundos
  
  return {
    connected: isConnected,
    lastActivity: lastExtensionActivity,
    stats: extensionStats,
    serverRunning: httpServer && httpServer.listening,
    serverPort: HTTP_PORT
  }
})

// Window controls IPC handlers
ipcMain.handle('window:minimize', async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (win) win.minimize()
})

ipcMain.handle('window:isMaximized', async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  return win ? win.isMaximized() : false
})

ipcMain.handle('window:toggleMaximize', async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

ipcMain.handle('window:close', async () => {
  // En lugar de cerrar, ocultar la ventana al tray
  if (mainWindow) {
    mainWindow.hide()
  }
})

ipcMain.handle('links:openExternal', async (_e, url) => {
  if (typeof url === 'string' && url.length > 0) {
    await shell.openExternal(url)
  }
})

// Vault IPC handlers
function readVaultMeta(profileId = currentProfile) {
  try {
    const key = `vault_meta:${profileId}`
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = ?`).get(key)
    return row ? JSON.parse(row.value) : null
  } catch {
    return null
  }
}
function writeVaultMeta(meta, profileId = currentProfile) {
  const key = `vault_meta:${profileId}`
  db.prepare(
    `
    INSERT INTO app_storage (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(key, JSON.stringify(meta))
}

function updateVaultStats(profileId, projectCount, accountCount) {
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_stats'`).get()
    const stats = row ? JSON.parse(row.value) : {}
    stats[profileId] = { projectCount, accountCount, lastUpdated: Date.now() }
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_stats', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(stats))
  } catch (error) {
    console.error('Error updating vault stats:', error)
  }
}

function getVaultStats() {
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_stats'`).get()
    return row ? JSON.parse(row.value) : {}
  } catch (error) {
    console.error('Error getting vault stats:', error)
    return {}
  }
}

function removeVaultStats(profileId) {
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_stats'`).get()
    const stats = row ? JSON.parse(row.value) : {}
    delete stats[profileId]
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_stats', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(stats))
  } catch (error) {
    console.error('Error removing vault stats:', error)
  }
}

function encryptAllExisting(profileId = currentProfile) {
  const prefix = `p:${profileId}:`
  const rows = db.prepare(`SELECT key, value FROM app_storage WHERE key LIKE ?`).all(`${prefix}%`)
  const k = vaultKeys.get(profileId)
  for (const row of rows) {
    // if already envelope, skip
    let parsed
    try {
      parsed = JSON.parse(row.value)
    } catch {
      continue
    }
    if (isEncryptedEnvelope(parsed)) continue
    const raw = row.value // plain JSON string of the value
    const envelope = encryptText(raw, k)
    db.prepare(`UPDATE app_storage SET value = ? WHERE key = ?`).run(
      JSON.stringify(envelope),
      row.key
    )
  }
}

// Re-encrypt all existing data for a profile from oldKey to newKey
function reEncryptAllExisting(profileId, oldKey, newKey) {
  const prefix = `p:${profileId}:`
  const rows = db.prepare(`SELECT key, value FROM app_storage WHERE key LIKE ?`).all(`${prefix}%`)
  for (const row of rows) {
    let parsed
    try {
      parsed = JSON.parse(row.value)
    } catch {
      // if value isn't valid JSON, skip
      continue
    }
    if (isEncryptedEnvelope(parsed)) {
      // decrypt with oldKey then re-encrypt with newKey
      try {
        const plain = decryptText(parsed, oldKey)
        const envelope = encryptText(plain, newKey)
        db.prepare(`UPDATE app_storage SET value = ? WHERE key = ?`).run(
          JSON.stringify(envelope),
          row.key
        )
      } catch (err) {
        // if decryption fails for a row, skip to avoid data loss
        console.error('Re-encrypt failed for key', row.key, err)
      }
    } else {
      // plaintext -> encrypt with newKey
      const envelope = encryptText(row.value, newKey)
      db.prepare(`UPDATE app_storage SET value = ? WHERE key = ?`).run(
        JSON.stringify(envelope),
        row.key
      )
    }
  }
}

// Migration: move un-namespaced app keys into default profile namespace
function migrateToProfiles() {
  const legacyKeys = ['projects', 'accounts', 'notes', 'passwordSettings', 'usernameSettings']
  for (const k of legacyKeys) {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = ?`).get(k)
    if (!row) continue
    // move to namespaced key
    const ns = `p:default:${k}`
    // if destination already exists, skip move
    const exists = db.prepare(`SELECT 1 FROM app_storage WHERE key = ?`).get(ns)
    if (!exists) {
      db.prepare(
        `
        INSERT INTO app_storage (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
      ).run(ns, row.value)
    }
    // delete legacy
    db.prepare(`DELETE FROM app_storage WHERE key = ?`).run(k)
  }
}

ipcMain.handle('vault:status', async () => {
  const profRow = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
  const profiles = profRow ? JSON.parse(profRow.value) : []
  const cur = getCurrentProfile()
  const meta = readVaultMeta(cur)
  const locked = !vaultKeys.get(cur)
  return { hasVault: !!meta, locked, currentProfile: cur, profiles }
})

ipcMain.handle('vault:setup', async (_e, { password, profileName }) => {
  if (typeof password !== 'string' || password.trim().length < 6) {
    return { ok: false, error: 'Contraseña demasiado corta' }
  }
  // create profile if needed
  const cur = getCurrentProfile()
  let profiles = []
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
    profiles = row ? JSON.parse(row.value) : []
  } catch {}
  let targetId = cur || 'default'
  if (!profiles.find((p) => p.id === targetId)) {
    let name =
      typeof profileName === 'string' && profileName.trim().length > 0
        ? profileName.trim()
        : 'Cuenta por defecto'
    if (name.length > 20) {
      return { ok: false, error: 'El nombre debe tener máximo 20 caracteres' }
    }
    profiles.push({ id: targetId, name, createdAt: Date.now() })
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_profiles', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(profiles))
  }
  // migration of legacy keys into default namespace
  if (targetId === 'default') migrateToProfiles()
  const salt = crypto.randomBytes(16).toString('base64')
  const derived = deriveKey(password, salt)
  vaultKeys.set(targetId, derived)
  // store verifier encrypted with the new key
  const verifier = encryptText('vault_ok', derived)
  writeVaultMeta({ salt, verifier }, targetId)
  encryptAllExisting(targetId)
  setCurrentProfile(targetId)
  // Notify renderer profiles list updated
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send('storage:updated', { key: 'vault_profiles' })
  )
  return { ok: true, profileId: targetId }
})

ipcMain.handle('vault:unlock', async (_e, { password, profileId }) => {
  const targetId =
    typeof profileId === 'string' && profileId.length > 0 ? profileId : getCurrentProfile()
  const meta = readVaultMeta(targetId)
  if (!meta?.salt || !meta?.verifier) {
    return { ok: false, error: 'Vault no configurado' }
  }
  try {
    const key = deriveKey(password, meta.salt)
    const plain = decryptText(meta.verifier, key)
    if (plain !== 'vault_ok') {
      return { ok: false, error: 'Contraseña incorrecta' }
    }
    vaultKeys.set(targetId, key)
    setCurrentProfile(targetId)
    return { ok: true, profileId: targetId }
  } catch (err) {
    console.error('vault:unlock error', err)
    return { ok: false, error: 'Desbloqueo falló' }
  }
})

ipcMain.handle('vault:lock', async () => {
  const cur = getCurrentProfile()
  vaultKeys.delete(cur)
  return { ok: true }
})

// Profiles management
ipcMain.handle('vault:profiles:list', async () => {
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
    const profiles = row ? JSON.parse(row.value) : []
    const cur = getCurrentProfile()
    return { ok: true, profiles, currentProfile: cur }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Update profile name/note
ipcMain.handle('vault:profiles:update', async (_e, { id, name, note }) => {
  try {
    if (typeof id !== 'string' || id.length === 0) return { ok: false, error: 'ID inválido' }
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
    const profiles = row ? JSON.parse(row.value) : []
    const idx = profiles.findIndex((p) => p.id === id)
    if (idx < 0) return { ok: false, error: 'Cuenta no encontrada' }
    const current = profiles[idx]
    const next = { ...current }
    if (typeof name === 'string') {
      const trimmed = name.trim()
      if (trimmed.length > 20) {
        return { ok: false, error: 'El nombre debe tener máximo 20 caracteres' }
      }
      next.name = trimmed || current.name
    }
    if (typeof note === 'string') next.note = note
    profiles[idx] = next
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_profiles', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(profiles))
    // Notify renderer profiles list updated
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send('storage:updated', { key: 'vault_profiles' })
    )
    return { ok: true, profile: next }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Change master password for a profile
ipcMain.handle('vault:password:change', async (_e, { oldPassword, newPassword, profileId }) => {
  try {
    const targetId =
      typeof profileId === 'string' && profileId.length > 0 ? profileId : getCurrentProfile()
    const meta = readVaultMeta(targetId)
    if (!meta?.salt || !meta?.verifier) {
      return { ok: false, error: 'Cuenta no configurada' }
    }
    if (typeof oldPassword !== 'string' || oldPassword.trim().length === 0) {
      return { ok: false, error: 'Ingresa la contraseña actual' }
    }
    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return { ok: false, error: 'La nueva contraseña es demasiado corta' }
    }
    // verify old password
    let oldKey
    try {
      oldKey = deriveKey(oldPassword, meta.salt)
      const plain = decryptText(meta.verifier, oldKey)
      if (plain !== 'vault_ok') {
        return { ok: false, error: 'Contraseña actual incorrecta' }
      }
    } catch (err) {
      return { ok: false, error: 'Verificación fallida' }
    }
    // derive new key with fresh salt
    const newSalt = crypto.randomBytes(16).toString('base64')
    const newKey = deriveKey(newPassword, newSalt)
    // re-encrypt all existing data
    reEncryptAllExisting(targetId, oldKey, newKey)
    // store new verifier and update key in memory
    vaultKeys.set(targetId, newKey)
    const verifier = encryptText('vault_ok', newKey)
    writeVaultMeta({ salt: newSalt, verifier }, targetId)
    return { ok: true }
  } catch (err) {
    console.error('vault:password:change error', err)
    return { ok: false, error: 'No se pudo cambiar la contraseña' }
  }
})

ipcMain.handle('vault:profiles:create', async (_e, { name, id }) => {
  const profNameRaw = (name || '').trim()
  if (profNameRaw.length > 20) {
    return { ok: false, error: 'El nombre debe tener máximo 20 caracteres' }
  }
  const profName = profNameRaw || 'Nueva cuenta'
  const profId = (id || '').trim() || `p${Date.now().toString(36)}`
  try {
    const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
    const profiles = row ? JSON.parse(row.value) : []
    if (profiles.find((p) => p.id === profId)) {
      return { ok: false, error: 'ID de cuenta ya existe' }
    }
    profiles.push({ id: profId, name: profName, createdAt: Date.now() })
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_profiles', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(profiles))
    // set selected profile
    setCurrentProfile(profId)
    // Notify renderer profiles list updated
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send('storage:updated', { key: 'vault_profiles' })
    )
    return { ok: true, profileId: profId }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('vault:profiles:select', async (_e, { id }) => {
  if (typeof id !== 'string' || id.length === 0) return { ok: false, error: 'ID inválido' }
  setCurrentProfile(id)
  return { ok: true }
})

ipcMain.handle('vault:profiles:delete', async (_e, { id, password }) => {
  try {
    if (typeof id !== 'string' || id.length === 0) return { ok: false, error: 'ID inválido' }
    if (typeof password !== 'string' || password.length === 0) {
      return { ok: false, error: 'Ingresa la contraseña' }
    }
    const meta = readVaultMeta(id)
    if (!meta?.salt || !meta?.verifier) {
      return { ok: false, error: 'Cuenta no configurada o inválida' }
    }
    // verify password against verifier
    let verified = false
    try {
      const key = deriveKey(password, meta.salt)
      const plain = decryptText(meta.verifier, key)
      verified = plain === 'vault_ok'
    } catch {}
    if (!verified) return { ok: false, error: 'Contraseña incorrecta' }

    // remove vault meta for this profile
    db.prepare(`DELETE FROM app_storage WHERE key = ?`).run(`vault_meta:${id}`)

    // remove all namespaced keys for this profile
    const prefix = `p:${id}:`
    db.prepare(`DELETE FROM app_storage WHERE key LIKE ?`).run(`${prefix}%`)

    // update profiles list
    let profiles = []
    try {
      const row = db.prepare(`SELECT value FROM app_storage WHERE key = 'vault_profiles'`).get()
      profiles = row ? JSON.parse(row.value) : []
    } catch {}
    profiles = profiles.filter((p) => p.id !== id)
    db.prepare(
      `
      INSERT INTO app_storage (key, value)
      VALUES ('vault_profiles', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(JSON.stringify(profiles))
    // Notify renderer profiles list updated
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send('storage:updated', { key: 'vault_profiles' })
    )

    // remove vault stats
    removeVaultStats(id)

    // clear key from memory
    vaultKeys.delete(id)

    // adjust current profile
    let nextProfile = null
    if (profiles.length > 0) {
      nextProfile = profiles[0].id
      setCurrentProfile(nextProfile)
    } else {
      // no profiles left -> clear current
      setCurrentProfile('default')
    }
    return { ok: true, nextProfileId: nextProfile, remaining: profiles.length }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('vault:stats:get', async () => {
  try {
    const stats = getVaultStats()
    return { ok: true, stats }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('vault:stats:update', async (_e, { profileId, projectCount, accountCount }) => {
  try {
    updateVaultStats(profileId, projectCount, accountCount)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// App helpers
ipcMain.handle('app:reload', async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.reload()
    return { ok: true }
  }
  return { ok: false, error: 'Sin ventana' }
})

// Attachments handling
const attachmentsFolder = path.join(app.getPath('userData'), 'attachments')
try {
  fs.mkdirSync(attachmentsFolder, { recursive: true })
} catch {}

ipcMain.handle('attachments:choose', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Selecciona archivo para adjuntar',
    properties: ['openFile'],
    filters: [
      { name: 'Todos', extensions: ['*'] },
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
      { name: 'Documentos', extensions: ['pdf', 'txt', 'md', 'docx', 'xlsx', 'csv'] }
    ]
  })
  if (res.canceled || !res.filePaths?.[0]) return null
  return res.filePaths[0]
})

ipcMain.handle('attachments:save', async (_e, { sourcePath }) => {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null
  const base = path.basename(sourcePath)
  const safeBase = base.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeBase}`
  const destPath = path.join(attachmentsFolder, unique)
  fs.copyFileSync(sourcePath, destPath)
  return { path: destPath, filename: safeBase }
})

// Export handlers
ipcMain.handle('export:csv', async (_e, { filenameHint = 'export', content }) => {
  if (typeof content !== 'string') return { ok: false, error: 'Invalid content' }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar CSV',
    defaultPath: `${filenameHint}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  fs.writeFileSync(filePath, content, 'utf-8')
  return { ok: true, filePath }
})

ipcMain.handle('export:pdf', async (_e, { filenameHint = 'export', html }) => {
  try {
    const hidden = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await hidden.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html || '<html><body></body></html>')}`
    )
    const pdfBuffer = await hidden.webContents.printToPDF({})
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar PDF',
      defaultPath: `${filenameHint}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    fs.writeFileSync(filePath, pdfBuffer)
    hidden.destroy()
    return { ok: true, filePath }
  } catch (err) {
    console.error('export:pdf error', err)
    return { ok: false, error: String(err) }
  }
})

// ===== Legacy import (C:\AccountManager\Category) =====
const LEGACY_ROOT = path.normalize('C:\\AccountManager\\Category')

ipcMain.handle('import:scanLegacy', async () => {
  try {
    const exists = fs.existsSync(LEGACY_ROOT)
    if (!exists) return { exists: false, path: LEGACY_ROOT, folders: [], hasContent: false }
    const entries = fs.readdirSync(LEGACY_ROOT, { withFileTypes: true })
    const folders = entries
      .filter((d) => d.isDirectory())
      .map((d) => {
        const folderPath = path.join(LEGACY_ROOT, d.name)
        let fileCount = 0
        try {
          const inner = fs.readdirSync(folderPath, { withFileTypes: true })
          fileCount = inner
            .filter((f) => f.isFile())
            .filter((f) => path.extname(f.name).toLowerCase() === '.accountmanager').length
        } catch {}
        return { name: d.name, path: folderPath, fileCount }
      })
      .filter((f) => f.fileCount > 0)
    return { exists: true, path: LEGACY_ROOT, folders, hasContent: folders.length > 0 }
  } catch (err) {
    return {
      exists: false,
      path: LEGACY_ROOT,
      folders: [],
      hasContent: false,
      error: String(err?.message || err)
    }
  }
})

ipcMain.handle('import:openLegacyFolder', async () => {
  try {
    if (!fs.existsSync(LEGACY_ROOT)) return false
    await shell.openPath(LEGACY_ROOT)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('import:executeLegacy', async (_e, { profileId }) => {
  try {
    if (!fs.existsSync(LEGACY_ROOT)) return { ok: false, error: 'not-found' }
    const prevProfile = currentProfile
    const target = profileId || prevProfile || getCurrentProfile()
    currentProfile = target

    const now = Date.now()
    const existingProjects = Array.isArray(getData('projects')) ? getData('projects') : []
    const existingAccounts = Array.isArray(getData('accounts')) ? getData('accounts') : []

    const entries = fs.readdirSync(LEGACY_ROOT, { withFileTypes: true })
    let projectsAdded = 0
    let accountsAdded = 0

    for (const dirent of entries) {
      if (!dirent.isDirectory()) continue
      const folderPath = path.join(LEGACY_ROOT, dirent.name)
      let inner
      try {
        inner = fs.readdirSync(folderPath, { withFileTypes: true })
      } catch {
        continue
      }
      const files = inner
        .filter((f) => f.isFile())
        .filter((f) => path.extname(f.name).toLowerCase() === '.accountmanager')
      if (files.length === 0) continue

      const projectId = crypto.randomUUID()
      const project = {
        id: projectId,
        name: dirent.name,
        description: 'imported form old version',
        icon: 'FolderIcon',
        createdAt: now
      }
      existingProjects.push(project)
      projectsAdded += 1

      for (const file of files) {
        const filePath = path.join(folderPath, file.name)
        let raw = ''
        try {
          raw = fs.readFileSync(filePath, 'utf8')
        } catch {}

        const firstLine = (raw || '').split(/\r?\n/)[0] || ''
        const parts = firstLine.split('|/|').map((s) => s.trim())
        const noteStr = parts[0] || ''
        const emailStr = parts[1] || ''
        const passwordStr = parts[2] || ''

        const displayName = noteStr || path.parse(file.name).name

        const account = {
          id: crypto.randomUUID(),
          projectId,
          name: displayName,
          email: emailStr,
          username: '',
          password: passwordStr,
          note: noteStr,
          createdAt: now,
          history: [
            {
              timestamp: now,
              type: 'create',
              source: 'import',
              snapshot: { name: displayName, email: emailStr, password: passwordStr }
            }
          ]
        }
        existingAccounts.push(account)
        accountsAdded += 1
      }
    }

    setData('projects', existingProjects)
    setData('accounts', existingAccounts)

    // Restore previous profile context
    currentProfile = prevProfile

    // Notify renderer storage changed
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('storage:updated', { key: 'projects' })
      win.webContents.send('storage:updated', { key: 'accounts' })
    })

    return { ok: true, projectsAdded, accountsAdded }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) }
  }
})
