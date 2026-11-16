/** The crates Rust publishes the documentation of itself, rather than docs.rs. */
const OWN: ReadonlySet<string> = new Set(["std", "core", "alloc", "proc_macro", "test"])

/**
 * Where a name of a crate this repository does not hold is documented.
 *
 * Every crate on crates.io has its documentation built on docs.rs, and the
 * standard library's is Rust's own; both search by name, which is what a press on
 * `Value` or `BTreeMap` is asking. A crate's own page where the name is the crate.
 */
export const rustDocs = (crate: string, name: string): string => {
  const base = OWN.has(crate)
    ? `https://doc.rust-lang.org/${crate}/`
    : `https://docs.rs/${crate}/latest/${crate.replaceAll("-", "_")}/`
  return name === "*" || name === crate ? base : `${base}?search=${encodeURIComponent(name)}`
}

/** The crate a Rust path names, where its first word is one: not `crate`, `self` or `super`. */
export const crateOf = (specifier: string): string | null => {
  const first = specifier.split("::")[0] ?? ""
  return first === "" || first === "crate" || first === "self" || first === "super" ? null : first
}
