import { marked, type MarkedExtension } from 'marked';
import { markedTerminal } from 'marked-terminal';

// NOTE: marked-terminal types don't align with marked v17 types, but runtime works
// eslint-disable-next-line @typescript-eslint/no-explicit-any
marked.use(
  markedTerminal({
    reflowText: true,
    width: process.stdout.columns ?? 80,
    showSectionPrefix: false,
    unescape: true,
    emoji: true,
  }) as MarkedExtension
);

export function renderMarkdown(content: string): string {
  const rendered = marked.parse(content);
  if (typeof rendered !== 'string') {
    return content;
  }
  return rendered.trim();
}
