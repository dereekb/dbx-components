/**
 * Runtime tests for dbxForgeGroup() / dbxForgeContainer() factories, plus
 * integrated form scenarios verifying how each shapes the resulting form
 * value. Groups produce a nested object under their key; containers are
 * purely visual and keep the value flat.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ContainerField, GroupField, GroupAllowedChildren } from '@ng-forge/dynamic-forms';
import { waitForMs } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { dbxForgeGroup, dbxForgeContainer } from './wrapper';
import { dbxForgeTextField } from '../value/text/text.field';
import { DbxForgeAsyncConfigFormComponent } from '../../form';
import { DBX_FORGE_TEST_PROVIDERS } from '../../form/forge.component.spec';

// ============================================================================
// Runtime Factory Tests - dbxForgeGroup()
// ============================================================================

describe('dbxForgeGroup()', () => {
  it('should produce a group-typed field with the given key', () => {
    const field = dbxForgeGroup({
      key: 'address',
      fields: [dbxForgeTextField({ key: 'city' })] as unknown as GroupAllowedChildren[]
    });

    expect(field.type).toBe('group');
    expect(field.key).toBe('address');
  });

  it('should pass child fields through unchanged', () => {
    const city = dbxForgeTextField({ key: 'city' });
    const field = dbxForgeGroup({
      key: 'address',
      fields: [city] as unknown as GroupAllowedChildren[]
    });

    expect(field.fields).toHaveLength(1);
    expect(field.fields[0]).toBe(city);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeContainer()
// ============================================================================

describe('dbxForgeContainer()', () => {
  it('should produce a container-typed field with the given key', () => {
    const field = dbxForgeContainer({
      key: 'my-container',
      fields: [dbxForgeTextField({ key: 'city' })] as unknown as ContainerField['fields']
    });

    expect(field.type).toBe('container');
    expect(field.key).toBe('my-container');
  });

  it('should auto-generate a key when none is provided', () => {
    const field = dbxForgeContainer({
      fields: [dbxForgeTextField({ key: 'city' })] as unknown as ContainerField['fields']
    });

    expect(typeof field.key).toBe('string');
    expect(field.key).toMatch(/^_container_\d+$/);
  });

  it('should default wrappers to an empty array', () => {
    const field = dbxForgeContainer({
      fields: [dbxForgeTextField({ key: 'city' })] as unknown as ContainerField['fields']
    });

    expect(field.wrappers).toEqual([]);
  });

  it('should preserve wrappers passed in config', () => {
    const field = dbxForgeContainer({
      fields: [dbxForgeTextField({ key: 'city' })] as unknown as ContainerField['fields'],
      wrappers: [{ type: 'my-wrapper' }] as unknown as ContainerField['wrappers']
    });

    expect(field.wrappers).toHaveLength(1);
    expect((field.wrappers[0] as { type: string }).type).toBe('my-wrapper');
  });
});

// ============================================================================
// Integrated Form Scenarios
// ============================================================================

describe('wrapper form value scenarios', () => {
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

  describe('dbxForgeGroup', () => {
    it('should nest child values under the group key in the form value', async () => {
      const groupField = dbxForgeGroup({
        key: 'address',
        fields: [dbxForgeTextField({ key: 'city' }), dbxForgeTextField({ key: 'state' })] as unknown as GroupAllowedChildren[]
      }) as unknown as GroupField;

      fixture.componentInstance.config.set({ fields: [groupField] });
      await settle();

      fixture.componentInstance.setValue({ address: { city: 'Metropolis', state: 'NY' } } as unknown as Partial<unknown>);
      await settle(0);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { address: { city: string; state: string } };
      expect(value).toEqual({ address: { city: 'Metropolis', state: 'NY' } });
    });

    it('should emit the group value even when a sibling non-group field is left untouched', async () => {
      // Reproduces the reported behavior: a group alongside a sibling flat field.
      // Setting only the group's nested value must still surface in the form
      // output — the group should not depend on a sibling update to emit.
      const groupField = dbxForgeGroup({
        key: 'address',
        fields: [dbxForgeTextField({ key: 'city' })] as unknown as GroupAllowedChildren[]
      }) as unknown as GroupField;

      const siblingField = dbxForgeTextField({ key: 'name' });

      fixture.componentInstance.config.set({ fields: [groupField, siblingField] });
      await settle();

      // Only set the group — leave the sibling alone.
      fixture.componentInstance.setValue({ address: { city: 'Metropolis' } } as unknown as Partial<unknown>);
      await settle(0);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { address?: { city: string }; name?: string };
      expect(value.address).toEqual({ city: 'Metropolis' });
    });

    it('should update the group value independently when the sibling is later set', async () => {
      // Follow-up to the scenario above: once the sibling is also set, both
      // values should coexist — the group value is not lost or overwritten.
      const groupField = dbxForgeGroup({
        key: 'address',
        fields: [dbxForgeTextField({ key: 'city' })] as unknown as GroupAllowedChildren[]
      }) as unknown as GroupField;

      const siblingField = dbxForgeTextField({ key: 'name' });

      fixture.componentInstance.config.set({ fields: [groupField, siblingField] });
      await settle();

      fixture.componentInstance.setValue({ address: { city: 'Metropolis' } } as unknown as Partial<unknown>);
      await settle(0);

      fixture.componentInstance.setValue({ address: { city: 'Metropolis' }, name: 'Clark' } as unknown as Partial<unknown>);
      await settle(0);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { address: { city: string }; name: string };
      expect(value).toEqual({ address: { city: 'Metropolis' }, name: 'Clark' });
    });
  });

  describe('dbxForgeContainer', () => {
    it('should keep child values flat (not nested under the container key)', async () => {
      const containerField = dbxForgeContainer({
        key: 'visual_only',
        fields: [dbxForgeTextField({ key: 'city' }), dbxForgeTextField({ key: 'state' })] as unknown as ContainerField['fields']
      });

      fixture.componentInstance.config.set({ fields: [containerField] });
      await settle();

      fixture.componentInstance.setValue({ city: 'Metropolis', state: 'NY' } as unknown as Partial<unknown>);
      await settle(0);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as Record<string, unknown>;
      expect(value).toEqual({ city: 'Metropolis', state: 'NY' });
      expect(value).not.toHaveProperty('visual_only');
    });
  });
});
