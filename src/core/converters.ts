import type { Converter } from './types';
import { documentConverters } from './impl/documents';
import { imageConverters } from './impl/images';
import { videoConverters } from './impl/video';
import { audioConverters } from './impl/audio';
import { archiveConverters } from './impl/archives';
import { dataConverters } from './impl/data';
import { qrConverters } from './impl/qr';

export const converters: Converter[] = [
  ...documentConverters,
  ...imageConverters,
  ...videoConverters,
  ...audioConverters,
  ...archiveConverters,
  ...dataConverters,
  ...qrConverters
];
