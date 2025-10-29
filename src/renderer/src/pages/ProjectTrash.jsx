import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { toast } from 'sonner'
import { EyeIcon, EyeOffIcon, CopyIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { getTrashAccounts, restoreAccount, hardDeleteAccount, onStorageUpdate, KEYS, getProjects } from '@/services/storage'

const MASKED_PASSWORD = '***********'

function maskEmail(val) {
  if (!val) return ''
  return '***'
}

function maskUsername(val) {
  if (!val) return ''
  return '******'
}

function SensitiveCell({ value, masked, label, accountId, field }) {
  const [show, setShow] = useState(false)
  const display = show ? (value || '-') : (masked || '-')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '')
      toast.success(`${label} copiado`)
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error(`No se pudo copiar ${label.toLowerCase()}`)
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{display}</span>
      <Button variant="ghost" size="icon" onClick={() => setShow((v) => !v)}>
        {!show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={copy}>
        <CopyIcon className="size-4" />
      </Button>
    </div>
  )
}

export default function ProjectTrash() {
  const { id: projectId } = useParams()
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [projectName, setProjectName] = useState('Proyecto')

  useEffect(() => {
    ;(async () => {
      setAccounts(await getTrashAccounts(projectId))
      const projects = await getProjects()
      const p = projects.find((x) => x.id === projectId)
      if (p) setProjectName(p.name)
    })()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.ACCOUNTS_KEY) setAccounts(await getTrashAccounts(projectId))
    })
    return () => unsub?.()
  }, [projectId])

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchSearch = `${a.name || ''} ${a.email || ''} ${a.username || ''} ${a.password || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
      return matchSearch
    })
  }, [accounts, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Papelera: {projectName} · {filtered.length} cuentas</div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Button asChild variant="outline">
            <Link to={`/projects/${projectId}`}>Volver a cuentas</Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Contraseña</TableHead>
            <TableHead>Eliminada</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.name || '-'}</TableCell>
              <TableCell>
                <SensitiveCell accountId={a.id} field="username" value={a.username || ''} masked={maskUsername(a.username)} label="Usuario" />
              </TableCell>
              <TableCell>
                <SensitiveCell accountId={a.id} field="email" value={a.email || ''} masked={maskEmail(a.email)} label="Email" />
              </TableCell>
              <TableCell>
                <SensitiveCell accountId={a.id} field="password" value={a.password || ''} masked={MASKED_PASSWORD} label="Contraseña" />
              </TableCell>
              <TableCell>{a.deletedAt ? new Date(a.deletedAt).toLocaleString() : '-'}</TableCell>
              <TableCell className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await restoreAccount(a.id, { source: 'papelera' })
                    toast.success('Cuenta restaurada')
                  }}
                >
                  <Undo2Icon className="mr-1 size-4" /> Restaurar
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await hardDeleteAccount(a.id)
                    toast.success('Cuenta eliminada definitivamente')
                  }}
                >
                  <Trash2Icon className="mr-1 size-4" /> Borrar definitivamente
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}