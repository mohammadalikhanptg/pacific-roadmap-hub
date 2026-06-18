import { client } from "@/lib/sanity";
import { EXPECTED_PROJECTS } from "@/lib/projects";
import { PhaseAccordion } from "@/app/components/PhaseAccordion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Milestone = { label: string; status: string; note?: string };
type Phase = { key?: string; title: string; order?: number; status?: string; milestones?: Milestone[] };
type Project = {
  _id: string; projectKey: string; projectName: string;
  status?: string; summary?: string; lastUpdated?: string;
  prodUrl?: string; repo?: string; phases?: Phase[];
};
type FlatMs = Milestone & { phase: string };

const STALE_DAYS = 14;

const Q = `*[_type=="projectRoadmap"]{
  _id, projectKey, projectName, status, summary, lastUpdated, prodUrl, repo,
  phases[]{key, title, order, status, milestones[]{label, status, note}}
}`;

const sortedPhases = (p: Project) => (p.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const flat = (p: Project): FlatMs[] => sortedPhases(p).flatMap((ph) => (ph.milestones || []).map((m) => ({ ...m, phase: ph.title })));

function tally(ms: Milestone[]) {
  return {
    done: ms.filter((m) => m.status === "done").length,
    prog: ms.filter((m) => m.status === "in_progress").length,
    blocked: ms.filter((m) => m.status === "blocked").length,
    total: ms.length,
  };
}
const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}
function ts(d?: string): number {
  if (!d) return -Infinity;
  const t = new Date(d).getTime();
  return isNaN(t) ? -Infinity : t;
}
function daysSince(d?: string): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}
function ago(d?: string): string {
  const ds = daysSince(d);
  if (ds === null) return "no date";
  if (ds === 0) {
    const mins = Math.floor((Date.now() - new Date(d!).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    return Math.floor(mins / 60) + "h ago";
  }
  return ds + "d ago";
}

const chip = (s: string) => s === "done" ? "chip done" : s === "in_progress" ? "chip prog" : s === "blocked" ? "chip blocked" : "chip planned";
const chipText = (s: string) => s === "done" ? "Done" : s === "in_progress" ? "In progress" : s === "blocked" ? "Blocked" : "Planned";
const remainWeight = (s: string) => s === "in_progress" ? 0 : s === "blocked" ? 1 : 2;

function nextUp(p: Project): { label: string; phase: string } | null {
  const f = flat(p);
  const ip = f.find((m) => m.status === "in_progress");
  if (ip) return { label: ip.label, phase: ip.phase };
  const pl = f.find((m) => m.status === "planned");
  if (pl) return { label: pl.label, phase: pl.phase };
  return null;
}

export default async function Page() {
  let projects: Project[] = [];
  let error = "";
  try { projects = await client.fetch(Q); } catch (e: unknown) { error = e instanceof Error ? e.message : "Could not load roadmap data"; }

  const decorated = projects.map((p) => {
    const f = flat(p);
    const ds = daysSince(p.lastUpdated);
    const stale = ds !== null && ds > STALE_DAYS;
    const completed = f.filter((m) => m.status === "done");
    const remaining = f.filter((m) => m.status !== "done").sort((a, b) => remainWeight(a.status) - remainWeight(b.status));
    return { p, ds, stale, t: tally(f), nu: nextUp(p), completed, remaining, blk: f.filter((m) => m.status === "blocked") };
  }).sort((a, b) => ts(b.p.lastUpdated) - ts(a.p.lastUpdated) || a.p.projectName.localeCompare(b.p.projectName));

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
        <p className="sub">Most recently updated first. Each project keeps its own record current; this page reads them all and reorders on every load.</p>
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
        {decorated.map(({ p, stale, t, nu, blk }) => (
          <article key={p._id} className={"card" + (blk.length ? " attn" : "")}>
            <div className="chead">
              <div className="ctitle">
                <h2>{p.projectName}</h2>
                <div className="badges">
                  <span className={chip(p.status === "active" ? "in_progress" : (p.status || "planned"))}>{p.status || "active"}</span>
                  {blk.length > 0 && <span className="chip blocked">{blk.length} blocked</span>}
                  <span className={"badge " + (stale ? "stale" : p.lastUpdated ? "fresh" : "unknown")}>updated {ago(p.lastUpdated)}</span>
                </div>
              </div>
              <div className="cpct">{pct(t.done, t.total)}%</div>
            </div>

            <div className="cbody">
              <div className="left">
                {p.summary && <p className="summary">{p.summary}</p>}
              </div>
              <div className="right">
            <div className="bar"><div className="fill" style={{ width: pct(t.done, t.total) + "%" }} /></div>
            <div className="meta">{t.done}/{t.total} done · {t.prog} in progress{t.blocked ? " · " + t.blocked + " blocked" : ""}</div>

            {nu ? <div className="nextup"><span className="nlabel">Next</span> {nu.label} <span className="nphase">· {nu.phase}</span></div>
              : t.total > 0 ? <div className="nextup done"><span className="nlabel">Done</span> all milestones complete — extend scope to add more</div>
              : null}
              </div>
            </div>

            <PhaseAccordion phases={sortedPhases(p)} />

            {(p.prodUrl || p.repo || p.lastUpdated) && (
              <div className="links">
                {p.prodUrl && <a href={p.prodUrl} target="_blank" rel="noreferrer">Live</a>}
                {p.repo && <span className="repo">{p.repo}</span>}
                {p.lastUpdated && <span className="repo">· {fmt(p.lastUpdated)}</span>}
              </div>
            )}
          </article>
        ))}
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

      <footer className="foot">Ordered by most recent update. Stale = not updated in over {STALE_DAYS} days.</footer>
    </main>
  );
}
