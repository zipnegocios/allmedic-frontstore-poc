'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Toast, type ToastType } from '@/components/ui/Toast';

export interface NotificationContextType {
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  isVisible: boolean;
}

let toastCounter = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType, duration = 3000): string => {
    const id = `toast-${++toastCounter}`;
    setToasts(prev => [...prev, { id, message, type, duration, isVisible: true }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => addToast(message, 'success', duration), [addToast]);
  const showError = useCallback((message: string, duration?: number) => addToast(message, 'error', duration), [addToast]);
  const showWarning = useCallback((message: string, duration?: number) => addToast(message, 'warning', duration), [addToast]);
  const showInfo = useCallback((message: string, duration?: number) => addToast(message, 'info', duration), [addToast]);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          isVisible={toast.isVisible}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
