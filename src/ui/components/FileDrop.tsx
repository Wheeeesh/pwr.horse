import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface FileDropProps {
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  helper?: string;
  compact?: boolean;
  className?: string;
}

const FileDrop = ({
  accept,
  multiple,
  directory,
  files,
  onChange,
  title,
  subtitle,
  helper,
  compact,
  className
}: FileDropProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && directory) {
      (inputRef.current as any).webkitdirectory = true;
    }
  }, [directory]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    onChange(Array.from(list));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  return (
    <div
      class={`dropzone ${compact ? 'dropzone-compact' : ''} ${className || ''}`}
      onDrop={onDrop as any}
      onDragOver={onDragOver as any}
    >
      <div class="dropzone-content">
        <div class="dropzone-title">{title || 'Drop files to convert'}</div>
        <div class="dropzone-subtitle">{subtitle || 'or click to browse'}</div>
        {helper && <div class="dropzone-helper">{helper}</div>}
        {files.length > 0 && <div class="dropzone-helper">{files.length} file(s) selected.</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => handleFiles((event.target as HTMLInputElement).files)}
      />
    </div>
  );
};

export default FileDrop;
