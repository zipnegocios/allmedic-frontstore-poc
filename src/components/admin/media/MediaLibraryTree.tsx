'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Layers, Package, Palette, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LibraryTreeNode {
  type: 'brand' | 'collection' | 'product' | 'color';
  id: string;
  /** Solo para nodos de color: producto al que pertenece (media_links es por producto+color). */
  productId?: string;
  label: string;
}

interface TreeColor {
  id: string;
  code: string;
}

interface TreeProduct {
  id: string;
  name: string;
  code: string;
  colors: TreeColor[];
}

interface TreeCollection {
  id: string;
  name: string;
  products: TreeProduct[];
}

interface TreeBrand {
  id: string;
  name: string;
  collections: TreeCollection[];
  products: TreeProduct[];
}

interface MediaLibraryTreeProps {
  selected: LibraryTreeNode | null;
  onSelect: (node: LibraryTreeNode | null) => void;
}

/**
 * Árbol de navegación Marca → Colección → Producto → Color — organización
 * lógica/virtual derivada de la BD (no de rutas físicas en R2). Seleccionar un
 * nodo filtra la galería vía `media_links`, así que un medio reutilizado en
 * varios productos aparece bajo cada uno.
 */
export function MediaLibraryTree({ selected, onSelect }: MediaLibraryTreeProps) {
  const [brands, setBrands] = useState<TreeBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/media/library-tree')
      .then((res) => res.json())
      .then((data) => setBrands(data.brands ?? []))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false));
  }, []);

  function isSelected(node: LibraryTreeNode) {
    return selected?.type === node.type && selected?.id === node.id && selected?.productId === node.productId;
  }

  function NodeButton({ node, icon, indent, sublabel }: { node: LibraryTreeNode; icon: React.ReactNode; indent: number; sublabel?: string }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(isSelected(node) ? null : node)}
        style={{ paddingLeft: `${indent * 16 + 8}px` }}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 pr-2 text-xs rounded-md text-left transition-colors',
          isSelected(node) ? 'bg-[#111111] text-white' : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        {icon}
        <span className="truncate min-w-0">
          <span className="font-mono">{node.label}</span>
          {sublabel && (
            <span className={cn('ml-1.5 font-normal', isSelected(node) ? 'text-white/70' : 'text-gray-400')}>
              {sublabel}
            </span>
          )}
        </span>
      </button>
    );
  }

  function ProductNode({ product, indent }: { product: TreeProduct; indent: number }) {
    const expanded = expandedProductId === product.id;
    return (
      <div>
        <div className="flex items-center">
          {product.colors.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedProductId(expanded ? null : product.id)}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label={expanded ? 'Colapsar' : 'Expandir'}
            >
              <ChevronRight className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')} />
            </button>
          )}
          <div className="flex-1">
            <NodeButton
              node={{ type: 'product', id: product.id, label: product.code }}
              icon={<Package className="w-3.5 h-3.5 flex-shrink-0" />}
              indent={product.colors.length > 0 ? indent - 0.5 : indent}
              sublabel={product.name}
            />
          </div>
        </div>
        {expanded && product.colors.map((c) => (
          <NodeButton
            key={c.id}
            node={{ type: 'color', id: c.id, productId: product.id, label: c.code }}
            icon={<Palette className="w-3.5 h-3.5 flex-shrink-0" />}
            indent={indent + 1}
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return <div className="text-xs text-gray-400 py-4 text-center">Cargando árbol...</div>;
  }

  if (brands.length === 0) {
    return <div className="text-xs text-gray-400 py-4 text-center">Sin marcas configuradas.</div>;
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'w-full text-left text-xs font-medium rounded-md px-2 py-1.5 mb-1',
          !selected ? 'bg-[#111111] text-white' : 'text-gray-500 hover:bg-gray-100'
        )}
      >
        Toda la biblioteca
      </button>
      {brands.map((brand) => {
        const brandExpanded = expandedBrandId === brand.id;
        return (
          <div key={brand.id}>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setExpandedBrandId(brandExpanded ? null : brand.id)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label={brandExpanded ? 'Colapsar' : 'Expandir'}
              >
                <ChevronRight className={cn('w-3 h-3 transition-transform', brandExpanded && 'rotate-90')} />
              </button>
              <div className="flex-1">
                <NodeButton node={{ type: 'brand', id: brand.id, label: brand.name }} icon={<Tag className="w-3.5 h-3.5 flex-shrink-0" />} indent={0} />
              </div>
            </div>
            {brandExpanded && (
              <div>
                {brand.collections.map((collection) => {
                  const collectionExpanded = expandedCollectionId === collection.id;
                  return (
                    <div key={collection.id}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setExpandedCollectionId(collectionExpanded ? null : collection.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          style={{ marginLeft: '16px' }}
                          aria-label={collectionExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          <ChevronRight className={cn('w-3 h-3 transition-transform', collectionExpanded && 'rotate-90')} />
                        </button>
                        <div className="flex-1">
                          <NodeButton node={{ type: 'collection', id: collection.id, label: collection.name }} icon={<Layers className="w-3.5 h-3.5 flex-shrink-0" />} indent={1} />
                        </div>
                      </div>
                      {collectionExpanded && collection.products.map((p) => (
                        <ProductNode key={p.id} product={p} indent={2.5} />
                      ))}
                    </div>
                  );
                })}
                {brand.products.map((p) => (
                  <ProductNode key={p.id} product={p} indent={1.5} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
