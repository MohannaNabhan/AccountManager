// Content script para Account Manager Extension

console.log('Account Manager Extension: Content script cargado');

// Configuración
const CONFIG = {
  autoDetect: true,
  showNotifications: true,
  highlightFields: true
};

// Estado de la extensión
let detectedForms = [];
let isExtensionActive = false;

// Detectar formularios de login/registro
function detectForms() {
  const forms = document.querySelectorAll('form');
  const detectedFormData = [];
  
  forms.forEach((form, index) => {
    const formData = analyzeForm(form, index);
    if (formData.isLoginForm || formData.isRegisterForm) {
      detectedFormData.push(formData);
    }
  });
  
  detectedForms = detectedFormData;
  
  if (detectedForms.length > 0 && CONFIG.showNotifications) {
    showFormDetectedNotification(detectedForms.length);
  }
  
  return detectedForms;
}

// Analizar un formulario específico
function analyzeForm(form, index) {
  const inputs = form.querySelectorAll('input');
  const formData = {
    index,
    element: form,
    action: form.action || window.location.href,
    method: form.method || 'GET',
    fields: [],
    isLoginForm: false,
    isRegisterForm: false,
    hasEmail: false,
    hasPassword: false,
    hasUsername: false
  };
  
  inputs.forEach(input => {
    const fieldData = analyzeField(input);
    if (fieldData) {
      formData.fields.push(fieldData);
      
      // Determinar tipo de formulario
      if (fieldData.type === 'email') formData.hasEmail = true;
      if (fieldData.type === 'password') formData.hasPassword = true;
      if (fieldData.type === 'username') formData.hasUsername = true;
    }
  });
  
  // Clasificar formulario
  if (formData.hasPassword && (formData.hasEmail || formData.hasUsername)) {
    if (formData.fields.length <= 3) {
      formData.isLoginForm = true;
    } else {
      formData.isRegisterForm = true;
    }
  }
  
  return formData;
}

// Analizar un campo específico
function analyzeField(input) {
  if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
    return null;
  }
  
  const fieldData = {
    element: input,
    name: input.name,
    id: input.id,
    type: input.type,
    placeholder: input.placeholder,
    value: input.value,
    required: input.required,
    autocomplete: input.autocomplete
  };
  
  // Detectar tipo de campo por atributos y nombres
  const fieldIdentifiers = (input.name + ' ' + input.id + ' ' + input.placeholder + ' ' + input.autocomplete).toLowerCase();
  
  if (fieldIdentifiers.includes('email') || input.type === 'email') {
    fieldData.type = 'email';
  } else if (fieldIdentifiers.includes('password') || input.type === 'password') {
    fieldData.type = 'password';
  } else if (fieldIdentifiers.includes('username') || fieldIdentifiers.includes('user') || fieldIdentifiers.includes('login')) {
    fieldData.type = 'username';
  } else if (fieldIdentifiers.includes('phone') || fieldIdentifiers.includes('tel') || input.type === 'tel') {
    fieldData.type = 'phone';
  } else if (fieldIdentifiers.includes('name') && !fieldIdentifiers.includes('username')) {
    fieldData.type = 'name';
  }
  
  return fieldData;
}

// Llenar formulario con datos
function fillForm(formData, autoFormData) {
  if (!formData || !autoFormData) return false;
  
  let filledFields = 0;
  
  formData.fields.forEach(field => {
    const input = field.element;
    let valueToFill = '';
    
    // Mapear datos según el tipo de campo
    switch (field.type) {
      case 'email':
        if (autoFormData.email && autoFormData.email.length > 0) {
          valueToFill = autoFormData.email[0].email;
        }
        break;
      case 'username':
        if (autoFormData.personal && autoFormData.personal.length > 0) {
          valueToFill = autoFormData.personal[0].firstName || autoFormData.personal[0].name;
        }
        break;
      case 'password':
        // No llenar contraseñas automáticamente por seguridad
        break;
      case 'name':
        if (autoFormData.personal && autoFormData.personal.length > 0) {
          valueToFill = `${autoFormData.personal[0].firstName || ''} ${autoFormData.personal[0].lastName || ''}`.trim();
        }
        break;
      case 'phone':
        if (autoFormData.personal && autoFormData.personal.length > 0) {
          valueToFill = autoFormData.personal[0].phone;
        }
        break;
    }
    
    if (valueToFill && input.value === '') {
      input.value = valueToFill;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      filledFields++;
      
      if (CONFIG.highlightFields) {
        highlightField(input);
      }
    }
  });
  
  return filledFields > 0;
}

// Resaltar campo llenado
function highlightField(input) {
  const originalBorder = input.style.border;
  input.style.border = '2px solid #4CAF50';
  input.style.transition = 'border 0.3s ease';
  
  setTimeout(() => {
    input.style.border = originalBorder;
  }, 2000);
}

// Mostrar notificación de formularios detectados
function showFormDetectedNotification(count) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2196F3;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      cursor: pointer;
    ">
      🔐 Account Manager: ${count} formulario(s) detectado(s)
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
        Haz clic para llenar automáticamente
      </div>
    </div>
  `;
  
  notification.onclick = () => {
    requestAutoFill();
    document.body.removeChild(notification);
  };
  
  document.body.appendChild(notification);
  
  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 5000);
}

// Solicitar auto-llenado
function requestAutoFill() {
  chrome.runtime.sendMessage({
    type: 'GET_AUTOFORM_DATA',
    url: window.location.href
  }, (response) => {
    if (response && response.data) {
      fillDetectedForms(response.data);
    }
  });
}

// Llenar formularios detectados
function fillDetectedForms(autoFormData) {
  let totalFilled = 0;
  
  detectedForms.forEach(formData => {
    if (fillForm(formData, autoFormData)) {
      totalFilled++;
    }
  });
  
  if (totalFilled > 0) {
    showSuccessNotification(`${totalFilled} formulario(s) llenado(s)`);
  }
}

// Mostrar notificación de éxito
function showSuccessNotification(message) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
    ">
      ✅ ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

// Capturar datos de formulario al enviar
function captureFormData(form) {
  const formData = analyzeForm(form, 0);
  const capturedData = {};
  
  formData.fields.forEach(field => {
    if (field.value && field.type !== 'password') {
      capturedData[field.type] = field.value;
    }
  });
  
  if (Object.keys(capturedData).length > 0) {
    chrome.runtime.sendMessage({
      type: 'SAVE_FORM_DATA',
      data: capturedData,
      url: window.location.href
    });
  }
}

// Escuchar mensajes del background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'DETECT_FORMS':
      const forms = detectForms();
      sendResponse({ forms: forms.length });
      break;
      
    case 'FILL_FORM_DATA':
      fillDetectedForms(message.data);
      sendResponse({ success: true });
      break;
      
    case 'GET_DETECTED_FORMS':
      sendResponse({ forms: detectedForms });
      break;
      
    default:
      sendResponse({ error: 'Mensaje no reconocido' });
  }
});

// Inicialización
function initialize() {
  // Detectar formularios al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectForms);
  } else {
    detectForms();
  }
  
  // Observar cambios en el DOM
  const observer = new MutationObserver((mutations) => {
    let shouldRedetect = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'FORM' || node.querySelector('form'))) {
            shouldRedetect = true;
          }
        });
      }
    });
    
    if (shouldRedetect) {
      setTimeout(detectForms, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Capturar envío de formularios
  document.addEventListener('submit', (event) => {
    if (event.target.tagName === 'FORM') {
      captureFormData(event.target);
    }
  });
  
  console.log('Account Manager Extension: Inicializado correctamente');
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}