import { describe, expect, it } from "vitest";

import { jokeTitle } from "./jokeTitle";

describe("jokeTitle", () => {
  it("falls back to the generic title when there is no visible joke", () => {
    expect(jokeTitle(null)).toBe("Joke · LaughterMaster");
  });

  it("keeps a short joke whole", () => {
    expect(jokeTitle("Why  so\nserious?")).toBe(
      "“Why so serious?” · LaughterMaster",
    );
  });

  it("cuts a long joke to its first six words", () => {
    expect(
      jokeTitle("I told my wifi a joke. It didn't get the connection."),
    ).toBe("“I told my wifi a joke…” · LaughterMaster");
  });

  it("cuts a joke without spaces by length", () => {
    const title = jokeTitle("x".repeat(200));
    expect(title).toBe(`“${"x".repeat(48)}…” · LaughterMaster`);
  });
});
