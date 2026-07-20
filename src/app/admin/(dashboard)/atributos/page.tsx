'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Settings2, ListTree, X, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Label } from '@/components/ui/label';
import { AdminListCard } from '@/components/admin/AdminListCard';
import { slugify } from '@/lib/slugify';

// Debe coincidir con DISPLAY_TYPES en src/app/api/admin/attributes/route.ts
const DISPLAY_TYPES = [
  { value: 'select', label: 'Desplegable (select)' },
  { value: 'buttons', label: 'Botones (buttons)' },
] as const;

interface Attribute {
  id: string;
  name: string;
  slug: string;
  displayType: string;
  sortOrder: number | null;
  isActive: boolean | null;
}

interface AttributeValue {
  id: string;
  attributeId: string;
  value: string;
  code: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
}

const emptyForm = { name: '', slug: '', displayType: 'select' as string, sortOrder: 0, isActive: true };
const emptyValueForm = { value: '', code: '', sortOrder: 0, isActive: true };

// ─── Tallas: catálogo simple sin relación con el sistema EAV de Atributos de
// arriba (solo agregar/quitar, activar/desactivar) — alimenta el selector de
// tallas del formulario de producto. ───
interface SizeItem {
  id: string;
  value: string;
  sortOrder: number | null;
  isActive: boolean | null;
}

const emptySizeForm = { value: '', sortOrder: 0, isActive: true };

export default function AdminAttributesPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [valuesDialogOpen, setValuesDialogOpen] = useState(false);
  const [managingAttribute, setManagingAttribute] = useState<Attribute | null>(null);
  const [values, setValues] = useState<AttributeValue[]>([]);
  const [editingValue, setEditingValue] = useState<AttributeValue | null>(null);
  const [valueForm, setValueForm] = useState(emptyValueForm);
  const [savingValue, setSavingValue] = useState(false);

  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [loadingSizes, setLoadingSizes] = useState(true);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<SizeItem | null>(null);
  const [sizeForm, setSizeForm] = useState(emptySizeForm);
  const [savingSize, setSavingSize] = useState(false);

  const fetchAttributes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/attributes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAttributes(data.attributes);
    } catch {
      toast.error('Error al cargar atributos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const fetchSizes = useCallback(async () => {
    setLoadingSizes(true);
    try {
      const res = await fetch('/api/admin/sizes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSizes(data.sizes);
    } catch {
      toast.error('Error al cargar tallas');
    } finally {
      setLoadingSizes(false);
    }
  }, []);

  useEffect(() => {
    fetchSizes();
  }, [fetchSizes]);

  function openNewSize() {
    setEditingSize(null);
    setSizeForm(emptySizeForm);
    setSizeDialogOpen(true);
  }

  function openEditSize(size: SizeItem) {
    setEditingSize(size);
    setSizeForm({ value: size.value, sortOrder: size.sortOrder ?? 0, isActive: size.isActive ?? true });
    setSizeDialogOpen(true);
  }

  async function handleSaveSize() {
    setSavingSize(true);
    try {
      const url = editingSize ? `/api/admin/sizes/${editingSize.id}` : '/api/admin/sizes';
      const method = editingSize ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sizeForm),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingSize ? 'Talla actualizada' : 'Talla creada');
      setSizeDialogOpen(false);
      fetchSizes();
    } catch {
      toast.error('Error al guardar la talla');
    } finally {
      setSavingSize(false);
    }
  }

  async function handleDeleteSize(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta talla?')) return;
    try {
      const res = await fetch(`/api/admin/sizes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Talla eliminada');
      fetchSizes();
    } catch {
      toast.error('Error al eliminar la talla');
    }
  }

  function openNew() {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(attr: Attribute) {
    setEditing(attr);
    setFormData({
      name: attr.name,
      slug: attr.slug,
      displayType: attr.displayType,
      sortOrder: attr.sortOrder ?? 0,
      isActive: attr.isActive ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/attributes/${editing.id}` : '/api/admin/attributes';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editing ? 'Atributo actualizado' : 'Atributo creado');
      setDialogOpen(false);
      fetchAttributes();
    } catch {
      toast.error('Error al guardar el atributo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este atributo? Se eliminarán también sus valores.')) return;
    try {
      const res = await fetch(`/api/admin/attributes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Atributo eliminado');
      fetchAttributes();
    } catch {
      toast.error('Error al eliminar el atributo');
    }
  }

  useEffect(() => {
    if (!editing && formData.name && !formData.slug) {
      setFormData(prev => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [formData.name, editing, formData.slug]);

  // ── Valores del atributo ──

  async function openValues(attr: Attribute) {
    setManagingAttribute(attr);
    setEditingValue(null);
    setValueForm(emptyValueForm);
    setValuesDialogOpen(true);
    await refreshValues(attr.id);
  }

  async function refreshValues(attributeId: string) {
    const res = await fetch(`/api/admin/attributes/${attributeId}/values`);
    if (res.ok) setValues((await res.json()).values);
  }

  function openNewValue() {
    setEditingValue(null);
    setValueForm(emptyValueForm);
  }

  function openEditValue(v: AttributeValue) {
    setEditingValue(v);
    setValueForm({ value: v.value, code: v.code || '', sortOrder: v.sortOrder ?? 0, isActive: v.isActive ?? true });
  }

  async function handleSaveValue() {
    if (!managingAttribute) return;
    setSavingValue(true);
    try {
      const url = editingValue
        ? `/api/admin/attribute-values/${editingValue.id}`
        : `/api/admin/attributes/${managingAttribute.id}/values`;
      const method = editingValue ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valueForm),
      });
      if (!res.ok) throw new Error('Failed to save value');
      toast.success(editingValue ? 'Valor actualizado' : 'Valor creado');
      setEditingValue(null);
      setValueForm(emptyValueForm);
      await refreshValues(managingAttribute.id);
    } catch {
      toast.error('Error al guardar el valor');
    } finally {
      setSavingValue(false);
    }
  }

  async function handleDeleteValue(id: string) {
    if (!managingAttribute) return;
    if (!confirm('¿Estás seguro de eliminar este valor?')) return;
    try {
      const res = await fetch(`/api/admin/attribute-values/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete value');
      toast.success('Valor eliminado');
      await refreshValues(managingAttribute.id);
    } catch {
      toast.error('Error al eliminar el valor');
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Atributos (Estilos)</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Atributo
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atributo</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tipo de despliegue</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : attributes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <Settings2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay atributos registrados
                  </TableCell>
                </TableRow>
              ) : (
                attributes.map((attr) => (
                  <TableRow key={attr.id}>
                    <TableCell className="font-medium">{attr.name}</TableCell>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">{attr.slug}</code></TableCell>
                    <TableCell>{DISPLAY_TYPES.find(d => d.value === attr.displayType)?.label ?? attr.displayType}</TableCell>
                    <TableCell>
                      {attr.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openValues(attr)}>
                          <ListTree className="w-4 h-4 mr-1" /> Valores
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(attr)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(attr.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : attributes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Settings2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay atributos registrados</p>
            <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nuevo Atributo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {attributes.map((attr) => (
              <AdminListCard
                key={attr.id}
                onNavigate={() => openEdit(attr)}
                aria-label={`Editar atributo ${attr.name}`}
                title={attr.name}
                subtitle={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{attr.slug}</code>}
                badges={
                  attr.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>
                }
                meta={<p>{DISPLAY_TYPES.find(d => d.value === attr.displayType)?.label ?? attr.displayType}</p>}
                actions={[
                  {
                    key: 'values',
                    label: 'Valores',
                    icon: <ListTree className="w-4 h-4" />,
                    onSelect: () => openValues(attr),
                  },
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(attr.id),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Atributo' : 'Nuevo Atributo'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#111111]">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de despliegue</Label>
            <select
              className="w-full border rounded-md h-10 px-3 text-sm"
              value={formData.displayType}
              onChange={e => setFormData({ ...formData, displayType: e.target.value })}
            >
              {DISPLAY_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <Label>Activo</Label>
          </div>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={valuesDialogOpen}
        onOpenChange={setValuesDialogOpen}
        title={`Valores de ${managingAttribute?.name ?? ''}`}
        footer={<Button variant="outline" onClick={() => setValuesDialogOpen(false)}>Cerrar</Button>}
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {values.length === 0 ? (
              <p className="text-sm text-gray-500">Ningún valor registrado todavía.</p>
            ) : (
              values.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{v.value}</p>
                    {v.code && <p className="text-xs text-gray-500">Código: {v.code}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditValue(v)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteValue(v.id)}><X className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>{editingValue ? 'Editar valor' : 'Nuevo valor'}</Label>
            <Input placeholder="Valor" value={valueForm.value} onChange={e => setValueForm({ ...valueForm, value: e.target.value })} />
            <Input placeholder="Código (opcional)" value={valueForm.code} onChange={e => setValueForm({ ...valueForm, code: e.target.value })} />
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-[#111111]" onClick={handleSaveValue} disabled={savingValue || !valueForm.value}>
                {editingValue ? 'Actualizar' : 'Agregar'}
              </Button>
              {editingValue && (
                <Button size="sm" variant="outline" onClick={openNewValue}>Cancelar edición</Button>
              )}
            </div>
          </div>
        </div>
      </ResponsiveDialog>

      {/* ─── Tallas: catálogo simple, sin relación con Atributos (Estilos) de
      arriba — solo agregar/quitar, activar/desactivar. ─── */}
      <div className="flex items-center justify-between mb-8 mt-12">
        <h2 className="text-2xl font-bold text-[#111111]">Tallas</h2>
        <Button className="bg-[#111111]" onClick={openNewSize}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Talla
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talla</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSizes ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : sizes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                    <Ruler className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay tallas registradas
                  </TableCell>
                </TableRow>
              ) : (
                sizes.map((size) => (
                  <TableRow key={size.id}>
                    <TableCell className="font-medium">{size.value}</TableCell>
                    <TableCell>
                      {size.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditSize(size)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteSize(size.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="md:hidden">
        {loadingSizes ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : sizes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Ruler className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay tallas registradas</p>
            <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNewSize}>
              <Plus className="w-4 h-4" />
              Nueva Talla
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sizes.map((size) => (
              <AdminListCard
                key={size.id}
                onNavigate={() => openEditSize(size)}
                aria-label={`Editar talla ${size.value}`}
                title={size.value}
                badges={
                  size.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>
                }
                actions={[
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDeleteSize(size.id),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      <ResponsiveDialog
        open={sizeDialogOpen}
        onOpenChange={setSizeDialogOpen}
        title={editingSize ? 'Editar Talla' : 'Nueva Talla'}
        footer={
          <>
            <Button variant="outline" onClick={() => setSizeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSize} disabled={savingSize || !sizeForm.value} className="bg-[#111111]">
              {savingSize ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor *</Label>
            <Input value={sizeForm.value} onChange={e => setSizeForm({ ...sizeForm, value: e.target.value })} placeholder="Ej. M, 32, Única" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={sizeForm.isActive} onChange={e => setSizeForm({ ...sizeForm, isActive: e.target.checked })} />
            <Label>Activa</Label>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
