import { SyncRepository } from "../sync/db";
import { ArchivedCourse } from "../sync/types";
import { renderThreadMarkdown } from "./markdown";
import { buildThreadExportPath } from "./paths";
import { MarkdownExportManifest } from "./types";

export async function buildCourseMarkdownManifest(
  repository: SyncRepository,
  courseId: string,
  courseOverride?: ArchivedCourse,
  generatedAt = new Date().toISOString(),
): Promise<MarkdownExportManifest> {
  const storedCourse = await repository.getCourse(courseId);
  const course = storedCourse ?? courseOverride ?? { id: courseId, name: courseId };
  const threads = await repository.listThreads(courseId);
  const files = [];

  for (const thread of threads) {
    const posts = await repository.listPosts(courseId, thread.threadId);
    files.push({
      courseId,
      threadId: thread.threadId,
      filename: buildThreadExportPath(course, thread),
      markdown: renderThreadMarkdown({ course, thread, posts }),
    });
  }

  return {
    course,
    files,
    generatedAt,
  };
}
