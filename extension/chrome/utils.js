// Utilidades para la extensión Account Manager

// Función para hacer peticiones HTTP con timeout y retry
async function makeHttpRequest(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: getConfigValue('TIMEOUTS.API_REQUEST') || 10000
  };

  const finalOptions = { ...defaultOptions, ...options };
  const maxRetries = getConfigValue('SECURITY.MAX_RETRY_ATTEMPTS') || 3;
  const retryDelay = getConfigValue('SECURITY.RETRY_DELAY') || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      log('warn', `Intento ${attempt}/${maxRetries} falló:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Falló después de ${maxRetries} intentos: ${error.message}`);
      }

      // Esperar antes del siguiente intento
      await sleep(retryDelay * attempt);
    }
  }
}

// Función para dormir/esperar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para validar URLs
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Función para obtener el dominio de una URL
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return 'Desconocido';
  }
}

// Función para sanitizar texto
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[<>]/g, '');
}

// Función para generar ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Función para debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Función para throttle
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Función para detectar el tipo de campo basado en atributos
function detectFieldType(element) {
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const placeholder = (element.placeholder || '').toLowerCase();
  const type = (element.type || '').toLowerCase();
  const className = (element.className || '').toLowerCase();

  const allText = `${name} ${id} ${placeholder} ${className}`.toLowerCase();

  // Detectar email
  if (type === 'email' || allText.includes('email') || allText.includes('correo')) {
    return 'email';
  }

  // Detectar contraseña
  if (type === 'password' || allText.includes('password') || allText.includes('contraseña')) {
    return 'password';
  }

  // Detectar teléfono
  if (type === 'tel' || allText.includes('phone') || allText.includes('telefono') || allText.includes('móvil')) {
    return 'phone';
  }

  // Detectar nombre
  if (allText.includes('name') || allText.includes('nombre') || allText.includes('firstname') || allText.includes('lastname')) {
    return 'name';
  }

  // Detectar dirección
  if (allText.includes('address') || allText.includes('direccion') || allText.includes('street') || allText.includes('calle')) {
    return 'address';
  }

  // Detectar ciudad
  if (allText.includes('city') || allText.includes('ciudad')) {
    return 'city';
  }

  // Detectar estado/provincia
  if (allText.includes('state') || allText.includes('province') || allText.includes('provincia') || allText.includes('estado')) {
    return 'state';
  }

  // Detectar código postal
  if (allText.includes('zip') || allText.includes('postal') || allText.includes('codigo')) {
    return 'zip';
  }

  // Detectar país
  if (allText.includes('country') || allText.includes('pais')) {
    return 'country';
  }

  return 'unknown';
}

// Función para obtener todos los formularios de la página
function getAllForms() {
  const forms = [];
  const formElements = document.querySelectorAll('form');

  formElements.forEach((form, index) => {
    const formData = analyzeForm(form, index);
    if (formData.fields.length > 0) {
      forms.push(formData);
    }
  });

  return forms;
}

// Función para analizar un formulario específico
function analyzeForm(form, index) {
  const inputs = form.querySelectorAll('input, select, textarea');
  const formData = {
    index: index,
    element: form,
    action: form.action || window.location.href,
    method: form.method || 'GET',
    fields: [],
    type: 'unknown'
  };

  // Analizar cada campo
  inputs.forEach(input => {
    if (input.type === 'submit' || input.type === 'button' || input.type === 'hidden') {
      return;
    }

    const fieldData = {
      element: input,
      name: input.name || input.id || `field_${formData.fields.length}`,
      type: detectFieldType(input),
      id: input.id,
      placeholder: input.placeholder || '',
      required: input.required,
      value: input.value || ''
    };

    formData.fields.push(fieldData);
  });

  // Determinar tipo de formulario
  formData.type = determineFormType(formData);

  return formData;
}

// Función para determinar el tipo de formulario
function determineFormType(formData) {
  const fieldTypes = formData.fields.map(f => f.type);
  const formText = (formData.action + ' ' + formData.element.textContent).toLowerCase();

  // Login form
  if (fieldTypes.includes('email') && fieldTypes.includes('password')) {
    if (formText.includes('login') || formText.includes('signin') || formText.includes('iniciar')) {
      return 'login';
    }
  }

  // Register form
  if (fieldTypes.includes('email')) {
    if (formText.includes('register') || formText.includes('signup') || formText.includes('registro')) {
      return 'register';
    }
  }

  // Address form
  if (fieldTypes.includes('address') || fieldTypes.includes('city')) {
    return 'address';
  }

  // Contact form
  if (fieldTypes.includes('email') && fieldTypes.includes('name')) {
    if (formText.includes('contact') || formText.includes('contacto')) {
      return 'contact';
    }
  }

  return 'form';
}

// Función para resaltar un elemento
function highlightElement(element, type = 'success') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b'
  };

  const originalStyle = {
    backgroundColor: element.style.backgroundColor,
    border: element.style.border,
    transition: element.style.transition
  };

  // Aplicar resaltado
  element.style.transition = 'all 0.3s ease';
  element.style.backgroundColor = colors[type] + '20';
  element.style.border = `2px solid ${colors[type]}`;

  // Remover resaltado después de un tiempo
  setTimeout(() => {
    element.style.backgroundColor = originalStyle.backgroundColor;
    element.style.border = originalStyle.border;
    element.style.transition = originalStyle.transition;
  }, 2000);
}

// Función para mostrar notificación en la página
function showPageNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  const config = getConfigValue('NOTIFICATIONS') || {};
  const styles = config.STYLES?.[type.toUpperCase()] || config.STYLES?.INFO || {};

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${styles.background || '#3b82f6'};
    color: ${styles.color || 'white'};
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `;

  // Agregar animación CSS
  if (!document.getElementById('am-notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'am-notification-styles';
    styleSheet.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Remover notificación
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);

  return notification;
}

// Función para validar datos de formulario
function validateFormData(data) {
  const errors = [];

  if (data.email && !isValidEmail(data.email)) {
    errors.push('Email no válido');
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Teléfono no válido');
  }

  return errors;
}

// Función para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para validar teléfono
function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Función para obtener estadísticas de la página
function getPageStats() {
  return {
    url: window.location.href,
    domain: getDomain(window.location.href),
    title: document.title,
    forms: getAllForms().length,
    inputs: document.querySelectorAll('input').length,
    timestamp: new Date().toISOString()
  };
}

// Función para limpiar datos sensibles de logs
function sanitizeForLogging(data) {
  const sensitiveFields = ['password', 'token', 'key', 'secret'];
  const cleaned = { ...data };

  function cleanObject(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleanObject(obj[key]);
      } else if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      }
    }
  }

  cleanObject(cleaned);
  return cleaned;
}

// Exportar funciones para uso en otros archivos
if (typeof window !== 'undefined') {
  window.AccountManagerUtils = {
    makeHttpRequest,
    sleep,
    isValidUrl,
    getDomain,
    sanitizeText,
    generateId,
    debounce,
    throttle,
    detectFieldType,
    getAllForms,
    analyzeForm,
    determineFormType,
    highlightElement,
    showPageNotification,
    validateFormData,
    isValidEmail,
    isValidPhone,
    getPageStats,
    sanitizeForLogging
  };
}