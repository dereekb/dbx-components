import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, viewChild, viewChildren } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DbxHeightSyncDirective, DbxHeightSyncFollowerDirective, DbxHeightSyncSourceDirective } from './height.sync.directive';

@Component({
  template: `
    <div dbxHeightSync>
      <div dbxHeightSyncSource></div>
      <div class="follower" dbxHeightSyncFollower></div>
    </div>
    <div class="lone-follower" dbxHeightSyncFollower></div>
    <div class="lone-source" dbxHeightSyncSource></div>
    <div class="content-source" dbxHeightSyncSource="content-box"></div>
  `,
  imports: [DbxHeightSyncDirective, DbxHeightSyncSourceDirective, DbxHeightSyncFollowerDirective]
})
class TestHeightSyncHostComponent {
  readonly group = viewChild.required(DbxHeightSyncDirective);
  readonly sources = viewChildren(DbxHeightSyncSourceDirective);
}

describe('DbxHeightSyncDirective', () => {
  let fixture: ComponentFixture<TestHeightSyncHostComponent>;

  function follower(selector = '.follower'): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;
  }

  function group(): DbxHeightSyncDirective {
    return fixture.componentInstance.group();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHeightSyncHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHeightSyncHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should not set a height before a source is measured', () => {
    expect(follower().style.height).toBe('');
  });

  it('should give followers the source height', () => {
    const source = group().registerSource();
    source.setHeight(48);
    fixture.detectChanges();

    expect(group().heightSignal()).toBe(48);
    expect(follower().style.height).toBe('48px');
    expect(follower().style.boxSizing).toBe('border-box');
  });

  it('should give followers the tallest source height, and drop a destroyed source', () => {
    const a = group().registerSource();
    const b = group().registerSource();
    a.setHeight(40);
    b.setHeight(120);
    fixture.detectChanges();
    expect(follower().style.height).toBe('120px');

    b.destroy();
    fixture.detectChanges();
    expect(follower().style.height).toBe('40px');

    a.destroy();
    fixture.detectChanges();
    expect(group().heightSignal()).toBeUndefined();
    expect(follower().style.height).toBe('');
  });

  it('should drop the followers height while disabled, and restore it when enabled again', () => {
    group().registerSource().setHeight(48);
    fixture.detectChanges();
    expect(follower().style.height).toBe('48px');

    group().dbxHeightSyncDisabled.set(true);
    fixture.detectChanges();
    expect(group().heightSignal()).toBeUndefined();
    expect(follower().style.height).toBe('');
    expect(follower().style.boxSizing).toBe('');

    group().dbxHeightSyncDisabled.set(false);
    fixture.detectChanges();
    expect(follower().style.height).toBe('48px');
  });

  it('should measure the border box unless the source asks for the content box', () => {
    const boxes = fixture.componentInstance.sources().map((x) => x.boxSignal());
    expect(boxes).toEqual(['border-box', 'border-box', 'content-box']);
  });

  it('should leave followers and sources outside a group alone', () => {
    group().registerSource().setHeight(48);
    fixture.detectChanges();

    expect(follower('.lone-follower').style.height).toBe('');
  });
});
