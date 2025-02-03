import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, map, Observable, shareReplay, switchMap } from 'rxjs';

/**
 * Configuration for the preset filter menus
 */
export interface DbxPresetFilterMenuConfig {
  /**
   * The text to display for the unknown selection.
   */
  unknownSelectionText?: string;
  /**
   * The icon to use for the filter, or false if no icon should be shown.
   */
  filterIcon?: Maybe<string> | false;
  /**
   * Whether or not to use the preset's icon if one is defined. If filterIcon is false, the icon will only appear when an item is selected.
   */
  usePresetIcon?: boolean;
}

export function dbxPresetFilterMenuButtonTextObservable(config$: Observable<DbxPresetFilterMenuConfig>, selection$: Observable<Maybe<Partial<Pick<ClickableAnchorLink, 'title'>>>>, defaultText = 'Filter') {
  return combineLatest([config$, selection$]).pipe(
    map(([config, preset]) => preset?.title ?? config.unknownSelectionText ?? defaultText),
    distinctUntilChanged(),
    shareReplay(1)
  );
}

export function dbxPresetFilterMenuButtonIconObservable(config$: Observable<DbxPresetFilterMenuConfig>, selection$: Observable<Maybe<Partial<Pick<ClickableAnchorLink, 'icon'>>>>, defaultIcon = 'arrow_drop_down') {
  return config$.pipe(
    switchMap((config) => {
      const filterIcon = config.filterIcon === false ? '' : config.filterIcon || defaultIcon;

      return selection$.pipe(
        map((preset) => {
          let icon: Maybe<string>;

          if (config.filterIcon === false) {
            if (config.usePresetIcon) {
              icon = preset?.icon;
            }
          } else if (config.usePresetIcon) {
            icon = preset?.icon ?? filterIcon;
          } else {
            icon = filterIcon;
          }

          return icon;
        })
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
