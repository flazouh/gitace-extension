import { MARK_PATH } from "@/ui/Mark"
import { ACE_AT } from "../Shell"

/** Ace's mark, in its own 120 x 82 box, for a product tile. */
const AceMark = ({ fill }: { readonly fill: string }) => (
  <svg viewBox="0 0 120 82" aria-hidden="true">
    <path fill={fill} d={MARK_PATH} />
  </svg>
)

/** The two products, side by side: Ace, and this one. */
export const Family = () => (
  <section className="ace-wrap ace-specs">
    <h2 className="ace-display">One of Ace&apos;s products.</h2>
    <div className="ace-family">
      <a className="ace-prod" href={ACE_AT}>
        <span className="ace-mk" style={{ background: "var(--ink)" }}>
          <AceMark fill="#f0eee6" />
        </span>
        <h3>Ace</h3>
        <p>
          The native workshop for agents. A desktop app, drawn on the GPU, where your agents work
          next to your code.
        </p>
        <span className="ace-meta">
          <span>Desktop app</span>
          <span className="ace-go">useace.dev →</span>
        </span>
      </a>

      <div className="ace-prod ace-here">
        <span className="ace-mk" style={{ background: "var(--violet)" }}>
          <AceMark fill="#ffffff" />
        </span>
        <h3>GitAce Extension</h3>
        <p>A faster, quieter GitHub, in the browser you already use. The first piece of GitAce.</p>
        <span className="ace-meta">
          <span>Browser extension</span>
          <span>You are here</span>
        </span>
      </div>
    </div>
  </section>
)
