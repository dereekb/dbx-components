import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxWidgetViewComponentConfig } from './widget';
import { DbxWidgetService } from './widget.service';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Used to display a corresponding widget based on the input data.
 */
@Component({
  selector: 'dbx-widget-view',
  template: `
    @switch (widgetConfigExistsSignal()) {
      @case (true) {
        <ng-container *ngTemplateOutlet="widget"></ng-container>
      }
      @default {
        <ng-container *ngTemplateOutlet="unknown"></ng-container>
      }
    }
    <ng-template #widget>
      <dbx-injection [config]="configSignal()"></dbx-injection>
    </ng-template>
    <ng-template #unknown>
      <ng-content empty select="[unknownWidget]"></ng-content>
    </ng-template>
  `,
  host: {
    class: 'dbx-widget-view'
  },
  standalone: true,
  imports: [DbxInjectionComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxWidgetViewComponent {
  readonly dbxWidgetService = inject(DbxWidgetService);

  readonly config = input<Maybe<DbxWidgetViewComponentConfig>>();

  readonly configSignal = computed(() => {
    const pair = this.config();
    let config: Maybe<DbxInjectionComponentConfig> = undefined;

    if (pair != null) {
      let entry = this.dbxWidgetService.getWidgetEntry(pair.type);

      if (!entry && pair.defaultType) {
        entry = this.dbxWidgetService.getWidgetEntry(pair.defaultType);
      }

      if (entry) {
        config = {
          componentClass: entry.componentClass,
          data: pair.data
        };
      } else {
        config = null;
      }
    }

    return config;
  });

  readonly widgetConfigExistsSignal = computed(() => this.configSignal() !== null);
}
