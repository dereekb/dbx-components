import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type Subscription } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxWebPageTitleInfoDirective } from './title.directive';
import { DbxWebPageTitleService } from './title.service';
import { provideDbxWebPageTitleService } from './title.providers';
import { type DbxWebPageTitleDetails, type DbxWebPageTitleInfoConfig } from './title';

@Component({
  template: `
    @if (showRoot()) {
      <div [dbxWebPageTitleInfo]="rootConfig()">
        @if (showLeaf()) {
          <div [dbxWebPageTitleInfo]="leafConfig()"></div>
        }
        @if (showSecondLeaf()) {
          <div [dbxWebPageTitleInfo]="secondLeafConfig()"></div>
        }
      </div>
    }
  `,
  standalone: true,
  imports: [DbxWebPageTitleInfoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly showRoot = signal(true);
  readonly showLeaf = signal(false);
  readonly showSecondLeaf = signal(false);
  readonly rootConfig = signal<Maybe<DbxWebPageTitleInfoConfig>>({ title: 'MyApp' });
  readonly leafConfig = signal<Maybe<DbxWebPageTitleInfoConfig>>({ title: 'Inbox' });
  readonly secondLeafConfig = signal<Maybe<DbxWebPageTitleInfoConfig>>({ title: 'Settings' });
}

describe('DbxWebPageTitleInfoDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let service: DbxWebPageTitleService;
  let titleService: Title;
  let originalTitle: string;
  let lastDetails: DbxWebPageTitleDetails | undefined;
  let detailsSub: Subscription;

  beforeEach(async () => {
    originalTitle = document.title;

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection(), provideDbxWebPageTitleService({ rootConfig: { title: 'TestApp' } })]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(DbxWebPageTitleService);
    titleService = TestBed.inject(Title);

    lastDetails = undefined;
    detailsSub = service.titleDetails$.subscribe((v) => {
      lastDetails = v;
    });
  });

  afterEach(() => {
    detailsSub.unsubscribe();
    fixture.destroy();
    document.title = originalTitle;
  });

  it('contributes its config to the chain when mounted alone (rootConfig at the chain root)', async () => {
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('MyApp | TestApp');
    expect(titleService.getTitle()).toBe('MyApp | TestApp');
  });

  it('produces a leaf-first chain when nested directives are present', async () => {
    component.showLeaf.set(true);
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('Inbox | MyApp | TestApp');
    expect(titleService.getTitle()).toBe('Inbox | MyApp | TestApp');
  });

  it('updates the chain when the leaf input changes', async () => {
    component.showLeaf.set(true);
    await fixture.whenStable();

    component.leafConfig.set({ title: 'Drafts' });
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('Drafts | MyApp | TestApp');
  });

  it('reverts to the parent when the leaf is destroyed', async () => {
    component.showLeaf.set(true);
    await fixture.whenStable();
    expect(lastDetails?.title).toBe('Inbox | MyApp | TestApp');

    component.showLeaf.set(false);
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('MyApp | TestApp');
  });

  it('reverts to the rootConfig title when all directives are destroyed', async () => {
    component.showLeaf.set(true);
    await fixture.whenStable();

    component.showRoot.set(false);
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('TestApp');
  });

  it('selects the most recently mounted leaf among siblings as the active leaf', async () => {
    component.showLeaf.set(true);
    await fixture.whenStable();

    component.showSecondLeaf.set(true);
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('Settings | MyApp | TestApp');
  });

  it('omits a directive whose config is null/undefined from the chain', async () => {
    component.showLeaf.set(true);
    component.leafConfig.set(undefined);
    await fixture.whenStable();

    expect(lastDetails?.title).toBe('MyApp | TestApp');
  });

  it('passes a description from the leaf config through to titleDetails', async () => {
    component.showLeaf.set(true);
    component.leafConfig.set({ title: 'Inbox', description: 'Your messages' });
    await fixture.whenStable();

    expect(lastDetails?.description).toBe('Your messages');
  });
});
