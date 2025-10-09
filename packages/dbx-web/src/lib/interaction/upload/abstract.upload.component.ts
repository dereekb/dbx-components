import { computed, Directive, forwardRef, input, Provider, signal, Type } from '@angular/core';
import { DbxUploadActionCompatable } from './upload.action.directive';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig, FileArrayAcceptMatchResult } from './upload.accept';

export interface DbxFileUploadFilesChangedEvent {
  readonly allFiles: File[];
  readonly matchResult: FileArrayAcceptMatchResult;
}

@Directive({
  standalone: true
})
export abstract class AbstractDbxFileUploadComponent implements DbxUploadActionCompatable {
  /**
   * Whether or not multiple files can be uploaded.
   */
  readonly multiple = input<Maybe<boolean>, Maybe<boolean | ''>>(false, { transform: (x) => x === '' || x });

  /**
   * Accepted file types filter.
   */
  readonly accept = input<FileArrayAcceptMatchConfig['accept']>([]);

  /**
   * This disabled is input-only
   */
  readonly disabled = input<boolean>(false);

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
  private readonly _workingSignal = signal<Maybe<boolean>>(undefined);

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
    const workingSignal = this._workingSignal();

    // disabled if any are true
    return disabledInput || disabledSignal || workingSignal;
  });

  readonly workingSignal = computed(() => this._workingSignal());

  // MARK: DbxUploadActionCompatable
  setDisabled(disabled?: Maybe<boolean>): void {
    this._disabledSignal.set(disabled);
  }

  setWorking(working?: Maybe<boolean>): void {
    this._workingSignal.set(working);
  }

  setMultiple(multiple?: Maybe<boolean>): void {
    this._multipleSignal.set(multiple);
  }

  setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void {
    this._acceptSignal.set(accept);
  }
}

export function provideDbxFileUploadActionCompatable<S extends DbxUploadActionCompatable>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxUploadActionCompatable,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
