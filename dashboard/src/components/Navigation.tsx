import type { ViewId } from '../types';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'triaje', label: 'Triaje' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'historial', label: 'Historial clínico' },
  { id: 'ajustes', label: 'Ajustes' },
];

interface Props {
  view: ViewId;
  navigate: (v: ViewId) => void;
}

export function Navigation({ view, navigate }: Props) {
  return (
    <nav>
      {TABS.map(t => (
        <a
          key={t.id}
          href={`#${t.id}`}
          className={view === t.id ? 'on' : ''}
          onClick={e => { e.preventDefault(); navigate(t.id); }}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
