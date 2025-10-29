import { useEffect, useMemo, useState } from 'react'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { getProjects, saveProject, deleteProject, getAccounts, onStorageUpdate, KEYS } from '@/services/storage'
import * as LucideIcons from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  icon: z.string().optional(),
})
const GENERIC_ICON_NAMES = [
  'FolderIcon',
  'RocketIcon',
  'GlobeIcon',
  'Building2Icon',
  'ShoppingCartIcon',
  'ShieldCheckIcon',
  'DatabaseIcon',
  'CloudIcon',
  'UsersIcon',
  'CodeIcon',
]
function IconRenderer({ name, className }) {
  const Comp = (LucideIcons[name] || LucideIcons.FolderIcon)
  return <Comp className={className} />
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    (async () => setProjects(await getProjects()))()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.PROJECTS_KEY) setProjects(await getProjects())
    })
    return () => unsub?.()
  }, [])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const text = `${p.name} ${p.description || ''}`.toLowerCase()
      return text.includes(search.toLowerCase())
    })
  }, [projects, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar proyecto" value={search} onChange={(e) => setSearch(e.target.value)} />
        <CreateProjectButton onCreated={() => toast.success('Proyecto creado')} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <IconRenderer name={p.icon} className="size-4" />
                  {p.name}
                </div>
              </TableCell>
              <TableCell>{p.description || '-'}</TableCell>
              <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
              <TableCell className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/projects/${p.id}`)}>Ver cuentas</Button>
                <EditProjectButton initial={p} />
                <DeleteProjectButton project={p} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DeleteProjectButton({ project }) {
  const [accountCount, setAccountCount] = useState(0)

  useEffect(() => {
    const loadAccountCount = async () => {
      const accounts = await getAccounts(project.id)
      setAccountCount(accounts.length)
    }
    loadAccountCount()
  }, [project.id])

  const handleDelete = async () => {
    try {
      await deleteProject(project.id)
      toast.success(`Proyecto "${project.name}" y ${accountCount} cuenta(s) eliminadas`)
    } catch (error) {
      toast.error('Error al eliminar el proyecto')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Eliminar</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar proyecto "{project.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente el proyecto y todas sus {accountCount} cuenta(s) asociada(s).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar proyecto y cuentas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateProjectButton({ onCreated }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', icon: 'FolderIcon' } })
  const submit = async (values) => {
    const project = { ...values, id: crypto.randomUUID(), createdAt: Date.now() }
    await saveProject(project)
    onCreated?.(project)
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Crear proyecto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Nombre</label>
            <div className="flex items-center gap-2">
              <IconRenderer name={form.watch('icon')} className="size-5" />
              <Input placeholder="Nombre" {...form.register('name')} />
            </div>
          </div>
          <Input placeholder="Descripción" {...form.register('description')} />
          <div className="grid gap-2">
            <label className="text-sm font-medium">Icono</label>
            <div className="grid grid-cols-5 gap-2 p-1">
              {GENERIC_ICON_NAMES.map((n) => {
                const Comp = LucideIcons[n]
                const selected = form.watch('icon') === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => form.setValue('icon', n)}
                    className={`flex flex-col items-center gap-1 rounded border p-2 text-xs ${selected ? 'border-primary' : 'border-muted'}`}
                    title={n.replace('Icon', '')}
                  >
                    <Comp className="size-5" />
                    <span className="truncate max-w-[80px]">{n.replace('Icon','')}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditProjectButton({ initial }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: initial })
  const submit = async (values) => {
    const project = { ...initial, ...values }
    await saveProject(project)
    toast.success('Proyecto actualizado')
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Nombre</label>
            <div className="flex items-center gap-2">
              <IconRenderer name={form.watch('icon')} className="size-5" />
              <Input placeholder="Nombre" {...form.register('name')} />
            </div>
          </div>
          <Input placeholder="Descripción" {...form.register('description')} />
          <div className="grid gap-2">
            <label className="text-sm font-medium">Icono</label>
            <div className="grid grid-cols-5 gap-2 p-1">
              {GENERIC_ICON_NAMES.map((n) => {
                const Comp = LucideIcons[n]
                const selected = form.watch('icon') === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => form.setValue('icon', n)}
                    className={`flex flex-col items-center gap-1 rounded border p-2 text-xs ${selected ? 'border-primary' : 'border-muted'}`}
                    title={n.replace('Icon', '')}
                  >
                    <Comp className="size-5" />
                    <span className="truncate max-w-[80px]">{n.replace('Icon','')}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}