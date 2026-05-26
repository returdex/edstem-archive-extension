import { describe, expect, it } from "vitest";

import { renderPopup, viewModelForSnapshot } from "../src/popupState";

describe("popup state rendering", () => {
  it("renders checking state", () => {
    expect(renderPopup({ state: "checking" })).toContain("Checking EDstem session");
  });

  it("renders signed-in courses from snapshot", () => {
    const html = renderPopup({
      state: "signed_in",
      courses: [
        {
          id: "101",
          name: "Example Algorithms",
          url: "https://edstem.org/us/courses/101/discussion/",
          source: "api",
        },
      ],
    });

    expect(html).toContain("Logged in to EDstem");
    expect(html).toContain("Example Algorithms");
    expect(html).toContain("Markdown files are saved to your browser Downloads folder.");
    expect(html).toContain("data-action=\"start-all-export\"");
  });

  it("enables current-course download only when the active Edstem tab is eligible", () => {
    const session = {
      state: "signed_in" as const,
      courses: [
        {
          id: "101",
          name: "Example Algorithms",
          url: "https://edstem.org/us/courses/101/discussion/",
          source: "api" as const,
        },
      ],
    };

    const eligible = renderPopup(session, undefined, {
      state: "eligible",
      course: session.courses[0],
      tabUrl: "https://edstem.org/us/courses/101/discussion/1",
    });
    const ineligible = renderPopup(session, undefined, {
      state: "not_edstem",
    });

    expect(eligible).toContain("data-action=\"start-course-export\"");
    expect(eligible).toContain("data-value=\"101\"");
    expect(ineligible).toContain("<button type=\"button\" disabled>Download current course</button>");
    expect(ineligible).toContain("Open an Edstem course tab");
  });

  it("renders needs-login state with Open Edstem action", () => {
    const html = renderPopup({ state: "needs_login" });

    expect(html).toContain("Please log in to EDstem");
    expect(html).toContain("Open Edstem");
    expect(html).not.toContain("password");
  });

  it("shows the diagnostic probe URL when needs_login carries one", () => {
    const html = renderPopup({
      state: "needs_login",
      diagnostic: "https://edstem.org/au/api/user",
    });
    expect(html).toContain("diagnostic-line");
    expect(html).toContain("https://edstem.org/au/api/user");
  });

  it("renders empty courses without implying login failure", () => {
    const model = viewModelForSnapshot({ state: "empty_courses" });

    expect(model.status).toBe("Logged in to EDstem");
    expect(model.bodyLabel).toBe("No visible courses found");
  });

  it("renders connection problems with sanitized escaped content", () => {
    const html = renderPopup({
      state: "connection_problem",
      message: "<script>alert('x')</script>",
    });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("hides the download action group entirely for non-actionable session states", () => {
    for (const state of ["needs_login", "checking"] as const) {
      const snapshot =
        state === "needs_login"
          ? ({ state } as const)
          : ({ state } as const);
      const html = renderPopup(snapshot);
      expect(html).not.toContain("class=\"action-group\"");
      expect(html).not.toContain(">Download current course<");
      expect(html).not.toContain(">Download all courses<");
    }

    const connectionHtml = renderPopup({ state: "connection_problem", message: "Network failed." });
    expect(connectionHtml).not.toContain("class=\"action-group\"");

    const pausedHtml = renderPopup({ state: "auth_expired_paused", checkpointLabel: "thread 12" });
    expect(pausedHtml).not.toContain("class=\"action-group\"");
  });

  it("shows the download action group for signed-in and empty-courses states", () => {
    const signedInHtml = renderPopup({
      state: "signed_in",
      courses: [
        {
          id: "101",
          name: "Example Algorithms",
          url: "https://edstem.org/us/courses/101/discussion/",
          source: "api",
        },
      ],
    });
    expect(signedInHtml).toContain("class=\"action-group\"");

    const emptyHtml = renderPopup({ state: "empty_courses" });
    expect(emptyHtml).toContain("class=\"action-group\"");
  });

  it("renders the latest body-free export result and open-folder action", () => {
    const html = renderPopup(
      { state: "signed_in", courses: [] },
      undefined,
      undefined,
      {
        recentRuns: [
          {
            runId: "export-1",
            mode: "all_courses",
            status: "success",
            courseIds: ["101"],
            courseResults: [
              {
                courseId: "101",
                courseName: "Example Algorithms",
                status: "success",
                attempted: 2,
                succeeded: 2,
                failed: 0,
                files: [
                  {
                    courseId: "101",
                    threadId: "thread-1",
                    filename: "EdstemArchive/example/welcome.md",
                    downloadId: 1,
                  },
                ],
              },
            ],
            attempted: 2,
            succeeded: 2,
            failed: 0,
            updatedAt: "2026-05-24T00:00:00.000Z",
            message: "2/2 Markdown files downloaded.",
          },
        ],
      },
    );

    expect(html).toContain("Download result");
    expect(html).toContain("Example Algorithms");
    expect(html).toContain("downloaded 2 files");
    expect(html).toContain("data-action=\"open-downloads-folder\"");
    expect(html).not.toContain("Export diagnostics");
    expect(html).not.toContain("Synthetic private body");
  });

  it("renders current-course export results as a compact ratio", () => {
    const html = renderPopup(
      { state: "signed_in", courses: [] },
      undefined,
      undefined,
      {
        recentRuns: [
          {
            runId: "export-2",
            mode: "course",
            status: "success",
            courseIds: ["101"],
            courseResults: [
              {
                courseId: "101",
                courseName: "Example Algorithms",
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
    );

    expect(html).toContain("Example Algorithms");
    expect(html).toContain("<small>12/12</small>");
  });

  it("shows export diagnostics only for failed or partial results", () => {
    const html = renderPopup(
      { state: "signed_in", courses: [] },
      undefined,
      undefined,
      {
        recentRuns: [
          {
            runId: "export-3",
            mode: "all_courses",
            status: "partial",
            courseIds: ["101"],
            courseResults: [
              {
                courseId: "101",
                courseName: "<Course>",
                status: "partial",
                attempted: 2,
                succeeded: 1,
                failed: 1,
                files: [
                  {
                    courseId: "101",
                    threadId: "thread-2",
                    filename: "EdstemArchive/example/error.md",
                    error: "<script>token=abc123</script>",
                  },
                ],
                message: "1/2 Markdown files downloaded.",
              },
            ],
            attempted: 2,
            succeeded: 1,
            failed: 1,
            updatedAt: "2026-05-24T00:00:00.000Z",
            message: "1/2 Markdown files downloaded.",
          },
        ],
      },
    );

    expect(html).toContain("Export diagnostics");
    expect(html).toContain("&lt;Course&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders auth-expired paused contract", () => {
    const html = renderPopup({ state: "auth_expired_paused", checkpointLabel: "thread 12" });

    expect(html).toContain("Session expired");
    expect(html).toContain("thread 12");
  });

  it("renders worker-backed sync progress", () => {
    const html = renderPopup(
      { state: "signed_in", courses: [] },
      {
        activeRun: {
          runId: "run-1",
          mode: "all_courses",
          status: "running",
          courseIds: ["course-101"],
          currentCourseId: "course-101",
          startedAt: "2026-05-24T00:00:00.000Z",
          updatedAt: "2026-05-24T00:00:00.000Z",
          retryAttempt: 0,
          courseProgress: [
            {
              courseId: "course-101",
              courseName: "Example Algorithms",
              completedThreads: 2,
              totalThreads: 4,
            },
          ],
        },
        recentRuns: [],
      },
    );

    expect(html).toContain("Sync progress");
    expect(html).toContain("Example Algorithms");
    expect(html).toContain("2/4 threads");
    expect(html).toContain("data-action=\"cancel-sync\"");
  });

  it("does not leak post bodies through sync diagnostics", () => {
    const html = renderPopup(
      { state: "signed_in", courses: [] },
      {
        recentRuns: [
          {
            runId: "run-1",
            mode: "course",
            status: "failed",
            courseIds: ["course-101"],
            startedAt: "2026-05-24T00:00:00.000Z",
            updatedAt: "2026-05-24T00:00:00.000Z",
            retryAttempt: 0,
            message: "Request failed.",
            courseProgress: [{ courseId: "course-101", completedThreads: 0, message: "Request failed." }],
          },
        ],
      },
    );

    expect(html).not.toContain("Synthetic private body");
    expect(html).not.toContain("token=abc123");
  });
});
