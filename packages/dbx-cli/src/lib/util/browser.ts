import { spawn } from 'node:child_process';
import { type WebsiteUrl } from '@dereekb/util';

export interface OpenUrlInBrowserInput {
  /**
   * The URL to hand to the platform's default handler.
   */
  readonly url: WebsiteUrl;
}

/**
 * Opens a URL in the user's default browser.
 *
 * Shells out to the platform's URL handler (`open` on macOS, `start` on Windows, `xdg-open`
 * elsewhere) rather than taking a dependency for what is a single spawn. The child is detached with
 * its stdio ignored, so the browser neither holds the CLI's event loop open nor interleaves output
 * into the CLI's own stdout/stderr.
 *
 * Never throws or rejects: a headless machine with no handler registered is an ordinary outcome, and
 * the caller falls back to the printed URL.
 *
 * @param input - The open inputs.
 * @param input.url - The URL to open.
 * @returns `true` when the handler process was spawned, `false` when it could not be.
 */
export function openUrlInBrowser(input: OpenUrlInBrowserInput): Promise<boolean> {
  const { url } = input;
  let command: string;
  let args: string[];
  let windowsVerbatimArguments = false;

  switch (process.platform) {
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    case 'win32':
      // `start` is a cmd builtin whose first quoted argument is the window title, hence the empty
      // `""`. `windowsVerbatimArguments` suppresses Node's own quoting so the `^`-escaped `&`
      // separating the OAuth query params survives — unescaped, cmd reads it as a command separator
      // and truncates the authorization URL at the first parameter.
      command = 'cmd.exe';
      args = ['/s', '/c', 'start', '""', '/b', url.replaceAll('&', '^&')];
      windowsVerbatimArguments = true;
      break;
    default:
      command = 'xdg-open';
      args = [url];
      break;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments });

      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}
