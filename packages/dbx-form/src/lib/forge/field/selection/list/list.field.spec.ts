import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeListSelectionField } from './list.field';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';

// MARK: forgeListSelectionField
describe('forgeListSelectionField()', () => {
  const stubListComponentClass = of(class {} as unknown as import('@angular/core').Type<AbstractDbxSelectionListWrapperDirective<unknown>>);
  const stubReadKey = (item: { id: string }) => item.id;
  const stubState$ = of(successResult([]));

  function minimalConfig() {
    return {
      key: 'selectedItems',
      listComponentClass: stubListComponentClass,
      readKey: stubReadKey,
      state$: stubState$
    } as Parameters<typeof forgeListSelectionField>[0];
  }

  it('should set the correct type', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.type).toBe('dbx-list-selection');
  });

  it('should set the key', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.key).toBe('selectedItems');
  });

  it('should set the label when provided', () => {
    const field = forgeListSelectionField({ ...minimalConfig(), label: 'Items' });
    expect(field.label).toBe('Items');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should set required when provided', () => {
    const field = forgeListSelectionField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgeListSelectionField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgeListSelectionField({ ...minimalConfig(), description: 'Select items from the list' });
    expect(field.props?.hint).toBe('Select items from the list');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate listComponentClass through props', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.props?.listComponentClass).toBe(stubListComponentClass);
  });

  it('should propagate readKey through props', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.props?.readKey).toBe(stubReadKey);
  });

  it('should propagate state$ through props', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.props?.state$).toBe(stubState$);
  });

  it('should propagate loadMore through props when provided', () => {
    const loadMore = () => {};
    const field = forgeListSelectionField({ ...minimalConfig(), loadMore });
    expect(field.props?.loadMore).toBe(loadMore);
  });

  it('should not set loadMore when not provided', () => {
    const field = forgeListSelectionField(minimalConfig());
    expect(field.props?.loadMore).toBeUndefined();
  });
});
