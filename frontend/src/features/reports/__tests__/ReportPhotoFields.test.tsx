import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportPhotoFields from '../ReportPhotoFields';

describe('Opening the native photograph chooser inside the report form', () => {
  it('uses explicit non-submit buttons and non-focusable, truly hidden file inputs', () => {
    const html = renderToStaticMarkup(<form><ReportPhotoFields photos={{}} disabled={false}
      onChange={vi.fn()} onProcessing={vi.fn()} /></form>);
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toContain('type="button"');
    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input).toContain('type="file"');
      expect(input).toContain('hidden=""');
      expect(input).toContain('display:none');
      expect(input).toContain('tabindex="-1"');
      expect(input).not.toContain('sr-only');
    }
    expect(html).not.toContain('<label');
    expect(html).toContain('Seleccionar fotografía antes');
    expect(html).toContain('Seleccionar fotografía despues');
  });

  it('disables both chooser triggers during save/upload', () => {
    const html = renderToStaticMarkup(<ReportPhotoFields photos={{}} disabled
      onChange={vi.fn()} onProcessing={vi.fn()} />);
    for (const tag of html.match(/<(?:button|input)\b[^>]*>/g) ?? []) {
      expect(tag).toContain('disabled=""');
    }
  });
});
