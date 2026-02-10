import type { Converter } from '../types';
import { readAsArrayBuffer, toBlob } from '../utils';
import { zipSync, unzipSync, gzipSync, gunzipSync } from 'fflate';
import { createTar, extractTar } from './tar';

export const archiveConverters: Converter[] = [
  {
    id: 'zip_create',
    title: 'ZIP Create',
    category: 'Archives',
    description: 'Create a ZIP from files or folders.',
    accept: '*/*',
    multiple: true,
    directory: true,
    async run(files, _options, ctx) {
      const entries: Record<string, Uint8Array> = {};
      for (let i = 0; i < files.length; i += 1) {
        const buffer = new Uint8Array(await readAsArrayBuffer(files[i]));
        const name = files[i].webkitRelativePath || files[i].name;
        entries[name] = buffer;
        ctx.onProgress((i + 1) / files.length);
      }
      const zipped = zipSync(entries, { level: 6 });
      return [{ name: 'archive.zip', blob: toBlob(zipped, 'application/zip'), mime: 'application/zip' }];
    }
  },
  {
    id: 'zip_extract',
    title: 'ZIP Extract',
    category: 'Archives',
    description: 'Extract files from a ZIP archive.',
    accept: '.zip',
    async run(files, _options, ctx) {
      const [file] = files;
      const data = new Uint8Array(await readAsArrayBuffer(file));
      const entries = unzipSync(data);
      const results = [] as { name: string; blob: Blob; mime: string }[];
      const names = Object.keys(entries);
      names.forEach((name, index) => {
        results.push({ name, blob: toBlob(entries[name], 'application/octet-stream'), mime: 'application/octet-stream' });
        ctx.onProgress((index + 1) / names.length);
      });
      return results;
    }
  },
  {
    id: 'targz_create',
    title: 'TAR.GZ Create',
    category: 'Archives',
    description: 'Create a TAR.GZ from files or folders.',
    accept: '*/*',
    multiple: true,
    directory: true,
    async run(files, _options, ctx) {
      const entries = [] as { name: string; data: Uint8Array }[];
      for (let i = 0; i < files.length; i += 1) {
        const data = new Uint8Array(await readAsArrayBuffer(files[i]));
        const name = files[i].webkitRelativePath || files[i].name;
        entries.push({ name, data });
        ctx.onProgress((i + 1) / files.length);
      }
      const tar = createTar(entries);
      const gz = gzipSync(tar, { level: 6 });
      return [{ name: 'archive.tar.gz', blob: toBlob(gz, 'application/gzip'), mime: 'application/gzip' }];
    }
  },
  {
    id: 'targz_extract',
    title: 'TAR.GZ Extract',
    category: 'Archives',
    description: 'Extract files from a TAR.GZ archive.',
    accept: '.tar.gz,.tgz',
    async run(files, _options, ctx) {
      const [file] = files;
      const data = new Uint8Array(await readAsArrayBuffer(file));
      const tarData = gunzipSync(data);
      const entries = extractTar(tarData);
      const results = entries.map((entry, index) => {
        ctx.onProgress((index + 1) / entries.length);
        return { name: entry.name, blob: toBlob(entry.data, 'application/octet-stream'), mime: 'application/octet-stream' };
      });
      return results;
    }
  },
  {
    id: 'split_archive',
    title: 'Split Archive',
    category: 'Archives',
    description: 'Split a file into smaller parts.',
    accept: '*/*',
    options: [
      { id: 'size', label: 'Chunk size (MB)', type: 'number', min: 1, max: 500, step: 1, default: 10 }
    ],
    async run(files, options, ctx) {
      const sizeMb = Number(options.size || 10);
      const chunkSize = sizeMb * 1024 * 1024;
      const [file] = files;
      const buffer = new Uint8Array(await readAsArrayBuffer(file));
      const results = [] as { name: string; blob: Blob; mime: string }[];
      const total = Math.ceil(buffer.length / chunkSize);
      for (let i = 0; i < total; i += 1) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.length);
        const chunk = buffer.slice(start, end);
        results.push({ name: `${file.name}.part${i + 1}`, blob: toBlob(chunk, 'application/octet-stream'), mime: 'application/octet-stream' });
        ctx.onProgress((i + 1) / total);
      }
      return results;
    }
  }
];
