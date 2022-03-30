import { FirestoreContextFactory, firestoreContextFactory } from "../../common/firestore/context";
import { firestoreClientDrivers } from "./driver";

export const makeFirestoreContext: FirestoreContextFactory = firestoreContextFactory(firestoreClientDrivers());
