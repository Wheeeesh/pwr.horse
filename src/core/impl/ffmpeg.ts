import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import workerScript from '@ffmpeg/ffmpeg/worker?raw';
import workerUrl from '@ffmpeg/ffmpeg/worker?url';

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
const inlineWorkerURL = URL.createObjectURL(new Blob([workerScript], { type: 'text/javascript' }));
let coreBlobURL: string | null = null;
let wasmBlobURL: string | null = null;

const toBlobURL = async (url: string, mime: string) => {
  if (url.startsWith('blob:')) return url;
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const blob = new Blob([buffer], { type: mime });
  return URL.createObjectURL(blob);
};

export const getFfmpeg = async () => {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const ffmpeg = new FFmpeg();
      const useInline = !import.meta.env.DEV;

      const load = async (inline: boolean) => {
        const resolvedCore = inline ? await toBlobURL(coreURL, 'text/javascript') : coreURL;
        const resolvedWasm = inline ? await toBlobURL(wasmURL, 'application/wasm') : wasmURL;
        const resolvedWorker = inline ? inlineWorkerURL : workerUrl;
        await ffmpeg.load({ coreURL: resolvedCore, wasmURL: resolvedWasm, classWorkerURL: resolvedWorker });
      };

      const withTimeout = async (promise: Promise<void>, ms: number, label: string) => {
        let timeoutId: number | undefined;
        const timeout = new Promise<void>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(label)), ms);
        });
        await Promise.race([promise, timeout]);
        if (timeoutId) window.clearTimeout(timeoutId);
      };

      try {
        if (!useInline) {
          await withTimeout(load(false), 30_000, 'FFmpeg load timed out');
        } else {
          if (!coreBlobURL) coreBlobURL = await toBlobURL(coreURL, 'text/javascript');
          if (!wasmBlobURL) wasmBlobURL = await toBlobURL(wasmURL, 'application/wasm');
          await withTimeout(load(true), 30_000, 'FFmpeg load timed out');
        }
      } catch (error) {
        if (useInline) {
          await withTimeout(load(false), 30_000, 'FFmpeg load timed out');
        } else {
          throw error;
        }
      }

      instance = ffmpeg;
      return ffmpeg;
    })();
  }
  return loading;
};

export const runFfmpeg = async (
  input: File,
  args: string[],
  outputName: string,
  onProgress?: (value: number) => void,
  extraFiles?: { name: string; data: Uint8Array | string }[],
  timeoutMs = 5 * 60 * 1000
) => {
  const ffmpeg = await getFfmpeg();
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress));
  }
  const inputName = `input-${Date.now()}-${input.name}`;
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(input));
    if (onProgress) {
      onProgress(0.02);
    }
    if (extraFiles) {
      for (const file of extraFiles) {
        await ffmpeg.writeFile(
          file.name,
          typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data
        );
      }
    }
    const exitCode = await ffmpeg.exec(['-i', inputName, ...args, outputName], timeoutMs);
    if (exitCode !== 0) {
      throw new Error(exitCode === 1 ? 'FFmpeg timed out' : `FFmpeg failed with code ${exitCode}`);
    }
    if (onProgress) {
      onProgress(0.98);
    }
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data.buffer]);
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {}
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}
    if (extraFiles) {
      for (const file of extraFiles) {
        try {
          await ffmpeg.deleteFile(file.name);
        } catch {}
      }
    }
  }
};
