import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { type Maybe } from '@dereekb/util';
import {
  readPdfMergeSidecar,
  mergePdfMergeEntries,
  type PdfMergeEntry,
  DbxPdfMergeImportComponent,
  type DbxPdfMergeImportConfig,
  type DbxPdfMergeEditorImportResult,
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
import { distinctUntilChanged, delay, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

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
    hint: 'Drop up to three receipt PDFs or images. Once the first lands, the drop area gives way to the header Add button — which hides at 3.'
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
      <dbx-pdf-merge-editor [config]="editorConfig"></dbx-pdf-merge-editor>
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

  // Single config object drives the whole editor: image compression, output-size limits,
  // the merged file name, and the Preview/Download affordances — no separate inputs needed.
  readonly editorConfig: DbxPdfMergeEditorConfig = {
    imageCompression: {
      maxDimension: 1600,
      convertPngToJpeg: true,
      jpegQuality: 0.85
    },
    outputSizeLimits: {
      warnBytes: 2 * 1024 * 1024,
      errorBytes: 8 * 1024 * 1024
    },
    fileName: 'compressed-merge.pdf',
    showPreviewButton: true,
    showDownloadButton: true
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
        <div dbxPdfMergeEditorStore [config]="storeConfig">
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

  // imageCompression set on the store directive flows through dbxPdfMergeUploadButton into the
  // dialog's default <dbx-pdf-merge-editor>, so large images are downscaled before the merge.
  readonly storeConfig: DbxPdfMergeEditorConfig = {
    imageCompression: {
      maxDimension: 1600,
      convertPngToJpeg: true,
      jpegQuality: 0.85
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
  selector: 'doc-pdf-merge-page-editing-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true" [pageEditing]="true" [sidecar]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="license" [config]="licenseConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
          </dbx-pdf-merge-editor-file-upload>
          <dbx-pdf-merge-editor-file-upload slotId="cert" [config]="certConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
          </dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (sidecarSignal(); as sidecar) {
      <p class="dbx-hint">
        Manifest embedded in the merged file, re-read with
        <code>readPdfMergeSidecar()</code>
        :
      </p>
      <dbx-content-pit>
        <pre class="dbx-mb0">{{ sidecar | json }}</pre>
      </dbx-content-pit>
    }
  `,
  standalone: true,
  imports: [JsonPipe, MatIconModule, DbxContentBorderDirective, DbxContentPitDirective, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective, DbxPdfMergeEditorFileUploadHasStateDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorPageEditingExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  // multiple: true is what makes a section a *collection* of pages rather than one locked-in file —
  // the header Add button appends another document's pages to the same section, and Clear empties it.
  readonly licenseConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Driver’s License', accept: ['application/pdf', 'image/png', 'image/jpeg'], multiple: true };
  readonly certConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Certification', accept: ['application/pdf', 'image/png', 'image/jpeg'], multiple: true, required: false };

  /**
   * Reads the manifest back out of the merged blob on every change, so the document→page mapping stays visible as pages are reordered, rotated, and removed.
   */
  readonly sidecar$ = this.store.mergeOutput$.pipe(switchMap((blob) => readPdfMergeSidecar(blob)));
  readonly sidecarSignal = toSignal(this.sidecar$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-page-editing-toggle-example',
  template: `
    <dbx-content-border>
      <mat-checkbox [checked]="pageEditingSignal()" (change)="pageEditingSignal.set($event.checked)">Page editing</mat-checkbox>
      <dbx-pdf-merge-editor [showPreviewButton]="true" [showDownloadButton]="true" [pageEditing]="pageEditingSignal()"></dbx-pdf-merge-editor>
    </dbx-content-border>
    <p class="dbx-hint">Add a multi-page PDF, then toggle the checkbox: the same entries render as files when off and as individual pages when on. Page edits are kept while the mode is off.</p>
  `,
  standalone: true,
  imports: [MatCheckboxModule, DbxContentBorderDirective, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorPageEditingToggleExampleComponent {
  readonly pageEditingSignal = signal<boolean>(true);
}

/**
 * Asset the "load programmatically" button builds its sample packet from.
 */
const DOC_PDF_MERGE_SAMPLE_ASSET_URL = '/assets/test/resume.pdf';

/**
 * Builds a ready entry directly, the way an exported document's pages already are. `buildPdfMergeEntry` would leave the entry `validating` until its promise settles, and `mergePdfMergeEntries` only merges `ready` ones.
 *
 * @param file - Source document for the entry.
 * @param slotId - Section the entry belongs to.
 * @returns A `ready` entry the merge will accept.
 */
function docPdfMergeReadyEntry(file: File, slotId: string): PdfMergeEntry {
  return {
    id: `${slotId}-sample`,
    file,
    slotId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    original: { name: file.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    validation: Promise.resolve({ ok: true })
  };
}

/**
 * Produces the kind of blob an app would have fetched from its own storage: a merged PDF whose manifest names both of this editor's sections.
 *
 * @returns A merged PDF with an embedded manifest covering `license` and `cert`.
 */
async function docPdfMergeSamplePacket(): Promise<Blob> {
  const response = await fetch(DOC_PDF_MERGE_SAMPLE_ASSET_URL);
  const file = new File([await response.blob()], 'onboarding-packet.pdf', { type: 'application/pdf' });
  return mergePdfMergeEntries([docPdfMergeReadyEntry(file, 'license'), docPdfMergeReadyEntry(file, 'cert')], { sidecar: true });
}

interface DocPdfMergeImportSummary {
  readonly sections: readonly { readonly slotId: Maybe<string>; readonly fileName: string }[];
  readonly missingTags: readonly string[];
  readonly untaggedPageCount: number;
  readonly exportedAt: Maybe<string>;
}

@Component({
  selector: 'doc-pdf-merge-reimport-example',
  template: `
    <dbx-content-border>
      <div class="dbx-mb3">
        <dbx-button text="Load a sample packet programmatically" icon="cloud_download" [working]="loadingSampleSignal()" (buttonClick)="onLoadSample()"></dbx-button>
        <p class="dbx-hint dbx-small dbx-mb0">Calls store.importMergedPdf() the way an app would after fetching a stored document — no picker. Edit the result, then press Clear: it comes back instead of emptying.</p>
      </div>
      <dbx-pdf-merge-import [config]="importConfig"></dbx-pdf-merge-import>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true" [pageEditing]="true" [sidecar]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="license" [config]="licenseConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
          </dbx-pdf-merge-editor-file-upload>
          <dbx-pdf-merge-editor-file-upload slotId="cert" [config]="certConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
          </dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (importSummarySignal(); as summary) {
      <p class="dbx-hint">Reconstructed from the imported file's manifest:</p>
      <dbx-content-pit>
        <pre class="dbx-mb0">{{ summary | json }}</pre>
      </dbx-content-pit>
    }
  `,
  standalone: true,
  imports: [JsonPipe, MatIconModule, DbxButtonComponent, DbxContentBorderDirective, DbxContentPitDirective, DbxPdfMergeEditorComponent, DbxPdfMergeImportComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective, DbxPdfMergeEditorFileUploadHasStateDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeReimportExampleComponent {
  readonly importConfig: DbxPdfMergeImportConfig = {
    label: 'Re-import a completed document',
    text: 'Choose exported PDF',
    hint: 'Pick the merged PDF you downloaded from the example above'
  };

  // Both sections take multiple files so a re-imported section can be extended with another
  // document (header Add) or emptied and rebuilt (header Clear) without touching the other section.
  readonly licenseConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Driver’s License', accept: ['application/pdf', 'image/png', 'image/jpeg'], multiple: true };
  readonly certConfig: DbxPdfMergeEditorFileUploadConfig = {
    label: 'Certification',
    accept: ['application/pdf', 'image/png', 'image/jpeg'],
    multiple: true,
    required: false,
    clearConfirm: { prompt: 'The certification pages will be dropped from this document. Re-import or pick a new file to restore them.' }
  };

  readonly store = inject(DbxPdfMergeEditorStore);

  private readonly _summary = signal<Maybe<DocPdfMergeImportSummary>>(undefined);
  readonly importSummarySignal = this._summary.asReadonly();

  private readonly _loadingSample = signal<boolean>(false);
  readonly loadingSampleSignal = this._loadingSample.asReadonly();

  constructor() {
    // Driven off the store rather than the picker's `imported` output so this block always
    // describes whatever the editor currently holds: a picked file, a programmatic import, the
    // document restored by Clear — and nothing at all once Clear discards the import outright.
    this.store.importState$.pipe(takeUntilDestroyed()).subscribe((state) => {
      const result = state?.status === 'imported' ? state.result : null;
      this._summary.set(result == null ? undefined : this.summaryForResult(result));
    });
  }

  /**
   * The programmatic entry point. `origin` defaults to `programmatic`, so this import becomes the editor's restore point — Clear reloads it rather than emptying the editor.
   */
  async onLoadSample(): Promise<void> {
    this._loadingSample.set(true);

    try {
      await this.store.importMergedPdf({ source: await docPdfMergeSamplePacket() });
    } finally {
      this._loadingSample.set(false);
    }
  }

  private summaryForResult(result: DbxPdfMergeEditorImportResult): DocPdfMergeImportSummary {
    return {
      sections: result.entries.map((entry) => ({ slotId: entry.slotId, fileName: entry.name })),
      missingTags: result.missingTags,
      untaggedPageCount: result.untaggedPageCount,
      exportedAt: result.sidecar?.createdAt
    };
  }
}

@Component({
  templateUrl: './pdf.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DbxContentLayoutModule,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DocPdfMergeEditorDefaultExampleComponent,
    DocPdfMergeEditorSlotsExampleComponent,
    DocPdfMergeEditorMaxFilesExampleComponent,
    DocPdfMergeEditorConfigExampleComponent,
    DocPdfMergeUploadButtonDefaultExampleComponent,
    DocPdfMergeUploadButtonCustomExampleComponent,
    DocPdfMergeEditorPageEditingExampleComponent,
    DocPdfMergeEditorPageEditingToggleExampleComponent,
    DocPdfMergeReimportExampleComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionPdfComponent {}
