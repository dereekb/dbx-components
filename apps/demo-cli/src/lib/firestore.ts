import { cliFirestoreAccessorFactory } from '@dereekb/dbx-cli';
import { demoFirebaseModelServices, makeDemoFirestoreCollections } from 'demo-firebase';

/**
 * The one place `demo-cli` names its `DemoFirestoreCollections`.
 *
 * Registering the app's collections factory + model services here does two jobs at once:
 *
 * - `demoCliFirestore.binding` is the single binding IDENTITY handed to `runCli`, the doctor check, and
 *   the test fixture. One identity across all three is what lets the accessor reuse the context's
 *   memoized collections instead of building a second copy.
 * - `await demoCliFirestore(context)` hands an action the collections at their real
 *   `DemoFirestoreCollections` type and `serviceFor('guestbook')` at its real `GuestbookDocument` —
 *   so an action no longer has to call `makeDemoFirestoreCollections` itself just to recover the types
 *   the CLI boundary used to erase.
 */
export const demoCliFirestore = cliFirestoreAccessorFactory({ collections: makeDemoFirestoreCollections, models: demoFirebaseModelServices });
