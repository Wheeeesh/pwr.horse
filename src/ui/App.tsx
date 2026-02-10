import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import FileDrop from './components/FileDrop';
import OptionsForm from './components/OptionsForm';
import OutputList from './components/OutputList';
import { converters } from '../core/converters';
import type { ConversionResult, Converter, ConverterCategory, ConverterOption } from '../core/types';
import QRCode from 'qrcode';
import { zipSync } from 'fflate';

const categoryChips: { id: string; label: string; category: ConverterCategory }[] = [
  { id: 'pdf', label: 'PDF', category: 'Documents' },
  { id: 'images', label: 'Images', category: 'Images' },
  { id: 'video', label: 'Video', category: 'Video' },
  { id: 'audio', label: 'Audio', category: 'Audio' },
  { id: 'archives', label: 'Archives', category: 'Archives' },
  { id: 'data', label: 'Data', category: 'Data' }
];

const qrTypes = [
  {
    id: 'url',
    label: 'URL',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1" />
        <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 1 0 6 6l1-1" />
      </svg>
    )
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M5 6h14" />
        <path d="M9 6v12" />
        <path d="M15 6v12" />
      </svg>
    )
  },
  {
    id: 'wifi',
    label: 'WiFi',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M2 8a16 16 0 0 1 20 0" />
        <path d="M5 11a11 11 0 0 1 14 0" />
        <path d="M8 14a6 6 0 0 1 8 0" />
        <circle cx="12" cy="18" r="1.5" />
      </svg>
    )
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    )
  },
  {
    id: 'email',
    label: 'Email',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 8l9 6 9-6" />
      </svg>
    )
  },
  {
    id: 'sms',
    label: 'SMS',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M4 5h16v10H7l-3 3z" />
      </svg>
    )
  },
  {
    id: 'phone',
    label: 'Phone',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M6 4h4l2 6-3 2a12 12 0 0 0 5 5l2-3 6 2v4a2 2 0 0 1-2 2A18 18 0 0 1 4 6a2 2 0 0 1 2-2z" />
      </svg>
    )
  },
  {
    id: 'location',
    label: 'Location',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    )
  }
];

const defaultOptions = (converter?: Converter) => {
  const values: Record<string, string | number | boolean> = {};
  converter?.options?.forEach((option) => {
    values[option.id] = option.default ?? '';
  });
  return values;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

interface QueueItem {
  id: string;
  file: File;
  status: 'queued' | 'converting' | 'done' | 'failed';
  progress: number;
  outputs: ConversionResult[];
  error?: string;
  format?: string;
}

const createQueueItem = (file: File, format?: string): QueueItem => ({
  id: crypto.randomUUID(),
  file,
  status: 'queued',
  progress: 0,
  outputs: [],
  format
});

const getFormatOption = (converter?: Converter): ConverterOption | undefined =>
  converter?.options?.find((option) => option.id === 'format' && option.type === 'select');

const App = () => {
  const [mode, setMode] = useState<'convert' | 'qr'>('convert');
  const [activeChip, setActiveChip] = useState(categoryChips[0].id);
  const [selectedConverterId, setSelectedConverterId] = useState(converters[0]?.id || '');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [options, setOptions] = useState<Record<string, string | number | boolean>>({});
  const [sameFormat, setSameFormat] = useState(true);
  const [globalFormat, setGlobalFormat] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const queueRef = useRef(queue);

  const [qrType, setQrType] = useState<'url' | 'text' | 'wifi' | 'contact' | 'email' | 'sms' | 'phone' | 'location'>('url');
  const [qrFields, setQrFields] = useState({
    url: 'https://example.com',
    text: '',
    wifiSsid: '',
    wifiPassword: '',
    wifiEncryption: 'WPA',
    wifiHidden: false,
    contactName: '',
    contactOrg: '',
    contactPhone: '',
    contactEmail: '',
    emailTo: '',
    emailSubject: '',
    emailBody: '',
    smsPhone: '',
    smsMessage: '',
    phoneNumber: '',
    locationLat: '',
    locationLng: ''
  });
  const [qrStyle, setQrStyle] = useState({
    fg: '#000000',
    bg: '#ffffff'
  });
  const [qrPreview, setQrPreview] = useState({ png: '', svg: '' });
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const filteredConverters = useMemo(() => {
    const chip = categoryChips.find((c) => c.id === activeChip) || categoryChips[0];
    return converters.filter((converter) => converter.category === chip.category);
  }, [activeChip]);

  const selectedConverter = useMemo(
    () => converters.find((c) => c.id === selectedConverterId) || filteredConverters[0],
    [selectedConverterId, filteredConverters]
  );

  const formatOption = useMemo(() => getFormatOption(selectedConverter), [selectedConverter]);
  const advancedOptions = useMemo(
    () => selectedConverter?.options?.filter((option) => option.id !== formatOption?.id) || [],
    [selectedConverter, formatOption]
  );

  useEffect(() => {
    if (filteredConverters[0] && filteredConverters[0].id !== selectedConverterId) {
      setSelectedConverterId(filteredConverters[0].id);
    }
  }, [filteredConverters]);

  useEffect(() => {
    setOptions(defaultOptions(selectedConverter));
    const defaultFormat = formatOption?.choices?.[0]?.value || String(formatOption?.default || '');
    setGlobalFormat(defaultFormat);
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'queued',
        progress: 0,
        outputs: [],
        error: undefined,
        format: defaultFormat
      }))
    );
  }, [selectedConverter?.id]);

  useEffect(() => {
    if (sameFormat && globalFormat) {
      setQueue((prev) => prev.map((item) => ({ ...item, format: globalFormat })));
    }
  }, [sameFormat, globalFormat]);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setQueue((prev) => [...prev, ...files.map((file) => createQueueItem(file, globalFormat))]);
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const runConversion = async (itemId: string) => {
    const converter = selectedConverter;
    if (!converter) return;
    const item = queueRef.current.find((entry) => entry.id === itemId);
    if (!item) return;

    updateItem(item.id, { status: 'converting', progress: 0, error: undefined, outputs: [] });
    try {
      const finalOptions = { ...options };
      if (formatOption) {
        const formatValue = sameFormat ? globalFormat : item.format || globalFormat;
        if (formatValue) {
          finalOptions[formatOption.id] = formatValue;
        }
      }
      const results = await converter.run([item.file], finalOptions, {
        signal: new AbortController().signal,
        onProgress: (value) => updateItem(item.id, { progress: value })
      });
      updateItem(item.id, { status: 'done', progress: 1, outputs: results });
    } catch (err) {
      updateItem(item.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Conversion failed.'
      });
    }
  };

  const handleConvertAll = async () => {
    if (isConverting) return;
    setIsConverting(true);
    for (const item of queueRef.current) {
      if (item.status === 'done') continue;
      await runConversion(item.id);
    }
    setIsConverting(false);
  };

  const handleClearAll = () => {
    setQueue([]);
  };

  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDownloadAll = async () => {
    const outputs = queueRef.current.flatMap((item) => item.outputs || []);
    if (outputs.length === 0) return;
    if (outputs.length === 1) {
      const output = outputs[0];
      const url = URL.createObjectURL(output.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = output.name;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const entries: Record<string, Uint8Array> = {};
    const nameCount: Record<string, number> = {};
    for (const output of outputs) {
      const buffer = new Uint8Array(await output.blob.arrayBuffer());
      const base = output.name;
      const count = (nameCount[base] || 0) + 1;
      nameCount[base] = count;
      const name = count > 1 ? base.replace(/(\.[^.]*)?$/, `-${count}$1`) : base;
      entries[name] = buffer;
    }
    const zipped = zipSync(entries, { level: 6 });
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pwrhorse-outputs.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildQrPayload = () => {
    switch (qrType) {
      case 'url':
        return qrFields.url || 'https://example.com';
      case 'text':
        return qrFields.text || 'Hello from pwr.horse';
      case 'wifi': {
        const auth = qrFields.wifiEncryption || 'WPA';
        const hidden = qrFields.wifiHidden ? 'H:true;' : '';
        return `WIFI:T:${auth};S:${qrFields.wifiSsid};P:${qrFields.wifiPassword};${hidden};`;
      }
      case 'contact':
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${qrFields.contactName}`,
          qrFields.contactOrg ? `ORG:${qrFields.contactOrg}` : '',
          qrFields.contactPhone ? `TEL:${qrFields.contactPhone}` : '',
          qrFields.contactEmail ? `EMAIL:${qrFields.contactEmail}` : '',
          'END:VCARD'
        ]
          .filter(Boolean)
          .join('\n');
      case 'email': {
        const subject = encodeURIComponent(qrFields.emailSubject || '');
        const body = encodeURIComponent(qrFields.emailBody || '');
        return `mailto:${qrFields.emailTo}?subject=${subject}&body=${body}`;
      }
      case 'sms':
        return `SMSTO:${qrFields.smsPhone}:${qrFields.smsMessage}`;
      case 'phone':
        return `tel:${qrFields.phoneNumber}`;
      case 'location':
        return `geo:${qrFields.locationLat},${qrFields.locationLng}`;
      default:
        return '';
    }
  };

  const generateQr = async () => {
    setQrLoading(true);
    const payload = buildQrPayload();
    try {
      const png = await QRCode.toDataURL(payload, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: qrStyle.fg, light: qrStyle.bg }
      });
      const svg = await QRCode.toString(payload, {
        type: 'svg',
        margin: 2,
        color: { dark: qrStyle.fg, light: qrStyle.bg }
      });
      setQrPreview({ png, svg });
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    generateQr();
  }, [qrType, qrFields, qrStyle]);

  const downloadSvg = () => {
    const blob = new Blob([qrPreview.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qr-code.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasFiles = queue.length > 0;
  const hasOutputs = queue.some((item) => item.outputs.length > 0);

  return (
    <div class="app">
      <header class="app-bar">
        <div class="brand">
          <div class="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 16c2.5-4 5-6 8-6s5.5 2 8 6" />
              <path d="M6 12l2-4 4 2 4-2 2 4" />
              <circle cx="12" cy="16" r="3" />
            </svg>
          </div>
          <div>
            <div class="brand-title">pwr.horse</div>
            <div class="brand-subtitle">Universal Converter</div>
          </div>
        </div>

        <div class="tab-switcher" role="tablist" aria-label="Mode switch">
          <button
            role="tab"
            aria-selected={mode === 'convert'}
            class={mode === 'convert' ? 'active' : ''}
            onClick={() => setMode('convert')}
          >
            Convert
          </button>
          <button
            role="tab"
            aria-selected={mode === 'qr'}
            class={mode === 'qr' ? 'active' : ''}
            onClick={() => setMode('qr')}
          >
            QR Code
          </button>
        </div>

        <a class="support-btn" href="mailto:support@pwr.horse">
          Support
        </a>
      </header>

      <main class={`container ${mode} ${hasFiles ? 'has-files' : 'empty'}`}>
        {mode === 'convert' ? (
          <section class="page convert">
            {!hasFiles ? (
              <div class="hero">
                <FileDrop
                  files={[]}
                  onChange={addFiles}
                  multiple
                  accept={undefined}
                  directory={false}
                  title="Drop files to convert"
                  subtitle="or click to browse"
                  helper="Files processed locally • No uploads."
                />
                <div class="chip-row">
                  {categoryChips.map((chip) => (
                    <button
                      key={chip.id}
                      class={`chip ${activeChip === chip.id ? 'active' : ''}`}
                      onClick={() => setActiveChip(chip.id)}
                      aria-pressed={activeChip === chip.id}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div class="workspace">
                <div class="workspace-head">
                  <div>
                    <h2>Conversion queue</h2>
                    <p class="muted">Files processed locally • No uploads.</p>
                  </div>
                  <div class="chip-row">
                    {categoryChips.map((chip) => (
                      <button
                        key={chip.id}
                        class={`chip ${activeChip === chip.id ? 'active' : ''}`}
                        onClick={() => setActiveChip(chip.id)}
                        aria-pressed={activeChip === chip.id}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <FileDrop
                  files={[]}
                  onChange={addFiles}
                  multiple
                  accept={selectedConverter?.accept}
                  directory={selectedConverter?.directory}
                  title="Add more files"
                  subtitle="Drop or click to browse"
                  compact
                />

                <div class="controls">
                  <div class="control-group">
                    <label class="label">Tool</label>
                    <select
                      value={selectedConverter?.id}
                      onChange={(event) => setSelectedConverterId((event.target as HTMLSelectElement).value)}
                    >
                      {filteredConverters.map((converter) => (
                        <option key={converter.id} value={converter.id}>
                          {converter.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formatOption && (
                    <div class="control-group">
                      <label class="label">Output options</label>
                      <div class="inline">
                        <label class="toggle">
                          <input
                            type="checkbox"
                            checked={sameFormat}
                            onChange={(event) => setSameFormat((event.target as HTMLInputElement).checked)}
                          />
                          Same format for all
                        </label>
                        <select
                          value={globalFormat}
                          onChange={(event) => setGlobalFormat((event.target as HTMLSelectElement).value)}
                        >
                          {formatOption.choices?.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {advancedOptions.length > 0 && (
                  <details class="advanced">
                    <summary>Advanced options</summary>
                    <OptionsForm
                      options={advancedOptions}
                      values={options}
                      onChange={(id, value) => setOptions((prev) => ({ ...prev, [id]: value }))}
                    />
                  </details>
                )}

                <div class="queue">
                  {queue.map((item, index) => (
                    <div
                      key={item.id}
                      class="queue-item"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div class="queue-main">
                        <div>
                          <div class="queue-title">{item.file.name}</div>
                          <div class="queue-meta">
                            {item.file.type || 'unknown'} • {formatBytes(item.file.size)}
                          </div>
                        </div>
                        <div class="queue-actions">
                          {!sameFormat && formatOption && (
                            <select
                              value={item.format || globalFormat}
                              onChange={(event) =>
                                updateItem(item.id, { format: (event.target as HTMLSelectElement).value })
                              }
                            >
                              {formatOption.choices?.map((choice) => (
                                <option key={choice.value} value={choice.value}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <span class={`status ${item.status}`}>{item.status}</span>
                          {item.status === 'failed' ? (
                            <button class="btn-ghost" onClick={() => runConversion(item.id)}>
                              Retry
                            </button>
                          ) : null}
                          <button class="btn-ghost" onClick={() => handleRemove(item.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <div class="progress">
                        <span style={{ width: `${Math.round(item.progress * 100)}%` }}></span>
                      </div>
                      {item.error && <div class="error-text">{item.error}</div>}
                      {item.outputs.length > 0 && <OutputList outputs={item.outputs} />}
                    </div>
                  ))}
                </div>

                <div class="bulk-actions">
                  <button class="btn-primary" onClick={handleConvertAll} disabled={isConverting}>
                    {isConverting ? 'Converting…' : 'Convert All'}
                  </button>
                  <button class="btn-secondary" onClick={handleClearAll}>
                    Clear All
                  </button>
                  <button class="btn-ghost" onClick={handleDownloadAll} disabled={!hasOutputs}>
                    Download All
                  </button>
                </div>

                <div class="microcopy">100% free • Files processed locally • No uploads</div>
              </div>
            )}
          </section>
        ) : (
          <section class="page qr">
            <div class="qr-layout">
              <div class="panel">
                <div class="section">
                  <h2>QR Code</h2>
                  <p class="muted">Create structured QR codes with full privacy.</p>
                </div>

                <div class="section">
                  <div class="section-title">Type</div>
                  <div class="type-grid">
                    {qrTypes.map((type) => (
                      <button
                        key={type.id}
                        class={`type-tile ${qrType === type.id ? 'active' : ''}`}
                        onClick={() => setQrType(type.id as typeof qrType)}
                      >
                        {type.icon}
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Content</div>
                  {qrType === 'url' && (
                    <label class="field">
                      URL
                      <input
                        type="text"
                        value={qrFields.url}
                        placeholder="https://example.com"
                        onInput={(event) =>
                          setQrFields((prev) => ({ ...prev, url: (event.target as HTMLInputElement).value }))
                        }
                      />
                    </label>
                  )}
                  {qrType === 'text' && (
                    <label class="field">
                      Text
                      <textarea
                        value={qrFields.text}
                        placeholder="Type your message"
                        onInput={(event) =>
                          setQrFields((prev) => ({ ...prev, text: (event.target as HTMLTextAreaElement).value }))
                        }
                      />
                    </label>
                  )}
                  {qrType === 'wifi' && (
                    <div class="field-group">
                      <label class="field">
                        Network name (SSID)
                        <input
                          type="text"
                          value={qrFields.wifiSsid}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, wifiSsid: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Password
                        <input
                          type="password"
                          value={qrFields.wifiPassword}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, wifiPassword: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Encryption
                        <select
                          value={qrFields.wifiEncryption}
                          onChange={(event) =>
                            setQrFields((prev) => ({ ...prev, wifiEncryption: (event.target as HTMLSelectElement).value }))
                          }
                        >
                          <option value="WPA">WPA/WPA2</option>
                          <option value="WEP">WEP</option>
                          <option value="nopass">None</option>
                        </select>
                      </label>
                      <label class="toggle">
                        <input
                          type="checkbox"
                          checked={qrFields.wifiHidden}
                          onChange={(event) =>
                            setQrFields((prev) => ({ ...prev, wifiHidden: (event.target as HTMLInputElement).checked }))
                          }
                        />
                        Hidden network
                      </label>
                    </div>
                  )}
                  {qrType === 'contact' && (
                    <div class="field-group">
                      <label class="field">
                        Name
                        <input
                          type="text"
                          value={qrFields.contactName}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, contactName: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Organization
                        <input
                          type="text"
                          value={qrFields.contactOrg}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, contactOrg: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Phone
                        <input
                          type="tel"
                          value={qrFields.contactPhone}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, contactPhone: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Email
                        <input
                          type="email"
                          value={qrFields.contactEmail}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, contactEmail: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                    </div>
                  )}
                  {qrType === 'email' && (
                    <div class="field-group">
                      <label class="field">
                        Email
                        <input
                          type="email"
                          value={qrFields.emailTo}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, emailTo: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Subject
                        <input
                          type="text"
                          value={qrFields.emailSubject}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, emailSubject: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Message
                        <textarea
                          value={qrFields.emailBody}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, emailBody: (event.target as HTMLTextAreaElement).value }))
                          }
                        />
                      </label>
                    </div>
                  )}
                  {qrType === 'sms' && (
                    <div class="field-group">
                      <label class="field">
                        Phone number
                        <input
                          type="tel"
                          value={qrFields.smsPhone}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, smsPhone: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Message
                        <textarea
                          value={qrFields.smsMessage}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, smsMessage: (event.target as HTMLTextAreaElement).value }))
                          }
                        />
                      </label>
                    </div>
                  )}
                  {qrType === 'phone' && (
                    <label class="field">
                      Phone number
                      <input
                        type="tel"
                        value={qrFields.phoneNumber}
                        onInput={(event) =>
                          setQrFields((prev) => ({ ...prev, phoneNumber: (event.target as HTMLInputElement).value }))
                        }
                      />
                    </label>
                  )}
                  {qrType === 'location' && (
                    <div class="field-group">
                      <label class="field">
                        Latitude
                        <input
                          type="text"
                          value={qrFields.locationLat}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, locationLat: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                      <label class="field">
                        Longitude
                        <input
                          type="text"
                          value={qrFields.locationLng}
                          onInput={(event) =>
                            setQrFields((prev) => ({ ...prev, locationLng: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div class="section">
                  <div class="section-title">Style</div>
                  <div class="field-group">
                    <label class="field">
                      Foreground
                      <div class="color-row">
                        <input
                          type="color"
                          value={qrStyle.fg}
                          onInput={(event) =>
                            setQrStyle((prev) => ({ ...prev, fg: (event.target as HTMLInputElement).value }))
                          }
                        />
                        <input
                          type="text"
                          value={qrStyle.fg}
                          onInput={(event) =>
                            setQrStyle((prev) => ({ ...prev, fg: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </div>
                    </label>
                    <label class="field">
                      Background
                      <div class="color-row">
                        <input
                          type="color"
                          value={qrStyle.bg}
                          onInput={(event) =>
                            setQrStyle((prev) => ({ ...prev, bg: (event.target as HTMLInputElement).value }))
                          }
                        />
                        <input
                          type="text"
                          value={qrStyle.bg}
                          onInput={(event) =>
                            setQrStyle((prev) => ({ ...prev, bg: (event.target as HTMLInputElement).value }))
                          }
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <button class="btn-primary" onClick={generateQr}>
                  Generate QR Code
                </button>
              </div>

              <div class="panel preview-panel">
                <div class="section">
                  <h2>Preview</h2>
                  <p class="muted">Live preview updates as you type.</p>
                </div>
                <div class="qr-preview">
                  {qrLoading ? <div class="muted">Generating...</div> : qrPreview.png && <img src={qrPreview.png} alt="QR preview" />}
                </div>
                <div class="export-row">
                  <button class="btn-secondary" onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrPreview.png;
                    link.download = 'qr-code.png';
                    link.click();
                  }}>
                    Download PNG
                  </button>
                  <button class="btn-ghost" onClick={downloadSvg}>
                    Download SVG
                  </button>
                </div>
                <div class="microcopy">No data leaves your browser.</div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer class="footer">No data leaves your browser.</footer>
    </div>
  );
};

export default App;
