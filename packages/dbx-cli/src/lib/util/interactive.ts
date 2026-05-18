import { createInterface } from 'node:readline';
import { CliError } from './output';

export interface PromptInput {
  readonly question: string;
  readonly mask?: boolean;
}

/**
 * Error code thrown by {@link promptLine} when the user cancels a masked prompt with Ctrl-C.
 *
 * Callers that want to catch and handle cancellation should match on this code; otherwise the
 * standard wrapCommandHandler / outputError envelope reports `code: 'PROMPT_CANCELLED'`.
 */
export const PROMPT_CANCELLED_ERROR_CODE = 'PROMPT_CANCELLED';

const KEY_ETX = ''; // Ctrl-C
const KEY_EOT = ''; // Ctrl-D
const KEY_BS = ''; // Backspace
const KEY_DEL = ''; // DEL

/**
 * Reads a single line of input from stdin, optionally masking the typed characters.
 *
 * Used by `auth setup` to prompt for client secrets and by `auth login` to prompt for the
 * pasted redirect URL.
 *
 * Rejects with a {@link CliError} (`code: 'PROMPT_CANCELLED'`) when the user presses Ctrl-C
 * during a masked prompt, instead of forcibly terminating the process.
 *
 * @param input - The prompt inputs.
 * @param input.question - The prompt text written to stdout (or stderr when masking).
 * @param input.mask - When `true`, characters are echoed as `*` and Ctrl-C cancels the prompt.
 * @returns The line entered by the user (without the trailing newline).
 */
export function promptLine(input: PromptInput): Promise<string> {
  let result: Promise<string>;

  if (input.mask) {
    result = new Promise<string>((resolve, reject) => {
      const stdout = process.stdout;
      stdout.write(input.question);

      let buffer = '';
      const onData = (chunk: Buffer): void => {
        const value = chunk.toString('utf8');
        let done = false;

        for (const char of value) {
          if (done) break;

          if (char === '\n' || char === '\r' || char === KEY_EOT) {
            stdout.write('\n');
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            resolve(buffer);
            done = true;
          } else if (char === KEY_ETX) {
            stdout.write('\n');
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            reject(new CliError({ message: 'Prompt cancelled.', code: PROMPT_CANCELLED_ERROR_CODE }));
            done = true;
          } else if (char === KEY_BS || char === KEY_DEL) {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              stdout.write('\b \b');
            }
          } else {
            buffer += char;
            stdout.write('*');
          }
        }
      };

      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    });
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

    result = new Promise<string>((resolve) => {
      rl.question(input.question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  return result;
}
