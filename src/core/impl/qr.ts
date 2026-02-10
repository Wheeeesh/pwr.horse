import type { Converter } from '../types';
import QRCode from 'qrcode';

export const qrConverters: Converter[] = [
  {
    id: 'qr_generate',
    title: 'QR Generator',
    category: 'QR',
    description: 'Generate QR codes for text, URLs, Wi‑Fi, or vCard.',
    options: [
      { id: 'payload', label: 'Content', type: 'textarea', placeholder: 'https://pwr.horse' },
      {
        id: 'size',
        label: 'Size (px)',
        type: 'number',
        min: 128,
        max: 1024,
        step: 32,
        default: 320
      },
      {
        id: 'margin',
        label: 'Margin',
        type: 'number',
        min: 0,
        max: 10,
        step: 1,
        default: 2
      },
      {
        id: 'error',
        label: 'Error correction',
        type: 'select',
        default: 'M',
        choices: [
          { label: 'L', value: 'L' },
          { label: 'M', value: 'M' },
          { label: 'Q', value: 'Q' },
          { label: 'H', value: 'H' }
        ]
      },
      { id: 'colorDark', label: 'Foreground', type: 'color', default: '#000000' },
      { id: 'colorLight', label: 'Background', type: 'color', default: '#ffffff' }
    ],
    async run(_files, options, ctx) {
      const payload = String(options.payload || '').trim() || 'https://pwr.horse';
      const size = Number(options.size || 320);
      const margin = Number(options.margin || 2);
      const error = String(options.error || 'M');
      const colorDark = String(options.colorDark || '#000000');
      const colorLight = String(options.colorLight || '#ffffff');

      const dataUrl = await QRCode.toDataURL(payload, {
        width: size,
        margin,
        errorCorrectionLevel: error as any,
        color: { dark: colorDark, light: colorLight }
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      ctx.onProgress(1);
      return [{ name: 'qr.png', blob, mime: 'image/png' }];
    }
  }
];
