import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, Edit3 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  getAutoFormData,
  addAutoFormItem,
  updateAutoFormItem,
  deleteAutoFormItem,
  PERSONAL_TEMPLATE,
  CREDIT_CARD_TEMPLATE,
  ADDRESS_TEMPLATE,
  EMAIL_TEMPLATE
} from '@/services/autoform'

export default function AutoForm() {
  const [autoFormData, setAutoFormData] = useState({
    personal: [],
    creditCard: [],
    address: [],
    email: []
  })
  const [editingItem, setEditingItem] = useState({ section: null, id: null, data: null })

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAutoFormData()
        setAutoFormData(data)
      } catch (err) {
        console.error('Error loading auto form data:', err)
      }
    }
    loadData()
  }, [])

  const addNewItem = (section) => {
    let template = {}
    switch (section) {
      case 'personal':
        template = { ...PERSONAL_TEMPLATE }
        break
      case 'creditCard':
        template = { ...CREDIT_CARD_TEMPLATE }
        break
      case 'address':
        template = { ...ADDRESS_TEMPLATE }
        break
      case 'email':
        template = { ...EMAIL_TEMPLATE }
        break
    }
    setEditingItem({ section, id: 'new', data: template })
  }

  const editItem = (section, item) => {
    setEditingItem({ section, id: item.id, data: { ...item } })
  }

  const saveItem = async () => {
    try {
      if (editingItem.id === 'new') {
        await addAutoFormItem(editingItem.section, editingItem.data)
        toast.success('Elemento agregado correctamente')
      } else {
        await updateAutoFormItem(editingItem.section, editingItem.id, editingItem.data)
        toast.success('Elemento actualizado correctamente')
      }

      // Recargar datos
      const data = await getAutoFormData()
      setAutoFormData(data)
      setEditingItem({ section: null, id: null, data: null })
    } catch (err) {
      console.error('Error saving item:', err)
      toast.error('Error al guardar el elemento')
    }
  }

  const deleteItem = async (section, itemId) => {
    try {
      await deleteAutoFormItem(section, itemId)
      const data = await getAutoFormData()
      setAutoFormData(data)
      toast.success('Elemento eliminado correctamente')
    } catch (err) {
      console.error('Error deleting item:', err)
      toast.error('Error al eliminar el elemento')
    }
  }

  const updateEditingField = (field, value) => {
    setEditingItem(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }))
  }

  const cancelEdit = () => {
    setEditingItem({ section: null, id: null, data: null })
  }

  const renderPersonalForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Nombre del perfil</Label>
          <Input
            value={editingItem.data?.name || ''}
            onChange={(e) => updateEditingField('name', e.target.value)}
            placeholder="Ej: Personal, Trabajo, etc."
          />
        </div>
        <div className="grid gap-2">
          <Label>Nombre</Label>
          <Input
            value={editingItem.data?.firstName || ''}
            onChange={(e) => updateEditingField('firstName', e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="grid gap-2">
          <Label>Apellido</Label>
          <Input
            value={editingItem.data?.lastName || ''}
            onChange={(e) => updateEditingField('lastName', e.target.value)}
            placeholder="Tu apellido"
          />
        </div>
        <div className="col-span-2 mt-2">
          <Separator />
          <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">Only Visual</p>
        </div>
        <div className="grid gap-2">
          <Label>Fecha de nacimiento</Label>
          <Input
            type="date"
            value={editingItem.data?.birthDate || ''}
            onChange={(e) => updateEditingField('birthDate', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Teléfono</Label>
          <div className="flex gap-2">
            <Input
              className="w-20"
              value={editingItem.data?.phonePrefix || ''}
              onChange={(e) => updateEditingField('phonePrefix', e.target.value)}
              placeholder="+34"
            />
            <Input
              className="flex-1"
              value={editingItem.data?.phoneNumber || ''}
              onChange={(e) => updateEditingField('phoneNumber', e.target.value)}
              placeholder="600000000"
            />
          </div>
        </div>
        <div className="col-span-2 mt-2">
          <Separator />
          <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">Only Visual</p>
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={editingItem.data?.email || ''}
            onChange={(e) => updateEditingField('email', e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={cancelEdit}>
          Cancelar
        </Button>
        <Button type="button" onClick={saveItem}>
          Guardar
        </Button>
      </div>
    </div >
  )

  const renderCreditCardForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Nombre del perfil</Label>
          <Input
            value={editingItem.data?.name || ''}
            onChange={(e) => updateEditingField('name', e.target.value)}
            placeholder="Ej: Personal, Trabajo, etc."
          />
        </div>
        <div className="grid gap-2">
          <Label>Nombre del titular</Label>
          <Input
            value={editingItem.data?.holderName || ''}
            onChange={(e) => updateEditingField('holderName', e.target.value)}
            placeholder="Nombre como aparece en la tarjeta"
          />
        </div>
        <div className="grid gap-2 col-span-2">
          <Label>Número de tarjeta</Label>
          <Input
            value={editingItem.data?.number || ''}
            onChange={(e) => updateEditingField('number', e.target.value)}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
          />
        </div>
        <div className="grid gap-2">
          <Label>CVV</Label>
          <Input
            value={editingItem.data?.cvv || ''}
            onChange={(e) => updateEditingField('cvv', e.target.value)}
            placeholder="123"
            maxLength={4}
          />
        </div>
        <div className="col-span-2 mt-2">
          <Separator />
          <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">Only Visual</p>
        </div>
        <div className="grid gap-2">
          <Label>Mes de expiración</Label>
          <Select value={editingItem.data?.expiryMonth || ''} onValueChange={(value) => updateEditingField('expiryMonth', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {String(i + 1).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Año de expiración</Label>
          <Select value={editingItem.data?.expiryYear || ''} onValueChange={(value) => updateEditingField('expiryYear', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 20 }, (_, i) => {
                const year = new Date().getFullYear() + i
                return (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={cancelEdit}>
          Cancelar
        </Button>
        <Button type="button" onClick={saveItem}>
          Guardar
        </Button>
      </div>
    </div>
  )

  const renderAddressForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Nombre del perfil</Label>
          <Input
            value={editingItem.data?.name || ''}
            onChange={(e) => updateEditingField('name', e.target.value)}
            placeholder="Ej: Casa, Trabajo, etc."
          />
        </div>
        <div className="grid gap-2">
          <Label>Calle</Label>
          <Input
            value={editingItem.data?.street || ''}
            onChange={(e) => updateEditingField('street', e.target.value)}
            placeholder="Nombre de la calle"
          />
        </div>
        <div className="grid gap-2">
          <Label>Número</Label>
          <Input
            value={editingItem.data?.streetNumber || ''}
            onChange={(e) => updateEditingField('streetNumber', e.target.value)}
            placeholder="123"
          />
        </div>
        <div className="grid gap-2">
          <Label>Ciudad</Label>
          <Input
            value={editingItem.data?.city || ''}
            onChange={(e) => updateEditingField('city', e.target.value)}
            placeholder="Tu ciudad"
          />
        </div>
        <div className="grid gap-2">
          <Label>Estado/Provincia</Label>
          <Input
            value={editingItem.data?.state || ''}
            onChange={(e) => updateEditingField('state', e.target.value)}
            placeholder="Tu estado o provincia"
          />
        </div>
        <div className="grid gap-2">
          <Label>Código postal</Label>
          <Input
            value={editingItem.data?.zipCode || ''}
            onChange={(e) => updateEditingField('zipCode', e.target.value)}
            placeholder="12345"
          />
        </div>
        <div className="grid gap-2">
          <Label>País</Label>
          <Input
            value={editingItem.data?.country || ''}
            onChange={(e) => updateEditingField('country', e.target.value)}
            placeholder="Tu país"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={cancelEdit}>
          Cancelar
        </Button>
        <Button type="button" onClick={saveItem}>
          Guardar
        </Button>
      </div>
    </div>
  )

  const renderEmailForm = () => (
    <Card className="p-6">
      <h3 className="text-lg font-medium mb-4">
        {editingItem.id ? 'Editar correo' : 'Nuevo correo'}
      </h3>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Nombre del perfil</Label>
          <Input
            value={editingItem.data?.name || ''}
            onChange={(e) => updateEditingField('name', e.target.value)}
            placeholder="Ej: Personal, Trabajo, etc."
          />
        </div>
        <div className="grid gap-2">
          <Label>Correo electrónico</Label>
          <Input
            type="email"
            value={editingItem.data?.email || ''}
            onChange={(e) => updateEditingField('email', e.target.value)}
            placeholder="usuario@ejemplo.com"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button type="button" variant="outline" onClick={cancelEdit}>
          Cancelar
        </Button>
        <Button type="button" onClick={saveItem}>
          Guardar
        </Button>
      </div>
    </Card>
  )

  const renderItemsList = (section, items, sectionName) => {
    // Asegurar que items sea siempre un array
    const itemsArray = Array.isArray(items) ? items : []

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{sectionName}</h3>
          <Button type="button" onClick={() => addNewItem(section)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Agregar {sectionName.toLowerCase()}
          </Button>
        </div>

        {itemsArray.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay {sectionName.toLowerCase()} guardados
          </div>
        ) : (
          <div className="grid gap-3">
            {itemsArray.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.name || 'Sin nombre'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {section === 'personal' && `${item.firstName} ${item.lastName}`}
                      {section === 'creditCard' && `**** **** **** ${item.number?.slice(-4) || ''}`}
                      {section === 'address' && `${item.street} ${item.streetNumber}, ${item.city}`}
                      {section === 'email' && item.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editItem(section, item)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(section, item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto Form</h1>
          <p className="text-muted-foreground">
            Configura múltiples perfiles de datos para rellenar formularios automáticamente
          </p>
        </div>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal">Datos Personales</TabsTrigger>
            <TabsTrigger value="creditCard">Tarjetas</TabsTrigger>
            <TabsTrigger value="address">Direcciones</TabsTrigger>
            <TabsTrigger value="email">Correos</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-6">
            {editingItem.section === 'personal' ? (
              renderPersonalForm()
            ) : (
              renderItemsList('personal', autoFormData.personal, 'Datos Personales')
            )}
          </TabsContent>

          <TabsContent value="creditCard" className="mt-6">
            {editingItem.section === 'creditCard' ? (
              renderCreditCardForm()
            ) : (
              renderItemsList('creditCard', autoFormData.creditCard, 'Tarjetas')
            )}
          </TabsContent>

          <TabsContent value="address" className="mt-6">
            {editingItem.section === 'address' ? (
              renderAddressForm()
            ) : (
              renderItemsList('address', autoFormData.address, 'Direcciones')
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            {editingItem.section === 'email' ? (
              renderEmailForm()
            ) : (
              renderItemsList('email', autoFormData.email, 'Correos')
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}