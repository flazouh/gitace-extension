import { type KeyboardEvent, useState } from "react"
import { useArt } from "./art"
import { Menu } from "./Menu"
import type { Dictation as Hearing } from "./useDictation"
import type { VoiceChoices } from "./voiceChoices"
import { VoiceWaves } from "./VoiceWaves"

/** Minutes and seconds, as the pill's clock reads. */
export const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

/**
 * The microphone, as Ace's composer draws it: a tinted square and, a seam beside it, the narrow
 * button of its menu. While it listens the square grows into the recording pill, the bars, the
 * clock and a stop on Send's fill, and the menu button steps aside.
 *
 * With "Hold to record" on, it listens while it is held down and stops when it is let go.
 */
export const Dictation = ({
  hearing,
  choices,
  onChoices,
  blocked
}: {
  readonly hearing: Hearing
  readonly choices: VoiceChoices
  readonly onChoices: (choices: VoiceChoices) => void
  readonly blocked: boolean
}) => {
  const [menu, setMenu] = useState(false)
  const art = useArt()
  const Kebab = art["mic-menu"]
  const { listening } = hearing
  const held = (event: KeyboardEvent) => event.key === " " || event.key === "Enter"
  const press = choices.hold
    ? {
        onPointerDown: hearing.start,
        onPointerUp: hearing.stop,
        onPointerLeave: hearing.stop,
        onKeyDown: (event: KeyboardEvent) => {
          if (held(event) && !event.repeat) hearing.start()
        },
        onKeyUp: (event: KeyboardEvent) => {
          if (held(event)) hearing.stop()
        }
      }
    : { onClick: listening ? hearing.stop : hearing.start }

  return (
    <div className="relative">
      <div className="t-mic" {...(listening ? { "data-listening": "" } : {})}>
        <button
          type="button"
          className="t-mic-button"
          aria-label={listening ? "Stop dictating" : "Dictate"}
          title={listening ? "Stop" : choices.hold ? "Hold to dictate" : "Dictate"}
          disabled={blocked && !listening}
          {...(listening ? { "data-listening": "" } : {})}
          {...press}
        >
          <span className="t-mic-face" aria-hidden="true">
            <art.mic size={16} />
          </span>
          <span className="t-mic-pill" aria-hidden="true">
            {listening ? <VoiceWaves level={hearing.level} /> : <span className="t-mic-waves" />}
            <span className="t-mic-clock">{clock(hearing.seconds)}</span>
            <span className="t-mic-stop" />
          </span>
        </button>
        <button
          type="button"
          className="t-mic-menu"
          aria-label="Microphone"
          title="Microphone"
          aria-haspopup="menu"
          aria-expanded={menu}
          disabled={blocked || listening}
          tabIndex={listening ? -1 : undefined}
          onClick={() => setMenu((open) => !open)}
        >
          <Kebab size={14} />
        </button>
      </div>
      <Menu
        name="Microphone"
        open={menu}
        onShut={() => setMenu(false)}
        origin="bottom-right"
        wide="w-56"
        rows={[
          {
            name: "Hold to record",
            chosen: choices.hold,
            press: () => onChoices({ ...choices, hold: !choices.hold })
          },
          {
            name: "Send when recording stops",
            chosen: choices.send,
            press: () => onChoices({ ...choices, send: !choices.send })
          }
        ]}
      />
    </div>
  )
}
