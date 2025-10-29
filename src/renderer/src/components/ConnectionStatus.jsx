import React, { useState, useEffect } from 'react';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
  const [status, setStatus] = useState({
    connected: false,
    lastActivity: null,
    stats: {
      totalConnections: 0,
      activeConnections: 0,
      lastConnection: null
    },
    serverRunning: false,
    serverPort: null,
    loading: true
  });

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    checkExtensionStatus();
    
    // Verificar estado cada 10 segundos
    const interval = setInterval(checkExtensionStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const checkExtensionStatus = async () => {
    try {
      const result = await window.api.extension.getStatus();
      setStatus({
        ...result,
        loading: false
      });
    } catch (error) {
      console.error('Error obteniendo estado de extensión:', error);
      setStatus(prev => ({
        ...prev,
        connected: false,
        loading: false
      }));
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = () => {
    if (status.loading) return '#fbbf24'; // amarillo
    return status.connected ? '#10b981' : '#ef4444'; // verde o rojo
  };

  const getStatusText = () => {
    if (status.loading) return 'Verificando...';
    return status.connected ? 'Extensión Conectada' : 'Extensión Desconectada';
  };

  return (
    <div className="connection-status">
      <div 
        className="connection-status-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="status-indicator">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>
        
        <div className="status-actions">
          <button 
            className="refresh-btn"
            onClick={(e) => {
              e.stopPropagation();
              checkExtensionStatus();
            }}
            disabled={status.loading}
          >
            🔄
          </button>
          <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div className="connection-status-details">
          <div className="status-grid">
            <div className="status-item">
              <label>Servidor HTTP:</label>
              <span className={status.serverRunning ? 'status-ok' : 'status-error'}>
                {status.serverRunning ? `Activo (Puerto ${status.serverPort})` : 'Inactivo'}
              </span>
            </div>
            
            <div className="status-item">
              <label>Última Actividad:</label>
              <span>{formatTime(status.lastActivity)}</span>
            </div>
            
            <div className="status-item">
              <label>Conexiones Activas:</label>
              <span>{status.stats.activeConnections}</span>
            </div>
            
            <div className="status-item">
              <label>Total Conexiones:</label>
              <span>{status.stats.totalConnections}</span>
            </div>
            
            <div className="status-item">
              <label>Última Conexión:</label>
              <span>{formatDate(status.stats.lastConnection)}</span>
            </div>
          </div>
          
          {!status.connected && status.serverRunning && (
            <div className="status-help">
              <p>💡 <strong>Sugerencias:</strong></p>
              <ul>
                <li>Verifica que la extensión esté instalada y habilitada</li>
                <li>Recarga la página web donde quieres usar la extensión</li>
                <li>Comprueba que no haya un firewall bloqueando el puerto {status.serverPort}</li>
              </ul>
            </div>
          )}
          
          {!status.serverRunning && (
            <div className="status-help error">
              <p>⚠️ <strong>Servidor HTTP no está funcionando</strong></p>
              <p>La extensión no puede conectarse sin el servidor HTTP activo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;