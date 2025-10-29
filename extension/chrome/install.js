// Script de instalación y configuración para Account Manager Extension

// Configuración inicial al instalar la extensión
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Account Manager Extension instalada:', details);

  if (details.reason === 'install') {
    // Primera instalación
    handleFirstInstall();
  } else if (details.reason === 'update') {
    // Actualización
    handleUpdate(details.previousVersion);
  }
});

// Manejar primera instalación
async function handleFirstInstall() {
  try {
    // Configurar valores por defecto
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
}

// Manejar actualización
async function handleUpdate(previousVersion) {
  try {
    console.log(`Actualizando desde versión ${previousVersion} a 1.0.0`);

    // Migrar configuración si es necesario
    const config = await chrome.storage.local.get('am_config');
    if (config.am_config) {
      config.am_config.version = '1.0.0';
      config.am_config.updateDate = new Date().toISOString();
      await chrome.storage.local.set({ 'am_config': config.am_config });
    }

    console.log('Actualización completada');
  } catch (error) {
    console.error('Error en actualización:', error);
  }
}

// Verificar estado de la aplicación al iniciar
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension iniciada');
  
  try {
    // Verificar conexión con Account Manager
    const response = await fetch('http://localhost:8765/status');
    if (response.ok) {
      console.log('Account Manager detectado y funcionando');
    }
  } catch (error) {
    console.log('Account Manager no detectado:', error.message);
  }
});

// Manejar suspensión de la extensión
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspendida');
  
  // Limpiar recursos si es necesario
  // Guardar estado actual
});

// Configurar alarmas para verificación periódica
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    performHealthCheck();
  }
});

// Crear alarma para verificación de salud
chrome.alarms.create('healthCheck', {
  delayInMinutes: 1,
  periodInMinutes: 5
});

// Verificación de salud de la extensión
async function performHealthCheck() {
  try {
    // Verificar conexión con Account Manager
    const response = await fetch('http://localhost:8765/status', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Health check OK:', data);
      
      // Actualizar badge si está conectado
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      throw new Error('Respuesta no válida');
    }
  } catch (error) {
    console.log('Health check falló:', error.message);
    
    // Mostrar badge de desconectado
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Manejar errores no capturados
self.addEventListener('error', (event) => {
  console.error('Error no capturado en extension:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada no manejada:', event.reason);
});

// Funciones de utilidad para la configuración
const ConfigManager = {
  // Obtener configuración
  async get(key = null) {
    try {
      const result = await chrome.storage.local.get(key ? `am_${key}` : null);
      return key ? result[`am_${key}`] : result;
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      return null;
    }
  },

  // Guardar configuración
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [`am_${key}`]: value });
      return true;
    } catch (error) {
      console.error('Error guardando configuración:', error);
      return false;
    }
  },

  // Eliminar configuración
  async remove(key) {
    try {
      await chrome.storage.local.remove(`am_${key}`);
      return true;
    } catch (error) {
      console.error('Error eliminando configuración:', error);
      return false;
    }
  },

  // Limpiar toda la configuración
  async clear() {
    try {
      const items = await chrome.storage.local.get();
      const amKeys = Object.keys(items).filter(key => key.startsWith('am_'));
      await chrome.storage.local.remove(amKeys);
      return true;
    } catch (error) {
      console.error('Error limpiando configuración:', error);
      return false;
    }
  }
};

// Estadísticas de uso
const StatsManager = {
  // Incrementar contador
  async increment(counter) {
    try {
      const stats = await ConfigManager.get('stats') || {};
      stats[counter] = (stats[counter] || 0) + 1;
      stats.lastUsed = new Date().toISOString();
      await ConfigManager.set('stats', stats);
    } catch (error) {
      console.error('Error incrementando estadística:', error);
    }
  },

  // Obtener estadísticas
  async get() {
    try {
      return await ConfigManager.get('stats') || {};
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {};
    }
  },

  // Resetear estadísticas
  async reset() {
    try {
      await ConfigManager.set('stats', {
        formsDetected: 0,
        formsFilled: 0,
        lastUsed: null
      });
    } catch (error) {
      console.error('Error reseteando estadísticas:', error);
    }
  }
};

// Exportar para uso en otros archivos
if (typeof globalThis !== 'undefined') {
  globalThis.ConfigManager = ConfigManager;
  globalThis.StatsManager = StatsManager;
}