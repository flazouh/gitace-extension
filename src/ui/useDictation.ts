import { Effect } from "effect"
import { useCallback, useEffect, useRef, useState } from "react"
import { loudness } from "./voiceBars"

/**
 * Speaking into a box, as Ace's composer does: the words land in the text as they are heard.
 *
 * The browser's own recogniser does the hearing (Chrome's is `webkitSpeechRecognition`), so
 * there is nothing to install and no key to hold. The level the bars follow comes from the
 * microphone itself, through an analyser, because the recogniser says what was said and never
 * how loudly.
 */

type Heard = { readonly isFinal: boolean; readonly 0: { readonly transcript: string } }

type Hearing = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { readonly results: ArrayLike<Heard> }) => void) | null
  onerror: ((event: { readonly error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type Recogniser = new () => Hearing

const recogniser = (): Recogniser | undefined => {
  if (typeof globalThis === "undefined") return undefined
  const found = globalThis as { SpeechRecognition?: Recogniser; webkitSpeechRecognition?: Recogniser }
  return found.SpeechRecognition ?? found.webkitSpeechRecognition
}

/** What the recogniser's refusals mean to the person, where they mean anything. */
const SAID: Readonly<Record<string, string>> = {
  "not-allowed": "Dictation needs the microphone. Allow it for this site and try again.",
  "service-not-allowed": "This browser does not offer dictation here.",
  "audio-capture": "No microphone was found.",
  network: "The browser's speech service did not answer."
}

/** The words heard so far, the settled ones and the ones still being guessed at, in order. */
export const spoken = (results: ArrayLike<Heard>): string =>
  Array.from(results, (one) => one[0].transcript)
    .join("")
    .replace(/\s+/g, " ")
    .trim()

/** The text with what was said put after what was there, one space between. */
export const joined = (before: string, said: string): string =>
  said === "" ? before : before === "" || /\s$/.test(before) ? `${before}${said}` : `${before} ${said}`

export type Dictation = {
  /** Whether this browser can hear at all. Without it there is no microphone to draw. */
  readonly can: boolean
  readonly listening: boolean
  /** How long it has listened, for the clock in the pill. */
  readonly seconds: number
  /** The microphone's level now, 0 to 1, read on every frame by the bars rather than rendered. */
  readonly level: () => number
  /** Why it stopped, where it did not stop because it was asked to. */
  readonly wrong: string | undefined
  readonly start: () => void
  readonly stop: () => void
}

export const useDictation = ({
  text,
  onText,
  onDone
}: {
  /** The text as it is now, which the words are put after. */
  readonly text: () => string
  readonly onText: (text: string) => void
  /** It stopped listening, asked or not. */
  readonly onDone: () => void
}): Dictation => {
  const Made = recogniser()
  const [listening, setListening] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [wrong, setWrong] = useState<string>()
  const hearing = useRef<Hearing>(undefined)
  const heard = useRef(0)
  const ears = useRef<{ readonly stream: MediaStream; readonly audio: AudioContext; readonly read: AnalyserNode }>(
    undefined
  )
  const said = useRef({ onText, onDone })
  said.current = { onText, onDone }

  const deafen = useCallback(() => {
    const open = ears.current
    ears.current = undefined
    if (open === undefined) return
    for (const track of open.stream.getTracks()) track.stop()
    void open.audio.close()
  }, [])

  const level = useCallback((): number => {
    const read = ears.current?.read
    if (read === undefined) return heard.current
    const samples = new Float32Array(read.fftSize)
    read.getFloatTimeDomainData(samples)
    heard.current = loudness(samples)
    return heard.current
  }, [])

  const start = useCallback(() => {
    if (Made === undefined || hearing.current !== undefined) return
    const before = text()
    const one = new Made()
    one.continuous = true
    one.interimResults = true
    one.lang = navigator.language
    one.onresult = (event) => said.current.onText(joined(before, spoken(event.results)))
    one.onerror = (event) => {
      const why = SAID[event.error]
      if (why !== undefined) setWrong(why)
    }
    one.onend = () => {
      hearing.current = undefined
      heard.current = 0
      deafen()
      setListening(false)
      said.current.onDone()
    }
    hearing.current = one
    setWrong(undefined)
    setSeconds(0)
    setListening(true)
    one.start()

    // The bars only: dictation goes on without them where the page cannot open the microphone twice.
    const devices = navigator.mediaDevices
    if (devices === undefined) return
    Effect.runFork(
      Effect.tryPromise(() => devices.getUserMedia({ audio: true })).pipe(
        Effect.map((stream) => {
          if (hearing.current !== one) {
            for (const track of stream.getTracks()) track.stop()
            return
          }
          const audio = new AudioContext()
          const read = audio.createAnalyser()
          read.fftSize = 512
          audio.createMediaStreamSource(stream).connect(read)
          ears.current = { stream, audio, read }
        }),
        Effect.ignore
      )
    )
  }, [Made, text, deafen])

  const stop = useCallback(() => hearing.current?.stop(), [])

  useEffect(() => {
    if (!listening) return
    const began = performance.now()
    const tick = setInterval(() => setSeconds(Math.floor((performance.now() - began) / 1000)), 250)
    return () => clearInterval(tick)
  }, [listening])

  useEffect(
    () => () => {
      hearing.current?.abort()
      deafen()
    },
    [deafen]
  )

  return { can: Made !== undefined, listening, seconds, level, wrong, start, stop }
}
