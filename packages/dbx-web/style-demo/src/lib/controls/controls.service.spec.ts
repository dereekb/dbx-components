import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { type Observable } from 'rxjs';
import { DbxDetachService, DbxStyleService, type DbxStyleSupplement } from '@dereekb/dbx-web';
import { DbxStyleDemoControlsService, DbxStyleDemoControlsServiceConfig } from './controls.service';
import { DbxStyleDemoStyleLoaderService, DbxStyleDemoStyleLoaderServiceConfig } from '../style-loader/style.loader.service';
import { type DbxStyleDemoStyleTemplate } from '../style-loader/style.template';
import { type DbxStyleDemoSectionGroup } from '../section/section';
import { DBX_STYLE_DEMO_SECTION_GROUP } from '../section/section.providers';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';
import { DBX_STYLE_DEMO_TEMPLATE_TOGGLE } from '../template-toggle/template.toggle.providers';

class TestSectionComponent {}

const TEST_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'test',
  sections: [
    { id: 'a', title: 'A', component: TestSectionComponent, defaultEnabled: true },
    { id: 'b', title: 'B', component: TestSectionComponent, defaultEnabled: false },
    { id: 'c', title: 'C', component: TestSectionComponent }
  ]
};

const TEST_TOGGLES: DbxStyleDemoTemplateToggle[] = [
  { templateName: 'shape-full', label: 'Full', group: 'Shape' },
  { templateName: 'shape-none', label: 'None', group: 'Shape' },
  { templateName: 'extra', label: 'Extra' }
];

const TEST_TEMPLATES: DbxStyleDemoStyleTemplate[] = [
  { key: 'shape-full', style: { '--corner': '9999px' }, className: 'c-full' },
  { key: 'shape-none', style: { '--corner': '0' } },
  { key: 'extra', className: 'extra-class' }
];

interface SetupOptions {
  readonly applyStylesToApp?: boolean;
  readonly setSupplement?: (obs: Observable<DbxStyleSupplement>) => void;
}

function setupService(options?: SetupOptions): DbxStyleDemoControlsService {
  const styleService = options?.setSupplement ? { setSupplement: vi.fn(options.setSupplement) } : { setSupplement: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      DbxStyleDemoControlsService,
      DbxStyleDemoStyleLoaderService,
      { provide: DbxStyleDemoStyleLoaderServiceConfig, useValue: { templates: TEST_TEMPLATES } },
      { provide: DBX_STYLE_DEMO_SECTION_GROUP, useValue: TEST_SECTION_GROUP, multi: true },
      ...TEST_TOGGLES.map((toggle) => ({ provide: DBX_STYLE_DEMO_TEMPLATE_TOGGLE, useValue: toggle, multi: true })),
      { provide: DbxDetachService, useValue: { init: vi.fn(() => ({ detach: vi.fn() })) } },
      { provide: DbxStyleService, useValue: styleService },
      ...(options?.applyStylesToApp == null ? [] : [{ provide: DbxStyleDemoControlsServiceConfig, useValue: { applyStylesToApp: options.applyStylesToApp } }])
    ]
  });

  return TestBed.inject(DbxStyleDemoControlsService);
}

describe('DbxStyleDemoControlsService', () => {
  describe('setTemplateActive()', () => {
    it('should activate and deactivate an ungrouped lever independently', () => {
      const service = setupService();

      service.setTemplateActive('extra', true);
      expect(service.activeTemplateKeysSignal().has('extra')).toBe(true);

      service.setTemplateActive('extra', false);
      expect(service.activeTemplateKeysSignal().has('extra')).toBe(false);
    });

    it('should treat same-group levers as mutually exclusive (radio-like)', () => {
      const service = setupService();

      service.setTemplateActive('shape-full', true);
      expect(service.activeTemplateKeysSignal().has('shape-full')).toBe(true);

      service.setTemplateActive('shape-none', true);
      const active = service.activeTemplateKeysSignal();
      expect(active.has('shape-none')).toBe(true);
      expect(active.has('shape-full')).toBe(false);
    });
  });

  describe('setDefaultActiveTemplates()', () => {
    it('should seed defaults that flow through until an override is set', () => {
      const service = setupService();

      service.setDefaultActiveTemplates(['shape-full']);
      expect([...service.activeTemplateKeysSignal()]).toEqual(['shape-full']);
    });

    it('should ignore later default changes once the user has an override', () => {
      const service = setupService();

      service.setDefaultActiveTemplates(['shape-full']);
      service.setTemplateActive('extra', true);

      const afterOverride = service.activeTemplateKeysSignal();
      expect(afterOverride.has('shape-full')).toBe(true);
      expect(afterOverride.has('extra')).toBe(true);

      // No effect: an override already exists.
      service.setDefaultActiveTemplates(['shape-none']);
      const afterReseed = service.activeTemplateKeysSignal();
      expect(afterReseed.has('shape-none')).toBe(false);
      expect(afterReseed.has('extra')).toBe(true);
    });
  });

  describe('enabledIdsSignal', () => {
    it('should default to sections enabled unless defaultEnabled is false', () => {
      const service = setupService();
      const enabled = service.enabledIdsSignal();
      expect(enabled.has('a')).toBe(true);
      expect(enabled.has('b')).toBe(false);
      expect(enabled.has('c')).toBe(true);
    });

    it('should reflect a setSectionEnabled override', () => {
      const service = setupService();
      service.setSectionEnabled('b', true);
      service.setSectionEnabled('a', false);

      const enabled = service.enabledIdsSignal();
      expect(enabled.has('a')).toBe(false);
      expect(enabled.has('b')).toBe(true);
    });
  });

  describe('forwarding to DbxStyleService', () => {
    it('should forward the merged style set as a supplement when enabled (default)', () => {
      let captured: Observable<DbxStyleSupplement> | undefined;
      const service = setupService({ setSupplement: (obs) => (captured = obs) });

      expect(captured).toBeDefined();

      const emissions: DbxStyleSupplement[] = [];
      captured?.subscribe((value) => emissions.push(value));

      service.setTemplateActive('shape-full', true);
      TestBed.tick();

      const latest = emissions[emissions.length - 1];
      expect(latest.classes).toContain('c-full');
      expect(latest.style).toEqual({ '--corner': '9999px' });
    });

    it('should not forward a supplement when applyStylesToApp is false', () => {
      const setSupplement = vi.fn();
      TestBed.configureTestingModule({
        providers: [
          DbxStyleDemoControlsService,
          DbxStyleDemoStyleLoaderService,
          { provide: DbxStyleDemoStyleLoaderServiceConfig, useValue: { templates: TEST_TEMPLATES } },
          { provide: DBX_STYLE_DEMO_SECTION_GROUP, useValue: TEST_SECTION_GROUP, multi: true },
          { provide: DbxDetachService, useValue: { init: vi.fn(() => ({ detach: vi.fn() })) } },
          { provide: DbxStyleService, useValue: { setSupplement } },
          { provide: DbxStyleDemoControlsServiceConfig, useValue: { applyStylesToApp: false } }
        ]
      });

      TestBed.inject(DbxStyleDemoControlsService);
      expect(setSupplement).not.toHaveBeenCalled();
    });
  });
});
