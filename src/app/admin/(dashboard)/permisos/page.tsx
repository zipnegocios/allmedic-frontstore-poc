'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';

type EditableRole = 'SALES' | 'CATALOG_MANAGER' | 'DISPATCHER';

interface PermissionCell {
  read: boolean;
  write: boolean;
}

interface PermissionsMatrix {
  modules: string[];
  grid: Record<EditableRole, Record<string, PermissionCell>>;
}

const ROLE_LABELS: Record<EditableRole, string> = {
  SALES: 'Ventas',
  CATALOG_MANAGER: 'Gestor del Catálogo',
  DISPATCHER: 'Despachador',
};

const MODULE_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'productos': 'Productos',
  'biblioteca': 'Biblioteca de Medios',
  'prospectos': 'Pedidos / Prospectos',
  'banners': 'Banners',
  'marcas': 'Marcas',
  'tipos-producto': 'Tipos de Producto',
  'atributos': 'Atributos y Tallas',
  'colores': 'Colores',
  'sucursales': 'Sucursales',
  'sets': 'Sets Corporativos',
  'cuentas-corporativas': 'Cuentas Corporativas',
  'cotizaciones': 'Cotizaciones',
  'reglas': 'Motor de Reglas',
  'papelera': 'Papelera',
  'configuracion': 'Configuración',
  'quote-config': 'Configuración de Cotizaciones',
  'corporate-carts': 'Carritos Corporativos',
  'usuarios': 'Usuarios',
  'permisos': 'Permisos',
  'productividad': 'Productividad',
};

export default function AdminPermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EditableRole | null>(null);
  const [activeTab, setActiveTab] = useState<EditableRole>('SALES');

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/permissions');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMatrix(data);
    } catch {
      toast.error('Error al cargar la matriz de permisos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  function toggleCell(role: EditableRole, module: string, action: 'read' | 'write') {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      grid: {
        ...matrix.grid,
        [role]: {
          ...matrix.grid[role],
          [module]: {
            ...matrix.grid[role][module],
            [action]: !matrix.grid[role][module][action],
            // Escribir sin poder leer no tiene sentido operativo — al marcar write, read
            // se activa automáticamente (al desmarcar read, write también se apaga).
            ...(action === 'write' && !matrix.grid[role][module].write ? { read: true } : {}),
            ...(action === 'read' && matrix.grid[role][module].read ? { write: false } : {}),
          },
        },
      },
    });
  }

  async function handleSave(role: EditableRole) {
    if (!matrix) return;
    setSaving(role);
    try {
      const granted = Object.entries(matrix.grid[role]).flatMap(([module, cell]) => {
        const actions: Array<{ module: string; action: 'read' | 'write' }> = [];
        if (cell.read) actions.push({ module, action: 'read' });
        if (cell.write) actions.push({ module, action: 'write' });
        return actions;
      });

      const res = await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, granted }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`Permisos de ${ROLE_LABELS[role]} actualizados. Los cambios aplican de inmediato, sin necesidad de reiniciar sesión.`);
    } catch {
      toast.error('Error al guardar los permisos');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-[#111111]">Matriz de Permisos</h1>
      </div>

      <div className="flex items-start gap-2 mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Admin no aparece en esta matriz: siempre tiene acceso total a todos los módulos.
          Los cambios que guardes aquí aplican de inmediato a los usuarios afectados, sin
          que necesiten volver a iniciar sesión.
        </p>
      </div>

      {loading || !matrix ? (
        <p className="text-center py-12 text-gray-500">Cargando...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditableRole)}>
          <TabsList>
            {(Object.keys(ROLE_LABELS) as EditableRole[]).map((role) => (
              <TabsTrigger key={role} value={role}>{ROLE_LABELS[role]}</TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(ROLE_LABELS) as EditableRole[]).map((role) => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead className="text-center">Ver</TableHead>
                        <TableHead className="text-center">Editar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrix.modules.map((module) => {
                        const cell = matrix.grid[role][module] ?? { read: false, write: false };
                        return (
                          <TableRow key={module}>
                            <TableCell className="font-medium">{MODULE_LABELS[module] ?? module}</TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4"
                                checked={cell.read}
                                onChange={() => toggleCell(role, module, 'read')}
                                aria-label={`${ROLE_LABELS[role]} puede ver ${module}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4"
                                checked={cell.write}
                                onChange={() => toggleCell(role, module, 'write')}
                                aria-label={`${ROLE_LABELS[role]} puede editar ${module}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end mt-4">
                <Button
                  className="bg-[#111111]"
                  onClick={() => handleSave(role)}
                  disabled={saving === role}
                >
                  {saving === role ? 'Guardando...' : `Guardar permisos de ${ROLE_LABELS[role]}`}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <div className="flex items-center gap-2 mt-8 text-sm text-gray-500">
        <ShieldCheck className="w-4 h-4" />
        <span>Admin: acceso total, no editable.</span>
      </div>
    </div>
  );
}
