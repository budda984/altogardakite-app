'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Shield, ShieldOff, Ban, RotateCcw, Trash2,
  Loader2, MoreVertical, Mail, User as UserIcon,
} from 'lucide-react';
import type { ProfileWithEmail, UserRole } from '@/lib/types';
import { USER_ROLE_LABELS } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  users: ProfileWithEmail[];
  currentUserId: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  staff: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  admin: 'bg-accent/10 text-accent border-accent/30',
  // I soci non usano il gestionale: qui compaiono solo perche' condividono
  // l'autenticazione. Colore spento, non sono utenti da approvare.
  socio: 'bg-bg-elevated text-text-muted border-border',
};

export default function UsersTable({ users, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | UserRole | 'suspended'>('all');

  const filtered = users.filter((u) => {
    if (filter === 'all') return true;
    if (filter === 'suspended') return u.suspended;
    return u.role === filter;
  });

  const callAction = async (
    userId: string,
    action: 'approve' | 'demote' | 'promote' | 'suspend' | 'unsuspend' | 'delete',
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/utenti/${userId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Errore');
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Tutti', users.length],
          ['pending', 'In attesa', users.filter((u) => u.role === 'pending').length],
          ['staff', 'Staff', users.filter((u) => u.role === 'staff').length],
          ['admin', 'Admin', users.filter((u) => u.role === 'admin').length],
          ['suspended', 'Sospesi', users.filter((u) => u.suspended).length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              filter === key
                ? 'bg-accent text-bg'
                : 'bg-bg-elevated text-text-muted hover:text-text'
            )}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserIcon className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessun utente in questa categoria.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((u) => {
              const isMe = u.id === currentUserId;
              const busy = busyId === u.id || isPending;
              return (
                <div key={u.id} className="p-4 flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-text">
                        {u.display_name || u.email || u.id.slice(0, 8)}
                      </span>
                      <span className={cn('text-xs px-2 py-0.5 rounded border', ROLE_COLORS[u.role])}>
                        {USER_ROLE_LABELS[u.role]}
                      </span>
                      {u.suspended && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          Sospeso
                        </span>
                      )}
                      {isMe && (
                        <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
                          tu
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-text-muted flex gap-3 flex-wrap">
                      {u.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </span>
                      )}
                      <span>Registrato il {formatDate(u.created_at)}</span>
                      {u.last_sign_in_at && (
                        <span>Ultimo accesso: {formatDate(u.last_sign_in_at)}</span>
                      )}
                      {u.approved_at && (
                        <span>Approvato il {formatDate(u.approved_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                    ) : (
                      <UserActions
                        user={u}
                        isMe={isMe}
                        onAction={(action, confirmMsg) => callAction(u.id, action, confirmMsg)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionsProps {
  user: ProfileWithEmail;
  isMe: boolean;
  onAction: (
    action: 'approve' | 'demote' | 'promote' | 'suspend' | 'unsuspend' | 'delete',
    confirmMsg?: string
  ) => void;
}

function UserActions({ user, isMe, onAction }: ActionsProps) {
  const [open, setOpen] = useState(false);

  // Pending → bottone primario "Approva" sempre visibile
  if (user.role === 'pending' && !user.suspended) {
    return (
      <>
        <button
          onClick={() => onAction('approve')}
          className="px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium flex items-center gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approva
        </button>
        {!isMe && (
          <Menu open={open} setOpen={setOpen}>
            <MenuItem onClick={() => onAction('suspend', 'Sospendere questo utente?')} icon={Ban} danger>
              Sospendi
            </MenuItem>
            <MenuItem
              onClick={() => onAction('delete', `Eliminare definitivamente l'account di ${user.email}? Questa azione non e reversibile.`)}
              icon={Trash2}
              danger
            >
              Elimina account
            </MenuItem>
          </Menu>
        )}
      </>
    );
  }

  return (
    <Menu open={open} setOpen={setOpen}>
      {user.suspended ? (
        <MenuItem onClick={() => onAction('unsuspend')} icon={RotateCcw}>
          Riattiva
        </MenuItem>
      ) : (
        <>
          {user.role === 'staff' && (
            <MenuItem onClick={() => onAction('promote', 'Promuovere a amministratore? Avra accesso completo a tutto, inclusa la gestione utenti.')} icon={Shield}>
              Promuovi ad admin
            </MenuItem>
          )}
          {user.role === 'admin' && !isMe && (
            <MenuItem onClick={() => onAction('demote', 'Rimuovere i privilegi di admin? Lutente restera staff con accesso operativo.')} icon={ShieldOff}>
              Revoca admin
            </MenuItem>
          )}
          {!isMe && (
            <MenuItem onClick={() => onAction('suspend', 'Sospendere questo utente? Non potra piu accedere finche non lo riattivi.')} icon={Ban} danger>
              Sospendi
            </MenuItem>
          )}
        </>
      )}
      {!isMe && (
        <MenuItem
          onClick={() => onAction('delete', `Eliminare definitivamente l'account di ${user.email}? Questa azione non e reversibile.`)}
          icon={Trash2}
          danger
        >
          Elimina account
        </MenuItem>
      )}
      {isMe && (
        <div className="px-3 py-2 text-xs text-text-dim italic">
          Non puoi modificare il tuo account
        </div>
      )}
    </Menu>
  );
}

function Menu({ open, setOpen, children }: { open: boolean; setOpen: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-56 bg-bg-surface border border-border rounded-md shadow-lg overflow-hidden">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick, icon: Icon, danger, children,
}: { onClick: () => void; icon: typeof Shield; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-bg-elevated transition-colors',
        danger ? 'text-red-400' : 'text-text'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
