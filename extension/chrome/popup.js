// Estado global del popup
let currentTab = null;
let connectionStatus = false;
let detectedForms = [];

// Inicializar popup
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
});

// Inicializar el popup
async function initializePopup() {
  try {
    // Obtener la pestaña actual
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Actualizar información de la página
    updatePageInfo(tab);
    
    // Verificar conexión con la aplicación
    await checkConnection();
    
    // Detectar formularios automáticamente
    await detectForms();
    
  } catch (error) {
    console.error('Error inicializando popup:', error);
    showError('Error al inicializar la extensión');
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Botones principales
  document.getElementById('fillFormsBtn').addEventListener('click', fillForms);
  document.getElementById('detectFormsBtn').addEventListener('click', detectForms);
  document.getElementById('openAppBtn').addEventListener('click', openApp);
  document.getElementById('connectBtn').addEventListener('click', checkConnection);
  
  // Enlaces del footer
  document.getElementById('settingsLink').addEventListener('click', openSettings);
  document.getElementById('helpLink').addEventListener('click', openHelp);
}

// Actualizar información de la página
function updatePageInfo(tab) {
  const pageElement = document.getElementById('currentPage');
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      pageElement.textContent = url.hostname;
    } catch (error) {
      pageElement.textContent = 'Página no válida';
    }
  } else {
    pageElement.textContent = 'Desconocida';
  }
}

// Verificar conexión con la aplicación
async function checkConnection() {
  const statusElement = document.getElementById('connectionStatus');
  const indicatorElement = document.getElementById('connectionIndicator');
  const connectBtn = document.getElementById('connectBtn');
  
  try {
    statusElement.textContent = 'Verificando...';
    indicatorElement.className = 'status-indicator';
    connectBtn.disabled = true;
    
    // Obtener estado actual del background script
    const statusResponse = await chrome.runtime.sendMessage({
      type: 'GET_CONNECTION_STATUS'
    });
    
    if (statusResponse && statusResponse.success) {
      const status = statusResponse.data;
      
      if (status.connected) {
        connectionStatus = true;
        statusElement.textContent = 'Conectado';
        indicatorElement.className = 'status-indicator status-connected';
        
        // Mostrar información adicional si está disponible
        if (status.appData) {
          const vaultStatus = status.appData.vaultLocked ? 'Bloqueado' : 'Desbloqueado';
          statusElement.title = `Versión: ${status.appData.version}\nVault: ${vaultStatus}\nÚltima verificación: ${new Date(status.lastCheck).toLocaleTimeString()}`;
        }
        
        // Habilitar botones que requieren conexión
        document.getElementById('fillFormsBtn').disabled = false;
        
      } else {
        throw new Error(status.error || 'No conectado');
      }
    } else {
      // Intentar verificación forzada
      const checkResponse = await chrome.runtime.sendMessage({
        type: 'CHECK_CONNECTION'
      });
      
      if (checkResponse && checkResponse.success) {
        connectionStatus = true;
        statusElement.textContent = 'Conectado';
        indicatorElement.className = 'status-indicator status-connected';
        document.getElementById('fillFormsBtn').disabled = false;
      } else {
        throw new Error(checkResponse?.error || 'Sin respuesta');
      }
    }
    
  } catch (error) {
    console.error('Error verificando conexión:', error);
    connectionStatus = false;
    statusElement.textContent = 'Desconectado';
    statusElement.title = `Error: ${error.message}`;
    indicatorElement.className = 'status-indicator status-disconnected';
    
    // Deshabilitar botones que requieren conexión
    document.getElementById('fillFormsBtn').disabled = true;
  } finally {
    connectBtn.disabled = false;
  }
}

// Detectar formularios en la página
async function detectForms() {
  const detectBtn = document.getElementById('detectFormsBtn');
  const formsCountElement = document.getElementById('formsCount');
  const formsSection = document.getElementById('formsSection');
  const formsList = document.getElementById('formsList');
  
  try {
    detectBtn.disabled = true;
    detectBtn.innerHTML = '<span>🔍</span> Detectando...';
    
    if (!currentTab || !currentTab.id) {
      throw new Error('No hay pestaña activa');
    }
    
    // Inyectar y ejecutar script de detección
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: detectFormsInPage
    });
    
    if (results && results[0] && results[0].result) {
      detectedForms = results[0].result;
      formsCountElement.textContent = detectedForms.length;
      
      if (detectedForms.length > 0) {
        displayDetectedForms(detectedForms, formsList);
        formsSection.style.display = 'block';
        
        // Habilitar botón de llenar si hay conexión
        if (connectionStatus) {
          document.getElementById('fillFormsBtn').disabled = false;
        }
      } else {
        formsSection.style.display = 'none';
        showNotification('No se encontraron formularios en esta página');
      }
    } else {
      throw new Error('No se pudieron detectar formularios');
    }
    
  } catch (error) {
    console.error('Error detectando formularios:', error);
    showError('Error al detectar formularios: ' + error.message);
    formsCountElement.textContent = '0';
    formsSection.style.display = 'none';
  } finally {
    detectBtn.disabled = false;
    detectBtn.innerHTML = '<span>🔍</span> Detectar formularios';
  }
}

// Función que se ejecuta en la página para detectar formularios
function detectFormsInPage() {
  const forms = [];
  const formElements = document.querySelectorAll('form');
  
  formElements.forEach((form, index) => {
    const inputs = form.querySelectorAll('input, select, textarea');
    const formData = {
      index: index,
      action: form.action || window.location.href,
      method: form.method || 'GET',
      fields: [],
      type: 'unknown'
    };
    
    // Analizar campos del formulario
    inputs.forEach(input => {
      if (input.type !== 'submit' && input.type !== 'button') {
        formData.fields.push({
          name: input.name || input.id || `field_${formData.fields.length}`,
          type: input.type || input.tagName.toLowerCase(),
          id: input.id,
          placeholder: input.placeholder || '',
          required: input.required
        });
      }
    });
    
    // Determinar tipo de formulario
    formData.type = determineFormType(formData.fields);
    
    if (formData.fields.length > 0) {
      forms.push(formData);
    }
  });
  
  return forms;
}

// Determinar el tipo de formulario basado en los campos
function determineFormType(fields) {
  const fieldNames = fields.map(f => (f.name + ' ' + f.placeholder).toLowerCase());
  const allFields = fieldNames.join(' ');
  
  if (allFields.includes('email') && allFields.includes('password')) {
    return 'login';
  } else if (allFields.includes('register') || allFields.includes('signup')) {
    return 'register';
  } else if (allFields.includes('address') || allFields.includes('street')) {
    return 'address';
  } else if (allFields.includes('contact') || allFields.includes('phone')) {
    return 'contact';
  } else {
    return 'form';
  }
}

// Mostrar formularios detectados
function displayDetectedForms(forms, container) {
  container.innerHTML = '';
  
  forms.forEach((form, index) => {
    const formItem = document.createElement('div');
    formItem.className = 'form-item';
    
    const typeIcons = {
      'login': '🔐',
      'register': '📝',
      'address': '📍',
      'contact': '📞',
      'form': '📋'
    };
    
    formItem.innerHTML = `
      <div class="form-type">${typeIcons[form.type] || '📋'} ${getFormTypeLabel(form.type)}</div>
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
        ${form.fields.length} campo(s) detectado(s)
      </div>
      <div class="form-url">${form.action}</div>
    `;
    
    container.appendChild(formItem);
  });
}

// Obtener etiqueta del tipo de formulario
function getFormTypeLabel(type) {
  const labels = {
    'login': 'Inicio de sesión',
    'register': 'Registro',
    'address': 'Dirección',
    'contact': 'Contacto',
    'form': 'Formulario'
  };
  return labels[type] || 'Formulario';
}

// Llenar formularios
async function fillForms() {
  const fillBtn = document.getElementById('fillFormsBtn');
  
  try {
    if (!connectionStatus) {
      throw new Error('No hay conexión con la aplicación');
    }
    
    if (detectedForms.length === 0) {
      throw new Error('No hay formularios detectados');
    }
    
    fillBtn.disabled = true;
    fillBtn.innerHTML = '<span>🔐</span> Llenando...';
    
    // Solicitar datos al background script
    const response = await chrome.runtime.sendMessage({
      action: 'getFormData',
      forms: detectedForms,
      url: currentTab.url
    });
    
    if (response && response.success && response.data) {
      // Inyectar script para llenar formularios
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: fillFormsInPage,
        args: [response.data]
      });
      
      showNotification('Formularios llenados correctamente');
    } else {
      throw new Error(response?.error || 'No se pudieron obtener los datos');
    }
    
  } catch (error) {
    console.error('Error llenando formularios:', error);
    showError('Error al llenar formularios: ' + error.message);
  } finally {
    fillBtn.disabled = false;
    fillBtn.innerHTML = '<span>🔐</span> Llenar formularios';
  }
}

// Función que se ejecuta en la página para llenar formularios
function fillFormsInPage(formData) {
  console.log('Llenando formularios con datos:', formData);
  
  const forms = document.querySelectorAll('form');
  let filledCount = 0;
  
  forms.forEach((form, index) => {
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.type === 'submit' || input.type === 'button') return;
      
      const fieldName = input.name || input.id || '';
      const fieldType = input.type || input.tagName.toLowerCase();
      
      // Buscar datos correspondientes
      let value = findValueForField(fieldName, fieldType, formData);
      
      if (value) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Resaltar campo llenado
        input.style.backgroundColor = '#e6ffed';
        input.style.border = '2px solid #10b981';
        
        filledCount++;
      }
    });
  });
  
  // Mostrar notificación en la página
  if (filledCount > 0) {
    showPageNotification(`${filledCount} campos llenados automáticamente`);
  }
}

// Buscar valor para un campo específico
function findValueForField(fieldName, fieldType, formData) {
  const name = fieldName.toLowerCase();
  
  // Mapeo de campos comunes
  const fieldMappings = {
    'email': formData.email?.email,
    'password': formData.email?.password,
    'username': formData.email?.name,
    'name': formData.personal?.name,
    'firstname': formData.personal?.firstName,
    'lastname': formData.personal?.lastName,
    'phone': formData.personal?.phone,
    'address': formData.address?.street,
    'street': formData.address?.street,
    'city': formData.address?.city,
    'state': formData.address?.state,
    'zip': formData.address?.zipCode,
    'zipcode': formData.address?.zipCode,
    'country': formData.address?.country
  };
  
  // Buscar coincidencia exacta
  if (fieldMappings[name]) {
    return fieldMappings[name];
  }
  
  // Buscar coincidencia parcial
  for (const [key, value] of Object.entries(fieldMappings)) {
    if (name.includes(key) && value) {
      return value;
    }
  }
  
  return null;
}

// Mostrar notificación en la página
function showPageNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Abrir aplicación
async function openApp() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'openApp'
    });
    
    if (response && response.success) {
      showNotification('Aplicación abierta');
    } else {
      throw new Error(response?.error || 'No se pudo abrir la aplicación');
    }
  } catch (error) {
    console.error('Error abriendo aplicación:', error);
    showError('Error al abrir la aplicación');
  }
}

// Abrir configuración
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Abrir ayuda
function openHelp() {
  chrome.tabs.create({
    url: 'https://github.com/tu-usuario/account-manager/wiki'
  });
}

// Mostrar notificación de éxito
function showNotification(message) {
  console.log('✅', message);
  // Aquí podrías implementar una notificación visual en el popup
}

// Mostrar error
function showError(message) {
  console.error('❌', message);
  // Aquí podrías implementar una notificación de error visual en el popup
}

// Mostrar loading
function showLoading(show = true) {
  const loadingSection = document.getElementById('loadingSection');
  loadingSection.style.display = show ? 'block' : 'none';
}