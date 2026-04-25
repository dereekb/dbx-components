/**
 * Pure entry point for `dbx_file_convention`. Returns the spec for
 * a given artifact kind, or undefined if no spec is registered.
 */

import { FILE_CONVENTIONS } from './spec.js';
import type { ArtifactKind, FileConventionSpec } from './types.js';

export function getFileConventionSpec(artifact: ArtifactKind): FileConventionSpec | undefined {
  return FILE_CONVENTIONS.find((s) => s.artifact === artifact);
}

export function listArtifactKinds(): readonly ArtifactKind[] {
  return FILE_CONVENTIONS.map((s) => s.artifact);
}

export { FILE_CONVENTIONS } from './spec.js';
export { formatSpec } from './format.js';
export type { ArtifactKind, FileConventionSpec, FileConventionStep, PlaceholderValues } from './types.js';
