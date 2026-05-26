import { describe, expect, it } from "vitest";

import { registerInstallHandler } from "../src/background/install";
import { createI18n } from "../src/i18n";
import { renderOnboarding } from "../src/onboarding";

describe("install onboarding", () => {
  it("opens onboarding only for first install", () => {
    let listener: ((details: chrome.runtime.InstalledDetails) => void) | undefined;
    const opened: string[] = [];

    registerInstallHandler({
      runtime: {
        getURL: (path) => `chrome-extension://example/${path}`,
        onInstalled: {
          addListener(next) {
            listener = next;
          },
        },
      },
      tabs: { create: ({ url }) => opened.push(url) as never },
    });

    listener?.({ reason: "update", previousVersion: "0.3.0" });
    listener?.({ reason: "chrome_update" });
    listener?.({ reason: "install" });

    expect(opened).toEqual(["chrome-extension://example/onboarding.html"]);
  });

  it("renders three trust points and one start action", () => {
    const html = renderOnboarding(
      createI18n({
        onboardingTitle: "Start",
        trustExistingSession: "Existing session",
        trustLocalMarkdown: "Local Markdown",
        trustNoCredentials: "No credential collection",
        onboardingOpenEdstem: "Open Edstem",
      }),
    );

    expect(html).toContain("Existing session");
    expect(html).toContain("Local Markdown");
    expect(html).toContain("No credential collection");
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html.match(/data-action="open-edstem"/g)).toHaveLength(1);
  });
});
