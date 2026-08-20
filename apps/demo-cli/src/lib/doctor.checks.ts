import { createFirestoreSessionDoctorCheck, type DoctorCheck, type FirestoreSessionDoctorProbe } from '@dereekb/dbx-cli';
import { limit } from '@dereekb/firebase';
import { makeDemoFirestoreCollections, profileIdentity } from 'demo-firebase';
import { demoCliFirestore } from './firestore';
import { DEMO_CLI_MODEL_MANIFEST } from './manifest/api.manifest.generated';
import { DEMO_CLI_FIRESTORE_QUERY_MANIFEST } from './manifest/query.manifest.generated';

/**
 * The rules-protected read that proves the direct-Firestore session is genuinely usable.
 *
 * Lists one `Profile`, which `firestore.rules` allows only for a sysadmin
 * (`allow list: if userClaimsIsSysAdmin()` on `/pr`). A success therefore proves three things at
 * once: the exchanged ID token carried the user's stored `a` admin claim, the rules evaluated it, and
 * (outside the emulators) the App Check attestation was accepted.
 *
 * Deliberately built through `makeDemoFirestoreCollections` rather than a raw `getDocs` — that is the
 * point of the session bridge, so the check exercises the same collections object the Angular app
 * builds off the same `FirestoreContext` interface.
 *
 * @param context - The live session context whose `firestoreContext` the read is issued through.
 * @returns The number of profiles the rules-protected list returned.
 */
const demoFirestoreSessionProbe: FirestoreSessionDoctorProbe = async (context) => {
  const collections = makeDemoFirestoreCollections(context.firestoreContext);
  const docs = await collections.profileCollection.queryDocument(limit(1)).getDocs();
  return { profilesRead: docs.length };
};

/**
 * Demo-specific doctor checks that augment the dbx-cli built-in suite.
 */
export const DEMO_DOCTOR_CHECKS: DoctorCheck[] = [
  createFirestoreSessionDoctorCheck({
    probe: demoFirestoreSessionProbe,
    probeName: `list ${profileIdentity.collectionName} (admin-only)`,
    // doctor runs PRE-AUTH with no CliContext, so the binding + manifests have to be handed to it
    // explicitly for it to report the `--via auto` read preference and the catalog/server-only counts
    firestore: demoCliFirestore.binding,
    modelManifest: DEMO_CLI_MODEL_MANIFEST,
    firestoreQueryManifest: DEMO_CLI_FIRESTORE_QUERY_MANIFEST
  })
];
