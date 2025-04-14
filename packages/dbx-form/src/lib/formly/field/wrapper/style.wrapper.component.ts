import { NgClass, NgStyle } from '@angular/common';
import { OnInit, OnDestroy, Component, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { asObservable, ObservableOrValue, switchMapMaybeDefault } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';

export type DbxFormStyleObject = { [styleClass: string]: any };

export interface DbxFormStyleWrapperConfig {
  styleGetter?: Maybe<ObservableOrValue<DbxFormStyleObject>>;
  classGetter?: Maybe<ObservableOrValue<string>>;
}

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
  private _style = new BehaviorSubject<Maybe<Observable<DbxFormStyleObject>>>(undefined);
  private _class = new BehaviorSubject<Maybe<Observable<string>>>(undefined);

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
