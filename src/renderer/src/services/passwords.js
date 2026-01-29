import { storageGet, storageSet } from '@/services/storage'

const SETTINGS_KEY = 'passwordSettings'

const DEFAULT_SETTINGS = {
  length: 15,
  includeNumbers: true,
  includeLetters: true,
  includeSymbols: true,
  pattern: '',
}

export async function getPasswordSettings() {
  const s = await storageGet(SETTINGS_KEY, DEFAULT_SETTINGS)
  // ensure defaults
  return { ...DEFAULT_SETTINGS, ...(s || {}) }
}

export async function savePasswordSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  await storageSet(SETTINGS_KEY, merged)
  return merged
}

export function generatePassword(settings) {
  const opts = { ...DEFAULT_SETTINGS, ...(settings || {}) }
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()-_=+[]{};:,.<>/?'
  const union = `${opts.includeLetters ? letters : ''}${opts.includeNumbers ? numbers : ''}${opts.includeSymbols ? symbols : ''}` || letters
  const raw = (opts.pattern || '').trim()
  if (raw.length > 0) {
    let out = ''
    for (let i = 0; i < raw.length; ) {
      const ch = raw[i]
      if (ch === '{') {
        const end = raw.indexOf('}', i + 1)
        if (end === -1) {
          // no closing brace: treat as literal
          out += ch
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
            if (pool) out += pool[arr[k] % pool.length]
            else out += sch
          }
        }
        i = end + 1
      } else {
        out += ch
        i += 1
      }
    }
    return out
  }

  let out = ''
  const array = new Uint32Array(opts.length)
  crypto.getRandomValues(array)
  for (let i = 0; i < opts.length; i++) {
    out += union[array[i] % union.length]
  }
  return out
}

export const PASSWORD_SETTINGS_KEY = SETTINGS_KEY