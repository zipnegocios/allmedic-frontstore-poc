'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Plus, Filter, X } from 'lucide-react';
import { MediaGallery } from '@/components/admin/media/MediaGallery';
import { MediaUploadPanel } from '@/components/admin/media/MediaUploadPanel';
import { MediaDetailDialog } from '@/components/admin/media/MediaDetailDialog';
import { MediaLibraryTree, type LibraryTreeNode } from '@/components/admin/media/MediaLibraryTree';
import type { MediaAssetSummary } from '@/lib/media';

export default function AdminMediaPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('SITE');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedNode, setSelectedNode] = useState<LibraryTreeNode | null>(null);
  const [treeDrawerOpen, setTreeDrawerOpen] = useState(false);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Media Library</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión centralizada de imágenes en Cloudflare R2</p>
        </div>
        <Button className="w-full md:w-auto min-h-11 md:h-9 md:min-h-0 bg-[#111111]" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Subir medios
        </Button>
      </div>

      {/* Filtro por árbol — móvil: botón que abre drawer; desktop: panel lateral fijo. */}
      <div className="md:hidden mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setTreeDrawerOpen(true)}>
          <Filter className="w-3.5 h-3.5 mr-1.5" />
          {selectedNode ? selectedNode.label : 'Filtrar por marca/producto'}
        </Button>
        {selectedNode && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
            <X className="w-3.5 h-3.5 mr-1" />
            Quitar
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full">
          {selectedNode && (
            <div className="hidden md:flex items-center gap-2 mb-3 text-xs text-gray-500">
              Mostrando: <span className="font-medium text-[#111111]">{selectedNode.label}</span>
              <button type="button" onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <MediaGallery
            refreshKey={refreshKey}
            onAssetClick={(asset: MediaAssetSummary) => setSelectedAssetId(asset.id)}
            treeNode={selectedNode}
          />
        </div>

        {/* Panel lateral derecho — solo desktop */}
        <aside className="hidden md:block w-64 flex-shrink-0 border rounded-lg p-3 bg-white sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">Marca / Colección / Producto / Color</h2>
          <MediaLibraryTree selected={selectedNode} onSelect={setSelectedNode} />
        </aside>
      </div>

      <ResponsiveDialog
        open={treeDrawerOpen}
        onOpenChange={setTreeDrawerOpen}
        title="Filtrar por marca/producto"
        contentClassName="max-w-sm"
      >
        <MediaLibraryTree
          selected={selectedNode}
          onSelect={(node) => {
            setSelectedNode(node);
            setTreeDrawerOpen(false);
          }}
        />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Subir medios"
        contentClassName="max-w-lg"
      >
        <MediaUploadPanel
          folder={uploadFolder}
          showFolderPicker
          onFolderChange={setUploadFolder}
          onUploaded={() => {
            setRefreshKey((k) => k + 1);
            setUploadOpen(false);
          }}
        />
      </ResponsiveDialog>

      <MediaDetailDialog
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
