import { Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type DbxFileListEntry, type DbxFileListItemDetailsDateStyle } from './download.file.list';
import { DbxFileListComponent } from './download.file.list.component';
import { DbxFileListItemComponent } from './download.file.list.item.component';

describe('DbxFileListItemComponent', () => {
  let testComponent: TestDbxFileListItemComponent;
  let fixture: ComponentFixture<TestDbxFileListItemComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxFileListItemComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render the name and the details line', () => {
    const name: HTMLElement = fixture.debugElement.query(By.css('.item-left .mat-subtitle-2')).nativeElement;
    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;

    expect(name.textContent).toContain('report.pdf');
    expect(details.textContent).toContain('Uploaded');
  });

  it('should apply the default details class', () => {
    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.classList).toContain('dbx-hint');
  });

  it('should apply a custom details class', () => {
    testComponent.detailsClassSignal.set('dbx-warn');
    fixture.detectChanges();

    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.classList).toContain('dbx-warn');
    expect(details.classList).not.toContain('dbx-hint');
  });

  it('should project trailing controls into the item right slot', () => {
    const control = fixture.debugElement.query(By.css('.item-right .test-control'));
    expect(control).not.toBeNull();
  });

  it('should not render a leading icon unless one is configured', () => {
    expect(fixture.debugElement.query(By.css('.item-icon'))).toBeNull();

    testComponent.iconSignal.set('description');
    fixture.detectChanges();

    const icon: HTMLElement = fixture.debugElement.query(By.css('.item-icon')).nativeElement;
    expect(icon.textContent).toContain('description');
  });

  it('should render the date relative to now when the distance style is used', () => {
    testComponent.detailsSignal.set(undefined);
    testComponent.detailsDateSignal.set(new Date(Date.now() - 3 * 60 * 60 * 1000));
    testComponent.detailsDateStyleSignal.set('distance');
    fixture.detectChanges();

    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.textContent).toContain('ago');
  });

  it('should render a distance-past date relative to now', () => {
    testComponent.detailsSignal.set(undefined);
    testComponent.detailsDateSignal.set(new Date(Date.now() - 3 * 60 * 60 * 1000));
    testComponent.detailsDateStyleSignal.set('distance-past');
    fixture.detectChanges();

    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.textContent).toContain('ago');
  });

  /**
   * An upload time stored as whole Unix seconds rounds UP, so it sits ahead of the clock that reads it.
   */
  it('should not render a distance-past date as the future', () => {
    testComponent.detailsSignal.set(undefined);
    testComponent.detailsDateSignal.set(new Date(Date.now() + 1000));
    testComponent.detailsDateStyleSignal.set('distance-past');
    fixture.detectChanges();

    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.textContent).toContain('ago');
    expect(details.textContent).not.toContain('in less than');
  });

  it('should still render a plain distance date as the future', () => {
    testComponent.detailsSignal.set(undefined);
    testComponent.detailsDateSignal.set(new Date(Date.now() + 3 * 60 * 60 * 1000));
    testComponent.detailsDateStyleSignal.set('distance');
    fixture.detectChanges();

    const details: HTMLElement = fixture.debugElement.query(By.css('.item-details')).nativeElement;
    expect(details.textContent).toContain('in ');
  });

  it('should omit the details line entirely when there is nothing to show', () => {
    testComponent.detailsSignal.set(undefined);
    testComponent.detailsDateSignal.set(undefined);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.item-details'))).toBeNull();
  });
});

describe('DbxFileListComponent', () => {
  let testComponent: TestDbxFileListComponent;
  let fixture: ComponentFixture<TestDbxFileListComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxFileListComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render one row per entry', () => {
    expect(fixture.debugElement.queryAll(By.css('dbx-file-list-item')).length).toBe(2);
  });

  it('should only give a download button to the entries that configure one', () => {
    expect(fixture.debugElement.queryAll(By.css('dbx-download-blob-button')).length).toBe(1);
  });

  it('should show the empty text in place of an empty list', () => {
    testComponent.entriesSignal.set([]);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('dbx-file-list-item')).length).toBe(0);

    const empty: HTMLElement = fixture.debugElement.query(By.css('dbx-list-empty-content')).nativeElement;
    expect(empty.textContent).toContain('No files yet.');
  });

  it('should show nothing at all when an empty list has no empty text', () => {
    testComponent.entriesSignal.set([]);
    testComponent.emptyTextSignal.set(undefined);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('dbx-list-empty-content'))).toBeNull();
  });
});

@Component({
  template: `
    <dbx-file-list-item [name]="nameSignal()" [icon]="iconSignal()" [details]="detailsSignal()" [detailsDate]="detailsDateSignal()" [detailsDateStyle]="detailsDateStyleSignal()" [detailsClass]="detailsClassSignal()">
      <span class="test-control">control</span>
    </dbx-file-list-item>
  `,
  imports: [DbxFileListItemComponent]
})
class TestDbxFileListItemComponent {
  readonly item = viewChild.required(DbxFileListItemComponent);

  readonly nameSignal = signal<Maybe<string>>('report.pdf');
  readonly iconSignal = signal<Maybe<string>>(undefined);
  readonly detailsSignal = signal<Maybe<string>>('Uploaded');
  readonly detailsDateSignal = signal<Maybe<Date>>(undefined);
  readonly detailsDateStyleSignal = signal<Maybe<DbxFileListItemDetailsDateStyle>>(undefined);
  readonly detailsClassSignal = signal<Maybe<string>>(undefined);
}

@Component({
  template: `
    <dbx-file-list [entries]="entriesSignal()" [emptyText]="emptyTextSignal()"></dbx-file-list>
  `,
  imports: [DbxFileListComponent]
})
class TestDbxFileListComponent {
  readonly list = viewChild.required(DbxFileListComponent);

  readonly entriesSignal = signal<DbxFileListEntry[]>([
    {
      key: 'a',
      name: 'a.csv',
      details: 'Uploaded',
      download: {
        fileName: 'a.csv'
      }
    },
    {
      key: 'b',
      name: 'b.csv'
    }
  ]);

  readonly emptyTextSignal = signal<Maybe<string>>('No files yet.');
}
