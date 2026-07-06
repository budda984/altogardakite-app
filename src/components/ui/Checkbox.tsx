import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            ref={ref}
            type="checkbox"
            className={cn(
              'mt-0.5 h-4 w-4 rounded border-border bg-bg-input',
              'text-accent focus:ring-accent focus:ring-offset-0 focus:ring-offset-bg',
              'cursor-pointer accent-accent',
              className
            )}
            {...props}
          />
          <span className="text-sm text-text leading-snug select-none group-hover:text-accent transition-colors">
            {label}
          </span>
        </label>
        {error && <p className="text-xs text-danger ml-7">{error}</p>}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';
