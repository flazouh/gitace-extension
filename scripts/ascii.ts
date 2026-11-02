/**
 * Script text with every character past ASCII written as an escape.
 *
 * Chrome refuses a content script that is not valid UTF-8, and a bundle can hold
 * characters that are not: a lone surrogate in a minified regular expression is
 * one, and it cannot be written as UTF-8 at all. An escape means the same thing
 * in a string, a template, a regular expression and an identifier, which is all a
 * bundle puts such a character in. Done on the text before it is written, while a
 * lone surrogate is still itself and not a replacement character.
 */
export const asciiOnly = (code: string): string => {
  let out = ""
  for (let at = 0; at < code.length; at += 1) {
    const unit = code.charCodeAt(at)
    out += unit < 128 ? code[at] : `\\u${unit.toString(16).padStart(4, "0")}`
  }
  return out
}
