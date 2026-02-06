import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { AbstractPopoverDirective } from '../../interaction/popover/abstract.popover.directive';
import { DbxPopoverKey } from '../../interaction/popover/popover';
import { DbxPopoverService } from '../../interaction/popover/popover.service';
import { DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective } from '../../interaction';
import { DbxHelpViewListComponent } from './help.view.list.component';
import { DbxHelpContextString } from './help';
import { NgPopoverRef } from 'ng-overlay-container';
import { ObservableOrValue } from '@dereekb/rxjs';
import { DbxHelpContextService } from './help.context.service';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxHelpWidgetService } from './help.widget.service';

export const DEFAULT_DBX_HELP_VIEW_POPOVER_KEY = 'help';

export interface DbxHelpViewPopoverConfig {
  /**
   * Custom icon
   *
   * Defaults to "help"
   */
  readonly icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "Help"
   */
  readonly header?: string;
  /**
   * Custom empty text when no help contexts are available.
   */
  readonly emptyText?: string;
  /**
   * Origin element to attach the popover to.
   */
  readonly origin: ElementRef;
  /**
   * Specific contexts to display. If not provided, shows all active contexts from the DbxHelpContextService.
   */
  readonly helpContextStrings?: Maybe<ObservableOrValue<ArrayOrValue<DbxHelpContextString>>>;
  /**
   * Overrides the default popover header config.
   *
   * If not provided, the default popover header config will be used from DbxHelpWidgetService.
   */
  readonly popoverHeaderConfig?: Maybe<DbxInjectionComponentConfig>;
}

export type DbxHelpViewPopoverConfigWithoutOrigin = Omit<DbxHelpViewPopoverConfig, 'origin'>;

/**
 * Popover component for displaying help contexts.
 */
@Component({
  templateUrl: './help.view.popover.component.html',
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective, DbxHelpViewListComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxHelpViewPopoverComponent extends AbstractPopoverDirective<unknown, DbxHelpViewPopoverConfig> {
  private readonly _helpContextService = inject(DbxHelpContextService);
  private readonly _helpWidgetService = inject(DbxHelpWidgetService);

  readonly helpContextStrings$ = this.popover.data?.helpContextStrings ?? this._helpContextService.activeHelpContextStringsArray$;

  static openPopover(popoverService: DbxPopoverService, config: DbxHelpViewPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef {
    const { origin, ...data } = config;

    return popoverService.open({
      height: '500px',
      width: '600px',
      key: popoverKey ?? DEFAULT_DBX_HELP_VIEW_POPOVER_KEY,
      origin,
      componentClass: DbxHelpViewPopoverComponent,
      data,
      isResizable: true
    });
  }

  get config(): DbxHelpViewPopoverConfig {
    return this.popover.data as DbxHelpViewPopoverConfig;
  }

  readonly icon = this.config.icon ?? 'help';
  readonly header = this.config.header ?? 'Help';
  readonly emptyText = this.config.emptyText ?? 'No help topics available in current context.';

  readonly popoverHeaderConfig: Maybe<DbxInjectionComponentConfig> = (() => {
    let config: Maybe<DbxInjectionComponentConfig> = this.config.popoverHeaderConfig;

    if (!config) {
      config = this._helpWidgetService.getPopoverHeaderComponentConfig();
    }

    return config;
  })();
}
