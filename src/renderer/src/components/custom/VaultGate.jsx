import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { getProjects, getAccounts } from '@/services/storage'

export default function VaultGate({ children }) {
  const [status, setStatus] = useState({ hasVault: false, locked: true, profiles: [] })
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [profileName, setProfileName] = useState('')
  const [selectedProfile, setSelectedProfile] = useState('')
  const [showPwdSetup, setShowPwdSetup] = useState(false)
  const [showPwdUnlock, setShowPwdUnlock] = useState(false)
  const [showConfirmSetup, setShowConfirmSetup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('unlock') // 'unlock' | 'setup'
  const [vaultData, setVaultData] = useState({ projectCount: 0, accountCount: 0 })
  const passwordInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!window.api?.vault) {
          console.warn('Vault API not available')
          if (mounted) {
            setStatus({ hasVault: false, locked: false, currentProfile: 'default', profiles: [] })
            setMode('setup')
          }
          return
        }
        
        const st = await window.api.vault.status()
        const profRes = await window.api.vault.profiles.list()
        const profiles = profRes?.profiles || []
        const cur = st?.currentProfile || profRes?.currentProfile || 'default'
        if (mounted) {
          setStatus({ hasVault: !!st?.hasVault, locked: !!st?.locked, currentProfile: cur, profiles })
          setSelectedProfile(cur)
          setMode(st?.hasVault ? 'unlock' : 'setup')
        }
      } catch (error) {
        console.error('Error loading vault status:', error)
        if (mounted) {
          setStatus({ hasVault: false, locked: false, currentProfile: 'default', profiles: [] })
          setMode('setup')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Cargar datos del vault seleccionado desde estadísticas no encriptadas
  useEffect(() => {
    const loadVaultData = async () => {
      if (!selectedProfile || selectedProfile === 'default') {
        setVaultData({ projectCount: 0, accountCount: 0 })
        return
      }
      
      try {
        // Obtener estadísticas desde el área no encriptada
        const statsResult = await window.api.vault.stats.get()
        if (statsResult?.ok && statsResult.stats) {
          const profileStats = statsResult.stats[selectedProfile]
          if (profileStats) {
            setVaultData({ 
              projectCount: profileStats.projectCount || 0, 
              accountCount: profileStats.accountCount || 0 
            })
            return
          }
        }
        
        // Fallback: cargar desde datos encriptados si no hay estadísticas
        if (status.hasVault && !status.locked) {
          const projects = await getProjects()
          const allAccounts = await getAccounts()
          const projectCount = projects.length
          const accountCount = allAccounts.length
          setVaultData({ projectCount, accountCount })
          
          // Actualizar estadísticas para futuras consultas
          await window.api.vault.stats.update(selectedProfile, projectCount, accountCount)
        }
      } catch (error) {
        console.error('Error loading vault data:', error)
        setVaultData({ projectCount: 0, accountCount: 0 })
      }
    }
    
    loadVaultData()
  }, [selectedProfile, status.hasVault, status.locked])

  // Foco automático en el campo de contraseña cuando se muestra el formulario
  useEffect(() => {
    if ((!status.hasVault || status.locked) && passwordInputRef.current) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [status.hasVault, status.locked, loading])

  // Función para manejar el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    const isSetup = mode === 'setup' || !status.hasVault
    if (isSetup) {
      await setupVault()
    } else {
      await unlockVault()
    }
  }

  const setupVault = async () => {
    if ((password || '').trim().length < 6) {
      toast.warning('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      toast.warning('Las contraseñas no coinciden')
      return
    }
    setBusy(true)
    try {
      // Siempre crear una nueva cuenta en modo "setup"
      const name = (profileName || '').trim()
      if (name.length === 0) {
        toast.warning('Ingresa el nombre de la cuenta')
        return
      }
      if (name.length > 20) {
        toast.warning('El nombre debe tener máximo 20 caracteres')
        return
      }
      const created = await window.api.vault.profiles.create(name)
      if (!created?.ok) {
        toast.error(created?.error || 'No se pudo crear la cuenta')
        return
      }
      setSelectedProfile(created.profileId)
      const res = await window.api.vault.setup(password, name)
      if (res?.ok) {
        toast.success('Vault configurado')
        const list = await window.api.vault.profiles.list()
        setStatus((s) => ({
          ...s,
          hasVault: true,
          locked: false,
          currentProfile: created.profileId,
          profiles: list?.profiles || s.profiles
        }))
      } else {
        toast.error(res?.error || 'No se pudo configurar')
      }
    } finally {
      setBusy(false)
    }
  }

  const unlockVault = async () => {
    if ((password || '').trim().length < 1) {
      toast.warning('Ingresa la contraseña')
      return
    }
    setBusy(true)
    try {
      const res = await window.api.vault.unlock(password, selectedProfile)
      if (res?.ok) {
        toast.success('Desbloqueado')
        setStatus((s) => ({ ...s, hasVault: true, locked: false, currentProfile: res.profileId || selectedProfile }))
      } else {
        toast.error(res?.error || 'Contraseña incorrecta')
      }
    } finally {
      setBusy(false)
    }
  }

  const deleteProfile = async () => {
    if ((password || '').trim().length < 1) {
      toast.warning('Ingresa la contraseña para eliminar')
      return
    }
    setBusy(true)
    try {
      const fn = window.api?.vault?.profiles?.delete || window.api?.vault?.profiles?.remove
      if (typeof fn !== 'function') {
        toast.error('Eliminar no está disponible. Reinicia la aplicación.')
        return
      }
      const res = await fn(selectedProfile, password)
      if (res?.ok) {
        toast.success(`Vault eliminado junto con ${vaultData.projectCount} proyecto(s) y ${vaultData.accountCount} cuenta(s)`)
        const list = await window.api.vault.profiles.list()
        const remaining = list?.profiles || []
        if (remaining.length === 0) {
          setStatus({ hasVault: false, locked: false, currentProfile: 'default', profiles: [] })
          setMode('setup')
          setSelectedProfile('')
          setPassword('')
          setConfirm('')
        } else {
          const nextId = res.nextProfileId || remaining[0].id
          setStatus((s) => ({ ...s, profiles: remaining, currentProfile: nextId }))
          setSelectedProfile(nextId)
        }
      } else {
        toast.error(res?.error || 'No se pudo eliminar la cuenta')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    )
  }

  // Gate UI
  if (!status.hasVault || status.locked) {
    const isSetup = mode === 'setup' || !status.hasVault
    return (
      <div className="h-screen _move w-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded border p-4 shadow-sm bg-background">
          <div className="text-lg font-medium mb-1">
            {isSetup ? 'Configurar contraseña maestra' : 'Desbloquear'}
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {isSetup
              ? 'Esta contraseña protegerá toda la información (proyectos, cuentas, notas).'
              : 'Ingresa la contraseña maestra para acceder a la información cifrada.'}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-y-3">
          {status.profiles?.length > 0 && !isSetup && (
            <div className="grid gap-2 mb-2">
              <Label>Cuenta</Label>
              <Select value={selectedProfile} onValueChange={(v) => setSelectedProfile(v)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {status.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isSetup && (
            <div className="grid gap-2 mb-2">
              <Label>Nombre de la cuenta</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Mi cuenta"
                maxLength={20}
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Contraseña</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={passwordInputRef}
                type={
                  isSetup
                    ? showPwdSetup
                      ? 'text'
                      : 'password'
                    : showPwdUnlock
                      ? 'text'
                      : 'password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-9 w-9 p-0 border border-border"
                onClick={() => (isSetup ? setShowPwdSetup((v) => !v) : setShowPwdUnlock((v) => !v))}
              >
                {isSetup ? (
                  !showPwdSetup ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )
                ) : !showPwdUnlock ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </div>
          {isSetup && (
            <div className="grid gap-2 mt-2">
              <Label>Confirmar contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showConfirmSetup ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 w-9 p-0 border border-border"
                  onClick={() => setShowConfirmSetup((v) => !v)}
                >
                  {!showConfirmSetup ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
            <Separator className="my-3" />
            <Button type="submit" disabled={busy} className="w-full">
              {isSetup ? 'Guardar y activar' : 'Desbloquear'}
            </Button>
          </form>
          <div className="mt-2 w-full flex items-center justify-between">
            {status.profiles?.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode((m) => (m === 'unlock' ? 'setup' : 'unlock'))}
              >
                {mode === 'unlock' ? 'Crear nueva cuenta' : 'Volver a iniciar'}
              </Button>
            )}
            {!isSetup && status.profiles?.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={busy}>
                    Eliminar Profile
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      ¿Eliminar vault "
                      {status.profiles.find((p) => p.id === selectedProfile)?.name ||
                        selectedProfile}
                      "?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente:
                      <br />• El Profile y su configuración
                      <br />• {vaultData.projectCount} proyecto(s)
                      <br />• {vaultData.accountCount} cuenta(s)
                      <br />• Todas las notas y configuraciones asociadas
                      <br />
                      <br />
                      Ingresa tu contraseña para confirmar:
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-4">
                    <Input
                      type="password"
                      placeholder="Contraseña del Profile"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPassword('')}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteProfile}
                      disabled={busy || !password.trim()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar Profile y todos los datos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    )
  }

  return children
}