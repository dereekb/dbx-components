import { ChangeDetectorRef, OnDestroy, OnInit, Optional } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { Observable, shareReplay, map, BehaviorSubject, combineLatest, first, distinctUntilChanged } from 'rxjs';
import { Directive, Input, Output, HostListener, EventEmitter, Inject } from '@angular/core';
import { DbxProgressButtonGlobalConfig, DbxProgressButtonOptions, DbxProgressButtonTargetedConfig, DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';

@Directive()
export abstract class AbstractProgressButtonDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _computedOptions: DbxProgressButtonOptions = undefined!;

  private _working = new BehaviorSubject<boolean>(false);
  private _disabled = new BehaviorSubject<boolean>(false);

  private _buttonId = new BehaviorSubject<Maybe<string>>(undefined);
  private _options = new BehaviorSubject<Maybe<DbxProgressButtonOptions>>(undefined);

  readonly globalOptions$: Observable<Maybe<DbxProgressButtonOptions>> = this._buttonId.pipe(
    map((buttonId: Maybe<string>) => (buttonId) ? this.globalConfig.find((config: DbxProgressButtonTargetedConfig) => config.id === buttonId) : undefined)
  );

  readonly options$: Observable<DbxProgressButtonOptions> = combineLatest([this._options, this.globalOptions$, this._working, this._disabled]).pipe(
    map(([options, globalConfig, working, disabled]) => {
      let completeOptions: Maybe<DbxProgressButtonOptions>;

      if (options || globalConfig) {
        completeOptions = {
          ...globalConfig,
          ...options,
          working: options?.working || options?.active || working,
          disabled: options?.disabled || disabled
        };
      }

      return completeOptions;
    }),
    filterMaybe(),
    distinctUntilChanged(),
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
      if (!options.disabled && !options.active) {
        this.btnClick.emit(event);
      }
    });
  }

  get options(): DbxProgressButtonOptions {
    return this._computedOptions;
  }

  get customSpinnerStyle() {
    const customSpinnerColor = this._computedOptions.customSpinnerColor;
    console.log('Spinner: ', customSpinnerColor);
    return (customSpinnerColor) ? { stroke: customSpinnerColor } : undefined;
  }

  @Input()
  set options(options: DbxProgressButtonOptions) {
    this._options.next(options);
  }

  @Input()
  set buttonId(buttonId: string) {
    this._buttonId.next(buttonId);
  }

  /**
   * @deprecated
   */
  @Input()
  set active(active: boolean) {
    this.working = active;
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
