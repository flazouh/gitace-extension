import { UndefinedOr } from "effect"
import { KEPT_WAITING as KEY } from "./keeping"

/**
 * How much of the Working Set waits on the reader, as Home last drew it.
 *
 * Only Home reads the Working Set, and a pull request page asking GitHub for six lists to draw
 * one number in a corner is the request this extension exists not to make. So Home keeps the
 * number it counted, and every other page shows that: the count as of the last look, which is
 * also what the list will open on.
 */
const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage) => store.getItem(KEY))
const write = UndefinedOr.liftThrowable((store: Storage, count: number) => {
  store.setItem(KEY, String(count))
})

export const keepWaiting = (count: number): void => {
  const store = held()
  if (store !== undefined) write(store, count)
}

export const keptWaiting = (): number => {
  const store = held()
  const kept = Number(store === undefined ? undefined : read(store))
  return Number.isInteger(kept) && kept > 0 ? kept : 0
}
