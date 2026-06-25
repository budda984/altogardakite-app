'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Euro } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  equipmentTransactionSchema, type EquipmentTransactionFormData,
} from '@/lib/validation/admin-schemas';
import {
  type Equipment, type Member, type EquipmentTransactionType,
  EQUIPMENT_TRANSACTION_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EquipmentTransactionModal({ equipment, open, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, watch, formState: { errors },
  } = useForm<EquipmentTransactionFormData>({
    resolver: zodResolver(equipmentTransactionSchema),
    defaultValues: {
      transaction_type: 'vendita',
      transaction_date: new Date().toISOString().slice(0, 10),
    },
  });

  const txType = watch('transaction_type');

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset({
      transaction_type: 'vendita',
      transaction_date: new Date().toISOString().slice(0, 10),
      amount: null,
      member_id: null,
      buyer_name: '',
      notes: '',
    });
    supabase
      .from('members')
      .select('id,first_name,last_name')
      .eq('active', true)
      .order('last_name')
      .then(({ data }) => setMembers((data as Member[]) || []));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: EquipmentTransactionFormData) => {
    if (!equipment) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/attrezzatura/${equipment.id}/transazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore salvataggio');
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const isMonetary = txType === 'vendita' || txType === 'acquisto' || txType === 'cessione';
  const isSale = txType === 'vendita' || txType === 'cessione';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={equipment ? `Movimenta: ${equipment.code}` : 'Movimento attrezzatura'}
      description={
        equipment
          ? `${equipment.brand || ''} ${equipment.model || ''} ${equipment.size || ''}`.trim() || undefined
          : undefined
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Select label="Tipo movimento *" {...register('transaction_type')}>
          {(Object.keys(EQUIPMENT_TRANSACTION_LABELS) as EquipmentTransactionType[]).map((t) => (
            <option key={t} value={t}>{EQUIPMENT_TRANSACTION_LABELS[t]}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data *"
            type="date"
            {...register('transaction_date')}
            error={errors.transaction_date?.message}
          />
          {isMonetary && (
            <Input
              label="Importo €"
              type="number"
              step="0.01"
              min={0}
              {...register('amount')}
              hint={txType === 'acquisto' ? 'Costo acquisto' : 'Prezzo vendita'}
            />
          )}
        </div>

        {isSale && (
          <>
            <Select label="Acquirente (socio)" {...register('member_id')}>
              <option value="">— Esterno o non specificato —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.last_name} {m.first_name}
                </option>
              ))}
            </Select>

            <Input
              label="Nome acquirente esterno"
              placeholder="Compila solo se non e un socio"
              {...register('buyer_name')}
            />
          </>
        )}

        <Textarea
          label="Note"
          {...register('notes')}
          placeholder={
            txType === 'dismissione' ? 'Motivo: rotto, obsoleto, smarrito...' :
            txType === 'manutenzione' ? 'Tipo intervento, fornitore...' :
            'Eventuali dettagli'
          }
        />

        <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 text-xs text-text-muted">
          <p className="text-blue-400 font-medium mb-1">Effetto sullo stato dellattrezzatura:</p>
          {txType === 'vendita' || txType === 'dismissione' || txType === 'cessione'
            ? 'Stato impostato a "Dismesso"'
            : txType === 'manutenzione'
            ? 'Stato impostato a "Manutenzione"'
            : 'Nessuna modifica allo stato'}
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registra movimento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
