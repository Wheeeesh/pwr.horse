import { PDFDocument, degrees } from 'pdf-lib';
import type { Converter } from '../types';
import { readAsArrayBuffer, readAsText, canvasToBlob, toBlob } from '../utils';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth';

const pdfWorkerBlob = new Blob([pdfWorker], { type: 'text/javascript' });
GlobalWorkerOptions.workerSrc = URL.createObjectURL(pdfWorkerBlob);

const htmlToPdf = async (html: string): Promise<Blob> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.innerHTML = html;
  document.body.appendChild(container);

  const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  document.body.removeChild(container);
  return blob;
};

const loadPdf = async (file: File) => {
  const data = new Uint8Array(await readAsArrayBuffer(file));
  const pdf = await getDocument({ data }).promise;
  return pdf;
};

const renderPdfPage = async (pdf: any, pageNumber: number, scale: number) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
};

const docxToHtml = async (file: File) => {
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
};

const ocrImageData = async (image: ImageData) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(image);
  await worker.terminate();
  return data.text || '';
};

export const documentConverters: Converter[] = [
  {
    id: 'pdf_merge',
    title: 'Merge PDFs',
    category: 'Documents',
    description: 'Combine multiple PDFs into one file.',
    accept: 'application/pdf',
    multiple: true,
    async run(files, _options, ctx) {
      ctx.onProgress(0.05);
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i += 1) {
        const bytes = await readAsArrayBuffer(files[i]);
        const pdf = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        ctx.onProgress((i + 1) / files.length);
      }
      const out = await merged.save();
      return [{ name: 'merged.pdf', blob: toBlob(out, 'application/pdf'), mime: 'application/pdf' }];
    }
  },
  {
    id: 'pdf_split',
    title: 'Split PDF',
    category: 'Documents',
    description: 'Split a PDF by page ranges (e.g., 1-3,5).',
    accept: 'application/pdf',
    options: [
      {
        id: 'ranges',
        label: 'Page ranges',
        type: 'text',
        placeholder: '1-3,5,7-9',
        default: '1'
      }
    ],
    async run(files, options, ctx) {
      const ranges = String(options.ranges || '1');
      const [file] = files;
      const bytes = await readAsArrayBuffer(file);
      const pdf = await PDFDocument.load(bytes);
      const totalPages = pdf.getPageCount();
      const selections: number[][] = [];
      ranges.split(',').forEach((chunk) => {
        const trimmed = chunk.trim();
        if (!trimmed) return;
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map((v) => parseInt(v.trim(), 10));
          const indices = [];
          for (let i = start; i <= (end || start); i += 1) {
            if (i >= 1 && i <= totalPages) indices.push(i - 1);
          }
          selections.push(indices);
        } else {
          const pageIndex = parseInt(trimmed, 10) - 1;
          if (pageIndex >= 0 && pageIndex < totalPages) selections.push([pageIndex]);
        }
      });

      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 0; i < selections.length; i += 1) {
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, selections[i]);
        pages.forEach((page) => newPdf.addPage(page));
        const out = await newPdf.save();
        results.push({
          name: `split-${i + 1}.pdf`,
          blob: toBlob(out, 'application/pdf'),
          mime: 'application/pdf'
        });
        ctx.onProgress((i + 1) / selections.length);
      }
      return results.length ? results : [];
    }
  },
  {
    id: 'pdf_rotate',
    title: 'Rotate PDF',
    category: 'Documents',
    description: 'Rotate pages by 90/180/270 degrees.',
    accept: 'application/pdf',
    options: [
      {
        id: 'angle',
        label: 'Angle',
        type: 'select',
        default: '90',
        choices: [
          { label: '90°', value: '90' },
          { label: '180°', value: '180' },
          { label: '270°', value: '270' }
        ]
      }
    ],
    async run(files, options, ctx) {
      const angle = parseInt(String(options.angle || '90'), 10);
      const [file] = files;
      const bytes = await readAsArrayBuffer(file);
      const pdf = await PDFDocument.load(bytes);
      pdf.getPages().forEach((page) => {
        page.setRotation(degrees(angle));
      });
      ctx.onProgress(0.9);
      const out = await pdf.save();
      return [{ name: 'rotated.pdf', blob: toBlob(out, 'application/pdf'), mime: 'application/pdf' }];
    }
  },
  {
    id: 'pdf_images',
    title: 'PDF → Images',
    category: 'Documents',
    description: 'Render each PDF page to PNG/JPG.',
    accept: 'application/pdf',
    options: [
      {
        id: 'format',
        label: 'Format',
        type: 'select',
        default: 'png',
        choices: [
          { label: 'PNG', value: 'png' },
          { label: 'JPG', value: 'jpg' }
        ]
      },
      {
        id: 'scale',
        label: 'Scale',
        type: 'range',
        min: 1,
        max: 3,
        step: 0.5,
        default: 1.5
      }
    ],
    async run(files, options, ctx) {
      const format = String(options.format || 'png');
      const scale = Number(options.scale || 1.5);
      const [file] = files;
      const pdf = await loadPdf(file);
      const results = [] as { name: string; blob: Blob; mime: string }[];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const canvas = await renderPdfPage(pdf, i, scale);
        const blob = await canvasToBlob(canvas, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        results.push({
          name: `page-${i}.${format}`,
          blob,
          mime: blob.type
        });
        ctx.onProgress(i / pdf.numPages);
      }
      return results;
    }
  },
  {
    id: 'images_pdf',
    title: 'Images → PDF',
    category: 'Documents',
    description: 'Combine images into a single PDF.',
    accept: 'image/*',
    multiple: true,
    async run(files, _options, ctx) {
      const pdf = await PDFDocument.create();
      for (let i = 0; i < files.length; i += 1) {
        const bytes = await readAsArrayBuffer(files[i]);
        const isPng = files[i].type.includes('png');
        const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const page = pdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        ctx.onProgress((i + 1) / files.length);
      }
      const out = await pdf.save();
      return [{ name: 'images.pdf', blob: toBlob(out, 'application/pdf'), mime: 'application/pdf' }];
    }
  },
  {
    id: 'pdf_compress',
    title: 'Compress PDF',
    category: 'Documents',
    description: 'Rasterize pages at lower DPI for smaller size.',
    accept: 'application/pdf',
    options: [
      { id: 'dpi', label: 'Target DPI', type: 'number', min: 72, max: 200, step: 12, default: 120 }
    ],
    async run(files, options, ctx) {
      const dpi = Number(options.dpi || 120);
      const scale = dpi / 72;
      const [file] = files;
      const pdf = await loadPdf(file);
      const outPdf = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const canvas = await renderPdfPage(pdf, i, scale);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.75);
        const arrayBuffer = await blob.arrayBuffer();
        const img = await outPdf.embedJpg(arrayBuffer);
        const page = outPdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        ctx.onProgress(i / pdf.numPages);
      }
      const out = await outPdf.save();
      return [{ name: 'compressed.pdf', blob: toBlob(out, 'application/pdf'), mime: 'application/pdf' }];
    }
  },
  {
    id: 'docx_txt',
    title: 'DOCX → TXT',
    category: 'Documents',
    description: 'Extract plain text from DOCX.',
    accept: '.docx',
    async run(files, _options, ctx) {
      const [file] = files;
      const result = await mammoth.extractRawText({ arrayBuffer: await readAsArrayBuffer(file) });
      ctx.onProgress(1);
      return [{ name: 'document.txt', blob: new Blob([result.value], { type: 'text/plain' }), mime: 'text/plain' }];
    }
  },
  {
    id: 'docx_pdf',
    title: 'DOCX → PDF',
    category: 'Documents',
    description: 'Best-effort DOCX to PDF using HTML rendering.',
    accept: '.docx',
    async run(files, _options, ctx) {
      const [file] = files;
      const html = await docxToHtml(file);
      const blob = await htmlToPdf(html);
      ctx.onProgress(1);
      return [{ name: 'document.pdf', blob, mime: 'application/pdf' }];
    }
  },
  {
    id: 'html_pdf',
    title: 'HTML → PDF',
    category: 'Documents',
    description: 'Render HTML to PDF.',
    accept: 'text/html',
    options: [
      { id: 'html', label: 'HTML Input', type: 'textarea', placeholder: '<h1>Hello</h1>' }
    ],
    async run(files, options, ctx) {
      let html = String(options.html || '');
      if (!html && files.length) {
        html = await readAsText(files[0]);
      }
      const blob = await htmlToPdf(html || '<p></p>');
      ctx.onProgress(1);
      return [{ name: 'page.pdf', blob, mime: 'application/pdf' }];
    }
  },
  {
    id: 'epub_pdf',
    title: 'EPUB → PDF',
    category: 'Documents',
    description: 'Best-effort EPUB to PDF (text-only).',
    accept: '.epub',
    async run(files, _options, ctx) {
      const [file] = files;
      const { default: ePub } = await import('epubjs');
      const book = ePub(await readAsArrayBuffer(file));
      await book.ready;
      const spineItems = book.spine.spineItems;
      const pdf = new jsPDF('p', 'pt', 'a4');
      let page = 0;
      for (const item of spineItems) {
        const section = await book.load(item.href);
        const text = section.textContent || '';
        if (page > 0) pdf.addPage();
        pdf.text(text.substring(0, 8000), 40, 60, { maxWidth: 520 });
        page += 1;
        ctx.onProgress(page / spineItems.length);
      }
      const blob = pdf.output('blob');
      return [{ name: 'book.pdf', blob, mime: 'application/pdf' }];
    }
  },
  {
    id: 'ocr_text',
    title: 'OCR → Text',
    category: 'Documents',
    description: 'Extract text from images or PDFs using OCR.',
    accept: 'image/*,application/pdf',
    multiple: true,
    async run(files, _options, ctx) {
      let combined = '';
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (file.type === 'application/pdf') {
          const pdf = await loadPdf(file);
          for (let page = 1; page <= pdf.numPages; page += 1) {
            const canvas = await renderPdfPage(pdf, page, 1.5);
            const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
              combined += await ocrImageData(imageData);
              combined += '\n\n';
            }
            ctx.onProgress((page / pdf.numPages) * ((i + 1) / files.length));
          }
        } else {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx2 = canvas.getContext('2d');
          if (!ctx2) continue;
          ctx2.drawImage(bitmap, 0, 0);
          const imageData = ctx2.getImageData(0, 0, canvas.width, canvas.height);
          combined += await ocrImageData(imageData);
          combined += '\n\n';
          ctx.onProgress((i + 1) / files.length);
        }
      }
      return [{ name: 'ocr.txt', blob: new Blob([combined.trim()], { type: 'text/plain' }), mime: 'text/plain' }];
    }
  },
  {
    id: 'ocr_pdf',
    title: 'OCR → PDF',
    category: 'Documents',
    description: 'Best-effort: OCR text exported to a text-only PDF.',
    accept: 'image/*,application/pdf',
    multiple: true,
    async run(files, _options, ctx) {
      const textResult = await documentConverters.find((c) => c.id === 'ocr_text')!.run(files, {}, ctx);
      const text = await textResult[0].blob.text();
      const pdf = new jsPDF('p', 'pt', 'a4');
      pdf.text(text.substring(0, 30000), 40, 60, { maxWidth: 520 });
      const blob = pdf.output('blob');
      return [{ name: 'ocr.pdf', blob, mime: 'application/pdf' }];
    }
  }
];
