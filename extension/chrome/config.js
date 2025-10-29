// Configuración de la extensión Account Manager
const CONFIG = {
  // URL base de la aplicación Electron
  ELECTRON_APP_URL: 'http://localhost:8765',
  
  // Endpoints de la API
  ENDPOINTS: {
    STATUS: '/status',
    FORM_DATA: '/form-data',
    SAVE_FORM: '/save-form',
    SHOW_APP: '/show-app'
  },
  
  // Configuración de timeouts
  TIMEOUTS: {
    CONNECTION_CHECK: 5000,
    API_REQUEST: 10000,
    FORM_DETECTION: 3000
  },
  
  // Configuración de la extensión
  EXTENSION: {
    NAME: 'Account Manager',
    VERSION: '1.0.0',
    DESCRIPTION: 'Extensión para auto-llenar formularios con datos de Account Manager'
  },
  
  // Selectores CSS para detectar formularios
  FORM_SELECTORS: {
    // Campos de email
    EMAIL: [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[placeholder*="email"]'
    ],
    
    // Campos de contraseña
    PASSWORD: [
      'input[type="password"]',
      'input[name*="password"]',
      'input[id*="password"]'
    ],
    
    // Campos de nombre
    NAME: [
      'input[name*="name"]',
      'input[id*="name"]',
      'input[placeholder*="name"]',
      'input[name*="firstname"]',
      'input[name*="lastname"]'
    ],
    
    // Campos de teléfono
    PHONE: [
      'input[type="tel"]',
      'input[name*="phone"]',
      'input[id*="phone"]',
      'input[placeholder*="phone"]',
      'input[name*="telefono"]'
    ],
    
    // Campos de dirección
    ADDRESS: [
      'input[name*="address"]',
      'input[id*="address"]',
      'input[name*="street"]',
      'input[name*="direccion"]'
    ],
    
    // Campos de ciudad
    CITY: [
      'input[name*="city"]',
      'input[id*="city"]',
      'input[name*="ciudad"]'
    ],
    
    // Campos de estado/provincia
    STATE: [
      'input[name*="state"]',
      'input[id*="state"]',
      'input[name*="province"]',
      'input[name*="provincia"]'
    ],
    
    // Campos de código postal
    ZIP: [
      'input[name*="zip"]',
      'input[id*="zip"]',
      'input[name*="postal"]',
      'input[name*="codigo"]'
    ],
    
    // Campos de país
    COUNTRY: [
      'input[name*="country"]',
      'input[id*="country"]',
      'select[name*="country"]',
      'input[name*="pais"]'
    ]
  },
  
  // Patrones para detectar tipos de formularios
  FORM_PATTERNS: {
    LOGIN: {
      keywords: ['login', 'signin', 'sign-in', 'iniciar', 'entrar'],
      requiredFields: ['email', 'password']
    },
    
    REGISTER: {
      keywords: ['register', 'signup', 'sign-up', 'registro', 'registrar'],
      requiredFields: ['email']
    },
    
    CONTACT: {
      keywords: ['contact', 'contacto', 'mensaje', 'message'],
      requiredFields: ['name', 'email']
    },
    
    ADDRESS: {
      keywords: ['address', 'direccion', 'shipping', 'billing', 'envio'],
      requiredFields: ['address', 'city']
    },
    
    CHECKOUT: {
      keywords: ['checkout', 'payment', 'pago', 'compra', 'order'],
      requiredFields: ['name', 'address']
    }
  },
  
  // Configuración de notificaciones
  NOTIFICATIONS: {
    DURATION: 3000,
    POSITION: 'top-right',
    STYLES: {
      SUCCESS: {
        background: '#10b981',
        color: 'white'
      },
      ERROR: {
        background: '#ef4444',
        color: 'white'
      },
      INFO: {
        background: '#3b82f6',
        color: 'white'
      },
      WARNING: {
        background: '#f59e0b',
        color: 'white'
      }
    }
  },
  
  // Configuración de logging
  LOGGING: {
    ENABLED: true,
    LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    PREFIX: '[Account Manager]'
  },
  
  // URLs excluidas donde no se debe ejecutar la extensión
  EXCLUDED_URLS: [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'about:',
    'file://',
    'localhost:8765' // No ejecutar en la propia aplicación
  ],
  
  // Configuración de seguridad
  SECURITY: {
    ALLOWED_ORIGINS: [
      'http://localhost:8765'
    ],
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  }
};

// Función para obtener la configuración completa
function getConfig() {
  return CONFIG;
}

// Función para obtener un valor específico de configuración
function getConfigValue(path) {
  const keys = path.split('.');
  let value = CONFIG;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// Función para verificar si una URL está excluida
function isUrlExcluded(url) {
  if (!url) return true;
  
  return CONFIG.EXCLUDED_URLS.some(excludedUrl => 
    url.startsWith(excludedUrl)
  );
}

// Función para obtener la URL completa de un endpoint
function getEndpointUrl(endpoint) {
  const baseUrl = CONFIG.ELECTRON_APP_URL;
  const endpointPath = CONFIG.ENDPOINTS[endpoint];
  
  if (!endpointPath) {
    throw new Error(`Endpoint '${endpoint}' no encontrado en la configuración`);
  }
  
  return `${baseUrl}${endpointPath}`;
}

// Función para logging con configuración
function log(level, message, ...args) {
  if (!CONFIG.LOGGING.ENABLED) return;
  
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(CONFIG.LOGGING.LEVEL);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex >= currentLevelIndex) {
    const prefix = CONFIG.LOGGING.PREFIX;
    const timestamp = new Date().toISOString();
    
    console[level](`${prefix} [${timestamp}] ${message}`, ...args);
  }
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    getConfig,
    getConfigValue,
    isUrlExcluded,
    getEndpointUrl,
    log
  };
}