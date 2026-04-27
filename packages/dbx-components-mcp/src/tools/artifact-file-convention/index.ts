/**
 * Pure entry point for `dbx_artifact_file_convention`. Returns the spec for
 * a given artifact kind, or undefined if no spec is registered.
 */

import { FILE_CONVENTIONS } from './spec.js';
import type { ArtifactKind, FileConventionSpec } from './types.js';

/**
 * Resolves the registered convention spec for the given artifact kind.
 *
 * @param artifact - the artifact kind to look up
 * @returns the matching spec, or `undefined` when no spec is registered
 */
export function getFileConventionSpec(artifact: ArtifactKind): FileConventionSpec | undefined {
  return FILE_CONVENTIONS.find((s) => s.artifact === artifact);
}

/**
 * Lists every artifact kind that has a registered convention spec, useful for
 * validation messages that need to enumerate the accepted values.
 *
 * @returns the array of registered artifact kinds in declaration order
 */
export function listArtifactKinds(): readonly ArtifactKind[] {
  return FILE_CONVENTIONS.map((s) => s.artifact);
}

export { FILE_CONVENTIONS } from './spec.js';
export { formatSpec } from './format.js';
export type { ArtifactKind, FileConventionSpec, FileConventionStep, PlaceholderValues } from './types.js';
