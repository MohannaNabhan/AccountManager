import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const st = await window.api.vault.status()
        const profRes = await window.api.vault.profiles.list()
        const list = profRes?.profiles || []
        const curId = st?.currentProfile || profRes?.currentProfile || list[0]?.id || ''
        const cur = list.find((p) => p.id === curId)
        setProfileId(curId)
        setName(cur?.name || '')
        setNote(cur?.note || '')
      } catch (err) {
        console.error('Cargar settings falló', err)
        toast.error('No se pudieron cargar los ajustes de la cuenta')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function saveProfile() {
    try {
      const trimmed = (name || '').trim()
      if (trimmed.length > 20) {
        toast.error('El nombre debe tener máximo 20 caracteres')
        return
      }
      const res = await window.api.vault.profiles.update(profileId, { name, note })
      if (res?.ok) {
        toast.success('Perfil actualizado')
      } else {
        toast.error(res?.error || 'No se pudo actualizar el perfil')
      }
    } catch (err) {
      console.error('Actualizar perfil falló', err)
      toast.error('Error actualizando el perfil')
    }
  }

  async function changePassword() {
    if ((newPassword || '').length < 6) {
      toast.error('La nueva contraseña es demasiado corta')
      return
    }
    if (newPassword !== confirm) {
      toast.error('La confirmación no coincide')
      return
    }
    try {
      const res = await window.api.vault.password.change(oldPassword, newPassword, profileId)
      if (res?.ok) {
        toast.success('Contraseña cambiada')
        setOldPassword('')
        setNewPassword('')
        setConfirm('')
        // recargar para asegurar los estados
        try { await window.api.app.reload() } catch {}
      } else {
        toast.error(res?.error || 'No se pudo cambiar la contraseña')
      }
    } catch (err) {
      console.error('Cambiar contraseña falló', err)
      toast.error('Error cambiando la contraseña')
    }
  }



  if (loading) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <div className="font-medium mb-2">Tu cuenta</div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          </div>
          <div className="grid gap-2">
            <Label>Nota para recordar contraseña</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pista o nota para recordar tu contraseña" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" onClick={saveProfile}>Guardar</Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-medium mb-2">Cambiar contraseña maestra</div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Contraseña actual</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Confirmar nueva contraseña</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Separator className="my-1" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirm('') }}>Cancelar</Button>
            <Button type="button" onClick={changePassword}>Cambiar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}