import { UndefinedOr } from "effect"
import { VOICE } from "./keeping"

/**
 * The microphone's two switches, as Ace's composer has them in the menu beside the button.
 *
 * Held here rather than in Settings because they are the microphone's, set from its own menu,
 * and read nowhere else.
 */
export type VoiceChoices = {
  /** The button records while it is held down, and stops when it is let go. */
  readonly hold: boolean
  /** What was said is sent the moment it stops listening. */
  readonly send: boolean
}

const NONE: VoiceChoices = { hold: false, send: false }

const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage) => JSON.parse(store.getItem(VOICE) ?? "{}") as unknown)
const write = UndefinedOr.liftThrowable((store: Storage, choices: VoiceChoices) => {
  store.setItem(VOICE, JSON.stringify(choices))
})

export const voiceChoices = (): VoiceChoices => {
  const store = held()
  const kept = store === undefined ? undefined : read(store)
  if (typeof kept !== "object" || kept === null) return NONE
  const { hold, send } = kept as Partial<Record<keyof VoiceChoices, unknown>>
  return { hold: hold === true, send: send === true }
}

export const keepVoiceChoices = (choices: VoiceChoices): void => {
  const store = held()
  if (store !== undefined) write(store, choices)
}
