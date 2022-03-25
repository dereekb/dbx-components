import { FirebaseOptions } from "firebase/app";
import { DbxFirebaseEmulatorsConfig } from "./emulators";

export interface DbxFirebaseOptions extends FirebaseOptions {
  emulators: DbxFirebaseEmulatorsConfig;
}
