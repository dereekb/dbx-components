import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { dbxWebDefaultPageTitleDelegate, type DbxWebPageTitleDelegate } from './title.delegate';
import { type DbxWebPageTitleInfoConfig, type DbxWebPageTitleInfoReference } from './title';
import { DbxWebPageTitleService } from './title.service';
import { provideDbxWebPageTitleService } from './title.providers';

function makeReference(chain: readonly DbxWebPageTitleInfoConfig[], isLeaf: boolean): DbxWebPageTitleInfoReference & { setLeaf(value: boolean): void } {
  const isLeaf$ = new BehaviorSubject<boolean>(isLeaf);
  return {
    chain$: of(chain),
    isLeaf$,
    setLeaf(value: boolean) {
      isLeaf$.next(value);
    }
  };
}

describe('DbxWebPageTitleService', () => {
  let originalTitle: string;

  beforeEach(() => {
    originalTitle = document.title;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  describe('with rootConfig title', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideDbxWebPageTitleService({ rootConfig: { title: 'TestApp' } })]
      });
    });

    it('emits the rootConfig title when no references are registered', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      const details = await firstValueFrom(service.titleDetails$);

      expect(details.title).toBe('TestApp');
      expect(details.description).toBeUndefined();
    });

    it('applies the rootConfig title to document.title via Title service on creation', () => {
      const titleService = TestBed.inject(Title);
      TestBed.inject(DbxWebPageTitleService);

      expect(titleService.getTitle()).toBe('TestApp');
    });

    it('prepends the rootConfig to a registered leaf reference chain (rootConfig sits at the root)', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      const ref = makeReference([{ title: 'Inbox' }], true);

      service.register(ref);

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('Inbox | TestApp');
    });

    it('reverts to the rootConfig title when the leaf reference is unregistered', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      const ref = makeReference([{ title: 'Inbox' }], true);

      service.register(ref);
      let details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('Inbox | TestApp');

      service.unregister(ref);
      details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('TestApp');
    });

    it('honors leaf priority across multiple references using the default leaf-first delegate', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);

      const root = makeReference([{ title: 'MyApp' }], false);
      const leaf = makeReference([{ title: 'MyApp' }, { title: 'Inbox' }], true);

      service.register(root);
      service.register(leaf);

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('Inbox | MyApp | TestApp');
    });

    it('falls back to the parent when the leaf reference is unregistered (parent becomes the active leaf)', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);

      const root = makeReference([{ title: 'MyApp' }], false);
      const leaf = makeReference([{ title: 'MyApp' }, { title: 'Inbox' }], true);

      service.register(root);
      service.register(leaf);

      service.unregister(leaf);
      root.setLeaf(true);

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('MyApp | TestApp');
    });

    it('uses the most recently registered leaf as a tiebreaker when multiple leaves exist', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);

      const a = makeReference([{ title: 'PageA' }], true);
      const b = makeReference([{ title: 'PageB' }], true);

      service.register(a);
      service.register(b);

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('PageB | TestApp');
    });

    it('exposes the leaf-most non-empty description', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);

      const ref = makeReference([{ title: 'MyApp', description: 'Root description' }, { title: 'Section' }, { title: 'Page', description: 'Leaf description' }], true);

      service.register(ref);

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.description).toBe('Leaf description');
    });

    it('lets rootConfig contribute a description that is used when no chain segment overrides it', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideDbxWebPageTitleService({ rootConfig: { title: 'TestApp', description: 'App description' } })]
      });

      const service = TestBed.inject(DbxWebPageTitleService);
      const details = await firstValueFrom(service.titleDetails$);

      expect(details.description).toBe('App description');
    });

    it('can replace the rootConfig at runtime via setRootConfig', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);

      service.setRootConfig({ title: 'Renamed' });

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('Renamed');
    });
  });

  describe('with empty rootConfig', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideDbxWebPageTitleService()]
      });
    });

    it('falls back to the delegate defaultTitle (empty string) when rootConfig is empty and no leaves are registered', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('');
    });

    it('produces a title from registered leaf references without an extra rootConfig segment', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      service.register(makeReference([{ title: 'OnlyMe' }], true));

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('OnlyMe');
    });
  });

  describe('with title sync disabled', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideDbxWebPageTitleService({ rootConfig: { title: 'OffApp' }, initialTitleSyncEnabled: false })]
      });
    });

    it('does not call Title.setTitle when sync is disabled at construction', () => {
      const titleService = TestBed.inject(Title);
      titleService.setTitle('PreservedTitle');

      TestBed.inject(DbxWebPageTitleService);

      expect(titleService.getTitle()).toBe('PreservedTitle');
    });

    it('starts syncing once setTitleSyncEnabled(true) is called', async () => {
      const titleService = TestBed.inject(Title);
      titleService.setTitle('PreservedTitle');

      const service = TestBed.inject(DbxWebPageTitleService);
      service.register(makeReference([{ title: 'Live' }], true));

      service.setTitleSyncEnabled(true);
      await firstValueFrom(service.titleDetails$);

      expect(titleService.getTitle()).toBe('Live | OffApp');
    });

    it('stops syncing when setTitleSyncEnabled(false) is called after enabling', async () => {
      const titleService = TestBed.inject(Title);
      const service = TestBed.inject(DbxWebPageTitleService);

      service.setTitleSyncEnabled(true);
      service.register(makeReference([{ title: 'First' }], true));
      await firstValueFrom(service.titleDetails$);
      expect(titleService.getTitle()).toBe('First | OffApp');

      service.setTitleSyncEnabled(false);
      titleService.setTitle('FrozenTitle');

      const newRef = makeReference([{ title: 'WouldBeApplied' }], true);
      service.register(newRef);
      await firstValueFrom(service.titleDetails$);

      expect(titleService.getTitle()).toBe('FrozenTitle');
    });
  });

  describe('with a custom delegate', () => {
    const customDelegate: DbxWebPageTitleDelegate = {
      buildPageTitleDetails: ({ chain, rootConfig }) => {
        const fullChain = rootConfig ? [rootConfig, ...chain] : chain;
        const titles = fullChain.map((c) => c.title).filter((t): t is string => Boolean(t));
        return {
          title: titles.length === 0 ? 'EMPTY' : titles.join('::'),
          description: undefined
        };
      }
    };

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideDbxWebPageTitleService({ initialDelegate: customDelegate })]
      });
    });

    it('uses the custom delegate from the start (no rootConfig + empty chain → EMPTY)', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('EMPTY');
    });

    it('joins the chain via the custom delegate when a reference is registered', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      service.register(makeReference([{ title: 'A' }, { title: 'B' }], true));

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('A::B');
    });

    it('passes rootConfig through to the delegate independently of the directive chain', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      service.setRootConfig({ title: 'Root' });
      service.register(makeReference([{ title: 'Leaf' }], true));

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('Root::Leaf');
    });

    it('switches to a new delegate after setDelegate', async () => {
      const service = TestBed.inject(DbxWebPageTitleService);
      service.register(makeReference([{ title: 'X' }, { title: 'Y' }], true));

      service.setDelegate(dbxWebDefaultPageTitleDelegate({ separator: ' / ', leafFirst: false }));

      const details = await firstValueFrom(service.titleDetails$);
      expect(details.title).toBe('X / Y');
    });
  });
});

describe('dbxWebDefaultPageTitleDelegate', () => {
  it('uses an empty default title when no config is supplied and chain + rootConfig produce no segments', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    expect(delegate.buildPageTitleDetails({ chain: [] }).title).toBe('');
  });

  it('returns the configured defaultTitle when neither chain nor rootConfig produces segments', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ defaultTitle: 'Fallback' });
    expect(delegate.buildPageTitleDetails({ chain: [] }).title).toBe('Fallback');
    expect(delegate.buildPageTitleDetails({ chain: [{ title: undefined }, { description: 'x' }] }).title).toBe('Fallback');
  });

  it('joins segments leaf-first by default with the default separator', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'App' }, { title: 'Section' }, { title: 'Page' }] });
    expect(result.title).toBe('Page | Section | App');
  });

  it('joins segments root-first when leafFirst is false', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ leafFirst: false });
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'App' }, { title: 'Section' }, { title: 'Page' }] });
    expect(result.title).toBe('App | Section | Page');
  });

  it('uses a custom separator', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ separator: ' · ', leafFirst: false });
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'A' }, { title: 'B' }] });
    expect(result.title).toBe('A · B');
  });

  it('skips null, undefined, and whitespace-only title segments', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ leafFirst: false });
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'Keep' }, { title: '   ' }, { title: undefined }, { title: null }, { title: 'AlsoKeep' }] });
    expect(result.title).toBe('Keep | AlsoKeep');
  });

  it('appends appNameSuffix using the same separator', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ appNameSuffix: 'MyApp' });
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'Page' }] });
    expect(result.title).toBe('Page | MyApp');
  });

  it('places rootConfig at the root of the joined title (leaf-first → rootConfig appears last)', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'Section' }, { title: 'Page' }], rootConfig: { title: 'MyApp' } });
    expect(result.title).toBe('Page | Section | MyApp');
  });

  it('places rootConfig first when leafFirst is false', () => {
    const delegate = dbxWebDefaultPageTitleDelegate({ leafFirst: false });
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'Section' }, { title: 'Page' }], rootConfig: { title: 'MyApp' } });
    expect(result.title).toBe('MyApp | Section | Page');
  });

  it('uses rootConfig title as the title when the directive chain is empty', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [], rootConfig: { title: 'MyApp' } });
    expect(result.title).toBe('MyApp');
  });

  it('returns the leaf-most non-empty description across rootConfig and chain', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [{ description: undefined }, { description: 'leaf' }, { description: '' }], rootConfig: { description: 'root' } });
    expect(result.description).toBe('leaf');
  });

  it('falls back to rootConfig description when no chain segment supplies one', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'Page' }], rootConfig: { description: 'app desc' } });
    expect(result.description).toBe('app desc');
  });

  it('returns undefined description when no segment supplies one', () => {
    const delegate = dbxWebDefaultPageTitleDelegate();
    const result = delegate.buildPageTitleDetails({ chain: [{ title: 'A' }, { title: 'B' }] });
    expect(result.description).toBeUndefined();
  });
});
