'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SignupState {
  error?: string;
  success?: boolean;
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  const displayName = String(formData.get('display_name') || '').trim();

  if (!email || !password) {
    return { error: 'Email e password obbligatorie' };
  }
  if (password.length < 8) {
    return { error: 'La password deve contenere almeno 8 caratteri' };
  }
  if (password !== confirm) {
    return { error: 'Le password non coincidono' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'Esiste gia un account con questa email' };
    }
    return { error: error.message || 'Errore in fase di registrazione' };
  }

  // L'utente e' loggato automaticamente; il middleware lo manda a /attesa
  // perche' il suo ruolo iniziale e' 'pending'
  redirect('/attesa');
}
