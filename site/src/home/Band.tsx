import { Atmosphere } from "../Atmosphere"
import { Install } from "../Shell"

/** The last word, and the install button again, on the dark field. */
export const Band = () => (
  <section id="install" className="ace-band">
    <Atmosphere field="band" />
    <h2>Make GitHub quiet.</h2>
    <Install tone="cream" />
  </section>
)
