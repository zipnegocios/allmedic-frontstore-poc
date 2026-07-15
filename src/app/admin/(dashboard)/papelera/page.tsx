'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, Search, Trash, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TrashedItem {
  id: string;
  name: string;
  entityType: 'SET';
  deletedAt: string;
  details: string;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trash');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error('Error al cargar la papelera');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (id: string, entityType: string, name: string) => {
    setActionInProgress(id);
    try {
      const res = await fetch('/api/admin/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          entityType,
          entityId: id,
        }),
      });
      if (!res.ok) throw new Error('Failed to restore');
      toast.success(`${name} restaurado correctamente`);
      fetchTrash();
    } catch {
      toast.error('Error al restaurar elemento');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePermanentDelete = async (id: string, entityType: string, name: string) => {
    setActionInProgress(id);
    try {
      const res = await fetch('/api/admin/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          entityType,
          entityId: id,
        }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(`${name} eliminado definitivamente`);
      fetchTrash();
    } catch {
      toast.error('Error al eliminar definitivamente');
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#111111] tracking-tight">Papelera del Sistema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Restaura o elimina de manera permanente los elementos dados de baja
        </p>
      </div>

      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 border-gray-250 focus-visible:ring-[#111111]"
          />
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[180px] font-semibold text-gray-700">Tipo</TableHead>
                <TableHead className="font-semibold text-gray-700">Nombre</TableHead>
                <TableHead className="font-semibold text-gray-700">Detalles</TableHead>
                <TableHead className="w-[180px] font-semibold text-gray-700">Eliminado el</TableHead>
                <TableHead className="w-[160px] text-right font-semibold text-gray-700">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                    Cargando elementos de papelera...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Trash className="w-12 h-12 text-gray-300 stroke-[1.5]" />
                      <div>
                        <p className="font-medium text-gray-900">La papelera está vacía</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {search ? 'No se encontraron resultados para la búsqueda' : 'No hay elementos eliminados recientemente'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                        {item.entityType === 'SET' ? 'Set Corporativo' : item.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{item.details}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(item.deletedAt).toLocaleDateString('es-EC', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestore(item.id, item.entityType, item.name)}
                          disabled={actionInProgress !== null}
                          className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg gap-1.5"
                          title="Restaurar"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Restaurar</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionInProgress !== null}
                              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg gap-1.5"
                              title="Eliminar definitivamente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Eliminar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[450px]">
                            <AlertDialogHeader>
                              <div className="flex items-center gap-2 text-red-600 mb-2">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <AlertDialogTitle>¿Eliminar definitivamente?</AlertDialogTitle>
                              </div>
                              <AlertDialogDescription className="text-gray-600">
                                Esta acción es <span className="font-semibold text-gray-950">irreversible</span>. 
                                Se borrará definitivamente el set <span className="font-semibold text-gray-950">"{item.name}"</span>, 
                                sus imágenes vinculadas y sus reglas de negocio asociadas. Las cotizaciones que lo referencien mantendrán su snapshot pero desvinculadas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-4">
                              <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePermanentDelete(item.id, item.entityType, item.name)}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                              >
                                Confirmar eliminación
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
