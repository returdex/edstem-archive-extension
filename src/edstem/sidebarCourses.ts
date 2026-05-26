import { CourseSummary, normalizeCourseRecord } from "./courses";

interface LinkLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}

interface QueryRoot {
  querySelectorAll(selectors: string): Iterable<LinkLike> | ArrayLike<LinkLike>;
}

const COURSE_LINK_SELECTOR = [
  'a[href*="/courses/"]',
  'a[href*="/course/"]',
].join(",");

const NON_COURSE_LINK_TEXT = new Set([
  "new thread",
  "new post",
  "new topic",
  "new question",
  "新建主题",
  "发布",
  "help docs",
]);

export function extractSidebarCourses(root: QueryRoot): CourseSummary[] {
  const links = Array.from(root.querySelectorAll(COURSE_LINK_SELECTOR));
  const courses: CourseSummary[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const name = normalizeVisibleCourseName(link.textContent);
    if (NON_COURSE_LINK_TEXT.has(name.toLowerCase())) {
      continue;
    }
    const id = extractCourseId(href);
    if (!id || !name) {
      continue;
    }

    const normalized = normalizeCourseRecord({ id, name, url: href }, "sidebar");
    if (!normalized) {
      continue;
    }

    const dedupeKey = normalized.id;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    courses.push(normalized);
  }

  return courses;
}

function extractCourseId(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, "https://edstem.org");
  } catch {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const courseIndex = pathParts.findIndex((part) => part === "course" || part === "courses");
  if (courseIndex < 0 || !pathParts[courseIndex + 1]) {
    return null;
  }

  const afterCourseId = pathParts.slice(courseIndex + 2);
  if (!isCourseLandingPath(afterCourseId)) {
    return null;
  }

  return decodeURIComponent(pathParts[courseIndex + 1]);
}

function isCourseLandingPath(afterCourseId: string[]): boolean {
  if (afterCourseId.length === 0) {
    return true;
  }
  return afterCourseId.length === 1 && ["discussion", "threads", "posts"].includes(afterCourseId[0]);
}

function normalizeVisibleCourseName(text: string | null): string {
  const normalized = (text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+\d{1,3}$/, "")
    .trim();
  return /^\d+$/.test(normalized) ? "" : normalized;
}
