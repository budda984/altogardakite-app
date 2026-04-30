import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, required, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-text">
            {label} {required && <span className="text-accent">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full rounded-md bg-bg-input border border-border px-3 py-2 text-sm',
            'text-text appearance-none cursor-pointer',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'bg-[url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a3a3a3%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E")] bg-no-repeat bg-[right_0.5rem_center] pr-9',
            error && 'border-danger',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
