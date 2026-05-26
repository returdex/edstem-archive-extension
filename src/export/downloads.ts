import { sanitizeErrorMessage } from "../edstem/errors";
import { MarkdownExportFile } from "./types";

export interface DownloadedMarkdownFile {
  courseId: string;
  threadId: string;
  filename: string;
  downloadId?: number;
  error?: string;
}

export interface DownloadMarkdownResult {
  attempted: number;
  succeeded: number;
  failed: number;
  files: DownloadedMarkdownFile[];
}

export interface DownloadsApi {
  download(options: {
    url: string;
    filename: string;
    saveAs: false;
    conflictAction: "uniquify";
  }): Promise<number>;
  showDefaultFolder?(): Promise<void> | void;
}

export async function downloadMarkdownFiles(
  files: MarkdownExportFile[],
  downloadsApi: DownloadsApi = chrome.downloads,
): Promise<DownloadMarkdownResult> {
  const results: DownloadedMarkdownFile[] = [];

  for (const file of files) {
    try {
      const downloadId = await downloadsApi.download({
        url: markdownDataUrl(file.markdown),
        filename: file.filename,
        saveAs: false,
        conflictAction: "uniquify",
      });
      results.push({
        courseId: file.courseId,
        threadId: file.threadId,
        filename: file.filename,
        downloadId,
      });
    } catch (error) {
      results.push({
        courseId: file.courseId,
        threadId: file.threadId,
        filename: file.filename,
        error: sanitizeErrorMessage(error instanceof Error ? error.message : error),
      });
    }
  }

  const failed = results.filter((file) => file.error).length;
  return {
    attempted: files.length,
    succeeded: files.length - failed,
    failed,
    files: results,
  };
}

export async function openDownloadsFolder(downloadsApi: DownloadsApi = chrome.downloads): Promise<void> {
  await downloadsApi.showDefaultFolder?.();
}

function markdownDataUrl(markdown: string): string {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
}
