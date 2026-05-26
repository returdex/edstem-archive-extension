import { ArchivedPost } from "../sync/types";
import { ThreadMarkdownInput } from "./types";

export function renderThreadMarkdown(input: ThreadMarkdownInput): string {
  const orderedPosts = orderPosts(input.posts);
  const lines = [
    `# ${escapeHeading(input.thread.title)}`,
    "",
    `Course: ${input.course.name}`,
    `Course ID: ${input.course.id}`,
    `Thread ID: ${input.thread.threadId}`,
  ];

  if (input.thread.number !== undefined) {
    lines.push(`Thread Number: ${input.thread.number}`);
  }
  if (input.thread.category) {
    lines.push(`Category: ${input.thread.category}`);
  }
  if (input.thread.createdAt) {
    lines.push(`Created: ${input.thread.createdAt}`);
  }
  if (input.thread.updatedAt) {
    lines.push(`Updated: ${input.thread.updatedAt}`);
  }

  lines.push("", "---", "");

  if (orderedPosts.length === 0) {
    lines.push("_No archived posts were found for this thread._", "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  for (const { post, depth } of orderedPosts) {
    lines.push(renderPostHeading(post, depth), "", normalizePostBody(post.body), "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function orderPosts(posts: ArchivedPost[]): Array<{ post: ArchivedPost; depth: number }> {
  const sorted = [...posts].sort(comparePosts);
  const children = new Map<string | undefined, ArchivedPost[]>();
  for (const post of sorted) {
    const key = post.parentPostId || undefined;
    children.set(key, [...(children.get(key) ?? []), post]);
  }

  const ordered: Array<{ post: ArchivedPost; depth: number }> = [];
  const visited = new Set<string>();

  function visit(parentId: string | undefined, depth: number): void {
    for (const post of children.get(parentId) ?? []) {
      if (visited.has(post.postId)) {
        continue;
      }
      visited.add(post.postId);
      ordered.push({ post, depth });
      visit(post.postId, depth + 1);
    }
  }

  visit(undefined, 0);
  for (const post of sorted) {
    if (!visited.has(post.postId)) {
      visited.add(post.postId);
      ordered.push({ post, depth: 0 });
    }
  }

  return ordered;
}

function comparePosts(left: ArchivedPost, right: ArchivedPost): number {
  const leftTime = Date.parse(left.createdAt ?? "");
  const rightTime = Date.parse(right.createdAt ?? "");
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.postId.localeCompare(right.postId);
}

function renderPostHeading(post: ArchivedPost, depth: number): string {
  const level = "#".repeat(Math.min(6, 2 + depth));
  const author = post.authorName ? ` by ${post.authorName}` : "";
  const role = post.authorRole ? ` (${post.authorRole})` : "";
  const date = post.createdAt ? ` - ${post.createdAt}` : "";
  return `${level} Post${author}${role}${date}`;
}

function normalizePostBody(body: string): string {
  const stripped = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return stripped || "_No post body was archived._";
}

function escapeHeading(value: string): string {
  return value.replace(/^#+\s*/, "").trim() || "Untitled thread";
}
