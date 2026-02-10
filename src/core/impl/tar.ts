const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const writeString = (view: Uint8Array, offset: number, str: string, length: number) => {
  const bytes = textEncoder.encode(str);
  view.set(bytes.slice(0, length), offset);
};

const writeOctal = (view: Uint8Array, offset: number, value: number, length: number) => {
  const octal = value.toString(8).padStart(length - 1, '0');
  writeString(view, offset, octal, length - 1);
  view[offset + length - 1] = 0;
};

const checksum = (header: Uint8Array) => header.reduce((sum, b) => sum + b, 0);

export const createTar = (files: { name: string; data: Uint8Array }[]) => {
  const blocks: Uint8Array[] = [];
  for (const file of files) {
    const header = new Uint8Array(512);
    writeString(header, 0, file.name, 100);
    writeOctal(header, 100, 0o777, 8);
    writeOctal(header, 108, 0, 8);
    writeOctal(header, 116, 0, 8);
    writeOctal(header, 124, file.data.length, 12);
    writeOctal(header, 136, Math.floor(Date.now() / 1000), 12);
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeString(header, 257, 'ustar', 6);
    writeString(header, 263, '00', 2);

    const sum = checksum(header);
    writeOctal(header, 148, sum, 8);

    blocks.push(header);
    blocks.push(file.data);
    const pad = 512 - (file.data.length % 512 || 512);
    if (pad > 0) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));

  const totalLength = blocks.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return out;
};

export const extractTar = (data: Uint8Array) => {
  const files: { name: string; data: Uint8Array }[] = [];
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.slice(offset, offset + 512);
    const name = textDecoder.decode(header.slice(0, 100)).replace(/\0.*$/, '');
    if (!name) break;
    const sizeStr = textDecoder.decode(header.slice(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const fileStart = offset + 512;
    const fileEnd = fileStart + size;
    const fileData = data.slice(fileStart, fileEnd);
    files.push({ name, data: fileData });
    offset = fileStart + Math.ceil(size / 512) * 512;
  }
  return files;
};
