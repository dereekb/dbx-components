import { Directive, effect, inject, input, OnInit, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseStorageFileUploadStore } from '../store/storagefile.upload.store';
import { storageFileUploadFiles, StorageFileUploadFilesFinalResult, StorageFileUploadHandler } from './storagefile.upload.handler';
import { DbxActionContextStoreSourceInstance, DbxActionHandlerInstance } from '@dereekb/dbx-core';
import { errorResult, LoadingState, startWithBeginLoading, SubscriptionObject, successResult, WorkUsingContext } from '@dereekb/rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter, map, of, switchMap, tap, throttleTime } from 'rxjs';
import { StorageFileUploadFilesError } from './storagefile.upload.error';

/**
 * Connects a DbxFirebaseStorageFileUploadStore to a DbxActionContext, and handles the upload action.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadActionHandler]',
  standalone: true
})
export class DbxFirebaseStorageFileUploadActionHandlerDirective implements OnInit, OnDestroy {
  private readonly _triggerSub = new SubscriptionObject();
  private readonly _readySub = new SubscriptionObject();
  private readonly _isWorkingSub = new SubscriptionObject();
  private readonly _progressSub = new SubscriptionObject();

  readonly source = inject(DbxActionContextStoreSourceInstance<File[], StorageFileUploadFilesFinalResult>);
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  readonly _dbxActionHandlerInstance = new DbxActionHandlerInstance<File[], StorageFileUploadFilesFinalResult>(this.source);

  /**
   * If true, the action will be triggered when files are set.
   *
   * Defaults to false.
   */
  readonly triggerOnFiles = input<boolean>(false);
  readonly triggerOnFiles$ = toObservable(this.triggerOnFiles);

  /**
   * Uploading of all/any files should be cancelled if any file fails to upload.
   *
   * Any file that was successfully uploaded will not be reverted.
   *
   * Defaults to false.
   */
  readonly cancelUploadsOnUploadError = input<boolean>(false);

  /**
   * The upload should fail if any file fails to upload, rather than if all files fail to upload.
   *
   * Defaults to false.
   */
  readonly actionFailureOnUploadError = input<boolean>(false);

  readonly uploadHandler = input.required<Maybe<StorageFileUploadHandler>>({ alias: 'dbxFirebaseStorageFileUploadActionHandler' });

  protected readonly _uploadHandlerEffect = effect(() => {
    const uploadHandler = this.uploadHandler();
    let handlerFunction: Maybe<WorkUsingContext<File[], StorageFileUploadFilesFinalResult>>;

    if (uploadHandler) {
      handlerFunction = (files, context) => {
        const { upload, cancel } = storageFileUploadFiles({
          files,
          uploadHandler
        });

        const loadingStateObs = upload.pipe(
          tap((x) => {
            this.uploadStore.setLatestProgressEvent(x);
          }),
          filter((x) => x.isComplete),
          tap((x) => {
            this.uploadStore.setUploadResult(x.result as StorageFileUploadFilesFinalResult);
          }),
          map((x) => {
            const result = x.result as StorageFileUploadFilesFinalResult;
            const { successFileResults, errorFileResults } = result;

            const actionFailureOnUploadError = this.actionFailureOnUploadError();

            let finalLoadingState: LoadingState<StorageFileUploadFilesFinalResult>;

            if ((errorFileResults.length > 0 && actionFailureOnUploadError) || (successFileResults.length === 0 && errorFileResults.length > 0)) {
              finalLoadingState = errorResult(new StorageFileUploadFilesError(result));
            } else {
              finalLoadingState = successResult(x.result as StorageFileUploadFilesFinalResult);
            }

            return finalLoadingState;
          }),
          startWithBeginLoading()
        );

        context.startWorkingWithLoadingStateObservable(loadingStateObs);
      };
    } else {
      handlerFunction = undefined;
    }

    this._dbxActionHandlerInstance.setHandlerFunction(handlerFunction);
  });

  readonly files$ = this.uploadStore.files$;
  readonly uploadHandler$ = toObservable(this.uploadHandler);

  ngOnInit(): void {
    this._dbxActionHandlerInstance.init();

    // trigger the action if files are available
    this._triggerSub.subscription = this.triggerOnFiles$
      .pipe(
        switchMap((triggerOnFiles) => {
          if (triggerOnFiles) {
            return this.files$.pipe(map((x) => x?.length));
          } else {
            return of(false);
          }
        })
      )
      .subscribe((canTrigger) => {
        if (canTrigger) {
          this.source.trigger();
        }
      });

    // ready the source with files after trigger is called and files are available
    this._readySub.subscription = this.files$.pipe(switchMap((files) => this.source.triggered$.pipe(map(() => files)))).subscribe((files) => {
      this.source.readyValue(files);
    });

    // sync isWorking
    this._isWorkingSub.subscription = this.uploadStore.setIsUploadHandlerWorking(this.source.isWorking$);

    // sync progress amount
    this._progressSub.subscription = this.source.setWorkProgress(
      this.uploadStore.latestProgressEvent$.pipe(
        throttleTime(100, undefined, { leading: true, trailing: true }),
        map((x) => x?.overallProgress),
        distinctUntilChanged()
      )
    );
  }

  ngOnDestroy(): void {
    this._dbxActionHandlerInstance.destroy();
  }
}
