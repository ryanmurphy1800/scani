import React from 'react';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn(
      "mt-auto py-4 px-6 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800",
      className
    )}>
      <p>Made by Ryan Murphy from All Caps Capital</p>
    </footer>
  );
} 