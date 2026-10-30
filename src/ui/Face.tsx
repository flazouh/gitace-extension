import { Option } from "effect"

/**
 * An owner's face, or their initial where GitHub gave none.
 *
 * `alt=""` and `aria-hidden` on both: the name is beside them in text, and a screen reader
 * that read the face as well would say every repository twice.
 */
const BADGE_PALETTE: ReadonlyArray<string> = [
  "#f9a825",
  "#e08a68",
  "#8ea7c7",
  "#87b099",
  "#a98ff0",
  "#c59895"
]

const badgeColor = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return BADGE_PALETTE[Math.abs(hash) % BADGE_PALETTE.length] ?? "#f9a825"
}

/** A repository as a letter on its own colour, the mark a row and the Rail give it. */
export const RepoTile = ({ name, big = false }: { readonly name: string; readonly big?: boolean }) => (
  <span
    aria-hidden="true"
    className={big ? "d-rbadge" : "d-sw"}
    style={{ background: badgeColor(name) }}
  >
    {name.slice(0, 1).toUpperCase()}
  </span>
)

export const Face = ({
  faceUrl,
  name,
  big = false,
  pinned = false
}: {
  readonly faceUrl: Option.Option<string>
  readonly name: string
  /** The reader's own face, which is a person and not a repository, so it is a size up. */
  readonly big?: boolean
  /**
   * Marked, for a pinned repository on a Rail too narrow to hold the pin itself.
   *
   * The pin button goes with the width, and without it the pinned repositories at the top
   * of the strip are the same faces as the ones below the rule. A dot on the corner is the
   * cheapest thing that tells them apart at sixteen pixels, and it is the only thing this
   * list has to say about a face other than whose it is.
   */
  readonly pinned?: boolean
}) => {
  const size = big ? "size-5" : "size-4"

  const face = Option.match(faceUrl, {
    onNone: () => (
      <span
        aria-hidden="true"
        style={
          big
            ? { background: "radial-gradient(circle at 30% 25%, #f6e3d4, #e9b79c 55%, #8a5038)", color: "#141413" }
            : { background: badgeColor(name), color: "#141413" }
        }
        className={`grid ${size} shrink-0 place-items-center ${big ? "rounded-full" : "rounded-[4px]"} font-sans text-[9.5px] font-semibold leading-none uppercase`}
      >
        {name.slice(0, 1).toLowerCase()}
      </span>
    ),
    onSome: (url) => (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        // Round for the reader, because that is the shape GitHub gives a person everywhere
        // else on the page; square-ish for the owner beside a repository name.
        className={`${size} shrink-0 ${big ? "rounded-full" : "rounded"}`}
      />
    )
  })

  if (!pinned) return face

  return (
    <span className="relative flex shrink-0">
      {face}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-accent-emphasis"
      />
    </span>
  )
}
