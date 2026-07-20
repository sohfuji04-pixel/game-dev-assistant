/**
 * 最小 Markdown → HTML（XSS 対策のためエスケープ後に限定タグ化）
 */
export function renderSimpleMarkdown(src: string): string {
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withCode = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre class="md-code" data-lang="${lang}"><code>${code}</code></pre>`;
  });

  const withInline = withCode
    .replace(/`([^`]+)`/g, '<code class="md-inline">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  return withInline;
}
