import { describe, expect, it } from "vitest";

import { demoState } from "../src/fixtures/demoState";

describe("Phase 12 scaffold fixtures", () => {
  it("uses honest synthetic preview data", () => {
    expect(demoState.statusLabel).toBe("Fixture preview");
    expect(demoState.courseName).toBe("Example Course");
    expect(demoState.resultText).toContain("No real EDstem data");
  });
});
