import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Sizes
          size === 'sm' && 'px-3 py-1.5 text-sm rounded',
          size === 'md' && 'px-4 py-2 text-sm rounded-md',
          size === 'lg' && 'px-6 py-3 text-base rounded-md',
          // Variants
          variant === 'primary' &&
            'bg-accent text-bg hover:bg-accent-hover',
          variant === 'secondary' &&
            'bg-bg-elevated text-text border border-border hover:border-accent',
          variant === 'ghost' &&
            'text-text-muted hover:text-text hover:bg-bg-elevated',
          variant === 'danger' &&
            'bg-danger text-white hover:bg-red-600',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
