/**
 * Runtime tests for the dbxForgeFlexLayout() factory and an integrated form
 * scenario verifying that child field values stay flat — the flex layout uses
 * a `container` (not a `group`), so wrapped fields sit at the same level as
 * the layout itself in the form value.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { waitForMs } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { DBX_FORGE_FLEX_WRAPPER_TYPE_NAME, dbxForgeFlexLayout, type DbxForgeFlexWrapper } from './flex.wrapper';
import { dbxForgeTextField } from '../../value/text/text.field';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';

// ============================================================================
// Runtime Factory Tests - dbxForgeFlexLayout()
// ============================================================================

describe('dbxForgeFlexLayout()', () => {
  it('should produce a container field (not a group) so child values stay flat', () => {
    const field = dbxForgeFlexLayout({
      fields: [dbxForgeTextField({ key: 'city' }), dbxForgeTextField({ key: 'state' })]
    });

    expect(field.type).toBe('container');
  });

  it('should attach the flex wrapper', () => {
    const field = dbxForgeFlexLayout({
      fields: [dbxForgeTextField({ key: 'city' })]
    });

    expect((field.wrappers as { type: string }[]).some((w) => w.type === DBX_FORGE_FLEX_WRAPPER_TYPE_NAME)).toBe(true);
  });

  it('should preserve child field count and order', () => {
    const city = dbxForgeTextField({ key: 'city' });
    const state = dbxForgeTextField({ key: 'state' });
    const zip = dbxForgeTextField({ key: 'zip' });

    const field = dbxForgeFlexLayout({ fields: [city, state, zip] });

    expect(field.fields).toHaveLength(3);
    expect((field.fields[0] as { key: string }).key).toBe('city');
    expect((field.fields[1] as { key: string }).key).toBe('state');
    expect((field.fields[2] as { key: string }).key).toBe('zip');
  });

  it('should apply the default size className to plain field entries', () => {
    const field = dbxForgeFlexLayout({
      fields: [dbxForgeTextField({ key: 'city' }), dbxForgeTextField({ key: 'state' })]
    });

    expect((field.fields[0] as { className: string }).className).toBe('dbx-flex-2');
    expect((field.fields[1] as { className: string }).className).toBe('dbx-flex-2');
  });

  it('should override the default size when one is provided', () => {
    const field = dbxForgeFlexLayout({
      size: 4,
      fields: [dbxForgeTextField({ key: 'city' })]
    });

    expect((field.fields[0] as { className: string }).className).toBe('dbx-flex-4');
  });

  it('should apply per-field size overrides via DbxForgeFlexLayoutFieldConfig entries', () => {
    const field = dbxForgeFlexLayout({
      size: 1,
      fields: [{ field: dbxForgeTextField({ key: 'city' }), size: 4 }, dbxForgeTextField({ key: 'state' })]
    });

    expect((field.fields[0] as { className: string }).className).toBe('dbx-flex-4');
    expect((field.fields[1] as { className: string }).className).toBe('dbx-flex-1');
  });

  it('should merge an existing className with the flex size className', () => {
    const field = dbxForgeFlexLayout({
      fields: [{ ...dbxForgeTextField({ key: 'city' }), className: 'my-class' }]
    });

    expect((field.fields[0] as { className: string }).className).toBe('my-class dbx-flex-2');
  });

  it('should propagate breakpoint, relative, and breakToColumn to the flex wrapper', () => {
    const field = dbxForgeFlexLayout({
      breakpoint: 'small',
      relative: true,
      breakToColumn: true,
      fields: [dbxForgeTextField({ key: 'city' })]
    });

    const wrapper = (field.wrappers as DbxForgeFlexWrapper[]).find((w) => w.type === DBX_FORGE_FLEX_WRAPPER_TYPE_NAME) as DbxForgeFlexWrapper;
    expect(wrapper.breakpoint).toBe('small');
    expect(wrapper.relative).toBe(true);
    expect(wrapper.breakToColumn).toBe(true);
  });
});

// ============================================================================
// Integrated Form Scenario - Flattened Form Value
// ============================================================================

describe('dbxForgeFlexLayout form value scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...DBX_FORGE_TEST_PROVIDERS] });
    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function settle(ms = 0): Promise<void> {
    fixture.detectChanges();
    await waitForMs(ms);
    await fixture.whenStable();
  }

  it('should keep all child field values flat (not nested under the flex container key)', async () => {
    const flexField = dbxForgeFlexLayout({
      fields: [dbxForgeTextField({ key: 'city' }), dbxForgeTextField({ key: 'state' }), dbxForgeTextField({ key: 'zip' })]
    });

    fixture.componentInstance.config.set({ fields: [flexField] });
    await settle();

    fixture.componentInstance.setValue({ city: 'Metropolis', state: 'NY', zip: '10001' } as unknown as Partial<unknown>);
    await settle(0);

    const value = (await firstValueFrom(fixture.componentInstance.getValue())) as Record<string, unknown>;
    expect(value).toEqual({ city: 'Metropolis', state: 'NY', zip: '10001' });
    expect(value).not.toHaveProperty(flexField.key as string);
  });

  it('should keep flex children flat alongside a sibling field at the parent level', async () => {
    const flexField = dbxForgeFlexLayout({
      fields: [dbxForgeTextField({ key: 'state' }), dbxForgeTextField({ key: 'zip' })]
    });
    const sibling = dbxForgeTextField({ key: 'city' });

    fixture.componentInstance.config.set({ fields: [sibling, flexField] });
    await settle();

    fixture.componentInstance.setValue({ city: 'Metropolis', state: 'NY', zip: '10001' } as unknown as Partial<unknown>);
    await settle(0);

    const value = (await firstValueFrom(fixture.componentInstance.getValue())) as Record<string, unknown>;
    expect(value).toEqual({ city: 'Metropolis', state: 'NY', zip: '10001' });
  });
});
