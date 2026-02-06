import { ChangeDetectionStrategy, Component, computed, inject, input, Signal } from '@angular/core';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { DBX_HELP_WIDGET_ENTRY_DATA_TOKEN, DbxHelpWidgetEntryData, DbxHelpWidgetServiceEntry } from './help.widget';
import { Maybe } from '@dereekb/util';
import { DbxHelpWidgetService } from './help.widget.service';

@Component({
  selector: 'dbx-help-view-list-entry',
  templateUrl: './help.view.list.entry.component.html',
  imports: [DbxInjectionComponent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent, MatIcon, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxHelpViewListEntryComponent {
  readonly helpWidgetEntry = input.required<DbxHelpWidgetServiceEntry>();
  readonly helpWidgetService = inject(DbxHelpWidgetService);

  readonly titleSignal = computed(() => this.helpWidgetEntry().title);
  readonly iconSignal = computed(() => this.helpWidgetEntry().icon ?? this.helpWidgetService.getDefaultIcon());

  readonly widgetInjectionConfigSignal: Signal<DbxInjectionComponentConfig> = computed(() => {
    const helpWidgetEntry = this.helpWidgetEntry();
    const widgetComponentClass = helpWidgetEntry.widgetComponentClass;

    const widgetData: DbxHelpWidgetEntryData = {
      helpWidgetEntry
    };

    const config: DbxInjectionComponentConfig = {
      componentClass: widgetComponentClass,
      providers: [
        {
          provide: DBX_HELP_WIDGET_ENTRY_DATA_TOKEN,
          useValue: widgetData
        }
      ]
    };

    return config;
  });

  readonly headerInjectionConfigSignal: Signal<Maybe<DbxInjectionComponentConfig>> = computed(() => {
    const helpWidgetEntry = this.helpWidgetEntry();
    const headerComponentClass = helpWidgetEntry.headerComponentClass;

    let config: Maybe<DbxInjectionComponentConfig> = undefined;

    if (headerComponentClass) {
      const widgetData: DbxHelpWidgetEntryData = {
        helpWidgetEntry
      };

      config = {
        componentClass: headerComponentClass,
        providers: [
          {
            provide: DBX_HELP_WIDGET_ENTRY_DATA_TOKEN,
            useValue: widgetData
          }
        ]
      };
    }

    return config;
  });
}
