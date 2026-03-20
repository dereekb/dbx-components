import { Component } from '@angular/core';
import { dbxInjectionComponentConfigIsEqual, type DbxInjectionComponentConfig } from './injection';

@Component({ template: '', standalone: true })
class TestComponentA {}

@Component({ template: '', standalone: true })
class TestComponentB {}

describe('dbxInjectionComponentConfigIsEqual()', () => {
  describe('nullish handling', () => {
    it('should return true when both are null', () => {
      expect(dbxInjectionComponentConfigIsEqual(null, null)).toBe(true);
    });

    it('should return true when both are undefined', () => {
      expect(dbxInjectionComponentConfigIsEqual(undefined, undefined)).toBe(true);
    });

    it('should return false when null vs undefined', () => {
      expect(dbxInjectionComponentConfigIsEqual(null, undefined)).toBe(false);
    });

    it('should return false when one is null and the other is a config', () => {
      const config: DbxInjectionComponentConfig = { componentClass: TestComponentA };
      expect(dbxInjectionComponentConfigIsEqual(null, config)).toBe(false);
      expect(dbxInjectionComponentConfigIsEqual(config, null)).toBe(false);
    });

    it('should return false when one is undefined and the other is a config', () => {
      const config: DbxInjectionComponentConfig = { componentClass: TestComponentA };
      expect(dbxInjectionComponentConfigIsEqual(undefined, config)).toBe(false);
      expect(dbxInjectionComponentConfigIsEqual(config, undefined)).toBe(false);
    });
  });

  describe('reference equality', () => {
    it('should return true when both are the same reference', () => {
      const config: DbxInjectionComponentConfig = { componentClass: TestComponentA };
      expect(dbxInjectionComponentConfigIsEqual(config, config)).toBe(true);
    });
  });

  describe('structural equality', () => {
    it('should return true when componentClass, data, init, and injector are the same', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const init = (instance: unknown) => {};
      const configA: DbxInjectionComponentConfig = { componentClass: TestComponentA, data: 'test', init };
      const configB: DbxInjectionComponentConfig = { componentClass: TestComponentA, data: 'test', init };

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(true);
    });

    it('should return false when componentClass differs', () => {
      const configA: DbxInjectionComponentConfig = { componentClass: TestComponentA };
      const configB: DbxInjectionComponentConfig = { componentClass: TestComponentB };

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(false);
    });

    it('should return false when data differs', () => {
      const configA: DbxInjectionComponentConfig = { componentClass: TestComponentA, data: 'a' };
      const configB: DbxInjectionComponentConfig = { componentClass: TestComponentA, data: 'b' };

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(false);
    });

    it('should return false when init differs', () => {
      /* eslint-disable @typescript-eslint/no-empty-function */
      const configA: DbxInjectionComponentConfig = { componentClass: TestComponentA, init: () => {} };
      const configB: DbxInjectionComponentConfig = { componentClass: TestComponentA, init: () => {} };
      /* eslint-enable @typescript-eslint/no-empty-function */

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(false);
    });
  });

  describe('provider changes (list data update scenario)', () => {
    it('should return true when only providers differ', () => {
      const configA: DbxInjectionComponentConfig = {
        componentClass: TestComponentA,
        providers: [{ provide: 'TOKEN', useValue: 'value-a' }]
      };

      const configB: DbxInjectionComponentConfig = {
        componentClass: TestComponentA,
        providers: [{ provide: 'TOKEN', useValue: 'value-b' }]
      };

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(true);
    });

    it('should return true when providers are added where there were none', () => {
      const configA: DbxInjectionComponentConfig = { componentClass: TestComponentA };
      const configB: DbxInjectionComponentConfig = {
        componentClass: TestComponentA,
        providers: [{ provide: 'TOKEN', useValue: 'value' }]
      };

      expect(dbxInjectionComponentConfigIsEqual(configA, configB)).toBe(true);
    });
  });
});
