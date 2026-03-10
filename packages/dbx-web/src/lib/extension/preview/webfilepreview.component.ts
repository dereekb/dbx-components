import { Component, computed, inject, input } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxWebFilePreviewService } from './webfilepreview.service';
import { type Maybe } from '@dereekb/util';
import { type DbxWebFilePreviewServicePreviewComponentFunctionInput } from './webfilepreview';

/**
 * Config for DbxWebFilePreviewComponent.
 */
export type DbxWebFilePreviewComponentConfig = DbxWebFilePreviewServicePreviewComponentFunctionInput;

/**
 * Previews a file by delegating to the {@link DbxWebFilePreviewService} to resolve the appropriate preview component for the given MIME type.
 *
 * @example
 * ```html
 * <dbx-web-file-preview [config]="{ srcUrl: 'https://example.com/doc.pdf', embedMimeType: 'application/pdf' }"></dbx-web-file-preview>
 * ```
 */
@Component({
  selector: 'dbx-web-file-preview',
  template: `
    <dbx-injection [config]="componentConfigSignal()"></dbx-injection>
  `,
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxWebFilePreviewComponent {
  readonly webFilePreviewService = inject(DbxWebFilePreviewService);

  readonly config = input<Maybe<DbxWebFilePreviewComponentConfig>>();

  readonly componentConfigSignal = computed(() => {
    const config = this.config();

    let componentConfig: Maybe<DbxInjectionComponentConfig<any>>;

    if (config) {
      componentConfig = this.webFilePreviewService.createPreviewConfig(config);
    }

    return componentConfig;
  });
}
