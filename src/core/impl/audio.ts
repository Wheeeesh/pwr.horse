import type { Converter } from '../types';

const mimeForAudio = (format: string) => {
  if (format === 'mp3') return 'audio/mpeg';
  if (format === 'wav') return 'audio/wav';
  if (format === 'flac') return 'audio/flac';
  if (format === 'ogg' || format === 'opus') return 'audio/ogg';
  if (format === 'm4a' || format === 'aac') return 'audio/mp4';
  return 'audio/mpeg';
};

export const audioConverters: Converter[] = [
  {
    id: 'audio_convert',
    title: 'Audio Convert',
    category: 'Audio',
    description: 'Convert audio formats and adjust bitrate/sample rate.',
    accept: 'audio/*',
    options: [
      {
        id: 'format',
        label: 'Output format',
        type: 'select',
        default: 'mp3',
        choices: [
          { label: 'MP3', value: 'mp3' },
          { label: 'WAV', value: 'wav' },
          { label: 'FLAC', value: 'flac' },
          { label: 'M4A/AAC', value: 'm4a' },
          { label: 'OGG', value: 'ogg' },
          { label: 'OPUS', value: 'opus' }
        ]
      },
      { id: 'bitrate', label: 'Bitrate (kbps)', type: 'number', min: 64, max: 320, step: 16, default: 192 },
      { id: 'sampleRate', label: 'Sample rate (Hz)', type: 'number', min: 8000, max: 48000, step: 1000, default: 44100 }
    ],
    async run(files, options, ctx) {
      const { runFfmpeg } = await import('./ffmpeg');
      const [file] = files;
      const format = String(options.format || 'mp3');
      const bitrate = Number(options.bitrate || 192);
      const sampleRate = Number(options.sampleRate || 44100);
      const args: string[] = [];
      if (format === 'mp3') args.push('-c:a', 'libmp3lame');
      if (format === 'wav') args.push('-c:a', 'pcm_s16le');
      if (format === 'flac') args.push('-c:a', 'flac');
      if (format === 'm4a') args.push('-c:a', 'aac');
      if (format === 'ogg') args.push('-c:a', 'libvorbis');
      if (format === 'opus') args.push('-c:a', 'libopus');
      args.push('-b:a', `${bitrate}k`);
      args.push('-ar', String(sampleRate));
      const outputName = `output.${format === 'm4a' ? 'm4a' : format}`;
      const blob = await runFfmpeg(file, args, outputName, (value) => ctx.onProgress(value));
      return [{ name: outputName, blob, mime: mimeForAudio(format) }];
    }
  },
  {
    id: 'audio_normalize',
    title: 'Normalize Loudness',
    category: 'Audio',
    description: 'Normalize loudness using EBU R128 (loudnorm).',
    accept: 'audio/*',
    options: [
      { id: 'target', label: 'Target LUFS', type: 'number', min: -30, max: -10, step: 1, default: -16 }
    ],
    async run(files, options, ctx) {
      const { runFfmpeg } = await import('./ffmpeg');
      const [file] = files;
      const target = Number(options.target || -16);
      const args = ['-af', `loudnorm=I=${target}:TP=-1.5:LRA=11`, '-c:a', 'pcm_s16le'];
      const outputName = 'normalized.wav';
      const blob = await runFfmpeg(file, args, outputName, (value) => ctx.onProgress(value));
      return [{ name: outputName, blob, mime: 'audio/wav' }];
    }
  }
];
