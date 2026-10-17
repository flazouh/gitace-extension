import { Band } from "./home/Band"
import { Family } from "./home/Family"
import { Hero } from "./home/Hero"
import { Layers } from "./home/Layers"
import { Specs } from "./home/Specs"
import { Split } from "./home/Split"
import { Footer, Masthead, SkipTo } from "./Shell"

/**
 * The home page, in the shape of useace.dev's: the bar, the nav, a dark hero with the
 * product running in a tilted window, then the split, the layers, the spec table, the
 * family, the band and the footer.
 *
 * Every product view on it is drawn by code: two of the extension's own screens running
 * from fixtures, and a small inbox drawn by hand for the layers. No picture is loaded.
 * The words are in `site/COPY.md`.
 */
export const Page = () => (
  <div className="ace min-h-dvh antialiased">
    <SkipTo id="product" says="Skip to the product" />
    <Masthead over="top" />

    <main>
      <Hero />
      <Split />
      <Layers />
      <Specs />
      <Family />
      <Band />
    </main>

    <Footer />
  </div>
)
