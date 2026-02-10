import { h } from 'preact';
import type { ConverterOption } from '../../core/types';

interface OptionsFormProps {
  options?: ConverterOption[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
}

const OptionsForm = ({ options, values, onChange }: OptionsFormProps) => {
  if (!options || options.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {options.map((option) => {
        const value = values[option.id] ?? option.default ?? '';
        return (
          <label class="field" key={option.id}>
            {option.label}
            {option.type === 'select' && (
              <select
                value={String(value)}
                onChange={(event) => onChange(option.id, (event.target as HTMLSelectElement).value)}
              >
                {option.choices?.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
            {option.type === 'number' && (
              <input
                type="number"
                value={Number(value)}
                min={option.min}
                max={option.max}
                step={option.step}
                onInput={(event) => onChange(option.id, Number((event.target as HTMLInputElement).value))}
              />
            )}
            {option.type === 'text' && (
              <input
                type="text"
                value={String(value)}
                placeholder={option.placeholder}
                onInput={(event) => onChange(option.id, (event.target as HTMLInputElement).value)}
              />
            )}
            {option.type === 'textarea' && (
              <textarea
                value={String(value)}
                placeholder={option.placeholder}
                onInput={(event) => onChange(option.id, (event.target as HTMLTextAreaElement).value)}
              />
            )}
            {option.type === 'checkbox' && (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) => onChange(option.id, (event.target as HTMLInputElement).checked)}
              />
            )}
            {option.type === 'color' && (
              <input
                type="color"
                value={String(value)}
                onInput={(event) => onChange(option.id, (event.target as HTMLInputElement).value)}
              />
            )}
            {option.type === 'range' && (
              <div class="inline">
                <input
                  type="range"
                  min={option.min}
                  max={option.max}
                  step={option.step}
                  value={Number(value)}
                  onInput={(event) => onChange(option.id, Number((event.target as HTMLInputElement).value))}
                />
                <span class="badge">{String(value)}</span>
              </div>
            )}
            {option.help && <span class="helper">{option.help}</span>}
          </label>
        );
      })}
    </div>
  );
};

export default OptionsForm;
