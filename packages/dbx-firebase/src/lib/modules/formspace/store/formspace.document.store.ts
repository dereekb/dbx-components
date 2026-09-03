import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { AppFormSpaceTypeConfigService, type FormSpace, type FormSpaceData, type FormSpaceDocument, type FormSpaceFile, type FormSpaceFileSlot, FormSpaceFirestoreCollections, FormSpaceFunctions, type FormSpaceSlotStatus, type FormSpaceSubmitBlocker, type FormSpaceTypeConfig, formSpaceFilesInSlot, formSpaceSlotStatus, formSpaceSubmitBlockers, isFormSpaceEditable, isFormSpaceFullyLocked, isFormSpaceReopenable } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type Observable, combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';

/**
 * Document store for a single {@link FormSpace}.
 *
 * Every write goes through a callable rather than the document, because `firestore.rules` denies client
 * writes to `/fsp` outright: each transition carries an invariant — the submit lock, the `eat` clear, the
 * monotonic upload counter — that a direct write would step around.
 *
 * Uploads are NOT here. A file reaches a space through the StorageFile pipeline
 * (`DbxFirebaseStorageFileUploadStore` writing to `formSpaceUploadsFilePath`, then the initializer), so the
 * only file operation this store owns is REMOVING one.
 */
@Injectable()
export class FormSpaceDocumentStore extends AbstractDbxFirebaseDocumentStore<FormSpace, FormSpaceDocument> {
  readonly formSpaceFunctions = inject(FormSpaceFunctions);

  /**
   * The app's FormSpace type registry, when it registered one via `provideDbxFirebaseFormSpaceTypeConfigService()`.
   *
   * OPTIONAL, so a page that only uploads and lists keeps working without it. Everything derived from it —
   * the submit blockers, the per-slot status, the submittable predicate — reports "unknown" rather than
   * guessing when it is absent, because guessing here means telling the user a space is ready to submit that
   * the server will refuse.
   */
  readonly appFormSpaceTypeConfigService = inject(AppFormSpaceTypeConfigService, { optional: true });

  constructor() {
    super({ firestoreCollection: inject(FormSpaceFirestoreCollections).formSpaceCollection });
  }

  readonly createFormSpace = firebaseDocumentStoreCreateFunction(this, this.formSpaceFunctions.formSpace.createFormSpace.create);

  /**
   * Replaces the space's stored JSON.
   *
   * `data` REPLACES rather than merges — the client owns the whole form — so a caller must pass the
   * complete object, not the fields that changed.
   */
  readonly updateFormSpace = firebaseDocumentStoreUpdateFunction(this, this.formSpaceFunctions.formSpace.updateFormSpace.update);
  readonly submitFormSpace = firebaseDocumentStoreUpdateFunction(this, this.formSpaceFunctions.formSpace.updateFormSpace.submit);

  /**
   * Returns a submitted space to an editable draft, if its type allows it and the window is still open.
   *
   * Gate a control on {@link isReopenable$} rather than on the state alone: whether a space may be reopened
   * is the type's policy, and offering the action to a space the server will refuse is the one thing the
   * predicate exists to prevent.
   */
  readonly reopenFormSpace = firebaseDocumentStoreUpdateFunction(this, this.formSpaceFunctions.formSpace.updateFormSpace.reopen);

  /**
   * Ends the reopen window immediately, making the submission final.
   */
  readonly lockFormSpace = firebaseDocumentStoreUpdateFunction(this, this.formSpaceFunctions.formSpace.updateFormSpace.lock);

  readonly removeFormSpaceFile = firebaseDocumentStoreUpdateFunction(this, this.formSpaceFunctions.formSpace.updateFormSpace.removeFile);

  readonly deleteFormSpace = firebaseDocumentStoreDeleteFunction(this, this.formSpaceFunctions.formSpace.deleteFormSpace.delete);

  readonly formSpaceType$ = this.currentData$.pipe(
    map((x) => x?.t),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly displayName$ = this.currentData$.pipe(
    map((x) => x?.n),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly formSpaceState$ = this.currentData$.pipe(
    map((x) => x?.s),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly processingState$ = this.currentData$.pipe(
    map((x) => x?.ps),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The space's own JSON.
   *
   * Named for the field rather than `data$`, which the base store already uses for the whole document.
   */
  readonly formSpaceData$ = this.currentData$.pipe(
    map((x) => x?.d),
    shareReplay(1)
  );

  /**
   * Every file the space currently holds, across every slot.
   *
   * `f` is the authority, not a query over `/sf`: a space's owner cannot `list` StorageFiles, so this array
   * is the only complete view of what the space holds.
   */
  readonly files$: Observable<FormSpaceFile[]> = this.currentData$.pipe(
    map((x) => x?.f ?? []),
    shareReplay(1)
  );

  /**
   * Whether the space is still a DRAFT — the single predicate every edit, upload and submit control hangs
   * its enablement off.
   *
   * Evaluated with the same `isFormSpaceEditable()` the server rejects on, so the UI cannot offer an action
   * the server would refuse.
   */
  readonly isEditable$ = this.currentData$.pipe(
    map((formSpace) => (formSpace ? isFormSpaceEditable({ formSpace }) : false)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The space's JSON, cast to the caller's own data contract.
   *
   * The framework never interprets `d`; narrowing it is the calling app's business, which is exactly what
   * this returns rather than hiding a cast inside the store.
   */
  formSpaceDataOfType$<T extends FormSpaceData = FormSpaceData>(): Observable<Maybe<T>> {
    return this.formSpaceData$ as Observable<Maybe<T>>;
  }

  /**
   * The files one slot currently holds, in the order the space records them.
   *
   * @param slot - The slot to read.
   */
  filesInSlot$(slot: FormSpaceFileSlot): Observable<FormSpaceFile[]> {
    return this.files$.pipe(
      map((f) => formSpaceFilesInSlot({ f }, slot)),
      shareReplay(1)
    );
  }

  // MARK: completion
  /**
   * The type config governing this space, or undefined when the app registered no type registry.
   */
  readonly formSpaceTypeConfig$: Observable<Maybe<FormSpaceTypeConfig>> = this.formSpaceType$.pipe(
    map((formSpaceType) => (formSpaceType == null ? undefined : this.appFormSpaceTypeConfigService?.configForFormSpaceType(formSpaceType))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Every reason the space may not be submitted yet — empty when it may — or undefined when the answer is
   * unknown because no type registry was provided.
   *
   * Evaluated with the same `formSpaceSubmitBlockers()` the server's submit transaction rejects on, so the
   * UI cannot offer a submit the server would refuse. Undefined is NOT "no blockers": a caller that treats
   * it as such is promising the user something this store never checked.
   */
  readonly submitBlockers$: Observable<Maybe<FormSpaceSubmitBlocker[]>> = combineLatest([this.currentData$, this.formSpaceTypeConfig$]).pipe(
    map(([formSpace, config]) => (formSpace != null && config != null ? formSpaceSubmitBlockers(formSpace, config) : undefined)),
    shareReplay(1)
  );

  /**
   * Whether every slot the type requires is filled and valid.
   *
   * False while the answer is unknown, so an app that forgot the registry gets a disabled submit button
   * rather than one that fails against the server.
   */
  readonly isComplete$: Observable<boolean> = this.submitBlockers$.pipe(
    map((blockers) => blockers?.length === 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether the space is both still editable and complete — the single predicate a submit control hangs its
   * enablement off.
   */
  readonly isSubmittable$: Observable<boolean> = combineLatest([this.isEditable$, this.isComplete$]).pipe(
    map(([isEditable, isComplete]) => isEditable && isComplete),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: reopen
  /**
   * Whether the space may be reopened into an editable draft right now.
   *
   * Evaluated with the same `isFormSpaceReopenable()` the reopen action rejects on. FALSE while the answer
   * is unknown — no type registry means no reopen policy to read — for the same reason `isComplete$` is:
   * a disabled control is recoverable, an enabled one that fails against the server is not.
   *
   * Being the policy, it does not know about `ps === PROCESSING`, which the action refuses separately and
   * transiently. A reopen offered during processing can still come back with
   * `FORM_SPACE_PROCESSING_IN_PROGRESS`, and that is the right thing to surface — the user should try
   * again, not be told their submission is final.
   */
  readonly isReopenable$: Observable<boolean> = combineLatest([this.currentData$, this.formSpaceTypeConfig$]).pipe(
    map(([formSpace, config]) => (formSpace != null && config != null ? isFormSpaceReopenable({ formSpace, config }) : false)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether nothing further can be done to the space: neither editable nor reopenable.
   *
   * The predicate a "this is final" affordance hangs off, and deliberately not the inverse of
   * {@link isEditable$} — a submitted space inside its reopen window is neither editable nor final.
   * Undefined config resolves to the editable answer alone, so an app with no registry still distinguishes
   * a live draft from a closed submission.
   */
  readonly isFullyLocked$: Observable<boolean> = combineLatest([this.currentData$, this.formSpaceTypeConfig$]).pipe(
    map(([formSpace, config]) => (formSpace == null ? false : isFormSpaceFullyLocked({ formSpace, config: config ?? { formSpaceType: formSpace.t } }))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * What one slot holds and whether that satisfies its requirement, or undefined when no type registry was
   * provided.
   *
   * @param slot - The slot to report on.
   * @returns The slot's status, or undefined when it cannot be determined.
   */
  slotStatus$(slot: FormSpaceFileSlot): Observable<Maybe<FormSpaceSlotStatus>> {
    return combineLatest([this.currentData$, this.formSpaceTypeConfig$]).pipe(
      map(([formSpace, config]) => (formSpace != null && config != null ? formSpaceSlotStatus({ formSpace, config, slot }) : undefined)),
      shareReplay(1)
    );
  }
}
