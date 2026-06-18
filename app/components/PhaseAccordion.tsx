'use client';

import { useState } from 'react';

type Milestone = { label: string; status: string; note?: string };
type Phase = { key?: string; title: string; order?: number; status?: string; milestones?: Milestone[] };

function tally(ms: Milestone[]) {
  return {
    done: ms.filter((m) => m.status === 'done').length,
    prog: ms.filter((m) => m.status === 'in_progress').length,
    blocked: ms.filter((m) => m.status === 'blocked').length,
    total: ms.length,
  };
}

function derivePhaseStatus(ph: Phase): string {
  const ms = ph.milestones || [];
  if (!ms.length) return ph.status || 'planned';
  const t = tally(ms);
  if (t.done === t.total && t.total > 0) return 'done';
  if (ph.status && ph.status !== 'planned') return ph.status;
  if (t.blocked > 0) return 'blocked';
  if (t.prog > 0) return 'in_progress';
  return 'planned';
}

const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);

const chip = (s: string) =>
  s === 'done' ? 'chip done' :
  s === 'in_progress' ? 'chip prog' :
  s === 'blocked' ? 'chip blocked' : 'chip planned';

const chipText = (s: string) =>
  s === 'done' ? 'Done' :
  s === 'in_progress' ? 'In progress' :
  s === 'blocked' ? 'Blocked' : 'Planned';

export function PhaseAccordion({ phases }: { phases: Phase[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (!phases.length) return null;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const phasesDone = phases.filter((ph) => derivePhaseStatus(ph) === 'done').length;

  return (
    <div className="phase-drill">
      <div className="phase-summary-line">
        {phasesDone} of {phases.length} phase{phases.length !== 1 ? 's' : ''} complete
      </div>
      <div className="phases">
        {phases.map((ph, i) => {
          const phKey = ph.key || String(i);
          const isOpen = expanded.has(phKey);
          const pt = tally(ph.milestones || []);
          const ps = derivePhaseStatus(ph);
          return (
            <div key={phKey} className="phase-block">
              <button
                className="phase-row"
                onClick={() => toggle(phKey)}
                aria-expanded={isOpen}
              >
                <div className="phase-left">
                  <span className="phase-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="phase-title">{ph.title}</span>
                </div>
                <div className="phase-right">
                  <span className={chip(ps)}>{chipText(ps)}</span>
                  <span className="phase-count">{pt.done}/{pt.total}</span>
                  <div className="phase-bar">
                    <div className="fill" style={{ width: pct(pt.done, pt.total) + '%' }} />
                  </div>
                </div>
              </button>
              {isOpen && (
                <ul className="milestone-list">
                  {(ph.milestones || []).length === 0
                    ? <li className="no-milestones">No milestones defined.</li>
                    : (ph.milestones || []).map((m, j) => (
                      <li key={j}>
                        <span className={chip(m.status)}>{chipText(m.status)}</span>
                        <span className="mlabel">{m.label}</span>
                        {m.note && <span className="mnote">{m.note}</span>}
                      </li>
                    ))
                  }
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
