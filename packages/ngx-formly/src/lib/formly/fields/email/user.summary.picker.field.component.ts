import { DateOrDateString } from './../../../model/date';
import { switchMap, shareReplay, map, filter, startWith, tap, first, distinctUntilChanged, delay } from 'rxjs/operators';
import { EmailAddress, ModelKey, EmailParticipant } from '@/app/common/model';
import {
  Component, ComponentFactoryResolver, ElementRef, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { LoadingState, LoadingStateLoadingContext } from '@/app/common/loading';
import { isObject } from 'class-validator';
import { SubscriptionObject } from '@dereekb/util-rxjs';
import { AfterViewInit } from '@angular/core';

export interface EmailUserSummaryCorrespondence {
  lastEmailSentAt?: DateOrDateString;
  lastEmailReceivedAt?: DateOrDateString;
  lastEmailInteractionAt?: DateOrDateString;
}

export interface EmailUserSummary {
  connectedEmail: EmailAddress;
  userId: ModelKey;
  correspondence?: EmailUserSummaryCorrespondence;
}

export interface EmailFromTargetSummaryFieldMapping<T extends EmailUserSummary, O extends string = string> {
  /**
   * Maps the summary to a value.
   */
  mapSummary: (summary: T) => O;
  /**
   * Finds the summary from the value.
   */
  findSummary: (summaryList: T[], value: O) => T;
}

export type SearchEmailUserSummariesFunction<T extends EmailUserSummary> = (participants?: EmailParticipant[]) => Observable<LoadingState<SearchEmailUserSummariesResult<T>>>;
export interface SearchEmailUserSummariesResult<T> {
  isLockedToUser: boolean;
  primaryTarget: EmailParticipant;
  targets: EmailParticipant[];
  /**
   * List of results, put in order of the most likely to be the one to send.
   */
  summaryList: T[];
}

export interface EmailFromTargetSummaryFieldConfig<T extends EmailUserSummary, O extends string = string> extends FormlyFieldConfig {
  searchEmailUserSummaries: SearchEmailUserSummariesFunction<T>;
  autoSelectValue?: boolean;
  toFormConfig?: {
    key: string;
  };
  /**
   * Used for mapping the values.
   *
   * By default the mapping is for the userId field.
   */
  mapping?: EmailFromTargetSummaryFieldMapping<T, O>;
}

export const emailFromTargetSummaryUserIdMapping: EmailFromTargetSummaryFieldMapping<EmailUserSummary> = {

  mapSummary(summary: EmailUserSummary): string {
    return summary.userId;
  },

  findSummary(summaryList: EmailUserSummary[], value: string): EmailUserSummary {
    return summaryList.find(x => x.userId === value);
  }

};

@Component({
  templateUrl: 'user.summary.picker.field.component.html',
  styleUrls: ['./email.scss']
})
export class DbNgxEmailUserSummaryPickerFieldComponent<T extends EmailUserSummary, O extends string = string> extends FieldType<EmailFromTargetSummaryFieldConfig<T, O>>
  implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('trigger')
  matAutocompleteTrigger: MatAutocompleteTrigger;

  /**
   * Input FormControl used for retrieving user input.
   */
  readonly inputCtrl = new FormControl('');

  private _autoValueSub = new SubscriptionObject();

  private _showEmailSelector = new BehaviorSubject<boolean>(false);

  private _toFormValueObs = new BehaviorSubject<Observable<EmailParticipant[]>>(of(undefined));
  private _formControlObs = new BehaviorSubject<AbstractControl>(undefined);

  readonly formControl$ = this._formControlObs.pipe(filter(x => Boolean(x)));


  /*
  searchForParticipants(emailParticipants?: EmailParticipant[]): void {
    this._valuesObs.next(this.field.searchEmailUserSummaries(emailParticipants));
  }

  this._toValueSub.subscription = toForm.valueChanges.subscribe((participants: EmailParticipant[]) => {
    this.searchForParticipants(participants);
  });
  */

  readonly participants$ = this._toFormValueObs.pipe(switchMap(x => x.pipe(shareReplay(1))));
  readonly participantsSearchResult$ = this.participants$.pipe(
    distinctUntilChanged(),
    switchMap((participants) => this.field.searchEmailUserSummaries(participants)),
    shareReplay(1)
  );

  readonly participantsSearchResultModel$ = this.participantsSearchResult$.pipe(
    distinctUntilChanged(),
    map(y => y?.model),
    filter(x => Boolean(x))
  );

  readonly values$ = this.participantsSearchResult$.pipe(
    distinctUntilChanged(),
    map(y => y?.model?.summaryList ?? []),
    shareReplay(1)
  );

  readonly inputValue$: Observable<string | T> = this.inputCtrl.valueChanges.pipe(startWith(''));
  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(
    map(x => {
      if (x) {
        if (isObject(x)) {
          return x.connectedEmail;
        } else {
          return x;
        }
      }

      return '';
    }),
    distinctUntilChanged()
  );

  readonly filteredValues$ = combineLatest([this.values$, this.inputValueString$]).pipe(
    map(([values, filterInput]) => (filterInput) ? values.filter(v => v.connectedEmail.toLowerCase().indexOf(filterInput) !== -1) : values),
    shareReplay(1)
  );

  readonly selectedValue$ = this.formControl$.pipe(
    switchMap(control => combineLatest([this.values$, control.valueChanges.pipe(startWith(control.value))])
      .pipe(
        map(([summaryList, value]) => {
          return (value) ? this.mapping.findSummary(summaryList, value) : value;
        }),
        shareReplay(1)
      )),
    shareReplay(1)
  );

  readonly isLockedToUser$ = this.participantsSearchResultModel$.pipe(map(x => x.isLockedToUser));
  readonly primaryTarget$ = this.participantsSearchResultModel$.pipe(map(x => x.primaryTarget));
  readonly primaryTargetEmail$ = this.primaryTarget$.pipe(map(x => x.email));

  readonly selectedValueEmail$ = this.selectedValue$.pipe(
    filter(x => Boolean(x)),
    map(x => x.connectedEmail)
  );

  readonly showEmailSelector$ = this._showEmailSelector.asObservable();
  readonly showEditor$ = this.showEmailSelector$.pipe(delay(50));

  readonly context = new LoadingStateLoadingContext({ obs: this.participantsSearchResult$ });
  readonly isLoadingValues$ = this.context.isLoading$;

  get label(): string {
    return this.field.templateOptions?.label;
  }

  get required(): boolean {
    return this.field.templateOptions.required;
  }

  get placeholder(): string {
    return this.field.templateOptions.placeholder;
  }

  get value(): O {
    return this.formControl.value;
  }

  get autoSelectValue(): boolean {
    return this.field.autoSelectValue;
  }

  get mapping(): EmailFromTargetSummaryFieldMapping<T, O> {
    return this.field.mapping ?? emailFromTargetSummaryUserIdMapping as any;
  }

  get disabled(): boolean {
    return this.form.disabled;
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    if (this.autoSelectValue !== false) {
      this._autoValueSub.subscription = combineLatest([
        this.participantsSearchResult$.pipe(filter(x => !x?.loading && Boolean(x?.model))),
        this.selectedValue$
      ]).subscribe(([searchResult, selectedValue]) => {
        const { summaryList, isLockedToUser } = searchResult.model;
        if (summaryList && summaryList[0] && !selectedValue) {
          this.tryAutoSelectValue(summaryList);
        }
      });
    }

    /*
    this.selectedValue$.subscribe((value: T | O) => {
      console.log('selectedValue$: ', value);
    });

    this.inputCtrl.valueChanges.subscribe((value: T | O) => {
      console.log('inputCtrl: ', value);
    });

    this.values$.subscribe((value) => {
      console.log('values$: ', value);
    });

    this.filteredValues$.subscribe((value) => {
      console.log('filteredValues$: ', value);
    });
    */
  }

  ngAfterViewInit(): void {
    const toFormField = this.field.toFormConfig?.key;

    if (toFormField) {
      const toForm = this.form.get(toFormField);
      this._toFormValueObs.next(toForm.valueChanges.pipe(startWith(toForm.value)));
    } else {
      this._toFormValueObs.next(of(undefined));
    }
  }

  ngOnDestroy(): void {
    this._formControlObs.complete();
  }

  tryAutoSelectValue(summaryList: T[]): void {
    this.setValueWithSummary(summaryList[0]);
  }

  changeEmail(): void {
    this.showEmailSelector();
  }

  hideEmailSelector(): void {
    this.showEmailSelector(false);
  }

  showEmailSelector(show = true): void {
    this._showEmailSelector.next(show);
    this.clearFilterInput();

    if (show) {
      setTimeout(() => {
        if (this.matAutocompleteTrigger && !this.matAutocompleteTrigger.panelOpen) {
          this.matAutocompleteTrigger.openPanel();
        }
      }, 80);
    }
  }

  displayWith(summary: T): string {
    return summary.connectedEmail;
  }

  autoCompleteClosed(): void {
    if (this.formControl.value) {
      this.hideEmailSelector();
    }
  }

  tabPressedOnInput(event: KeyboardEvent): boolean {
    if (event?.key?.toLowerCase() === 'tab') {
      this.hideEmailSelector();
    }

    return true;
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.setValueWithSummary(event.option.value);
  }

  setValueWithSummary(summary: T): void {
    const value = this.mapSummary(summary);

    if (this.formControl.value !== value) {
      this.formControl.setValue(value);
      this.inputCtrl.setValue(value);
    }

    this.hideEmailSelector();
  }

  clearFilterInput(): void {
    this.inputCtrl.setValue('');
  }

  mapSummary(summary: T): O {
    return this.mapping.mapSummary(summary);
  }

}
