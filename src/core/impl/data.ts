import type { Converter } from '../types';
import { readAsArrayBuffer, readAsText, toBlob } from '../utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const jsonToCsv = (json: unknown[]) => {
  const worksheet = XLSX.utils.json_to_sheet(json as any[]);
  return XLSX.utils.sheet_to_csv(worksheet);
};

const csvToJson = (csv: string) => {
  const worksheet = XLSX.utils.csv_to_sheet(csv);
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
};

export const dataConverters: Converter[] = [
  {
    id: 'csv_xlsx',
    title: 'CSV → XLSX',
    category: 'Data',
    description: 'Convert CSV to Excel format.',
    accept: '.csv',
    async run(files, _options, ctx) {
      const csv = await readAsText(files[0]);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.csv_to_sheet(csv);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      ctx.onProgress(1);
      return [{ name: 'sheet.xlsx', blob: toBlob(out, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }];
    }
  },
  {
    id: 'xlsx_csv',
    title: 'XLSX → CSV',
    category: 'Data',
    description: 'Convert Excel to CSV.',
    accept: '.xlsx,.xls',
    async run(files, _options, ctx) {
      const data = await readAsArrayBuffer(files[0]);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      ctx.onProgress(1);
      return [{ name: 'sheet.csv', blob: new Blob([csv], { type: 'text/csv' }), mime: 'text/csv' }];
    }
  },
  {
    id: 'json_csv',
    title: 'JSON → CSV',
    category: 'Data',
    description: 'Convert JSON array to CSV.',
    accept: '.json',
    async run(files, _options, ctx) {
      const jsonText = await readAsText(files[0]);
      const json = JSON.parse(jsonText) as unknown[];
      const csv = jsonToCsv(json);
      ctx.onProgress(1);
      return [{ name: 'data.csv', blob: new Blob([csv], { type: 'text/csv' }), mime: 'text/csv' }];
    }
  },
  {
    id: 'csv_json',
    title: 'CSV → JSON',
    category: 'Data',
    description: 'Convert CSV to JSON.',
    accept: '.csv',
    async run(files, _options, ctx) {
      const csv = await readAsText(files[0]);
      const json = csvToJson(csv);
      ctx.onProgress(1);
      return [{ name: 'data.json', blob: new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), mime: 'application/json' }];
    }
  },
  {
    id: 'xml_json',
    title: 'XML → JSON',
    category: 'Data',
    description: 'Convert XML to JSON (best-effort).',
    accept: '.xml',
    async run(files, _options, ctx) {
      const xml = await readAsText(files[0]);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const obj = (node: Element): any => {
        const children = Array.from(node.children);
        if (children.length === 0) return node.textContent || '';
        const result: Record<string, any> = {};
        children.forEach((child) => {
          const value = obj(child);
          if (result[child.tagName]) {
            result[child.tagName] = [].concat(result[child.tagName], value);
          } else {
            result[child.tagName] = value;
          }
        });
        return result;
      };
      const json = obj(doc.documentElement);
      ctx.onProgress(1);
      return [{ name: 'data.json', blob: new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), mime: 'application/json' }];
    }
  },
  {
    id: 'json_xml',
    title: 'JSON → XML',
    category: 'Data',
    description: 'Convert JSON to XML (best-effort).',
    accept: '.json',
    async run(files, _options, ctx) {
      const jsonText = await readAsText(files[0]);
      const json = JSON.parse(jsonText);
      const build = (obj: any, tag = 'root'): string => {
        if (Array.isArray(obj)) {
          return obj.map((item) => build(item, tag)).join('');
        }
        if (obj && typeof obj === 'object') {
          const inner = Object.entries(obj)
            .map(([key, value]) => build(value, key))
            .join('');
          return `<${tag}>${inner}</${tag}>`;
        }
        return `<${tag}>${String(obj ?? '')}</${tag}>`;
      };
      const xml = build(json);
      ctx.onProgress(1);
      return [{ name: 'data.xml', blob: new Blob([xml], { type: 'application/xml' }), mime: 'application/xml' }];
    }
  },
  {
    id: 'tsv_csv',
    title: 'TSV → CSV',
    category: 'Data',
    description: 'Convert TSV to CSV.',
    accept: '.tsv',
    async run(files, _options, ctx) {
      const tsv = await readAsText(files[0]);
      const csv = tsv.replace(/\t/g, ',');
      ctx.onProgress(1);
      return [{ name: 'data.csv', blob: new Blob([csv], { type: 'text/csv' }), mime: 'text/csv' }];
    }
  },
  {
    id: 'txt_pdf',
    title: 'TXT → PDF',
    category: 'Data',
    description: 'Convert plain text to PDF.',
    accept: '.txt',
    async run(files, _options, ctx) {
      const text = await readAsText(files[0]);
      const pdf = new jsPDF('p', 'pt', 'a4');
      pdf.text(text.substring(0, 30000), 40, 60, { maxWidth: 520 });
      const blob = pdf.output('blob');
      ctx.onProgress(1);
      return [{ name: 'document.pdf', blob, mime: 'application/pdf' }];
    }
  }
];
