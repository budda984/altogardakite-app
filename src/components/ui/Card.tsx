import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: ReactNode;
  description?: ReactNode;
}

export function Card({ title, description, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-bg-surface p-6',
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="mb-6 pb-6 border-b border-border">
          {title && (
            <h3 className="text-lg font-display font-semibold text-text tracking-tight">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
