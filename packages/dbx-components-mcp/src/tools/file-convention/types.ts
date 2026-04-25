/**
 * Shared types for `dbx_file_convention`.
 *
 * The tool returns canonical file paths + required exports + wiring
 * registrations for each supported artifact kind. Specs are pure
 * static data (no AST, no I/O) — they live in {@link `./spec.ts`}
 * and are rendered through {@link `./format.ts`}.
 */

export type ArtifactKind = 'firestore-model' | 'storagefile-purpose' | 'storagefile-upload-handler' | 'storagefile-processor' | 'storagefile-processor-subtask' | 'notification-template' | 'notification-task' | 'nestjs-model-module' | 'nestjs-function-module' | 'nestjs-app-module';

export interface FileConventionStep {
  /** Section heading rendered as `## <heading>` in the markdown output. */
  readonly heading: string;
  /** Primary file path template — supports placeholders (see below). */
  readonly path?: string;
  /** Alternative path templates (rendered as a "_OR_" sub-list). */
  readonly altPaths?: readonly string[];
  /** Body markdown — placeholders are substituted before rendering. */
  readonly body: string;
}

export interface FileConventionSpec {
  readonly artifact: ArtifactKind;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly FileConventionStep[];
  readonly seeAlso?: readonly ArtifactKind[];
  /** Optional verification command suggestion (e.g. "Run `dbx_validate_app_storagefiles`"). */
  readonly verify?: string;
}

/**
 * Placeholder substitutions applied to spec strings before rendering.
 * Empty values render the literal placeholder (e.g. `<componentDir>`).
 */
export interface PlaceholderValues {
  readonly componentDir: string | undefined;
  readonly apiDir: string | undefined;
  readonly name: string | undefined;
}

/**
 * The supported placeholder tokens. Listed for reference — the
 * formatter resolves these from {@link PlaceholderValues}.
 *
 * - `<componentDir>` — relative path to the `-firebase` component package.
 * - `<apiDir>` — relative path to the API app.
 * - `<name>` — kebab-case name (e.g. `user-avatar`).
 * - `<camelName>` — camelCase name (e.g. `userAvatar`).
 * - `<Name>` — PascalCase name (e.g. `UserAvatar`).
 * - `<NAME>` — SCREAMING_SNAKE name (e.g. `USER_AVATAR`).
 */
export type PlaceholderToken = '<componentDir>' | '<apiDir>' | '<name>' | '<camelName>' | '<Name>' | '<NAME>';
