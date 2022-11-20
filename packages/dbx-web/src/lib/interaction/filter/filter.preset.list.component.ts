import { shareReplay } from 'rxjs/operators';
import { BehaviorSubject, map, Observable, combineLatest, distinctUntilChanged } from 'rxjs';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ClickableFilterPreset, AbstractSubscriptionDirective, ClickableAnchor, ClickableAnchorLink, ClickableIconAnchorLink, FilterSourceDirective } from '@dereekb/dbx-core';
import { GetterOrValue, getValueFromGetter, Maybe } from '@dereekb/util';
import { FilterPresetStringRef, FilterWithPreset, tapLog } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuComponent } from './filter.preset';

@Component({
  selector: 'dbx-preset-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchors$ | async"></dbx-anchor-list>
  `
})
export class DbxPresetFilterListComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuComponent<F> {}
