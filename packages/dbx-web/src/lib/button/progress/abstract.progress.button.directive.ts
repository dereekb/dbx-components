import { OnDestroy, Directive, HostListener, inject, computed, input, Signal, output } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { Configurable, CssClass, type Maybe } from '@dereekb/util';
import { DbxProgressButtonGlobalConfig, DbxProgressButtonConfig, DbxProgressButtonTargetedConfig, DBX_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxButtonType } from '../button.component';

@Directive()
export abstract class AbstractProgressButtonDirective extends AbstractSubscriptionDirective implements OnDestroy {
  private readonly globalConfig = inject<DbxProgressButtonGlobalConfig>(DBX_PROGRESS_BUTTON_GLOBAL_CONFIG, { optional: true }) ?? [];

  readonly btnClick = output<MouseEvent>();

  readonly config = input.required<Maybe<DbxProgressButtonConfig>>();
  readonly buttonId = input<Maybe<string>>();
  readonly working = input<Maybe<boolean>>();
  readonly disabled = input<Maybe<boolean>>();

  readonly globalOptionsSignal: Signal<Maybe<DbxProgressButtonConfig>> = computed(() => {
    const buttonId = this.buttonId();
    return buttonId ? this.globalConfig.find((config: DbxProgressButtonTargetedConfig) => config.id === buttonId) : undefined;
  });

  readonly configSignal = computed<Maybe<DbxProgressButtonConfig>>(() => {
    const config = this.config();
    const globalConfig = this.globalOptionsSignal();

    let completeConfig: Maybe<Configurable<DbxProgressButtonConfig>>;

    if (config || globalConfig) {
      completeConfig = {
        ...globalConfig,
        ...config
      };

      // set the iconOnly property if the buttonType is icon
      if (completeConfig.buttonType === 'icon') {
        completeConfig.iconOnly = true;
      } else if (completeConfig.iconOnly) {
        completeConfig.buttonType = 'icon';
      }
    }

    return completeConfig;
  });

  readonly baseCssClassSignal = computed(() => {
    const config = this.configSignal();
    const classes: CssClass[] = [config?.customClass ?? ''];

    if (config?.fullWidth) {
      classes.push('fullWidth');
    }

    if (config?.disabled) {
      classes.push('disabled');
    }

    let buttonType: DbxButtonType = 'basic';

    if (config?.buttonType) {
      buttonType = config.buttonType;
    } else if (config?.raised) {
      buttonType = 'raised';
    } else if (config?.stroked) {
      buttonType = 'stroked';
    } else if (config?.flat) {
      buttonType = 'flat';
    } else if (config?.iconOnly) {
      buttonType = 'icon';
    }

    switch (buttonType) {
      case 'raised':
        classes.push('mat-mdc-raised-button mdc-button--raised');
        break;
      case 'stroked':
        classes.push('mat-mdc-outlined-button mdc-button--outlined');
        break;
      case 'flat':
        classes.push('mat-mdc-unelevated-button mdc-button--unelevated');
        break;
      default:
        classes.push('mat-unthemed');
        break;
    }

    return classes;
  });

  readonly baseCssClasses$ = toObservable(this.baseCssClassSignal);

  readonly workingSignal = computed(() => (this.working() || this.configSignal()?.working) ?? false);
  readonly disabledSignal = computed(() => (this.disabled() || this.configSignal()?.disabled) ?? false);

  readonly buttonTypeAttributeSignal = computed(() => {
    const options = this.configSignal();
    return options?.buttonTypeAttribute ?? options?.type;
  });

  readonly buttonDisabledSignal = computed(() => this.workingSignal() || this.disabledSignal());
  readonly showProgressSignal = computed(() => this.workingSignal() && !this.disabledSignal());

  @HostListener('click', ['$event'])
  public handleClick(event: MouseEvent): void {
    const working = this.workingSignal();
    const disabled = this.disabledSignal();

    if (!working && !disabled) {
      this.btnClick.emit(event);
      event.stopImmediatePropagation();
    }
  }
}
