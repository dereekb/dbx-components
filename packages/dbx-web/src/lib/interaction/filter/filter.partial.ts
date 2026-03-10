import { shareReplay, map, type Observable, combineLatest, distinctUntilChanged, startWith, first } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { type ClickableAnchorLink, FilterSourceDirective, type ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { filterUndefinedValues, firstValue, getValueFromGetter, type Maybe, objectHasNoKeys } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract base directive for partial preset filter menus that manages selection state and anchor generation.
 *
 * Subclasses render the list of partial preset anchors as either a list or a dropdown menu.
 */
@Directive()
export abstract class AbstractDbxPartialPresetFilterMenuDirective<F> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  readonly partialPresets = input<ClickablePartialFilterPreset<F>[], Maybe<ClickablePartialFilterPreset<F>[]>>([], { transform: (x) => x ?? [] });
  readonly partialPresets$ = toObservable(this.partialPresets);

  readonly filter$: Observable<Maybe<F>> = this.filterSourceDirective.filter$.pipe(startWith(undefined), distinctUntilChanged(), shareReplay(1));

  readonly selectedPartialPresets$: Observable<ClickablePartialFilterPreset<F>[]> = combineLatest([this.partialPresets$, this.filter$]).pipe(
    map(([partialPresets, selectedFilter]) => partialPresets.filter((x) => x.isActive(selectedFilter))),
    distinctUntilChanged()
  );

  readonly firstSelectedPartialPreset$: Observable<Maybe<ClickablePartialFilterPreset<F>>> = this.selectedPartialPresets$.pipe(
    map((selectedPartialPresets) => firstValue(selectedPartialPresets)),
    distinctUntilChanged()
  );

  readonly presetAnchors$: Observable<ClickableAnchorLink[]> = combineLatest([this.partialPresets$, this.firstSelectedPartialPreset$]).pipe(
    map(([partialPresets, firstSelectedPartialPreset]) => {
      return partialPresets.map((x) => {
        return {
          ...x,
          selected: x === firstSelectedPartialPreset,
          onClick: () => {
            this.selectPartialPreset(x);
          }
        };
      });
    }),
    shareReplay(1)
  );

  readonly presetAnchorsSignal = toSignal(this.presetAnchors$);

  selectPartialPreset(preset: ClickablePartialFilterPreset<F>) {
    const presetValue = preset.partialPresetValue;

    if (presetValue == null || (typeof presetValue !== 'function' && objectHasNoKeys(presetValue))) {
      // set and then reset if the value is null or empty
      this.filterSourceDirective.setFilter((presetValue ?? {}) as F);
      this.filterSourceDirective.resetFilter();
    } else {
      const filter = getValueFromGetter(preset.partialPresetValue) as Partial<F>;

      this.filter$.pipe(first()).subscribe((currentFilter) => {
        const nextFilter = { ...currentFilter, ...filterUndefinedValues({ ...currentFilter, ...filter }, true) } as F;
        this.filterSourceDirective.setFilter(nextFilter);
      });
    }
  }
}
