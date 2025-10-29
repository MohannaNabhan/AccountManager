# Account Manager - Extensión de Chrome

Esta extensión de Chrome permite la comunicación entre tu navegador y la aplicación Account Manager de Electron, facilitando el auto-llenado de formularios web con tus datos guardados.

## 🚀 Características

- **Auto-detección de formularios**: Detecta automáticamente formularios de login, registro, contacto y direcciones
- **Auto-llenado inteligente**: Llena formularios con datos de tu aplicación Account Manager
- **Comunicación segura**: Se conecta de forma segura con tu aplicación local
- **Interfaz intuitiva**: Popup fácil de usar con estado de conexión en tiempo real
- **Soporte múltiple**: Compatible con diferentes tipos de formularios web

## 📋 Requisitos

- Google Chrome (versión 88 o superior)
- Aplicación Account Manager ejecutándose en tu sistema
- Puerto 8765 disponible para comunicación local

## 🔧 Instalación

### Método 1: Instalación manual (Desarrollo)

1. **Abrir Chrome y navegar a las extensiones**:
   ```
   chrome://extensions/
   ```

2. **Habilitar el modo de desarrollador**:
   - Activa el toggle "Modo de desarrollador" en la esquina superior derecha

3. **Cargar la extensión**:
   - Haz clic en "Cargar extensión sin empaquetar"
   - Selecciona la carpeta: `c:\Users\titan\Documents\GitHub\AccountManager\extension\chrome`

4. **Verificar instalación**:
   - La extensión debería aparecer en tu lista de extensiones
   - Verás el icono de Account Manager en la barra de herramientas

### Método 2: Instalación desde archivo .crx (Producción)

1. Empaqueta la extensión desde Chrome
2. Instala el archivo .crx generado

## 🎯 Uso

### Configuración inicial

1. **Ejecutar Account Manager**:
   - Asegúrate de que la aplicación Account Manager esté ejecutándose
   - La aplicación debe estar desbloqueada (vault abierto)

2. **Verificar conexión**:
   - Haz clic en el icono de la extensión
   - Verifica que el estado muestre "Conectado"

### Auto-llenado de formularios

1. **Navegar a una página con formularios**:
   - Ve a cualquier sitio web con formularios de login, registro, etc.

2. **Detectar formularios**:
   - La extensión detectará automáticamente los formularios
   - También puedes hacer clic en "Detectar formularios" manualmente

3. **Llenar formularios**:
   - Haz clic en "Llenar formularios" en el popup
   - Los campos se llenarán automáticamente con tus datos

### Funciones del popup

- **Estado de conexión**: Muestra si la extensión está conectada a Account Manager
- **Contador de formularios**: Indica cuántos formularios se detectaron
- **Página actual**: Muestra el dominio de la página actual
- **Botones de acción**:
  - 🔐 **Llenar formularios**: Auto-llena los formularios detectados
  - 🔍 **Detectar formularios**: Busca formularios en la página actual
  - 🚀 **Abrir aplicación**: Muestra la ventana de Account Manager
  - 🔗 **Reconectar**: Intenta reconectar con la aplicación

## 🔒 Seguridad

- **Comunicación local**: Solo se comunica con `localhost:8765`
- **Sin datos en la nube**: Todos los datos permanecen en tu sistema local
- **Encriptación**: Los datos están encriptados en la aplicación Account Manager
- **Permisos mínimos**: Solo solicita permisos necesarios para funcionar

## 🛠️ Configuración avanzada

### Cambiar puerto de comunicación

Si necesitas cambiar el puerto por defecto (8765):

1. Edita `config.js`:
   ```javascript
   ELECTRON_APP_URL: 'http://localhost:NUEVO_PUERTO'
   ```

2. Actualiza la aplicación Account Manager para usar el mismo puerto

### Personalizar selectores de formularios

Puedes modificar los selectores CSS en `config.js` para mejorar la detección:

```javascript
FORM_SELECTORS: {
  EMAIL: [
    'input[type="email"]',
    'input[name*="email"]',
    // Agregar más selectores aquí
  ]
}
```

## 🐛 Solución de problemas

### La extensión no se conecta

1. **Verificar que Account Manager esté ejecutándose**
2. **Comprobar que el vault esté desbloqueado**
3. **Verificar que el puerto 8765 esté disponible**
4. **Revisar la consola del navegador** (F12 → Console)

### Los formularios no se detectan

1. **Hacer clic en "Detectar formularios" manualmente**
2. **Verificar que la página tenga formularios válidos**
3. **Comprobar que la URL no esté en la lista de exclusiones**

### Los campos no se llenan correctamente

1. **Verificar que tienes datos guardados en Account Manager**
2. **Comprobar que los tipos de datos coincidan con el formulario**
3. **Revisar los selectores CSS en la configuración**

## 📝 Logs y depuración

Para habilitar logs detallados:

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña Console
3. Los logs aparecerán con el prefijo `[Account Manager]`

## 🔄 Actualizaciones

Para actualizar la extensión:

1. **Modo desarrollador**: Haz clic en el botón de recarga en `chrome://extensions/`
2. **Instalación normal**: La extensión se actualizará automáticamente

## 📞 Soporte

Si encuentras problemas:

1. Revisa la sección de solución de problemas
2. Verifica los logs en la consola del navegador
3. Asegúrate de tener la versión más reciente de Account Manager

## 🔐 Permisos explicados

- **activeTab**: Para interactuar con la pestaña actual
- **storage**: Para guardar configuraciones locales
- **host permissions**: Para comunicarse con localhost:8765

## 📄 Licencia

Esta extensión es parte del proyecto Account Manager y está sujeta a la misma licencia.