import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  getAccounts,
  saveAccount,
  deleteAccount,
  onStorageUpdate,
  KEYS,
  getProjects
} from '@/services/storage'
import { getPasswordSettings, savePasswordSettings, generatePassword } from '@/services/passwords'
import { generateUsername, getUsernameSettings, saveUsernameSettings } from '@/services/usernames'
import {
  Settings2Icon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender
} from '@tanstack/react-table'
import ContentScroll from '@/components/custom/ContentScroll'
import EditAccountDialog from '@/components/custom/EditAccountDialog'
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

const FIELD_LABELS = {
  name: 'Service',
  email: 'Email',
  username: 'Usuario',
  password: 'Contraseña',
  note: 'Nota',
  links: 'Links'
}

function preview(value = '', max = 20) {
  if (!value) return ''
  if (value.length <= max) return value
  return value.slice(0, max) + '…'
}

const HIDDEN_MASK = '*****'

function SensitiveCell({ value = '', masked, label, initialShow = false, showOverride }) {
  const [show, setShow] = useState(initialShow)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (showOverride === true) setShow(true)
  }, [showOverride])
  const effectiveShow = showOverride === true ? true : show
  const display = effectiveShow ? (value || 'none') : (value ? (masked ?? HIDDEN_MASK) : 'none')
  const canCopy = !!(value && value.length)
  const onCopy = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copiado`)
      setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error(`No se pudo copiar ${label.toLowerCase()}`)
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm truncate max-w-[180px]">{display}</span>
      {canCopy && (
        <>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            title={effectiveShow ? 'Ocultar' : 'Ver'}
            onClick={() => setShow((v) => !v)}
            disabled={showOverride === true}
          >
            {!effectiveShow ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            title={`Copiar ${label}`}
            onClick={onCopy}
          >
            {copied ? (
              <CheckIcon className="size-4 text-green-600" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </Button>
        </>
      )}
    </div>
  )
}

function ViewNoteButton({ note = '', size = 'sm' }) {
  const [open, setOpen] = useState(false)
  if (!note || !note.length) {
    return <span className="text-muted-foreground text-xs">none</span>
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size={size} className="h-8 w-8 p-0" title="Ver nota">
          <EyeIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nota</DialogTitle>
        </DialogHeader>
        <div className="mt-2 whitespace-pre-wrap break-words text-sm">
          {note}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectAccounts() {
  const { id: projectId } = useParams()
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [projectName, setProjectName] = useState('Proyecto')
  const [copiedLinkTableId, setCopiedLinkTableId] = useState(null)
  const [pwSettings, setPwSettings] = useState({
    length: 15,
    includeNumbers: true,
    includeLetters: true,
    includeSymbols: true
  })
  const [pwPopoverOpen, setPwPopoverOpen] = useState(false)
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [rowSelection, setRowSelection] = useState({})
  const [forceShowCols, setForceShowCols] = useState({ username: false, email: false, password: false, links: false })
  const toggleForce = (key) => setForceShowCols((s) => ({ ...s, [key]: !s[key] }))

  useEffect(() => {
    ;(async () => {
      setAccounts(await getAccounts(projectId))
      const projects = await getProjects()
      const p = projects.find((x) => x.id === projectId)
      if (p) setProjectName(p.name)
      setPwSettings(await getPasswordSettings())
    })()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.ACCOUNTS_KEY) setAccounts(await getAccounts(projectId))
    })
    return () => unsub?.()
  }, [projectId])

  const columns = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todo"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    {
      accessorKey: 'name',
      header: 'Service',
      cell: ({ row }) => <div className="font-medium">{row.getValue('name') || 'none'}</div>
    },
    {
      accessorKey: 'username',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Usuario</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.username ? 'Ocultar' : 'Ver'} onClick={() => toggleForce('username')}>
            {!forceShowCols.username ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <SensitiveCell value={row.getValue('username') || ''} label={FIELD_LABELS.username} showOverride={forceShowCols.username ? true : undefined} />
      )
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Email <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.email ? 'Ocultar' : 'Ver'} onClick={() => toggleForce('email')}>
            {!forceShowCols.email ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="lowercase">
          <SensitiveCell value={row.getValue('email') || ''} label={FIELD_LABELS.email} showOverride={forceShowCols.email ? true : undefined} />
        </div>
      )
    },
    {
      accessorKey: 'password',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Contraseña</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.password ? 'Ocultar' : 'Ver'} onClick={() => toggleForce('password')}>
            {!forceShowCols.password ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <SensitiveCell value={row.getValue('password') || ''} label={FIELD_LABELS.password} showOverride={forceShowCols.password ? true : undefined} />
      )
    },
    {
      accessorKey: 'links',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Link</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.links ? 'Ocultar' : 'Ver'} onClick={() => toggleForce('links')}>
            {!forceShowCols.links ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      filterFn: (row, id, value) => {
        const links = row.getValue(id) || []
        const first = Array.isArray(links) && links.length > 0 ? links[0] : ''
        const v = String(value || '').toLowerCase()
        return String(first).toLowerCase().includes(v)
      },
      cell: ({ row }) => {
        const links = row.getValue('links') || []
        const first = Array.isArray(links) && links.length > 0 ? links[0] : ''
        return (
          <SensitiveCell value={first || ''} label={FIELD_LABELS.links} showOverride={forceShowCols.links ? true : undefined} />
        )
      }
    },
    {
      accessorKey: 'note',
      header: 'Nota',
      cell: ({ row }) => <ViewNoteButton note={row.getValue('note') || ''} />
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">Detalles</Button>
              </SheetTrigger>
              <SheetContent className="duration-50 !max-w-none !w-[670px] px-4">
                <SheetHeader>
                  <SheetTitle>Detalles de cuenta</SheetTitle>
                  <SheetDescription>{a.email}</SheetDescription>
                </SheetHeader>
                <AccountDetails account={a} />
              </SheetContent>
            </Sheet>
            <EditAccountDialog
                account={a}
                projectId={a.projectId}
                pwSettings={pwSettings}
                setPwSettings={setPwSettings}
                mode="full"
              />
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await deleteAccount(a.id)
                toast.success('Cuenta movida a la papelera')
              }}
            >
              Eliminar
            </Button>
          </div>
        )
      }
    }
  ], [projectId, pwSettings, forceShowCols])

  const table = useReactTable({
    data: accounts,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: {
      pagination: {
        pageSize: 7
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    }
  })

  // Ajustar pageSize automáticamente cuando las opciones estén deshabilitadas
  useEffect(() => {
    const currentPageSize = table.getState().pagination.pageSize
    const availableOptions = [7, 10, 20, 30, 40, 50]
    
    // Si el pageSize actual es mayor que el número de cuentas (y no es "todas")
    if (currentPageSize > accounts.length && currentPageSize < 1000) {
      // Encontrar la opción más grande que sea válida
      const validOption = availableOptions
        .filter(size => size <= accounts.length)
        .sort((a, b) => b - a)[0] // Ordenar descendente y tomar el primero
      
      if (validOption) {
        table.setPageSize(validOption)
      } else if (accounts.length > 0) {
        // Si ninguna opción estándar es válida, usar "todas"
        table.setPageSize(accounts.length)
      }
    }
  }, [accounts.length, table])

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Cuentas de: {projectName}</div>
        <Button asChild variant="outline">
          <Link to="/projects">Volver a proyectos</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por service, usuario, email, link"
          value={search}
          onChange={(e) => {
            const val = e.target.value
            setSearch(val)
            table.getColumn('email')?.setFilterValue(val)
            table.getColumn('username')?.setFilterValue(val)
            table.getColumn('name')?.setFilterValue(val)
            table.getColumn('links')?.setFilterValue(val)
          }}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columnas <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateAccountButton projectId={projectId} onCreated={() => toast.success('Cuenta creada')} />
      </div>

      <ContentScroll mainClass="mt-2 !h-[71%]" className="p-1">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentScroll>
      
      {/* Controles de paginación */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Filas por página</p>
            <Select
              value={table.getState().pagination.pageSize >= accounts.length ? 'all' : String(table.getState().pagination.pageSize)}
              onValueChange={(value) => {
                if (value === 'all') {
                  table.setPageSize(accounts.length || 1000)
                } else {
                  table.setPageSize(Number(value))
                }
              }}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[7, 10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem 
                    key={pageSize} 
                    value={String(pageSize)}
                    disabled={accounts.length < pageSize}
                  >
                    {pageSize}
                  </SelectItem>
                ))}
                <SelectItem value="all" disabled={accounts.length === 0}>
                  Todas
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            {table.getState().pagination.pageSize >= accounts.length ? 
              `Todas (${accounts.length})` : 
              `Página ${table.getState().pagination.pageIndex + 1} de ${table.getPageCount()}`
            }
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir a la primera página</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5"
                />
              </svg>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir a la página anterior</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir a la página siguiente</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir a la última página</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateAccountButton({ projectId, onCreated }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', username: '', email: '', password: '', note: '', links: [] }
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [pwSettings, setPwSettings] = useState({
    length: 15,
    includeNumbers: true,
    includeLetters: true,
    includeSymbols: true
  })
  const [pwSettingsOpen, setPwSettingsOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [userSettingsOpen, setUserSettingsOpen] = useState(false)
  const [userSettings, setUserSettings] = useState({
    prefix: 'usuario',
    length: 6,
    includeLetters: true,
    includeNumbers: true,
    includeSymbols: false,
    pattern: ''
  })
  const [showAdvancedUser, setShowAdvancedUser] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedPwd, setCopiedPwd] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [showPwdInput, setShowPwdInput] = useState(false)
  useEffect(() => {
    ;(async () => {
      setPwSettings(await getPasswordSettings())
      setUserSettings(await getUsernameSettings())
    })()
  }, [])
  const pwPreview = useMemo(
    () => [
      generatePassword(pwSettings),
      generatePassword(pwSettings),
      generatePassword(pwSettings)
    ],
    [pwSettings]
  )
  const userPreview = useMemo(
    () => [
      generateUsername(userSettings),
      generateUsername(userSettings),
      generateUsername(userSettings)
    ],
    [userSettings]
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
    const account = {
      ...values,
      links: nextLinks,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      projectId
    }
    await saveAccount(account, { source: 'crear' })
    onCreated?.(account)
    // Resetear formulario
    form.reset({ name: '', username: '', email: '', password: '', note: '', links: [] })
    setNewLink('')
    setCreateOpen(false)
  }
  const onGenerate = () => {
    const pwd = generatePassword(pwSettings)
    form.setValue('password', pwd)
  }
  const onCopy = async () => {
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
  const onGenerateUser = () => {
    const user = generateUsername(userSettings)
    form.setValue('username', user)
  }
  const onCopyUser = async () => {
    const user = form.getValues('username')
    if (user) {
      try {
        await navigator.clipboard.writeText(user)
        setCopiedUser(true)
        toast.success('Usuario copiado')
        setTimeout(() => setCopiedUser(false), 1200)
      } catch {}
    }
  }
  const onSaveSettings = async () => {
    setPwSettings(await savePasswordSettings(pwSettings))
    setPwSettingsOpen(false)
  }
  const onSaveUserSettings = async () => {
    setUserSettings(await saveUsernameSettings(userSettings))
    setUserSettingsOpen(false)
  }
  const links = form.watch('links') || []
  const [newLink, setNewLink] = useState('')
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
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button>Crear cuenta</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] p-4 duration-75">
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-y-2" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <Label>Service</Label>
            <Input placeholder="Service" {...form.register('name')} />
          </div>
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
                      <Label>
                        Patrón (usar llaves {'{'} {'}'})
                      </Label>
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
                        llaves es texto literal. Se pueden usar múltiples secciones. Cuando hay
                        patrón, se ignora la longitud global; la opción "x" respeta las opciones de
                        letras/números/símbolos.
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
                        id="uletters-create"
                        checked={userSettings.includeLetters}
                        onCheckedChange={(v) =>
                          setUserSettings((s) => ({ ...s, includeLetters: !!v }))
                        }
                      />
                      <label htmlFor="uletters-create" className="text-sm">
                        Incluir letras
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="unumbers-create"
                        checked={userSettings.includeNumbers}
                        onCheckedChange={(v) =>
                          setUserSettings((s) => ({ ...s, includeNumbers: !!v }))
                        }
                      />
                      <label htmlFor="unumbers-create" className="text-sm">
                        Incluir números
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="usymbols-create"
                        checked={userSettings.includeSymbols}
                        onCheckedChange={(v) =>
                          setUserSettings((s) => ({ ...s, includeSymbols: !!v }))
                        }
                      />
                      <label htmlFor="usymbols-create" className="text-sm">
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
              <Button type="button" variant="outline" onClick={onCopyUser} className="w-10 p-0">
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
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const v = (form.getValues('email') || '').trim()
                  if (!v) {
                    toast.warning('Introduce un email para copiar')
                    return
                  }
                  try {
                    await navigator.clipboard.writeText(v)
                    setCopiedEmail(true)
                    toast.success('Email copiado')
                    setTimeout(() => setCopiedEmail(false), 1200)
                  } catch (err) {
                    console.error('Clipboard error:', err)
                    toast.error('No se pudo copiar el email')
                  }
                }}
                className="w-10 p-0"
              >
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
              <Input placeholder="Contraseña" type={showPwdInput ? 'text' : 'password'} {...form.register('password')} />
              <Button type="button" variant="ghost" className="w-10 p-0" onClick={() => setShowPwdInput((v) => !v)}>
                {!showPwdInput ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
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
                        id="letters"
                        checked={pwSettings.includeLetters}
                        onCheckedChange={(v) =>
                          setPwSettings((s) => ({ ...s, includeLetters: !!v }))
                        }
                      />
                      <label htmlFor="letters" className="text-sm">
                        Incluir letras
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="numbers"
                        checked={pwSettings.includeNumbers}
                        onCheckedChange={(v) =>
                          setPwSettings((s) => ({ ...s, includeNumbers: !!v }))
                        }
                      />
                      <label htmlFor="numbers" className="text-sm">
                        Incluir números
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="symbols"
                        checked={pwSettings.includeSymbols}
                        onCheckedChange={(v) =>
                          setPwSettings((s) => ({ ...s, includeSymbols: !!v }))
                        }
                      />
                      <label htmlFor="symbols" className="text-sm">
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
                        <Label>
                          Patrón (usar llaves {'{'} {'}'})
                        </Label>
                        <Input
                          value={pwSettings.pattern || ''}
                          onChange={(e) =>
                            setPwSettings((s) => ({ ...s, pattern: e.target.value }))
                          }
                          placeholder="{example-xxxx-xxxx}"
                        />
                        <div className="text-xs text-muted-foreground">
                          x = aleatorio (según opciones), ? = solo letra, ! = solo símbolo, $ = solo
                          número. El patrón se evalúa solo dentro de llaves {'{'} {'}'}; fuera de
                          llaves es texto literal. Se pueden usar múltiples secciones. Cuando hay
                          patrón, se ignora la longitud global; la opción "x" respeta las opciones
                          de letras/números/símbolos.
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
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setPwSettingsOpen(false)}
                        >
                          Cancelar
                        </Button>
                      </DialogClose>
                      <Button type="button" onClick={onSaveSettings}>
                        Guardar
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
              <Button type="button" variant="outline" onClick={onCopy} className="w-10 p-0">
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
          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas (opcional)"
              className="resize-none  h-28"
              {...form.register('note')}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}



function AccountDetails({ account }) {
  const [showAll, setShowAll] = useState(false)
  const [copiedLinkIndex, setCopiedLinkIndex] = useState(null)
  const copy = async (text, label, field) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error(`No se pudo copiar ${label.toLowerCase()}`)
    }
  }
  return (
    <ContentScroll mainClass="mt-4 !h-[86%]" className="p-1">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">General</div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Ocultar valores' : 'Ver valores'}
        </Button>
      </div>
      {Array.isArray(account.links) && account.links.length > 0 && (
        <div className="mt-2">
          <div className="text-sm text-muted-foreground">Links</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {account.links.map((url, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <LinkIcon className="size-3" />
                  <span className="font-mono truncate max-w-[240px]">{url}</span>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url)
                      toast.success('Link copiado')
                      setCopiedLinkIndex(idx)
                      setTimeout(() => setCopiedLinkIndex(null), 1200)
                    } catch (err) {
                      console.error('Clipboard error:', err)
                      toast.error('No se pudo copiar el link')
                    }
                  }}
                  title="Copiar link"
                >
                  {copiedLinkIndex === idx ? (
                    <CheckIcon className="size-3 text-green-600" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                </Button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Service:</span> {account.name || 'none'}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Usuario:</span>
            <span className="font-mono">
              {showAll ? (account.username || 'none') : (account.username ? preview(account.username || '') : 'none')}
            </span>
          </div>
          {account.username && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {!showAll ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(account.username, 'Usuario', 'username')}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-mono">
              {showAll ? (account.email || 'none') : (account.email ? preview(account.email || '') : 'none')}
            </span>
          </div>
          {account.email && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {!showAll ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(account.email, 'Email', 'email')}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Contraseña:</span>
            <span className="font-mono">{showAll ? (account.password || 'none') : (account.password ? preview(account.password || '') : 'none')}</span>
          </div>
          {account.password && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {!showAll ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(account.password, 'Contraseña', 'password')}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Nota:</span>
            <span className="font-mono">{showAll ? (account.note || 'none') : ((account.note || '').length > 0 ? HIDDEN_MASK : 'none')}</span>
          </div>
          {(account.note || '').length > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {!showAll ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
              <ViewNoteButton note={account.note} size="sm" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(account.note, 'Nota', 'note')}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm mb-5">
          <span className="text-muted-foreground">Creado:</span>{' '}
          {new Date(account.createdAt).toLocaleString()}
        </div>
      </div>
      {Array.isArray(account.history) && account.history.length > 0 && (
        <div className="mt-8">
          <div className="text-sm font-medium">Historial de cambios</div>
          <div className="mt-2 space-y-2">
            {account.history
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={i} className="rounded border p-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.timestamp).toLocaleString()} ·{' '}
                    {h.type === 'create'
                      ? 'Creado'
                      : h.type === 'update'
                        ? 'Actualizado'
                        : h.type === 'delete'
                          ? 'Eliminado'
                          : h.type === 'restore'
                            ? 'Restaurado'
                            : h.type === 'copy'
                              ? 'Copiado'
                              : h.type}
                    {h.source ? ` · ${h.source}` : ''}
                  </div>
                  {h.type === 'create' && h.snapshot && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">Campos iniciales:</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(h.snapshot)
                          .filter(([, v]) => (v ?? '').toString().length > 0)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
                            >
                              <span className="font-medium text-[11px]">
                                {FIELD_LABELS[k] || k}:
                              </span>
                              <span className="font-mono text-[11px]">
                                {showAll ? (v ?? '').toString() : preview((v ?? '').toString())}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copy(v, FIELD_LABELS[k] || k, k)}
                              >
                                <CopyIcon className="size-3" />
                              </Button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {h.type === 'update' && h.changes && h.changes.length > 0 && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">Cambios:</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {h.changes.map((c, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
                          >
                            <span className="font-medium text-[11px]">
                              {FIELD_LABELS[c.field] || c.field}:
                            </span>
                            <span className="font-mono text-[11px]">
                              "{showAll ? (c.from ?? '-') : preview(((c.from ?? '')).toString())}" → "
                              {showAll ? (c.to ?? '-') : preview(((c.to ?? '')).toString())}"
                            </span>
                            {(c.to ?? '').toString().length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                title="Copiar nuevo"
                                onClick={() =>
                                  copy(c.to, FIELD_LABELS[c.field] || c.field, c.field)
                                }
                              >
                                <CopyIcon className="size-3" />
                              </Button>
                            )}
                            {(c.from ?? '').toString().length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                title="Copiar anterior"
                                onClick={() =>
                                  copy(c.from, FIELD_LABELS[c.field] || c.field, c.field)
                                }
                              >
                                <CopyIcon className="size-3" />
                              </Button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {h.type === 'delete' && h.message && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">{h.message}</div>
                    </div>
                  )}
                  {h.type === 'restore' && h.message && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">{h.message}</div>
                    </div>
                  )}
                  {h.type === 'copy' && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">
                        Copiado: {FIELD_LABELS[h.field] || h.field}
                      </div>
                      {typeof h.value === 'string' && h.value.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5">
                            <span className="font-mono text-[11px]">
                              {showAll ? h.value : preview(h.value)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                copy(h.value, FIELD_LABELS[h.field] || h.field, h.field)
                              }
                            >
                              <CopyIcon className="size-3" />
                            </Button>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </ContentScroll>
  )
}
