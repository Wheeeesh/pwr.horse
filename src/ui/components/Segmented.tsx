import { h } from 'preact';

interface Segment {
  id: string;
  label: string;
}

interface SegmentedProps {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
}

const Segmented = ({ segments, value, onChange }: SegmentedProps) => (
  <div class="segmented">
    {segments.map((segment) => (
      <button
        key={segment.id}
        class={segment.id === value ? 'active' : ''}
        onClick={() => onChange(segment.id)}
      >
        {segment.label}
      </button>
    ))}
  </div>
);

export default Segmented;
