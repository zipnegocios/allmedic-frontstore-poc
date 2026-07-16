'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { slugify } from '@/lib/slugify';

interface Collection {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  description: string | null;
  fabricTech: string | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

const emptyForm = { name: '', slug: '', description: '', fabricTech: '', isActive: true, sortOrder: 0 };

export function BrandCollectionsSection({ brandId, initialCollections }: { brandId: string; initialCollections: Collection[] }) {
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/collections?brandId=${brandId}`);
    if (res.ok) {
      const data = await res.json();
      setCollections(data.collections);
    }
  }

  function openNew() {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Collection) {
    setEditing(c);
    setFormData({
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      fabricTech: c.fabricTech || '',
      isActive: c.isActive ?? true,
      sortOrder: c.sortOrder ?? 0,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/collections/${editing.id}` : '/api/admin/collections';
      const method = editing ? 'PATCH' : 'POST';
      const payload = editing ? formData : { ...formData, brandId };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editing ? 'Colección actualizada' : 'Colección creada');
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error('Error al guardar la colección');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta colección?')) return;
    try {
      const res = await fetch(`/api/admin/collections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Colección eliminada');
      await refresh();
    } catch {
      toast.error('Error al eliminar la colección');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#111111]">Colecciones</h2>
        <Button size="sm" className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Colección
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {collections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No hay colecciones registradas para esta marca
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded">{c.slug}</code>
                      {c.fabricTech && <span className="ml-2">{c.fabricTech}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
        title={editing ? 'Editar Colección' : 'Nueva Colección'}
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
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tecnología de tela</Label>
            <Input value={formData.fabricTech} onChange={e => setFormData({ ...formData, fabricTech: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <Label>Activa</Label>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
