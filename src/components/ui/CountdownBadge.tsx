import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Timer, Zap } from 'lucide-react';

interface CountdownBadgeProps {
  endDate: Date;
  size?: 'sm' | 'md';
  variant?: 'urgent' | 'hot' | 'flash';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(endDate: Date): TimeLeft | null {
  const difference = new Date(endDate).getTime() - new Date().getTime();

  if (difference <= 0) {
    return null;
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  };
}

function formatNumber(num: number) {
  return num.toString().padStart(2, '0');
}

export function CountdownBadge({ endDate, size = 'sm', variant = 'urgent' }: CountdownBadgeProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft(endDate));
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(endDate);
      setTimeLeft(remaining);
      
      if (remaining && remaining.total < 60 * 60 * 1000) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 500);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  if (!timeLeft) return null;

  const isCritical = timeLeft.total < 60 * 60 * 1000;

  const variantStyles = {
    urgent: {
      container: 'bg-gradient-to-r from-[#FF3B30] via-[#FF5E55] to-[#FF3B30]',
      text: 'text-white',
      icon: Timer,
      label: isCritical ? '¡ÚLTIMA HORA!' : 'OFERTA',
    },
    hot: {
      container: 'bg-gradient-to-r from-[#FF6B35] via-[#FF8C42] to-[#FF6B35]',
      text: 'text-white',
      icon: Flame,
      label: 'HOT DEAL',
    },
    flash: {
      container: 'bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700]',
      text: 'text-[#1a1a1a]',
      icon: Zap,
      label: 'FLASH',
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  const sizeConfig = {
    sm: {
      wrapper: 'px-2 py-1.5 gap-2',
      digitBox: 'min-w-[28px]',
      digit: 'text-sm',
      label: 'text-[9px]',
      iconSize: 'w-3 h-3',
    },
    md: {
      wrapper: 'px-3 py-2 gap-3',
      digitBox: 'min-w-[36px]',
      digit: 'text-base',
      label: 'text-[10px]',
      iconSize: 'w-4 h-4',
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'inline-flex flex-col rounded-lg overflow-hidden',
        'transition-all duration-300 ease-out',
        style.container,
        isPulsing && 'scale-105',
        isCritical && 'animate-pulse',
        'relative'
      )}
    >
      {/* Animated background shine */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent',
          'animate-shimmer',
          isCritical && 'animate-shimmer-fast'
        )}
        style={{ backgroundSize: '200% 100%' }}
      />

      {/* Header with icon and label */}
      <div className={cn(
        'flex items-center justify-center gap-1 px-2 py-0.5',
        'border-b border-white/20',
        style.text
      )}>
        <Icon className={cn(config.iconSize, isCritical && 'animate-bounce')} strokeWidth={2.5} />
        <span className={cn('font-bold tracking-wider', config.label)}>{style.label}</span>
      </div>

      {/* Timer with labels */}
      <div className={cn(
        'flex items-start justify-center gap-1',
        config.wrapper,
        style.text
      )}>
        {timeLeft.days > 0 && (
          <TimeUnit 
            value={timeLeft.days} 
            label={timeLeft.days === 1 ? 'Día' : 'Días'} 
            config={config} 
            isCritical={isCritical}
          />
        )}
        <TimeUnit 
          value={timeLeft.hours} 
          label={timeLeft.hours === 1 ? 'Hora' : 'Horas'} 
          config={config} 
          isCritical={isCritical}
        />
        <TimeUnit 
          value={timeLeft.minutes} 
          label="Min" 
          config={config} 
          isCritical={isCritical}
        />
        <TimeUnit 
          value={timeLeft.seconds} 
          label="Seg" 
          config={config} 
          isCritical={isCritical}
        />
      </div>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
  config: { 
    digitBox: string; 
    digit: string; 
    label: string;
  };
  isCritical?: boolean;
}

function TimeUnit({ value, label, config, isCritical }: TimeUnitProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value !== displayValue) {
      setIsFlipping(true);
      setTimeout(() => {
        setDisplayValue(value);
        setIsFlipping(false);
      }, 150);
    }
  }, [value, displayValue]);

  return (
    <div className="flex flex-col items-center">
      {/* Digit box */}
      <div
        className={cn(
          config.digitBox,
          'flex items-center justify-center rounded',
          'bg-black/20 backdrop-blur-sm',
          'transition-all duration-150',
          isFlipping && 'scale-y-90 opacity-70',
          isCritical && 'bg-red-900/40'
        )}
      >
        <span className={cn('font-mono font-bold leading-none py-1', config.digit)}>
          {formatNumber(displayValue)}
        </span>
      </div>
      {/* Label */}
      <span className={cn(
        'mt-0.5 font-medium uppercase tracking-wide opacity-90',
        config.label
      )}>
        {label}
      </span>
    </div>
  );
}
