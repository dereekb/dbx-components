import { Directive, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type FormSpaceFileSlot, type FormSpaceId, formSpaceUploadsFilePath } from '@dereekb/firebase';
import { type Maybe, type SlashPathFile } from '@dereekb/util';
import { combineLatest, map, shareReplay } from 'rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { type StorageFileUploadConfig, type StorageFileUploadHandler, storageFileUploadHandler } from '../../storagefile/container/storagefile.upload.handler';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';

/**
 * Directive that builds the {@link StorageFileUploadHandler} for one slot of the surrounding FormSpace.
 *
 * The whole of "uploading into a FormSpace" is a PATH. There is no FormSpace upload callable: the client
 * writes to `uploads/u/{uid}/formSpace/{formSpaceId}/{slot}/{filename}`, `storage.rules` confines the write
 * to the caller's own namespace, and the storage-triggered initializer — which only ever sees that path —
 * reads the space and the slot back out of it. Producing that path is this directive's whole job.
 *
 * The uid is the UPLOADER's, never the space's `u`. On a SHARED space several people write into one space
 * from their own namespaces, which is exactly what lets the rules bound the write with no Firestore read.
 *
 * Reading back what a slot holds is deliberately NOT here — `FormSpaceDocumentStore.filesInSlot$(slot)`
 * already answers that, and a second accessor over the same `f` array is only a second thing to keep in
 * step.
 *
 * @example
 * ```html
 * <div dbxFirebaseStorageFileUploadStore [multipleUpload]="false" fileTypesAccepted="application/pdf">
 *   <div dbxFirebaseFormSpaceSlotUpload="cover" #slotUpload="dbxFirebaseFormSpaceSlotUpload">
 *     <div dbxAction [dbxFirebaseStorageFileUploadActionHandler]="slotUpload.uploadHandlerSignal()" [triggerOnFiles]="true">
 *       <dbx-file-upload dbxFileUploadActionSync mode="button" dbxFirebaseStorageFileUploadSync></dbx-file-upload>
 *     </div>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFirebaseFormSpaceSlotUpload]',
  exportAs: 'dbxFirebaseFormSpaceSlotUpload',
  standalone: true
})
export class DbxFirebaseFormSpaceSlotUploadDirective {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);
  readonly storageService = inject(DbxFirebaseStorageService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  /**
   * The slot files land in.
   */
  readonly slot = input.required<FormSpaceFileSlot>({ alias: 'dbxFirebaseFormSpaceSlotUpload' });

  readonly slot$ = toObservable(this.slot).pipe(shareReplay(1));

  /**
   * The handler to hand to `dbxFirebaseStorageFileUploadActionHandler`.
   *
   * Undefined until both the signed-in user and the space's id are known: an upload before either would
   * land at a path the initializer parses into somebody else's space, or into none at all.
   */
  readonly uploadHandler$ = combineLatest([this.dbxFirebaseAuthService.currentUid$, this.formSpaceDocumentStore.currentId$, this.slot$]).pipe(
    map(([uid, formSpaceId, slot]): Maybe<StorageFileUploadHandler> => {
      let handler: Maybe<StorageFileUploadHandler>;

      if (uid != null && formSpaceId != null) {
        handler = storageFileUploadHandler({
          storageService: this.storageService,
          storageFileUploadConfigFactory: (file: File): StorageFileUploadConfig => ({
            storagePath: formSpaceUploadsFilePath({ uid, formSpaceId: formSpaceId as FormSpaceId, slot, filename: file.name as SlashPathFile })
          })
        });
      }

      return handler;
    }),
    shareReplay(1)
  );

  readonly uploadHandlerSignal = toSignal(this.uploadHandler$);
}
