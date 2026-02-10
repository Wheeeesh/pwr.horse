import type { Converter } from '../types';
import { canvasToBlob, readAsArrayBuffer, clamp } from '../utils';

const loadImageBitmap = async (file: File) => {
  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    const svgBlob = new Blob([text], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 800;
    canvas.height = img.height || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    return { canvas, width: canvas.width, height: canvas.height };
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0);
  return { canvas, width: bitmap.width, height: bitmap.height };
};

export const imageConverters: Converter[] = [
  {
    id: 'image_convert',
    title: 'Image Convert',
    category: 'Images',
    description: 'Convert between JPG, PNG, WebP, AVIF, SVG → raster.',
    accept: 'image/*',
    multiple: true,
    options: [
      {
        id: 'format',
        label: 'Target format',
        type: 'select',
        default: 'png',
        choices: [
          { label: 'PNG', value: 'png' },
          { label: 'JPG', value: 'jpg' },
          { label: 'WebP', value: 'webp' },
          { label: 'AVIF', value: 'avif' }
        ]
      },
      { id: 'quality', label: 'Quality', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.9 }
    ],
    async run(files, options, ctx) {
      const format = String(options.format || 'png');
      const quality = Number(options.quality || 0.9);
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < files.length; i += 1) {
        const { canvas } = await loadImageBitmap(files[i]);
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        const blob = await canvasToBlob(canvas, mime, quality);
        results.push({ name: `image-${i + 1}.${format}`, blob, mime: blob.type });
        ctx.onProgress((i + 1) / files.length);
      }
      return results;
    }
  },
  {
    id: 'heic_convert',
    title: 'HEIC → JPG/PNG',
    category: 'Images',
    description: 'Convert HEIC photos to JPG or PNG.',
    accept: '.heic,.heif',
    options: [
      {
        id: 'format',
        label: 'Target format',
        type: 'select',
        default: 'jpg',
        choices: [
          { label: 'JPG', value: 'jpg' },
          { label: 'PNG', value: 'png' }
        ]
      }
    ],
    async run(files, options, ctx) {
      const { default: heic2any } = await import('heic2any');
      const format = String(options.format || 'jpg');
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < files.length; i += 1) {
        const output = (await heic2any({ blob: files[i], toType: `image/${format}` })) as Blob;
        results.push({ name: `image-${i + 1}.${format}`, blob: output, mime: output.type });
        ctx.onProgress((i + 1) / files.length);
      }
      return results;
    }
  },
  {
    id: 'image_resize',
    title: 'Resize Image',
    category: 'Images',
    description: 'Resize images by width/height.',
    accept: 'image/*',
    multiple: true,
    options: [
      { id: 'width', label: 'Width (px)', type: 'number', min: 1, max: 10000, step: 1, default: 1024 },
      { id: 'height', label: 'Height (px)', type: 'number', min: 1, max: 10000, step: 1, default: 768 }
    ],
    async run(files, options, ctx) {
      const width = Number(options.width || 1024);
      const height = Number(options.height || 768);
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < files.length; i += 1) {
        const { canvas } = await loadImageBitmap(files[i]);
        const target = document.createElement('canvas');
        target.width = width;
        target.height = height;
        const ctx2 = target.getContext('2d');
        if (!ctx2) throw new Error('Canvas not supported');
        ctx2.drawImage(canvas, 0, 0, width, height);
        const blob = await canvasToBlob(target, files[i].type || 'image/png', 0.9);
        results.push({ name: `resized-${i + 1}.png`, blob, mime: blob.type });
        ctx.onProgress((i + 1) / files.length);
      }
      return results;
    }
  },
  {
    id: 'image_compress',
    title: 'Compress Image',
    category: 'Images',
    description: 'Reduce image file size with quality control.',
    accept: 'image/*',
    multiple: true,
    options: [
      { id: 'quality', label: 'Quality', type: 'range', min: 0.3, max: 0.95, step: 0.05, default: 0.8 },
      { id: 'format', label: 'Format', type: 'select', default: 'jpg', choices: [
        { label: 'JPG', value: 'jpg' },
        { label: 'WebP', value: 'webp' }
      ] }
    ],
    async run(files, options, ctx) {
      const quality = Number(options.quality || 0.8);
      const format = String(options.format || 'jpg');
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < files.length; i += 1) {
        const { canvas } = await loadImageBitmap(files[i]);
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        const blob = await canvasToBlob(canvas, mime, clamp(quality, 0.1, 1));
        results.push({ name: `compressed-${i + 1}.${format}`, blob, mime: blob.type });
        ctx.onProgress((i + 1) / files.length);
      }
      return results;
    }
  },
  {
    id: 'raw_convert',
    title: 'RAW → JPG/PNG',
    category: 'Images',
    description: 'Best-effort RAW conversion using browser decoders.',
    accept: '.cr2,.nef,.arw,.dng,.rw2,.orf',
    options: [
      {
        id: 'format',
        label: 'Target format',
        type: 'select',
        default: 'jpg',
        choices: [
          { label: 'JPG', value: 'jpg' },
          { label: 'PNG', value: 'png' }
        ]
      }
    ],
    async run(files, options, ctx) {
      const format = String(options.format || 'jpg');
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < files.length; i += 1) {
        const bitmap = await createImageBitmap(files[i]);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx2 = canvas.getContext('2d');
        if (!ctx2) throw new Error('Canvas not supported');
        ctx2.drawImage(bitmap, 0, 0);
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await canvasToBlob(canvas, mime, 0.9);
        results.push({ name: `raw-${i + 1}.${format}`, blob, mime: blob.type });
        ctx.onProgress((i + 1) / files.length);
      }
      return results;
    }
  }
];
