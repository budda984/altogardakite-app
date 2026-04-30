import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, required, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-text">
            {label} {required && <span className="text-accent">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-md bg-bg-input border border-border px-3 py-2 text-sm',
            'placeholder:text-text-dim text-text',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
