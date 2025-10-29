import { storageGet, storageSet } from '@/services/storage'

const SETTINGS_KEY = 'usernameSettings'

const DEFAULTS = {
  prefix: 'usuario',
  length: 6,
  includeLetters: true,
  includeNumbers: true,
  includeSymbols: false,
  pattern: '',
}

export async function getUsernameSettings() {
  const s = await storageGet(SETTINGS_KEY, DEFAULTS)
  return { ...DEFAULTS, ...(s || {}) }
}

export async function saveUsernameSettings(settings) {
  const merged = { ...DEFAULTS, ...settings }
  await storageSet(SETTINGS_KEY, merged)
  return merged
}

export function generateUsername(options = {}) {
  const opts = { ...DEFAULTS, ...(options || {}) }
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '_-.' // símbolos comunes en usernames
  const union = `${opts.includeLetters ? letters : ''}${opts.includeNumbers ? numbers : ''}${opts.includeSymbols ? symbols : ''}` || letters
  const raw = (opts.pattern || '').trim()
  let core = ''
  if (raw.length > 0) {
    for (let i = 0; i < raw.length; ) {
      const ch = raw[i]
      if (ch === '{') {
        const end = raw.indexOf('}', i + 1)
        if (end === -1) {
          core += ch
          i += 1
          continue
        }
        const seg = raw.slice(i + 1, end)
        if (seg.length > 0) {
          const arr = new Uint32Array(seg.length)
          crypto.getRandomValues(arr)
          for (let k = 0; k < seg.length; k++) {
            const sch = seg[k]
            let pool = ''
            if (sch === 'x') pool = union
            else if (sch === '?') pool = letters
            else if (sch === '$') pool = numbers
            else if (sch === '!') pool = symbols
            if (pool) core += pool[arr[k] % pool.length]
            else core += sch
          }
        }
        i = end + 1
      } else {
        core += ch
        i += 1
      }
    }
    return core
  } else {
    const arr = new Uint32Array(opts.length)
    crypto.getRandomValues(arr)
    for (let i = 0; i < opts.length; i++) core += union[arr[i] % union.length]
  }
  return `${opts.prefix}-${core}`
}

export const USERNAME_SETTINGS_KEY = SETTINGS_KEY