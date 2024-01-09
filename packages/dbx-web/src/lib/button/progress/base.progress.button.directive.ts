import { ChangeDetectorRef, OnDestroy, OnInit, Optional, Directive, Input, Output, HostListener, EventEmitter, Inject } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { CssClass, Maybe, hasDifferentValues } from '@dereekb/util';
import { distinctUntilItemsHaveDifferentValues, filterMaybe } from '@dereekb/rxjs';
import { Observable, shareReplay, map, BehaviorSubject, combineLatest, first, distinctUntilChanged } from 'rxjs';
import { DbxProgressButtonGlobalConfig, DbxProgressButtonOptions, DbxProgressButtonTargetedConfig, DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';

@Directive()
export abstract class AbstractProgressButtonDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _computedOptions: Maybe<DbxProgressButtonOptions> = undefined;

  private _working = new BehaviorSubject<boolean>(false);
  private _disabled = new BehaviorSubject<boolean>(false);

  private _buttonId = new BehaviorSubject<Maybe<string>>(undefined);
  private _options = new BehaviorSubject<Maybe<DbxProgressButtonOptions>>(undefined);

  readonly globalOptions$: Observable<Maybe<DbxProgressButtonOptions>> = this._buttonId.pipe(map((buttonId: Maybe<string>) => (buttonId ? this.globalConfig.find((config: DbxProgressButtonTargetedConfig) => config.id === buttonId) : undefined)));

  readonly options$: Observable<DbxProgressButtonOptions> = combineLatest([this._options, this.globalOptions$, this._working, this._disabled]).pipe(
    map(([options, globalConfig, working, disabled]) => {
      let completeOptions: Maybe<DbxProgressButtonOptions>;

      if (options || globalConfig) {
        completeOptions = {
          ...globalConfig,
          ...options,
          working: options?.working || working,
          disabled: options?.disabled || disabled
        };
      }

      return completeOptions;
    }),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly baseCssClasses$: Observable<[DbxProgressButtonOptions, CssClass[]]> = this.options$.pipe(
    map((x) => {
      const classes: CssClass[] = [x.customClass ?? ''];

      if (x.fullWidth) {
        classes.push('fullWidth');
      }

      if (x.disabled) {
        classes.push('disabled');
      }

      if (x.raised) {
        classes.push('mat-mdc-raised-button mdc-button--raised');
      }

      if (x.stroked) {
        classes.push('mat-mdc-outlined-button mdc-button--outlined');
      }

      if (x.flat) {
        classes.push('mat-mdc-unelevated-button mdc-button--unelevated');
      }

      return [x, classes] as [DbxProgressButtonOptions, CssClass[]];
    }),
    shareReplay(1)
  );

  @Output()
  readonly btnClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  constructor(@Optional() @Inject(DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG) private globalConfig: DbxProgressButtonGlobalConfig = [], readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.options$.subscribe((options) => {
      this._computedOptions = options;
      safeMarkForCheck(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._working.complete();
    this._disabled.complete();
    this._buttonId.complete();
    this._options.complete();
  }

  @HostListener('click', ['$event'])
  public handleClick(event: MouseEvent): void {
    this.options$.pipe(first()).subscribe((options) => {
      if (!options.disabled && !options.working) {
        this.btnClick.emit(event);
        event.stopImmediatePropagation();
      }
    });
  }

  get customSpinnerStyle() {
    const customSpinnerColor = (this._computedOptions as DbxProgressButtonOptions).customSpinnerColor;
    return customSpinnerColor ? { stroke: customSpinnerColor } : undefined;
  }

  @Input()
  get options(): DbxProgressButtonOptions {
    return this._computedOptions as DbxProgressButtonOptions;
  }

  set options(options: DbxProgressButtonOptions) {
    this._options.next(options);
  }

  @Input()
  set buttonId(buttonId: string) {
    this._buttonId.next(buttonId);
  }

  @Input()
  set working(working: boolean) {
    this._working.next(working);
  }

  @Input()
  set disabled(disabled: boolean) {
    this._disabled.next(disabled);
  }
}
