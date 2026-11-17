import { Component, type Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { maybeModifierMapToFunction } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { type DbxValueListItem } from '../list.view.value';
import { DbxValueListItemModifierDirective } from '../modifier/list.view.value.modifier.directive';
import { type AnchorForValueFunction, DbxListItemAnchorModifierDirective } from '../../../router/layout/list/router.list.directive';
import { DbxListItemSingleSelectionModifierDirective } from './list.single.selection.directive';

interface TestValue {
  readonly name: string;
}

const anchorOnClick = vi.fn();
const anchorForItem: AnchorForValueFunction<TestValue> = () => ({ onClick: anchorOnClick });

@Component({
  template: `
    <div dbxListItemModifier [dbxListItemAnchorModifier]="anchorForItem" dbxListItemSingleSelectionModifier></div>
  `,
  imports: [DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective, DbxListItemSingleSelectionModifierDirective]
})
class AnchorFirstHostComponent {
  readonly anchorForItem = anchorForItem;
  readonly modifierDirective = viewChild.required(DbxValueListItemModifierDirective);
  readonly selectionDirective = viewChild.required(DbxListItemSingleSelectionModifierDirective);
}

@Component({
  template: `
    <div dbxListItemModifier dbxListItemSingleSelectionModifier [dbxListItemAnchorModifier]="anchorForItem"></div>
  `,
  imports: [DbxValueListItemModifierDirective, DbxListItemSingleSelectionModifierDirective, DbxListItemAnchorModifierDirective]
})
class SelectionFirstHostComponent {
  readonly anchorForItem = anchorForItem;
  readonly modifierDirective = viewChild.required(DbxValueListItemModifierDirective);
  readonly selectionDirective = viewChild.required(DbxListItemSingleSelectionModifierDirective);
}

describe('DbxListItemSingleSelectionModifierDirective', () => {
  function describeOrder(name: string, hostType: Type<AnchorFirstHostComponent | SelectionFirstHostComponent>) {
    describe(name, () => {
      async function setup() {
        anchorOnClick.mockClear();
        const fixture = TestBed.createComponent(hostType);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture.componentInstance;
      }

      async function modifiedItem(host: AnchorFirstHostComponent | SelectionFirstHostComponent, key: string): Promise<DbxValueListItem<TestValue>> {
        const modifiers = await firstValueFrom(host.modifierDirective().modifiers$);
        const item: DbxValueListItem<TestValue> = { key, itemValue: { name: key } };
        maybeModifierMapToFunction(modifiers)?.(item);
        return item;
      }

      it('should run the anchor onClick and select the item when clicked', async () => {
        const host = await setup();
        const item = await modifiedItem(host, 'a');

        item.anchor?.onClick?.();

        expect(anchorOnClick).toHaveBeenCalledTimes(1);
        expect(host.selectionDirective().store.selectedKeySignal()).toBe('a');
      });

      it('should mark the selected item as selected after the selection changes', async () => {
        const host = await setup();
        host.selectionDirective().store.selectEntry({ key: 'b', value: { name: 'b' } });

        const itemA = await modifiedItem(host, 'a');
        const itemB = await modifiedItem(host, 'b');

        expect(itemA.selected).toBe(false);
        expect(itemB.selected).toBe(true);

        itemA.anchor?.onClick?.();
        expect(anchorOnClick).toHaveBeenCalledTimes(1);
        expect(host.selectionDirective().store.selectedKeySignal()).toBe('a');
        expect(host.selectionDirective().store.previousSignal()?.key).toBe('b');
      });
    });
  }

  describeOrder('anchor modifier declared first', AnchorFirstHostComponent);
  describeOrder('selection modifier declared first', SelectionFirstHostComponent);
});
