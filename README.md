# Alto Garda Kite — Gestionale ASD

App web per la gestione del **Circolo Altogarda Kite ASD**:
anagrafica soci con firma digitale, registro uscite barca, attrezzatura e corsi.

Stack: **Next.js 15** (App Router) + **TypeScript** + **Supabase** (Postgres + Auth + Storage) + **Tailwind**, deploy su **Vercel**.

---

## Features principali

- **Anagrafica soci digitale**
  Domanda di ammissione completa in 6 step, ricalcata fedelmente sul modulo cartaceo:
  dati anagrafici, dichiarazioni, informativa navigazione, GDPR, safeguarding, riepilogo.
  - 5 firme separate acquisite via touch (`react-signature-canvas`), salvate come PNG base64.
  - Auto-detect minore: se la data di nascita indica < 18 anni, chiede automaticamente i dati del genitore.
  - Validazione codice fiscale, email, CAP.

- **Registro uscite barca**
  Versione digitale della checklist cartacea: imbarcazione, ora partenza/rientro, sessione vento (Peler/Ora/Serale), istruttori, partecipanti.
  Per ogni partecipante: tipo (corso / lift supervisionato / lift semplice), tipo di noleggio (completo / solo tavola / solo kite / ecc.), attrezzatura specifica assegnata, prezzo.

- **Attrezzatura**
  Inventario raggruppato per tipo (kite, tavola, barra, trapezio, muta, giubbotto, casco, wing, foil, sup), con stato (disponibile / in uso / manutenzione / dismesso).

- **Corsi**
  Tracking ore completate vs ore totali, stato pagamento.

- **Dashboard**
  Statistiche live e ultime uscite.

---

## Setup

### 1. Crea progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto.
2. Annota la password del DB.
3. Vai in **Project Settings → API** e copia:
   - `Project URL`
   - `anon public key`
   - `service_role key` (riservata, solo server)

### 2. Esegui la migrazione SQL

1. Apri **SQL Editor** sulla dashboard Supabase.
2. Copia tutto il contenuto di `supabase/migrations/0001_initial_schema.sql`.
3. Incolla ed esegui.

Questo crea tutte le tabelle (members, instructors, boats, equipment, courses, outings, e relazioni), gli enum, indici, view e policy RLS.

### 3. Configura variabili d'ambiente

Copia `.env.example` in `.env.local`:

```bash
cp .env.example .env.local
```

E compila con i valori del tuo progetto Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 4. Installa e avvia in locale

```bash
npm install
npm run dev
```

L'app sara disponibile su [http://localhost:3000](http://localhost:3000).

### 5. (Opzionale) Crea utente admin per accedere

Dato che le policy RLS richiedono `authenticated`, per ora devi creare un utente da Supabase:
**Authentication → Users → Add user** (email + password).

> **Nota**: questa versione iniziale non ha ancora un sistema di login UI. Le query funzionano se sei loggato (cookie Supabase) o se temporaneamente cambi le policy in `using (true)` senza ruolo. Il login UI è il prossimo step naturale di sviluppo.

---

## Deploy su Vercel

1. Pusha il progetto su GitHub.
2. Su [vercel.com](https://vercel.com), **New Project → Import Git Repository**.
3. In **Environment Variables** aggiungi le 3 variabili da `.env.local`.
4. Deploy.

---

## Struttura cartelle

```
altogardakite-app/
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql   ← schema completo del DB
├── src/
│   ├── app/
│   │   ├── page.tsx                   Dashboard
│   │   ├── soci/
│   │   │   ├── page.tsx               Lista soci
│   │   │   ├── nuovo/page.tsx         ★ Form ammissione 6-step con firme
│   │   │   └── [id]/page.tsx          Scheda socio + firme acquisite
│   │   ├── uscite/
│   │   │   ├── page.tsx               Lista uscite
│   │   │   ├── nuova/page.tsx         ★ Checklist digitale con partecipanti
│   │   │   └── [id]/page.tsx          Dettaglio uscita
│   │   ├── attrezzatura/page.tsx      Inventario raggruppato
│   │   ├── corsi/page.tsx             Lista corsi attivi
│   │   └── api/
│   │       ├── soci/route.ts          POST nuovo socio
│   │       └── uscite/route.ts        POST nuova uscita
│   ├── components/
│   │   ├── SignaturePad.tsx           Canvas firma touch
│   │   ├── Sidebar.tsx                Nav desktop + mobile
│   │   └── ui/                        Input, Select, Button, Card, Checkbox
│   └── lib/
│       ├── supabase/                  Client browser + server
│       ├── validation/schemas.ts      Schemi Zod
│       ├── types.ts                   Tipi DB + label IT
│       └── utils.ts                   formatDate, isMinor, ecc.
└── package.json
```

---

## Modello dati — sintesi

```
members ──< courses
  │
  └──< outing_participants >── outings >── boats
                │                  │
                │                  └──< outing_instructors >── instructors
                │
                └──< outing_participant_equipment >── equipment
```

Vedi `supabase/migrations/0001_initial_schema.sql` per lo schema completo con commenti.

---

## Roadmap (cosa aggiungere subito dopo)

- **Auth UI**: pagina login Supabase Auth (admin / segreteria / istruttori con ruoli diversi).
- **Stampa PDF**: generare il PDF firmato della domanda di ammissione (per l'archivio cartaceo / SCEN).
- **Upload certificato medico**: integrazione Supabase Storage.
- **Esportazioni**: CSV soci, Excel uscite/corsi.
- **Pagamenti Stripe** o **SumUp** integrati per quote associative.
- **Promemoria scadenze**: certificato medico, tessera CSEN.
- **Vista istruttore**: dashboard semplificata per chi compila l'uscita dal cellulare/tablet a bordo.

---

## Tech notes

- **Sincronia con il sito principale**: usa lo stesso design system (dark theme, Syne 800 + DM Sans, accento `#5dceaa`) gia adottato in `altogardakite.html`.
- **Mobile-first**: la sidebar collassa in nav-bar inferiore sotto i 1024px. Pensato per uso su tablet a bordo barca / smartphone in segreteria.
- **Firme**: salvate come dataURL PNG dentro la riga `members`. Per produzione su larga scala, valutare upload diretto a Supabase Storage e salvare solo l'URL.
- **RLS**: policy attualmente permissive per `authenticated`. In produzione differenziare per ruolo (admin/staff/istruttore).

---

## Licenza & contatti

Progetto custom per Circolo Altogarda Kite ASD — Riva del Garda, TN.
