const A4 = { width: 210, height: 297 };
const pixelsPerMillimetre = 96 / 25.4;
const width = Math.ceil(A4.width * pixelsPerMillimetre);
const height = Math.ceil(A4.height * pixelsPerMillimetre);

async function drawPage(sheet: HTMLElement, css: string) {
  const document = sheet.ownerDocument;
  const wrapper = document.createElement('div');
  wrapper.className = 'report-page-root';
  const style = document.createElement('style');
  style.textContent = css.replace(/:root\b/g, '.report-page-root');
  wrapper.append(style, sheet.cloneNode(true));
  const markup = new XMLSerializer().serializeToString(wrapper);
  // Use the browser's own CSS renderer, including the polygons in the template.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height
    + '" viewBox="0 0 ' + (A4.width * pixelsPerMillimetre) + ' ' + (A4.height * pixelsPerMillimetre) + '">'
    + '<foreignObject width="100%" height="100%">' + markup + '</foreignObject></svg>';
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar el PDF.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL('image/jpeg', 0.95);
  canvas.width = canvas.height = 0;
  return result;
}

export async function createReportPdf(html: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: width + 'px', height: height + 'px' });

  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('No se pudo cargar la plantilla del reporte.'));
      frame.srcdoc = html;
      document.body.append(frame);
    });
    const frameDoc = frame.contentDocument;
    const sheet = frameDoc?.querySelector<HTMLElement>('.hoja');
    const results = sheet?.querySelector<HTMLElement>('.seccion:has(.tabla-resultados)');
    const table = results?.querySelector('tbody');
    const content = sheet?.querySelector('.contenido');
    if (!frameDoc || !sheet || !results || !table || !content) throw new Error('La plantilla del reporte no está disponible.');

    const pageStyle = frameDoc.createElement('style');
    pageStyle.textContent = '.hoja { margin: 0; box-shadow: none; }';
    frameDoc.head.append(pageStyle);
    await frameDoc.fonts.ready;
    await Promise.all(Array.from(sheet.querySelectorAll('img'), image => image.decode()));
    const css = Array.from(frameDoc.querySelectorAll('head style'), style => style.textContent).join('\n');
    const rows = Array.from(table.rows);
    const annexes = Array.from(content.querySelectorAll('.fotos, .firmas'));
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let page = 0;
    const fits = () => sheet.getBoundingClientRect().height <= A4.height * pixelsPerMillimetre + 0.5;
    async function addPage() {
      if (!fits()) throw new Error('El contenido supera el espacio disponible en una página A4.');
      const image = await drawPage(sheet!, css);
      if (page++) pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, 0, A4.width, A4.height, undefined, 'FAST');
    }

    if (fits()) {
      await addPage();
    } else {
      annexes.forEach(node => node.remove());
      table.replaceChildren();
      for (const row of rows) {
        table.append(row);
        if (!fits()) {
          row.remove();
          if (!table.rows.length) throw new Error('Una corrida supera el espacio disponible en A4.');
          await addPage();
          table.replaceChildren(row);
        }
      }
      content.append(...annexes);
      if (!fits()) {
        annexes.forEach(node => node.remove());
        if (table.rows.length) await addPage();
        results.remove();
        content.append(...annexes);
      }
      await addPage();
    }
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

export async function downloadReport(html: string, reportId: number, code: string, assayAbbreviation: string) {
  const blob = await createReportPdf(html);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeCode = code.replace(/[^\p{L}\p{N}_-]/gu, '_');
  link.href = url;
  link.download = 'Informe_' + reportId + '_' + safeCode + '_' + assayAbbreviation + '.pdf';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
