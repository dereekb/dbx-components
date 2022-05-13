import { FirebaseOptions } from "firebase/app";
import { DbxFirebaseLoginModuleRootConfig } from "../auth/login/firebase.login.module";
import { DbxFirebaseEmulatorsConfig } from "./emulators";

export interface DbxFirebaseOptions extends FirebaseOptions, Pick<DbxFirebaseLoginModuleRootConfig, 'enabledLoginMethods'> {
  emulators: DbxFirebaseEmulatorsConfig;
}
