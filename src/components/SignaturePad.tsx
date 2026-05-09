'use client';

import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  label: string;
  value?: string;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
  error?: string;
}

export function SignaturePad({ label, value, onChange, required, error }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  // Resize del canvas in base al contenitore
  useEffect(() => {
    const updateWidth = () => {
      if (wrapperRef.current) {
        setWidth(wrapperRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Carica valore esistente
  useEffect(() => {
    if (value && sigRef.current) {
      sigRef.current.fromDataURL(value);
      setHasDrawn(true);
    }
  }, [value, width]);

  const handleEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL('image/png');
      onChange(dataUrl);
      setHasDrawn(true);
    }
  };

  const handleClear = () => {
    sigRef.current?.clear();
    onChange(null);
    setHasDrawn(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text">
          {label} {required && <span className="text-accent">*</span>}
        </label>
        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-text-muted hover:text-accent transition-colors"
          >
            Cancella firma
          </button>
        )}
      </div>

      <div
        ref={wrapperRef}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors bg-bg-input',
          'border-border hover:border-border-strong',
          error && 'border-danger',
          hasDrawn && 'border-accent/50 border-solid'
        )}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="#f5f5f5"
          canvasProps={{
            width,
            height: 180,
            className: 'rounded-lg cursor-crosshair touch-none',
          }}
          onEnd={handleEnd}
        />
        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-text-dim text-sm">
            Firma qui con il dito o stylus
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
