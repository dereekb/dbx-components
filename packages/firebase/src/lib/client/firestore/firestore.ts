import { FirestoreContextFactory, firestoreContextFactory } from "../../common/firestore/context";
import { firestoreClientDrivers } from "./driver";

/**
 * Creates a FirestoreContextFactory that uses the @firebase/firebase package.
 */
export const makeFirestoreContext: FirestoreContextFactory = firestoreContextFactory(firestoreClientDrivers());
