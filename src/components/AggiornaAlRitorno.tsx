'use client';

import { useEffect } from 'react';

// Quando si torna sulla scheda del gestionale dopo un po', ricarica.
// Serve perche' il planning cambia spesso (prenotazioni dal portale, altri
// dello staff che modificano) e una scheda lasciata aperta mostra dati vecchi.
//
// Ricarica solo dopo una assenza abbastanza lunga: se stai passando avanti e
// indietro tra due schede per copiare un dato, non ti azzera quello che stai
// facendo. E non ricarica se hai un modulo compilato a meta' o un modale
// aperto, per non buttare via il lavoro.
const ASSENZA_MINIMA_MS = 90_000; // 1 minuto e mezzo

export default function AggiornaAlRitorno() {
  useEffect(() => {
    let uscitaAlle: number | null = null;

    function staScrivendo() {
      // Modale aperto: nel gestionale i modali usano role="dialog".
      if (document.querySelector('[role="dialog"]')) return true;

      // Qualcosa gia' digitato in un campo di testo.
      const campi = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea'
      );
      for (const c of Array.from(campi)) {
        if (c.type === 'checkbox' || c.type === 'radio' || c.type === 'hidden') continue;
        if (c.value && c.value.trim() !== '' && c.value !== c.defaultValue) return true;
      }
      return false;
    }

    function cambioVisibilita() {
      if (document.visibilityState === 'hidden') {
        uscitaAlle = Date.now();
        return;
      }

      // Tornati sulla scheda.
      if (uscitaAlle === null) return;
      const assenza = Date.now() - uscitaAlle;
      uscitaAlle = null;

      if (assenza < ASSENZA_MINIMA_MS) return;
      if (staScrivendo()) return;

      window.location.reload();
    }

    document.addEventListener('visibilitychange', cambioVisibilita);
    return () => document.removeEventListener('visibilitychange', cambioVisibilita);
  }, []);

  return null;
}
