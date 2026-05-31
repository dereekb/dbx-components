/**
 * Minimal markdown parsing for change-log files. Avoids pulling in a full
 * markdown parser — the enforced format is shallow (one H1, a handful of H2
 * sections, one leading fenced block) so line-by-line scanning is sufficient.
 */

import { readFile } from 'node:fs/promises';
import type { LogFileRef, ParsedLog } from './types.js';

const MAX_SUMMARY_LENGTH = 1200;

/**
 * Reads and parses a single change-log file. Missing sections are returned as
 * `undefined` rather than throwing — historical logs predate the enforcement
 * hook and don't always have every section.
 *
 * @param ref - Discovered log-file metadata, including its absolute path.
 * @returns The parsed log; on read failure the entry is parsed against an
 *   empty body so the file still appears in results with `undefined` sections.
 */
export async function parseLog(ref: LogFileRef): Promise<ParsedLog> {
  let rawText = '';
  try {
    rawText = await readFile(ref.absolutePath, 'utf-8');
  } catch {
    rawText = '';
  }
  return parseLogText(ref, rawText);
}

/**
 * Pure parser exposed for testing without disk I/O.
 *
 * @param ref - Log-file metadata used to derive a fallback title from the
 *   filename when no H1 is present.
 * @param rawText - The full markdown body of the log file.
 * @returns The structured `ParsedLog` with title, ISO date, summary, and the
 *   leading fenced block split into commit subject/body.
 */
export function parseLogText(ref: LogFileRef, rawText: string): ParsedLog {
  const lines = rawText.split(/\r?\n/);
  const title = extractTitle(lines, ref);
  const date = extractSectionBody(lines, /^##\s+Date\s*$/i)
    ?.trim()
    .split(/\s+/)[0];
  const summary = extractSectionBody(lines, /^##\s+Summary\s*$/i)?.slice(0, MAX_SUMMARY_LENGTH);
  const { subject, body } = extractFirstFencedBlock(lines);
  const result: ParsedLog = {
    ref,
    title,
    date: isIsoDate(date) ? date : undefined,
    summary,
    commitSubject: subject,
    commitBody: body,
    rawText
  };
  return result;
}

function extractTitle(lines: readonly string[], ref: LogFileRef): string {
  let title = '';
  for (const line of lines) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match !== null) {
      title = match[1];
      break;
    }
  }
  if (title.length === 0) {
    title = ref.fileName.replace(/\.md$/i, '');
  }
  return title;
}

function extractSectionBody(lines: readonly string[], headingRegex: RegExp): string | undefined {
  let startIndex = -1;
  for (const [i, line] of lines.entries()) {
    if (headingRegex.test(line)) {
      startIndex = i + 1;
      break;
    }
  }
  let body: string | undefined;
  if (startIndex >= 0) {
    let endIndex = lines.length;
    for (let i = startIndex; i < lines.length; i += 1) {
      if (/^##\s+/.test(lines[i])) {
        endIndex = i;
        break;
      }
    }
    const slice = lines.slice(startIndex, endIndex).join('\n').trim();
    body = slice.length > 0 ? slice : undefined;
  }
  return body;
}

interface FencedBlock {
  readonly subject: string | undefined;
  readonly body: string | undefined;
}

function extractFirstFencedBlock(lines: readonly string[]): FencedBlock {
  const openIdx = findLineStarting(lines, '```', 0);
  let result: FencedBlock = { subject: undefined, body: undefined };
  if (openIdx >= 0) {
    const closeIdx = findLineStarting(lines, '```', openIdx + 1);
    if (closeIdx > openIdx) {
      result = sliceFencedBlock(lines, openIdx, closeIdx);
    }
  }
  return result;
}

function findLineStarting(lines: readonly string[], prefix: string, fromIndex: number): number {
  let found = -1;
  for (let i = fromIndex; i < lines.length; i += 1) {
    if (lines[i].startsWith(prefix)) {
      found = i;
      break;
    }
  }
  return found;
}

function sliceFencedBlock(lines: readonly string[], openIdx: number, closeIdx: number): FencedBlock {
  const inner = lines.slice(openIdx + 1, closeIdx);
  const subject = inner[0]?.trim();
  const body = inner.slice(2).join('\n').trim();
  return {
    subject: subject !== undefined && subject.length > 0 ? subject : undefined,
    body: body.length > 0 ? body : undefined
  };
}

function isIsoDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
