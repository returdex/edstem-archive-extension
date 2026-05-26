import { DiscussionThreadSummary } from "../sync/engine";

interface LinkLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}

interface QueryRoot {
  querySelectorAll(selectors: string): Iterable<LinkLike> | ArrayLike<LinkLike>;
}

const THREAD_LINK_SELECTOR = 'a[href*="/courses/"][href*="/discussion/"]';

export function extractVisibleThreadSummaries(root: QueryRoot, courseId: string): DiscussionThreadSummary[] {
  const links = Array.from(root.querySelectorAll(THREAD_LINK_SELECTOR));
  const threads: DiscussionThreadSummary[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const threadId = extractThreadId(href, courseId);
    if (!threadId || seen.has(threadId)) {
      continue;
    }

    seen.add(threadId);
    threads.push({
      threadId,
      title: normalizeVisibleThreadTitle(link.textContent) || `Thread ${threadId}`,
    });
  }

  return threads;
}

export function extractThreadSummaryFromUrl(
  rawUrl: string,
  courseId: string,
  fallbackTitle = "",
): DiscussionThreadSummary | undefined {
  const threadId = extractThreadId(rawUrl, courseId);
  if (!threadId) {
    return undefined;
  }
  return {
    threadId,
    title: normalizeVisibleThreadTitle(fallbackTitle) || `Thread ${threadId}`,
  };
}

function extractThreadId(href: string, expectedCourseId: string): string | null {
  let url: URL;
  try {
    url = new URL(href, "https://edstem.org");
  } catch {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const courseIndex = pathParts.findIndex((part) => part === "course" || part === "courses");
  if (courseIndex < 0) {
    return null;
  }

  const courseId = pathParts[courseIndex + 1];
  const discussion = pathParts[courseIndex + 2];
  const threadId = pathParts[courseIndex + 3];
  if (courseId !== expectedCourseId || discussion !== "discussion" || !threadId || threadId === "new") {
    return null;
  }

  return decodeURIComponent(threadId);
}

function normalizeVisibleThreadTitle(text: string | null): string {
  return (text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\b\d+\s*(?:赞|likes?|views?|查看|comments?|回复)\b/gi, "")
    .trim();
}
