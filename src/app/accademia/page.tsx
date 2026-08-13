'use client';

import { useEffect, useState, useCallback } from 'react';
import { Youtube, Plus, Trash2, Loader2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Video = {
  id: string;
  titolo: string;
  youtube_id: string;
  descrizione: string | null;
};
type Categoria = { id: string; nome: string; video: Video[] };

export default function AccademiaAdmin() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuovaCat, setNuovaCat] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  // Form video: aperto sotto una categoria per volta.
  const [catAperta, setCatAperta] = useState<string | null>(null);
  const [vTitolo, setVTitolo] = useState('');
  const [vUrl, setVUrl] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [salvo, setSalvo] = useState(false);

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accademia');
      const j = await r.json();
      setCategorie(j.categorie || []);
    } catch {
      setCategorie([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  async function creaCategoria() {
    if (!nuovaCat.trim()) return;
    setErrore(null);
    const r = await fetch('/api/accademia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'categoria', nome: nuovaCat.trim(), ordine: categorie.length }),
    });
    if (r.ok) { setNuovaCat(''); carica(); }
    else setErrore((await r.json()).error || 'Non creata.');
  }

  async function aggiungiVideo(categoria_id: string) {
    if (!vTitolo.trim() || !vUrl.trim()) return;
    setSalvo(true);
    setErrore(null);
    const r = await fetch('/api/accademia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'video', categoria_id,
        titolo: vTitolo.trim(), url: vUrl.trim(), descrizione: vDesc.trim(),
      }),
    });
    setSalvo(false);
    if (r.ok) {
      setVTitolo(''); setVUrl(''); setVDesc(''); setCatAperta(null);
      carica();
    } else {
      setErrore((await r.json()).error || 'Non aggiunto.');
    }
  }

  async function elimina(tipo: 'categoria' | 'video', id: string) {
    if (tipo === 'categoria' && !confirm('Eliminare la categoria e tutti i suoi video?')) return;
    await fetch(`/api/accademia?tipo=${tipo}&id=${id}`, { method: 'DELETE' });
    carica();
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <Youtube className="h-7 w-7 text-accent" />
          Accademia
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Video YouTube che i soci vedono nel portale, raggruppati per categoria.
        </p>
      </div>

      {errore && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-400 mb-4">
          {errore}
        </div>
      )}

      {/* Nuova categoria */}
      <div className="flex gap-2 mb-6">
        <Input
          value={nuovaCat}
          onChange={(e) => setNuovaCat(e.target.value)}
          placeholder="Nuova categoria (es. Base, Avanzato, Sicurezza)"
        />
        <Button variant="secondary" onClick={creaCategoria}>
          <FolderPlus className="h-4 w-4 mr-1.5" /> Aggiungi
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : categorie.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">
          Ancora nessuna categoria. Creane una qui sopra per iniziare.
        </p>
      ) : (
        <div className="space-y-6">
          {categorie.map((cat) => (
            <div key={cat.id} className="border border-border rounded-lg p-4 bg-bg-surface">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-text">{cat.nome}</h2>
                <button
                  onClick={() => elimina('categoria', cat.id)}
                  className="text-text-dim hover:text-red-400 p-1"
                  aria-label="Elimina categoria"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {cat.video.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {cat.video.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 text-sm bg-bg-elevated border border-border rounded-md px-3 py-2">
                      <img
                        src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`}
                        alt=""
                        className="w-16 h-12 object-cover rounded shrink-0"
                      />
                      <span className="flex-1 text-text">{v.titolo}</span>
                      <button
                        onClick={() => elimina('video', v.id)}
                        className="text-text-dim hover:text-red-400 p-1"
                        aria-label="Elimina video"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {catAperta === cat.id ? (
                <div className="p-3 rounded-md border border-border bg-bg-elevated space-y-2">
                  <Input value={vTitolo} onChange={(e) => setVTitolo(e.target.value)} placeholder="Titolo del video" />
                  <Input value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder="Link YouTube (incolla l'indirizzo)" />
                  <Input value={vDesc} onChange={(e) => setVDesc(e.target.value)} placeholder="Descrizione (facoltativa)" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setCatAperta(null)} className="text-xs px-3 py-1.5 text-text-muted hover:text-text">
                      Annulla
                    </button>
                    <Button size="sm" onClick={() => aggiungiVideo(cat.id)} disabled={salvo}>
                      {salvo ? 'Salvo…' : 'Aggiungi video'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setCatAperta(cat.id); setVTitolo(''); setVUrl(''); setVDesc(''); }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:border-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Aggiungi video
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
