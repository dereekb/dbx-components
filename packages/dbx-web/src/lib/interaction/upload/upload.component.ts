import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';
import { type FileArrayAcceptMatchConfig } from './upload.accept';
import { type DbxButtonStyle } from '../../button/button';
import { type Maybe } from '@dereekb/util';
import { DbxFileUploadButtonComponent, type DbxFileUploadButtonFilesChangedEvent } from './upload.button.component';
import { DbxFileUploadAreaComponent, type DbxFileUploadAreaFilesChangedEvent } from './upload.area.component';
import { NgTemplateOutlet } from '@angular/common';
import { AbstractDbxFileUploadComponent, type DbxFileUploadFilesChangedEvent } from './abstract.upload.component';
import { provideDbxFileUploadActionCompatable } from './upload.action';
import { type DbxButtonDisplay } from '@dereekb/dbx-core';

/**
 * Display mode for the file upload component: area-only, button-only, or both (default).
 */
export type DbxFileUploadMode = 'area' | 'button' | 'default';

/**
 * Configuration for the combined file upload component, controlling display mode, accept filters, and area/button appearance.
 */
export interface DbxFileUploadComponentConfig {
  readonly mode?: DbxFileUploadMode;
  readonly accept?: Maybe<FileArrayAcceptMatchConfig['accept']>;
  readonly multiple?: Maybe<boolean>;

  /**
   * If true, the area will be clickable to open the file picker.
   */
  readonly clickAreaToUpload?: Maybe<boolean>;

  readonly area?: Maybe<{
    readonly icon?: Maybe<string>;
    readonly text?: Maybe<string>;
    readonly hint?: Maybe<string | boolean>;
  }>;

  readonly button?: Maybe<{
    readonly icon?: Maybe<string>;
    readonly text?: Maybe<string>;
    readonly style?: DbxButtonStyle;
  }>;
}

/**
 * Combines a drag-and-drop upload area with a file picker button into a single configurable component.
 *
 * Supports area-only, button-only, or combined (default) display modes.
 *
 * @example
 * ```html
 * <dbx-file-upload [mode]="'default'" [accept]="['image/*']" [multiple]="true" [hint]="'Drag files here'" [text]="'Browse'" (filesChanged)="onFiles($event)"></dbx-file-upload>
 * ```
 */
@Component({
  selector: 'dbx-file-upload',
  template: `
    <dbx-file-upload-area #area [show]="showAreaSignal()" [hint]="areaHintSignal()" [text]="areaTextSignal()" [icon]="areaIconSignal()" [accept]="acceptSignal()" [multiple]="multipleSignal()" (filesChanged)="areaFilesChanged($event)" (areaClicked)="areaClicked()" [disabled]="disabledSignal()" [working]="workingSignal()">
      <ng-content></ng-content>
      @if (showButtonSignal()) {
        <ng-template [ngTemplateOutlet]="buttonTemplate"></ng-template>
      }
    </dbx-file-upload-area>
    <!-- Button Template -->
    <ng-template #buttonTemplate>
      <dbx-file-upload-button #button [text]="buttonTextSignal()" [icon]="buttonIconSignal()" [accept]="acceptSignal()" [multiple]="multipleSignal()" (filesChanged)="buttonFilesChanged($event)" [disabled]="disabledSignal()" [working]="workingSignal()" [buttonStyle]="buttonStyle()"></dbx-file-upload-button>
    </ng-template>
  `,
  providers: provideDbxFileUploadActionCompatable(DbxFileUploadComponent),
  imports: [DbxFileUploadAreaComponent, DbxFileUploadButtonComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadComponent extends AbstractDbxFileUploadComponent {
  readonly config = input<Maybe<DbxFileUploadComponentConfig>>();

  readonly area = viewChild.required<string, DbxFileUploadAreaComponent>('area', { read: DbxFileUploadAreaComponent });
  readonly button = viewChild.required<string, DbxFileUploadButtonComponent>('button', { read: DbxFileUploadButtonComponent });
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();
  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>>();

  readonly mode = input<Maybe<DbxFileUploadMode>>();
  readonly text = input<Maybe<string>>(); // button text
  readonly icon = input<Maybe<string>>(); // button icon
  readonly hint = input<Maybe<string | boolean>>(); // area hint

  readonly modeSignal = computed(() => {
    const config = this.config();
    const mode = this.mode();
    return config?.mode ?? mode ?? 'default';
  });

  readonly showButtonSignal = computed(() => {
    const mode = this.modeSignal();
    return mode === 'button' || mode === 'default';
  });

  readonly showAreaSignal = computed(() => {
    const mode = this.modeSignal();
    return mode === 'area' || mode === 'default';
  });

  readonly clickAreaToUpload = input<Maybe<boolean>>();
  readonly clickAreaToUploadSignal = computed(() => {
    const config = this.config();
    const clickAreaToUpload = this.clickAreaToUpload();
    return config?.clickAreaToUpload ?? clickAreaToUpload;
  });

  readonly buttonTextSignal = computed(() => {
    const config = this.config();
    const text = this.text();
    const buttonDisplay = this.buttonDisplay();
    return config?.button?.text ?? buttonDisplay?.text ?? text;
  });

  readonly buttonIconSignal = computed(() => {
    const config = this.config();
    const icon = this.icon();
    const buttonDisplay = this.buttonDisplay();
    return config?.button?.icon ?? buttonDisplay?.icon ?? icon;
  });

  readonly areaTextSignal = computed(() => this.config()?.area?.text);
  readonly areaIconSignal = computed(() => this.config()?.area?.icon);
  readonly areaHintSignal = computed(() => {
    const config = this.config();
    const hint = this.hint();
    return config?.area?.hint ?? hint;
  });

  readonly uploadMultipleSignal = computed(() => {
    const config = this.config();
    const multiple = this.multipleSignal();
    return multiple ?? config?.multiple;
  });

  readonly uploadAcceptSignal = computed(() => {
    const config = this.config();
    const accept = this.acceptSignal();
    return accept ?? config?.accept;
  });

  readonly filesChanged = output<DbxFileUploadFilesChangedEvent>();

  areaClicked() {
    const clickAreaToUpload = this.clickAreaToUploadSignal();

    if (clickAreaToUpload) {
      const button = this.button();
      button.openInput();
    }
  }

  areaFilesChanged(event: DbxFileUploadAreaFilesChangedEvent) {
    this.filesChanged.emit(event);
  }

  buttonFilesChanged(event: DbxFileUploadButtonFilesChangedEvent) {
    this.filesChanged.emit(event);
  }
}
