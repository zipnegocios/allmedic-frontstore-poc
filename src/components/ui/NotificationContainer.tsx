import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotification';

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const icons = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-[#34C759] text-white',
  error: 'bg-[#FF3B30] text-white',
  warning: 'bg-[#FF9500] text-white',
  info: 'bg-[#111111] text-white',
};

export function NotificationContainer({ notifications, onRemove }: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface NotificationToastProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

function NotificationToast({ notification, onRemove }: NotificationToastProps) {
  const Icon = icons[notification.type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px]',
        'animate-slide-in-right',
        styles[notification.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button
        onClick={() => onRemove(notification.id)}
        className="p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}
