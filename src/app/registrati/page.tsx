'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { signupAction, type SignupState } from './actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function RegistratiPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    {}
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-2xl font-bold tracking-tightest leading-none">
            ALTO<span className="text-accent">GARDA</span>
          </div>
          <div className="font-display text-2xl font-bold tracking-tightest leading-none mt-1">
            KITE
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-dim mt-3">
            Gestionale ASD
          </div>
        </div>

        <form
          action={formAction}
          className="bg-bg-surface border border-border rounded-lg p-6 space-y-5"
        >
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Crea account</h1>
            <p className="text-xs text-text-muted mt-1">
              Dopo la registrazione il tuo account dovra essere approvato da un amministratore prima di poter accedere ai dati.
            </p>
          </div>

          <Input
            label="Nome visualizzato"
            name="display_name"
            placeholder="es. Mario Rossi"
          />

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="Minimo 8 caratteri"
          />

          <Input
            label="Conferma password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />

          {state.error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crea account
          </Button>

          <div className="text-center text-xs text-text-muted pt-2">
            Hai gia un account?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Accedi
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
