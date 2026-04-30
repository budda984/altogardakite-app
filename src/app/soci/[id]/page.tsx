import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, FileSignature, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDate, calcAge } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import MemberServicesLedger from '@/components/MemberServicesLedger';

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ registered?: string }>;
}) {
  const { id } = await params;
  const { registered } = await searchParams;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single();

  if (!member) notFound();

  // Corsi e uscite del socio
  const [{ data: courses }, { data: outings }] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('member_id', id)
      .order('start_date', { ascending: false }),
    supabase
      .from('outing_participants')
      .select('id, participation_type, rental_type, outings(id, outing_date, boats(name))')
      .eq('member_id', id)
      .order('outings(outing_date)', { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="p-4 lg:p-10 max-w-5xl">
      <Link
        href="/soci"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Tutti i soci
      </Link>

      {registered && (
        <div className="bg-success/10 border border-success/30 text-success p-4 rounded-md mb-6 flex gap-3 items-center">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">Socio registrato con successo</div>
            <div className="text-xs text-success/80">Tessera #{member.membership_number}</div>
          </div>
        </div>
      )}

      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-1">
          Socio #{member.membership_number}
        </div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          {member.first_name} {member.last_name}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {calcAge(member.birth_date)} anni
            {member.is_minor && <span className="text-warning text-xs">(minore)</span>}
          </span>
          {member.email && (
            <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 hover:text-accent">
              <Mail className="h-4 w-4" /> {member.email}
            </a>
          )}
          {member.phone && (
            <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 hover:text-accent">
              <Phone className="h-4 w-4" /> {member.phone}
            </a>
          )}
        </div>
      </header>

      {/* Servizi e pagamenti */}
      <div className="mb-6">
        <MemberServicesLedger memberId={id} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Anagrafica */}
        <Card title="Anagrafica">
          <dl className="space-y-3 text-sm">
            <Row label="Nato/a">
              {formatDate(member.birth_date)} a {member.birth_place}
              {member.birth_province && ` (${member.birth_province})`}
            </Row>
            <Row label="Codice fiscale" mono>{member.fiscal_code}</Row>
            <Row label="Residenza">
              <div className="flex items-start gap-1.5">
                <MapPin className="h-4 w-4 text-text-dim flex-shrink-0 mt-0.5" />
                <div>
                  {member.address_street} {member.address_number}<br />
                  {member.cap} {member.city}
                </div>
              </div>
            </Row>
          </dl>

          {member.is_minor && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="text-xs uppercase tracking-widest text-text-dim mb-3">
                Genitore esercente la potesta
              </div>
              <dl className="space-y-3 text-sm">
                <Row label="Nome">{member.parent_first_name} {member.parent_last_name}</Row>
                <Row label="Codice fiscale" mono>{member.parent_fiscal_code}</Row>
                <Row label="Cellulare">{member.parent_phone}</Row>
                {member.parent_email && <Row label="Email">{member.parent_email}</Row>}
              </dl>
            </div>
          )}
        </Card>

        {/* Dichiarazioni */}
        <Card title="Dichiarazioni e consensi">
          <ul className="space-y-2 text-sm">
            <ConsentRow ok={member.statute_accepted} label="Statuto e regolamenti" />
            <ConsentRow ok={member.medical_certificate} label="Certificato medico" />
            <ConsentRow ok={member.payment_commitment} label="Impegno pagamento" />
            <ConsentRow ok={member.photo_authorization} label="Autorizzazione foto/video" />
            <ConsentRow ok={member.navigation_rules_accepted} label="Regole navigazione" />
            <ConsentRow ok={member.safeguarding_acknowledged} label="Safeguarding" />
            <ConsentRow ok={member.gdpr_consent_1a} label="GDPR 1a (istituzionale)" />
            <ConsentRow ok={member.gdpr_consent_1b} label="GDPR 1b (promo CONI)" />
          </ul>
        </Card>

        {/* Firme */}
        <Card title="Firme acquisite" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SignatureCard label="Domanda ammissione" data={member.signature_admission} />
            <SignatureCard label="Informativa navigazione" data={member.signature_navigation} />
            <SignatureCard label="Safeguarding" data={member.signature_safeguarding} />
            <SignatureCard label="GDPR 1a" data={member.signature_gdpr_1a} />
            {member.signature_gdpr_1b && (
              <SignatureCard label="GDPR 1b" data={member.signature_gdpr_1b} />
            )}
          </div>
        </Card>

        {/* Corsi */}
        <Card title={`Corsi ${courses?.length ? `(${courses.length})` : ''}`}>
          {courses && courses.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium capitalize">{c.course_type.replace('_', ' ')}</div>
                    <div className="text-xs text-text-muted">
                      Dal {formatDate(c.start_date)} • {c.hours_completed}/{c.hours_total}h
                    </div>
                  </div>
                  <span className="text-xs text-text-muted capitalize">{c.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-text-muted">Nessun corso registrato.</div>
          )}
        </Card>

        {/* Uscite */}
        <Card title="Ultime uscite">
          {outings && outings.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {outings.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between text-text-muted">
                  <span>
                    {formatDate(p.outings.outing_date)} —{' '}
                    <span className="text-text">{p.outings.boats.name}</span>
                  </span>
                  <span className="text-xs capitalize">{p.participation_type.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-text-muted">Nessuna uscita registrata.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="text-text-dim text-xs uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : ''}>{children}</dd>
    </div>
  );
}

function ConsentRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-text-dim" />
      )}
      <span className={ok ? '' : 'text-text-muted'}>{label}</span>
    </li>
  );
}

function SignatureCard({ label, data }: { label: string; data: string | null }) {
  return (
    <div className="border border-border rounded-md p-3 bg-bg-input">
      <div className="text-xs text-text-dim mb-2 flex items-center gap-1.5">
        <FileSignature className="h-3 w-3" />
        {label}
      </div>
      {data ? (
        <img src={data} alt={label} className="h-20 w-full object-contain bg-bg rounded" />
      ) : (
        <div className="h-20 flex items-center justify-center text-text-dim text-xs">
          Non firmata
        </div>
      )}
    </div>
  );
}
