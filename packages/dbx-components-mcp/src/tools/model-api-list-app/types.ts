/**
 * Types for `dbx_model_api_list_app`.
 */

import type { CrudEntry } from '../model-api-shared/types.js';

export interface ApiListEntry extends CrudEntry {
  /**
   * Source `.api.ts` file path relative to the component package root.
   */
  readonly sourceFile: string;
}

export interface ApiListFileSummary {
  readonly sourceFile: string;
  readonly groupName: string | undefined;
  readonly modelKeys: readonly string[];
  readonly counts: ApiListVerbCounts;
}

export interface ApiListVerbCounts {
  readonly create: number;
  readonly read: number;
  readonly update: number;
  readonly delete: number;
  readonly query: number;
  readonly standalone: number;
}

export interface ApiListReport {
  /**
   * Caller-supplied component directory (relative path).
   */
  readonly componentDir: string;
  readonly modelRoot: string;
  readonly entries: readonly ApiListEntry[];
  readonly files: readonly ApiListFileSummary[];
  /**
   * Optional model filter applied to the entries (bare model name, e.g.
   * `Profile`). When set, `entries` only contains rows whose `model` matches
   * the filter (case-insensitive comparison after camel-stripping).
   */
  readonly modelFilter: string | undefined;
}
