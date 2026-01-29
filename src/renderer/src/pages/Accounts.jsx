import { useEffect, useMemo, useState } from 'react'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ContentScroll from '@/components/custom/ContentScroll'
import EditAccountDialog from '@/components/custom/EditAccountDialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown, ChevronDown, Copy as CopyIcon, Check as CheckIcon, Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender
} from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { getAccounts, saveAccount, deleteAccount, onStorageUpdate, KEYS } from '@/services/storage'
import { toast } from 'sonner'

const schema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(2, 'Service required'),
    email: z.string().optional(),
    username: z.string().optional(),
    note: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const hasAny = !!(data.email && data.email.trim()) || !!(data.username && data.username.trim()) || !!(data.note && data.note.trim())
    if (!hasAny) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'You must include at least Email, Username or Note' })
    }
  })

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [rowSelection, setRowSelection] = useState({})
  const [forceShowCols, setForceShowCols] = useState({ email: false, username: false })
  const toggleForce = (key) => setForceShowCols((s) => ({ ...s, [key]: !s[key] }))

  useEffect(() => {
    (async () => {
      const loadedAccounts = await getAccounts()
      console.log('📊 Loaded accounts:', loadedAccounts.length, 'accounts')
      console.log('📋 Sample account data:', loadedAccounts[0])
      setAccounts(loadedAccounts)
    })()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.ACCOUNTS_KEY) {
        const updatedAccounts = await getAccounts()
        console.log('🔄 Updated accounts:', updatedAccounts.length, 'accounts')
        setAccounts(updatedAccounts)
      }
    })
    return () => unsub?.()
  }, [])

  const filtered = useMemo(() => {
    console.log('🔍 Filtering accounts:', accounts.length, 'search term:', `"${search}"`)

    if (!search || search.trim().length === 0) {
      console.log('✅ No search term, showing all accounts:', accounts.length)
      return accounts
    }

    const searchTerm = search.trim().toLowerCase()
    console.log('🔎 Searching for:', `"${searchTerm}"`)

    const result = accounts.filter((account, index) => {
      // Crear un texto combinado de todos los campos buscables
      const searchableText = [
        account.name,
        account.email,
        account.username,
        account.password,
        account.note,
        Array.isArray(account.links) ? account.links.join(' ') : account.links,
        account.id,
        account.projectId
      ]
        .filter(Boolean) // Remover valores null/undefined
        .join(' ')
        .toLowerCase()

      const isMatch = searchableText.includes(searchTerm)

      if (isMatch) {
        console.log(`✅ Match #${index + 1}:`, account.name || account.email || 'Unnamed', '- matched text contains:', `"${searchTerm}"`)
      }

      return isMatch
    })

    console.log(`🎯 Search results: ${result.length} matches from ${accounts.length} total accounts`)
    return result
  }, [accounts, search])

  const columns = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    { accessorKey: 'name', header: 'Service', cell: ({ row }) => <div className="font-medium">{row.getValue('name') || 'none'}</div> },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Email <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.email ? 'Hide' : 'Show'} onClick={() => toggleForce('email')}>
            {!forceShowCols.email ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="lowercase">
          <SensitiveCell
            value={row.getValue('email') || ''}
            label="Email"
            showOverride={(forceShowCols.email || ((search || '').trim().length > 0)) ? true : undefined}
            query={(search || '').trim()}
          />
        </div>
      )
    },
    {
      accessorKey: 'username',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Username</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.username ? 'Hide' : 'Show'} onClick={() => toggleForce('username')}>
            {!forceShowCols.username ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <SensitiveCell
          value={row.getValue('username') || ''}
          label="Username"
          showOverride={(forceShowCols.username || ((search || '').trim().length > 0)) ? true : undefined}
          query={(search || '').trim()}
        />
      )
    },
    { accessorKey: 'note', header: 'Note', cell: ({ row }) => <ViewNoteButton note={row.getValue('note') || ''} /> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Details</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Account Details</SheetTitle>
                  <SheetDescription>{a.email || 'none'}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  <div><span className="text-muted-foreground">Service:</span> {a.name || 'none'}</div>
                  <div><span className="text-muted-foreground">Created:</span> {new Date(a.createdAt).toLocaleString()}</div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-muted-foreground">Note:</span>
                    <div className="mt-1 whitespace-pre-wrap break-words text-sm">{a.note || 'none'}</div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <EditAccountDialog account={a} mode="simple" />
            <Button variant="destructive" onClick={async () => { await deleteAccount(a.id); toast.success('Account moved to trash') }}>Delete</Button>
          </div>
        )
      }
    }
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search in all fields"
          value={search}
          onChange={(e) => {
            const val = e.target.value
            console.log('🔤 Search input changed:', `"${val}"`)
            setSearch(val)
          }}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateAccountButton onCreated={() => toast.success('Account created')} />
      </div>
      <ContentScroll mainClass="mt-2" className="p-1">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentScroll>
    </div>
  )
}

function preview(value = '', max = 20) {
  if (!value) return ''
  if (value.length <= max) return value
  return value.slice(0, max) + '…'
}

const HIDDEN_MASK = '*****'

function SensitiveCell({ value = '', label, initialShow = false, showOverride, query = '' }) {
  const [show, setShow] = useState(initialShow)
  const [copied, setCopied] = useState(false)
  // Cuando el encabezado está en "Ver", forzamos la celda a visible.
  // Si se desactiva, no tocamos el estado local para que el usuario conserve sus elecciones.
  useEffect(() => {
    if (showOverride === true) setShow(true)
  }, [showOverride])
  const effectiveShow = showOverride === true ? true : show
  const rawDisplay = effectiveShow ? (value || 'none') : (value ? HIDDEN_MASK : 'none')
  const canCopy = !!(value && value.length)
  const onCopy = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error(`Failed to copy ${label.toLowerCase()}`)
    }
  }
  const q = (query || '').trim()
  const highlight = (text, q) => {
    if (!q || q.length === 0) return text
    const lowerText = String(text)
    const lowerQ = q
    const parts = []
    let i = 0
    let idx = lowerText.toLowerCase().indexOf(lowerQ.toLowerCase(), i)
    while (idx !== -1) {
      if (idx > i) parts.push(lowerText.slice(i, idx))
      const match = lowerText.slice(idx, idx + lowerQ.length)
      parts.push(<mark key={`m-${idx}`} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{match}</mark>)
      i = idx + lowerQ.length
      idx = lowerText.toLowerCase().indexOf(lowerQ.toLowerCase(), i)
    }
    if (i < lowerText.length) parts.push(lowerText.slice(i))
    return parts
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm truncate max-w-[180px]">
        {effectiveShow ? highlight(rawDisplay, q) : rawDisplay}
      </span>
      {canCopy && (
        <>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            title={effectiveShow ? 'Hide' : 'Show'}
            onClick={() => setShow((v) => !v)}
            disabled={showOverride === true}
          >
            {!effectiveShow ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            title={`Copy ${label}`}
            onClick={onCopy}
          >
            {copied ? <CheckIcon className="size-4 text-green-600" /> : <CopyIcon className="size-4" />}
          </Button>
        </>
      )}
    </div>
  )
}

function ViewNoteButton({ note = '' }) {
  const [open, setOpen] = useState(false)
  if (!note || !note.length) {
    return <span className="text-muted-foreground text-xs">none</span>
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="h-8 w-8 p-0" title="View note">
          <EyeIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note</DialogTitle>
        </DialogHeader>
        <div className="mt-2 whitespace-pre-wrap break-words text-sm">{note}</div>
      </DialogContent>
    </Dialog>
  )
}

function CreateAccountButton({ onCreated }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', username: '', note: '' } })
  const [open, setOpen] = useState(false)
  const submit = async (values) => {
    const account = { ...values, id: crypto.randomUUID(), createdAt: Date.now() }
    await saveAccount(account, { source: 'crear' })
    onCreated?.(account)
    form.reset({ name: '', email: '', username: '', note: '' })
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
          <Label>Service</Label>
          <Input placeholder="Service" {...form.register('name')} />
          <Label>Username</Label>
          <Input placeholder="Username (optional)" {...form.register('username')} />
          <Label>Email</Label>
          <Input placeholder="Email (optional)" type="email" {...form.register('email')} />
          <Label>Note to remember password</Label>
          <Textarea placeholder="Hint or note (optional)" {...form.register('note')} />
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}