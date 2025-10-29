// Simple storage service wrapping preload APIs

export async function storageGet(key, fallback = null) {
  const val = await window.api.storage.get(key)
  return val ?? fallback
}

export async function storageSet(key, value) {
  await window.api.storage.set(key, value)
}

export async function storageDelete(key) {
  await window.api.storage.delete(key)
}

export function onStorageUpdate(callback) {
  return window.api.storage.onUpdate(callback)
}

// Domain-specific helpers
const PROJECTS_KEY = 'projects'
const ACCOUNTS_KEY = 'accounts'
const NOTES_KEY = 'notes'
const PROFILES_KEY = 'vault_profiles'
const CURRENT_PROFILE_KEY = 'vault_current_profile'

export async function getProjects() {
  const list = await storageGet(PROJECTS_KEY, [])
  if (!Array.isArray(list)) return []
  return list
}

export async function saveProject(project) {
  const list = await getProjects()
  const idx = list.findIndex((p) => p.id === project.id)
  if (idx >= 0) list[idx] = project
  else list.push(project)
  await storageSet(PROJECTS_KEY, list)
  return project
}

export async function deleteProject(id) {
  // Eliminar el proyecto
  const list = await getProjects()
  const next = list.filter((p) => p.id !== id)
  await storageSet(PROJECTS_KEY, next)
  
  // Eliminar todas las cuentas asociadas al proyecto (tanto activas como eliminadas)
  const allAccounts = await storageGet(ACCOUNTS_KEY, [])
  if (Array.isArray(allAccounts)) {
    const remainingAccounts = allAccounts.filter((account) => account.projectId !== id)
    await storageSet(ACCOUNTS_KEY, remainingAccounts)
  }
}

export async function getAccounts(projectId) {
  const list = await storageGet(ACCOUNTS_KEY, [])
  if (!Array.isArray(list)) return []
  const active = list.filter((a) => !a.deletedAt)
  return projectId ? active.filter((a) => a.projectId === projectId) : active
}

export async function saveAccount(account, meta = {}) {
  // expects account.projectId
  // use raw list to preserve deleted items
  const list = await storageGet(ACCOUNTS_KEY, [])
  const idx = list.findIndex((a) => a.id === account.id)
  const now = Date.now()
  if (idx >= 0) {
    const prev = list[idx] || {}
    const changes = diffAccount(prev, account)
    const history = Array.isArray(prev.history) ? prev.history.slice() : []
    if (changes.length > 0) {
      history.push({ timestamp: now, type: 'update', source: meta?.source || 'desconocido', changes })
    }
    const merged = { ...prev, ...account, history }
    if (merged.history.length > 100) merged.history = merged.history.slice(-100)
    list[idx] = merged
    await storageSet(ACCOUNTS_KEY, list)
    return merged
  } else {
    const tracked = pickTracked(account)
    const entry = {
      ...account,
      history: [{ timestamp: now, type: 'create', source: meta?.source || 'desconocido', snapshot: tracked }]
    }
    list.push(entry)
    await storageSet(ACCOUNTS_KEY, list)
    return entry
  }
}

function normalizeLinks(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

function diffAccount(prev, next) {
  const track = ['name', 'email', 'username', 'password', 'note', 'links']
  const changes = []
  for (const field of track) {
    if (field === 'links') {
      const beforeLinks = normalizeLinks(prev.links)
      const afterLinks = normalizeLinks(next.links)
      const beforeStr = beforeLinks.join(', ')
      const afterStr = afterLinks.join(', ')
      if (beforeStr !== afterStr) {
        changes.push({ field, from: beforeStr, to: afterStr })
      }
    } else {
      const before = prev[field] ?? ''
      const after = next[field] ?? ''
      if (before !== after) {
        changes.push({ field, from: before, to: after })
      }
    }
  }
  return changes
}

function pickTracked(obj) {
  const track = ['name', 'email', 'username', 'password', 'note', 'links']
  const out = {}
  for (const k of track) {
    if (k === 'links') out[k] = normalizeLinks(obj.links).join(', ')
    else out[k] = obj[k] ?? ''
  }
  return out
}

export async function deleteAccount(id) {
  // Soft delete: mark as deleted and keep in storage
  const list = await storageGet(ACCOUNTS_KEY, [])
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) return
  const now = Date.now()
  const acc = list[idx]
  const history = Array.isArray(acc.history) ? acc.history.slice() : []
  history.push({ timestamp: now, type: 'delete', source: 'papelera', message: 'Fue eliminado' })
  list[idx] = { ...acc, deletedAt: now, history }
  await storageSet(ACCOUNTS_KEY, list)
}

export async function hardDeleteAccount(id) {
  // Permanent delete: remove from storage completely
  const list = await storageGet(ACCOUNTS_KEY, [])
  const next = list.filter((a) => a.id !== id)
  await storageSet(ACCOUNTS_KEY, next)
}

export async function restoreAccount(id, meta = {}) {
  const list = await storageGet(ACCOUNTS_KEY, [])
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) return null
  const now = Date.now()
  const acc = list[idx]
  const history = Array.isArray(acc.history) ? acc.history.slice() : []
  history.push({ timestamp: now, type: 'restore', source: meta?.source || 'papelera', message: 'Restore de la papelera a cuentas' })
  const restored = { ...acc, deletedAt: null, history }
  list[idx] = restored
  await storageSet(ACCOUNTS_KEY, list)
  return restored
}

export async function logAccountEvent(id, entry = {}) {
  // Append a custom event to account history (e.g., copy, custom messages)
  const list = await storageGet(ACCOUNTS_KEY, [])
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) return null
  const now = Date.now()
  const acc = list[idx]
  let history = Array.isArray(acc.history) ? acc.history.slice() : []
  history.push({ timestamp: now, source: entry?.source || 'ui', ...entry })
  if (history.length > 100) history = history.slice(-100)
  const updated = { ...acc, history }
  list[idx] = updated
  await storageSet(ACCOUNTS_KEY, list)
  return updated
}

export async function getTrashAccounts(projectId) {
  const list = await storageGet(ACCOUNTS_KEY, [])
  if (!Array.isArray(list)) return []
  const trashed = list.filter((a) => !!a.deletedAt)
  return projectId ? trashed.filter((a) => a.projectId === projectId) : trashed
}

export async function getNotes() {
  const list = await storageGet(NOTES_KEY, [])
  if (!Array.isArray(list)) return []
  return list
}

export async function saveNote(note) {
  const list = await getNotes()
  const idx = list.findIndex((n) => n.id === note.id)
  if (idx >= 0) list[idx] = note
  else list.push(note)
  await storageSet(NOTES_KEY, list)
  return note
}

export async function deleteNote(id) {
  const list = await getNotes()
  const next = list.filter((n) => n.id !== id)
  await storageSet(NOTES_KEY, next)
}

export const KEYS = { PROJECTS_KEY, ACCOUNTS_KEY, NOTES_KEY, PROFILES_KEY, CURRENT_PROFILE_KEY }