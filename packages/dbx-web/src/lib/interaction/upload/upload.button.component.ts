import { ChangeDetectionStrategy, Component, computed, ElementRef, input, model, output, viewChild } from '@angular/core';
import { fileAcceptString, FileArrayAcceptMatchConfig, fileArrayAcceptMatchFunction, FileArrayAcceptMatchResult } from './upload.accept';
import { DbxButtonComponent, DbxButtonStyle } from '../../button/button.component';
import { Maybe } from '@dereekb/util';
import { AbstractDbxFileUploadComponent, DbxFileUploadFilesChangedEvent } from './abstract.upload.component';
import { provideDbxFileUploadActionCompatable } from './upload.action';

export type DbxFileUploadButtonFilesChangedEvent = DbxFileUploadFilesChangedEvent;

@Component({
  selector: 'dbx-file-upload-button',
  template: `
    <dbx-button [style]="buttonStyle()" [text]="text()" [icon]="icon()" (buttonClick)="openInput()" [disabled]="disabledSignal()" [working]="workingSignal()">
      <ng-content></ng-content>
    </dbx-button>
    <input #fileInput hidden type="file" [attr.accept]="buttonAcceptSignal() ?? null" [attr.multiple]="multipleAttributeSignal() ? '' : null" (change)="fileInputChanged()" />
  `,
  providers: provideDbxFileUploadActionCompatable(DbxFileUploadButtonComponent),
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadButtonComponent extends AbstractDbxFileUploadComponent {
  readonly fileInput = viewChild.required<string, ElementRef<HTMLInputElement>>('fileInput', { read: ElementRef });

  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly buttonStyle = input<DbxButtonStyle>();

  readonly filesChanged = output<DbxFileUploadButtonFilesChangedEvent>();

  readonly buttonAcceptSignal = computed(() => {
    const accept = this.acceptSignal();
    return typeof accept === 'function' ? undefined : fileAcceptString(accept);
  });

  readonly buttonMultipleSignal = computed(() => this.multipleSignal() ?? false);

  readonly filesAcceptedFunctionSignal = computed(() => {
    const accept = this.acceptSignal();
    const multiple = this.buttonMultipleSignal();
    return typeof accept === 'function' ? fileArrayAcceptMatchFunction({ multiple, accept }) : undefined;
  });

  /**
   * The HTML attribute should not be added if it is false, so we return null.
   */
  readonly multipleAttributeSignal = computed(() => (this.buttonMultipleSignal() ? '' : null));

  openInput() {
    const inputRef = this.fileInput();
    const input = inputRef.nativeElement;

    const isDisabled = this.disabledSignal();

    if (!isDisabled) {
      input.click();
    }
  }

  fileInputChanged() {
    const inputRef = this.fileInput();
    const input = inputRef.nativeElement;
    const isDisabled = this.disabledSignal();

    if (!isDisabled) {
      const allFiles = input.files ? Array.from(input.files) : [];
      const fileAcceptFunction = this.filesAcceptedFunctionSignal();

      if (fileAcceptFunction) {
        const matchResult = fileAcceptFunction(allFiles);
        this.filesChanged.emit({ allFiles, matchResult });
      } else {
        // if not using a filesAcceptedFunction, then accept all files as the input should have filtered them
        const multiple = this.buttonMultipleSignal();
        this.filesChanged.emit({ allFiles, matchResult: { multiple, input: allFiles, accepted: allFiles, rejected: [], acceptedType: allFiles, rejectedType: [] } });
      }
    }

    // reset the input value
    if (input.value) {
      input.value = '';
    }
  }
}
