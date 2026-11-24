import { createModerator, type Moderator } from "./moderator";

let shared: Moderator | undefined;

/** The moderator for app code, created once per process (SPEC D17). */
export function getModerator(): Moderator {
  shared ??= createModerator();
  return shared;
}
