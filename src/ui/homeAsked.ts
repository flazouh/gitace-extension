import { UndefinedOr } from "effect"
import type { Destination } from "../domain/Settings"
import { HOME_ASKED as KEY } from "./keeping"

/**
 * The Destination a press away from Home asked Home to show, carried across the load to it.
 *
 * Pressing Activity on a pull request is a walk to `github.com/` and a request about what that
 * page shows, and the page that answers it is a fresh document. It used to be carried by the
 * setting Home opens on, so a glance at Activity also changed where `github.com/` landed the
 * next morning. This carries it once instead: the tab's session holds it until Home takes it.
 *
 * A session that refuses a write still opens Home, on the Destination the settings say.
 */
const held = UndefinedOr.liftThrowable((): Storage => sessionStorage)
const write = UndefinedOr.liftThrowable((store: Storage, value: string) => {
  store.setItem(KEY, value)
})
const take = UndefinedOr.liftThrowable((store: Storage) => {
  const asked = store.getItem(KEY)
  store.removeItem(KEY)
  return asked
})

const DESTINATIONS: ReadonlyArray<Destination> = ["working-set", "repositories", "activity"]

export const askHomeFor = (which: Destination): void => {
  const store = held()
  if (store !== undefined) write(store, which)
}

/** What a press asked Home for, taken so that a later visit lands where the setting says. */
export const takeHomeAsked = (): Destination | undefined => {
  const store = held()
  const asked = store === undefined ? undefined : take(store)
  return DESTINATIONS.find((one) => one === asked)
}
