// Background script simplificado para debugging
console.log('Account Manager Extension - Background script iniciado (versión simple)');

// Configuración básica
const CONFIG = {
  ELECTRON_APP_URL: 'http://localhost:8765',
  ENDPOINTS: {
    STATUS: '/status',
    FORM_DATA: '/form-data',
    SAVE_FORM: '/save-form',
    SHOW_APP: '/show-app'
  },
  TIMEOUTS: {
    CONNECTION_CHECK: 5000,
    API_REQUEST: 10000
  },
  SECURITY: {
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  }
};

// ID único para esta instancia de extensión
const EXTENSION_CLIENT_ID = `chrome-ext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Estado de conexión
let connectionStatus = {
  connected: false,
  lastCheck: null,
  error: null
};

// Función para hacer peticiones HTTP
async function makeHttpRequest(endpoint, options = {}) {
  const url = `${CONFIG.ELECTRON_APP_URL}${CONFIG.ENDPOINTS[endpoint.toUpperCase()] || endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Client-ID': EXTENSION_CLIENT_ID,
    'X-Extension-Version': '1.0.0'
  };

  const requestOptions = {
    method: options.method || 'GET',
    headers: { ...defaultHeaders, ...options.headers },
    ...options
  };

  if (requestOptions.body && typeof requestOptions.body === 'object') {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUTS.API_REQUEST);
    
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    console.error('Error en petición HTTP:', error);
    return { success: false, error: error.message };
  }
}

// Verificar estado de conexión
async function checkConnectionStatus() {
  try {
    const result = await makeHttpRequest('status');
    if (result.success) {
      connectionStatus = {
        connected: true,
        lastCheck: Date.now(),
        error: null,
        appData: result.data
      };
      
      // Actualizar badge
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error verificando conexión:', error);
    connectionStatus = {
      connected: false,
      lastCheck: Date.now(),
      error: error.message
    };
    
    // Actualizar badge
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Event listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensaje recibido:', message);
  
  if (message.type === 'GET_CONNECTION_STATUS') {
    sendResponse({
      success: true,
      data: connectionStatus
    });
    return true;
  }
  
  if (message.type === 'CHECK_CONNECTION') {
    checkConnectionStatus().then(() => {
      sendResponse({
        success: connectionStatus.connected,
        data: connectionStatus
      });
    }).catch(error => {
      sendResponse({
        success: false,
        error: error.message
      });
    });
    return true;
  }
  
  sendResponse({ success: false, error: 'Tipo de mensaje no reconocido' });
});

// Instalación
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension instalada:', details);
  
  if (details.reason === 'install') {
    try {
      await chrome.storage.local.set({
        'am_config': {
          version: '1.0.0',
          installDate: new Date().toISOString(),
          autoDetect: true,
          autoFill: false,
          notifications: true,
          debugMode: false
        }
      });
      
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html')
      });
      
    } catch (error) {
      console.error('Error en configuración inicial:', error);
    }
  }
  
  // Verificar conexión inicial
  setTimeout(checkConnectionStatus, 1000);
});

// Startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension iniciada');
  setTimeout(checkConnectionStatus, 1000);
});

// Verificación periódica
setInterval(checkConnectionStatus, 30000);

// Verificación inicial
setTimeout(checkConnectionStatus, 2000);

console.log('Background script configurado correctamente');