'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, ImageOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveMediaUrl, MEDIA_FOLDERS, type MediaAssetSummary } from '@/lib/media';

const FOLDER_LABELS: Record<string, string> = {
  PRODUCTS: 'Productos',
  SETS: 'Sets',
  BRANDS: 'Marcas',
  BANNERS: 'Banners',
  SITE: 'Sitio',
};

interface MediaGalleryProps {
  folder?: string;
  selectable?: boolean;
  multiple?: boolean;
  selectedIds?: string[];
  onSelect?: (asset: MediaAssetSummary) => void;
  onAssetClick?: (asset: MediaAssetSummary) => void;
  refreshKey?: number;
}

export function MediaGallery({
  folder: fixedFolder,
  selectable = false,
  multiple = false,
  selectedIds = [],
  onSelect,
  onAssetClick,
  refreshKey = 0,
}: MediaGalleryProps) {
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState(fixedFolder ?? 'all');
  const [unused, setUnused] = useState(false);
  const [loading, setLoading] = useState(true);
  const limit = 24;

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fixedFolder) params.set('folder', fixedFolder);
      else if (folder !== 'all') params.set('folder', folder);
      if (q) params.set('q', q);
      if (unused) params.set('unused', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin/media?${params}`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();
      setAssets(data.assets);
      setTotal(data.total);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [fixedFolder, folder, q, unused, page]);

  useEffect(() => { fetchAssets(); }, [fetchAssets, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, alt o título..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        {!fixedFolder && (
          <Select value={folder} onValueChange={(v) => { setFolder(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Carpeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las carpetas</SelectItem>
              {MEDIA_FOLDERS.map((f) => (
                <SelectItem key={f} value={f}>{FOLDER_LABELS[f] ?? f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          variant={unused ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setUnused((u) => !u); setPage(1); }}
        >
          Sin usos
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ImageOff className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          No hay medios que coincidan con los filtros
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map((asset) => {
            const isSelected = selectedIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => (selectable ? onSelect?.(asset) : onAssetClick?.(asset))}
                className={cn(
                  'relative group aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 transition-colors',
                  isSelected ? 'border-[#111111]' : 'border-transparent hover:border-gray-300'
                )}
              >
                <Image
                  src={resolveMediaUrl(asset.storageKey)}
                  alt={asset.altText ?? asset.fileName}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-[#111111] text-white rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {asset.fileName}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {multiple && selectedIds.length > 0 && (
        <div className="mt-3">
          <Badge variant="outline">{selectedIds.length} seleccionados</Badge>
        </div>
      )}
    </div>
  );
}
