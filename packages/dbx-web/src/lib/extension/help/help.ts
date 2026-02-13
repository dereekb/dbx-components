import { type Observable } from 'rxjs';

/**
 * Keys used for identifying help topics.
 */
export type DbxHelpContextKey = string;

/**
 * Reference object for tracking help context registrations.
 * Used internally to track multiple directives with the same context string.
 */
export interface DbxHelpContextReference {
  /**
   * Observable of context strings that this reference provides.
   */
  readonly helpContextKeys$: Observable<DbxHelpContextKey[]>;
}
