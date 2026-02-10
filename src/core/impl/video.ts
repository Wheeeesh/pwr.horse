import type { Converter } from '../types';
import { runFfmpeg } from './ffmpeg';

const mimeForVideo = (format: string) => {
  if (format === 'mp4' || format === 'mov') return 'video/mp4';
  if (format === 'webm') return 'video/webm';
  if (format === 'gif') return 'image/gif';
  return 'video/mp4';
};

export const videoConverters: Converter[] = [
  {
    id: 'video_convert',
    title: 'Video Convert',
    category: 'Video',
    description: 'Convert video formats, codec, resolution, FPS, bitrate.',
    accept: 'video/*',
    options: [
      {
        id: 'format',
        label: 'Output format',
        type: 'select',
        default: 'mp4',
        choices: [
          { label: 'MP4 (H.264)', value: 'mp4' },
          { label: 'WebM (VP9)', value: 'webm' },
          { label: 'MOV', value: 'mov' }
        ]
      },
      {
        id: 'codec',
        label: 'Video codec',
        type: 'select',
        default: 'auto',
        choices: [
          { label: 'Auto', value: 'auto' },
          { label: 'H.264', value: 'h264' },
          { label: 'H.265', value: 'h265' },
          { label: 'VP9', value: 'vp9' }
        ]
      },
      { id: 'width', label: 'Width (px)', type: 'number', min: 0, max: 3840, step: 1, default: 0 },
      { id: 'height', label: 'Height (px)', type: 'number', min: 0, max: 2160, step: 1, default: 0 },
      { id: 'fps', label: 'FPS', type: 'number', min: 0, max: 120, step: 1, default: 0 },
      { id: 'bitrate', label: 'Video bitrate (kbps)', type: 'number', min: 0, max: 50000, step: 100, default: 0 },
      { id: 'start', label: 'Trim start (sec)', type: 'number', min: 0, max: 100000, step: 1, default: 0 },
      { id: 'duration', label: 'Duration (sec)', type: 'number', min: 0, max: 100000, step: 1, default: 0 },
      { id: 'subtitle', label: 'Burn-in SRT (optional)', type: 'textarea', placeholder: '1\n00:00:01,000 --> 00:00:03,000\nSubtitle text' }
    ],
    async run(files, options, ctx) {
      const [file] = files;
      const format = String(options.format || 'mp4');
      const codec = String(options.codec || 'auto');
      const width = Number(options.width || 0);
      const height = Number(options.height || 0);
      const fps = Number(options.fps || 0);
      const bitrate = Number(options.bitrate || 0);
      const start = Number(options.start || 0);
      const duration = Number(options.duration || 0);
      const subtitle = String(options.subtitle || '').trim();

      const args: string[] = [];
      if (start > 0) args.push('-ss', String(start));
      if (duration > 0) args.push('-t', String(duration));

      const filters: string[] = [];
      if (width > 0 || height > 0) {
        filters.push(`scale=${width || -1}:${height || -1}`);
      }
      if (subtitle) {
        filters.push('subtitles=subs.srt');
      }
      if (filters.length) {
        args.push('-vf', filters.join(','));
      }
      if (fps > 0) args.push('-r', String(fps));
      if (bitrate > 0) args.push('-b:v', `${bitrate}k`);

      if (codec !== 'auto') {
        const map: Record<string, string> = {
          h264: 'libx264',
          h265: 'libx265',
          vp9: 'libvpx-vp9'
        };
        if (map[codec]) {
          args.push('-c:v', map[codec]);
        }
      }

      if (format === 'webm') {
        args.push('-c:a', 'libopus');
      } else {
        args.push('-c:a', 'aac');
      }

      const outputName = `output.${format}`;
      const blob = await runFfmpeg(
        file,
        args,
        outputName,
        (value) => ctx.onProgress(value),
        subtitle ? [{ name: 'subs.srt', data: subtitle }] : undefined
      );

      return [{ name: outputName, blob, mime: mimeForVideo(format) }];
    }
  },
  {
    id: 'video_gif',
    title: 'Video → GIF',
    category: 'Video',
    description: 'Convert video to GIF with size and FPS controls.',
    accept: 'video/*',
    options: [
      { id: 'width', label: 'Width (px)', type: 'number', min: 0, max: 1200, step: 1, default: 640 },
      { id: 'fps', label: 'FPS', type: 'number', min: 5, max: 30, step: 1, default: 12 },
      { id: 'start', label: 'Trim start (sec)', type: 'number', min: 0, max: 100000, step: 1, default: 0 },
      { id: 'duration', label: 'Duration (sec)', type: 'number', min: 0, max: 100000, step: 1, default: 5 }
    ],
    async run(files, options, ctx) {
      const [file] = files;
      const width = Number(options.width || 640);
      const fps = Number(options.fps || 12);
      const start = Number(options.start || 0);
      const duration = Number(options.duration || 5);
      const args: string[] = [];
      if (start > 0) args.push('-ss', String(start));
      if (duration > 0) args.push('-t', String(duration));
      args.push('-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`);
      const blob = await runFfmpeg(file, args, 'output.gif', (value) => ctx.onProgress(value));
      return [{ name: 'clip.gif', blob, mime: 'image/gif' }];
    }
  },
  {
    id: 'extract_audio',
    title: 'Extract Audio',
    category: 'Video',
    description: 'Extract audio from video to MP3/WAV/OGG.',
    accept: 'video/*',
    options: [
      {
        id: 'format',
        label: 'Audio format',
        type: 'select',
        default: 'mp3',
        choices: [
          { label: 'MP3', value: 'mp3' },
          { label: 'WAV', value: 'wav' },
          { label: 'OGG', value: 'ogg' }
        ]
      }
    ],
    async run(files, options, ctx) {
      const [file] = files;
      const format = String(options.format || 'mp3');
      const args = ['-vn'];
      if (format === 'mp3') args.push('-c:a', 'libmp3lame');
      if (format === 'wav') args.push('-c:a', 'pcm_s16le');
      if (format === 'ogg') args.push('-c:a', 'libvorbis');
      const outputName = `output.${format}`;
      const blob = await runFfmpeg(file, args, outputName, (value) => ctx.onProgress(value));
      return [{ name: outputName, blob, mime: `audio/${format}` }];
    }
  }
];
