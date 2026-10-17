/**
 * The top plate of the layers: the inbox drawn small, in code.
 *
 * The four groups every list in the extension files pull requests into (`CONTEXT.md`
 * calls them Courts), each with a row or two under it. Too small to read as a screen
 * and not meant to be: it says "this is the page" at a glance, which is the plate's job.
 */

const COURTS = [
  { name: "Needs you", dot: "#f9a825", rows: [78, 56] },
  { name: "Waiting", dot: "#8ab4f8", rows: [64] },
  { name: "Running", dot: "#87b099", rows: [70, 44] },
  { name: "Settled", dot: "#8a867c", rows: [52] }
] as const

export const MiniInbox = () => (
  <div aria-hidden className="ace-mini">
    <div className="ace-mini-head">
      <b>Your pull requests</b>
      <span>12</span>
    </div>
    {COURTS.map((court) => (
      <div key={court.name} className="ace-mini-court">
        <div className="ace-mini-name">
          <i style={{ background: court.dot }} />
          {court.name}
        </div>
        {court.rows.map((width, row) => (
          <span key={row} className="ace-mini-row" style={{ width: `${width}%` }} />
        ))}
      </div>
    ))}
  </div>
)
