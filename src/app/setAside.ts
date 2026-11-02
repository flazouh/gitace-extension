import { Context, Effect } from "effect"

import { whenPressing } from "@/app/intent"

/**
 * Whether the reader has moved on from the screen a read is for.
 *
 * A list's rows come with reads of their own — a size and a merge box for every row the
 * store cannot vouch for — and on a busy repository that is every row, every visit.
 * Measured leaving `openrouter-web`'s list for one of its pull requests: 736 requests in
 * the list's first thirty seconds and still going, and the pull request's own seven
 * reads queued behind them on the one connection, `/changes` taking 1,558ms to answer
 * a press that had rested on the row.
 *
 * Nothing here is about the rows the screen draws, which arrive with the search. These
 * are the columns beside them, and a column nobody is looking at can wait for the next
 * visit, which reads whatever this one did not.
 */
export type Aside = {
  /** True once the reader has moved on. */
  readonly now: () => boolean
  /** Ends when they do. */
  readonly when: Effect.Effect<void>
}

/** A screen that is never left, which is any read not started by one. */
export const Aside = Context.Reference<Aside>("gitace/Aside", {
  defaultValue: () => ({ now: () => false, when: Effect.never })
})

/**
 * A read worth making only while its screen is in front of the reader, and `instead`
 * once it is not: not started after that, and called off if it is in the air.
 *
 * An answer rather than a failure, so the stage it is part of ends with what it has and
 * the screen's read still answers. A list kept for the way back that came back saying
 * it could not be read would be the worse half of the trade.
 */
export const whileShown = <A, E, R>(read: Effect.Effect<A, E, R>, instead: () => A): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const aside = yield* Aside
    if (aside.now()) return instead()
    return yield* Effect.raceFirst(read, Effect.map(aside.when, instead))
  })

/** One screen's moving on, said by the screen and heard by its reads. */
export type SettingAside = {
  /** The read, made with this screen's moving on in it. */
  readonly within: <A, E, R>(read: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  /**
   * For the screen's `holding`: from here until the screen leaves, a press to anywhere
   * it is not `staying` for sets its reads aside too.
   *
   * At the press rather than at the leaving, which comes when the screen pressed for
   * has drawn: a few hundred milliseconds in which every read held back is one the
   * press is not waiting behind. Started again where the screen is stood up again,
   * which is the way back to a screen that was kept.
   */
  readonly holding: (staying: (path: string) => boolean) => () => void
}

export const settingAside = (target: Window): SettingAside => {
  let gone = false
  let waiting = new Set<() => void>()

  const go = (): void => {
    if (gone) return
    gone = true
    const told = waiting
    waiting = new Set()
    for (const resume of told) resume()
  }

  /** Read once, when a read starts: a read made before the way back stays set aside. */
  const current = (): Aside => {
    if (gone) return { now: () => true, when: Effect.void }
    let left = false
    const when = Effect.callback<void>((resume) => {
      if (left) return resume(Effect.void)
      const done = () => resume(Effect.void)
      waiting.add(done)
      return Effect.sync(() => waiting.delete(done))
    })
    waiting.add(() => {
      left = true
    })
    return { now: () => left, when }
  }

  return {
    within: (read) => Effect.suspend(() => Effect.provideService(read, Aside, current())),
    holding: (staying) => {
      gone = false
      const stop = whenPressing(target, (path) => {
        if (!staying(path)) go()
      })
      return () => {
        stop()
        go()
      }
    }
  }
}
