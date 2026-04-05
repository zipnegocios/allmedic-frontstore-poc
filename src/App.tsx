import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '@/context/CartContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { NotificationContainer } from '@/components/ui/NotificationContainer';
import { useNotification } from '@/hooks/useNotification';
import { Home } from '@/pages/Home';
import { Catalog } from '@/pages/Catalog';
import { Product } from '@/pages/Product';
import { Stores } from '@/pages/Stores';
import { Brands } from '@/pages/Brands';

// Create a context for notifications
import { createContext, useContext } from 'react';

interface NotificationContextType {
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { notifications, showSuccess, showError, showWarning, showInfo, removeNotification } = useNotification();

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      <div className="min-h-screen bg-white">
        <Header onCartClick={() => setIsCartOpen(true)} />
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/p/:slug" element={<Product />} />
          <Route path="/sucursales" element={<Stores />} />
          <Route path="/marcas" element={<Brands />} />
        </Routes>
        
        <Footer />
        
        <NotificationContainer 
          notifications={notifications} 
          onRemove={removeNotification} 
        />
      </div>
    </NotificationContext.Provider>
  );
}

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
