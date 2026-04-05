'use client';

import { createContext, useContext } from 'react';

export interface NotificationContextType {
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
