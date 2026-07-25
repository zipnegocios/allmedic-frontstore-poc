'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { AdminListCard } from '@/components/admin/AdminListCard';

type UserRole = 'ADMIN' | 'SALES' | 'CATALOG_MANAGER' | 'DISPATCHER';
type ScopeLevel = 'OWN' | 'ALL';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  scopeLevel: ScopeLevel;
  isActive: boolean;
  isProtected: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  SALES: 'Ventas',
  CATALOG_MANAGER: 'Gestor del Catálogo',
  DISPATCHER: 'Despachador',
};

function roleBadgeVariant(role: UserRole): 'default' | 'secondary' | 'outline' {
  if (role === 'ADMIN') return 'default';
  if (role === 'SALES') return 'secondary';
  return 'outline';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', role: 'CATALOG_MANAGER' as UserRole, scopeLevel: 'OWN' as ScopeLevel, isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openNew() {
    setEditingUser(null);
    setFormData({ name: '', email: '', role: 'CATALOG_MANAGER', scopeLevel: 'OWN', isActive: true });
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email,
      role: user.role,
      scopeLevel: user.scopeLevel,
      isActive: user.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            scopeLevel: formData.scopeLevel,
            isActive: formData.isActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Failed to save');
        }
        toast.success('Usuario actualizado');
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            scopeLevel: formData.role === 'SALES' ? formData.scopeLevel : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Failed to save');
        }
        const data = await res.json();
        toast.success(
          `Usuario creado. Contraseña temporal: ${data.temporaryPassword}`,
          { duration: 15000 }
        );
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.isProtected) {
      toast.error('Esta cuenta está protegida y no puede eliminarse.');
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar a ${user.name || user.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete');
      }
      toast.success('Usuario eliminado');
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar usuario');
    }
  }

  async function handleResetPassword(user: AdminUser) {
    if (!confirm(`¿Generar una nueva contraseña temporal para ${user.name || user.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to reset password');
      }
      const data = await res.json();
      toast.success(
        `Contraseña temporal generada: ${data.temporaryPassword}`,
        { duration: 15000 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resetear contraseña');
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Usuarios</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{user.name || '-'}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        {user.isProtected && (
                          <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" aria-label="Cuenta protegida" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'SALES' ? (
                        <Badge variant="outline">{user.scopeLevel === 'ALL' ? 'Todas' : 'Propias'}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                      {user.mustChangePassword && (
                        <Badge variant="secondary" className="ml-1">Cambio pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(user)} title="Resetear contraseña">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(user)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(user)}
                          disabled={user.isProtected}
                          title={user.isProtected ? 'Cuenta protegida' : 'Eliminar'}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
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
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay usuarios registrados</p>
            <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <AdminListCard
                key={user.id}
                onNavigate={() => openEdit(user)}
                aria-label={`Editar usuario ${user.name || user.email}`}
                thumbnail={
                  <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-400" />
                  </div>
                }
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {user.name || user.email}
                    {user.isProtected && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </span>
                }
                subtitle={user.email}
                badges={
                  <>
                    <Badge variant={roleBadgeVariant(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                    {user.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                  </>
                }
                actions={[
                  {
                    key: 'reset-password',
                    label: 'Resetear contraseña',
                    icon: <KeyRound className="w-4 h-4" />,
                    onSelect: () => handleResetPassword(user),
                  },
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(user),
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
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
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
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              disabled={!!editingUser}
            />
          </div>
          <div className="space-y-2">
            <Label>Rol *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              disabled={editingUser?.isProtected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SALES">Ventas</SelectItem>
                <SelectItem value="CATALOG_MANAGER">Gestor del Catálogo</SelectItem>
                <SelectItem value="DISPATCHER">Despachador</SelectItem>
              </SelectContent>
            </Select>
            {formData.role === 'DISPATCHER' && (
              <p className="text-sm text-amber-600">Este rol aún no tiene módulos activos en el sistema.</p>
            )}
          </div>
          {formData.role === 'SALES' && (
            <div className="space-y-2">
              <Label>Alcance de datos</Label>
              <Select
                value={formData.scopeLevel}
                onValueChange={(value) => setFormData({ ...formData, scopeLevel: value as ScopeLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWN">Solo sus propias cotizaciones/cuentas</SelectItem>
                  <SelectItem value="ALL">Todas (edita solo las propias)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {editingUser && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                disabled={editingUser.isProtected}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <Label>Activo</Label>
            </div>
          )}
          {editingUser?.isProtected && (
            <p className="text-sm text-blue-600">
              Esta cuenta está protegida: no se puede cambiar su rol, desactivarla ni eliminarla.
            </p>
          )}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
