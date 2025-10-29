import { storageGet, storageSet } from '@/services/storage'

const AUTOFORM_KEY = 'autoFormData'

const DEFAULT_AUTOFORM_DATA = {
  // Múltiples datos personales
  personal: [],
  // Múltiples tarjetas de crédito
  creditCard: [],
  // Múltiples direcciones
  address: [],
  // Múltiples correos electrónicos
  email: []
}

// Plantillas para nuevos elementos
export const PERSONAL_TEMPLATE = {
  id: '',
  name: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  email: '',
  gender: ''
}

export const CREDIT_CARD_TEMPLATE = {
  id: '',
  name: '',
  number: '',
  cvv: '',
  expiryMonth: '',
  expiryYear: '',
  holderName: ''
}

export const ADDRESS_TEMPLATE = {
  id: '',
  name: '',
  street: '',
  streetNumber: '',
  city: '',
  state: '',
  zipCode: '',
  country: ''
}

export const EMAIL_TEMPLATE = {
  id: '',
  name: '',
  email: ''
}

export async function getAutoFormData() {
  const data = await storageGet(AUTOFORM_KEY, DEFAULT_AUTOFORM_DATA)
  const result = { ...DEFAULT_AUTOFORM_DATA, ...(data || {}) }
  
  // Migrar datos del formato anterior (objetos) al nuevo formato (arrays)
  if (result.personal && !Array.isArray(result.personal)) {
    result.personal = []
  }
  if (result.creditCard && !Array.isArray(result.creditCard)) {
    result.creditCard = []
  }
  if (result.address && !Array.isArray(result.address)) {
    result.address = []
  }
  if (result.email && !Array.isArray(result.email)) {
    result.email = []
  }
  
  // Eliminar sección 'additional' si existe
  if (result.additional) {
    delete result.additional
  }
  
  return result
}

export async function saveAutoFormData(data) {
  const merged = { ...DEFAULT_AUTOFORM_DATA, ...data }
  await storageSet(AUTOFORM_KEY, merged)
  return merged
}

// Funciones para manejar elementos individuales
export async function addAutoFormItem(section, item) {
  const currentData = await getAutoFormData()
  const newItem = { ...item, id: Date.now().toString() }
  const updatedData = {
    ...currentData,
    [section]: [...(currentData[section] || []), newItem]
  }
  return await saveAutoFormData(updatedData)
}

export async function updateAutoFormItem(section, itemId, itemData) {
  const currentData = await getAutoFormData()
  const updatedData = {
    ...currentData,
    [section]: (currentData[section] || []).map(item => 
      item.id === itemId ? { ...item, ...itemData } : item
    )
  }
  return await saveAutoFormData(updatedData)
}

export async function deleteAutoFormItem(section, itemId) {
  const currentData = await getAutoFormData()
  const updatedData = {
    ...currentData,
    [section]: (currentData[section] || []).filter(item => item.id !== itemId)
  }
  return await saveAutoFormData(updatedData)
}

export const AUTOFORM_SETTINGS_KEY = AUTOFORM_KEY