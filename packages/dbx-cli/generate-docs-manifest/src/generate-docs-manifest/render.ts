import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { buildDocsManifest, type BuildDocsManifestResult, type DocsManifestFinding, type DocsManifestSourceFile } from '../../../src/lib/docs/index.js';

/**
 * OS litter that is skipped instead of reported.
 */
const IGNORED_DOCS_FILE_NAMES = new Set(['.DS_Store']);

/**
 * Result of {@link scanDocsFolder}.
 */
export interface ScanDocsFolderResult {
  readonly files: readonly DocsManifestSourceFile[];
  readonly findings: readonly DocsManifestFinding[];
}

/**
 * Reads every markdown file under the docs folder.
 *
 * Reports (as errors) a non-`.md` file, a dotfile or dot-directory (Firebase's `ignore: "**\/.*"` would drop it at
 * deploy), and a symlink that resolves outside the folder. A symlink that stays inside is followed.
 *
 * @param docsDir - Absolute path to the docs folder.
 * @returns The markdown files (POSIX paths relative to the folder, sorted) and the findings.
 */
export async function scanDocsFolder(docsDir: string): Promise<ScanDocsFolderResult> {
  const root = await realpath(docsDir);
  const files: DocsManifestSourceFile[] = [];
  const findings: DocsManifestFinding[] = [];
  const visitedDirs = new Set<string>();

  async function visit(dir: string): Promise<void> {
    const realDir = await realpath(dir);

    if (visitedDirs.has(realDir)) {
      return;
    }

    visitedDirs.add(realDir);

    const names = (await readdir(dir)).sort((a, b) => (a < b ? -1 : 1)); // code-unit order; names in one directory are unique

    for (const name of names) {
      if (IGNORED_DOCS_FILE_NAMES.has(name)) {
        continue;
      }

      const fullPath = join(dir, name);
      const path = relative(docsDir, fullPath).split(sep).join('/');
      const linkStat = await lstat(fullPath);
      let targetPath = fullPath;

      if (linkStat.isSymbolicLink()) {
        targetPath = await realpath(fullPath).catch(() => '');

        if (targetPath === '' || (targetPath !== root && !targetPath.startsWith(`${root}${sep}`))) {
          findings.push({ code: 'DOCS_SYMLINK_ESCAPE', severity: 'error', path, message: 'Symlink resolves outside the docs folder (or is broken).' });
          continue;
        }
      }

      if (name.startsWith('.')) {
        findings.push({ code: 'DOCS_DOTFILE', severity: 'error', path, message: 'Dotfiles and dot-directories are dropped at deploy (Firebase ignores "**/.*"). Rename it.' });
        continue;
      }

      const stat = await lstat(targetPath);

      if (stat.isDirectory()) {
        await visit(fullPath);
      } else if (name.toLowerCase().endsWith('.md')) {
        files.push({ path, content: await readFile(targetPath) });
      } else {
        findings.push({ code: 'DOCS_NOT_MARKDOWN', severity: 'error', path, message: 'Only .md files belong in the docs folder.' });
      }
    }
  }

  await visit(docsDir);
  return { files, findings };
}

/**
 * Input for {@link renderDocsManifest}.
 */
export interface RenderDocsManifestInput {
  readonly docsDir: string;
  readonly app: string;
  readonly audiences: readonly string[];
  readonly defaultAudience?: readonly string[];
  /**
   * Allows a folder with no docs (a pipeline set up before content exists). Otherwise an empty folder is an error.
   */
  readonly allowEmpty?: boolean;
  readonly generatedAt?: Date;
}

/**
 * Scans the docs folder and builds the manifest. Scan findings come first, then the per-doc findings.
 *
 * @param input - The folder, app and audience rules.
 * @returns The manifest and every finding.
 */
export async function renderDocsManifest(input: RenderDocsManifestInput): Promise<BuildDocsManifestResult> {
  const { docsDir, app, audiences, defaultAudience, allowEmpty, generatedAt } = input;
  const scan = await scanDocsFolder(docsDir);
  const built = buildDocsManifest({ app, audiences, defaultAudience, files: scan.files, generatedAt });
  const findings = [...scan.findings, ...built.findings];

  if (built.manifest.docs.length === 0 && !allowEmpty && findings.every((x) => x.severity !== 'error')) {
    findings.push({ code: 'DOCS_EMPTY', severity: 'error', message: 'The docs folder has no docs. Pass --allow-empty while the content does not exist yet.' });
  }

  return { manifest: built.manifest, findings };
}

/**
 * Input for {@link countDocsManifestGenerationErrors}.
 */
export interface CountDocsManifestGenerationErrorsInput {
  readonly findings: readonly DocsManifestFinding[];
  /**
   * Counts warnings as errors.
   */
  readonly strict?: boolean;
}

/**
 * Counts the findings that fail generation.
 *
 * @param input - The findings and the strict flag.
 * @returns The number of blocking findings.
 */
export function countDocsManifestGenerationErrors(input: CountDocsManifestGenerationErrorsInput): number {
  return input.findings.filter((x) => x.severity === 'error' || input.strict).length;
}

/**
 * Formats one finding as a log line.
 *
 * @param finding - The finding.
 * @returns E.g. `[error] DOCS_AUDIENCE_UNKNOWN guides/setup.md: Unknown audience(s) "school". ...`
 */
export function formatDocsManifestFinding(finding: DocsManifestFinding): string {
  const location = finding.path == null ? '' : ' ' + finding.path;
  return `[${finding.severity}] ${finding.code}${location}: ${finding.message}`;
}
