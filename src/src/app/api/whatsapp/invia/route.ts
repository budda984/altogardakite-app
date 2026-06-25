import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { normalizePhone } from '@/lib/whatsapp';

/**
 * POST /api/whatsapp/invia
 *
 * Invia un messaggio WhatsApp a piu' destinatari tramite OpenWA self-hosted,
 * raggiungibile via tunnel Cloudflare.
 *
 * Variabili d'ambiente su Vercel:
 *   OPENWA_URL      -> es. https://openwa.altogardawa.com
 *   OPENWA_API_KEY  -> la admin key owa_k1_... di OpenWA
 *   OPENWA_SESSION  -> l'ID della sessione (UUID), NON il nome
 *
 * Body: { recipients: [{ name, phone }], text }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const baseUrl = process.env.OPENWA_URL;
    const apiKey = process.env.OPENWA_API_KEY;
    const sessionId = process.env.OPENWA_SESSION || 'altogarda';

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'OpenWA non configurato: manca OPENWA_URL nelle variabili d\'ambiente Vercel.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const text: string = body.text || '';
    const recipients: { name: string; phone: string }[] = body.recipients || [];

    if (!text.trim()) {
      return NextResponse.json({ error: 'Testo del messaggio mancante' }, { status: 400 });
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Nessun destinatario' }, { status: 400 });
    }

    const results: { name: string; phone: string; ok: boolean; warning?: boolean; error?: string }[] = [];

    for (const r of recipients) {
      const normalized = normalizePhone(r.phone);
      if (!normalized) {
        results.push({ name: r.name, phone: r.phone, ok: false, error: 'numero non valido' });
        continue;
      }

      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/api/sessions/${sessionId}/messages/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            },
            body: JSON.stringify({
              chatId: `${normalized}@c.us`,
              text,
            }),
          }
        );

        if (res.ok) {
          results.push({ name: r.name, phone: r.phone, ok: true });
        } else {
          const errBody = await res.text().catch(() => '');
          // Caso noto: il motore whatsapp-web.js a volte ritorna 500
          // "Promise was collected" ANCHE SE il messaggio e' partito.
          // Lo trattiamo come "probabilmente inviato" (warning, non errore netto).
          const isLikelySent =
            res.status === 500 &&
            /Promise was collected|Protocol error|callFunctionOn/i.test(errBody);

          if (isLikelySent) {
            results.push({
              name: r.name, phone: r.phone, ok: true, warning: true,
              error: 'inviato ma conferma incerta',
            });
          } else {
            results.push({
              name: r.name, phone: r.phone, ok: false,
              error: `HTTP ${res.status} ${errBody.slice(0, 80)}`,
            });
          }
        }
      } catch (e) {
        results.push({
          name: r.name, phone: r.phone, ok: false,
          error: e instanceof Error ? e.message : 'errore di rete',
        });
      }

      // Ritardo 1.2-2.2s tra un invio e l'altro: piu' margine per il
      // browser headless, riduce gli errori "Promise was collected".
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1000));
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const uncertain = results.filter((r) => r.warning).length;

    return NextResponse.json({ ok: true, sent, failed, uncertain, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/whatsapp/invia
 * Verifica lo stato della connessione a OpenWA (per la UI).
 */
export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const baseUrl = process.env.OPENWA_URL;
    if (!baseUrl) {
      return NextResponse.json({ configured: false });
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return NextResponse.json({ configured: true, reachable: res.ok });
    } catch {
      return NextResponse.json({ configured: true, reachable: false });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
