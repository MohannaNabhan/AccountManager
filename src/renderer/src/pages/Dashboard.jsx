import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ChartContainer } from '@/components/ui/chart'
import * as Recharts from 'recharts'
import { toast } from 'sonner'
import { getAccounts, getNotes, onStorageUpdate, KEYS } from '@/services/storage'

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [notes, setNotes] = useState([])

  useEffect(() => {
    (async () => {
      setAccounts(await getAccounts())
      setNotes(await getNotes())
    })()
    const unsub = onStorageUpdate(async ({ key }) => {
      if (key === KEYS.ACCOUNTS_KEY) setAccounts(await getAccounts())
      if (key === KEYS.NOTES_KEY) setNotes(await getNotes())
    })
    return () => unsub?.()
  }, [])

  // Simple reminder demo: toast notes with reminderAt in the past 1 minute
  useEffect(() => {
    const now = Date.now()
    notes
      .filter((n) => n.reminderAt && n.reminderAt <= now)
      .forEach((n) => {
        toast.info(`Recordatorio: ${n.title}`)
      })
  }, [notes])

  const statusData = useMemo(() => {
    const counts = accounts.reduce((acc, a) => {
      acc[a.status || 'activo'] = (acc[a.status || 'activo'] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [accounts])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Total de cuentas</div>
        <div className="text-3xl font-semibold">{accounts.length}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Total de notas</div>
        <div className="text-3xl font-semibold">{notes.length}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Última actividad</div>
        <div className="text-xs">{new Date().toLocaleString()}</div>
      </Card>

      <div className="lg:col-span-2">
        <Card className="p-4">
          <div className="mb-2 font-medium">Distribución de estado de cuentas</div>
          <ChartContainer
            config={{
              activo: { label: 'Activas', color: '#4ade80' },
              inactivo: { label: 'Inactivas', color: '#f87171' },
              pendiente: { label: 'Pendientes', color: '#60a5fa' }
            }}
          >
            <Recharts.PieChart>
              <Recharts.Pie data={statusData} dataKey="value" nameKey="name" outerRadius={100}>
                {statusData.map((entry, index) => (
                  <Recharts.Cell key={`cell-${index}`} fill={`var(--color-${entry.name})`} />
                ))}
              </Recharts.Pie>
              <Recharts.Legend />
              <Recharts.Tooltip />
            </Recharts.PieChart>
          </ChartContainer>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 font-medium">Acciones rápidas</div>
        <div className="flex gap-2">
          <Button asChild><a href="#/accounts">Crear cuenta</a></Button>
          <Button variant="outline" asChild><a href="#/notes">Nueva nota</a></Button>
        </div>
      </Card>
    </div>
  )
}