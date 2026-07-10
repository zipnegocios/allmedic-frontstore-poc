'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MediaGallery } from './MediaGallery';
import { MediaUploadPanel } from './MediaUploadPanel';
import type { MediaAssetSummary } from '@/lib/media';
import type { MediaUploadResult } from '@/hooks/useMediaUpload';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  folder: string;
  segments?: string[];
  multiple?: boolean;
  mediaType?: 'image' | 'video' | 'all';
  onConfirm: (assets: MediaAssetSummary[]) => void;
}

export function MediaPicker({ open, onClose, folder, segments = [], multiple = false, mediaType, onConfirm }: MediaPickerProps) {
  const [selected, setSelected] = useState<MediaAssetSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('library');

  function toggleSelect(asset: MediaAssetSummary) {
    setSelected((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) return prev.filter((a) => a.id !== asset.id);
      if (!multiple) return [asset];
      return [...prev, asset];
    });
  }

  function handleUploaded(results: MediaUploadResult[]) {
    setRefreshKey((k) => k + 1);
    setTab('library');
    setSelected(multiple ? [...selected, ...results] : results);
  }

  function handleConfirm() {
    onConfirm(selected);
    setSelected([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seleccionar medio</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="library">Elegir de la librería</TabsTrigger>
            <TabsTrigger value="upload">Subir nueva</TabsTrigger>
          </TabsList>
          <TabsContent value="library">
            <MediaGallery
              folder={folder}
              mediaType={mediaType}
              selectable
              multiple={multiple}
              selectedIds={selected.map((a) => a.id)}
              onSelect={toggleSelect}
              refreshKey={refreshKey}
            />
          </TabsContent>
          <TabsContent value="upload">
            <MediaUploadPanel folder={folder} segments={segments} onUploaded={handleUploaded} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0} className="bg-[#111111]">
            Usar {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
