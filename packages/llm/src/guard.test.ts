import { expect, test } from "bun:test";
import { keywordGuard } from "./index";

test("blocks political and conflict words", () => {
  expect(keywordGuard("Presidential election results").hit).toBe("election");
  expect(keywordGuard("Bandits attack farmers").excluded).toBe(true);
  expect(keywordGuard("War in the region").hit).toBe("war");
});

test("does not block substrings in business text", () => {
  for (const t of [
    "Moving forward, rice prices will rise",
    "Warehouse costs up toward year end",
    "Third-party logistics firms raise fees",
    "Award for best grain trader",
    "Lagos importers devote more to FX hedging",
  ]) expect(keywordGuard(t).excluded).toBe(false);
});

test("hyphenated political prefixes are still caught", () => {
  expect(keywordGuard("Tinubu's pre-election sweetener").excluded).toBe(true);
  expect(keywordGuard("Post-war reconstruction").excluded).toBe(true);
});
