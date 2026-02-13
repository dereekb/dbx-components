import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { AbstractPopoverDirective } from '../../interaction/popover/abstract.popover.directive';
import { DbxPopoverKey } from '../../interaction/popover/popover';
import { DbxPopoverConfigSizing, DbxPopoverService } from '../../interaction/popover/popover.service';
import { DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective } from '../../interaction';
import { DbxHelpViewListComponent } from './help.view.list.component';
import { DbxHelpContextKey } from './help';
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
  readonly helpContextKeys?: Maybe<ObservableOrValue<ArrayOrValue<DbxHelpContextKey>>>;

  /**
   * Optional footer component config to inject after the list.
   */
  readonly helpListFooterComponentConfig?: Maybe<DbxInjectionComponentConfig>;

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi?: Maybe<boolean>;

  /**
   * Whether to show the empty list content.
   *
   * Defaults to true.
   */
  readonly allowEmptyListContent?: Maybe<boolean>;

  /**
   * Overrides the default popover header config.
   *
   * If not provided, the default popover header config will be used from DbxHelpWidgetService.
   */
  readonly popoverHeaderConfig?: Maybe<DbxInjectionComponentConfig>;
  /**
   * Additional popover configuration.
   */
  readonly popoverSizingConfig?: Maybe<DbxPopoverConfigSizing>;
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

  readonly helpContextKeys$ = this.popover.data?.helpContextKeys ?? this._helpContextService.activeHelpContextKeysArray$;

  static openPopover(popoverService: DbxPopoverService, config: DbxHelpViewPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef {
    const { origin, popoverSizingConfig, ...data } = config;

    return popoverService.open({
      height: '500px',
      width: '600px',
      ...popoverSizingConfig,
      key: popoverKey ?? DEFAULT_DBX_HELP_VIEW_POPOVER_KEY,
      componentClass: DbxHelpViewPopoverComponent,
      data,
      isResizable: true,
      origin
    });
  }

  get config(): DbxHelpViewPopoverConfig {
    return this.popover.data as DbxHelpViewPopoverConfig;
  }

  readonly icon = this.config.icon ?? 'help';
  readonly header = this.config.header ?? 'Help';
  readonly multi = this.config.multi;
  readonly emptyText = this.config.emptyText ?? 'No help topics available in current context.';
  readonly allowEmptyListContent = this.config.allowEmptyListContent ?? true;
  readonly helpListFooterComponentConfig = this.config.helpListFooterComponentConfig;

  readonly popoverHeaderConfig: Maybe<DbxInjectionComponentConfig> = (() => {
    let config: Maybe<DbxInjectionComponentConfig> = this.config.popoverHeaderConfig;

    if (!config) {
      config = this._helpWidgetService.getPopoverHeaderComponentConfig();
    }

    return config;
  })();
}
