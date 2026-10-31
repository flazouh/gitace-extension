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
import type { Repository } from "../domain/repositories";
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

const owned = (
  nameWithOwner: string,
  over: Partial<Repository> = {},
): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/");
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false,
    ...over,
  };
};

const showing = (
  over: {
    atWork?: ReadonlyArray<RepositoryAtWork>;
    needsYou?: number;
    happened?: number;
    destination?: Destination;
    onDestination?: (destination: Destination) => void;
    repositories?: ReadonlyArray<Repository>;
    pinned?: ReadonlyArray<string>;
    onPinned?: (pinned: ReadonlyArray<string>) => void;
  } = {},
) =>
  render(
    <Rail
      pinned={over.pinned}
      onPinned={over.onPinned}
      destination={over.destination ?? "working-set"}
      onDestination={over.onDestination ?? (() => undefined)}
      atWork={over.atWork ?? []}
      needsYou={over.needsYou ?? 0}
      happened={over.happened}
      repositories={over.repositories}
    />,
  );

const rail = () => screen.getByRole("navigation", { name: "Rail" });

/**
 * The strip that answers "where else?" without a back button.
 *
 * Two taps to a repository is the most-repeated complaint in GitHub's own threads, and
 * leaving a pull request on their soft navigation is a back button that sometimes does
 * not work. Both are answered by navigation that is simply always there — which is why
 * the tests below are about what a reader can reach rather than about how it looks.
 */
describe("the Rail", () => {
  test("offers all three Destinations", () => {
    showing();

    expect(within(rail()).getByRole("button", { name: /Working Set/ })).toBeDefined();
    expect(within(rail()).getByRole("button", { name: /Repositories/ })).toBeDefined();
    expect(within(rail()).getByRole("button", { name: /Activity/ })).toBeDefined();
  });

  test("says which Destination the reader is on", () => {
    showing({ destination: "activity" });

    expect(
      screen.getByRole("button", { current: "page" }).textContent,
    ).toContain("Activity");
  });

  test("takes a press on a Destination there", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

    await person.click(screen.getByRole("button", { name: /Repositories/ }));

    expect(went).toEqual(["repositories"]);
  });

  test("counts what is the reader's own move beside the Working Set", () => {
    showing({ needsYou: 4 });

    expect(
      screen.getByRole("button", { name: "Working Set, 4" }),
    ).toBeDefined();
  });

  test("counts what happened beside Activity, once that read has landed", () => {
    showing({ happened: 26 });

    expect(screen.getByRole("button", { name: "Activity, 26" })).toBeDefined();
  });

  test("says nothing about how much happened before anybody has read it", () => {
    // A zero beside Activity would be a claim that nothing has happened, which is a
    // different thing from not having asked yet.
    showing();

    expect(screen.getByRole("button", { name: "Activity" })).toBeDefined();
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

  test("takes a press on a repository to its pull requests", () => {
    // Their own page for it, which this extension already draws: the complaint is the
    // two taps, not the destination.
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(
      screen.getByRole("link", { name: /octo-repo/ }).getAttribute("href"),
    ).toBe("/flazouh/octo-repo/pulls");
  });

  test("says nothing about repositories when nothing has been read", () => {
    showing();

    expect(
      screen.queryByRole("list", { name: "Repositories you are working in" }),
    ).toBeNull();
  });
});

describe("finding a repository by typing", () => {
  // Past a dozen, so the column is a list to search rather than to read.
  const many = [
    owned("flazouh/octo-repo"),
    owned("flazouh/lumen"),
    owned("flowline-labs/flowline"),
    ...Array.from({ length: 10 }, (_, index) => owned(`flazouh/repo${index}`)),
  ];

  test("searches every repository, not the handful with work in them", async () => {
    // Story 5, and the difference between this and GitHub's own sidebar: theirs lists ten
    // by a rule nobody can predict, and a live account had 154.
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)], repositories: many });

    await person.type(screen.getByRole("searchbox"), "flowline");

    const rows = within(
      screen.getByRole("list", { name: "Repositories that match" }),
    ).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/flowline-labs/flowline/pulls",
    ]);
  });

  test("says so when nothing matches, and how much was searched", async () => {
    const person = userEvent.setup();
    showing({ repositories: many });

    await person.type(screen.getByRole("searchbox"), "nowhere");

    expect(screen.getByText(/Nothing matches nowhere, of 13/)).toBeDefined();
  });

  test("Escape gives the reader their own list back", async () => {
    const person = userEvent.setup();
    showing({ atWork: [at("octo-repo", 3, 2)], repositories: many });

    await person.type(screen.getByRole("searchbox"), "lumen");
    await person.keyboard("{Escape}");

    expect(
      screen.getByRole("list", { name: "Repositories you are working in" }),
    ).toBeDefined();
  });

  test("no filter before the whole list has been read", () => {
    // A box that searches six of a hundred and fifty-four is a box that lies.
    showing({ atWork: [at("octo-repo", 3, 2)] });

    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("no filter over a list short enough to read", () => {
    showing({ repositories: many.slice(0, 12) });

    expect(screen.queryByRole("searchbox")).toBeNull();
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
  ...{},
});

const onScreen = (
  home: boolean,
  over: {
    destination?: Destination;
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

    await waitFor(() => expect(rail()).toBeDefined());

    // Derived from the same read the Courts were drawn from, so it names both.
    await waitFor(() => expect(within(rail()).getByText("flazouh/octo-repo")).toBeDefined());
    expect(within(rail()).getByText("flazouh/gitace-extension")).toBeDefined();
    // One is the reader's move, and the Working Set Destination says so.
    expect(
      within(rail()).getByRole("button", { name: "Working Set, 1" }),
    ).toBeDefined();
  });

  test("is not on their pull request dashboard, where their own nav still is", async () => {
    onScreen(false);

    await waitFor(() => expect(screen.getByRole("searchbox")).toBeDefined());
    expect(
      screen.queryByRole("navigation", { name: "Rail" }),
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
 * Reaching a Destination without the Rail.
 *
 * The landing choice is only a convenience if the other two are one chord away — the whole
 * argument GitHub lost by picking a side for everybody. `g d` is unchanged from what
 * Participants already press for their dashboard and said so in as many words.
 */
describe("the Destination chords", () => {
  test("takes g r to the repositories", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

    await person.keyboard("gr");

    expect(went).toEqual(["repositories"]);
  });

  test("takes g d back to the Working Set from anywhere", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ destination: "activity", onDestination: (which) => went.push(which) });

    await person.keyboard("gd");

    expect(went).toEqual(["working-set"]);
  });

  test("answers a chord while the Repositories filter owns the slash", async () => {
    // That Destination has a filter of its own, so the Rail gives up `/` there. Giving up
    // the chords with it would have made the one Destination a reader lands on the one they
    // cannot leave by keyboard.
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ destination: "repositories", onDestination: (which) => went.push(which) });

    await person.keyboard("gf");

    expect(went).toEqual(["activity"]);
  });

  test("leaves g alone on its own", async () => {
    const person = userEvent.setup();
    const went: Array<Destination> = [];
    showing({ onDestination: (which) => went.push(which) });

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
  const two = [owned("flazouh/octo-repo"), owned("citrolabs/ego-lite")];

  test("are listed above the repositories with work in them", () => {
    showing({ repositories: two, pinned: ["citrolabs/ego-lite"], atWork: [at("octo-repo", 3, 1)] });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getByRole("link", { name: /ego-lite/ })).toBeDefined();
  });

  test("are not repeated in the list below", () => {
    showing({ repositories: two, pinned: ["flazouh/octo-repo"], atWork: [at("octo-repo", 3, 1)] });

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
      repositories: two,
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
      repositories: two,
      pinned: ["flazouh/octo-repo"],
      onPinned: (pinned) => asked.push(pinned),
    });

    await person.click(screen.getByRole("button", { name: "Unpin flazouh/octo-repo" }));

    expect(asked).toEqual([[]]);
  });

  test("hold more than the six GitHub allows", () => {
    const seven = Array.from({ length: 7 }, (_, index) => owned(`flazouh/repo${index}`));
    showing({ repositories: seven, pinned: seven.map((one) => one.nameWithOwner) });

    const pinned = screen.getByRole("list", { name: "Repositories you pinned" });
    expect(within(pinned).getAllByRole("link")).toHaveLength(7);
  });
});
