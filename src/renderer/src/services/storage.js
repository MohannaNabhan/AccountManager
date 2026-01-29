// Simple storage service wrapping preload APIs

// Local storage keys
export const KEYS = {
  PROJECTS_KEY: 'projects',
  ACCOUNTS_KEY: 'accounts',
  NOTES_KEY: 'notes',
  TRASH_KEY: 'trash',
  PROFILES_KEY: 'vault_profiles',
  CURRENT_PROFILE_KEY: 'vault_current_profile'
}

// Helpers to access the exposed API
// The API is exposed in preload/index.js using contextBridge

// Generic get/set
export async function storageGet(key, defaultValue = null) {
  try {
    const val = await window.api.storage.get(key)
    return val === null || val === undefined ? defaultValue : val
  } catch (err) {
    console.error(`Error getting ${key}:`, err)
    return defaultValue
  }
}

export async function storageSet(key, value) {
  try {
    await window.api.storage.set(key, value)
  } catch (err) {
    console.error(`Error setting ${key}:`, err)
  }
}

export async function storageDelete(key) {
  try {
    await window.api.storage.delete(key)
  } catch (err) {
    console.error(`Error deleting ${key}:`, err)
  }
}

// Subscribe to changes
// Returns a function to unsubscribe
export function onStorageUpdate(callback) {
  return window.api.storage.onUpdate(callback)
}

// --- Domain specific helpers ---

// Projects
export async function getProjects() {
  const list = await storageGet(KEYS.PROJECTS_KEY)
  return Array.isArray(list) ? list : []
}

export async function saveProject(project) {
  if (!project.id || !project.name) {
    throw new Error('Project must have id and name')
  }
  const projects = await getProjects()
  const index = projects.findIndex((p) => p.id === project.id)
  
  // Clean properties undefined
  const cleanProject = JSON.parse(JSON.stringify(project))
  
  if (index >= 0) {
    projects[index] = cleanProject
  } else {
    projects.push(cleanProject)
  }
  await storageSet(KEYS.PROJECTS_KEY, projects)
}

export async function deleteProject(projectId) {
  const projects = await getProjects()
  const filtered = projects.filter((p) => p.id !== projectId)
  await storageSet(KEYS.PROJECTS_KEY, filtered)
  
  // Delete all accounts associated with the project (both active and deleted)
  const allAccounts = await storageGet(KEYS.ACCOUNTS_KEY, [])
  if (Array.isArray(allAccounts)) {
    const remainingAccounts = allAccounts.filter((account) => account.projectId !== projectId)
    await storageSet(KEYS.ACCOUNTS_KEY, remainingAccounts)
  }
}

// Accounts
export async function getAccounts(projectId = null) {
  const all = await storageGet(KEYS.ACCOUNTS_KEY)
  const list = Array.isArray(all) ? all : []
  // Filter active accounts (not in trash)
  const active = list.filter((a) => !a.deletedAt)
  if (projectId) {
    return active.filter((a) => a.projectId === projectId)
  }
  return active
}

export async function getTrashAccounts(projectId = null) {
  const all = await storageGet(KEYS.ACCOUNTS_KEY)
  const list = Array.isArray(all) ? all : []
  const trash = list.filter((a) => a.deletedAt) // Those that have deletedAt
  if (projectId) {
    return trash.filter((a) => a.projectId === projectId)
  }
  return trash
}

export async function saveAccount(account) {
  if (!account.id || !account.projectId) {
    throw new Error('Account must have id and projectId')
  }
  const all = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const index = all.findIndex((a) => a.id === account.id)

  const now = Date.now()
  const cleanAccount = JSON.parse(JSON.stringify(account))
  
  // Maintain history
  if (index >= 0) {
    const oldAccount = all[index]
    const history = oldAccount.history || []
    
    // Only add to history if something important changed
    if (oldAccount.password !== cleanAccount.password || 
        oldAccount.email !== cleanAccount.email ||
        oldAccount.username !== cleanAccount.username) {
        
      history.unshift({
        date: now,
        changes: {
          password: oldAccount.password !== cleanAccount.password ? oldAccount.password : undefined,
          email: oldAccount.email !== cleanAccount.email ? oldAccount.email : undefined,
          username: oldAccount.username !== cleanAccount.username ? oldAccount.username : undefined
        }
      })
      
      // Limit history
      if (history.length > 50) history.pop()
    }
    
    cleanAccount.history = history
    cleanAccount.updatedAt = now
    all[index] = cleanAccount
  } else {
    cleanAccount.createdAt = now
    cleanAccount.updatedAt = now
    cleanAccount.history = []
    all.push(cleanAccount)
  }
  
  await storageSet(KEYS.ACCOUNTS_KEY, all)
}

// "Soft delete" - active -> trash
export async function moveAccountToTrash(accountId) {
  const all = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const index = all.findIndex((a) => a.id === accountId)
  if (index >= 0) {
    all[index].deletedAt = Date.now()
    await storageSet(KEYS.ACCOUNTS_KEY, all)
  }
}

// Restore: trash -> active
export async function restoreAccount(accountId) {
  const all = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const index = all.findIndex((a) => a.id === accountId)
  if (index >= 0) {
    delete all[index].deletedAt
    await storageSet(KEYS.ACCOUNTS_KEY, all)
  }
}

// Hard delete - remove definitively
export async function deleteAccount(accountId) {
  const all = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const filtered = all.filter((a) => a.id !== accountId)
  await storageSet(KEYS.ACCOUNTS_KEY, filtered)
}

export async function getNotes() {
  const list = await storageGet(KEYS.NOTES_KEY, [])
  if (!Array.isArray(list)) return []
  return list
}

export async function saveNote(note) {
  const list = await getNotes()
  const idx = list.findIndex((n) => n.id === note.id)
  if (idx >= 0) list[idx] = note
  else list.push(note)
  await storageSet(KEYS.NOTES_KEY, list)
  return note
}

export async function deleteNote(id) {
  const list = await getNotes()
  const next = list.filter((n) => n.id !== id)
  await storageSet(KEYS.NOTES_KEY, next)
}

export async function importProjectData(data) {
  if (!data || !data.project || !Array.isArray(data.accounts)) {
    throw new Error('Invalid project format')
  }

  // Generate new IDs to prevent conflicts
  const newProjectId = crypto.randomUUID()
  const newProject = { ...data.project, id: newProjectId }
  
  // Save project
  await saveProject(newProject)

  // Prepare accounts with new IDs
  const newAccounts = data.accounts.map(acc => ({
    ...acc,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    history: acc.history || [] // Keep history or reset? Better keep it as record
  }))

  // Save accounts in batch
  const allAccounts = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const mergedAccounts = [...allAccounts, ...newAccounts]
  await storageSet(KEYS.ACCOUNTS_KEY, mergedAccounts)

  return newProject
}

export async function importAccountsToProject(projectId, data) {
  // data can be { project: ..., accounts: [...] } or simply an array of accounts [...]
  let accountsToImport = []
  if (Array.isArray(data)) {
    accountsToImport = data
  } else if (data && Array.isArray(data.accounts)) {
    accountsToImport = data.accounts
  } else {
    throw new Error('Invalid accounts format')
  }

  if (accountsToImport.length === 0) {
    return 0
  }

  // Prepare accounts with new IDs and assigned to the current project
  // Filter only those that look like accounts (have name/email/username etc)
  const newAccounts = accountsToImport.map(acc => ({
    ...acc,
    id: crypto.randomUUID(),
    projectId: projectId,
    history: acc.history || [],
    createdAt: acc.createdAt || Date.now(),
    updatedAt: Date.now()
  }))

  // Save accounts in batch
  const allAccounts = await storageGet(KEYS.ACCOUNTS_KEY, [])
  const mergedAccounts = [...allAccounts, ...newAccounts]
  await storageSet(KEYS.ACCOUNTS_KEY, mergedAccounts)

  return newAccounts.length
}