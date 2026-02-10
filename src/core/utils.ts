export const readAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const toBlob = (data: Uint8Array | ArrayBuffer, mime: string) =>
  new Blob([data], { type: mime });

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob || new Blob()), type, quality));

export const fileExtension = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
};

export const downloadFileName = (name: string, ext: string) => {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base}.${ext}`;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
