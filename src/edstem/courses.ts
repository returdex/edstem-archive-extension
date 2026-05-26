import { isAllowedNetworkUrl } from "../policy/policyAllowlist";

export type CourseSource = "api" | "sidebar";

export interface CourseSummary {
  id: string;
  name: string;
  url: string;
  source: CourseSource;
}

type UnknownRecord = Record<string, unknown>;

export function normalizeCourses(payload: unknown, source: CourseSource = "api"): CourseSummary[] {
  const courses: CourseSummary[] = [];
  const seen = new Set<string>();

  for (const record of extractCourseRecords(payload)) {
    const normalized = normalizeCourseRecord(record, source);
    if (!normalized) {
      continue;
    }

    const dedupeKey = `${normalized.id}|${normalized.url}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    courses.push(normalized);
  }

  return courses;
}

export function normalizeCourseRecord(record: unknown, source: CourseSource): CourseSummary | null {
  if (!isRecord(record)) {
    return null;
  }

  const courseRecord = isRecord(record.course) ? record.course : record;
  const id = firstString(courseRecord, ["id", "course_id", "courseId"]);
  const name = firstString(courseRecord, ["name", "title", "course_name", "courseName"]);
  if (!id || !name) {
    return null;
  }

  const rawUrl = firstString(courseRecord, ["url", "href", "link"]);
  const url = safeCourseUrl(rawUrl, id);
  if (!url) {
    return null;
  }

  return { id, name, url, source };
}

export function safeCourseUrl(rawUrl: string | undefined, courseId: string): string | null {
  if (rawUrl) {
    try {
      const url = new URL(rawUrl, "https://edstem.org");
      if (isAllowedNetworkUrl(url.href)) {
        return `${url.origin}${url.pathname}`;
      }
    } catch {
      return null;
    }
  }

  return `https://edstem.org/us/courses/${encodeURIComponent(courseId)}/discussion/`;
}

function extractCourseRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["courses", "data", "results"] as const) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (isRecord(payload.data)) {
    for (const key of ["courses", "results"] as const) {
      if (Array.isArray(payload.data[key])) {
        return payload.data[key];
      }
    }
  }

  return [];
}

function firstString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
