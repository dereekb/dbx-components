/**
 * Shared types for `dbx_scaffold_artifact`.
 *
 * The tool generates copy-paste-ready body templates for downstream
 * dbx-components artifacts: a new `StorageFilePurpose`, a new
 * `NotificationTemplateType`, or a new `NotificationTaskType`. Sibling
 * to `dbx_file_convention` — that tool says where each artifact's
 * files live and what their exports look like; this tool emits the
 * actual TypeScript bodies.
 *
 * Pure templates — no AST. Token substitution happens once per
 * invocation against {@link NameTokens} derived from the caller's
 * `name` input.
 */

export type ArtifactKind = 'storagefile-purpose' | 'notification-template' | 'notification-task';

/** Camel/Pascal/Screaming-Snake/Kebab variants of the input name. */
export interface NameTokens {
  readonly camel: string;
  readonly pascal: string;
  readonly screaming: string;
  readonly kebab: string;
}

export interface ScaffoldArtifactOptions {
  /** storagefile-purpose: also emit subtask processor scaffold + processing constants. */
  readonly withProcessing?: boolean;
  /** notification-task: emit `unique: true` on the template factory. */
  readonly unique?: boolean;
  /** Place API handler inside `handlers/` subfolder. Default: true for tasks/uploads. */
  readonly handlersSubfolder?: boolean;
}

export interface ScaffoldArtifactInput {
  readonly artifact: ArtifactKind;
  readonly name: string;
  readonly componentDir: string;
  readonly apiDir: string;
  readonly options?: ScaffoldArtifactOptions;
}

export type EmittedFileStatus = 'new' | 'append' | 'exists-skipped';

/**
 * One emission produced by a render function. Either a brand-new
 * file (`new`), an append-only addition to an existing file
 * (`append`), or a skipped emission whose target already exists at
 * a path the user supplied (`exists-skipped`). The wrapper performs
 * the filesystem check and rewrites the status before the response
 * is rendered.
 */
export interface EmittedFile {
  readonly status: EmittedFileStatus;
  /** Path relative to the cwd where the file should be written. */
  readonly path: string;
  /** Markdown-friendly description shown above the code block. */
  readonly description: string;
  /** TypeScript body. Empty for `exists-skipped`. */
  readonly content: string;
}

/**
 * One step the caller must apply manually to existing files (imports,
 * array entries, registry additions). Defined per artifact to keep
 * the render functions free of filesystem mutations.
 */
export interface WiringStep {
  readonly file: string;
  readonly description: string;
  /** Optional code snippet to splice in. */
  readonly snippet?: string;
}

export interface ScaffoldArtifactResult {
  readonly artifact: ArtifactKind;
  readonly tokens: NameTokens;
  readonly files: readonly EmittedFile[];
  readonly wiring: readonly WiringStep[];
  readonly summary: string;
}
