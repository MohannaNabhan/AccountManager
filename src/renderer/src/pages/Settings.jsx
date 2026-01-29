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
    ; (async () => {
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
        console.error('Load settings failed', err)
        toast.error('Could not load account settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function saveProfile() {
    try {
      const trimmed = (name || '').trim()
      if (trimmed.length > 20) {
        toast.error('Name must be at most 20 characters')
        return
      }
      const res = await window.api.vault.profiles.update(profileId, { name, note })
      if (res?.ok) {
        toast.success('Profile updated')
      } else {
        toast.error(res?.error || 'Could not update profile')
      }
    } catch (err) {
      console.error('Update profile failed', err)
      toast.error('Error updating profile')
    }
  }

  async function changePassword() {
    if ((newPassword || '').length < 6) {
      toast.error('New password is too short')
      return
    }
    if (newPassword !== confirm) {
      toast.error('Confirmation does not match')
      return
    }
    try {
      const res = await window.api.vault.password.change(oldPassword, newPassword, profileId)
      if (res?.ok) {
        toast.success('Password changed')
        setOldPassword('')
        setNewPassword('')
        setConfirm('')
        // reload to ensure states
        try { await window.api.app.reload() } catch { }
      } else {
        toast.error(res?.error || 'Could not change password')
      }
    } catch (err) {
      console.error('Change password failed', err)
      toast.error('Error changing password')
    }
  }



  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <div className="font-medium mb-2">Your account</div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          </div>
          <div className="grid gap-2">
            <Label>Note to remember password</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hint or note to remember your password" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" onClick={saveProfile}>Save</Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-medium mb-2">Change master password</div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Current password</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Confirm new password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Separator className="my-1" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirm('') }}>Cancel</Button>
            <Button type="button" onClick={changePassword}>Change</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}