import { client } from "@/lib/sanity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Milestone = { label: string; status: string; note?: string };
type Phase = { key?: string; title: string; order?: number; status?: string; milestones?: Milestone[] };
type Project = {
  _id: string; projectKey: string; projectName: string;
  status?: string; summary?: string; lastUpdated?: string;
  prodUrl?: string; repo?: string; phases?: Phase[];
};

const Q = `*[_type=="projectRoadmap"]|order(projectName asc){
  _id, projectKey, projectName, status, summary, lastUpdated, prodUrl, repo,
  phases[]{key, title, order, status, milestones[]{label, status, note}}
}`;

function tally(ms: Milestone[]) {
  return {
    done: ms.filter((m) => m.status === "done").length,
    prog: ms.filter((m) => m.status === "in_progress").length,
    total: ms.length,
  };
}
const allMs = (p: Project) => (p.phases || []).flatMap((ph) => ph.milestones || []);
const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);
function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}
const chip = (s: string) => s === "done" ? "chip done" : s === "in_progress" ? "chip prog" : s === "blocked" ? "chip blocked" : "chip planned";
const chipText = (s: string) => s === "done" ? "Done" : s === "in_progress" ? "In progress" : s === "blocked" ? "Blocked" : "Planned";

export default async function Page() {
  let projects: Project[] = [];
  let error = "";
  try { projects = await client.fetch(Q); } catch (e: unknown) { error = e instanceof Error ? e.message : "Could not load roadmap data"; }

  const portfolio = projects.reduce(
    (a, p) => { const t = tally(allMs(p)); a.done += t.done; a.prog += t.prog; a.total += t.total; return a; },
    { done: 0, prog: 0, total: 0 }
  );

  return (
    <main className="wrap">
      <header className="top">
        <h1>Project Roadmaps</h1>
        <p className="sub">Single pane of glass across all Pacific projects. Each project keeps its own progress current.</p>
        {projects.length > 0 && (
          <div className="portfolio">
            <div className="bar"><div className="fill" style={{ width: pct(portfolio.done, portfolio.total) + "%" }} /></div>
            <div className="ptext">{portfolio.done} of {portfolio.total} milestones done ({pct(portfolio.done, portfolio.total)}%) across {projects.length} project(s) · {portfolio.prog} in progress</div>
          </div>
        )}
      </header>

      {error && <div className="err">Could not load data: {error}</div>}
      {!error && projects.length === 0 && <div className="empty">No project roadmaps reported yet.</div>}

      <section className="grid">
        {projects.map((p) => {
          const t = tally(allMs(p));
          const phases = (p.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return (
            <article key={p._id} className="card">
              <div className="chead">
                <div>
                  <h2>{p.projectName}</h2>
                  <span className={chip(p.status === "active" ? "in_progress" : (p.status || "planned"))}>{p.status || "active"}</span>
                </div>
                <div className="cpct">{pct(t.done, t.total)}%</div>
              </div>
              {p.summary && <p className="summary">{p.summary}</p>}
              <div className="bar"><div className="fill" style={{ width: pct(t.done, t.total) + "%" }} /></div>
              <div className="meta">{t.done}/{t.total} done · {t.prog} in progress{p.lastUpdated ? " · updated " + fmt(p.lastUpdated) : ""}</div>
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
                </div>
              )}
            </article>
          );
        })}
      </section>
      <footer className="foot">Each project updates its own record; this page reads them all.</footer>
    </main>
  );
}
