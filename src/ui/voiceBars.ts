/**
 * The bars of a voice, as Ace's composer draws them while it records.
 *
 * Four drifting sine ribbons, each at its own speed and direction, read by every bar at its own
 * place across the row, so the crests travel through the row rather than each bar bouncing
 * alone. A window tapers the row to dots at both ends. The numbers are Ace's (`voice_waves`), so
 * the two boxes move alike.
 */
type Ribbon = {
  readonly waves: number
  readonly speed: number
  readonly phase: number
  readonly gain: number
}

const RIBBONS: ReadonlyArray<Ribbon> = [
  { waves: 1.6, speed: 1.0, phase: 0.0, gain: 1.0 },
  { waves: 2.4, speed: -1.3, phase: 1.7, gain: 0.8 },
  { waves: 3.3, speed: 1.9, phase: 3.1, gain: 0.62 },
  { waves: 4.6, speed: -2.4, phase: 4.4, gain: 0.45 }
]

/** The quietest the ribbons get while it listens: a thin line, so the row never looks dead. */
const FLOOR = 0.06

/** Four ribbons rarely peak together, so their average sits under the tallest one. */
const LIFT = 1.9

/** How fast the bars follow the level, a second: a word lands at once and fades gently. */
const RISE = 48
const FALL = 6

const clamp = (value: number): number => Math.min(1, Math.max(0, value))

/** Zero at both ends of the row, one in the middle. */
const taper = (x: number): number => Math.max(0, Math.sin(Math.PI * x)) ** 1.6

const amplitude = (ribbon: Ribbon, x: number, level: number, phase: number): number => {
  const angle = ribbon.waves * 2 * Math.PI * x + phase * ribbon.speed + ribbon.phase
  // A second, slower sine bends the crest so no two peaks match.
  const body = 0.62 + 0.38 * Math.sin(angle) * Math.cos(0.5 * angle + 1.3)
  return clamp(taper(x) * Math.max(clamp(level), FLOOR) * ribbon.gain * Math.abs(body))
}

/** How tall the bar at `x` (0 to 1 across the row) stands, as a share of the row's height. */
export const bar = (x: number, level: number, phase: number): number => {
  const sum = RIBBONS.reduce((total, ribbon) => total + amplitude(ribbon, x, level, phase), 0)
  const gains = RIBBONS.reduce((total, ribbon) => total + ribbon.gain, 0)
  return clamp((sum / gains) * LIFT)
}

/** The level `seconds` later, on its way to `target`: quick to rise, slow to fall. */
export const smoothed = (current: number, target: number, seconds: number): number => {
  const rate = target > current ? RISE : FALL
  return current + (target - current) * (1 - Math.exp(-rate * seconds))
}

/** How far the ribbons drift in `seconds`: faster the louder the voice. */
export const drifted = (phase: number, level: number, seconds: number): number =>
  phase + seconds * (1.6 + 5 * level)

/**
 * How loud a frame of the microphone is, 0 to 1.
 *
 * The root of the mean square of the samples, which sit between -1 and 1, lifted so speech at
 * an arm's length fills most of the row: a voice is a tenth of full scale or less.
 */
export const loudness = (samples: Float32Array): number => {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return clamp(Math.sqrt(sum / samples.length) * 6)
}
