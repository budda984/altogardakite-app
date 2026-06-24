import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { normalizePhone } from '@/lib/whatsapp';

/**
 * POST /api/whatsapp/invia
 *
 * Invia un messaggio WhatsApp a piu' destinatari tramite un'istanza OpenWA
 * self-hosted, raggiungibile via tunnel (Cloudflare Quick Tunnel o simile).
 *
 * Variabili d'ambiente richieste su Vercel:
 *   OPENWA_URL      -> es. https://random-words.trycloudflare.com
 *   OPENWA_API_KEY  -> la API key configurata in OpenWA
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

    const results: { name: string; phone: string; ok: boolean; error?: string }[] = [];

    // Invio sequenziale con piccolo ritardo per non sembrare spam
    for (const r of recipients) {
      const normalized = normalizePhone(r.phone);
      if (!normalized) {
        results.push({ name: r.name, phone: r.phone, ok: false, error: 'numero non valido' });
        continue;
      }

      try {
        // Endpoint OpenWA per inviare testo. chatId formato: <numero>@c.us
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/messages/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {}),
          },
          body: JSON.stringify({
            chatId: `${normalized}@c.us`,
            to: normalized,
            text,
            message: text,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          results.push({ name: r.name, phone: r.phone, ok: false, error: `HTTP ${res.status} ${errBody.slice(0, 80)}` });
        } else {
          results.push({ name: r.name, phone: r.phone, ok: true });
        }
      } catch (e) {
        results.push({
          name: r.name, phone: r.phone, ok: false,
          error: e instanceof Error ? e.message : 'errore di rete',
        });
      }

      // Ritardo 800ms-1.5s tra un invio e l'altro
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      results,
    });
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

    if (!baseUrl) {
      return NextResponse.json({ configured: false });
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {},
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
