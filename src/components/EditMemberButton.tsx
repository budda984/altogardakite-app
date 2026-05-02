'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { memberEditSchema, type MemberEditFormData } from '@/lib/validation/admin-schemas';

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_number: string | null;
  city: string | null;
  cap: string | null;
  birth_province: string | null;
  fiscal_code: string | null;
  notes: string | null;
}

export default function EditMemberButton({ member }: { member: MemberData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Modifica anagrafica
      </Button>
      {open && <EditModal member={member} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ member, onClose }: { member: MemberData; onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<MemberEditFormData>({
    resolver: zodResolver(memberEditSchema),
    defaultValues: {
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email || '',
      phone: member.phone || '',
      address_street: member.address_street || '',
      address_number: member.address_number || '',
      city: member.city || '',
      cap: member.cap || '',
      birth_province: member.birth_province || '',
      fiscal_code: member.fiscal_code || '',
      notes: member.notes || '',
    },
  });

  const onSubmit = async (data: MemberEditFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore salvataggio');
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Modifica anagrafica socio" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nome *" {...register('first_name')} error={errors.first_name?.message} />
          <Input label="Cognome *" {...register('last_name')} error={errors.last_name?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label="Telefono" {...register('phone')} />
        </div>
        <Input
          label="Codice fiscale"
          {...register('fiscal_code')}
          error={errors.fiscal_code?.message}
          hint="Verra normalizzato in maiuscolo"
        />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="Indirizzo" {...register('address_street')} placeholder="es. Via Roma" />
          </div>
          <Input label="Numero" {...register('address_number')} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="Comune" {...register('city')} />
          </div>
          <Input label="CAP" {...register('cap')} />
        </div>
        <Input label="Provincia di nascita" {...register('birth_province')} placeholder="es. TN" />
        <Textarea label="Note" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salva modifiche
          </Button>
        </div>
      </form>
    </Modal>
  );
}
