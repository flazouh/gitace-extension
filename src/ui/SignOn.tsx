/**
 * What stands where an organisation's single sign-on wall was.
 *
 * The wall is one heading and one button, and the button does one thing: post a
 * form that is already in the page. So this card is not a richer version of their
 * page — there is nothing richer to say — it is the same button with the two
 * things their page leaves out. Which page you were going to, and an offer to stop
 * asking.
 *
 * The offer is the whole reason this exists. A reader whose organisation expires
 * its session daily presses Continue every morning, and that press carries no
 * decision: their provider is what authenticates them, and it still will. See
 * `SIGN_ON_KNOBS` in `src/domain/Settings.ts`, where the same thing is written from
 * the setting's side.
 */
import { pathIn, type Wall } from "../github/signOn"
import { CARD, PRIMARY, SECONDARY } from "./dress"
import { SignOnAsk } from "./SignOnAsk"
import { Switch } from "./Switch"

/** The sentence that names the switch, so the switch is read out by it. */
const BY_ITSELF = "gitace-sign-on-by-itself"

export type SignOnProps = {
  readonly wall: Wall
  /** What the reader has asked for, which the tick here changes. */
  readonly chosen: "ask" | "always"
  readonly onChoose: (next: "ask" | "always") => void
  /**
   * Whether this wall would have been answered by itself, and was not.
   *
   * Only ever true for a reader who asked for it, and it means this organisation
   * was answered here seconds ago and the wall is up again. Saying so is the
   * difference between a setting that looks broken and a setting that is working
   * and has something to report.
   */
  readonly cameRound: boolean
  readonly onContinue: () => void
  /** Restores GitHub's own wall, which is still there behind this. */
  readonly onStepAside: () => void
}

export const SignOn = ({
  wall,
  chosen,
  onChoose,
  cameRound,
  onContinue,
  onStepAside
}: SignOnProps) => {
  /*
   * Where the reader was going, cut to the path. Their own `return_to`, but a
   * query string of forty characters in the middle of a sentence reads as noise
   * rather than as a destination — and the sentence below is written to be true
   * with it or without it.
   */
  const going = pathIn(wall.backTo)

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className={`${CARD} w-full max-w-md p-5`}>
        <SignOnAsk
          organisation={wall.organisation}
          what={going === "" ? "this page" : going}
          // The one place this card can promise more than the other one: their form
          // is in this document, so the button below really does answer the wall.
          then="Continue goes to their identity provider and comes back here."
        >
          {/* Only where it happened, and a reader who never switched this on is
              never told: the sentence would read as an error about a mechanism
              they have not met.

              What it says is what this knows — the same organisation was answered
              here a moment ago and the wall is up again. Why is their provider's
              business, so "wants to see you" is offered as the usual reason and
              never as a report. */}
          {cameRound ? (
            <p className="mb-4 text-sm leading-5 text-ink-muted">
              {`Signed on for you a moment ago, and ${wall.organisation} asked again, so this one is yours. Usually that means their identity provider wants to see you.`}
            </p>
          ) : null}
        </SignOnAsk>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${PRIMARY} px-3 py-1.5 text-sm`} onClick={onContinue}>
            Continue to {wall.organisation}
          </button>
          {/* Their wall was hidden rather than removed, so this is a button that gives
              it back and never a link to the same address. */}
          <button type="button" className={`${SECONDARY} px-3 py-1.5 text-sm`} onClick={onStepAside}>
            Show GitHub's page
          </button>
        </div>

        <div className="mt-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p id={BY_ITSELF} className="text-sm leading-5 text-ink">
              Sign on by itself next time
            </p>
            <p className="text-xs leading-5 text-ink-muted">
              Your identity provider still decides, and still asks for a password or a second factor when
              it wants one.
            </p>
          </div>
          <span className="pt-0.5">
            <Switch
              on={chosen === "always"}
              labelledBy={BY_ITSELF}
              onFlip={(on) => onChoose(on ? "always" : "ask")}
            />
          </span>
        </div>
      </div>
    </main>
  )
}
