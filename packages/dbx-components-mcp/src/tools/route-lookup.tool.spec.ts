import { describe, expect, it } from 'vitest';
import { runRouteLookup } from './route-lookup.tool.js';

const SAMPLE_TEXT = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'app', url: '/' },
  { name: 'app.home', url: '/home', component: HomePageComponent },
  { name: 'app.home.profile', url: '/profile', component: ProfilePageComponent },
  { name: 'app.home.edit', url: '/edit', component: ProfilePageComponent }
];
`;

describe('dbx_route_lookup', () => {
  it('returns isError when topic is missing', async () => {
    const result = await runRouteLookup({ sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns isError when no source input is given', async () => {
    const result = await runRouteLookup({ topic: 'app' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('at least one of');
  });

  it('matches an exact state name', async () => {
    const result = await runRouteLookup({ topic: 'app.home.profile', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# app.home.profile');
    expect(result.content[0].text).toContain('Matched via state name');
    expect(result.content[0].text).toContain('## Parent chain');
  });

  it('matches by full URL', async () => {
    const result = await runRouteLookup({ topic: '/home/profile', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# app.home.profile');
    expect(result.content[0].text).toContain('Matched via URL');
  });

  it('groups by component when multiple states share a class', async () => {
    const result = await runRouteLookup({ topic: 'ProfilePageComponent', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('States rendering');
    expect(result.content[0].text).toContain('app.home.profile');
    expect(result.content[0].text).toContain('app.home.edit');
  });

  it('returns fuzzy candidates on miss', async () => {
    const result = await runRouteLookup({ topic: 'profil', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Did you mean');
    expect(result.content[0].text).toContain('app.home.profile');
  });

  it('respects depth=brief by skipping the chain section', async () => {
    const result = await runRouteLookup({ topic: 'app.home', depth: 'brief', sources: [{ name: 'a.ts', text: SAMPLE_TEXT }] });
    expect(result.content[0].text).not.toContain('## Parent chain');
  });
});
