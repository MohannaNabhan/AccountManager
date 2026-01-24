// JavaScript para la página de bienvenida de Account Manager Extension

document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de bienvenida cargada');
    
    // Elementos del DOM
    const statusSection = document.getElementById('status-section');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const checkButton = document.getElementById('check-connection');
    const openAppButton = document.getElementById('open-app');
    const closeTabButton = document.getElementById('close-tab');
    const checkLoading = document.getElementById('check-loading');

    // Verificar conexión automáticamente al cargar
    setTimeout(checkConnection, 1000);

    // Event listeners
    checkButton.addEventListener('click', checkConnection);
    openAppButton.addEventListener('click', openAccountManager);
    closeTabButton.addEventListener('click', closeCurrentTab);

    // Función para verificar la conexión con Account Manager
    async function checkConnection() {
        setLoadingState(true);
        updateStatus('checking', 'Checking connection...', 'Verifying if Account Manager is available');

        try {
            const response = await fetch('http://localhost:8765/status', {
                method: 'GET',
                signal: AbortSignal.timeout(10000) // 10 segundos timeout
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Connection successful:', data);
                
                updateStatus('success', '✅ Connection Successful', 
                    `Account Manager is running correctly. Version: ${data.version || 'N/A'}`);
                
                // Guardar estado de conexión
                await saveConnectionStatus(true);
                
                // Habilitar funcionalidades
                enableExtensionFeatures();
                
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Connection error:', error);
            
            let errorMessage = 'Could not connect to Account Manager. ';
            
            if (error.name === 'AbortError') {
                errorMessage += 'The connection timed out.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage += 'Ensure the application is running.';
            } else {
                errorMessage += error.message;
            }
            
            updateStatus('error', '❌ Connection Error', errorMessage);
            
            // Guardar estado de conexión
            await saveConnectionStatus(false);
        } finally {
            setLoadingState(false);
        }
    }

    // Función para abrir Account Manager
    async function openAccountManager() {
        try {
            // Intentar abrir a través de la API
            const response = await fetch('http://localhost:8765/show-app', {
                method: 'POST',
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                console.log('Account Manager opened successfully');
                updateStatus('success', '✅ Application Opened', 
                    'Account Manager has been opened in the foreground');
            } else {
                throw new Error('Could not open the application');
            }
        } catch (error) {
            console.error('Error opening Account Manager:', error);
            
            // Fallback: intentar abrir manualmente
            const userConfirm = confirm(
                'Could not open Account Manager automatically.\n\n' +
                'Do you want to open the application manually?\n' +
                'Location: C:/AccountManager/'
            );
            
            if (userConfirm) {
                // Mostrar instrucciones
                alert(
                    'To open Account Manager manually:\n\n' +
                    '1. Open the installation folder\n' +
                    '2. Run the application\n' +
                    '3. Return here and click "Verify Connection"'
                );
            }
        }
    }

    // Función para cerrar la pestaña actual
    function closeCurrentTab() {
        if (confirm('¿Estás seguro de que deseas cerrar esta pestaña?')) {
            chrome.tabs.getCurrent((tab) => {
                chrome.tabs.remove(tab.id);
            });
        }
    }

    // Función para actualizar el estado visual
    function updateStatus(type, title, message) {
        statusTitle.textContent = title;
        statusMessage.textContent = message;
        
        // Remover clases anteriores
        statusSection.classList.remove('connected', 'disconnected');
        
        // Agregar clase según el tipo
        if (type === 'success') {
            statusSection.classList.add('connected');
        } else if (type === 'error') {
            statusSection.classList.add('disconnected');
        } else {
             // Default/Checking state
             statusSection.classList.add('disconnected');
        }
        
        // Actualizar icono según el estado
        const statusIcon = document.getElementById('status-icon');
        switch (type) {
            case 'checking':
                statusIcon.textContent = '⏳';
                break;
            case 'success':
                statusIcon.textContent = '✅';
                break;
            case 'error':
                statusIcon.textContent = '❌';
                break;
            default:
                statusIcon.textContent = '❓';
        }
    }

    // Función para manejar el estado de carga
    function setLoadingState(loading) {
        if (loading) {
            checkLoading.classList.remove('hidden');
            checkButton.disabled = true;
            checkButton.style.opacity = '0.7';
        } else {
            checkLoading.classList.add('hidden');
            checkButton.disabled = false;
            checkButton.style.opacity = '1';
        }
    }

    // Función para guardar el estado de conexión
    async function saveConnectionStatus(connected) {
        try {
            await chrome.storage.local.set({
                'am_connection_status': {
                    connected: connected,
                    lastCheck: new Date().toISOString(),
                    url: 'http://localhost:8765'
                }
            });
        } catch (error) {
            console.error('Error guardando estado de conexión:', error);
        }
    }

    // Función para habilitar características de la extensión
    function enableExtensionFeatures() {
        // Aquí se pueden habilitar características adicionales
        console.log('Características de la extensión habilitadas');
        
        // Actualizar badge de la extensión
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        
        // Notificar al background script
        chrome.runtime.sendMessage({
            type: 'CONNECTION_ESTABLISHED',
            timestamp: new Date().toISOString()
        }).catch(error => {
            console.log('Background script no disponible:', error);
        });
    }

    // Función para obtener información del sistema
    async function getSystemInfo() {
        try {
            const info = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                timestamp: new Date().toISOString()
            };
            
            console.log('Información del sistema:', info);
            return info;
        } catch (error) {
            console.error('Error obteniendo información del sistema:', error);
            return null;
        }
    }

    // Función para manejar errores globales
    window.addEventListener('error', (event) => {
        console.error('Error global en welcome.js:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Promise rechazada en welcome.js:', event.reason);
    });

    // Obtener información del sistema al cargar
    getSystemInfo();

    // Verificar si hay actualizaciones de la extensión
    chrome.runtime.getManifest && checkForUpdates();

    function checkForUpdates() {
        try {
            const manifest = chrome.runtime.getManifest();
            console.log('Versión actual de la extensión:', manifest.version);
            
            // Aquí se podría implementar lógica para verificar actualizaciones
            // Por ahora solo registramos la versión actual
        } catch (error) {
            console.error('Error verificando actualizaciones:', error);
        }
    }

    // Configurar shortcuts de teclado
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + R para verificar conexión
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            checkConnection();
        }
        
        // Escape para cerrar pestaña
        if (event.key === 'Escape') {
            closeCurrentTab();
        }
    });

    console.log('Welcome.js inicializado correctamente');
});