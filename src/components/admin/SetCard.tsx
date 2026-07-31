'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Boxes, Star, Pencil, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
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

export interface AdminSetPiece {
  productId: string;
  name: string | null;
  slug: string;
  code: string | null;
  gender: string | null;
  brandName: string | null;
  collectionName: string | null;
  blockCode: string;
  colorCount: number;
  variantCount: number;
  mediaCount: number;
  imageUrl: string | null;
  mimeType: string | null;
  previewStart: number | null;
  previewDuration: number | null;
}

export interface AdminSet {
  id: string;
  name: string;
  slug: string;
  brandName: string | null;
  isActive: boolean;
  isFeatured: boolean;
  itemCount: number;
  imageUrl: string | null;
  items: AdminSetPiece[];
  genders: string[];
  colorParityWarningCount: number;
}

/** Portada del set con fallback al ícono de caja si la URL falla al cargar (los sets no admiten video). */
function SetCoverThumb({ set }: { set: AdminSet }) {
  const [failed, setFailed] = useState(false);

  if (!set.imageUrl || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-350">
        <Boxes className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={set.imageUrl}
      alt={set.name}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Popover de resumen al hacer click en el código de una pieza — recicla el mismo layout de la
 * tarjeta de conflicto de Código de Estilo en ProductForm.tsx, en tono neutral/informativo. */
function PieceCodePopover({ piece }: { piece: AdminSetPiece }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="font-mono text-[10px] font-semibold text-[#111111] bg-gray-100 hover:bg-gray-200 rounded px-1 py-0.5 leading-none transition-colors"
        >
          {piece.code || piece.name || 'S/C'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2.5 text-xs space-y-1" align="start">
        <p className="font-semibold text-[#111111] truncate">{piece.name}</p>
        <p className="text-gray-500">
          {[piece.brandName, piece.collectionName].filter(Boolean).join(' · ') || 'Sin marca/colección'}
        </p>
        <p className="text-gray-500">
          {piece.colorCount} {piece.colorCount === 1 ? 'color' : 'colores'} · {piece.variantCount} var · {piece.mediaCount} med
        </p>
        <Link
          href={`/admin/productos/${piece.productId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-gray-700 font-medium hover:underline pt-0.5"
        >
          Editar este producto <ExternalLink className="w-3 h-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

interface SetCardProps {
  set: AdminSet;
  canEdit: boolean;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
}

export function SetCard({ set, canEdit, onToggleActive, onDelete }: SetCardProps) {
  const blocks = new Map<string, AdminSetPiece[]>();
  for (const item of set.items) {
    const list = blocks.get(item.blockCode) || [];
    list.push(item);
    blocks.set(item.blockCode, list);
  }
  const sortedBlockCodes = Array.from(blocks.keys()).sort();

  return (
    <Card className="overflow-hidden border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 bg-white p-2.5 flex flex-col gap-1.5">
      {/* Nombre del set — primer elemento de la card, hasta 2 líneas */}
      <h3 className="font-bold text-xs text-gray-900 leading-tight line-clamp-2" title={set.name}>
        {set.name}
      </h3>

      {/* Header: portada + estado + género + marca */}
      <div className="flex gap-2 items-start">
        <div className="w-9 h-12 bg-gray-50 rounded overflow-hidden relative shrink-0 border border-gray-100">
          <SetCoverThumb set={set} />
          {set.isFeatured && (
            <div className="absolute top-0.5 left-0.5 bg-amber-500 text-white p-0.5 rounded-full shadow-md">
              <Star className="w-2 h-2 fill-white text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              variant={set.isActive ? 'default' : 'secondary'}
              className={`text-[8px] px-1 py-0 w-max border-none ${
                set.isActive
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
              }`}
            >
              {set.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            {set.genders.map((g) => (
              <Badge key={g} variant="outline" className="text-[8px] px-1 py-0 w-max font-normal text-gray-500 border-gray-200">
                {g}
              </Badge>
            ))}
          </div>
          {set.brandName && (
            <span className="block text-[9px] text-gray-400 truncate" title={set.brandName}>
              Marca: {set.brandName}
            </span>
          )}
        </div>
      </div>

      {/* Bloques de piezas: código, marca · colección — sin thumbnails */}
      {sortedBlockCodes.length > 0 && (
        <div className="space-y-1">
          {sortedBlockCodes.map((blockCode) => (
            <div key={blockCode} className="space-y-0.5">
              <span className="text-[8px] text-gray-400 font-semibold tracking-wide uppercase leading-none">
                Bloque {blockCode}
              </span>
              <div className="space-y-0.5">
                {(blocks.get(blockCode) || []).map((piece) => (
                  <div key={piece.productId} className="flex items-center gap-1.5 min-w-0">
                    <PieceCodePopover piece={piece} />
                    <span className="text-[9px] text-gray-400 truncate" title={[piece.brandName, piece.collectionName].filter(Boolean).join(' · ')}>
                      {[piece.brandName, piece.collectionName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advertencias de paridad de color */}
      {set.colorParityWarningCount > 0 && (
        <div className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] text-amber-700 font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {set.colorParityWarningCount} {set.colorParityWarningCount === 1 ? 'advertencia' : 'advertencias'} de paridad
        </div>
      )}

      {/* Switch + acciones */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={set.isActive}
            onCheckedChange={() => onToggleActive(set.id, set.isActive)}
            disabled={!canEdit}
            aria-label={`Cambiar estado de ${set.name}`}
          />
          <span className="text-[9px] text-gray-500 font-medium select-none hidden lg:inline">
            {set.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Link href={`/admin/sets/${set.id}`}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-gray-100 rounded text-gray-700"
                title="Editar"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </Link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 rounded text-gray-550 group"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3 text-gray-550 group-hover:text-red-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[450px]">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-600">
                    El set corporativo <span className="font-semibold text-gray-950">&quot;{set.name}&quot;</span> se enviará a la papelera general.
                    Podrás recuperarlo o eliminarlo de forma permanente desde allí.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(set.id)}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </Card>
  );
}
