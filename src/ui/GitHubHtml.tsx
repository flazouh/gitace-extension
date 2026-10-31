/**
 * GitHub's HTML, for the two payloads that still do not carry the markdown.
 *
 * The README on a repository home and a commit message body arrive already
 * rendered. Everything else on this interface is parsed by `Markdown`.
 */
export const GitHubHtml = ({ html }: { readonly html: string }) => (
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
)

/**
 * A commit message's body, which GitHub sends as plain text with its links made.
 *
 * Its lines are the author's — a list, a trailer, a paragraph break — and HTML would run them into
 * one paragraph, so they are kept as GitHub's own commit page keeps them.
 */
export const CommitMessage = ({ html }: { readonly html: string }) => (
  <div className="markdown-body whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: html.trim() }} />
)
