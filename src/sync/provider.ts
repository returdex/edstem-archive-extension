import { edstemFetch } from "../edstem/client";
import { EdstemResult } from "../edstem/errors";
import { ArchivedCourse, ArchivedPost } from "./types";
import {
  DiscussionProvider,
  DiscussionThreadDetail,
  DiscussionThreadSummary,
  ProviderResult,
  ThreadListPage,
} from "./engine";

export type EdstemFetcher = <T>(path: string) => Promise<EdstemResult<T>>;

export function createEdstemDiscussionProvider(fetcher: EdstemFetcher = edstemFetch): DiscussionProvider {
  return {
    async listUpdatedThreads(course, checkpoint) {
      const offset = checkpoint?.nextCursor ?? "0";
      const params = new URLSearchParams({
        limit: "30",
        offset,
        sort: "new",
      });
      const result = await fetcher<unknown>(
        `/api/courses/${encodeURIComponent(course.id)}/threads?${params.toString()}`,
      );
      return mapResult(result, (payload) => normalizeThreadList(payload));
    },

    async fetchThread(course, threadId) {
      const result = await fetcher<unknown>(`/api/threads/${encodeURIComponent(threadId)}`);
      return mapResult(result, (payload) => normalizeThreadDetail(course, threadId, payload));
    },
  };
}

function mapResult<T>(
  result: EdstemResult<unknown>,
  normalize: (payload: unknown) => T,
): ProviderResult<T> {
  if (!result.ok) {
    return result;
  }
  return { ok: true, data: normalize(result.data) };
}

export function normalizeThreadList(payload: unknown): ThreadListPage {
  const root = asRecord(payload);
  const candidates =
    asArray(root.threads) ??
    asArray(root.posts) ??
    asArray(root.data) ??
    asArray(asRecord(root.data).threads) ??
    asArray(asRecord(root.results).threads) ??
    asArray(root.results) ??
    [];
  const threads = candidates.flatMap(normalizeThreadSummary);
  return {
    threads,
    totalThreads: numberValue(root.total) ?? numberValue(root.count) ?? threads.length,
    nextCursor:
      stringValue(root.next_cursor) ??
      stringValue(root.nextCursor) ??
      nextOffset(root, threads),
    watermark: stringValue(root.watermark) ?? newestUpdatedAt(threads),
    watermarkEvidence: newestUpdatedAt(threads) ? "thread_updated_at" : undefined,
  };
}

export function normalizeThreadDetail(
  course: ArchivedCourse,
  fallbackThreadId: string,
  payload: unknown,
): DiscussionThreadDetail {
  const root = asRecord(payload);
  const threadRecord = asRecord(root.thread ?? root.data ?? root);
  const threadId = stringValue(threadRecord.id) ?? stringValue(threadRecord.thread_id) ?? fallbackThreadId;
  const thread = {
    courseId: course.id,
    threadId,
    title: stringValue(threadRecord.title) ?? stringValue(threadRecord.name) ?? `Thread ${threadId}`,
    number: numberValue(threadRecord.number),
    category: stringValue(threadRecord.category),
    createdAt: stringValue(threadRecord.created_at) ?? stringValue(threadRecord.createdAt),
    updatedAt: stringValue(threadRecord.updated_at) ?? stringValue(threadRecord.updatedAt),
    authorName: stringValue(asRecord(threadRecord.user).name) ?? stringValue(threadRecord.author_name),
    authorRole: stringValue(asRecord(threadRecord.user).role) ?? stringValue(threadRecord.author_role),
  };

  const posts = normalizeDiscussionPosts(course.id, threadId, root, threadRecord);

  return { thread, posts };
}

function normalizeDiscussionPosts(
  courseId: string,
  threadId: string,
  root: Record<string, unknown>,
  threadRecord: Record<string, unknown>,
): ArchivedPost[] {
  const posts: ArchivedPost[] = [];
  const seen = new Set<string>();
  const body = bodyValue(threadRecord);
  if (body) {
    const rootPost = {
      courseId,
      threadId,
      postId: stringValue(threadRecord.id) ?? threadId,
      body,
      authorName: stringValue(asRecord(threadRecord.user).name) ?? stringValue(threadRecord.author_name),
      authorRole: stringValue(asRecord(threadRecord.user).role) ?? stringValue(threadRecord.author_role),
      createdAt: stringValue(threadRecord.created_at) ?? stringValue(threadRecord.createdAt),
      updatedAt: stringValue(threadRecord.updated_at) ?? stringValue(threadRecord.updatedAt),
    };
    posts.push(rootPost);
    seen.add(rootPost.postId);
  }

  for (const post of normalizeNestedPosts(courseId, threadId, commentSources(root, threadRecord), undefined, seen)) {
    posts.push(post);
  }

  return posts;
}

function normalizeNestedPosts(
  courseId: string,
  threadId: string,
  candidates: unknown[],
  parentPostId: string | undefined,
  seen: Set<string>,
  idPrefix = "post",
): ArchivedPost[] {
  const posts: ArchivedPost[] = [];

  candidates.forEach((candidate, index) => {
    const record = asRecord(candidate);
    if (Object.keys(record).length === 0) {
      return;
    }

    const postId =
      stringValue(record.id) ??
      stringValue(record.post_id) ??
      stringValue(record.postId) ??
      stringValue(record.comment_id) ??
      stringValue(record.answer_id) ??
      `${threadId}-${idPrefix}-${index + 1}`;
    const body = bodyValue(record);
    const explicitParentId = stringValue(record.parent_id) ?? stringValue(record.parentPostId);
    const effectiveParentId = explicitParentId ?? parentPostId;

    if (body && !seen.has(postId)) {
      seen.add(postId);
      posts.push({
        courseId,
        threadId,
        postId,
        parentPostId: effectiveParentId,
        body,
        authorName: stringValue(asRecord(record.user).name) ?? stringValue(record.author_name),
        authorRole: stringValue(asRecord(record.user).role) ?? stringValue(record.author_role),
        createdAt: stringValue(record.created_at) ?? stringValue(record.createdAt),
        updatedAt: stringValue(record.updated_at) ?? stringValue(record.updatedAt),
      });
    }

    const nestedParentId = body ? postId : effectiveParentId;
    posts.push(
      ...normalizeNestedPosts(
        courseId,
        threadId,
        childPostSources(record),
        nestedParentId,
        seen,
        `${idPrefix}-${index + 1}`,
      ),
    );
  });

  return posts;
}

function commentSources(root: Record<string, unknown>, threadRecord: Record<string, unknown>): unknown[] {
  return [
    ...childPostSources(root),
    ...childPostSources(threadRecord),
  ];
}

function childPostSources(record: Record<string, unknown>): unknown[] {
  return [
    ...postSourceValue(record.comments),
    ...postSourceValue(record.posts),
    ...postSourceValue(record.replies),
    ...postSourceValue(record.answers),
    ...postSourceValue(record.answer),
    ...postSourceValue(record.accepted_answer),
    ...postSourceValue(record.children),
  ];
}

function postSourceValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return Object.keys(asRecord(value)).length > 0 ? [value] : [];
}

function bodyValue(record: Record<string, unknown>): string | undefined {
  for (const key of [
    "body",
    "content",
    "text",
    "html",
    "markdown",
    "document",
    "question",
    "description",
    "details",
    "message",
    "question_html",
  ]) {
    const value = richTextValue(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function richTextValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (Array.isArray(value)) {
    const joined = value.map(richTextValue).filter(Boolean).join("\n").trim();
    return joined || undefined;
  }
  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  for (const key of ["html", "body", "content", "text", "markdown", "document"]) {
    const nested = richTextValue(record[key]);
    if (nested) {
      return nested;
    }
  }

  const proseMirrorText = proseMirrorNodeText(record);
  return proseMirrorText || undefined;
}

function proseMirrorNodeText(record: Record<string, unknown>): string {
  const text = stringValue(record.text);
  const children = arrayValue(record.content)
    .map((child) => proseMirrorNodeText(asRecord(child)))
    .filter(Boolean)
    .join(record.type === "paragraph" ? "" : "\n");
  return [text, children].filter(Boolean).join("");
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeThreadSummary(candidate: unknown): DiscussionThreadSummary[] {
  const record = asRecord(candidate);
  const source = asRecord(record.thread ?? record.post ?? record);
  const threadId = stringValue(source.id) ?? stringValue(source.thread_id) ?? stringValue(source.threadId);
  const title = stringValue(source.title) ?? stringValue(source.name);
  if (!threadId || !title) {
    return [];
  }
  return [
    {
      threadId,
      title,
      updatedAt: stringValue(source.updated_at) ?? stringValue(source.updatedAt),
    },
  ];
}

function newestUpdatedAt(threads: DiscussionThreadSummary[]): string | undefined {
  return threads.map((thread) => thread.updatedAt).filter(Boolean).sort().at(-1);
}

function nextOffset(root: Record<string, unknown>, threads: DiscussionThreadSummary[]): string | undefined {
  const pagination = asRecord(root.pagination);
  const limit = numberValue(pagination.limit) ?? numberValue(root.limit);
  const offset = numberValue(pagination.offset) ?? numberValue(root.offset);
  if (!limit || offset === undefined || threads.length < limit) {
    return undefined;
  }
  return String(offset + threads.length);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
