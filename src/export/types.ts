import { ArchivedCourse, ArchivedPost, ArchivedThread } from "../sync/types";

export interface MarkdownExportFile {
  courseId: string;
  threadId: string;
  filename: string;
  markdown: string;
}

export interface MarkdownExportManifest {
  course: ArchivedCourse;
  files: MarkdownExportFile[];
  generatedAt: string;
}

export interface ThreadMarkdownInput {
  course: ArchivedCourse;
  thread: ArchivedThread;
  posts: ArchivedPost[];
}
