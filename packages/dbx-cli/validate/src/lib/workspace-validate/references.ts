/**
 * Pure target-reference scanner.
 *
 * Turns arbitrary workspace text (a `project.json` command string, a CI
 * config, a shell script, an npm script) into {@link InspectedTargetReference}
 * records. Tokenised rather than regex-matched, because both Nx invocation
 * forms accept flags in positions a single pattern cannot straddle —
 * `nx run --parallel=1 workspace:version` is a real command in the wild.
 *
 * The scanner is deliberately conservative: anything it cannot resolve
 * statically (a shell variable, a CI interpolation) is skipped rather than
 * reported, so a finding from this cluster is never a guess.
 */

import type { InspectedTargetReference } from './types.js';

/**
 * Nx's own subcommands. A token in the target position that matches one of
 * these is not a project target, so the shorthand `nx <target> <project>`
 * reading does not apply.
 */
const NX_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'run',
  'run-many',
  'affected',
  'affected:graph',
  'affected:test',
  'affected:build',
  'graph',
  'dep-graph',
  'print-affected',
  'show',
  'list',
  'report',
  'migrate',
  'reset',
  'repair',
  'generate',
  'g',
  'add',
  'init',
  'import',
  'sync',
  'release',
  'format',
  'format:check',
  'format:write',
  'daemon',
  'connect',
  'login',
  'logout',
  'view-logs',
  'exec',
  'watch',
  'documentation',
  'help',
  'register',
  'record',
  'start-ci-run'
]);

/**
 * Characters that mark a token as shell- or CI-interpolated, and therefore
 * not statically resolvable.
 */
const INTERPOLATION_PATTERN = /[$`{}()*?]|\\\\/;

/**
 * Quote characters stripped from the head of a token.
 */
const TOKEN_LEADING_CHARS = `"'`;

/**
 * Quote and separator characters stripped from the tail of a token.
 */
const TOKEN_TRAILING_CHARS = `"',;`;

const PROJECT_TOKEN_PATTERN = /^[a-zA-Z0-9@][a-zA-Z0-9@/_.-]*$/;
const TARGET_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/;

/**
 * Whether a token is a CLI flag rather than a positional argument.
 *
 * @param token - A whitespace-delimited command token.
 * @returns `true` when the token starts with `-`.
 */
function isFlag(token: string): boolean {
  return token.startsWith('-');
}

/**
 * Whether a token can be used as a statically-resolved name.
 *
 * @param token - A whitespace-delimited command token.
 * @returns `true` when the token is free of shell/CI interpolation.
 */
function isResolvable(token: string): boolean {
  return token.length > 0 && !INTERPOLATION_PATTERN.test(token);
}

/**
 * Strips surrounding quotes and trailing separators from one raw token.
 *
 * Scanned by index rather than replaced with `/["',;]+$/`: an end-anchored
 * quantifier retries from every start position, which is quadratic on a token
 * of repeated quote characters.
 *
 * @param raw - One whitespace-delimited token.
 * @returns The token without its leading quotes or trailing quotes/separators.
 */
function trimTokenPunctuation(raw: string): string {
  let start = 0;
  let end = raw.length;
  while (start < end && TOKEN_LEADING_CHARS.includes(raw[start])) {
    start += 1;
  }
  while (end > start && TOKEN_TRAILING_CHARS.includes(raw[end - 1])) {
    end -= 1;
  }
  return raw.slice(start, end);
}

/**
 * Splits a command line into tokens, dropping quote characters. Good enough
 * for the shapes that appear in `project.json` commands and CI steps; a
 * genuinely ambiguous line simply yields tokens the resolvability check
 * rejects.
 *
 * @param text - One line of command text.
 * @returns The whitespace-delimited tokens with surrounding quotes stripped.
 */
function tokenize(text: string): readonly string[] {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const token = trimTokenPunctuation(raw);
    if (token.length > 0) {
      out.push(token);
    }
  }
  return out;
}

/**
 * Whether a token names the Nx binary (`nx`, `./node_modules/.bin/nx`, …).
 *
 * @param token - A whitespace-delimited command token.
 * @returns `true` when the token resolves to the Nx CLI.
 */
function isNxBinary(token: string): boolean {
  return token === 'nx' || token.endsWith('/nx');
}

/**
 * Whether a command changes directory out of the workspace before running.
 *
 * A command shaped `cd ~/setup-test/myproject && npx nx build myproject-api`
 * invokes Nx against a *different* workspace, so its project and target names
 * must not be resolved against this one. dbx-components' own CI does exactly
 * this to smoke-test a freshly scaffolded project.
 *
 * Only absolute and home-relative destinations count — a `cd` to a relative
 * subdirectory stays inside the workspace and its references remain valid.
 *
 * @param tokens - The command's tokens.
 * @returns `true` when the command runs Nx somewhere else.
 */
function changesToForeignDirectory(tokens: readonly string[]): boolean {
  let result = false;
  for (let i = 0; i < tokens.length - 1 && !result; i += 1) {
    if (tokens[i] === 'cd') {
      const destination = tokens[i + 1];
      result = destination.startsWith('~') || destination.startsWith('/');
    }
  }
  return result;
}

/**
 * Input for {@link scanTargetReferences}.
 */
export interface ScanTargetReferencesInput {
  readonly text: string;
  /**
   * Workspace-relative file the text came from.
   */
  readonly sourceFile: string;
  /**
   * The target whose command this is, when the text came from a `project.json`.
   */
  readonly sourceTarget?: string;
  /**
   * Line number to stamp on every reference found. Omit when scanning a
   * single command string pulled out of parsed JSON (the report then reads
   * as file-level).
   */
  readonly line?: number;
}

/**
 * Parses the reference that follows an `nx run` token.
 *
 * @param tokens - The full token list.
 * @param runIndex - Index of the `run` token.
 * @returns The parsed `project` / `target` / `configuration` triple, or `undefined` when the reference is absent or unresolvable.
 */
function parseExplicitForm(tokens: readonly string[], runIndex: number): { readonly project: string; readonly target: string; readonly configuration: string | undefined; readonly raw: string } | undefined {
  let result: { readonly project: string; readonly target: string; readonly configuration: string | undefined; readonly raw: string } | undefined;
  for (let i = runIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (isFlag(token)) {
      continue;
    }
    if (isResolvable(token) && token.includes(':')) {
      const [project, target, configuration] = token.split(':');
      if (project && target && PROJECT_TOKEN_PATTERN.test(project) && TARGET_TOKEN_PATTERN.test(target)) {
        result = { project, target, configuration: configuration || undefined, raw: token };
      }
    }
    break;
  }
  return result;
}

/**
 * Parses the shorthand `nx <target> <project>` form.
 *
 * @param tokens - The full token list.
 * @param nxIndex - Index of the Nx binary token.
 * @returns The parsed `project` / `target` pair, or `undefined` when the form does not apply.
 */
function parseShorthandForm(tokens: readonly string[], nxIndex: number): { readonly project: string; readonly target: string; readonly raw: string } | undefined {
  const positional: string[] = [];
  for (let i = nxIndex + 1; i < tokens.length && positional.length < 2; i += 1) {
    const token = tokens[i];
    if (!isFlag(token)) {
      positional.push(token);
    }
  }
  let result: { readonly project: string; readonly target: string; readonly raw: string } | undefined;
  const [target, project] = positional;
  if (target !== undefined && project !== undefined && !NX_SUBCOMMANDS.has(target) && !target.includes(':') && isResolvable(target) && isResolvable(project) && TARGET_TOKEN_PATTERN.test(target) && PROJECT_TOKEN_PATTERN.test(project)) {
    result = { project, target, raw: `${target} ${project}` };
  }
  return result;
}

/**
 * Scans one block of text for Nx target references.
 *
 * Handles both invocation forms and tolerates flags in any position. A
 * reference whose project or target token is shell-interpolated is skipped.
 *
 * @param input - The text, its provenance, and optional line/target stamps.
 * @returns Every reference found, in source order.
 */
export function scanTargetReferences(input: ScanTargetReferencesInput): readonly InspectedTargetReference[] {
  const { text, sourceFile, sourceTarget, line } = input;
  const references: InspectedTargetReference[] = [];
  const tokens = tokenize(text);

  if (changesToForeignDirectory(tokens)) {
    return references;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (!isNxBinary(tokens[i])) {
      continue;
    }
    // Locate the first positional after the binary to decide which form this is.
    let firstPositional: string | undefined;
    let firstPositionalIndex = -1;
    for (let j = i + 1; j < tokens.length; j += 1) {
      if (!isFlag(tokens[j])) {
        firstPositional = tokens[j];
        firstPositionalIndex = j;
        break;
      }
    }
    if (firstPositional === undefined) {
      continue;
    }
    if (firstPositional === 'run') {
      const parsed = parseExplicitForm(tokens, firstPositionalIndex);
      if (parsed) {
        references.push({ project: parsed.project, target: parsed.target, configuration: parsed.configuration, sourceFile, line, sourceTarget, raw: parsed.raw });
      }
    } else if (!NX_SUBCOMMANDS.has(firstPositional)) {
      const parsed = parseShorthandForm(tokens, i);
      if (parsed) {
        references.push({ project: parsed.project, target: parsed.target, configuration: undefined, sourceFile, line, sourceTarget, raw: parsed.raw });
      }
    }
  }

  return references;
}

/**
 * Strips the comment tail from a line of shell or YAML.
 *
 * Both `.sh` and `.circleci/config.yml` use `#`, and both routinely document
 * commands in prose — `# Call "npx nx start-release" to start a release`
 * tokenises into a perfectly well-formed shorthand reference to a project
 * named `to`. A commented-out command is likewise not a live reference.
 *
 * @param line - One raw line of the document.
 * @returns The line with any comment removed, empty when the whole line was a comment.
 */
function stripComment(line: string): string {
  const trimmed = line.trimStart();
  let result: string;
  if (trimmed.startsWith('#')) {
    result = '';
  } else {
    const index = line.indexOf(' #');
    result = index === -1 ? line : line.slice(0, index);
  }
  return result;
}

/**
 * Scans a multi-line document, stamping each reference with its 1-based line
 * number. Comment lines are skipped — a documented or commented-out command
 * is not a reference the workspace depends on.
 *
 * @param input - Shared call config.
 * @param input.text - The full document text.
 * @param input.sourceFile - The workspace-relative path the text came from.
 * @returns Every reference found, in source order.
 */
export function scanDocumentTargetReferences(input: { readonly text: string; readonly sourceFile: string }): readonly InspectedTargetReference[] {
  const { text, sourceFile } = input;
  const references: InspectedTargetReference[] = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    for (const reference of scanTargetReferences({ text: stripComment(line), sourceFile, line: index + 1 })) {
      references.push(reference);
    }
  }
  return references;
}

/**
 * Extracts the firebase hosting targets a command deploys to, from any
 * `--only hosting:<target>` / `--only=hosting:<target>` argument (including
 * the comma-joined multi-value form).
 *
 * @param command - One shell command string.
 * @returns The hosting target names named by the command.
 */
export function scanHostingTargets(command: string): readonly string[] {
  const out: string[] = [];
  const pattern = /hosting:([a-zA-Z0-9_-]+)/g;
  let match = pattern.exec(command);
  while (match !== null) {
    out.push(match[1]);
    match = pattern.exec(command);
  }
  return out;
}
