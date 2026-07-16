'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Boxes, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { slugify } from '@/lib/slugify';

interface ProductType {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  sortOrder: number | null;
  isActive: boolean | null;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
  displayType: string;
  isActive: boolean | null;
}

interface ProductTypeAttributeLink {
  id: string;
  productTypeId: string;
  attributeId: string;
  isRequired: boolean | null;
  sortOrder: number | null;
  attributeName: string;
  attributeSlug: string;
  displayType: string;
}

const emptyForm = { name: '', slug: '', sortOrder: 0, isActive: true };

export function BrandProductTypesSection({ brandId, initialProductTypes }: { brandId: string; initialProductTypes: ProductType[] }) {
  const [productTypes, setProductTypes] = useState<ProductType[]>(initialProductTypes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Sub-panel de "estilos asociados" (product_type_attributes)
  const [attrDialogOpen, setAttrDialogOpen] = useState(false);
  const [managingType, setManagingType] = useState<ProductType | null>(null);
  const [allAttributes, setAllAttributes] = useState<Attribute[]>([]);
  const [links, setLinks] = useState<ProductTypeAttributeLink[]>([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState('');
  const [selectedRequired, setSelectedRequired] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/product-types?brandId=${brandId}`);
    if (res.ok) {
      const data = await res.json();
      setProductTypes(data.productTypes);
    }
  }

  function openNew() {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(pt: ProductType) {
    setEditing(pt);
    setFormData({ name: pt.name, slug: pt.slug, sortOrder: pt.sortOrder ?? 0, isActive: pt.isActive ?? true });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/product-types/${editing.id}` : '/api/admin/product-types';
      const method = editing ? 'PATCH' : 'POST';
      const payload = editing ? formData : { ...formData, brandId };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editing ? 'Tipo de producto actualizado' : 'Tipo de producto creado');
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error('Error al guardar el tipo de producto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este tipo de producto?')) return;
    try {
      const res = await fetch(`/api/admin/product-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Tipo de producto eliminado');
      await refresh();
    } catch {
      toast.error('Error al eliminar el tipo de producto');
    }
  }

  async function openManageAttributes(pt: ProductType) {
    setManagingType(pt);
    setSelectedAttributeId('');
    setSelectedRequired(false);
    setAttrDialogOpen(true);
    const [attrsRes, linksRes] = await Promise.all([
      fetch('/api/admin/attributes'),
      fetch(`/api/admin/product-types/${pt.id}/attributes`),
    ]);
    if (attrsRes.ok) setAllAttributes((await attrsRes.json()).attributes);
    if (linksRes.ok) setLinks((await linksRes.json()).attributes);
  }

  async function refreshLinks() {
    if (!managingType) return;
    const res = await fetch(`/api/admin/product-types/${managingType.id}/attributes`);
    if (res.ok) setLinks((await res.json()).attributes);
  }

  async function handleAssociate() {
    if (!managingType || !selectedAttributeId) return;
    try {
      const res = await fetch(`/api/admin/product-types/${managingType.id}/attributes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributeId: selectedAttributeId, isRequired: selectedRequired, sortOrder: links.length }),
      });
      if (!res.ok) throw new Error('Failed to associate');
      toast.success('Estilo asociado');
      setSelectedAttributeId('');
      setSelectedRequired(false);
      await refreshLinks();
    } catch {
      toast.error('Error al asociar el estilo');
    }
  }

  async function handleDissociate(attributeId: string) {
    if (!managingType) return;
    try {
      const res = await fetch(`/api/admin/product-types/${managingType.id}/attributes?attributeId=${attributeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to dissociate');
      toast.success('Estilo desasociado');
      await refreshLinks();
    } catch {
      toast.error('Error al desasociar el estilo');
    }
  }

  const availableToAssociate = allAttributes.filter(a => !links.some(l => l.attributeId === a.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#111111]">Tipos de Producto</h2>
        <Button size="sm" className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Tipo de Producto
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {productTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No hay tipos de producto registrados para esta marca
            </div>
          ) : (
            <div className="space-y-2">
              {productTypes.map((pt) => (
                <div key={pt.id} className="flex flex-wrap items-center justify-between gap-2 border rounded px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{pt.name}</p>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pt.slug}</code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pt.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                    <Button size="sm" variant="outline" onClick={() => openManageAttributes(pt)}>
                      <Settings2 className="w-4 h-4 mr-1" /> Estilos
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(pt)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(pt.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Tipo de Producto' : 'Nuevo Tipo de Producto'}
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
            <Input
              value={formData.name}
              onChange={e => {
                const name = e.target.value;
                setFormData(prev => ({ ...prev, name, slug: !editing && !prev.slug ? slugify(name) : prev.slug }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <Label>Activo</Label>
          </div>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={attrDialogOpen}
        onOpenChange={setAttrDialogOpen}
        title={`Estilos de ${managingType?.name ?? ''}`}
        description="Atributos (estilos) que aplican a este tipo de producto"
        footer={<Button variant="outline" onClick={() => setAttrDialogOpen(false)}>Cerrar</Button>}
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {links.length === 0 ? (
              <p className="text-sm text-gray-500">Ningún estilo asociado todavía.</p>
            ) : (
              links.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{l.attributeName}</p>
                    <p className="text-xs text-gray-500">{l.isRequired ? 'Obligatorio' : 'Opcional'} · orden {l.sortOrder}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDissociate(l.attributeId)}>
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {availableToAssociate.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <Label>Asociar nuevo estilo</Label>
              <select
                className="w-full border rounded-md h-10 px-3 text-sm"
                value={selectedAttributeId}
                onChange={(e) => setSelectedAttributeId(e.target.value)}
              >
                <option value="">Selecciona un atributo...</option>
                {availableToAssociate.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selectedRequired} onChange={(e) => setSelectedRequired(e.target.checked)} />
                <Label>Obligatorio</Label>
              </div>
              <Button size="sm" className="bg-[#111111]" onClick={handleAssociate} disabled={!selectedAttributeId}>
                Asociar
              </Button>
            </div>
          )}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
