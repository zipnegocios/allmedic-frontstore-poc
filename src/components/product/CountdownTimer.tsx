'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: Date | string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
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
  };
}

export function CountdownTimer({ endDate }: CountdownTimerProps) {
  const dateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft(dateObj));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(dateObj);
      setTimeLeft(remaining);
      
      if (!remaining) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [dateObj]);

  if (!timeLeft) {
    return null;
  }

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-2 text-[#FF3B30]">
      <Clock className="w-4 h-4" strokeWidth={1.5} />
      <span className="text-sm font-medium">Oferta termina en:</span>
      <div className="flex items-center gap-1 font-mono text-sm font-bold">
        <span>{formatNumber(timeLeft.days)}</span>
        <span className="text-gray-400">:</span>
        <span>{formatNumber(timeLeft.hours)}</span>
        <span className="text-gray-400">:</span>
        <span>{formatNumber(timeLeft.minutes)}</span>
        <span className="text-gray-400">:</span>
        <span>{formatNumber(timeLeft.seconds)}</span>
      </div>
    </div>
  );
}
