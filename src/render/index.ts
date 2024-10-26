import templateHtml from './template.html';

export function renderError(message: string, status: number): Response {
  const body = `<h1 class="error">An error occurred</h1><p>${message}</p>`;
  return renderHtml(body, status);
}

export function renderHtml(body: string, status?: number): Response {
  const html = templateHtml.replace('${body}', body);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
    status,
  });
}
