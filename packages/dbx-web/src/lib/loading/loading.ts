import { type DbxActionWorkOrWorkProgress, type DbxActionWorkProgress } from '@dereekb/dbx-core';

export type DbxLoadingProgress = DbxActionWorkProgress;

/**
 * Loading progress for a loading component.
 *
 * Can be a boolean or a number.
 *
 * True is treated as an indeterminate loading state.
 */
export type DbxLoadingIsLoadingOrProgress = DbxActionWorkOrWorkProgress;
