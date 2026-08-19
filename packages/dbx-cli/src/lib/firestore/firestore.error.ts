import { type Maybe } from '@dereekb/util';
import { type CliErrorMapper, type CliErrorOutput } from '../util/output';

/**
 * Firestore's `FAILED_PRECONDITION` message embeds a console URL that creates the missing index.
 * It is the single most useful thing in that error, so it is lifted into the suggestion.
 */
const CREATE_INDEX_URL = /https:\/\/console\.firebase\.google\.com\/\S+/;

interface FirebaseErrorLike {
  readonly code: string;
  readonly message: string;
}

/**
 * Narrows a thrown value to a client-SDK `FirebaseError`.
 *
 * Structural rather than `instanceof`: `FirebaseError` is a class in `@firebase/util`, and a CLI
 * bundling `firebase` alongside an app that bundles its own copy would fail the identity check.
 *
 * @param error - The thrown value.
 * @returns The narrowed error, or `undefined` when it is not a coded Firebase error.
 */
function asFirebaseError(error: unknown): Maybe<FirebaseErrorLike> {
  let result: Maybe<FirebaseErrorLike>;

  if (error instanceof Error && 'code' in error) {
    const code = (error as { readonly code?: unknown }).code;

    if (typeof code === 'string' && code.length > 0) {
      result = { code, message: error.message };
    }
  }

  return result;
}

/**
 * Maps a client-SDK `FirebaseError` onto the CLI's error envelope.
 *
 * Without this a rules rejection falls through `buildErrorOutput` to a bare
 * `{ ok: false, code: 'ERROR' }` — indistinguishable from any other failure, which is exactly the
 * wrong answer for the one error the direct path exists to surface honestly.
 *
 * @param error - The thrown value.
 * @returns The mapped envelope, or `undefined` to defer to the built-in branches.
 *
 * @__NO_SIDE_EFFECTS__
 */
export const cliFirestoreErrorMapper: CliErrorMapper = (error: unknown): Maybe<CliErrorOutput> => {
  const firebaseError = asFirebaseError(error);
  let result: Maybe<CliErrorOutput>;

  if (firebaseError) {
    const bare = firebaseError.code.replace(/^[a-z-]+\//, '');

    if (bare === 'permission-denied') {
      result = {
        ok: false,
        error: firebaseError.message,
        code: 'AUTH_FORBIDDEN',
        suggestion: 'Firestore security rules refused this read for the signed-in user. This is a real answer about that document — the CLI deliberately does not retry it over the model API.'
      };
    } else if (bare === 'not-found') {
      result = { ok: false, error: firebaseError.message, code: 'NOT_FOUND' };
    } else if (bare === 'failed-precondition') {
      const url = CREATE_INDEX_URL.exec(firebaseError.message)?.[0];
      result = {
        ok: false,
        error: firebaseError.message,
        code: 'FIRESTORE_MISSING_INDEX',
        suggestion: url ? `Firestore needs an index for this query. Create it: ${url} — then add the query's factory to firestore.indexes.json via \`@dbxModelFirebaseIndex\` so it is not lost on the next deploy.` : 'Firestore needs an index for this query. Tag the query factory with `@dbxModelFirebaseIndex` and regenerate firestore.indexes.json.'
      };
    } else if (bare === 'unauthenticated') {
      result = { ok: false, error: firebaseError.message, code: 'AUTH_UNAUTHORIZED', suggestion: 'The direct-Firestore session is not signed in. Re-run with `--verbose`, or run `doctor` to diagnose the session handshake.' };
    }
  }

  return result;
};
