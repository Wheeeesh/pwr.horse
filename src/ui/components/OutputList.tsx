import { h } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import type { ConversionResult } from '../../core/types';

interface OutputListProps {
  outputs: ConversionResult[];
}

const OutputList = ({ outputs }: OutputListProps) => {
  const links = useMemo(
    () =>
      outputs.map((output) => ({
        name: output.name,
        url: URL.createObjectURL(output.blob)
      })),
    [outputs]
  );

  useEffect(() => {
    return () => {
      links.forEach((link) => URL.revokeObjectURL(link.url));
    };
  }, [links]);

  if (!outputs.length) return null;

  return (
    <div class="output-list">
      {links.map((link) => (
        <a key={link.url} class="output-link" href={link.url} download={link.name}>
          <span>{link.name}</span>
          <span class="badge">download</span>
        </a>
      ))}
    </div>
  );
};

export default OutputList;
