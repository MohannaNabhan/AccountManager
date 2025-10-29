import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Settings2Icon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon
} from 'lucide-react'
import { saveAccount } from '@/services/storage'
import { getPasswordSettings, savePasswordSettings, generatePassword } from '@/services/passwords'
import { generateUsername, getUsernameSettings, saveUsernameSettings } from '@/services/usernames'
import { toast } from 'sonner'

const schema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email('Email inválido').or(z.literal('')).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  note: z.string().optional(),
  links: z.array(z.string()).optional()
})

export default function EditAccountDialog({ 
  account, 
  projectId, 
  trigger, 
  onSuccess,
  title = "Editar cuenta",
  mode = "full" // "full" | "simple"
}) {
  const [open, setOpen] = useState(false)
  const [copiedPwd, setCopiedPwd] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [userSettingsOpen, setUserSettingsOpen] = useState(false)
  const [pwSettingsOpen, setPwSettingsOpen] = useState(false)
  const [showPwdInput, setShowPwdInput] = useState(false)
  const [newLink, setNewLink] = useState('')

  const [pwSettings, setPwSettings] = useState({
    length: 15,
    includeNumbers: true,
    includeLetters: true,
    includeSymbols: true,
    pattern: ''
  })

  const [userSettings, setUserSettings] = useState({
    prefix: 'usuario',
    length: 6,
    includeLetters: true,
    includeNumbers: true,
    includeSymbols: false,
    pattern: ''
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { 
      ...account, 
      username: account?.username || '', 
      note: account?.note || '',
      links: account?.links || []
    }
  })

  useEffect(() => {
    ;(async () => {
      setPwSettings(await getPasswordSettings())
      setUserSettings(await getUsernameSettings())
    })()
  }, [])

  // Reset form when account changes
  useEffect(() => {
    if (account) {
      form.reset({
        ...account,
        username: account.username || '',
        note: account.note || '',
        links: account.links || []
      })
    }
  }, [account, form])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open && account) {
      form.reset({
        ...account,
        username: account.username || '',
        note: account.note || '',
        links: account.links || []
      })
      setNewLink('')
      setShowAdvanced(false)
      setUserSettingsOpen(false)
      setPwSettingsOpen(false)
      setShowPwdInput(false)
      setCopiedPwd(false)
      setCopiedEmail(false)
      setCopiedUser(false)
    }
  }, [open, account, form])

  const userPreview = useMemo(
    () => [
      generateUsername(userSettings),
      generateUsername(userSettings),
      generateUsername(userSettings)
    ],
    [userSettings]
  )

  const pwPreview = useMemo(
    () => [
      generatePassword(pwSettings),
      generatePassword(pwSettings),
      generatePassword(pwSettings)
    ],
    [pwSettings]
  )

  const submit = async (values) => {
    const name = (values.name || '').trim()
    const hasUsername = (values.username || '').trim().length > 0
    const hasEmail = (values.email || '').trim().length > 0
    const hasNote = (values.note || '').trim().length > 0

    if (!name || !(hasUsername || hasEmail || hasNote)) {
      toast.error('Debes incluir Service y al menos uno de (Email, Usuario o Nota)')
      return
    }

    const rawLink = (newLink || '').trim()
    const nextLinks = Array.isArray(values.links) ? [...values.links] : []
    if (rawLink) nextLinks.push(rawLink)

    const accountData = { 
      ...account, 
      ...values, 
      links: nextLinks,
      ...(projectId && { projectId })
    }

    await saveAccount(accountData, { source: 'editar' })
    toast.success('Cuenta actualizada')
    setOpen(false)
    onSuccess?.()
  }

  const onGenerate = () => {
    const pwd = generatePassword(pwSettings)
    form.setValue('password', pwd)
  }

  const onCopyPassword = async () => {
    const pwd = form.getValues('password')
    if (pwd) {
      try {
        await navigator.clipboard.writeText(pwd)
        setCopiedPwd(true)
        toast.success('Contraseña copiada')
        setTimeout(() => setCopiedPwd(false), 1200)
      } catch {}
    }
  }

  const onCopyEmail = async () => {
    const email = form.getValues('email')
    if (email?.trim()) {
      try {
        await navigator.clipboard.writeText(email)
        setCopiedEmail(true)
        toast.success('Email copiado')
        setTimeout(() => setCopiedEmail(false), 1200)
      } catch {}
    } else {
      toast.warning('No hay email para copiar')
    }
  }

  const onCopyUsername = async () => {
    const username = form.getValues('username')
    if (username?.trim()) {
      try {
        await navigator.clipboard.writeText(username)
        setCopiedUser(true)
        toast.success('Usuario copiado')
        setTimeout(() => setCopiedUser(false), 1200)
      } catch {}
    } else {
      toast.warning('No hay usuario para copiar')
    }
  }

  const onSavePasswordSettings = async () => {
    setPwSettings(await savePasswordSettings(pwSettings))
    setPwSettingsOpen(false)
  }

  const onGenerateUser = () => {
    const user = generateUsername(userSettings)
    form.setValue('username', user)
  }

  const onSaveUserSettings = async () => {
    setUserSettings(await saveUsernameSettings(userSettings))
    setUserSettingsOpen(false)
  }

  const links = form.watch('links') || []

  const addLink = () => {
    const raw = (newLink || '').trim()
    if (!raw) return
    const next = [...links, raw]
    form.setValue('links', next)
    setNewLink('')
  }

  const removeLink = (idx) => {
    const next = links.slice()
    next.splice(idx, 1)
    form.setValue('links', next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm">
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] p-4 duration-75">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-y-2" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <Label>Service</Label>
            <Input placeholder="Service" {...form.register('name')} />
          </div>

          {mode === "full" && (
            <>
              <div className="grid gap-2">
                <Label>Usuario</Label>
                <div className="flex items-center gap-2">
                  <Input placeholder="usuario-xxxxx" {...form.register('username')} />
                  <Button type="button" variant="secondary" onClick={onGenerateUser}>
                    Generar
                  </Button>
                  <Dialog open={userSettingsOpen} onOpenChange={setUserSettingsOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" className="w-10 p-0">
                        <Settings2Icon className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px] p-4 duration-75">
                      <DialogHeader>
                        <DialogTitle>Ajustes de usuario</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Patrón (usar llaves {'{'} {'}'})</Label>
                          <Input
                            value={userSettings.pattern || ''}
                            onChange={(e) =>
                              setUserSettings((s) => ({ ...s, pattern: e.target.value }))
                            }
                            placeholder="{example-xxxx-xxxx}"
                          />
                          <div className="text-xs text-muted-foreground">
                            x = aleatorio (según opciones), ? = solo letra, ! = solo símbolo, $ = solo
                            número. El patrón se evalúa solo dentro de llaves {'{'} {'}'}; fuera de
                            llaves es texto literal.
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Prefijo</Label>
                          <Input
                            value={userSettings.prefix}
                            onChange={(e) => setUserSettings((s) => ({ ...s, prefix: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <div className="text-sm font-medium">Longitud: {userSettings.length}</div>
                          <Slider
                            value={[userSettings.length]}
                            min={3}
                            max={32}
                            step={1}
                            disabled={(userSettings.pattern || '').trim().length > 0}
                            onValueChange={([v]) => setUserSettings((s) => ({ ...s, length: v }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="uletters-edit"
                            checked={userSettings.includeLetters}
                            onCheckedChange={(v) =>
                              setUserSettings((s) => ({ ...s, includeLetters: !!v }))
                            }
                          />
                          <label htmlFor="uletters-edit" className="text-sm">
                            Incluir letras
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="unumbers-edit"
                            checked={userSettings.includeNumbers}
                            onCheckedChange={(v) =>
                              setUserSettings((s) => ({ ...s, includeNumbers: !!v }))
                            }
                          />
                          <label htmlFor="unumbers-edit" className="text-sm">
                            Incluir números
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="usymbols-edit"
                            checked={userSettings.includeSymbols}
                            onCheckedChange={(v) =>
                              setUserSettings((s) => ({ ...s, includeSymbols: !!v }))
                            }
                          />
                          <label htmlFor="usymbols-edit" className="text-sm">
                            Incluir símbolos (_-. )
                          </label>
                        </div>
                        <div className="grid gap-2">
                          <div className="text-sm text-muted-foreground">Preview</div>
                          <div className="grid gap-2">
                            {userPreview.map((u, i) => (
                              <div
                                key={i}
                                className="font-mono text-sm bg-muted rounded px-2 py-1 truncate"
                              >
                                {u}
                              </div>
                            ))}
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setUserSettingsOpen(false)}
                            >
                              Cancelar
                            </Button>
                          </DialogClose>
                          <Button type="button" onClick={onSaveUserSettings}>
                            Guardar
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button type="button" variant="outline" onClick={onCopyUsername} className="w-10 p-0">
                    {copiedUser ? (
                      <CheckIcon className="size-4 text-green-600" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input placeholder="correo@ejemplo.com" type="email" {...form.register('email')} />
                  <Button type="button" variant="outline" onClick={onCopyEmail} className="w-10 p-0">
                    {copiedEmail ? (
                      <CheckIcon className="size-4 text-green-600" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Contraseña</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="Contraseña" 
                    type={showPwdInput ? 'text' : 'password'} 
                    {...form.register('password')} 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-10 p-0" 
                    onClick={() => setShowPwdInput((v) => !v)}
                  >
                    {showPwdInput ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onGenerate}>
                    Generar
                  </Button>
                  <Dialog open={pwSettingsOpen} onOpenChange={setPwSettingsOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" className="w-10 p-0">
                        <Settings2Icon className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px] p-4 duration-75">
                      <DialogHeader>
                        <DialogTitle>Ajustes de contraseña</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <div className="text-sm font-medium">Longitud: {pwSettings.length}</div>
                          <Slider
                            value={[pwSettings.length]}
                            min={6}
                            max={64}
                            step={1}
                            disabled={(pwSettings.pattern || '').trim().length > 0}
                            onValueChange={([v]) => setPwSettings((s) => ({ ...s, length: v }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="letters-edit"
                            checked={pwSettings.includeLetters}
                            onCheckedChange={(v) =>
                              setPwSettings((s) => ({ ...s, includeLetters: !!v }))
                            }
                          />
                          <label htmlFor="letters-edit" className="text-sm">
                            Incluir letras
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="numbers-edit"
                            checked={pwSettings.includeNumbers}
                            onCheckedChange={(v) =>
                              setPwSettings((s) => ({ ...s, includeNumbers: !!v }))
                            }
                          />
                          <label htmlFor="numbers-edit" className="text-sm">
                            Incluir números
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="symbols-edit"
                            checked={pwSettings.includeSymbols}
                            onCheckedChange={(v) =>
                              setPwSettings((s) => ({ ...s, includeSymbols: !!v }))
                            }
                          />
                          <label htmlFor="symbols-edit" className="text-sm">
                            Incluir símbolos
                          </label>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium">Avanzado</div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowAdvanced((v) => !v)}
                          >
                            {showAdvanced ? 'Ocultar' : 'Mostrar'}
                          </Button>
                        </div>
                        {showAdvanced && (
                          <div className="grid gap-2">
                            <Label>Patrón (usar llaves {'{'} {'}'})</Label>
                            <Input
                              value={pwSettings.pattern || ''}
                              onChange={(e) =>
                                setPwSettings((s) => ({ ...s, pattern: e.target.value }))
                              }
                              placeholder="{example-xxxx-xxxx}"
                            />
                            <div className="text-xs text-muted-foreground">
                              x = aleatorio (letra/número/símbolo según configuración), ? = solo letra,
                              ! = solo símbolo, $ = solo número. El patrón debe ir entre llaves {'{'}{' '}
                              {'}'} y anula longitud y tipos de caracteres.
                            </div>
                          </div>
                        )}
                        <div className="grid gap-2">
                          <div className="text-sm text-muted-foreground">Preview</div>
                          <div className="grid gap-2">
                            {pwPreview.map((p, i) => (
                              <div
                                key={i}
                                className="font-mono text-sm bg-muted rounded px-2 py-1 truncate"
                              >
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button type="button" variant="ghost">
                              Cancelar
                            </Button>
                          </DialogClose>
                          <Button type="button" onClick={onSavePasswordSettings}>
                            Guardar
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button type="button" variant="outline" onClick={onCopyPassword} className="w-10 p-0">
                    {copiedPwd ? (
                      <CheckIcon className="size-4 text-green-600" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Links</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://sitio.com/login"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addLink()
                      }
                    }}
                  />
                </div>
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {links.map((url, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        <LinkIcon className="size-3" />
                        <span className="font-mono truncate max-w-[220px]">{url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => removeLink(idx)}
                          title="Eliminar"
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === "simple" && (
            <>
              <div className="grid gap-2">
                <Label>Usuario</Label>
                <Input placeholder="Usuario (opcional)" {...form.register('username')} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input placeholder="Email (opcional)" type="email" {...form.register('email')} />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas (opcional)"
              className="resize-none h-28"
              {...form.register('note')}
            />
          </div>

          <Separator />
          <DialogFooter>
            <Button type="submit">Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}