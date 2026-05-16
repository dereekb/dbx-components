/**
 * Marker interface for a Firestore model whose document id IS the id of a
 * record in an external system (e.g. a Zoho candidate id, a CheckHQ payroll
 * id, a Typeform response id). Generic over a phantom `TId` discriminator so
 * different external systems' ids do not interchange at compile-time.
 *
 * The phantom `__externalIdType` field is never persisted — it only exists in
 * the TypeScript surface so semantic-typed external-id aliases (`type
 * HellosubsZohoRecruitCandidateId = string`) flow through.
 *
 * The `extract-firebase-models` extractor recognises the exact-name marker
 * and emits the `external-id-keyed-entity-root` archetype on the model.
 */
export interface ExternalRelatedById<TId extends string = string> {
  /** Phantom type discriminator; never persisted. */
  readonly __externalIdType?: TId;
}
