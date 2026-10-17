const REDRAWN = [
  ["Pull requests", "Inbox, review, diffs, checks, merge"],
  ["Code", "Repository home, files, blame, commits, compare"],
  ["Issues", "Lists, threads, and raising a new one"],
  ["Actions", "Runs and their jobs"],
  ["People", "Profiles, notifications, discussions, releases"],
  ["Browsers", "Chrome, Firefox, Safari"],
  ["Account", "None. It runs on your GitHub session"],
  ["License", "AGPL-3.0"]
] as const

/** What it redraws, in Ace's spec table. */
export const Specs = () => (
  <section id="pages" className="ace-wrap ace-specs">
    <h2 className="ace-display">What it redraws.</h2>
    <dl className="m-0">
      {REDRAWN.map(([name, says]) => (
        <div key={name} className="ace-spec">
          <dt>{name}</dt>
          <dd>{says}</dd>
        </div>
      ))}
    </dl>
  </section>
)
