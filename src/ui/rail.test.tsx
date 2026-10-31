import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Option } from "effect";
import type { Destination } from "../domain/Settings";
import type { RepositoryAtWork } from "../domain/rail";
import { sittingsIn } from "../domain/sittings";
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet";
import { Rail } from "./Rail";
import { WorkingSetScreen } from "./WorkingSetScreen";

afterEach(cleanup);

const at = (
  repo: string,
  count: number,
  needsYou: number,
): RepositoryAtWork => ({
  owner: "flazouh",
  repo,
  name: repo,
  count,
  needsYou,
});

const showing = (
  over: {
    atWork?: ReadonlyArray<RepositoryAtWork>;
    pinned?: ReadonlyArray<string>;
    onPinned?: (pinned: ReadonlyArray<string>) => void;
    chosen?: ReadonlyArray<string>;
    onChoose?: (address: string) => void;
  } = {},
) =>
  render(
    <Rail
      pinned={over.pinned}
      onPinned={over.onPinned}
      atWork={over.atWork ?? []}
      chosen={over.chosen}
      onChoose={over.onChoose}
    />,
  );

const rail = () => screen.getByRole("navigation", { name: "Your repositories" });

/**
 * Home's left column, which narrows the list to the repositories a reader goes to.
 *
 * The Destinations are the global rail's and the searching is the header's and the palette's,
 * so the tests below are about what a press here does to the list beside it.
 */
describe("the Rail", () => {
  test("holds no Destinations, which are the global rail's", () => {
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(within(rail()).queryByRole("button", { name: /Working Set|Activity/ })).toBeNull();
  });

  test("offers no filter of its own: the header's filter and the palette already search", () => {
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("lists the repositories the reader's work is in, in the order given", () => {
    showing({ atWork: [at("octo-repo", 3, 2), at("githubpro", 1, 0)] });

    const rows = within(
      screen.getByRole("list", { name: "Repositories you are working in" }),
    ).getAllByRole("link");

    // By address rather than by text: the letter standing in for a missing face is in the
    // text content and is nothing a reader is being asked to read.
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flazouh/octo-repo/pulls",
      "/flazouh/githubpro/pulls",
    ]);
  });

  test("narrows the list to a repository on a press, rather than leaving Home", async () => {
    const person = userEvent.setup();
    const chose: Array<string> = [];
    showing({ atWork: [at("octo-repo", 3, 2)], onChoose: (address) => chose.push(address) });

    await person.click(screen.getByRole("link", { name: /octo-repo/ }));

    expect(chose).toEqual(["flazouh/octo-repo"]);
  });

  test("keeps that press from the screen's own link handling, which would leave Home", async () => {
    const person = userEvent.setup();
    const { container } = showing({ atWork: [at("octo-repo", 3, 2)], onChoose: () => undefined });
    let reached = 0;
    container.addEventListener("click", () => (reached += 1));

    await person.click(screen.getByRole("link", { name: /octo-repo/ }));

    expect(reached).toBe(0);
  });

  test("marks the repository the list is narrowed to", () => {
    showing({ atWork: [at("octo-repo", 3, 2), at("lumen", 1, 0)], chosen: ["flazouh/octo-repo"] });

    expect(screen.getByRole("link", { current: true }).getAttribute("href")).toBe(
      "/flazouh/octo-repo/pulls",
    );
  });

  test("leaves a press with a modifier to the link, for a new tab", async () => {
    const person = userEvent.setup();
    const chose: Array<string> = [];
    showing({ atWork: [at("octo-repo", 3, 2)], onChoose: (address) => chose.push(address) });

    await person.keyboard("{Meta>}");
    await person.click(screen.getByRole("link", { name: /octo-repo/ }));
    await person.keyboard("{/Meta}");

    expect(chose).toEqual([]);
  });

  test("says nothing about repositories when nothing has been read", () => {
    showing();

    expect(
      screen.queryByRole("list", { name: "Repositories you are working in" }),
    ).toBeNull();
  });
});

const involved = (
  number: number,
  repo: string,
  shelf: Shelf,
): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo, number },
  id: String(number * 1000),
  title: `pull request ${number}`,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some(shelf),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: `sha${number}`,
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
});

const onScreen = (
  home: boolean,
  over: {
    destination?: Destination;
    onDestination?: (destination: Destination) => void;
    elsewhere?: (destination: "repositories" | "activity") => React.ReactNode;
    rows?: ReadonlyArray<InvolvedPullRequest>;
  } = {},
) =>
  render(
    <WorkingSetScreen
      load={() =>
        Effect.succeed(
          sittingsIn(
            over.rows ?? [
              involved(1, "octo-repo", "needs-action"),
              involved(2, "gitace-extension", "waiting-for-review"),
            ],
            () => Option.none(),
          ),
        )
      }
      onOpen={() => {}}
      onStepAside={() => {}}
      home={home}
      destination={over.destination}
      onDestination={over.onDestination}
      elsewhere={over.elsewhere}
    />,
  );

/**
 * Where the Rail is, which is a question about GitHub's page rather than about ours.
 *
 * Home is the page whose navigation this extension takes: their sidebar of repositories
 * is hidden, and their own readers asked for one of those lists rather than two. Their
 * pull request dashboard is not — their nav is still up the page there — so a Rail on it
 * would be the duplication the Rail exists to end.
 */
describe("the Rail on the Working Set", () => {
  test("stands beside the list on Home, holding the repositories it read", async () => {
    onScreen(true);

    // Derived from the same read the Courts were drawn from, so it names both.
    await waitFor(() => expect(within(rail()).getByText("flazouh/octo-repo")).toBeDefined());
    expect(within(rail()).getByText("flazouh/gitace-extension")).toBeDefined();
  });

  test("narrows Home to a repository in place, and a second press widens it again", async () => {
    const person = userEvent.setup();
    onScreen(true);

    await waitFor(() => expect(screen.getByText("pull request 2")).toBeDefined());
    await person.click(within(rail()).getByRole("link", { name: /octo-repo/ }));

    await waitFor(() => expect(screen.queryByText("pull request 2")).toBeNull());
    expect(screen.getByText("pull request 1")).toBeDefined();
    expect(within(rail()).getByRole("link", { current: true })).toBeDefined();

    await person.click(within(rail()).getByRole("link", { name: /octo-repo/ }));

    await waitFor(() => expect(screen.getByText("pull request 2")).toBeDefined());
  });

  test("goes back to the Working Set when a repository is pressed on another Destination", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    onScreen(true, {
      destination: "activity",
      elsewhere: (which) => <p>the {which} Destination</p>,
      onDestination: (which) => went.push(which),
    });

    await waitFor(() => expect(within(rail()).getByText("flazouh/octo-repo")).toBeDefined());
    await person.click(within(rail()).getByRole("link", { name: /octo-repo/ }));

    expect(went).toEqual(["working-set"]);
  });

  test("is not on their pull request dashboard, where their own nav still is", async () => {
    onScreen(false);

    await waitFor(() => expect(screen.getByRole("searchbox")).toBeDefined());
    expect(
      screen.queryByRole("navigation", { name: "Your repositories" }),
    ).toBeNull();
  });

  test("draws whichever Destination the reader chose", async () => {
    onScreen(true, {
      destination: "activity",
      elsewhere: (which) => <p>the {which} Destination</p>,
    });

    await waitFor(() =>
      expect(screen.getByText("the activity Destination")).toBeDefined(),
    );
  });

  test("an empty Working Set offers the repositories rather than an empty page", async () => {
    // The one moment GitHub's dashboard actively wastes somebody's time: nothing waiting
    // on you, and a blank column to look at.
    onScreen(true, {
      rows: [],
      elsewhere: (which) => <p>the {which} Destination</p>,
    });

    await waitFor(() =>
      expect(screen.getByText(/Nothing is waiting on you/)).toBeDefined(),
    );
    expect(screen.getByText("the repositories Destination")).toBeDefined();
  });
});

/**
 * Reaching a Destination by keyboard.
 *
 * The landing choice is only a convenience if the other two are one chord away — the whole
 * argument GitHub lost by picking a side for everybody. `g d` is unchanged from what
 * Participants already press for their dashboard and said so in as many words. Held by
 * Home's screen rather than by the column, so putting the column away keeps them.
 */
describe("the Destination chords", () => {
  const chording = (destination: Destination, went: Array<Destination>) =>
    onScreen(true, {
      destination,
      elsewhere: (which) => <p>the {which} Destination</p>,
      onDestination: (which) => went.push(which),
    });

  test("takes g r to the repositories", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    chording("working-set", went);

    await person.keyboard("gr");

    expect(went).toEqual(["repositories"]);
  });

  test("takes g d back to the Working Set from anywhere", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    chording("activity", went);

    await person.keyboard("gd");

    expect(went).toEqual(["working-set"]);
  });

  test("answers a chord on the Repositories Destination", async () => {
    // That Destination has a filter of its own. Giving up the chords with it would have made
    // the one Destination a reader lands on the one they cannot leave by keyboard.
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    chording("repositories", went);

    await person.keyboard("gf");

    expect(went).toEqual(["activity"]);
  });

  test("leaves g alone on its own", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    chording("working-set", went);

    await person.keyboard("g");

    expect(went).toEqual([]);
  });
});

/**
 * Pinning a repository, as many as a reader likes.
 *
 * GitHub allows six, which is a number about their layout rather than about anybody's work,
 * and their own discussion #28350 is about exactly that. Pinned repositories are the list
 * above the work, because a reader who pinned one said it matters whether or not there is a
 * pull request in it this week.
 */
describe("pinned repositories", () => {
  test("are listed above the repositories with work in them", () => {
    showing({ pinned: ["citrolabs/ego-lite"], atWork: [at("octo-repo", 3, 1)] });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getByRole("link", { name: /ego-lite/ })).toBeDefined();
  });

  test("are not repeated in the list below", () => {
    showing({ pinned: ["flazouh/octo-repo"], atWork: [at("octo-repo", 3, 1)] });

    const work = screen.queryByRole("list", {
      name: "Repositories you are working in",
    });
    expect(work === null || within(work).queryByRole("link", { name: /octo-repo/ }) === null).toBe(
      true,
    );
  });

  test("take a press to pin, and tell whoever is remembering", async () => {
    const person = userEvent.setup();
    const asked: Array<ReadonlyArray<string>> = [];
    showing({
      atWork: [at("octo-repo", 3, 1)],
      onPinned: (pinned) => asked.push(pinned),
    });

    await person.click(screen.getByRole("button", { name: "Pin flazouh/octo-repo" }));

    expect(asked).toEqual([["flazouh/octo-repo"]]);
  });

  test("take a press to unpin", async () => {
    const person = userEvent.setup();
    const asked: Array<ReadonlyArray<string>> = [];
    showing({
      pinned: ["flazouh/octo-repo"],
      onPinned: (pinned) => asked.push(pinned),
    });

    await person.click(screen.getByRole("button", { name: "Unpin flazouh/octo-repo" }));

    expect(asked).toEqual([[]]);
  });

  test("hold more than the six GitHub allows", () => {
    const seven = Array.from({ length: 7 }, (_, index) => `flazouh/repo${index}`);
    showing({ pinned: seven });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getAllByRole("link")).toHaveLength(7);
  });
});
