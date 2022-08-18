import { OnInit, OnDestroy, Component } from '@angular/core';
import { asObservable, ObservableOrValue, switchMapMaybeDefault } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';

export type DbxFormStyleObject = { [styleClass: string]: any };

export interface DbxFormStyleWrapperConfig {
  styleGetter?: Maybe<ObservableOrValue<DbxFormStyleObject>>;
  classGetter?: Maybe<ObservableOrValue<string>>;
}

@Component({
  template: `
    <div class="dbx-form-style-wrapper" [ngClass]="(class$ | async) ?? ''" [ngStyle]="(style$ | async) ?? {}">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormStyleWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormStyleWrapperConfig>> implements OnInit, OnDestroy {
  private _style = new BehaviorSubject<Maybe<Observable<DbxFormStyleObject>>>(undefined);
  private _class = new BehaviorSubject<Maybe<Observable<string>>>(undefined);

  readonly style$ = this._style.pipe(switchMapMaybeDefault({}), shareReplay(1));
  readonly class$ = this._class.pipe(switchMapMaybeDefault(''), shareReplay(1));

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
