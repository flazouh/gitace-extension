import { Atmosphere } from "../Atmosphere"
import { Install, useTheirStore } from "../Shell"
import { alsoOn } from "../stores"
import { LiveScreen } from "./LiveScreen"

const CHIPS = ["No account", "No server", "Open source", "Not an AI reviewer"] as const

/**
 * The top of the page, on the dark field: the line, four chips, the install block, and
 * the inbox running in a window tilted back the way Ace's session window is.
 */
export const Hero = () => {
  const store = useTheirStore()

  return (
    <section id="top" className="ace-hero">
      <Atmosphere field="hero" />

      <div className="ace-wrap ace-hero-text">
        <div>
          <h1>A faster, quieter GitHub</h1>
          <ul className="ace-chips m-0 list-none p-0">
            {CHIPS.map((chip) => (
              <li key={chip} className="ace-chip">
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="ace-buy">
          <p className="ace-size m-0">
            20<small>GitHub pages redrawn</small>
          </p>
          <div className="ace-stack">
            <span className="ace-tag">{alsoOn(store.browser)}</span>
            <Install tone="cream" />
          </div>
        </div>
      </div>

      <div id="product" className="ace-object">
        <div className="ace-win">
          <LiveScreen
            eager
            scene="working-set"
            label="The inbox: every pull request you are in, filed by what it needs from you"
          />
        </div>
      </div>
    </section>
  )
}
