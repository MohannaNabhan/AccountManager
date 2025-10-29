import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  storage: {
    set: (key, value) => electronAPI.ipcRenderer.invoke('localStorage', { event: 'set', data: { key, value } }),
    get: (key) => electronAPI.ipcRenderer.invoke('localStorage', { event: 'get', data: { key } }),
    delete: (key) => electronAPI.ipcRenderer.invoke('localStorage', { event: 'delete', data: { key } }),
    onUpdate: (callback) => {
      const handler = (_event, payload) => callback(payload)
      electronAPI.ipcRenderer.on('storage:updated', handler)
      return () => electronAPI.ipcRenderer.removeListener('storage:updated', handler)
    }
  },
  vault: {
    status: () => electronAPI.ipcRenderer.invoke('vault:status'),
    setup: (password, profileName) => electronAPI.ipcRenderer.invoke('vault:setup', { password, profileName }),
    unlock: (password, profileId) => electronAPI.ipcRenderer.invoke('vault:unlock', { password, profileId }),
    lock: () => electronAPI.ipcRenderer.invoke('vault:lock'),
    password: {
      change: (oldPassword, newPassword, profileId) =>
        electronAPI.ipcRenderer.invoke('vault:password:change', { oldPassword, newPassword, profileId })
    },
    profiles: {
      list: () => electronAPI.ipcRenderer.invoke('vault:profiles:list'),
      create: (name, id) => electronAPI.ipcRenderer.invoke('vault:profiles:create', { name, id }),
      select: (id) => electronAPI.ipcRenderer.invoke('vault:profiles:select', { id }),
      delete: (id, password) => electronAPI.ipcRenderer.invoke('vault:profiles:delete', { id, password }),
      remove: (id, password) => electronAPI.ipcRenderer.invoke('vault:profiles:delete', { id, password }),
      update: (id, data) => electronAPI.ipcRenderer.invoke('vault:profiles:update', { id, ...data })
    },
    stats: {
      get: () => electronAPI.ipcRenderer.invoke('vault:stats:get'),
      update: (profileId, projectCount, accountCount) => 
        electronAPI.ipcRenderer.invoke('vault:stats:update', { profileId, projectCount, accountCount })
    }
  },
  app: {
    reload: () => electronAPI.ipcRenderer.invoke('app:reload'),
    version: () => electronAPI.ipcRenderer.invoke('app:getVersion')
  },
  window: {
    minimize: () => electronAPI.ipcRenderer.invoke('window:minimize'),
    isMaximized: () => electronAPI.ipcRenderer.invoke('window:isMaximized'),
    toggleMaximize: () => electronAPI.ipcRenderer.invoke('window:toggleMaximize'),
    close: () => electronAPI.ipcRenderer.invoke('window:close')
  },
  links: {
    openExternal: (url) => electronAPI.ipcRenderer.invoke('links:openExternal', url)
  },
  extension: {
    getStatus: () => electronAPI.ipcRenderer.invoke('extension:getStatus')
  },
  attachments: {
    choose: () => electronAPI.ipcRenderer.invoke('attachments:choose'),
    save: (sourcePath) => electronAPI.ipcRenderer.invoke('attachments:save', { sourcePath })
  },
  export: {
    csv: (filenameHint, content) => electronAPI.ipcRenderer.invoke('export:csv', { filenameHint, content }),
    pdf: (filenameHint, html) => electronAPI.ipcRenderer.invoke('export:pdf', { filenameHint, html })
  },
  import: {
    scanLegacy: () => electronAPI.ipcRenderer.invoke('import:scanLegacy'),
    executeLegacy: (profileId) => electronAPI.ipcRenderer.invoke('import:executeLegacy', { profileId }),
    openLegacyFolder: () => electronAPI.ipcRenderer.invoke('import:openLegacyFolder')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
