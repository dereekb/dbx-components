import { describe, expect, it } from 'vitest';
import { AI_AGENT_DETECTION_ENV_KEYS, shellEnvWithoutAiAgentDetection } from './shell.js';

describe('shellEnvWithoutAiAgentDetection', () => {
  it('drops every AI-agent detection variable', () => {
    const env = Object.fromEntries(AI_AGENT_DETECTION_ENV_KEYS.map((key) => [key, '1']));
    expect(Object.keys(shellEnvWithoutAiAgentDetection(env))).toEqual([]);
  });

  it('keeps everything else, PAGER included', () => {
    const result = shellEnvWithoutAiAgentDetection({ CLAUDECODE: '1', PATH: '/usr/bin', PAGER: 'head -n 10000 | cat' });
    expect(result).toEqual({ PATH: '/usr/bin', PAGER: 'head -n 10000 | cat' });
  });

  it('does not mutate the source environment', () => {
    const env = { CLAUDECODE: '1' };
    shellEnvWithoutAiAgentDetection(env);
    expect(env).toEqual({ CLAUDECODE: '1' });
  });
});
