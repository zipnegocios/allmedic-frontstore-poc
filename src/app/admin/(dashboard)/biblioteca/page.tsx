'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { MediaGallery } from '@/components/admin/media/MediaGallery';
import { MediaUploadPanel } from '@/components/admin/media/MediaUploadPanel';
import { MediaDetailDialog } from '@/components/admin/media/MediaDetailDialog';
import type { MediaAssetSummary } from '@/lib/media';

export default function AdminMediaPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('SITE');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Media Library</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión centralizada de imágenes en Cloudflare R2</p>
        </div>
        <Button className="bg-[#111111]" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Subir medios
        </Button>
      </div>

      <MediaGallery
        refreshKey={refreshKey}
        onAssetClick={(asset: MediaAssetSummary) => setSelectedAssetId(asset.id)}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir medios</DialogTitle>
          </DialogHeader>
          <MediaUploadPanel
            folder={uploadFolder}
            showFolderPicker
            onFolderChange={setUploadFolder}
            onUploaded={() => {
              setRefreshKey((k) => k + 1);
              setUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <MediaDetailDialog
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
