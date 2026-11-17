import { TestBed } from '@angular/core/testing';
import { addModifiers, maybeModifierMapToFunction, type Modifier } from '@dereekb/util';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DbxValueListItem } from '../list.view.value';
import { DbxListSingleSelectionStore } from './list.single.selection.store';
import { dbxListItemSingleSelectionModifier } from './list.single.selection.directive';

interface TestValue {
  readonly name: string;
}

describe('DbxListSingleSelectionStore', () => {
  let store: DbxListSingleSelectionStore<TestValue>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxListSingleSelectionStore] });
    store = TestBed.inject(DbxListSingleSelectionStore) as DbxListSingleSelectionStore<TestValue>;
  });

  const a = { key: 'a', value: { name: 'A' } };
  const b = { key: 'b', value: { name: 'B' } };

  it('should start with no selection', () => {
    expect(store.selectedSignal()).toBeUndefined();
    expect(store.previousSignal()).toBeUndefined();
    expect(store.hasSelectionSignal()).toBe(false);
  });

  describe('selectEntry()', () => {
    it('should select the entry', () => {
      store.selectEntry(a);
      expect(store.selectedKeySignal()).toBe('a');
      expect(store.selectedValueSignal()).toEqual({ name: 'A' });
      expect(store.previousSignal()).toBeUndefined();
    });

    it('should move the old selection to previous', () => {
      store.selectEntry(a);
      store.selectEntry(b);
      expect(store.selectedKeySignal()).toBe('b');
      expect(store.previousSignal()?.key).toBe('a');
    });

    it('should do nothing when re-selecting the same key', () => {
      store.selectEntry(a);
      store.selectEntry(b);
      store.selectEntry(b);
      expect(store.selectedKeySignal()).toBe('b');
      expect(store.previousSignal()?.key).toBe('a');
    });
  });

  describe('toggle()', () => {
    it('should keep the selection when toggling the selected key and allowDeselect is false', () => {
      store.toggle(a);
      store.toggle(a);
      expect(store.selectedKeySignal()).toBe('a');
    });

    it('should deselect when toggling the selected key and allowDeselect is true', () => {
      store.setAllowDeselect(true);
      store.toggle(a);
      store.toggle(a);
      expect(store.selectedKeySignal()).toBeUndefined();
      expect(store.previousSignal()?.key).toBe('a');
    });

    it('should select a different key', () => {
      store.toggle(a);
      store.toggle(b);
      expect(store.selectedKeySignal()).toBe('b');
      expect(store.previousSignal()?.key).toBe('a');
    });
  });

  describe('clear()', () => {
    it('should clear the selection and keep it as previous', () => {
      store.selectEntry(a);
      store.clear();
      expect(store.selectedSignal()).toBeUndefined();
      expect(store.previousSignal()?.key).toBe('a');
    });
  });

  describe('clearIfKey()', () => {
    it('should clear when the key matches', () => {
      store.selectEntry(a);
      store.clearIfKey('a');
      expect(store.selectedSignal()).toBeUndefined();
    });

    it('should not clear when the key does not match', () => {
      store.selectEntry(a);
      store.clearIfKey('b');
      expect(store.selectedKeySignal()).toBe('a');
    });
  });

  describe('dbxListItemSingleSelectionModifier()', () => {
    function makeItem(key: string): DbxValueListItem<TestValue> {
      return { key, itemValue: { name: key.toUpperCase() } };
    }

    it('should mark the selected item as selected', () => {
      const modifier = dbxListItemSingleSelectionModifier(store, 'a');
      const itemA = makeItem('a');
      const itemB = makeItem('b');
      modifier.modify(itemA);
      modifier.modify(itemB);
      expect(itemA.selected).toBe(true);
      expect(itemB.selected).toBe(false);
    });

    it('should select the item when its anchor is clicked', () => {
      const modifier = dbxListItemSingleSelectionModifier(store, undefined);
      const item = makeItem('b');
      modifier.modify(item);
      item.anchor?.onClick?.();
      expect(store.selectedKeySignal()).toBe('b');
      expect(store.selectedValueSignal()).toEqual({ name: 'B' });
    });

    describe('with an anchor modifier', () => {
      const anchorOnClick = vi.fn();
      const anchorModifier: Modifier<DbxValueListItem<TestValue>> = {
        key: 'router_anchor',
        modify: (x) => {
          x.anchor = { onClick: anchorOnClick };
        }
      };

      beforeEach(() => {
        anchorOnClick.mockClear();
      });

      it('should wrap the anchor when the selection modifier runs after the anchor modifier', () => {
        const selectionModifier = dbxListItemSingleSelectionModifier(store, undefined);
        const modifyFn = maybeModifierMapToFunction(addModifiers([anchorModifier, selectionModifier]));
        const item = makeItem('a');
        modifyFn?.(item);
        item.anchor?.onClick?.();
        expect(anchorOnClick).toHaveBeenCalledTimes(1);
        expect(store.selectedKeySignal()).toBe('a');
      });

      it('should run last again after re-linking when the selection modifier was added first', () => {
        let map = addModifiers([dbxListItemSingleSelectionModifier(store, undefined), anchorModifier]);

        // the directive re-links its modifier on each selection change, which moves it to the end of the map
        map.delete(dbxListItemSingleSelectionModifier(store, undefined).key);
        map = addModifiers(dbxListItemSingleSelectionModifier(store, 'b'), map);

        const modifyFn = maybeModifierMapToFunction(map);
        const item = makeItem('a');
        modifyFn?.(item);
        item.anchor?.onClick?.();
        expect(anchorOnClick).toHaveBeenCalledTimes(1);
        expect(store.selectedKeySignal()).toBe('a');
      });
    });
  });
});
