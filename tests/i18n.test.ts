import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assertMessageKeyParity, createI18n, DEFAULT_MESSAGES } from "../src/i18n";
import { renderOnboarding } from "../src/onboarding";
import { renderPopup } from "../src/popupState";

interface ChromeCatalogEntry {
  message: string;
}

type ChromeCatalog = Record<string, ChromeCatalogEntry>;

function readCatalog(locale: "en" | "zh_CN"): ChromeCatalog {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public", "_locales", locale, "messages.json"), "utf8"),
  ) as ChromeCatalog;
}

function flattenCatalog(catalog: ChromeCatalog): Record<string, string> {
  return Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, value.message]));
}

describe("extension i18n catalogs", () => {
  it("keeps English and zh_CN message keys in parity with runtime defaults", () => {
    const en = readCatalog("en");
    const zh = readCatalog("zh_CN");

    expect(() => assertMessageKeyParity(en, zh)).not.toThrow();
    expect(() => assertMessageKeyParity(DEFAULT_MESSAGES, en)).not.toThrow();
  });

  it("interpolates placeholders and falls back to default English messages", () => {
    const t = createI18n({
      downloadedFiles: "saved $count$ files",
    });

    expect(t("downloadedFiles", { count: 3 })).toBe("saved 3 files");
    expect(t("downloadCurrentCourse")).toBe("Download current course");
  });

  it("renders popup primary actions in English and Chinese without changing action ids", () => {
    const en = createI18n(flattenCatalog(readCatalog("en")));
    const zh = createI18n(flattenCatalog(readCatalog("zh_CN")));
    const session = {
      state: "signed_in" as const,
      courses: [
        {
          id: "101",
          name: "<Course>",
          url: "https://edstem.org/us/courses/101/discussion/",
          source: "api" as const,
        },
      ],
    };

    const english = renderPopup(session, undefined, { state: "not_edstem" }, undefined, en);
    const chinese = renderPopup(session, undefined, { state: "not_edstem" }, undefined, zh);

    expect(english).toContain("Download current course");
    expect(english).toContain("data-action=\"start-all-export\"");
    expect(chinese).toContain("下载当前课程");
    expect(chinese).toContain("下载全部课程");
    expect(chinese).toContain("data-action=\"start-all-export\"");
    expect(chinese).toContain("&lt;Course&gt;");
  });

  it("renders short localized onboarding copy from message catalogs", () => {
    const zh = createI18n(flattenCatalog(readCatalog("zh_CN")));
    const html = renderOnboarding(zh);

    expect(html).toContain("归档你的 Edstem 讨论");
    expect(html).toContain("使用你现有的 EDstem 登录状态");
    expect(html).toContain("Markdown 保存在本地");
    expect(html).toContain("不收集凭据");
    expect(html).toContain("data-action=\"open-edstem\"");
    expect(html).not.toContain("FAQ");
  });
});
