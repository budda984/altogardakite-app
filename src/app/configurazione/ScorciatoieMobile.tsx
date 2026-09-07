import Link from 'next/link';
import {
  UserCog, Anchor, Package, GraduationCap, Youtube, Tag, ScrollText, BarChart3,
} from 'lucide-react';

// Su mobile la barra in basso porta solo alle sei sezioni principali, e il
// tasto "Admin" apre questa pagina: senza queste scorciatoie le pagine di
// gestione (istruttori, imbarcazioni, attrezzatura...) sarebbero irraggiungibili
// dal telefono. Su desktop non serve: ci sono gia' nella barra laterale.
const VOCI = [
  { href: '/istruttori', label: 'Istruttori', icon: UserCog },
  { href: '/barche', label: 'Imbarcazioni', icon: Anchor },
  { href: '/attrezzatura', label: 'Attrezzatura', icon: Package },
  { href: '/corsi', label: 'Corsi', icon: GraduationCap },
  { href: '/accademia', label: 'Accademia', icon: Youtube },
  { href: '/servizi', label: 'Listino servizi', icon: Tag },
  { href: '/log', label: 'Registro', icon: ScrollText },
  { href: '/statistiche', label: 'Statistiche', icon: BarChart3 },
];

export default function ScorciatoieMobile() {
  const voci = VOCI;

  return (
    <div className="lg:hidden mb-6">
      <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3">
        Gestione
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {voci.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-border bg-bg-surface text-sm text-text hover:border-accent transition-colors"
          >
            <Icon className="h-4 w-4 text-accent shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
