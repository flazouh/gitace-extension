import { Atmosphere } from "../Atmosphere"
import { LiveScreen } from "./LiveScreen"

/** What the inbox does, beside a pull request running on a plate. */
export const Split = () => (
  <section id="inbox" className="ace-wrap ace-split">
    <div>
      <h2 className="ace-display">Pull requests, filed by what they need.</h2>
      <p className="ace-lede">
        Every pull request you are in, sorted into what needs you, what waits on someone else,
        what is still running and what is settled. The next action is the first thing you see,
        not the twentieth row of a list.
      </p>
      <a className="ace-btn ace-btn-ink" href="#session">
        How it reads GitHub
      </a>
    </div>

    <div className="ace-plate">
      <Atmosphere field="plate" />
      <div className="ace-shot">
        <LiveScreen
          scene="pull-request"
          label="One pull request: its threads, checks and changed files on one screen"
        />
      </div>
    </div>
  </section>
)
