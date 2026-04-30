'use client';

import { use, useActionState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { loginAction, type LoginState } from './actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default function LoginPage({ searchParams }: Props) {
  const sp = use(searchParams);
  const next = sp?.next || '/';

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
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
          <h1 className="font-display text-xl font-semibold tracking-tight">Accedi</h1>

          <input type="hidden" name="next" value={next} />

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
          />

          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
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
            Accedi
          </Button>

          <p className="text-xs text-text-dim text-center pt-2">
            Gli account staff vengono creati dallamministratore tramite il
            dashboard Supabase.
          </p>
        </form>
      </div>
    </div>
  );
}
