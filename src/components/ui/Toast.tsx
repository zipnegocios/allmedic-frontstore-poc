import { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  isVisible: boolean;
}

const icons = {
  success: Check,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: 'bg-[#34C759] text-white',
  error: 'bg-[#FF3B30] text-white',
  warning: 'bg-[#FF9500] text-white',
  info: 'bg-[#111111] text-white',
};

export function Toast({ message, type = 'info', duration = 3000, onClose, isVisible }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const Icon = icons[type];

  useEffect(() => {
    if (!isVisible) return;

    setProgress(100);
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 16);

    const closeTimeout = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(closeTimeout);
    };
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px] transition-all duration-300',
        styles[type],
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-white/30 transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// Hook para manejar toasts
export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => prev ? { ...prev, isVisible: false } : null);
  };

  return {
    toast,
    showToast,
    hideToast,
    ToastComponent: toast ? (
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    ) : null,
  };
}
