import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { onStorageUpdate, KEYS, storageGet, storageSet } from '@/services/storage'

export default function ImportPrompt() {
  const [open, setOpen] = useState(false)
  const [scan, setScan] = useState({ exists: false, hasContent: false, path: '', folders: [] })
  const [currentProfile, setCurrentProfile] = useState('')
  const [currentProfileName, setCurrentProfileName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const st = await window.api.vault.status()
        const profilesRes = await window.api.vault.profiles.list()
        const list = profilesRes?.profiles || []
        const s = await window.api.import.scanLegacy()
        setScan(s || { exists: false, hasContent: false, path: '', folders: [] })
        const cur = st?.currentProfile || profilesRes?.currentProfile || ''
        setCurrentProfile(cur)
        const name = list.find((p) => p.id === cur)?.name || ''
        setCurrentProfileName(name || '')
        
        // Verificar si ya se importó anteriormente
        const hasImported = await storageGet('legacy_import_completed', false)
        
        if (st?.hasVault && !st?.locked && s?.exists && s?.hasContent && !hasImported) {
          setOpen(true)
        }
      } catch (err) {
        console.error('Import scan failed:', err)
      }
    })()
    // Suscribirse a cambios de perfiles para refrescar el nombre sin recargar
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.PROFILES_KEY || key === KEYS.CURRENT_PROFILE_KEY) {
        try {
          const st = await window.api.vault.status()
          const profilesRes = await window.api.vault.profiles.list()
          const cur = st?.currentProfile || profilesRes?.currentProfile || ''
          const list = profilesRes?.profiles || []
          setCurrentProfile(cur)
          const name = list.find((p) => p.id === cur)?.name || ''
          setCurrentProfileName(name || '')
        } catch (err) {
          console.error('No se pudo refrescar nombre de la cuenta actual', err)
        }
      }
    })
    return () => unsub?.()
  }, [])

  const confirmImport = async () => {
    setBusy(true)
    try {
      const res = await window.api.import.executeLegacy(currentProfile)
      if (res?.ok) {
        toast.success(`Importado: ${res.projectsAdded} proyectos, ${res.accountsAdded} cuentas`)
        // Marcar que ya se importó para no volver a preguntar
        await storageSet('legacy_import_completed', true)
        setOpen(false)
      } else {
        toast.error(`No se pudo importar: ${res?.error || 'error desconocido'}`)
      }
    } catch (err) {
      console.error('executeLegacy error:', err)
      toast.error('Error al importar')
    } finally {
      setBusy(false)
    }
  }

  const skipImport = async () => {
    // Marcar que no se quiere importar para no volver a preguntar
    await storageSet('legacy_import_completed', true)
    setOpen(false)
  }

  if (!scan?.exists) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar datos detectados</DialogTitle>
          <DialogDescription>
            Se detectó contenido en "{scan.path}".
            {Array.isArray(scan.folders) && scan.folders.length > 0 ? (
              <span> {scan.folders.length} carpetas con archivos.</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            ¿Quieres importar esta información? Se importará en tu cuenta actual.
          </div>
          <div className="text-xs text-muted-foreground">
            Cuenta actual: {currentProfileName || 'desconocida'} · Carpetas detectadas: {scan.folders?.length || 0}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => window.api.import.openLegacyFolder?.()}>Abrir carpeta</Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>No por ahora</Button>
          <Button type="button" variant="outline" onClick={skipImport} disabled={busy}>No volver a preguntar</Button>
          <Button type="button" onClick={confirmImport} disabled={busy || !currentProfile}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}