import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, input, output, viewChild } from '@angular/core';
import { fileAcceptString, fileArrayAcceptMatchFunction } from './upload.accept';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';
import { type Maybe } from '@dereekb/util';
import { AbstractDbxFileUploadComponent, type DbxFileUploadFilesChangedEvent } from './abstract.upload.component';
import { provideDbxFileUploadActionCompatable } from './upload.action';

/**
 * Event emitted by {@link DbxFileUploadButtonComponent} when files are selected.
 */
export type DbxFileUploadButtonFilesChangedEvent = DbxFileUploadFilesChangedEvent;

/**
 * File upload button that opens a native file picker and emits accepted/rejected file results.
 *
 * @example
 * ```html
 * <dbx-file-upload-button [text]="'Upload'" [icon]="'upload'" [accept]="['image/*']" [multiple]="true" (filesChanged)="onFiles($event)"></dbx-file-upload-button>
 * ```
 */
@Component({
  selector: 'dbx-file-upload-button',
  template: `
    <dbx-button [buttonStyle]="buttonStyle()" [text]="text()" [icon]="icon()" [ariaLabel]="ariaLabel() || text() || 'Upload file'" (buttonClick)="openInput()" [disabled]="disabledSignal()" [working]="workingSignal()">
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
  readonly ariaLabel = input<Maybe<string>>();
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();

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

  /**
   * NOTE: A Chrome bug can cause "File chooser dialog can only be shown with a user activation" errors
   * when Chrome's "Restart to Update" banner is visible. Restarting Chrome to apply the update resolves it.
   *
   * See https://issues.chromium.org/issues/330663542 (scroll to bottom for details).
   */
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
