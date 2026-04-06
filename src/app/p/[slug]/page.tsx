'use client';

import { use } from 'react';
import { Product } from '@/legacy-pages/Product';
import { Footer } from '@/components/layout/Footer';

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <>
      <Product slug={slug} />
      <Footer />
    </>
  );
}
