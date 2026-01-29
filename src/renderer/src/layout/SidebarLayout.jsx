import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  FolderIcon,
  Trash2Icon,
  UsersIcon,
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  SearchIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  CheckIcon,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  Settings2Icon,
  LinkIcon,
  FormInput
} from 'lucide-react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender
} from '@tanstack/react-table'

import * as LucideIcons from 'lucide-react'
import {
  getProjects,
  getAccounts,
  getTrashAccounts,
  getNotes,
  onStorageUpdate,
  KEYS,
  saveProject,
  saveAccount,
  deleteAccount
} from '@/services/storage'
import { getPasswordSettings, savePasswordSettings, generatePassword } from '@/services/passwords'
import { generateUsername, getUsernameSettings, saveUsernameSettings } from '@/services/usernames'
import ImportPrompt from '@/components/custom/ImportPrompt'
import ContentScroll from '@/components/custom/ContentScroll'
import WindowFrame from '@/components/custom/WindowFrame'
import EditAccountDialog from '@/components/custom/EditAccountDialog'
import ConnectionStatus from '@/components/ConnectionStatus'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
export default function SidebarLayout({ children }) {
  const isMobile = useIsMobile()
  const [appVersion, setAppVersion] = useState('')
  const location = useLocation()
  const [projects, setProjects] = useState([])
  const [counts, setCounts] = useState({})
  const [profiles, setProfiles] = useState([])
  const [currentProfile, setCurrentProfile] = useState('')
  const [openProjectIds, setOpenProjectIds] = useState([])
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [notesCount, setNotesCount] = useState(0)

  // Global search state
  const [globalSearch, setGlobalSearch] = useState('')
  const [allAccounts, setAllAccounts] = useState([])
  const [showSearch, setShowSearch] = useState(false)

  // Password settings state
  const [pwSettings, setPwSettings] = useState({
    length: 15,
    includeNumbers: true,
    includeLetters: true,
    includeSymbols: true
  })

  // Update logic
  const [updateStatus, setUpdateStatus] = useState(null)

  useEffect(() => {
    const unsub = window.api.app.onUpdateStatus((payload) => {
      console.log('Update status:', payload)
      setUpdateStatus(payload)
      if (payload.status === 'downloaded') {
        toast.info('Update ready to install', {
          action: {
            label: 'Install',
            onClick: () => window.api.app.installUpdate()
          },
          duration: Infinity
        })
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // close any mobile overlays etc. if needed
    // Clear global search when navigating to a new page
    setGlobalSearch('')
  }, [location.pathname])

  useEffect(() => {
    ; (async () => {
      setProjects(await getProjects())
      try {
        const notes = await getNotes()
        setNotesCount(notes.length)
      } catch { }
      // Load all accounts for global search
      try {
        const accounts = await getAccounts()
        setAllAccounts(Array.isArray(accounts) ? accounts : [])
      } catch { }
      // Load password settings
      setPwSettings(await getPasswordSettings())
    })()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.PROJECTS_KEY) setProjects(await getProjects())
      if (key === KEYS.ACCOUNTS_KEY) {
        refreshCounts()
        // Update accounts for global search
        try {
          const accounts = await getAccounts()
          setAllAccounts(Array.isArray(accounts) ? accounts : [])
        } catch { }
      }
      if (key === KEYS.NOTES_KEY) {
        try {
          const notes = await getNotes()
          setNotesCount(notes.length)
        } catch { }
      }
      // Refresh profiles when they change anywhere (Settings, create/delete)
      if (key === KEYS.PROFILES_KEY || key === KEYS.CURRENT_PROFILE_KEY) {
        try {
          const res = await window.api.vault.profiles.list()
          setProfiles(res?.profiles || [])
          setCurrentProfile(res?.currentProfile || '')
        } catch (err) {
          console.error('Failed to refresh profiles', err)
        }
      }
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const v = await window.api?.app?.version?.()
          if (mounted && typeof v === 'string') setAppVersion(v)
        } catch { }
      })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    refreshCounts()
  }, [projects])

  // Open submenu for active project route
  useEffect(() => {
    const match = location.pathname.match(/^\/projects\/(.+?)(?:$|\/)/)
    if (match) {
      const pid = match[1]
      setOpenProjectIds((prev) => (prev.includes(pid) ? prev : [...prev, pid]))
    }
  }, [location.pathname])

  async function refreshCounts() {
    try {
      const active = await getAccounts()
      const trash = await getTrashAccounts()
      setTotalAccounts(Array.isArray(active) ? active.length : 0)
      const map = {}
      for (const a of active) {
        const pid = a.projectId
        map[pid] = map[pid] || { active: 0, trash: 0 }
        map[pid].active += 1
      }
      for (const a of trash) {
        const pid = a.projectId
        map[pid] = map[pid] || { active: 0, trash: 0 }
        map[pid].trash += 1
      }
      setCounts(map)
    } catch (e) {
      console.error('Error calculating counts:', e)
    }
  }

  useEffect(() => {
    ; (async () => {
      try {
        const st = await window.api.vault.status()
        const profRes = await window.api.vault.profiles.list()
        const list = profRes?.profiles || []
        setProfiles(list)
        setCurrentProfile(st?.currentProfile || profRes?.currentProfile || list[0]?.id || '')
      } catch (err) {
        console.error('Failed to load profiles', err)
      }
    })()
  }, [])

  async function handleSelectProfile(id) {
    try {
      setCurrentProfile(id)
      await window.api.vault.profiles.select(id)
      await window.api.vault.lock()
      await window.api.app.reload()
    } catch (err) {
      console.error('Failed to switch account', err)
    }
  }

  function toggleProjectOpen(pid, e) {
    e?.preventDefault()
    e?.stopPropagation()
    setOpenProjectIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
    )
  }

  // Filtered search
  const filteredAccounts = useMemo(() => {
    if (!globalSearch.trim()) return []

    const searchTerm = globalSearch.trim().toLowerCase()

    return allAccounts.filter((account) => {
      const searchableText = [
        account.name,
        account.email,
        account.username,
        account.note,
        Array.isArray(account.links) ? account.links.join(' ') : account.links
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(searchTerm)
    })
  }, [allAccounts, globalSearch])

  // Show search when there is text
  useEffect(() => {
    setShowSearch(globalSearch.trim().length > 0)
  }, [globalSearch])

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-screen _move">
        <div className="flex flex-1">
          <Sidebar
            className="mt-10.5 h-[calc(100%-40px)]"
            collapsible={isMobile ? 'mobile' : 'offcanvas'}
          >
            <SidebarHeader>
              {/* <div className="px-3 pt-3 text-lg font-semibold">AccountManager</div>
            <div className="px-3 pb-3">
               <div className="text-xs text-muted-foreground mb-1">Account</div>
              <Select value={currentProfile} onValueChange={handleSelectProfile}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>*/}

              <div className="px-3 pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full border border-red-500/20 text-red-500"
                  onClick={async () => {
                    try {
                      await window.api.vault.lock()
                      await window.api.app.reload()
                    } catch (err) {
                      console.error('Failed to logout', err)
                    }
                  }}
                >
                  Log out
                </Button>
              </div>
            </SidebarHeader>
            <SidebarContent>
              {/* General group */}
              <SidebarGroup>
                <SidebarGroupLabel>General</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname.startsWith('/settings')}
                      >
                        <Link to="/settings" className="flex items-center gap-2">
                          <SettingsIcon className="size-4" />
                          Settings
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname.startsWith('/autoform')}
                      >
                        <Link to="/autoform" className="flex items-center gap-2">
                          <FormInput className="size-4" />
                          Auto Form
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname.startsWith('/projects')}
                      >
                        <Link to="/projects" className="flex items-center gap-2">
                          <FolderIcon className="size-4" />
                          Projects
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>{projects.length}</SidebarMenuBadge>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* Projects group */}
              <SidebarGroup>
                <SidebarGroupLabel>Projects</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {projects.map((p) => (
                      <SidebarMenuItem key={p.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname.startsWith(`/projects/${p.id}`)}
                        >
                          <Link to={`/projects/${p.id}`} className="flex items-center gap-2">
                            {(() => {
                              const IconComp = LucideIcons[p.icon] || FolderIcon
                              return <IconComp className="size-4" />
                            })()}
                            {p.name}
                            <span
                              onClick={(e) => toggleProjectOpen(p.id, e)}
                              className="ml-auto flex items-center"
                            >
                              <ChevronDownIcon
                                className={`size-4 transition-transform ${openProjectIds.includes(p.id) ? 'rotate-180' : ''}`}
                              />
                            </span>
                          </Link>
                        </SidebarMenuButton>
                        <SidebarMenuBadge className="mr-6 bg-muted text-secondary-foreground rounded">
                          {counts[p.id]?.active ?? 0}
                        </SidebarMenuBadge>
                        {openProjectIds.includes(p.id) && (
                          <SidebarMenuSub>
                            {[
                              {
                                to: `/projects/${p.id}`,
                                icon: UsersIcon,
                                label: 'Accounts',
                                count: counts[p.id]?.active ?? 0,
                                active: location.pathname === `/projects/${p.id}`
                              },
                              {
                                to: `/projects/${p.id}/trash`,
                                icon: Trash2Icon,
                                label: 'Trash',
                                count: counts[p.id]?.trash ?? 0,
                                active: location.pathname === `/projects/${p.id}/trash`
                              }
                            ].map((item, idx, arr) => (
                              <SidebarMenuSubItem key={item.to} className="relative">
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={item.active}
                                  className="relative"
                                >
                                  <Link to={item.to} className="flex  items-center gap-2">
                                    <item.icon className="size-4 text-secondary-foreground" />
                                    <span>{item.label}</span>
                                    {item.label != 'Accounts' && (
                                      <span className="ml-auto rounded bg-muted px-1 text-xs min-w-5 text-center">
                                        {item.count}
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              {updateStatus?.status === 'available' && (
                <div className="px-3 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs border-blue-500 text-blue-500 hover:text-blue-600"
                    onClick={() => window.api.app.startDownloadUpdate()}
                  >
                    <LucideIcons.DownloadIcon className="size-3 mr-2" />
                    New version available
                  </Button>
                </div>
              )}
              {updateStatus?.status === 'downloading' && (
                <div className="px-3 pb-2 text-xs text-yellow-500">
                  Downloading update: {Math.round(updateStatus.progress?.percent || 0)}%
                </div>
              )}
              {updateStatus?.status === 'downloaded' && (
                <div className="px-3 pb-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.api.app.installUpdate()}
                  >
                    Update and Restart
                  </Button>
                </div>
              )}

              <div className="text-xs text-muted-foreground px-3 pb-3">
                {appVersion ? `v${appVersion}` : 'v...'}
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex flex-col overflow-hidden relative h-[calc(94%)] ">
            <ImportPrompt />
            <div className="flex h-14 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <div className="font-medium">
                {showSearch ? 'Search Results' : titleForPath(location.pathname)}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ConnectionStatus />
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in all projects and accounts..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="pl-8 w-96"
                  />
                </div>
              </div>
            </div>
            <div className="h-[700px] min-h-[700px] _no_move max-h-[700px] p-4 overflow-hidden relative">
              <div className="h-full w-full overflow-auto pr-4">
                {showSearch ? (
                  <SearchResults
                    accounts={filteredAccounts}
                    projects={projects}
                    searchTerm={globalSearch}
                    pwSettings={pwSettings}
                    setPwSettings={setPwSettings}
                  />
                ) : (
                  children
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}

function titleForPath(path) {
  if (path.startsWith('/dashboard')) return 'Dashboard'
  if (path.startsWith('/accounts')) return 'Accounts'
  if (path.startsWith('/notes')) return 'Notes'
  if (path.startsWith('/projects/') && path.endsWith('/trash')) return 'Project Trash'
  if (path.startsWith('/projects/')) return 'Project Accounts'
  if (path.startsWith('/projects')) return 'Projects'
  return 'Projects'
}



// Component to show search results
function SearchResults({ accounts, projects, searchTerm, pwSettings, setPwSettings }) {
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [rowSelection, setRowSelection] = useState({})
  const [forceShowCols, setForceShowCols] = useState({ username: false, email: false, password: false, links: false })
  const toggleForce = (key) => setForceShowCols((s) => ({ ...s, [key]: !s[key] }))

  const getProjectName = (projectId) => {
    const project = projects.find((p) => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  // Detect accounts with unknown projects
  const orphanedAccounts = accounts.filter((account) => {
    const project = projects.find((p) => p.id === account.projectId)
    return !project
  })

  // Show warning if there are orphaned accounts
  const showOrphanWarning = orphanedAccounts.length > 0

  // Function to create default project and reassign orphaned accounts
  const handleFixOrphanedAccounts = async () => {
    try {
      // Create default project
      const defaultProject = {
        id: crypto.randomUUID(),
        name: 'Accounts without project',
        description: 'Automatically created for orphaned accounts',
        icon: 'FolderIcon',
        createdAt: Date.now()
      }

      await saveProject(defaultProject)

      // Reasignar todas las cuentas huérfanas al nuevo proyecto
      for (const account of orphanedAccounts) {
        const updatedAccount = { ...account, projectId: defaultProject.id }
        await saveAccount(updatedAccount, { source: 'fix-orphaned' })
      }

      // Mostrar mensaje de éxito
      toast.success(
        `Se reasignaron ${orphanedAccounts.length} cuentas al proyecto "${defaultProject.name}"`
      )
    } catch (error) {
      console.error('Error al corregir cuentas huérfanas:', error)
      toast.error('Error al corregir las cuentas huérfanas')
    }
  }

  // Función para resaltar coincidencias de búsqueda
  function highlightMatch(text, searchTerm) {
    if (!text || !searchTerm) return text

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </span>
      ) : part
    )
  }

  // SensitiveCell component with search highlight
  function SensitiveCellWithHighlight({ value = '', label, initialShow = false, searchTerm, showOverride }) {
    const [show, setShow] = useState(initialShow)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
      if (showOverride === true) setShow(true)
    }, [showOverride])

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success(`${label} copied`)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Copy failed:', err)
        toast.error(`Failed to copy ${label.toLowerCase()}`)
      }
    }

    const effectiveShow = showOverride === true ? true : show
    const displayValue = effectiveShow ? (value || 'none') : (value ? HIDDEN_MASK : 'none')
    const canCopy = !!(value && value.length)

    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm truncate max-w-[180px]">
          {effectiveShow ? highlightMatch(value, searchTerm) : HIDDEN_MASK}
        </span>
        {canCopy && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShow(!show)}
              disabled={showOverride === true}
              title={effectiveShow ? 'Hide' : 'Show'}
            >
              {!effectiveShow ? <EyeOffIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCopy}
              title={`Copy ${label}`}
            >
              {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ViewNoteButton component with search highlight
  function ViewNoteButtonWithHighlight({ note = '', size = 'sm', searchTerm }) {
    if (!note) return <span className="text-muted-foreground">No note</span>

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size={size}>
            View note
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account Note</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
              {highlightMatch(note, searchTerm)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'projectName',
      header: 'Project',
      cell: ({ row }) => <div className="font-medium">{getProjectName(row.original.projectId)}</div>
    },
    {
      accessorKey: 'name',
      header: 'Service',
      cell: ({ row }) => (
        <div className="font-medium">
          {highlightMatch(row.getValue('name') || 'none', searchTerm)}
        </div>
      )
    },
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
          <SensitiveCellWithHighlight
            value={row.getValue('email') || 'none'}
            label="Email"
            initialShow={forceShowCols.email ? true : false}
            searchTerm={searchTerm}
            showOverride={forceShowCols.email ? true : undefined}
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
        <SensitiveCellWithHighlight
          value={row.getValue('username') || 'none'}
          label="Username"
          initialShow={forceShowCols.username ? true : false}
          searchTerm={searchTerm}
          showOverride={forceShowCols.username ? true : undefined}
        />
      )
    },
    {
      accessorKey: 'password',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Password</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.password ? 'Hide' : 'Show'} onClick={() => toggleForce('password')}>
            {!forceShowCols.password ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <SensitiveCellWithHighlight
          value={row.getValue('password') || ''}
          label="Password"
          initialShow={forceShowCols.password ? true : false}
          searchTerm={searchTerm}
          showOverride={forceShowCols.password ? true : undefined}
        />
      )
    },
    {
      accessorKey: 'links',
      header: () => (
        <div className="flex items-center gap-1">
          <span>Links</span>
          <Button type="button" variant="ghost" className="h-8 w-8 p-0" title={forceShowCols.links ? 'Hide' : 'Show'} onClick={() => toggleForce('links')}>
            {!forceShowCols.links ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const links = row.getValue('links') || []
        const first = Array.isArray(links) && links.length > 0 ? links[0] : 'none'
        return (
          <SensitiveCellWithHighlight
            value={first}
            label="Links"
            initialShow={forceShowCols.links ? true : false}
            searchTerm={searchTerm}
            showOverride={forceShowCols.links ? true : undefined}
          />
        )
      }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Created <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {new Date(row.getValue('createdAt')).toLocaleDateString()}
        </div>
      )
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
                toast.success('Cuenta eliminada')
              }}
            >
              Eliminar
            </Button>
          </div>
        )
      }
    }
  ], [projects, searchTerm, forceShowCols])

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

  if (!searchTerm.trim()) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Escribe algo para buscar en todos los proyectos y cuentas
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No se encontraron resultados para "{searchTerm}"
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resultados de búsqueda ({accounts.length})</h3>
        <div className="text-sm text-muted-foreground">Buscando: "{searchTerm}"</div>
      </div>

      {showOrphanWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Se encontraron {orphanedAccounts.length} cuentas con proyectos desconocidos
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Estas cuentas pertenecen a proyectos que ya no existen
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFixOrphanedAccounts}
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200 dark:hover:bg-yellow-900/30"
            >
              Corregir automáticamente
            </Button>
          </div>
        </div>
      )}

      <ContentScroll mainClass="mt-2 !h-[400px]" className="p-1">
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

// Schema para validación del formulario de edición
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
