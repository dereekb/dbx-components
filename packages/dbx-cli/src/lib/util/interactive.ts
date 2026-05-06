import { createInterface } from 'node:readline';

export interface PromptInput {
  readonly question: string;
  readonly mask?: boolean;
}

const KEY_ETX = ''; // Ctrl-C
const KEY_EOT = ''; // Ctrl-D
const KEY_BS = ''; // Backspace
const KEY_DEL = ''; // DEL

/**
 * Reads a single line of input from stdin, optionally masking the typed characters.
 *
 * Used by `auth setup` to prompt for client secrets and by `auth login` to prompt for the
 * pasted redirect URL.
 */
export function promptLine(input: PromptInput): Promise<string> {
  if (!input.mask) {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

    return new Promise<string>((resolve) => {
      rl.question(input.question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  return new Promise<string>((resolve) => {
    const stdout = process.stdout;
    stdout.write(input.question);

    let buffer = '';
    const onData = (chunk: Buffer): void => {
      const value = chunk.toString('utf8');

      for (const char of value) {
        if (char === '\n' || char === '\r' || char === KEY_EOT) {
          stdout.write('\n');
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          resolve(buffer);
          return;
        }

        if (char === KEY_ETX) {
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          process.exit(130);
        }

        if (char === KEY_BS || char === KEY_DEL) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }

        buffer += char;
        stdout.write('*');
      }
    };

    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
