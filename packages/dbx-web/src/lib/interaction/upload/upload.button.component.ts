import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { fileAcceptString, fileArrayAcceptMatchFunction, type FileAcceptFunction } from './upload.accept';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';
import { type Maybe } from '@dereekb/util';
import { AbstractDbxFileUploadComponent, type DbxFileUploadFilesChangedEvent } from './abstract.upload.component';
import { provideDbxFileUploadActionCompatable } from './upload.action';

/**
 * Event emitted by {@link DbxFileUploadButtonComponent} when files are selected.
 */
export type DbxFileUploadButtonFilesChangedEvent = DbxFileUploadFilesChangedEvent;

// stands in for a type filter the input's own accept attribute has already applied
const ACCEPT_EVERY_FILE: FileAcceptFunction = () => true;

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
    <input #fileInput hidden type="file" [attr.accept]="buttonAcceptSignal() ?? null" [attr.multiple]="multipleAttributeSignal()" (change)="fileInputChanged()" />
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

  /**
   * The match function the picked files are run through.
   *
   * A non-function accept is left to the input's own accept attribute — but the COUNT still has to be
   * applied here, as the file picker has no concept of a limit and will happily hand back more than the
   * destination can hold.
   */
  readonly filesAcceptedFunctionSignal = computed(() => {
    const accept = this.acceptSignal();
    const multiple = this.buttonMultipleSignal();
    const maxFiles = this.maxFilesSignal();
    return fileArrayAcceptMatchFunction({ multiple, maxFiles, accept: typeof accept === 'function' ? accept : ACCEPT_EVERY_FILE });
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
      const matchResult = this.filesAcceptedFunctionSignal()(allFiles);
      this.filesChanged.emit({ allFiles, matchResult });
    }

    // reset the input value
    if (input.value) {
      input.value = '';
    }
  }
}
