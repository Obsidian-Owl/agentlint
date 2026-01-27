/* eslint-disable no-control-regex -- Intentional: detecting control chars for security sanitization */
const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[A-Za-z]/g;
const OSC_SEQUENCE_REGEX = /\x1b\][^\x07]*\x07/g;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
/* eslint-enable no-control-regex */

export function sanitizeForTerminal(text: string): string {
  return text
    .replace(ANSI_ESCAPE_REGEX, '')
    .replace(OSC_SEQUENCE_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '');
}

export function containsTerminalSequences(text: string): boolean {
  return (
    ANSI_ESCAPE_REGEX.test(text) || OSC_SEQUENCE_REGEX.test(text) || CONTROL_CHARS_REGEX.test(text)
  );
}

export const MAX_INPUT_LENGTH = 10_000;
export const MAX_DISPLAY_LENGTH = 5_000;

export function truncateForDisplay(text: string, maxLength: number = MAX_DISPLAY_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
