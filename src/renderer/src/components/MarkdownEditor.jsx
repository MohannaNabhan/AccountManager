import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

export default function MarkdownEditor({ value, onChange, title, onTitleChange }) {
  const [local, setLocal] = useState(value || '')
  const [localTitle, setLocalTitle] = useState(title || '')

  useEffect(() => setLocal(value || ''), [value])
  useEffect(() => setLocalTitle(title || ''), [title])

  const html = useMemo(() => {
    const raw = marked.parse(local || '')
    return DOMPurify.sanitize(raw)
  }, [local])

  const insert = (before, after = '') => {
    const selection = window.getSelection()
    onChange?.(local + `\n${before}${after}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Título de la nota"
        value={localTitle}
        onChange={(e) => {
          setLocalTitle(e.target.value)
          onTitleChange?.(e.target.value)
        }}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => insert('**texto en negritas**')}>B</Button>
        <Button type="button" variant="outline" onClick={() => insert('* elemento de lista')}>• Lista</Button>
        <Button type="button" variant="outline" onClick={() => insert('# Encabezado')}>H1</Button>
        <Button type="button" variant="outline" onClick={() => insert('> cita')}>Cita</Button>
        <Button type="button" variant="outline" onClick={() => insert('`código`')}>Code</Button>
      </div>
      <Textarea
        className="min-h-40"
        placeholder="Contenido en Markdown..."
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          onChange?.(e.target.value)
        }}
      />
      <Separator />
      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}