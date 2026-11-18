import { isComposerJson } from "./composer"
import { isGoMod } from "./goModules"
import { isPackageJson } from "./packages"

/**
 * A file the Ledger keeps whole beside the sayings: what a repository says its packages and modules are.
 *
 * None of them is parsed, so no saying carries them, and a bare specifier, a Go import and a PHP
 * class cannot be resolved without them.
 */
export const isConfig = (path: string): boolean => isPackageJson(path) || isGoMod(path) || isComposerJson(path)
