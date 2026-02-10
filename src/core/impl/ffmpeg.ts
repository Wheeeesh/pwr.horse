import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import workerScript from '@ffmpeg/ffmpeg/worker?raw';

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
const workerBlobURL = URL.createObjectURL(new Blob([workerScript], { type: 'text/javascript' }));

export const getFfmpeg = async () => {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({ coreURL, wasmURL, classWorkerURL: workerBlobURL });
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
  extraFiles?: { name: string; data: Uint8Array | string }[]
) => {
  const ffmpeg = await getFfmpeg();
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress));
  }
  const inputName = `input-${Date.now()}-${input.name}`;
  await ffmpeg.writeFile(inputName, await fetchFile(input));
  if (extraFiles) {
    for (const file of extraFiles) {
      await ffmpeg.writeFile(file.name, typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data);
    }
  }
  await ffmpeg.exec(['-i', inputName, ...args, outputName]);
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  if (extraFiles) {
    for (const file of extraFiles) {
      await ffmpeg.deleteFile(file.name);
    }
  }
  return new Blob([data.buffer]);
};
