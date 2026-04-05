'use client';

import { useEffect, useState } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';

export default function HomePage() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Home />
      <Footer />
    </div>
  );
}
