// Background script para Account Manager Extension
// Maneja la comunicación entre la extensión y la aplicación Electron

// Importar configuración y utilidades
importScripts('config.js', 'utils.js');

console.log('Account Manager Extension - Background script iniciado');

// Puerto para comunicación con la aplicación nativa
let nativePort = null;
const NATIVE_APP_NAME = 'com.accountmanager.native';

// Configuración del servidor local de Electron
const ELECTRON_SERVER = {
  host: 'localhost',
  port: 3001, // Puerto que usaremos para la comunicación
  protocol: 'http'
};

// Estado global
let isConnected = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // 30 segundos

// Función de logging
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  console[level](`[Account Manager] [${timestamp}] ${message}`, ...args);
}

// Conectar con la aplicación nativa (Electron)
function connectToNativeApp() {
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_APP_NAME);
    
    nativePort.onMessage.addListener((message) => {
      console.log('Mensaje recibido de la aplicación nativa:', message);
      // Reenviar mensaje a content scripts o popup
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'FROM_NATIVE_APP',
            data: message
          });
        }
      });
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Desconectado de la aplicación nativa');
      nativePort = null;
      // Intentar reconectar después de 5 segundos
      setTimeout(connectToNativeApp, 5000);
    });

    console.log('Conectado a la aplicación nativa');
  } catch (error) {
    console.error('Error conectando a la aplicación nativa:', error);
    // Fallback: usar comunicación HTTP
    console.log('Usando comunicación HTTP como fallback');
  }
}

// Generar ID único para esta instancia de extensión
const EXTENSION_CLIENT_ID = `chrome-ext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Función para hacer peticiones HTTP a la aplicación Electron
async function makeHttpRequest(endpoint, options = {}) {
  const url = `${CONFIG.ELECTRON_APP_URL}${CONFIG.ENDPOINTS[endpoint] || endpoint}`;
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-ID': EXTENSION_CLIENT_ID,
      'X-Extension-Version': chrome.runtime.getManifest().version
    }
  };

  const maxRetries = CONFIG.SECURITY.MAX_RETRY_ATTEMPTS;
  const retryDelay = CONFIG.SECURITY.RETRY_DELAY;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUTS.API_REQUEST);

      const response = await fetch(url, {
        ...defaultOptions,
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };

    } catch (error) {
      log('warn', `Intento ${attempt}/${maxRetries} falló para ${endpoint}:`, error.message);

      if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }

      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
}

// Comunicación HTTP con Electron como fallback
async function sendToElectronHTTP(message) {
  try {
    const response = await fetch(`${ELECTRON_SERVER.protocol}://${ELECTRON_SERVER.host}:${ELECTRON_SERVER.port}/api/extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error en comunicación HTTP:', error);
    return { error: error.message };
  }
}

// Enviar mensaje a la aplicación de Electron
async function sendToElectron(message) {
  if (nativePort) {
    try {
      nativePort.postMessage(message);
      return { success: true };
    } catch (error) {
      console.error('Error enviando mensaje nativo:', error);
    }
  }
  
  // Fallback a HTTP
  return await sendToElectronHTTP(message);
}

// Estado de conexión global
let connectionStatus = {
  connected: false,
  lastCheck: null,
  error: null
};

// Verificar estado de conexión
async function checkConnectionStatus() {
  try {
    const result = await makeHttpRequest('status');
    if (result.success) {
      connectionStatus = {
        connected: true,
        lastCheck: new Date(),
        error: null,
        appData: result.data
      };
      
      // Actualizar badge
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      
      log('info', 'Conexión verificada exitosamente');
    } else {
      throw new Error(result.error || 'Error desconocido');
    }
  } catch (error) {
    connectionStatus = {
      connected: false,
      lastCheck: new Date(),
      error: error.message
    };
    
    // Actualizar badge
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    
    log('warn', 'Error verificando conexión:', error.message);
  }
  
  return connectionStatus;
}

// Verificar conexión cada 30 segundos
setInterval(checkConnectionStatus, 30000);

// Verificar conexión al iniciar
checkConnectionStatus();

// Manejar mensajes de content scripts y popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('info', 'Mensaje recibido en background:', message);
  
  switch (message.type) {
    case 'GET_CONNECTION_STATUS':
      sendResponse({ success: true, data: connectionStatus });
      return false;

    case 'CHECK_CONNECTION':
      checkConnectionStatus()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_AUTOFORM_DATA':
      sendToElectron({
        type: 'GET_AUTOFORM_DATA',
        url: sender.tab?.url || message.url
      }).then(sendResponse);
      return true; // Mantener el canal abierto para respuesta asíncrona
      
    case 'SAVE_FORM_DATA':
      sendToElectron({
        type: 'SAVE_FORM_DATA',
        data: message.data,
        url: sender.tab?.url || message.url
      }).then(sendResponse);
      return true;
      
    case 'FILL_FORM':
      // Enviar datos de vuelta al content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'FILL_FORM_DATA',
            data: message.data
          });
        }
      });
      sendResponse({ success: true });
      break;
      
    case 'CONNECT_TO_ELECTRON':
      connectToNativeApp();
      sendResponse({ success: true });
      break;
      
    default:
      log('warn', 'Tipo de mensaje no reconocido:', message.type);
      sendResponse({ success: false, error: 'Tipo de mensaje no reconocido' });
  }
});

// Manejar clics en el icono de la extensión
chrome.action.onClicked.addListener((tab) => {
  // Abrir popup o realizar acción
  console.log('Icono de extensión clickeado en:', tab.url);
});

// Detectar formularios de login en páginas web
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Inyectar script para detectar formularios
    chrome.tabs.sendMessage(tabId, {
      type: 'DETECT_FORMS',
      url: tab.url
    }).catch(() => {
      // Ignorar errores si la página no puede recibir mensajes
    });
  }
});

// Inicializar conexión al cargar la extensión
chrome.runtime.onStartup.addListener(() => {
  connectToNativeApp();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Account Manager Extension instalada:', details);
  
  if (details.reason === 'install') {
    // Primera instalación
    try {
      await chrome.storage.local.set({
        'am_config': {
          version: '1.0.0',
          installDate: new Date().toISOString(),
          autoDetect: true,
          autoFill: false,
          notifications: true,
          debugMode: false
        },
        'am_stats': {
          formsDetected: 0,
          formsFilled: 0,
          lastUsed: null
        }
      });

      // Mostrar página de bienvenida
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html')
      });

      console.log('Configuración inicial completada');
    } catch (error) {
      console.error('Error en configuración inicial:', error);
    }
  } else if (details.reason === 'update') {
    console.log(`Actualizando desde versión ${details.previousVersion} a 1.0.0`);
  }
  
  connectToNativeApp();
});

// Mantener el service worker activo
chrome.runtime.onConnect.addListener((port) => {
  console.log('Puerto conectado:', port.name);
});

// Exportar funciones para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendToElectron,
    connectToNativeApp
  };
}