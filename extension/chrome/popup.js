// Estado global del popup
let connectionStatus = false;

// Inicializar popup
document.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
});

// Verificar conexión con la aplicación
async function checkConnection() {
  const statusLabel = document.getElementById('connectionStatus');
  const statusBadge = document.getElementById('statusBadge');
  
  try {
    statusLabel.textContent = 'Checking...';
    
    // Obtener estado actual del background script
    const statusResponse = await chrome.runtime.sendMessage({
      type: 'GET_CONNECTION_STATUS'
    });
    
    if (statusResponse && statusResponse.success && statusResponse.data.connected) {
      updateUIStatus(true);
    } else {
      // Intentar verificación forzada
      const checkResponse = await chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' });
      updateUIStatus(checkResponse?.success && checkResponse?.data?.connected);
    }
  } catch (error) {
    updateUIStatus(false);
  }
}

function updateUIStatus(connected) {
  const statusLabel = document.getElementById('connectionStatus');
  const statusBadge = document.getElementById('statusBadge');
  connectionStatus = connected;
  
  statusBadge.className = 'status-badge ' + (connected ? 'connected' : 'disconnected');
  statusLabel.textContent = connected ? 'Connected' : 'Disconnected';
}

