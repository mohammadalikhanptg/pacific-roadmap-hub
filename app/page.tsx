import { client } from "@/lib/sanity";
import { EXPECTED_PROJECTS } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Milestone = { label: string; status: string; note?: string };
type Phase = { key?: string; title: string; order?: number; status?: string; milestones?: Milestone[] };
type Project = {
  _id: string; projectKey: string; projectName: string;
  status?: string; summary?: string; lastUpdated?: string;
  prodUrl?: string; repo?: string; phases?: Phase[];
};

const STALE_DAYS = 14;

const Q = `*[_type=="projectRoadmap"]{
  _id, projectKey, projectName, status, summary, lastUpdated, prodUrl, repo,
  phases[]{key, title, order, status, milestones[]{label, status, note}}
}`;

function tally(ms: Milestone[]) {
  return {
    done: ms.filter((m) => m.status === "done").length,
    prog: ms.filter((m) => m.status === "in_progress").length,
    blocked: ms.filter((m) => m.status === "blocked").length,
    total: ms.length,
  };
}
const sortedPhases = (p: Project) => (p.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const allMs = (p: Project) => sortedPhases(p).flatMap((ph) => ph.milestones || []);
const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}
function daysSince(d?: string): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

const chip = (s: string) => s === "done" ? "chip done" : s === "in_progress" ? "chip prog" : s === "blocked" ? "chip blocked" : "chip planned";
const chipText = (s: string) => s === "done" ? "Done" : s === "in_progress" ? "In progress" : s === "blocked" ? "Blocked" : "Planned";

// Next thing to happen on a project: the in-progress milestone if there is one,
// otherwise the first planned milestone, scanning phases in order. Null when
// everything is done.
function nextUp(p: Project): { label: string; phase: string } | null {
  for (const ph of sortedPhases(p)) {
    for (const m of ph.milestones || []) if (m.status === "in_progress") return { label: m.label, phase: ph.title };
  }
  for (const ph of sortedPhases(p)) {
    for (const m of ph.milestones || []) if (m.status === "planned") return { label: m.label, phase: ph.title };
  }
  return null;
}
function blockedItems(p: Project): string[] {
  return allMs(p).filter((m) => m.status === "blocked").map((m) => m.label);
}

// Lower rank = needs attention sooner. Blocked first, then stale, then active,
// then planned, then fully complete.
function rank(p: Project, stale: boolean): number {
  const t = tally(allMs(p));
  if (t.blocked > 0) return 0;
  if (stale) return 1;
  if ((p.status || "active") === "active" || t.prog > 0) return 2;
  if (t.total > 0 && t.done === t.total) return 4;
  return 3;
}

export default async function Page() {
  let projects: Project[] = [];
  let error = "";
  try { projects = await client.fetch(Q); } catch (e: unknown) { error = e instanceof Error ? e.message : "Could not load roadmap data"; }

  const decorated = projects.map((p) => {
    const ds = daysSince(p.lastUpdated);
    const stale = ds !== null && ds > STALE_DAYS;
    return { p, ds, stale, t: tally(allMs(p)), nu: nextUp(p), blk: blockedItems(p), r: rank(p, stale) };
  }).sort((a, b) => a.r - b.r || a.p.projectName.localeCompare(b.p.projectName));

  const reportedKeys = new Set(projects.map((p) => p.projectKey));
  const unmapped = EXPECTED_PROJECTS.filter((e) => !reportedKeys.has(e.key));

  const totals = decorated.reduce(
    (a, d) => { a.done += d.t.done; a.prog += d.t.prog; a.blocked += d.t.blocked; a.total += d.t.total; return a; },
    { done: 0, prog: 0, blocked: 0, total: 0 }
  );
  const projBlocked = decorated.filter((d) => d.blk.length > 0).length;
  const projStale = decorated.filter((d) => d.stale).length;
  const projActive = decorated.filter((d) => (d.p.status || "active") === "active").length;

  return (
    <main className="wrap">
      <header className="top">
        <h1>Project Roadmaps</h1>
        <p className="sub">Single pane of glass across all Pacific projects. Each project keeps its own record current; this page reads them all.</p>
        {projects.length > 0 && (
          <div className="pcounts">
            <span className="pc"><b>{projects.length}</b>/{EXPECTED_PROJECTS.length} reporting</span>
            <span className="pc"><b>{projActive}</b> active</span>
            <span className={"pc" + (projBlocked ? " danger" : "")}><b>{projBlocked}</b> with blockers</span>
            <span className={"pc" + (projStale ? " warn" : "")}><b>{projStale}</b> stale</span>
            <span className="pc soft">{totals.done} done · {totals.prog} in progress · {totals.blocked} blocked · {totals.total} milestones</span>
          </div>
        )}
      </header>

      {error && <div className="err">Could not load data: {error}</div>}
      {!error && projects.length === 0 && <div className="empty">No project roadmaps reported yet.</div>}

      <section className="grid">
        {decorated.map(({ p, ds, stale, t, nu, blk }) => {
          const phases = sortedPhases(p);
          return (
            <article key={p._id} className={"card" + (blk.length ? " attn" : "")}>
              <div className="chead">
                <div className="ctitle">
                  <h2>{p.projectName}</h2>
                  <div className="badges">
                    <span className={chip(p.status === "active" ? "in_progress" : (p.status || "planned"))}>{p.status || "active"}</span>
                    {blk.length > 0 && <span className="chip blocked">{blk.length} blocked</span>}
                    {stale ? <span className="badge stale">stale {ds}d</span>
                      : ds === null ? <span className="badge unknown">no date</span>
                      : <span className="badge fresh">updated {ds === 0 ? "today" : ds + "d ago"}</span>}
                  </div>
                </div>
                <div className="cpct">{pct(t.done, t.total)}%</div>
              </div>

              {p.summary && <p className="summary">{p.summary}</p>}

              <div className="bar"><div className="fill" style={{ width: pct(t.done, t.total) + "%" }} /></div>
              <div className="meta">{t.done}/{t.total} done · {t.prog} in progress{t.blocked ? " · " + t.blocked + " blocked" : ""}</div>

              {nu && <div className="nextup"><span className="nlabel">Next</span> {nu.label} <span className="nphase">· {nu.phase}</span></div>}
              {blk.length > 0 && <div className="blockedline"><span className="nlabel">Blocked</span> {blk.slice(0, 2).join("; ")}{blk.length > 2 ? " +" + (blk.length - 2) + " more" : ""}</div>}
              {!nu && t.total > 0 && <div className="nextup done"><span className="nlabel">Done</span> all milestones complete</div>}

              <details className="drill">
                <summary>Milestones</summary>
                {phases.map((ph, i) => {
                  const pt = tally(ph.milestones || []);
                  return (
                    <div key={ph.key || i} className="phase">
                      <div className="phead"><strong>{ph.title}</strong><span className="pmeta">{pt.done}/{pt.total}</span></div>
                      <ul>
                        {(ph.milestones || []).map((m, j) => (
                          <li key={j}>
                            <span className={chip(m.status)}>{chipText(m.status)}</span>
                            <span className="mlabel">{m.label}</span>
                            {m.note && <span className="mnote">{m.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </details>

              {(p.prodUrl || p.repo) && (
                <div className="links">
                  {p.prodUrl && <a href={p.prodUrl} target="_blank" rel="noreferrer">Live</a>}
                  {p.repo && <span className="repo">{p.repo}</span>}
                  {p.lastUpdated && <span className="repo">· {fmt(p.lastUpdated)}</span>}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {unmapped.length > 0 && (
        <section className="unmapped">
          <h3>Not yet reporting</h3>
          <p className="sub">Known projects without a roadmap record. They appear here so missing coverage is visible, not hidden.</p>
          <ul>
            {unmapped.map((u) => <li key={u.key}><span className="badge unknown">no record</span> {u.name}</li>)}
          </ul>
        </section>
      )}

      <footer className="foot">Each project updates its own record; this page reads them all. Stale = not updated in over {STALE_DAYS} days.</footer>
    </main>
  );
}
