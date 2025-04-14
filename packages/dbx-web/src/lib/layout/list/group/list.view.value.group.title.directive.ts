import { Directive, input, StaticProvider } from '@angular/core';
import { DbxValueListItem, DbxValueListItemConfig } from '../list.view.value';
import { DbxValueListItemGroup, DbxValueListViewGroupDelegate, DbxValueListViewGroupValuesFunction, provideDbxValueListViewGroupDelegate } from './list.view.value.group';
import { map } from 'rxjs';
import { Building, Maybe, PrimativeKey, compareWithMappedValuesFunction, makeValuesGroupMap } from '@dereekb/util';
import { DbxListTitleGroupData, DbxListTitleGroupTitleDelegate } from './list.view.value.group.title';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxListTitleGroupHeaderComponent, DBX_LIST_TITLE_GROUP_DATA } from './list.view.value.group.title.header.component';

/**
 * Delegate used to for grouping DbxValueListItemConfig<T, I> values.
 */
@Directive({
  selector: '[dbxListTitleGroup]',
  providers: [provideDbxValueListViewGroupDelegate(DbxListTitleGroupDirective)],
  standalone: true
})
export class DbxListTitleGroupDirective<T, O extends PrimativeKey = PrimativeKey, D extends DbxListTitleGroupData<O> = DbxListTitleGroupData<O>, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListViewGroupDelegate<D, T, I> {
  readonly delegate = input<Maybe<DbxListTitleGroupTitleDelegate<T, O, D, I>>>(undefined, { alias: 'dbxListTitleGroup' });

  private readonly _delegate$ = toObservable(this.delegate);

  readonly groupValues: DbxValueListViewGroupValuesFunction<D, T, I, unknown, unknown> = (items: DbxValueListItemConfig<T, I>[]) => {
    return this._delegate$.pipe(
      map((delegate) => {
        let groups: DbxValueListItemGroup<D, T, I>[];

        if (delegate != null) {
          const groupsValuesMap = makeValuesGroupMap(items, delegate.groupValueForItem);
          const { sortGroupsByData, cssClasses: inputCssClasses } = delegate;
          const cssClassesForAllGroups = inputCssClasses ?? [];

          const componentClass = delegate.headerComponentClass ?? DbxListTitleGroupHeaderComponent;
          const { dataForGroupValue, footerComponentClass } = delegate;

          groups = Array.from(groupsValuesMap.entries()).map(([value, items]) => {
            const data = dataForGroupValue(value as O, items);
            (data as Building<D>).value = value as O;
            const cssClasses = data.cssClasses ? [...cssClassesForAllGroups, ...data.cssClasses] : cssClassesForAllGroups;

            const providers: StaticProvider[] = [
              {
                provide: DBX_LIST_TITLE_GROUP_DATA,
                useValue: data
              }
            ];

            const group: DbxValueListItemGroup<D, T, I> = {
              id: String(value),
              data,
              items,
              headerConfig: { componentClass, providers },
              footerConfig: footerComponentClass ? { componentClass: footerComponentClass, providers } : undefined,
              cssClasses
            };

            return group;
          });

          if (sortGroupsByData) {
            groups.sort(compareWithMappedValuesFunction((x) => x.data, sortGroupsByData));
          }
        } else {
          groups = [
            {
              id: '_',
              data: { value: null as any, title: '' } as D,
              items
            }
          ];
        }

        return groups;
      })
    );
  };
}
