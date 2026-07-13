'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Label } from '@/components/ui/label';
import { AdminListCard } from '@/components/admin/AdminListCard';
import { slugify } from '@/lib/slugify';

interface SetGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminSetGroupsPage() {
  const [groups, setGroups] = useState<SetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SetGroup | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/set-groups');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setGroups(data.groups);
    } catch {
      toast.error('Error al cargar grupos de sets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  function openNew() {
    setEditingGroup(null);
    setFormData({ name: '', slug: '', description: '', isActive: true, sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(group: SetGroup) {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      isActive: group.isActive,
      sortOrder: group.sortOrder,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingGroup ? `/api/admin/set-groups/${editingGroup.id}` : '/api/admin/set-groups';
      const method = editingGroup ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingGroup ? 'Grupo actualizado' : 'Grupo creado');
      setDialogOpen(false);
      fetchGroups();
    } catch {
      toast.error('Error al guardar grupo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este grupo? Los sets asociados quedarán sin grupo.')) return;
    try {
      const res = await fetch(`/api/admin/set-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Grupo eliminado');
      fetchGroups();
    } catch {
      toast.error('Error al eliminar grupo');
    }
  }

  useEffect(() => {
    if (!editingGroup && formData.name && !formData.slug) {
      setFormData(prev => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [formData.name, editingGroup, formData.slug]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Grupos de Sets</h1>
          <p className="text-sm text-gray-500 mt-1">Categorías para organizar los sets corporativos (ej. Uniformes Completos, Packs Institucionales)</p>
        </div>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay grupos de sets registrados
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">{group.slug}</code></TableCell>
                    <TableCell>{group.description || '-'}</TableCell>
                    <TableCell>
                      {group.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(group)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(group.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay grupos de sets registrados</p>
            <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nuevo Grupo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <AdminListCard
                key={group.id}
                onNavigate={() => openEdit(group)}
                aria-label={`Editar grupo ${group.name}`}
                title={group.name}
                subtitle={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{group.slug}</code>}
                badges={
                  group.isActive ? (
                    <Badge variant="outline">Activo</Badge>
                  ) : (
                    <Badge variant="destructive">Inactivo</Badge>
                  )
                }
                meta={group.description ? <p className="truncate">{group.description}</p> : undefined}
                actions={[
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(group.id),
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
        title={editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
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
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <Label>Activo</Label>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
