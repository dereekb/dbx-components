import { describe, expect, it } from 'vitest';
import { runLookupPipe } from './lookup-pipe.tool.js';

describe('dbx_pipe_lookup', () => {
  it('returns isError when topic is missing', () => {
    const result = runLookupPipe({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns the catalog for topic="list"', () => {
    const result = runLookupPipe({ topic: 'list' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# Pipe catalog');
    expect(result.content[0].text).toContain('dollar-amount');
    expect(result.content[0].text).toContain('date-distance');
  });

  it('groups the catalog by category', () => {
    const result = runLookupPipe({ topic: 'catalog' });
    expect(result.content[0].text).toContain('## value');
    expect(result.content[0].text).toContain('## date');
    expect(result.content[0].text).toContain('## async');
  });

  it('matches by slug', () => {
    const result = runLookupPipe({ topic: 'dollar-amount' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DollarAmountPipe');
    expect(result.content[0].text).toContain('`dollarAmount`');
    expect(result.content[0].text).toContain('Maybe<number>');
  });

  it('matches by Angular pipe name', () => {
    const result = runLookupPipe({ topic: 'getValue' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# GetValuePipe');
    expect(result.content[0].text).toContain('`impure`');
  });

  it('matches by class name', () => {
    const result = runLookupPipe({ topic: 'DateTimeRangePipe' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DateTimeRangePipe');
    expect(result.content[0].text).toContain('`dateTimeRange`');
  });

  it('renders args table when args are present', () => {
    const result = runLookupPipe({ topic: 'cut-text' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('## Args');
    expect(result.content[0].text).toContain('`maxLength`');
    expect(result.content[0].text).toContain('| yes |');
  });

  it('omits args section when args are empty', () => {
    const result = runLookupPipe({ topic: 'as-observable' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).not.toContain('## Args');
    expect(result.content[0].text).toContain('## Example');
  });

  it('respects depth=brief', () => {
    const result = runLookupPipe({ topic: 'dollar-amount', depth: 'brief' });
    expect(result.content[0].text).not.toContain('## Example');
    expect(result.content[0].text).toContain('depth="full"');
  });

  it('returns fuzzy candidates on miss', () => {
    const result = runLookupPipe({ topic: 'doll' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No pipe entry matched');
    expect(result.content[0].text).toContain('dollar-amount');
  });

  it('returns a not-found pointer to the catalog when no candidates score', () => {
    const result = runLookupPipe({ topic: 'totallyUnrelatedTopicXYZ' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Try `dbx_pipe_lookup topic="list"`');
  });

  it('renders example as an HTML code fence', () => {
    const result = runLookupPipe({ topic: 'date-time-range' });
    expect(result.content[0].text).toContain('```html');
  });
});
