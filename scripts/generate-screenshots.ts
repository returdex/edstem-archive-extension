import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createI18n } from "../src/i18n";
import { renderOnboarding } from "../src/onboarding";
import { renderPopup } from "../src/popupState";

const OUTPUT_DIR = join(process.cwd(), "store-assets", "screenshots");

const syntheticCourse = {
  id: "synthetic-course-101",
  name: "Synthetic Design Studio",
  url: "https://edstem.org/us/courses/synthetic-course-101/discussion/",
  source: "api" as const,
};

const english = createI18n();

const popupSuccess = renderPopup(
  { state: "signed_in", courses: [syntheticCourse] },
  undefined,
  { state: "eligible", course: syntheticCourse, tabUrl: syntheticCourse.url },
  {
    recentRuns: [
      {
        runId: "synthetic-export-success",
        mode: "all_courses",
        status: "success",
        courseIds: [syntheticCourse.id],
        courseResults: [
          {
            courseId: syntheticCourse.id,
            courseName: syntheticCourse.name,
            status: "success",
            attempted: 12,
            succeeded: 12,
            failed: 0,
            files: [],
          },
        ],
        attempted: 12,
        succeeded: 12,
        failed: 0,
        updatedAt: "2026-05-24T00:00:00.000Z",
        message: "12/12 Markdown files downloaded.",
      },
    ],
  },
  english,
);

const popupError = renderPopup(
  { state: "signed_in", courses: [syntheticCourse] },
  undefined,
  { state: "eligible", course: syntheticCourse, tabUrl: syntheticCourse.url },
  {
    recentRuns: [
      {
        runId: "synthetic-export-partial",
        mode: "all_courses",
        status: "partial",
        courseIds: [syntheticCourse.id],
        courseResults: [
          {
            courseId: syntheticCourse.id,
            courseName: syntheticCourse.name,
            status: "partial",
            attempted: 12,
            succeeded: 10,
            failed: 2,
            files: [
              {
                courseId: syntheticCourse.id,
                threadId: "synthetic-thread-2",
                filename: "EdstemArchive/synthetic-design-studio/synthetic-thread-2.md",
                error: "Download failed.",
              },
            ],
            message: "10/12 Markdown files downloaded.",
          },
        ],
        attempted: 12,
        succeeded: 10,
        failed: 2,
        updatedAt: "2026-05-24T00:00:00.000Z",
        message: "10/12 Markdown files downloaded.",
      },
    ],
  },
  english,
);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFixture("popup-success.html", popupSuccess);
writeFixture("popup-error.html", popupError);
writeFixture("onboarding.html", renderOnboarding(english));

function writeFixture(filename: string, body: string): void {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Synthetic Edstem Archive screenshot fixture</title>
    <link rel="stylesheet" href="../../src/styles.css" />
  </head>
  <body class="popup-body">
    ${body}
  </body>
</html>
`;
  writeFileSync(join(OUTPUT_DIR, filename), `${html.split("\n").map((line) => line.trimEnd()).join("\n")}`, "utf8");
}
