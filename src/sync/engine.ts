import { EdstemError } from "../edstem/errors";
import {
  ArchivedCourse,
  ArchivedPost,
  ArchivedThread,
  CourseCheckpoint,
  SyncOutcome,
  SyncRun,
  SyncSnapshot,
  ThreadArchiveBundle,
} from "./types";
import { SyncRepository } from "./db";
import { RetryDecision, nextRetryDecision } from "./retry";

export interface DiscussionThreadSummary {
  threadId: string;
  title: string;
  updatedAt?: string;
}

export interface DiscussionThreadDetail {
  thread: ArchivedThread;
  posts: ArchivedPost[];
}

export interface ThreadListPage {
  threads: DiscussionThreadSummary[];
  totalThreads?: number;
  nextCursor?: string;
  watermark?: string;
  watermarkEvidence?: string;
}

export type ProviderResult<T> = { ok: true; data: T } | EdstemError;

export interface DiscussionProvider {
  listUpdatedThreads(course: ArchivedCourse, checkpoint?: CourseCheckpoint): Promise<ProviderResult<ThreadListPage>>;
  fetchThread(course: ArchivedCourse, threadId: string): Promise<ProviderResult<DiscussionThreadDetail>>;
}

export interface SyncClock {
  now(): Date;
}

export interface SyncEngineOptions {
  repository: SyncRepository;
  provider: DiscussionProvider;
  clock?: SyncClock;
  makeRunId?: () => string;
  random?: () => number;
  maxThreadConcurrency?: number;
}

export interface RunSyncInput {
  mode: "course" | "all_courses";
  courses: ArchivedCourse[];
}

export interface RunSyncResult {
  run: SyncRun;
  outcome?: SyncOutcome;
}

const TERMINAL_STATUSES = new Set(["auth_expired", "cancelled", "failed", "partial", "success"]);

export class SyncEngine {
  private readonly repository: SyncRepository;
  private readonly provider: DiscussionProvider;
  private readonly clock: SyncClock;
  private readonly makeRunId: () => string;
  private readonly random: () => number;
  private readonly maxThreadConcurrency: number;

  constructor(options: SyncEngineOptions) {
    this.repository = options.repository;
    this.provider = options.provider;
    this.clock = options.clock ?? { now: () => new Date() };
    this.makeRunId = options.makeRunId ?? (() => `run-${this.clock.now().getTime()}`);
    this.random = options.random ?? Math.random;
    this.maxThreadConcurrency = Math.min(2, Math.max(1, options.maxThreadConcurrency ?? 1));
  }

  async start(input: RunSyncInput): Promise<RunSyncResult> {
    const existing = await this.activeRun();
    if (existing && !TERMINAL_STATUSES.has(existing.status)) {
      return this.resume(existing.runId);
    }

    const now = this.isoNow();
    const run: SyncRun = {
      runId: this.makeRunId(),
      mode: input.mode,
      status: "running",
      courseIds: input.courses.map((course) => course.id),
      currentCourseId: input.courses[0]?.id,
      startedAt: now,
      updatedAt: now,
      retryAttempt: 0,
      courseProgress: input.courses.map((course) => ({
        courseId: course.id,
        courseName: course.name,
        completedThreads: 0,
      })),
    };
    await this.repository.upsertSyncRun(run);
    await this.repository.appendSyncEvent({
      eventId: `${run.runId}:started`,
      runId: run.runId,
      category: "run_started",
      message: "Sync run started.",
      createdAt: now,
    });

    return this.processRun(run, input.courses);
  }

  async resume(runId?: string): Promise<RunSyncResult> {
    const run = runId ? await this.repository.getSyncRun(runId) : await this.activeRun();
    if (!run) {
      throw new Error("No active sync run to resume.");
    }

    const courses: ArchivedCourse[] = [];
    for (const courseId of run.courseIds) {
      const course = await this.repository.getCourse(courseId);
      courses.push(course ?? { id: courseId, name: courseId });
    }

    return this.processRun(run, courses);
  }

  async cancel(runId: string): Promise<SyncRun | undefined> {
    return this.repository.requestCancel(runId, this.isoNow());
  }

  async snapshot(): Promise<SyncSnapshot> {
    return this.repository.getSyncSnapshot();
  }

  private async processRun(run: SyncRun, courses: ArchivedCourse[]): Promise<RunSyncResult> {
    let currentRun: SyncRun = { ...run, status: run.status === "queued" ? "running" : run.status };
    const outcomes: SyncOutcome[] = [];

    for (const course of courses) {
      currentRun = await this.markCurrentCourse(currentRun, course);
      const courseResult = await this.processCourse(currentRun, course);
      currentRun = courseResult.run;
      outcomes.push(courseResult.outcome);

      if (currentRun.status === "waiting_retry") {
        return { run: currentRun, outcome: "partial" };
      }

      if (courseResult.outcome === "cancelled" || courseResult.outcome === "auth_expired") {
        return { run: currentRun, outcome: courseResult.outcome };
      }
    }

    const outcome = outcomes.includes("failed")
      ? "partial"
      : outcomes.includes("partial")
        ? "partial"
        : "success";
    currentRun = {
      ...currentRun,
      status: outcome,
      finishedAt: this.isoNow(),
      updatedAt: this.isoNow(),
      message: outcome === "success" ? "Sync completed." : "Sync completed with partial results.",
    };
    await this.repository.upsertSyncRun(currentRun);
    return { run: currentRun, outcome };
  }

  private async processCourse(run: SyncRun, course: ArchivedCourse): Promise<{ run: SyncRun; outcome: SyncOutcome }> {
    await this.repository.putCourse(course);
    const checkpoint = await this.repository.getCourseCheckpoint(course.id);
    const listResult = await this.provider.listUpdatedThreads(course, checkpoint);
    if (!listResult.ok) {
      return this.failOrPause(run, course.id, listResult);
    }

    const completed = new Set<string>();
    const remaining = listResult.data.threads;
    let currentRun = updateCourseProgress(run, course.id, {
      courseName: course.name,
      completedThreads: completed.size,
      totalThreads: listResult.data.totalThreads ?? listResult.data.threads.length,
    });
    await this.repository.upsertSyncRun(currentRun);

    for (let index = 0; index < remaining.length; index += this.maxThreadConcurrency) {
      const latestRun = await this.repository.getSyncRun(run.runId);
      if (latestRun?.cancelRequested) {
        const cancelled = finishCourse(latestRun, course.id, "cancelled", "Sync cancelled.");
        await this.repository.upsertSyncRun(cancelled);
        return { run: cancelled, outcome: "cancelled" };
      }

      const batch = remaining.slice(index, index + this.maxThreadConcurrency);
      const detailResults = await Promise.all(
        batch.map(async (summary) => ({
          summary,
          result: await this.provider.fetchThread(course, summary.threadId),
        })),
      );

      for (const { summary, result } of detailResults) {
        if (!result.ok) {
          return this.failOrPause(currentRun, course.id, result);
        }

        const nextCompleted = [...completed, summary.threadId];
        const nextCheckpoint: CourseCheckpoint = {
          courseId: course.id,
          runId: run.runId,
          lastThreadId: summary.threadId,
          completedThreadIds: nextCompleted,
          watermark: listResult.data.watermark ?? summary.updatedAt ?? checkpoint?.watermark,
          watermarkEvidence: listResult.data.watermarkEvidence ?? (summary.updatedAt ? "thread_updated_at" : checkpoint?.watermarkEvidence),
          nextCursor: listResult.data.nextCursor,
          retryAttempt: 0,
          updatedAt: this.isoNow(),
        };
        const bundle: ThreadArchiveBundle = {
          course,
          thread: result.data.thread,
          posts: result.data.posts,
          checkpoint: nextCheckpoint,
        };
        await this.repository.persistThreadWithCheckpoint(bundle);
        completed.add(summary.threadId);
        const postPersistRun = (await this.repository.getSyncRun(run.runId)) ?? currentRun;
        if (postPersistRun.cancelRequested) {
          const cancelled = finishCourse(
            { ...postPersistRun, status: "cancelled", finishedAt: this.isoNow(), updatedAt: this.isoNow(), message: "Sync cancelled." },
            course.id,
            "cancelled",
            "Sync cancelled.",
          );
          await this.repository.upsertSyncRun(cancelled);
          return { run: cancelled, outcome: "cancelled" };
        }
        currentRun = updateCourseProgress(postPersistRun, course.id, {
          completedThreads: completed.size,
          totalThreads: listResult.data.totalThreads ?? listResult.data.threads.length,
        });
        currentRun = { ...currentRun, updatedAt: this.isoNow() };
        await this.repository.upsertSyncRun(currentRun);
      }
    }

    const success = finishCourse(currentRun, course.id, "success", "Course sync completed.");
    await this.repository.upsertSyncRun(success);
    return { run: success, outcome: "success" };
  }

  private async failOrPause(run: SyncRun, courseId: string, error: EdstemError): Promise<{ run: SyncRun; outcome: SyncOutcome }> {
    const decision = nextRetryDecision({
      kind: error.kind,
      retryAfterSeconds: error.retryAfterSeconds,
      attempt: run.retryAttempt,
      now: this.clock.now(),
      random: this.random,
    });

    if (decision.action === "pause_auth") {
      const paused = finishCourse(
        { ...run, status: "auth_expired", updatedAt: this.isoNow(), message: decision.message },
        courseId,
        "auth_expired",
        decision.message,
      );
      await this.repository.upsertSyncRun(paused);
      return { run: paused, outcome: "auth_expired" };
    }

    if (decision.action === "retry") {
      const waiting = applyRetryDecision(run, decision);
      await this.repository.upsertSyncRun(waiting);
      return { run: waiting, outcome: "partial" };
    }

    const failed = finishCourse(
      { ...run, status: "partial", updatedAt: this.isoNow(), message: error.message },
      courseId,
      "failed",
      error.message,
    );
    await this.repository.upsertSyncRun(failed);
    return { run: failed, outcome: "failed" };
  }

  private async markCurrentCourse(run: SyncRun, course: ArchivedCourse): Promise<SyncRun> {
    const updated = { ...run, currentCourseId: course.id, status: "running" as const, updatedAt: this.isoNow() };
    await this.repository.upsertSyncRun(updated);
    return updated;
  }

  private async activeRun(): Promise<SyncRun | undefined> {
    return (await this.repository.getSyncSnapshot()).activeRun;
  }

  private isoNow(): string {
    return this.clock.now().toISOString();
  }
}

function updateCourseProgress(
  run: SyncRun,
  courseId: string,
  patch: Partial<SyncRun["courseProgress"][number]>,
): SyncRun {
  return {
    ...run,
    courseProgress: run.courseProgress.map((progress) =>
      progress.courseId === courseId ? { ...progress, ...patch } : progress,
    ),
  };
}

function finishCourse(
  run: SyncRun,
  courseId: string,
  outcome: SyncOutcome,
  message: string,
): SyncRun {
  return updateCourseProgress(run, courseId, { outcome, message });
}

function applyRetryDecision(run: SyncRun, decision: Extract<RetryDecision, { action: "retry" }>): SyncRun {
  return {
    ...run,
    status: "waiting_retry",
    retryAttempt: decision.attempt,
    nextAttemptAt: decision.nextAttemptAt,
    updatedAt: new Date(new Date(decision.nextAttemptAt).getTime() - decision.delaySeconds * 1000).toISOString(),
    message: "Edstem asked the extension to retry later.",
  };
}
