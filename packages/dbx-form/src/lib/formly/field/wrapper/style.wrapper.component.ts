import { OnInit, OnDestroy } from '@angular/core';
import { asObservable, ObservableGetter, switchMapMaybeDefault } from '@dereekb/rxjs';
import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';

export interface DbxFormStyleWrapperConfig {
  style: ObservableGetter<string>;
}

export interface DbxFormSectionWrapperTemplateOptions extends FormlyTemplateOptions {
  styleWrapper: DbxFormStyleWrapperConfig;
}

export interface FormSectionFormlyConfig extends FormlyFieldConfig {
  templateOptions: DbxFormSectionWrapperTemplateOptions;
}

@Component({
  template: `
    <div [ngClass]="(style$ | async) ?? ''">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormStyleWrapperComponent extends FieldWrapper<FormSectionFormlyConfig & FieldTypeConfig> implements OnInit, OnDestroy {

  private _style = new BehaviorSubject<Maybe<Observable<string>>>(undefined);
  readonly style$ = this._style.pipe(switchMapMaybeDefault(''), shareReplay(1));

  get styleGetter(): ObservableGetter<string> {
    return this.to.styleWrapper?.style;
  }

  ngOnInit(): void {
    this._style.next(asObservable(this.styleGetter));
  }

  ngOnDestroy(): void {
    this._style.complete();
  }

}
