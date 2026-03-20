import { NgClass, NgStyle } from '@angular/common';
import { type OnInit, type OnDestroy, Component, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { asObservable, type ObservableOrValue, switchMapMaybeDefault } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { FieldWrapper, type FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, type Observable, shareReplay } from 'rxjs';

/**
 * A map of CSS style properties to their values, used with `[ngStyle]`.
 */
export type DbxFormStyleObject = { [styleClass: string]: any };

/**
 * Configuration for the style wrapper that applies dynamic CSS classes and inline styles.
 */
export interface DbxFormStyleWrapperConfig {
  /**
   * Observable or static value providing inline styles via `[ngStyle]`.
   */
  styleGetter?: Maybe<ObservableOrValue<DbxFormStyleObject>>;
  /**
   * Observable or static value providing CSS class names via `[ngClass]`.
   */
  classGetter?: Maybe<ObservableOrValue<string>>;
}

/**
 * Formly wrapper that applies dynamic CSS classes and inline styles to the wrapped field.
 *
 * Supports both static values and reactive observables for `[ngClass]` and `[ngStyle]`.
 *
 * Registered as Formly wrapper `'style'`.
 */
@Component({
  template: `
    <div class="dbx-form-style-wrapper" [ngClass]="classSignal()" [ngStyle]="styleSignal()">
      <ng-container #fieldComponent></ng-container>
    </div>
  `,
  imports: [NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormStyleWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormStyleWrapperConfig>> implements OnInit, OnDestroy {
  private readonly _style = new BehaviorSubject<Maybe<Observable<DbxFormStyleObject>>>(undefined);
  private readonly _class = new BehaviorSubject<Maybe<Observable<string>>>(undefined);

  readonly style$ = this._style.pipe(switchMapMaybeDefault({}), shareReplay(1));
  readonly class$ = this._class.pipe(switchMapMaybeDefault(''), shareReplay(1));

  readonly styleSignal = toSignal(this.style$);
  readonly classSignal = toSignal(this.class$);

  get styleGetter(): Maybe<ObservableOrValue<DbxFormStyleObject>> {
    return this.props.styleGetter;
  }

  get classGetter(): Maybe<ObservableOrValue<string>> {
    return this.props.classGetter;
  }

  ngOnInit(): void {
    if (this.styleGetter) {
      this._style.next(asObservable(this.styleGetter));
    }

    if (this.classGetter) {
      this._class.next(asObservable(this.classGetter));
    }
  }

  ngOnDestroy(): void {
    this._style.complete();
    this._class.complete();
  }
}
