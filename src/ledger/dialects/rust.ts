/**
 * What Rust is, said in node types.
 *
 * Block-scoped, like Go and unlike Python, and with more places that open a
 * scope than either: a `match` arm binds the names its pattern names, an `if
 * let` binds for the length of its branch, and a closure binds its parameters.
 * Each of those is a scope a reader can see the edge of, and a resolver that
 * missed one would answer a name inside it with whatever the file declared
 * outside — which is the one failure worth more than all the others put
 * together.
 *
 * `impl Box` is a scope of its own rather than part of `Box`. A method is
 * written inside it and the type is written elsewhere, so a type's methods are
 * not reachable from the type in the way a class's are — the outline offers each
 * `impl` block where it stands, which is where a reader is looking for it.
 *
 * A Rust path is not a file path: what the file borrowed is recorded as the path
 * it wrote, and `src/ledger/reaching.ts` says which files a path could be. A name
 * written after a path, `crate::a::B` or `B::new`, is read through it.
 */

import type { Borrowed, Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, kindFrom, namesUnder, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * `match_arm` and `if_expression` are the two worth naming: both bind through a
 * pattern rather than through a declaration, and both hold what they bind to one
 * branch. `let_declaration` is not here — a `let` binds into the block around it
 * and a second `let` of the same name shadows the first, which is the ordinary
 * rule this walk already applies by keeping the first of a spelling in a scope.
 */
const OPENS: ReadonlySet<string> = new Set([
  "source_file",
  "function_item",
  // A signature with no body is still a scope: it binds its parameters and its
  // generics exactly as a function with one does. The same rule TypeScript's
  // `function_signature` is here for.
  "function_signature_item",
  "closure_expression",
  "block",
  "for_expression",
  "while_expression",
  "loop_expression",
  "if_expression",
  "match_arm",
  "impl_item",
  "trait_item",
  "struct_item",
  "enum_item",
  "union_item",
  "mod_item"
])

/**
 * The node types that are a name being read.
 *
 * `field_identifier` is not one, for the reason it is not one in Go: a field is
 * reached through the thing that holds it. `primitive_type` is not one either —
 * `i32` is a keyword wearing a type's clothes, and there is nowhere to follow it
 * to.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "type_identifier", "shorthand_field_identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const KINDS: Readonly<Record<string, WritingKind>> = {
  function_item: "function",
  function_signature_item: "function",
  closure_expression: "function",
  struct_item: "type",
  enum_item: "type",
  trait_item: "type",
  union_item: "type",
  type_item: "type",
  parameter: "parameter",
  type_parameter: "parameter",
  use_declaration: "import"
}

const kindOf = kindFrom(KINDS)

/**
 * A pattern's names, which is one identifier or a nest of them.
 *
 * `let (a, b) = ...`, `Some(v)`, `Point { x, y }` and `[first, ..]` all bind
 * through shapes that hold shapes, so this is recursive for the same reason
 * every other one here is.
 *
 * A `scoped_identifier` inside a pattern binds nothing: the `Some` of `Some(v)`
 * names a variant that exists elsewhere, and only what it holds is written down
 * here. Which is why a tuple struct pattern is walked for its own children
 * rather than taken whole.
 */
const boundBy = namesUnder(
  // `ResolvedCut::At { documents, .. }` binds `documents`, spelled as the field it reads.
  new Set(["identifier", "shorthand_field_identifier"]),
  new Set([
    "tuple_pattern",
    "tuple_struct_pattern",
    "struct_pattern",
    "slice_pattern",
    "ref_pattern",
    "mut_pattern",
    "or_pattern",
    "reference_pattern",
    "field_pattern",
    "captured_pattern"
  ])
)

/**
 * What one `use` tree brings into the file, and where each name came from.
 *
 * `use a::b::C` binds `C` and says it came from `a::b`, which is the split every
 * Borrowed is: the last segment is the name the other module writes, and what
 * comes before it is where. `use a::b::C as D` binds `D` and says the same
 * about `C`. `use a::{b, c}` is a prefix and a list, and each member of the list
 * is read against that prefix.
 */
const splitOf = (path: Syntax): { readonly name: Syntax; readonly from: string } | null => {
  if (path.type === "identifier" || path.type === "type_identifier") {
    return { name: path, from: "" }
  }
  if (path.type !== "scoped_identifier") return null
  const last = path.childForFieldName("name")
  const prefix = path.childForFieldName("path")
  if (last === null) return null
  return { name: last, from: prefix === null ? "" : prefix.text }
}

/** Every name one `use` tree brings in, read against the prefix it sits under. */
const used = function* (node: Syntax, under: string): Generator<Bound> {
  const joined = (from: string): string =>
    under === "" ? from : from === "" ? under : `${under}::${from}`

  if (node.type === "use_as_clause") {
    const alias = node.childForFieldName("alias")
    const what = node.childForFieldName("path")
    if (alias === null || what === null) return
    const split = splitOf(what)
    // `use ori_agent_protocol as wire` names a crate, and binds the whole of it.
    if (under === "" && split !== null && split.from === "" && what.type === "identifier") {
      yield { name: alias, kind: "import", from: { name: "*", specifier: what.text } }
      return
    }
    yield {
      name: alias,
      kind: "import",
      from: {
        name: split === null ? what.text : split.name.text,
        specifier: joined(split === null ? "" : split.from)
      }
    }
    return
  }

  if (node.type === "scoped_use_list" || node.type === "use_list") {
    const prefix = node.childForFieldName("path")
    const list = node.childForFieldName("list") ?? (node.type === "use_list" ? node : null)
    const deeper = joined(prefix === null ? "" : prefix.text)
    if (list === null) return
    for (const one of childrenOf(list)) yield* used(one, deeper)
    return
  }

  if (node.type === "use_wildcard") {
    return
  }

  const split = splitOf(node)
  if (split === null) return
  yield {
    name: split.name,
    kind: "import",
    from: { name: split.name.text, specifier: joined(split.from) }
  }
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_item":
    case "function_signature_item":
    case "struct_item":
    case "enum_item":
    case "trait_item":
    case "union_item":
    case "type_item":
    case "const_item":
    case "static_item":
    case "macro_definition":
    case "mod_item": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "let_declaration": {
      const value = node.childForFieldName("value")
      const written =
        value !== null && value.type === "closure_expression" ? "function" : "value"
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        outer.push({ name, kind: written })
      }
      break
    }
    case "parameters":
    case "closure_parameters": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the function, and the function is the scope.
      for (const parameter of childrenOf(node)) {
        if (parameter.type === "self_parameter") continue
        const pattern = parameter.childForFieldName("pattern")
        for (const name of boundBy(pattern ?? parameter)) {
          outer.push({ name, kind: "parameter" })
        }
      }
      break
    }
    case "type_parameters": {
      for (const parameter of childrenOf(node)) {
        if (parameter.type === "type_identifier") {
          outer.push({ name: parameter, kind: "parameter" })
          continue
        }
        // `T: Clone` is a `type_parameter` with a `trait_bounds` child, not a
        // `constrained_type_parameter` — there is no such node in this grammar,
        // and neither shape has a `left` field, so that branch bound nothing.
        // `const N: usize` is its own node and was missed entirely.
        if (parameter.type === "const_parameter") {
          for (const child of childrenOf(parameter)) {
            if (child.type === "identifier") {
              outer.push({ name: child, kind: "parameter" })
              break
            }
          }
          continue
        }
        if (parameter.type !== "type_parameter") continue
        const name = parameter.namedChild(0)
        if (name !== null && name.type === "type_identifier") {
          outer.push({ name, kind: "parameter" })
        }
      }
      break
    }
    case "for_expression": {
      // Inward: a Rust loop variable belongs to the loop and is gone after it,
      // which is the opposite of Python and the same as `let`.
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        inner.push({ name, kind: "value" })
      }
      break
    }
    case "let_condition": {
      // `if let Some(v) = maybe()`. The `if_expression` around it is the scope,
      // and this node sits inside it, so outward is into that branch.
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        outer.push({ name, kind: "value" })
      }
      break
    }
    case "match_arm": {
      const pattern = node.childForFieldName("pattern")
      for (const name of boundBy(pattern)) inner.push({ name, kind: "value" })
      // A bare `n => n` is a pattern that is one identifier, which `boundBy`
      // reaches only through the `match_pattern` that wraps it.
      if (pattern !== null && pattern.type === "match_pattern") {
        for (const child of childrenOf(pattern)) {
          for (const name of boundBy(child)) inner.push({ name, kind: "value" })
        }
      }
      break
    }
    case "use_declaration": {
      const argument = node.childForFieldName("argument")
      // Under nothing: the argument is the whole path, and `used` splits it.
      if (argument !== null) outer.push(...used(argument, ""))
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["block", "closure_expression"])

/**
 * The members a type or an `impl` offers, or nothing where this is neither.
 *
 * A struct's fields, an enum's variants, and the functions written in a `trait`
 * or an `impl`. An `impl` is where a type's methods actually live in Rust, so
 * this is the only way the outline offers them at all.
 */
/** The node types that hold members, checked before any field is asked for. */
const HOLDS_MEMBERS: ReadonlySet<string> = new Set([
  "struct_item",
  "union_item",
  "enum_item",
  "impl_item",
  "trait_item"
])

/** The fields a struct or a struct-like variant declares, in order. */
const fieldsOf = (body: Syntax): ReadonlyArray<Bound> => {
  const members: Array<Bound> = []
  for (const field of childrenOf(body)) {
    for (const part of childrenOf(field)) {
      if (part.type === "field_identifier") members.push({ name: part, kind: "member" })
    }
  }
  return members
}

const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  // The type first: this is asked of every node in the file, and a field lookup
  // is a call across the WebAssembly boundary.
  if (!HOLDS_MEMBERS.has(node.type)) return null
  const body = node.childForFieldName("body")
  if (body === null) return null

  if (node.type === "struct_item" || node.type === "union_item") return fieldsOf(body)
  if (node.type === "enum_item") {
    const members: Array<Bound> = []
    for (const variant of childrenOf(body)) {
      if (variant.type !== "enum_variant") continue
      const name = variant.childForFieldName("name") ?? variant.namedChild(0)
      if (name !== null) members.push({ name, kind: "member" })
    }
    return members
  }
  if (node.type === "impl_item" || node.type === "trait_item") {
    const members: Array<Bound> = []
    for (const one of childrenOf(body)) {
      if (
        one.type !== "function_item" &&
        one.type !== "function_signature_item" &&
        one.type !== "const_item" &&
        one.type !== "type_item"
      ) {
        continue
      }
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
    }
    return members
  }
  return null
}

/** Rust, as one vocabulary. */
/**
 * The node types that are a comment.
 *
 * Three, where most grammars have one. `///` is a `doc_comment` and is exactly what a reader wants on the card, so missing these meant Rust had no documentation at all.
 */
const COMMENTS: ReadonlySet<string> = new Set(["line_comment", "block_comment", "doc_comment"])

/**
 * What a node offers the outline: its members, nothing, or no answer.
 *
 * A body answers `working`, which ends the walk there and is what keeps a local
 * out of the outline. See {@link Dialect.offering}.
 */
const offering = (node: Syntax): Offering | null => {
  if (BODIES.has(node.type)) return { at: "working" }
  // Reached only by a press on one of them: the outline stops at the enum.
  if (node.type === "enum_variant") {
    const body = node.childForFieldName("body")
    return body === null || body.type !== "field_declaration_list" ? null : { at: "members", members: fieldsOf(body) }
  }
  const members = membersFor(node)
  return members === null ? null : { at: "members", members }
}

/**
 * The modules a `use` takes whole: `use protocol::*`, and `use a::{b::*, C}`.
 *
 * A test file's `use super::*` and a crate's `use common::*` bring in every name
 * the module offers and name none of them, so a name such a file never binds is
 * looked for in each, the way C++ looks in what it includes.
 */
const passedOn = function* (statement: Syntax): Generator<Borrowed> {
  if (statement.type !== "use_declaration") return
  const argument = statement.childForFieldName("argument")
  if (argument !== null) yield* wildcards(argument, "")
}

const wildcards = function* (node: Syntax, under: string): Generator<Borrowed> {
  const joined = (more: string): string => (under === "" ? more : more === "" ? under : `${under}::${more}`)
  if (node.type === "use_wildcard") {
    const from = node.namedChild(0)
    yield { name: "*", specifier: joined(from === null ? "" : from.text) }
    return
  }
  if (node.type !== "scoped_use_list" && node.type !== "use_list") return
  const prefix = node.childForFieldName("path")
  const list = node.childForFieldName("list") ?? (node.type === "use_list" ? node : null)
  if (list === null) return
  for (const one of childrenOf(list)) yield* wildcards(one, joined(prefix === null ? "" : prefix.text))
}

/** The node types a Rust path is written with, `a::b::C` in an expression and in a type. */
const SCOPED: ReadonlySet<string> = new Set(["scoped_identifier", "scoped_type_identifier"])

/** Whether two nodes are the same one, which a node handed back by a field is not by identity. */
const same = (one: Syntax | null, other: Syntax): boolean =>
  one !== null &&
  one.startPosition.row === other.startPosition.row &&
  one.startPosition.column === other.startPosition.column &&
  one.endPosition.column === other.endPosition.column

/** The name of the type an `impl` around the name is for, which is what `Self` and `self.` mean. */
const ownType = (path: ReadonlyArray<Syntax>): string | null => {
  for (let step = path.length - 1; step >= 0; step--) {
    const node = path[step]
    if (node?.type === "impl_item") return holderOf(node)
  }
  return null
}

/** The type a node holds the members of. See {@link Dialect.holderOf}. */
const holderOf = (node: Syntax): string | null => {
  if (node.type === "impl_item") {
    let type = node.childForFieldName("type")
    if (type?.type === "generic_type") type = type.childForFieldName("type")
    if (type?.type === "scoped_type_identifier") type = type.childForFieldName("name")
    return type?.type === "type_identifier" ? type.text : null
  }
  if (HOLDS_MEMBERS.has(node.type) || node.type === "enum_variant") return node.childForFieldName("name")?.text ?? null
  return null
}

/** A path's segments, or nothing where one of them is not a plain name: `<T as Trait>::f`. */
const segmentsOf = (node: Syntax, path: ReadonlyArray<Syntax>): ReadonlyArray<string> | null => {
  if (SCOPED.has(node.type)) {
    const before = node.childForFieldName("path")
    const last = node.childForFieldName("name")
    if (last === null) return null
    const head = before === null ? [] : segmentsOf(before, path)
    return head === null ? null : [...head, last.text]
  }
  if (node.type === "generic_type") {
    const type = node.childForFieldName("type")
    return type === null ? null : segmentsOf(type, path)
  }
  if (node.text === "Self") {
    const own = ownType(path)
    return own === null ? null : [own]
  }
  if (["identifier", "type_identifier", "crate", "self", "super"].includes(node.type)) return [node.text]
  return null
}

/**
 * The path a name is read through. See {@link Dialect.pathOf}.
 *
 * `self.messages` and `self.start()` are read through the type of the `impl` they
 * are written in, which is the one receiver whose type a file says outright.
 */
const pathOf = (path: ReadonlyArray<Syntax>): ReadonlyArray<string> | null => {
  const name = path.at(-1)
  const above = path.at(-2)
  if (name === undefined || above === undefined) return null
  if (SCOPED.has(above.type)) {
    const before = above.childForFieldName("path")
    if (same(above.childForFieldName("name"), name)) {
      const through = before === null ? null : segmentsOf(before, path)
      // `Box::new` is the standard library's, the way `Box` alone is.
      return through !== null && PRELUDE.has(through[0] ?? "") ? ["std", ...through] : through
    }
    return same(before, name) && name.type === "identifier" ? [] : null
  }
  if (above.type === "scoped_use_list" || above.type === "use_wildcard" || above.type === "use_as_clause") {
    const before = above.type === "use_wildcard" ? above.namedChild(0) : above.childForFieldName("path")
    return same(before, name) && name.type === "identifier" ? [] : null
  }
  // `SeedMessage::User { author: … }`: a field named in a literal is the literal's type's.
  if (above.type === "field_initializer" && same(above.childForFieldName("field"), name)) {
    const literal = path.at(-4)
    const type = literal?.type === "struct_expression" ? literal.childForFieldName("name") : null
    return type === null ? null : segmentsOf(type, path)
  }
  if (above.type === "field_expression" && same(above.childForFieldName("field"), name)) {
    if (above.childForFieldName("value")?.type !== "self") return null
    const own = ownType(path)
    return own === null ? null : [own]
  }
  if (above.type === "token_tree") return tokenPathOf(above, name, path)
  return null
}

/** What is written between two tokens of a tree on one line, which the grammar names no node for. */
const between = (tree: Syntax, one: Syntax, other: Syntax): string | null => {
  const row = one.endPosition.row
  if (other.startPosition.row !== row) return null
  const line = tree.text.split("\n")[row - tree.startPosition.row] ?? ""
  const shift = row === tree.startPosition.row ? tree.startPosition.column : 0
  return line.slice(one.endPosition.column - shift, other.startPosition.column - shift)
}

/** The names a path is spelt with, among the tokens a macro is handed. */
const SEGMENT: ReadonlySet<string> = new Set(["identifier", "crate", "self", "super"])

/**
 * The path a name handed to a macro is read through: `Message::user` in `vec![Message::user(…)]`.
 *
 * A macro's arguments are tokens until it is expanded, so the grammar writes no path
 * there. The segments are the names before it joined by `::`, as a parsed path's
 * are; without them the name was read as the bare word, and a local of that
 * spelling answered for a type's function.
 */
const tokenPathOf = (tree: Syntax, name: Syntax, path: ReadonlyArray<Syntax>): ReadonlyArray<string> | null => {
  const tokens = [...childrenOf(tree)]
  const at = tokens.findIndex((token) => same(token, name))
  if (at === -1) return null
  const joins = (one: Syntax | undefined, other: Syntax | undefined): boolean =>
    one !== undefined && other !== undefined && SEGMENT.has(one.type) && between(tree, one, other) === "::"
  const segments: Array<string> = []
  for (let step = at; joins(tokens[step - 1], tokens[step]); step--) segments.unshift(tokens[step - 1]!.text)
  if (segments.length === 0) return name.type === "identifier" && joins(name, tokens[at + 1]) ? [] : null
  if (segments[0] === "Self") {
    const own = ownType(path)
    return own === null ? null : [own, ...segments.slice(1)]
  }
  return PRELUDE.has(segments[0]!) ? ["std", ...segments] : segments
}

/**
 * The types a macro called among a file's items writes. See {@link Dialect.minted}.
 *
 * What a macro does with its arguments takes expanding it to know; a capitalised
 * name handed to one at the top of a module is, by Rust's convention, a type it
 * defines, as `define_id!(ItemId)` does.
 */
const minted = (node: Syntax): ReadonlyArray<Bound> => {
  if (node.type !== "macro_invocation") return []
  const given = childrenOf(node).find((child) => child.type === "token_tree")
  if (given === undefined) return []
  return [...childrenOf(given)]
    .filter((child) => child.type === "identifier" && /^[A-Z]/u.test(child.text))
    .map((name) => ({ name, kind: "type" as const }))
}

/** What every Rust file can name without a `use`: the prelude's types, traits and variants. */
const PRELUDE: ReadonlySet<string> = new Set([
  "Box", "String", "Vec", "Option", "Some", "None", "Result", "Ok", "Err",
  "Clone", "Copy", "Debug", "Default", "PartialEq", "Eq", "PartialOrd", "Ord", "Hash",
  "Send", "Sync", "Sized", "Unpin", "Drop", "Fn", "FnMut", "FnOnce",
  "Iterator", "IntoIterator", "DoubleEndedIterator", "ExactSizeIterator", "Extend",
  "From", "Into", "TryFrom", "TryInto", "AsRef", "AsMut", "ToString", "ToOwned"
])

/** The standard library's macros, which no file declares. */
const MACROS: ReadonlySet<string> = new Set([
  "assert", "assert_eq", "assert_ne", "debug_assert", "debug_assert_eq", "debug_assert_ne",
  "println", "print", "eprintln", "eprint", "format", "format_args", "write", "writeln",
  "vec", "panic", "todo", "unimplemented", "unreachable", "matches", "dbg", "concat",
  "stringify", "include_str", "include_bytes", "env", "option_env", "cfg", "line", "file",
  "column", "module_path", "compile_error", "thread_local"
])

/** The attributes the compiler itself reads. */
const ATTRIBUTES: ReadonlySet<string> = new Set([
  "derive", "cfg", "cfg_attr", "test", "allow", "warn", "deny", "forbid", "expect", "must_use",
  "inline", "doc", "repr", "non_exhaustive", "deprecated", "path", "macro_export", "track_caller"
])

/**
 * The standard library's methods a value is most often asked for, `.clone()` and
 * `.unwrap()`. Read through a value, a name is answered by its spelling alone, and
 * the repository's own `map` is rarely the `map` an iterator was asked for.
 */
const METHODS: ReadonlySet<string> = new Set([
  "clone", "to_owned", "to_string", "into", "try_into", "as_ref", "as_mut", "as_str", "as_slice",
  "unwrap", "expect", "unwrap_or", "unwrap_or_default", "unwrap_or_else", "ok", "err", "ok_or",
  "ok_or_else", "and_then", "or_else", "is_some", "is_none", "is_ok", "is_err", "map_err",
  "iter", "iter_mut", "into_iter", "map", "filter", "filter_map", "find", "any", "all", "collect",
  "next", "take", "skip", "chain", "zip", "enumerate", "rev", "count", "sum", "fold", "flat_map",
  "len", "is_empty", "push", "pop", "get", "get_mut", "insert", "remove", "contains", "contains_key",
  "extend", "entry", "or_insert", "or_default", "join", "split", "trim", "starts_with", "ends_with",
  "parse", "lock", "read", "write", "await"
])

/** The attribute a name is written in, where it is in one, and whether it is its own path. */
const attributeOf = (path: ReadonlyArray<Syntax>): { readonly path: string; readonly own: boolean } | null => {
  const name = path.at(-1)
  for (let step = path.length - 2; step >= Math.max(0, path.length - 4); step--) {
    const node = path[step]
    if (node?.type !== "attribute") continue
    const own = node.namedChild(0)
    if (own === null || name === undefined) return null
    return { path: own.text, own: same(own, name) }
  }
  return null
}

/** The library a name no scope binds is from. See {@link Dialect.preludeOf}. */
const preludeOf = (path: ReadonlyArray<Syntax>): string | null => {
  const name = path.at(-1)
  const above = path.at(-2)
  // `default` in `#[serde(default)]` is a keyword, and the node under it the whole `(default)`.
  if (name === undefined || name.type === "token_tree") return null
  if (above?.type === "macro_invocation" && same(above.childForFieldName("macro"), name)) {
    return MACROS.has(name.text) ? "std" : null
  }
  const attribute = attributeOf(path)
  if (attribute !== null) {
    const crate = attribute.path.split("::")[0] ?? ""
    if (attribute.own) return ATTRIBUTES.has(attribute.path) ? "std" : crate
    if (attribute.path === "derive") return PRELUDE.has(name.text) ? "std" : null
    return ATTRIBUTES.has(attribute.path) ? "std" : crate
  }
  if (above?.type === "field_expression" && same(above.childForFieldName("field"), name)) {
    return METHODS.has(name.text) ? "std" : null
  }
  return NAMES.has(name.type) && PRELUDE.has(name.text) ? "std" : null
}

/** Whether a name no scope binds may have come in with a module taken whole. Any plain name may. */
const looksWhole = (name: Syntax): boolean => NAMES.has(name.type)

export const RUST: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  comments: COMMENTS,
  offering,
  passedOn,
  passesOnWhole: true,
  looksWhole,
  pathOf,
  minted,
  holderOf,
  preludeOf
}
