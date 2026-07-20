import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listMediaAssets, resolveLibraryTreeNodeAssetIds, getAssetIdsForProducts, type LibraryTreeNodeType } from '@/lib/media-data-service';

const TREE_NODE_TYPES: LibraryTreeNodeType[] = ['brand', 'collection', 'product', 'color'];

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const tags = searchParams.get('tags');

    const mediaTypeParam = searchParams.get('mediaType');

    let assetIds: string[] | undefined;
    const treeNodeType = searchParams.get('treeNodeType');
    const treeNodeId = searchParams.get('treeNodeId');
    if (treeNodeType && treeNodeId && (TREE_NODE_TYPES as string[]).includes(treeNodeType)) {
      assetIds = await resolveLibraryTreeNodeAssetIds({
        type: treeNodeType as LibraryTreeNodeType,
        id: treeNodeId,
        colorId: searchParams.get('treeNodeColorId') || undefined,
      });
    }

    // Portadas de set en modo "Portadas del contenido": galerías de los productos
    // asociados al set en memoria (funciona con el set todavía sin guardar, no
    // depende de `set_items` en la base — ver PLAN-ajustes-admin-sets.md Fase 2).
    const productIdsParam = searchParams.get('productIds');
    if (productIdsParam) {
      assetIds = await getAssetIdsForProducts(productIdsParam.split(',').filter(Boolean));
    }

    const result = await listMediaAssets({
      folder: searchParams.get('folder') || undefined,
      tags: tags ? tags.split(',').filter(Boolean) : undefined,
      q: searchParams.get('q') || undefined,
      unused: searchParams.get('unused') === 'true',
      mediaType: mediaTypeParam === 'video' || mediaTypeParam === 'image' ? mediaTypeParam : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '30'),
      keyPrefix: searchParams.get('keyPrefix') || undefined,
      linkedEntityType: searchParams.get('linkedEntityType') || undefined,
      linkedEntityId: searchParams.get('linkedEntityId') || undefined,
      assetIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
