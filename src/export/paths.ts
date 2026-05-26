import { ArchivedCourse, ArchivedThread } from "../sync/types";

const ROOT_FOLDER = "EdstemArchive";
const MAX_PATH_PART_LENGTH = 96;
const MAX_FILENAME_LENGTH = 140;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function buildCourseFolder(course: ArchivedCourse): string {
  const name = sanitizePathPart(course.name, "course");
  const id = sanitizePathPart(course.id, "unknown");
  return `${ROOT_FOLDER}/${name}-${id}`;
}

export function buildThreadFilename(thread: ArchivedThread): string {
  const title = sanitizePathPart(thread.title, "untitled-thread", MAX_FILENAME_LENGTH - 32);
  const id = sanitizePathPart(thread.threadId, "thread");
  const prefix = thread.number === undefined ? "thread" : String(thread.number).padStart(4, "0");
  return `${prefix}-${title}-${id}.md`;
}

export function buildThreadExportPath(course: ArchivedCourse, thread: ArchivedThread): string {
  return `${buildCourseFolder(course)}/${buildThreadFilename(thread)}`;
}

export function sanitizePathPart(
  value: string | number | undefined,
  fallback: string,
  maxLength = MAX_PATH_PART_LENGTH,
): string {
  const raw = String(value ?? "").normalize("NFKD");
  let sanitized = raw
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .replace(/^-+|-+$/g, "")
    .trim();

  sanitized = sanitized.replace(/-{2,}/g, "-");

  if (!sanitized) {
    sanitized = fallback;
  }
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
    sanitized = `${sanitized}-file`;
  }
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).replace(/[. -]+$/g, "");
  }

  return sanitized || fallback;
}
