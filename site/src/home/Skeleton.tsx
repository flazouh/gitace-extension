/**
 * What a window shows while the live screen inside it loads: the screen's outline,
 * drawn in its own dark colours, so the frame is never an empty box and never a
 * picture of the product.
 *
 * A bar across the top, a column of groups down the left and rows beside it, which is
 * the shape both the inbox and the pull request open with.
 */

const ROWS = [72, 54, 64, 40, 58, 46, 68, 36] as const

export const Skeleton = () => (
  <div aria-hidden className="ace-skeleton">
    <div className="ace-skeleton-bar">
      <span style={{ width: 92 }} />
      <span style={{ width: 160 }} />
      <span style={{ marginInlineStart: "auto", width: 72 }} />
    </div>
    <div className="ace-skeleton-body">
      <div className="ace-skeleton-side">
        {[0, 1, 2, 3].map((group) => (
          <span key={group} />
        ))}
      </div>
      <div className="ace-skeleton-rows">
        {ROWS.map((width, row) => (
          <div key={row} className="ace-skeleton-row">
            <i />
            <span style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </div>
  </div>
)
