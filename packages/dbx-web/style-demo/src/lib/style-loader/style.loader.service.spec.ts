import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DbxStyleDemoStyleLoaderService, DbxStyleDemoStyleLoaderServiceConfig } from './style.loader.service';
import { type DbxStyleDemoStyleTemplate } from './style.template';

/**
 * Configures a {@link DbxStyleDemoStyleLoaderService} via TestBed, optionally seeding it with a config.
 */
function setupService(seedTemplates?: DbxStyleDemoStyleTemplate[]): DbxStyleDemoStyleLoaderService {
  TestBed.configureTestingModule({
    providers: [DbxStyleDemoStyleLoaderService, ...(seedTemplates ? [{ provide: DbxStyleDemoStyleLoaderServiceConfig, useValue: { templates: seedTemplates } }] : [])]
  });

  return TestBed.inject(DbxStyleDemoStyleLoaderService);
}

describe('DbxStyleDemoStyleLoaderService', () => {
  describe('register()', () => {
    it('should register a template and report it via hasTemplate/getTemplate', () => {
      const service = setupService();
      const template: DbxStyleDemoStyleTemplate = { key: 'k1', style: { '--token-x': 'red' } };

      service.register(template);

      expect(service.hasTemplate('k1')).toBe(true);
      expect(service.getTemplate('k1')).toEqual(template);
    });

    it('should replace an existing key by default (override=true)', () => {
      const service = setupService();
      service.register({ key: 'k1', style: { '--token-x': 'red' } });
      service.register({ key: 'k1', style: { '--token-x': 'blue' } });

      expect(service.getTemplate('k1')?.style).toEqual({ '--token-x': 'blue' });
    });

    it('should keep the existing entry when override=false', () => {
      const service = setupService();
      service.register({ key: 'k1', style: { '--token-x': 'red' } });
      service.register({ key: 'k1', style: { '--token-x': 'blue' } }, false);

      expect(service.getTemplate('k1')?.style).toEqual({ '--token-x': 'red' });
    });

    it('should register an array of templates and list their keys', () => {
      const service = setupService();
      service.register([{ key: 'a' }, { key: 'b' }]);

      expect(service.getAllRegisteredTemplateKeys()).toEqual(['a', 'b']);
    });
  });

  describe('getCuratedTemplates()', () => {
    it('should return only templates flagged curated', () => {
      const service = setupService();
      service.register([{ key: 'a', curated: true }, { key: 'b' }, { key: 'c', curated: true }]);

      expect(service.getCuratedTemplates().map((template) => template.key)).toEqual(['a', 'c']);
    });
  });

  describe('mergeTemplates()', () => {
    it('should resolve string keys through the registry', () => {
      const service = setupService();
      service.register({ key: 'k1', style: { '--token-x': 'red' }, className: 'demo' });

      const result = service.mergeTemplates(['k1']);
      expect(result.style).toEqual({ '--token-x': 'red' });
      expect(result.classes).toEqual(['demo']);
    });

    it('should skip unknown keys', () => {
      const service = setupService();
      service.register({ key: 'k1', style: { '--token-x': 'red' } });

      const result = service.mergeTemplates(['k1', 'missing']);
      expect(result.style).toEqual({ '--token-x': 'red' });
    });

    it('should apply precedence (later keys win) when merging multiple keys', () => {
      const service = setupService();
      service.register([
        { key: 'a', style: { '--token-x': 'red' } },
        { key: 'b', style: { '--token-x': 'blue' } }
      ]);

      const result = service.mergeTemplates(['a', 'b']);
      expect(result.style).toEqual({ '--token-x': 'blue' });
    });

    it('should accept inline template objects alongside keys', () => {
      const service = setupService();
      service.register({ key: 'a', className: 'from-key' });

      const result = service.mergeTemplates(['a', { key: 'inline', className: 'from-inline' }]);
      expect(result.classes).toEqual(['from-key', 'from-inline']);
    });
  });

  describe('seeding via injected config', () => {
    it('should register templates supplied through DbxStyleDemoStyleLoaderServiceConfig at construction', () => {
      const service = setupService([{ key: 'seeded', style: { '--token-x': 'green' } }]);

      expect(service.hasTemplate('seeded')).toBe(true);
      expect(service.mergeTemplates(['seeded']).style).toEqual({ '--token-x': 'green' });
    });
  });
});
