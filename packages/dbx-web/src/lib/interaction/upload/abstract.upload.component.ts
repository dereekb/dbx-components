import { computed, Directive, input, signal } from '@angular/core';
import { isDefinedAndNotFalse, Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig, FileArrayAcceptMatchResult } from './upload.accept';
import { DbxFileUploadActionCompatable } from './upload.action';
import { DbxButtonWorking } from '@dereekb/dbx-core';

// MARK: Abstract
export interface DbxFileUploadFilesChangedEvent {
  readonly allFiles: File[];
  readonly matchResult: FileArrayAcceptMatchResult;
}

@Directive({
  standalone: true
})
export abstract class AbstractDbxFileUploadComponent implements DbxFileUploadActionCompatable {
  /**
   * Whether or not multiple files can be uploaded.
   */
  readonly multiple = input<Maybe<boolean>, Maybe<boolean | ''>>(undefined, { transform: (x) => x === '' || x });

  /**
   * Accepted file types filter.
   */
  readonly accept = input<FileArrayAcceptMatchConfig['accept']>([]);

  /**
   * This disabled is input-only
   */
  readonly disabled = input<Maybe<boolean>>();

  /**
   * This working is input-only
   */
  readonly working = input<Maybe<DbxButtonWorking>>();

  /**
   * This signal is set by setMultiple
   */
  private readonly _multipleSignal = signal<Maybe<boolean>>(undefined);

  /**
   * This signal is set by setAccept
   */
  private readonly _acceptSignal = signal<Maybe<FileArrayAcceptMatchConfig['accept']>>(undefined);

  /**
   * This signal is set by setDisabled
   */
  private readonly _disabledSignal = signal<Maybe<boolean>>(undefined);

  /**
   * This signal is set by setWorking
   */
  private readonly _workingSignal = signal<Maybe<DbxButtonWorking>>(undefined);

  readonly multipleSignal = computed(() => {
    const multipleInput = this.multiple();
    const multipleSignal = this._multipleSignal();
    return multipleSignal ?? multipleInput;
  });

  readonly acceptSignal = computed(() => {
    const acceptInput = this.accept();
    const acceptSignal = this._acceptSignal();
    return acceptSignal ?? acceptInput;
  });

  readonly disabledSignal = computed(() => {
    const disabledInput = this.disabled();
    const disabledSignal = this._disabledSignal();
    const workingSignal = this.isWorkingSignal();

    // disabled if any are true
    return disabledInput || disabledSignal || workingSignal;
  });

  readonly workingSignal = computed(() => {
    const workingInput = this.working();
    const workingSignal = this._workingSignal();
    return workingSignal ?? workingInput;
  });

  readonly isWorkingSignal = computed(() => {
    const working = this.workingSignal();
    return isDefinedAndNotFalse(working);
  });

  // MARK: DbxUploadActionCompatable
  setDisabled(disabled?: Maybe<boolean>): void {
    this._disabledSignal.set(disabled);
  }

  setWorking(working?: Maybe<DbxButtonWorking>): void {
    this._workingSignal.set(working);
  }

  setMultiple(multiple?: Maybe<boolean>): void {
    this._multipleSignal.set(multiple);
  }

  setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void {
    this._acceptSignal.set(accept);
  }
}
