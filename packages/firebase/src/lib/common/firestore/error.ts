export function unsupportedFirestoreDriverFunctionError(message?: string) {
  throw new Error(message ?? 'This function is not supported by this Firestore driver.');
}
