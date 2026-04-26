/**
 * I/O short-circuit violation reporter shared by the validate-app
 * `runRules` entry points.
 *
 * Each side's inspection can carry one of three statuses:
 * `'dir-not-found'`, `'folder-missing'`, or `'ok'`. The first two map
 * to per-domain violation codes that abort the content rule pipeline;
 * the third allows it to continue. {@link pushIoViolations} maps the
 * statuses to violations using a per-domain {@link IoViolationCodes}
 * lookup, builds the violation through a caller-supplied {@link build}
 * callback (so each domain keeps its `Violation` constructor and
 * severity defaults), and returns whether the content rules should run.
 */

import type { SideInspection } from './inspection.types.js';

/**
 * Per-side, per-status violation codes used by
 * {@link pushIoViolations}. `TCode` is each domain's `ViolationCode`
 * literal union.
 */
export interface IoViolationCodes<TCode extends string> {
  readonly componentDirNotFound: TCode;
  readonly componentFolderMissing: TCode;
  readonly apiDirNotFound: TCode;
  readonly apiFolderMissing: TCode;
}

/**
 * Per-domain message strings interpolated into the
 * {@link pushIoViolations} folder-missing reports.
 */
export interface IoViolationMessages {
  /**
   * Human-readable component folder path
   * (e.g. `'src/lib/model/storagefile/'`).
   */
  readonly componentFolderPath: string;
  /**
   * Human-readable api folder path or paths
   * (e.g. `'src/app/common/model/storagefile/ and src/app/common/model/notification/'`).
   */
  readonly apiFolderPath: string;
}

/**
 * Two-side inspection input accepted by {@link pushIoViolations}.
 */
export interface IoViolationInspection {
  readonly component: SideInspection;
  readonly api: SideInspection;
}

/**
 * Builds a per-domain `Violation` from the I/O code, the rendered
 * message, and the side. Each call site supplies its own constructor
 * so the produced violation stays in the per-domain shape (severity
 * default, `file: undefined` wiring, etc.).
 */
export type IoViolationBuilder<TCode extends string, TViolation> = (code: TCode, message: string, side: 'component' | 'api') => TViolation;

/**
 * Configuration for {@link pushIoViolations}.
 */
export interface PushIoViolationsConfig<TCode extends string, TViolation> {
  readonly inspection: IoViolationInspection;
  readonly violations: TViolation[];
  readonly codes: IoViolationCodes<TCode>;
  readonly messages: IoViolationMessages;
  readonly build: IoViolationBuilder<TCode, TViolation>;
}

/**
 * Walks both sides of the inspection, pushing one violation per
 * non-`'ok'` status onto {@link PushIoViolationsConfig.violations}.
 *
 * @param config - the inspection, mutable buffer, code lookup, message
 *   strings, and per-domain violation constructor
 * @returns `true` when both sides are `'ok'` and content rules should
 *   continue; `false` when at least one side short-circuited
 */
export function pushIoViolations<TCode extends string, TViolation>(config: PushIoViolationsConfig<TCode, TViolation>): boolean {
  const { inspection, violations, codes, messages, build } = config;
  if (inspection.component.status === 'dir-not-found') {
    violations.push(build(codes.componentDirNotFound, `Component directory \`${inspection.component.rootDir}\` does not exist.`, 'component'));
  } else if (inspection.component.status === 'folder-missing') {
    violations.push(build(codes.componentFolderMissing, `Component is missing \`${messages.componentFolderPath}\` (looked under \`${inspection.component.rootDir}\`).`, 'component'));
  }
  if (inspection.api.status === 'dir-not-found') {
    violations.push(build(codes.apiDirNotFound, `API directory \`${inspection.api.rootDir}\` does not exist.`, 'api'));
  } else if (inspection.api.status === 'folder-missing') {
    violations.push(build(codes.apiFolderMissing, `API is missing \`${messages.apiFolderPath}\` (looked under \`${inspection.api.rootDir}\`).`, 'api'));
  }
  return inspection.component.status === 'ok' && inspection.api.status === 'ok';
}
