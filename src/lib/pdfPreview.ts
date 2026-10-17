export function openPdfPreviewWindow(): Window | null {
  return window.open('', '_blank')
}

export function showPdfPreview(
  previewWindow: Window,
  blob: Blob,
  title: string,
): void {
  if (previewWindow.closed) return

  const pdfUrl = URL.createObjectURL(blob)
  const viewerTitle = title.replace(/[&<>"]/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    })[character] ?? character,
  )
  const viewerHtml = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${viewerTitle}</title>
        <style>
          html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
          body { overflow: hidden; }
        </style>
      </head>
      <body>
        <iframe title="${viewerTitle} PDF preview" src="${pdfUrl}"></iframe>
        <script>
          window.addEventListener('pagehide', () => {
            URL.revokeObjectURL(${JSON.stringify(pdfUrl)})
            URL.revokeObjectURL(location.href)
          }, { once: true })
        </script>
      </body>
    </html>`
  let viewerUrl: string | null = null

  try {
    viewerUrl = URL.createObjectURL(
      new Blob([viewerHtml], { type: 'text/html' }),
    )
    previewWindow.location.replace(viewerUrl)
  } catch (error) {
    URL.revokeObjectURL(pdfUrl)
    if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    throw error
  }
}
