// Minimal headings/lists/paragraphs renderer — just enough for data/rules.md.
export function renderSimpleMarkdown(markdown: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${escape(heading[2].trim())}</h${level}>`;
    } else if (listItem) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${escape(listItem[1].trim())}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${escape(line.trim())}</p>`;
    }
  }
  closeList();
  return html;
}
