import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxEmbedComponent } from '../../interaction/iframe/embed.component';
import { PDF_MERGE_RESULT_MIME_TYPE } from './pdf.merge';

/**
 * Renders a PDF in a fixed-height embed container. Accepts either a URL or a `Blob` source.
 *
 * @example
 * ```html
 * <dbx-pdf-preview [blob]="mergedBlob"></dbx-pdf-preview>
 * ```
 */
@Component({
  selector: 'dbx-pdf-preview',
  template: `
    <dbx-embed class="dbx-pdf-preview-frame d-block dbx-w100 dbx-h100" [blob]="blob()" [srcUrl]="srcUrl()" [type]="'application/pdf'"></dbx-embed>
  `,
  host: {
    class: 'dbx-pdf-preview d-block dbx-w100 dbx-h100'
  },
  imports: [DbxEmbedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfPreviewComponent {
  readonly blob = model<Maybe<Blob>>();
  readonly srcUrl = model<Maybe<WebsiteUrlWithPrefix>>();
  readonly downloadFileName = model<Maybe<string>>();

  readonly mimeType = PDF_MERGE_RESULT_MIME_TYPE;
}
