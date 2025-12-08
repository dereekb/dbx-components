import { Component, computed, inject, input } from '@angular/core';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxWebFilePreviewService } from './webfilepreview.service';
import { Maybe } from '@dereekb/util';
import { DbxWebFilePreviewServicePreviewComponentFunctionInput } from './webfilepreview';

/**
 * Config for DbxWebFilePreviewComponent.
 */
export type DbxWebFilePreviewComponentConfig = DbxWebFilePreviewServicePreviewComponentFunctionInput;

/**
 * Component used to preview a file using the DbxWebFilePreviewService's createPreviewConfig function for the given input.
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

  readonly config = input<DbxWebFilePreviewComponentConfig>();

  readonly componentConfigSignal = computed(() => {
    const config = this.config();

    let componentConfig: Maybe<DbxInjectionComponentConfig<any>>;

    if (config) {
      componentConfig = this.webFilePreviewService.createPreviewConfig(config);
    }

    return componentConfig;
  });
}
