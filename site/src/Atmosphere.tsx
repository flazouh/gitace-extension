import type { CSSProperties } from "react"
import {
  BAND_NARROW,
  BAND_WIDE,
  GRAIN,
  GRAIN_SVG,
  HERO_COOL,
  HERO_GLOW,
  HERO_GLOW_EDGE,
  HORIZON,
  NIGHT,
  stopsIn
} from "./fields"

/**
 * The dark field the hero, the plate and the band stand on, drawn in CSS.
 *
 * Ace's own site paints this with a photograph of grain; here it is gradients and an
 * SVG noise filter, so the page loads no picture for it. The colours, and the reason
 * each one is as dark as it is, are in `fields.ts`.
 *
 * Still, so reduced motion has nothing to stop. Fills the nearest positioned parent.
 */

type Field = "hero" | "plate" | "band"

const HERO = [
  `radial-gradient(55% 62% at 88% 0%, ${HERO_GLOW} 0%, ${HERO_GLOW_EDGE} 42%, transparent 74%)`,
  `radial-gradient(60% 50% at 6% 80%, ${HERO_COOL} 0%, transparent 70%)`,
  NIGHT
].join(", ")

/* No words on the plate, only a screen, so it can take a brighter glow than the hero. */
const PLATE = [
  `radial-gradient(90% 70% at 82% 14%, #8a5a40 0%, ${HERO_GLOW} 30%, ${HERO_GLOW_EDGE} 55%, transparent 82%)`,
  `radial-gradient(80% 60% at 10% 100%, #2a3550 0%, transparent 70%)`,
  NIGHT
].join(", ")

const FILL: CSSProperties = { position: "absolute", inset: 0, zIndex: -1, overflow: "hidden" }

const Grain = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage: GRAIN_SVG,
      mixBlendMode: "overlay",
      opacity: GRAIN
    }}
  />
)

/** Ace's veil: the hero darkened from the left, where the headline and chips sit. */
const Veil = () => (
  <div
    style={{
      position: "absolute",
      insetInline: 0,
      top: 0,
      height: 640,
      pointerEvents: "none",
      background: `linear-gradient(90deg, ${NIGHT}cc 0%, ${NIGHT}9e 38%, ${NIGHT}40 62%, ${NIGHT}00 82%)`,
      maskImage: "linear-gradient(#000 0% 62%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(#000 0% 62%, transparent 100%)"
    }}
  />
)

/** The cream curve the window rests on, lit blue from behind. */
const Horizon = () => (
  <div
    style={{
      position: "absolute",
      top: "calc(100% - 300px)",
      left: "-20%",
      right: "-20%",
      height: 900,
      borderRadius: "50%",
      background: `radial-gradient(at 50% 0, ${HORIZON[0]} 0%, ${HORIZON[1]} 40%, ${HORIZON[2]} 100%)`,
      boxShadow: "0 -30px 80px #a0bef08c, 0 -6px 24px #fff9, inset 0 30px 60px #ffffffb3"
    }}
  />
)

export const Atmosphere = ({ field }: { readonly field: Field }) => {
  if (field === "band") {
    return (
      <div
        aria-hidden
        className="ace-field-band"
        style={
          {
            ...FILL,
            "--band-wide": `linear-gradient(100deg, ${stopsIn(BAND_WIDE)})`,
            "--band-narrow": `linear-gradient(172deg, ${stopsIn(BAND_NARROW)})`
          } as CSSProperties
        }
      >
        <Grain />
      </div>
    )
  }

  return (
    <div aria-hidden style={{ ...FILL, background: field === "hero" ? HERO : PLATE }}>
      {field === "hero" ? <Veil /> : null}
      <Grain />
      {field === "hero" ? <Horizon /> : null}
    </div>
  )
}
