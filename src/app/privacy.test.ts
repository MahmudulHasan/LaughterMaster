// @vitest-environment node
//
// Hard rule (CLAUDE.md, SPEC §5): no page or API response ever includes a
// user's email, and vote counts are never public. Every member here has a
// real email in the database; each public surface is rendered or fetched
// from real data and checked for leaks.
import { NextRequest } from "next/server";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { createDb, type Db } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { jokes } from "@/server/db/schema";
import { upsertUserFromProvider } from "@/server/users";

import { GET as listJokes } from "./api/jokes/route";
import { JokeBody } from "./joke/[id]/page";
import { AllJokesList } from "./jokes/page";
import { ProfileBody } from "./u/[id]/page";

let db: Db;
vi.mock("@/server/db/app-db", () => ({ getAppDb: async () => db }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/joke/actions", () => ({ deleteJokeAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
// Outside a real request `connection()` throws; these renders are per request.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const MEMBERS = ["dev-mina", "dev-priya"];
const EMAIL_DOMAIN = "@leak-check.example";

/** Field names that may appear in a list API joke, and nothing else. */
const JOKE_FIELDS = ["author", "category", "createdAt", "id", "isBot", "text"];
const AUTHOR_FIELDS = ["avatarUrl", "displayName", "id"];
/** Anything that looks like vote data, as a JSON key or a rendered count. */
const VOTE_KEY = /"(likes?|dislikes?|votes?|score|voteCount|likeCount)"\s*:/i;
const VOTE_TEXT = /\b\d+\s+(likes?|dislikes?|votes?|points?)\b/i;

function expectNoLeaks(output: string) {
  expect(output).not.toContain(EMAIL_DOMAIN);
  expect(output).not.toMatch(VOTE_KEY);
  expect(output).not.toMatch(VOTE_TEXT);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("no email or vote counts on any public surface", () => {
  beforeAll(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    for (const id of MEMBERS) {
      await upsertUserFromProvider(
        db,
        {
          provider: "dev",
          providerAccountId: id,
          name: id,
          image: null,
          email: `${id}${EMAIL_DOMAIN}`,
        },
        { id },
      );
    }
    // 25 approved jokes for Mina (two pages), one for Priya, one pending.
    for (let i = 0; i < 25; i++) {
      await db.insert(jokes).values({
        id: `m${String(i).padStart(2, "0")}`,
        authorId: "dev-mina",
        text: `Mina's joke ${i} goes here`,
        normalizedText: `m${i}`,
        status: "approved",
        createdAt: new Date(Date.UTC(2026, 10, 22, 0, i)),
      });
    }
    await db.insert(jokes).values([
      {
        id: "p1",
        authorId: "dev-priya",
        text: "Priya's only joke here",
        normalizedText: "p1",
        status: "approved",
      },
      {
        id: "pending1",
        authorId: "dev-mina",
        text: "Mina's joke under review",
        normalizedText: "pending1",
        status: "pending",
      },
    ]);
  });

  afterAll(async () => {
    await db.$client.close();
  });

  describe("GET /api/jokes", () => {
    const get = async (query: string) => {
      const res = await listJokes(
        new NextRequest(`http://localhost/api/jokes${query}`),
      );
      return { text: await res.text(), status: res.status };
    };

    it.each(["", "?cursor=m06", "?author=dev-mina", "?author=dev-priya"])(
      "returns only allowlisted fields for %j",
      async (query) => {
        const { text, status } = await get(query);
        expect(status).toBe(200);
        expectNoLeaks(text);
        const body = JSON.parse(text) as {
          jokes: Record<string, unknown>[];
          nextCursor: unknown;
        };
        expect(Object.keys(body).sort()).toEqual(["jokes", "nextCursor"]);
        expect(body.jokes.length).toBeGreaterThan(0);
        for (const joke of body.jokes) {
          expect(Object.keys(joke).sort()).toEqual(JOKE_FIELDS);
          expect(Object.keys(joke.author as object).sort()).toEqual(
            AUTHOR_FIELDS,
          );
        }
      },
    );

    it("never lists the pending joke", async () => {
      expect((await get("?author=dev-mina")).text).not.toContain(
        "under review",
      );
    });
  });

  describe("server-rendered pages", () => {
    const viewers: [string, string | null][] = [
      ["a visitor", null],
      ["another member", "dev-priya"],
      ["the owner", "dev-mina"],
    ];

    it.each(viewers)("joke page as %s", async (_who, viewer) => {
      mockAuth.mockResolvedValue(
        viewer ? { user: { id: viewer, name: viewer, image: null } } : null,
      );
      const html = renderToString(await JokeBody(params("m00")));
      expect(html).toContain("Mina&#x27;s joke 0 goes here");
      expectNoLeaks(html);
    });

    it("/jokes first batch", async () => {
      mockAuth.mockResolvedValue(null);
      const html = renderToString(await AllJokesList());
      expect(html).toContain("Mina&#x27;s joke 24 goes here");
      expectNoLeaks(html);
    });

    it.each(viewers)("Mina's profile as %s", async (_who, viewer) => {
      mockAuth.mockResolvedValue(
        viewer ? { user: { id: viewer, name: viewer, image: null } } : null,
      );
      const html = renderToString(await ProfileBody(params("dev-mina")));
      expect(html).toContain("25 jokes");
      expectNoLeaks(html);
      // Pending jokes reach the owner only.
      expect(html.includes("under review")).toBe(viewer === "dev-mina");
    });
  });
});
