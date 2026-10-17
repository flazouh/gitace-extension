# Landing page copy

Rebuilt 2026-10-16 (ENG-636) in the visual system of useace.dev: GitAce Extension is
one of Ace's products, so the site wears Ace's paper, ink, type and parts. Every
product view is drawn live in code. No picture is loaded by any page.

## Product truths (kept)

- Name: GitAce Extension
- Line: A faster, quieter GitHub
- Not an AI reviewer.
- Chrome, Firefox and Safari. The install button follows the reader's browser
  (`src/stores.ts`): Chrome Web Store, Mozilla's listing, or the latest release for Safari.

## Bar

GitAce Extension is part of Ace: meet the Ace app → https://useace.dev

## Nav

Inbox · Session · Pages | GitAce lockup | GitHub (with the star count) · Install

## Hero

**Headline:** A faster, quieter GitHub

**Chips:** No account · No server · Open source · Not an AI reviewer

**Figure:** 20 — GitHub pages redrawn

**Tag:** Also on Firefox and Safari (names the two browsers the reader is not in)

**Button:** Install for Chrome (or Install for Firefox, Get it for Safari)

**Window:** the inbox, running live from fixtures (`HeroStage`, scene `working-set`).

## Split

**Heading:** Pull requests, filed by what they need.

**Paragraph:** Every pull request you are in, sorted into what needs you, what waits on
someone else, what is still running and what is settled. The next action is the first
thing you see, not the twentieth row of a list.

**Button:** How it reads GitHub (to the layers)

**Plate:** one pull request, running live (scene `pull-request`).

## Layers

| Layer | Says |
| --- | --- |
| Page | Pull requests, code, issues and runs, redrawn |
| Your session | The GitHub sign-in you already have |
| GitHub | github.com, read as you would read it |

**Caption:** Three layers. No server in between.

The top plate is the inbox drawn small in code (`home/MiniInbox.tsx`).

## What it redraws.

| | |
| --- | --- |
| Pull requests | Inbox, review, diffs, checks, merge |
| Code | Repository home, files, blame, commits, compare |
| Issues | Lists, threads, and raising a new one |
| Actions | Runs and their jobs |
| People | Profiles, notifications, discussions, releases |
| Browsers | Chrome, Firefox, Safari |
| Account | None. It runs on your GitHub session |
| License | AGPL-3.0 |

## One of Ace's products.

**Ace:** The native workshop for agents. A desktop app, drawn on the GPU, where your
agents work next to your code. Meta: Desktop app · useace.dev →

**GitAce Extension:** A faster, quieter GitHub, in the browser you already use. The
first piece of GitAce. Meta: Browser extension · You are here

## Band

**Line:** Make GitHub quiet.

**Button:** the install button again.

## Footer

GitHub · Chrome · Firefox · Safari · Ace, the GitAce lockup debossed into the paper,
and: © Ace 2026 · Not affiliated with GitHub

## Colour

GitAce violet, at a strength that passes WCAG AA on what is behind it: `#6d28d9` fills
under white text, `#5b21b6` for violet text on paper, `#c4b5fd` for violet text on the
dark hero and band. `src/contrast.test.ts` checks every pair.

## Banned

Product PNGs or any other picture on a page, a demo video, Ace's grain photograph,
clay as the accent, text on a light part of the atmosphere.
