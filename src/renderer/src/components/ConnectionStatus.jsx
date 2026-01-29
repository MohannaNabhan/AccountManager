import React, { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Wifi, WifiOff, Server, Activity, Clock, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  })

  const [isOpen, setIsOpen] = useState(false)

  const checkExtensionStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true }))
    try {
      const result = await window.api.extension.getStatus()
      setStatus({
        ...result,
        loading: false
      })
    } catch (error) {
      console.error('Error getting extension status:', error)
      setStatus(prev => ({
        ...prev,
        connected: false,
        loading: false
      }))
    }
  }

  useEffect(() => {
    checkExtensionStatus()
    // Verificar estado cada 10 segundos
    const interval = setInterval(checkExtensionStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full animate-pulse",
            status.loading ? "bg-yellow-400" : (status.connected ? "bg-green-500" : "bg-red-500")
          )} />
          <span className="hidden md:inline text-sm font-medium text-muted-foreground hover:text-foreground">
            {status.loading ? 'Checking...' : (status.connected ? 'Extension Connected' : 'Extension Disconnected')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b bg-muted/40">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold leading-none">Extension Status</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={checkExtensionStatus}
              disabled={status.loading}
              title="Refresh status"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", status.loading && "animate-spin")} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {status.connected ? 'The extension is connected and working.' : 'The extension is not detected.'}
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                <span className="text-xs">HTTP Server</span>
              </div>
              <div className={cn("font-medium", status.serverRunning ? "text-green-600 dark:text-green-400" : "text-red-600")}>
                {status.serverRunning ? `Active (:${status.serverPort})` : 'Inactive'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                <span className="text-xs">Activity</span>
              </div>
              <div className="font-medium">
                {formatTime(status.lastActivity)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LinkIcon className="h-3.5 w-3.5" />
                <span className="text-xs">Connections</span>
              </div>
              <div className="font-medium">
                {status.stats?.activeConnections || 0} / {status.stats?.totalConnections || 0}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Last seen</span>
              </div>
              <div className="font-medium">
                {formatDate(status.stats?.lastConnection)}
              </div>
            </div>
          </div>

          {!status.connected && status.serverRunning && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Suggestions:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Install and enable the extension</li>
                <li>Reload target page</li>
                <li>Check port {status.serverPort}</li>
              </ul>
            </div>
          )}

          {!status.serverRunning && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
              <p className="font-semibold">Local server is not running.</p>
              <p>Restart the application.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ConnectionStatus