import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  DbxButtonComponent,
  DbxContentBorderDirective,
  DbxContentContainerDirective,
  DbxContentLayoutModule,
  type DbxPdfMergeEditorConfig,
  DbxPdfMergeEditorComponent,
  DbxPdfMergeEditorFileUploadComponent,
  type DbxPdfMergeEditorFileUploadConfig,
  DbxPdfMergeEditorFileUploadHasStateDirective,
  DbxPdfMergeEditorStore,
  DbxPdfMergeEditorFileUploadValidatorDirective,
  DbxPdfMergeEditorStoreDirective,
  DbxPdfMergeUploadButtonDirective,
  type DbxPdfMergeUploadButtonConfig,
  DbxPdfMergeUploadActionDirective,
  DbxContentPitDirective
} from '@dereekb/dbx-web';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { distinctUntilChanged, delay, map, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

interface DocPdfMergeUploadResult {
  readonly size: number;
  readonly type: string;
  readonly receivedAt: Date;
}

const DOC_PDF_MERGE_UPLOAD_DELAY_MS = 3000;

@Component({
  selector: 'doc-pdf-merge-editor-default-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showPreviewButton]="true" [showDownloadButton]="true"></dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (lastBlobSizeSignal(); as size) {
      <p class="dbx-hint">Last merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [DbxContentBorderDirective, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorDefaultExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly lastBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-editor-slots-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="license" [config]="licenseConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
            <span class="dbx-hint dbx-small" *dbxPdfMergeEditorFileUploadHasState="'no_file'">Required</span>
          </dbx-pdf-merge-editor-file-upload>
          <dbx-pdf-merge-editor-file-upload slotId="insurance" [config]="insuranceConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
            <span class="dbx-hint dbx-small" *dbxPdfMergeEditorFileUploadHasState="'no_file'">Optional</span>
          </dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (slotsBlobSizeSignal(); as size) {
      <p class="dbx-hint">Slots merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [MatIconModule, DbxContentBorderDirective, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective, DbxPdfMergeEditorFileUploadHasStateDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorSlotsExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly licenseConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Driver’s License', accept: ['application/pdf', 'image/png', 'image/jpeg'] };
  readonly insuranceConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Insurance Card', accept: ['application/pdf', 'image/png', 'image/jpeg'], required: false };

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly slotsBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-editor-max-files-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="receipts" [config]="receiptsConfig"></dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (maxFilesBlobSizeSignal(); as size) {
      <p class="dbx-hint">Max-files merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [DbxContentBorderDirective, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorMaxFilesExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly receiptsConfig: DbxPdfMergeEditorFileUploadConfig = {
    label: 'Receipts (up to 3)',
    accept: ['application/pdf', 'image/png', 'image/jpeg'],
    multiple: true,
    minFiles: 1,
    maxFiles: 3,
    hint: 'Drop up to three receipt PDFs or images. The uploader hides once you reach 3.'
  };

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly maxFilesBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-editor-config-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [config]="editorConfig" [showPreviewButton]="true" [showDownloadButton]="true"></dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (configBlobSizeSignal(); as size) {
      <p class="dbx-hint">Config example merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [DbxContentBorderDirective, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorConfigExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly editorConfig: DbxPdfMergeEditorConfig = {
    imageCompression: {
      maxDimension: 1600,
      convertPngToJpeg: true,
      jpegQuality: 0.85
    },
    outputSizeLimits: {
      warnBytes: 2 * 1024 * 1024,
      errorBytes: 8 * 1024 * 1024
    }
  };

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly configBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-upload-button-custom-content',
  template: `
    <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="false">
      <div dbxPdfMergeEditorFileUploadValidator>
        <dbx-pdf-merge-editor-file-upload slotId="receipts" [config]="receiptsConfig"></dbx-pdf-merge-editor-file-upload>
      </div>
    </dbx-pdf-merge-editor>
  `,
  standalone: true,
  imports: [DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeUploadButtonCustomContentComponent {
  readonly receiptsConfig: DbxPdfMergeEditorFileUploadConfig = {
    label: 'Receipts (up to 3)',
    accept: ['application/pdf', 'image/png', 'image/jpeg'],
    multiple: true,
    minFiles: 1,
    maxFiles: 3,
    hint: 'Drop up to three receipt PDFs or images.'
  };
}

@Component({
  selector: 'doc-pdf-merge-upload-button-default-example',
  template: `
    <dbx-content-border>
      <div dbxAction [dbxActionHandler]="handleUpload">
        <div dbxPdfMergeEditorStore>
          <dbx-button text="Upload PDF" icon="picture_as_pdf" raised color="primary" dbxActionButton dbxPdfMergeUploadAction dbxPdfMergeUploadButton></dbx-button>
        </div>
      </div>
    </dbx-content-border>
    @if (lastResultSignal(); as result) {
      <p class="dbx-hint">Last upload handled by the action ({{ DOC_PDF_MERGE_UPLOAD_DELAY_MS }}ms delay):</p>
      <dbx-content-pit class="dbx-mt2">
        <pre class="dbx-mb0">{{ result | json }}</pre>
      </dbx-content-pit>
    }
  `,
  standalone: true,
  imports: [DbxButtonComponent, DbxContentBorderDirective, DbxContentPitDirective, DbxPdfMergeEditorStoreDirective, DbxPdfMergeUploadButtonDirective, DbxPdfMergeUploadActionDirective, DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeUploadButtonDefaultExampleComponent {
  readonly DOC_PDF_MERGE_UPLOAD_DELAY_MS = DOC_PDF_MERGE_UPLOAD_DELAY_MS;
  private readonly _lastResult = signal<DocPdfMergeUploadResult | undefined>(undefined);
  readonly lastResultSignal = this._lastResult.asReadonly();

  readonly handleUpload: WorkUsingObservable<Blob, boolean> = (blob: Blob) => {
    return of(true).pipe(
      delay(DOC_PDF_MERGE_UPLOAD_DELAY_MS),
      map(() => {
        this._lastResult.set({ size: blob.size, type: blob.type, receivedAt: new Date() });
        return true;
      })
    );
  };
}

@Component({
  selector: 'doc-pdf-merge-upload-button-custom-example',
  template: `
    <dbx-content-border>
      <div dbxAction [dbxActionHandler]="handleUpload">
        <div dbxPdfMergeEditorStore [config]="storeConfig">
          <dbx-button text="Upload Receipts" icon="cloud_upload" raised color="primary" dbxActionButton dbxPdfMergeUploadAction [dbxPdfMergeUploadButton]="buttonConfig"></dbx-button>
        </div>
      </div>
    </dbx-content-border>
    @if (lastResultSignal(); as result) {
      <p class="dbx-hint">Last upload handled by the action (limit 8 MB, {{ DOC_PDF_MERGE_UPLOAD_DELAY_MS }}ms delay). The dialog's footer Upload button is themed via the directive's uploadButtonConfig:</p>
      <dbx-content-pit class="dbx-mt2">
        <pre class="dbx-mb0">{{ result | json }}</pre>
      </dbx-content-pit>
    }
  `,
  standalone: true,
  imports: [DbxButtonComponent, DbxContentBorderDirective, DbxContentPitDirective, DbxPdfMergeEditorStoreDirective, DbxPdfMergeUploadButtonDirective, DbxPdfMergeUploadActionDirective, DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeUploadButtonCustomExampleComponent {
  readonly DOC_PDF_MERGE_UPLOAD_DELAY_MS = DOC_PDF_MERGE_UPLOAD_DELAY_MS;

  private readonly _lastResult = signal<DocPdfMergeUploadResult | undefined>(undefined);

  readonly lastResultSignal = this._lastResult.asReadonly();

  readonly storeConfig: DbxPdfMergeEditorConfig = {
    outputSizeLimits: {
      warnBytes: 2 * 1024 * 1024,
      errorBytes: 8 * 1024 * 1024
    }
  };

  readonly buttonConfig: DbxPdfMergeUploadButtonConfig = {
    customDialogContent: {
      componentClass: DocPdfMergeUploadButtonCustomContentComponent
    },
    uploadButtonConfig: {
      text: 'Send Receipts',
      icon: 'send',
      color: 'accent',
      raised: false,
      stroked: true
    }
  };

  readonly handleUpload: WorkUsingObservable<Blob, boolean> = (blob: Blob) => {
    return of(true).pipe(
      delay(DOC_PDF_MERGE_UPLOAD_DELAY_MS),
      map(() => {
        this._lastResult.set({ size: blob.size, type: blob.type, receivedAt: new Date() });
        return true;
      })
    );
  };
}

@Component({
  templateUrl: './pdf.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocPdfMergeEditorDefaultExampleComponent, DocPdfMergeEditorSlotsExampleComponent, DocPdfMergeEditorMaxFilesExampleComponent, DocPdfMergeEditorConfigExampleComponent, DocPdfMergeUploadButtonDefaultExampleComponent, DocPdfMergeUploadButtonCustomExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionPdfComponent {}
