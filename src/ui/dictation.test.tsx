import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { joined, spoken } from "./useDictation"
import { Send } from "./Send"
import { Writing } from "./Writing"
import { VOICE } from "./keeping"

/** The browser's recogniser, played by the test: it hears what the test says it heard. */
class Heard {
  static last: Heard | undefined
  continuous = false
  interimResults = false
  lang = ""
  onresult: ((event: { results: ArrayLike<unknown> }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  constructor() {
    Heard.last = this
  }
  start() {
    this.started = true
  }
  stop() {
    this.onend?.()
  }
  abort() {}
  say(...parts: ReadonlyArray<string>) {
    this.onresult?.({ results: parts.map((transcript) => ({ isFinal: true, 0: { transcript } })) })
  }
}

const ears = globalThis as { webkitSpeechRecognition?: unknown }

beforeEach(() => {
  ears.webkitSpeechRecognition = Heard
  Heard.last = undefined
  localStorage.removeItem(VOICE)
})

afterEach(() => {
  cleanup()
  delete ears.webkitSpeechRecognition
})

const Box = ({ start = "", onSent = () => {} }: { readonly start?: string; readonly onSent?: (text: string) => void }) => {
  const [text, setText] = useState(start)
  return (
    <>
      <Writing
        text={text}
        onText={setText}
        placeholder="Say something"
        onEscape={() => {}}
        onSend={() => onSent(text)}
        dictation
        send={
          <Send onSend={() => onSent(text)} disabled={text.trim() === ""}>
            Comment
          </Send>
        }
      />
      <output>{text}</output>
    </>
  )
}

describe("the words heard", () => {
  test("join into one line, the settled and the still-guessed alike", () => {
    const results = [{ isFinal: true, 0: { transcript: "fix the" } }, { isFinal: false, 0: { transcript: "  retry  loop" } }]
    expect(spoken(results)).toBe("fix the retry loop")
  })

  test("go after what was there, one space between", () => {
    expect(joined("Looks good.", "Ship it")).toBe("Looks good. Ship it")
    expect(joined("Looks good. ", "Ship it")).toBe("Looks good. Ship it")
    expect(joined("", "Ship it")).toBe("Ship it")
    expect(joined("Looks good.", "")).toBe("Looks good.")
  })
})

describe("the writing box, as Ace's composer", () => {
  test("draws no microphone unless the surface asks for one", () => {
    render(<Writing text="" onText={() => {}} placeholder="Say something" onEscape={() => {}} onSend={() => {}} />)
    expect(screen.queryByRole("button", { name: "Dictate" })).toBeNull()
  })

  test("holds its Send at the foot of its own controls", () => {
    render(<Box />)
    const send = screen.getByRole("button", { name: "Comment" })
    expect(send.closest(".t-composer")).not.toBeNull()
    expect(send.closest(".t-composer-tools")).not.toBeNull()
  })

  test("draws no microphone where the browser cannot hear", () => {
    delete ears.webkitSpeechRecognition
    render(<Box />)
    expect(screen.queryByRole("button", { name: "Dictate" })).toBeNull()
  })

  test("puts what is said after what was typed, as it is heard", async () => {
    render(<Box start="Looks good." />)
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))

    expect(Heard.last?.started).toBe(true)
    act(() => Heard.last?.say("ship it"))

    expect(screen.getByRole("status").textContent).toBe("Looks good. ship it")
  })

  test("becomes the recording pill while it listens, and a press stops it", async () => {
    render(<Box />)
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))

    const pill = screen.getByRole("button", { name: "Stop dictating" })
    expect(pill.hasAttribute("data-listening")).toBe(true)
    expect(pill.textContent).toContain("0:00")
    expect((screen.getByRole("button", { name: "Microphone" }) as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(pill)
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined()
  })

  test("sends what was said the moment it stops, when asked to", async () => {
    const sent: Array<string> = []
    render(<Box onSent={(text) => sent.push(text)} />)
    await userEvent.click(screen.getByRole("button", { name: "Microphone" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Send when recording stops" }))

    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))
    act(() => Heard.last?.say("ship it"))
    await userEvent.click(screen.getByRole("button", { name: "Stop dictating" }))

    expect(sent).toEqual(["ship it"])
    expect(JSON.parse(localStorage.getItem(VOICE) ?? "{}")).toEqual({ hold: false, send: true })
  })

  test("listens only while held, with Hold to record on", async () => {
    localStorage.setItem(VOICE, JSON.stringify({ hold: true, send: false }))
    render(<Box />)
    const mic = screen.getByRole("button", { name: "Dictate" })
    const hand = userEvent.setup()

    await hand.pointer({ keys: "[MouseLeft>]", target: mic })
    expect(screen.getByRole("button", { name: "Stop dictating" })).toBeDefined()

    await hand.pointer({ keys: "[/MouseLeft]", target: screen.getByRole("button", { name: "Stop dictating" }) })
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined()
  })

  test("asks for the microphone once, starting the recogniser only once it is allowed", async () => {
    let allow: (stream: MediaStream) => void = () => {}
    const asked = new Promise<MediaStream>((resolve) => (allow = resolve))
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: () => asked }, configurable: true })
    const audio = globalThis as { AudioContext?: unknown }
    audio.AudioContext = class {
      createAnalyser() {
        return { fftSize: 0, getFloatTimeDomainData() {} }
      }
      createMediaStreamSource() {
        return { connect() {} }
      }
      close() {
        return Promise.resolve()
      }
    }
    render(<Box />)
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))
    expect(Heard.last?.started).toBe(false)

    await act(async () => {
      allow({ getTracks: () => [] } as unknown as MediaStream)
      await asked
    })
    expect(Heard.last?.started).toBe(true)
    delete (navigator as { mediaDevices?: unknown }).mediaDevices
    delete audio.AudioContext
  })

  test("says so where the microphone is refused, and never starts the recogniser", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.reject(new Error("NotAllowedError")) },
      configurable: true
    })
    render(<Box />)
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))

    expect(await screen.findByText(/Dictation needs the microphone/)).toBeDefined()
    expect(Heard.last?.started).toBe(false)
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDefined()
    delete (navigator as { mediaDevices?: unknown }).mediaDevices
  })

  test("says why it stopped, where the browser refused", async () => {
    render(<Box />)
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }))
    act(() => {
      Heard.last?.onerror?.({ error: "not-allowed" })
      Heard.last?.onend?.()
    })

    expect(screen.getByText(/Dictation needs the microphone/)).toBeDefined()
  })
})
