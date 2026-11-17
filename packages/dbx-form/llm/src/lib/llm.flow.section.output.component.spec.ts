import { describe, it, expect } from 'vitest';
import { dbxLlmFlowSectionOutputDownloadTextContent } from './llm.flow.section.output.component';

describe('dbxLlmFlowSectionOutputDownloadTextContent()', () => {
  it('should return a string output as plain text named by the section and the run', () => {
    expect(dbxLlmFlowSectionOutputDownloadTextContent({ id: 'abc-3', sectionKey: 'draft', output: 'hello' })).toEqual({ content: 'hello', name: 'draft-output-abc-3.txt', mimeType: 'text/plain' });
  });

  it('should return any other output as pretty JSON', () => {
    expect(dbxLlmFlowSectionOutputDownloadTextContent({ id: 'abc-1', sectionKey: 'outline', output: { points: ['a'] } })).toEqual({ content: JSON.stringify({ points: ['a'] }, null, 2), name: 'outline-output-abc-1.json', mimeType: 'application/json' });
  });

  it('should replace characters that are not safe in a file name', () => {
    expect(dbxLlmFlowSectionOutputDownloadTextContent({ id: 'server/take 1', sectionKey: 'render', output: 'x' })?.name).toBe('render-output-server-take-1.txt');
  });

  it('should return undefined when there is no run or no output', () => {
    expect(dbxLlmFlowSectionOutputDownloadTextContent(undefined)).toBeUndefined();
    expect(dbxLlmFlowSectionOutputDownloadTextContent({ id: 'abc-1', sectionKey: 'draft', output: undefined })).toBeUndefined();
    expect(dbxLlmFlowSectionOutputDownloadTextContent({ id: 'abc-1', sectionKey: 'draft', output: null })).toBeUndefined();
  });
});
