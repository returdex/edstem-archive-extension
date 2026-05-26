export type SyncRunStatus =
  | "queued"
  | "running"
  | "waiting_retry"
  | "cancelling"
  | "cancelled"
  | "auth_expired"
  | "failed"
  | "partial"
  | "success";

export type SyncOutcome = "success" | "partial" | "cancelled" | "auth_expired" | "failed";

export interface ArchivedCourse {
  id: string;
  name: string;
  url?: string;
  syncedAt?: string;
}

export interface ArchivedThread {
  courseId: string;
  threadId: string;
  title: string;
  number?: number;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  authorName?: string;
  authorRole?: string;
}

export interface ArchivedPost {
  courseId: string;
  threadId: string;
  postId: string;
  parentPostId?: string;
  body: string;
  authorName?: string;
  authorRole?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseCheckpoint {
  courseId: string;
  runId?: string;
  lastThreadId?: string;
  completedThreadIds: string[];
  watermark?: string;
  watermarkEvidence?: string;
  nextCursor?: string;
  retryAttempt: number;
  nextAttemptAt?: string;
  updatedAt: string;
}

export interface CourseSyncProgress {
  courseId: string;
  courseName?: string;
  completedThreads: number;
  totalThreads?: number;
  outcome?: SyncOutcome;
  message?: string;
}

export interface SyncRun {
  runId: string;
  mode: "course" | "all_courses";
  status: SyncRunStatus;
  courseIds: string[];
  currentCourseId?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  cancelRequested?: boolean;
  retryAttempt: number;
  nextAttemptAt?: string;
  message?: string;
  courseProgress: CourseSyncProgress[];
}

export interface SyncEvent {
  eventId: string;
  runId?: string;
  courseId?: string;
  threadId?: string;
  category:
    | "run_started"
    | "course_started"
    | "thread_persisted"
    | "retry_scheduled"
    | "cancel_requested"
    | "run_finished"
    | "error";
  message: string;
  createdAt: string;
}

export interface SyncSnapshot {
  activeRun?: SyncRun;
  recentRuns: SyncRun[];
}

export interface ExportedFileResult {
  courseId: string;
  threadId: string;
  filename: string;
  downloadId?: number;
  error?: string;
}

export interface ExportCourseResult {
  courseId: string;
  courseName: string;
  status: "success" | "partial" | "failed";
  attempted: number;
  succeeded: number;
  failed: number;
  files: ExportedFileResult[];
  message?: string;
}

export interface ExportRunSummary {
  runId: string;
  mode: "course" | "all_courses";
  status: "success" | "partial" | "failed";
  courseIds: string[];
  courseResults: ExportCourseResult[];
  attempted: number;
  succeeded: number;
  failed: number;
  updatedAt: string;
  message?: string;
}

export interface ExportSnapshot {
  recentRuns: ExportRunSummary[];
}

export interface ThreadArchiveBundle {
  course?: ArchivedCourse;
  thread: ArchivedThread;
  posts: ArchivedPost[];
  checkpoint: CourseCheckpoint;
}

export function threadStorageKey(courseId: string, threadId: string): string {
  return `${courseId}::${threadId}`;
}

export function postStorageKey(courseId: string, threadId: string, postId: string): string {
  return `${courseId}::${threadId}::${postId}`;
}
