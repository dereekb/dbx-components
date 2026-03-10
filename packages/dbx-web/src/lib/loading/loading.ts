import { type DbxActionWorkOrWorkProgress, type DbxActionWorkProgress } from '@dereekb/dbx-core';

/**
 * Numeric progress value (0-100) for a loading indicator.
 */
export type DbxLoadingProgress = DbxActionWorkProgress;

/**
 * Loading state for a loading component, accepting either a boolean or numeric progress.
 *
 * - `true` triggers an indeterminate loading indicator
 * - A number (0-100) triggers a determinate progress indicator
 * - `false` or `undefined` hides the loading indicator
 */
export type DbxLoadingIsLoadingOrProgress = DbxActionWorkOrWorkProgress;
