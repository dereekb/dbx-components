import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreCreateFunction, firebaseDocumentStoreDeleteFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { type FormSpace, type FormSpaceData, type FormSpaceDocument, type FormSpaceFile, type FormSpaceFileSlot, FormSpaceFirestoreCollections, FormSpaceFunctions, formSpaceFilesInSlot, isFormSpaceEditable } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type Observable, distinctUntilChanged, map, shareReplay } from 'rxjs';

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
}
