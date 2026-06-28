import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { normalizePhone } from '@/lib/whatsapp';

/**
 * Controlla che la sessione WhatsApp sia 'ready'. Se non lo e', tenta
 * un restart (POST .../start) e attende fino a ~15s che torni pronta.
 * Ritorna { ready: boolean, status: string }.
 */
async function ensureSessionReady(
  baseUrl: string,
  sessionId: string,
  apiKey: string | undefined
): Promise<{ ready: boolean; status: string }> {
  const headers: Record<string, string> = apiKey ? { 'X-API-Key': apiKey } : {};
  const base = baseUrl.replace(/\/$/, '');

  async function getStatus(): Promise<string> {
    try {
      const res = await fetch(`${base}/api/sessions/${sessionId}`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return 'unreachable';
      const data = await res.json();
      return data?.status || 'unknown';
    } catch {
      return 'unreachable';
    }
  }

  // 1. Controllo iniziale
  let status = await getStatus();
  if (status === 'ready') return { ready: true, status };

  // 2. Se non e' pronta (ma raggiungibile), prova a farla ripartire
  if (status !== 'unreachable') {
    try {
      await fetch(`${base}/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      // ignora: ricontrolliamo comunque lo stato sotto
    }

    // 3. Attende fino a ~15s controllando ogni 3s
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      status = await getStatus();
      if (status === 'ready') return { ready: true, status };
    }
  }

  return { ready: false, status };
}

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

    // Controllo sessione: se non e' pronta, prova a riavviarla prima di inviare
    const sessionCheck = await ensureSessionReady(baseUrl, sessionId, apiKey);
    if (!sessionCheck.ready) {
      const msg =
        sessionCheck.status === 'unreachable'
          ? 'OpenWA non raggiungibile. Controlla che il PC sia acceso e il tunnel attivo.'
          : `Sessione WhatsApp non connessa (stato: ${sessionCheck.status}). Apri OpenWA e riscansiona il codice QR, poi riprova.`;
      return NextResponse.json(
        { error: msg, sessionStatus: sessionCheck.status, sessionDown: true },
        { status: 503 }
      );
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
    const apiKey = process.env.OPENWA_API_KEY;
    const sessionId = process.env.OPENWA_SESSION || 'altogarda';
    if (!baseUrl) {
      return NextResponse.json({ configured: false });
    }

    const base = baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = apiKey ? { 'X-API-Key': apiKey } : {};

    // Controlla lo stato della sessione specifica
    try {
      const res = await fetch(`${base}/api/sessions/${sessionId}`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return NextResponse.json({ configured: true, reachable: true, sessionReady: false, sessionStatus: 'not_found' });
      }
      const data = await res.json();
      const ready = data?.status === 'ready';
      return NextResponse.json({
        configured: true,
        reachable: true,
        sessionReady: ready,
        sessionStatus: data?.status || 'unknown',
      });
    } catch {
      return NextResponse.json({ configured: true, reachable: false, sessionReady: false });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
