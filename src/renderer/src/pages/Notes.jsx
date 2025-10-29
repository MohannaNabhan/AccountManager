import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import MarkdownEditor from '@/components/MarkdownEditor'
import { chooseAttachment, saveAttachment } from '@/services/attachments'
import { getNotes, saveNote, deleteNote, onStorageUpdate, KEYS } from '@/services/storage'
import { toast } from 'sonner'
import { exportCSV, exportPDF, toCSV } from '@/services/export'

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [attachments, setAttachments] = useState([])

  useEffect(() => {
    (async () => setNotes(await getNotes()))()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.NOTES_KEY) setNotes(await getNotes())
    })
    return () => unsub?.()
  }, [])

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      const text = `${n.title} ${n.content}`.toLowerCase()
      const matchSearch = text.includes(search.toLowerCase())
      const matchCategory = category === 'todas' || (n.category || '') === category
      return matchSearch && matchCategory
    })
  }, [notes, search, category])

  const createNote = async () => {
    const note = {
      id: crypto.randomUUID(),
      title,
      content,
      category: category === 'todas' ? '' : category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      attachments,
      createdAt: Date.now(),
    }
    await saveNote(note)
    setTitle('')
    setContent('')
    setTags('')
    setAttachments([])
    toast.success('Nota creada')
  }

  const addAttachment = async () => {
    const source = await chooseAttachment()
    if (!source) return
    const saved = await saveAttachment(source)
    if (saved) setAttachments((prev) => [...prev, saved])
  }

  const exportNotesCSV = async () => {
    const cols = [
      { key: 'title', header: 'Título' },
      { key: 'category', header: 'Categoría' },
      { key: 'createdAt', header: 'Fecha' },
    ]
    const rows = notes.map((n) => ({ ...n, createdAt: new Date(n.createdAt).toLocaleString() }))
    const csv = toCSV(rows, cols)
    await exportCSV('notas', csv)
  }

  const exportNotesPDF = async () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Notas</title></head><body><h1>Notas</h1>${notes
      .map((n) => `<h2>${escapeHTML(n.title)}</h2><div>${escapeHTML(n.category || '')}</div><p>${escapeHTML(n.content).replace(/\n/g, '<br/>')}</p>`)
      .join('')} </body></html>`
    await exportPDF('notas', html)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar en notas" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="técnica">Técnica</SelectItem>
            <SelectItem value="recordatorio">Recordatorio</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={exportNotesCSV}>Exportar CSV</Button>
        <Button variant="secondary" onClick={exportNotesPDF}>Exportar PDF</Button>
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Nueva nota</div>
        <MarkdownEditor value={content} onChange={setContent} title={title} onTitleChange={setTitle} />
        <div className="flex gap-2">
          <Input placeholder="Etiquetas (separadas por coma)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Sin categoría</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="técnica">Técnica</SelectItem>
              <SelectItem value="recordatorio">Recordatorio</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={addAttachment}>Adjuntar archivo</Button>
          <Button onClick={createNote}>Guardar nota</Button>
        </div>
        <div className="text-xs text-muted-foreground">Adjuntos: {attachments.map((a) => a.filename).join(', ')}</div>
      </div>

      <Separator />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((n) => (
            <TableRow key={n.id}>
              <TableCell>{n.title}</TableCell>
              <TableCell>{n.category || '-'}</TableCell>
              <TableCell>{(n.tags || []).join(', ')}</TableCell>
              <TableCell>{new Date(n.createdAt).toLocaleString()}</TableCell>
              <TableCell className="flex gap-2">
                <Button variant="secondary" onClick={() => {
                  setTitle(n.title); setContent(n.content); setTags((n.tags || []).join(', ')); setAttachments(n.attachments || [])
                }}>Editar</Button>
                <Button variant="destructive" onClick={async () => { await deleteNote(n.id); toast.success('Nota eliminada') }}>Eliminar</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function escapeHTML(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}