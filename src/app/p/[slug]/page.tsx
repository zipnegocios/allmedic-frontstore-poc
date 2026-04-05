'use client';

import { use } from 'react';
import { Product } from '@/legacy-pages/Product';
import { NotificationContext } from '@/context/NotificationContext';
import { useNotification } from '@/hooks/useNotification';
import { NotificationContainer } from '@/components/ui/NotificationContainer';
import { Footer } from '@/components/layout/Footer';

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { notifications, showSuccess, showError, showWarning, showInfo, removeNotification } = useNotification();

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      <Product slug={slug} />
      <Footer />
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
}
