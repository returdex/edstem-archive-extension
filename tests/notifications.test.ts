import { describe, expect, it } from "vitest";

import {
  notificationIdForRun,
  notifyExportResult,
  registerNotificationClickHandler,
  shouldNotifyStatus,
} from "../src/background/notifications";
import { createI18n } from "../src/i18n";
import { ExportRunSummary } from "../src/sync/types";

function exportRun(status: ExportRunSummary["status"]): ExportRunSummary {
  return {
    runId: "run-1",
    mode: "all_courses",
    status,
    courseIds: ["101"],
    courseResults: [],
    attempted: 3,
    succeeded: status === "failed" ? 0 : 2,
    failed: status === "success" ? 0 : 1,
    updatedAt: "2026-05-24T00:00:00.000Z",
    message: "Synthetic message with https://edstem.org/api/thread?token=abc123",
  };
}

describe("background notifications", () => {
  it("creates localized basic notifications for terminal export outcomes", async () => {
    const created: Array<{ id: string; options: chrome.notifications.NotificationOptions }> = [];
    const notifications = {
      create(id: string, options: chrome.notifications.NotificationOptions) {
        created.push({ id, options });
        return id;
      },
      onClicked: { addListener() {} },
    };

    await notifyExportResult(exportRun("success"), {
      notifications,
      t: createI18n({
        notificationCompleteTitle: "Done",
        notificationCompleteMessage: "$succeeded$/$attempted$ files saved",
      }),
    });
    await notifyExportResult(exportRun("partial"), { notifications });

    expect(created).toHaveLength(2);
    expect(created[0]).toEqual(
      expect.objectContaining({
        id: notificationIdForRun("run-1"),
        options: expect.objectContaining({
          type: "basic",
          title: "Done",
          message: "2/3 files saved",
        }),
      }),
    );
    expect(created[1].options.title).toContain("errors");
    expect(JSON.stringify(created)).not.toContain("token=abc123");
  });

  it("does not notify for non-terminal statuses", async () => {
    expect(shouldNotifyStatus("running")).toBe(false);
    expect(shouldNotifyStatus("waiting_retry")).toBe(false);
    expect(shouldNotifyStatus("success")).toBe(true);
    expect(shouldNotifyStatus("partial")).toBe(true);
    expect(shouldNotifyStatus("failed")).toBe(true);
  });

  it("routes notification clicks only to an extension-owned popup page", () => {
    let listener: ((notificationId: string) => void) | undefined;
    const opened: string[] = [];
    const cleared: string[] = [];
    const notifications = {
      create() {
        return "unused";
      },
      clear(id: string) {
        cleared.push(id);
        return true;
      },
      onClicked: {
        addListener(next: (notificationId: string) => void) {
          listener = next;
        },
      },
    };

    registerNotificationClickHandler({
      notifications,
      runtime: { getURL: (path) => `chrome-extension://example/${path}` },
      tabs: { create: ({ url }) => opened.push(url) as never },
    });

    listener?.("unrelated");
    listener?.(notificationIdForRun("run-1"));

    expect(opened).toEqual(["chrome-extension://example/popup.html"]);
    expect(cleared).toEqual([notificationIdForRun("run-1")]);
  });
});
