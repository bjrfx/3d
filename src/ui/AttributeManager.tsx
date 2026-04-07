import { useMemo, useState, type CSSProperties } from 'react';
import { useInteractionStore } from '../stores/interactionStore';
import { useObjectAttributesStore } from '../stores/objectAttributesStore';

type VectorField = 'position' | 'rotation' | 'scale';
type SectionKey = 'transform' | 'appearance' | 'visibility' | 'geometry' | 'object';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toHexChannel = (value: number): string => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');

const rgbToHex = (r: number, g: number, b: number): string => `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const clean = hex.trim().replace('#', '');
  if (!/^([0-9a-fA-F]{6})$/.test(clean)) {
    return null;
  }
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
};

const hueToHex = (hue: number): string => {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.9;
  const l = 0.6;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

const hexToHue = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  if (max === r) {
    return ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  }
  if (max === g) {
    return ((b - r) / delta + 2) * 60;
  }
  return ((r - g) / delta + 4) * 60;
};

const toDegrees = (radians: number): number => radians * (180 / Math.PI);
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

export const AttributeManager = () => {
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const panelHoveredControl = useInteractionStore((s) => s.panelHoveredControl);
  const panelActiveControl = useInteractionStore((s) => s.panelActiveControl);
  const panelHoldProgress = useInteractionStore((s) => s.panelHoldProgress);
  const updateObject = useObjectAttributesStore((s) => s.updateObject);
  const updateObjectVector = useObjectAttributesStore((s) => s.updateObjectVector);
  const selectedObject = useObjectAttributesStore((s) =>
    selectedObjectId ? s.objects.find((obj) => obj.id === selectedObjectId) ?? null : null
  );

  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    transform: true,
    appearance: true,
    visibility: true,
    geometry: true,
    object: true,
  });

  const colorRgb = useMemo(() => {
    if (!selectedObject) {
      return { r: 0, g: 0, b: 0 };
    }
    return hexToRgb(selectedObject.color) ?? { r: 0, g: 0, b: 0 };
  }, [selectedObject]);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isControlHighlighted = (controlId: string): boolean => {
    return panelHoveredControl === controlId || panelActiveControl === controlId;
  };

  const renderHold = (controlId: string) => {
    if (panelHoveredControl !== controlId || panelActiveControl) {
      return null;
    }
    return (
      <span
        className="attribute-manager__hold"
        style={{ '--hold-progress': String(panelHoldProgress) } as CSSProperties}
      />
    );
  };

  const updateVector = (field: VectorField, axis: 0 | 1 | 2, value: number, fromDegrees = false) => {
    const normalized = field === 'scale' ? clamp(value, 0.1, 5) : value;
    const finalValue = fromDegrees ? toRadians(normalized) : normalized;
    updateObjectVector(activeObjectId, field, axis, finalValue);
  };

  const onHexChange = (value: string) => {
    const candidate = value.startsWith('#') ? value : `#${value}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(candidate)) {
      return;
    }
    updateObject(activeObjectId, { color: candidate.toLowerCase() });
  };

  const onRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const next = {
      ...colorRgb,
      [channel]: clamp(value, 0, 255),
    };
    updateObject(activeObjectId, {
      color: rgbToHex(next.r, next.g, next.b),
    });
  };

  const vectorRows: Array<{
    key: VectorField;
    label: string;
    min: number;
    max: number;
    step: number;
    useDegrees?: boolean;
  }> = [
    { key: 'position', label: 'Position', min: -10, max: 10, step: 0.01 },
    { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, useDegrees: true },
    { key: 'scale', label: 'Scale', min: 0.1, max: 5, step: 0.01 },
  ];

  if (!selectedObject || !selectedObjectId) {
    return (
      <div className="attribute-manager attribute-manager--empty" aria-label="No selected object">
        <div className="attribute-manager__header">
          <p className="attribute-manager__title">Property Editor</p>
          <p className="attribute-manager__subtitle">Select an object to edit transform, appearance, and mesh data.</p>
        </div>
      </div>
    );
  }

  const activeObjectId = selectedObjectId;

  return (
    <aside className="attribute-manager" aria-label="Object attributes" role="complementary">
      <div className="attribute-manager__header">
        <p className="attribute-manager__title">{selectedObject.name}</p>
        <p className="attribute-manager__subtitle">{selectedObject.kind} · {selectedObject.id}</p>
      </div>

      <section className="attribute-manager__section attribute-manager__section--transform">
        <button
          className="attribute-manager__section-trigger"
          data-attr-control="section:transform"
          data-attr-control-type="button"
          onClick={() => toggleSection('transform')}
          type="button"
        >
          <span className={expandedSections.transform ? 'attribute-manager__chevron is-open' : 'attribute-manager__chevron'}>
            ▸
          </span>
          <span>Transform</span>
          {renderHold('section:transform')}
        </button>

        {expandedSections.transform && (
          <div className="attribute-manager__section-body">
            {vectorRows.map((row) => {
              const values = selectedObject[row.key];
              return (
                <div key={row.key} className="attribute-manager__vector-block">
                  <p className="attribute-manager__vector-label">{row.label}</p>
                  {(['X', 'Y', 'Z'] as const).map((axisLabel, axisIndex) => {
                    const axis = axisIndex as 0 | 1 | 2;
                    const raw = values[axis];
                    const displayValue = row.useDegrees ? toDegrees(raw) : raw;
                    const sliderId = `${row.key}:${axisLabel.toLowerCase()}:slider`;
                    return (
                      <div key={sliderId} className="attribute-manager__control-row">
                        <span className="attribute-manager__axis">{axisLabel}</span>
                        <input
                          className={isControlHighlighted(sliderId) ? 'attribute-manager__slider is-highlighted' : 'attribute-manager__slider'}
                          data-attr-control={sliderId}
                          data-attr-control-type="slider"
                          max={row.max}
                          min={row.min}
                          onChange={(event) => updateVector(row.key, axis, Number(event.target.value), Boolean(row.useDegrees))}
                          step={row.step}
                          type="range"
                          value={displayValue}
                        />
                        {renderHold(sliderId)}
                        <input
                          className="attribute-manager__number"
                          data-attr-control={`${row.key}:${axisLabel.toLowerCase()}:number`}
                          max={row.max}
                          min={row.min}
                          onChange={(event) => updateVector(row.key, axis, Number(event.target.value), Boolean(row.useDegrees))}
                          step={row.step}
                          type="number"
                          value={displayValue.toFixed(row.useDegrees ? 0 : 2)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="attribute-manager__section attribute-manager__section--appearance">
        <button
          className="attribute-manager__section-trigger"
          data-attr-control="section:appearance"
          data-attr-control-type="button"
          onClick={() => toggleSection('appearance')}
          type="button"
        >
          <span className={expandedSections.appearance ? 'attribute-manager__chevron is-open' : 'attribute-manager__chevron'}>
            ▸
          </span>
          <span>Appearance</span>
          {renderHold('section:appearance')}
        </button>

        {expandedSections.appearance && (
          <div className="attribute-manager__section-body">
            <div className="attribute-manager__color-row">
              <label>Color Picker</label>
              <input
                data-attr-control="appearance:color:picker"
                data-attr-control-type="slider"
                onChange={(event) => updateObject(activeObjectId, { color: event.target.value.toLowerCase() })}
                type="color"
                value={selectedObject.color}
              />
            </div>

            <div className="attribute-manager__control-row">
              <span className="attribute-manager__axis">HEX</span>
              <input
                className="attribute-manager__text"
                data-attr-control="appearance:color:hex"
                defaultValue={selectedObject.color}
                key={`${selectedObject.id}:hex`}
                onBlur={(event) => onHexChange(event.target.value)}
                type="text"
              />
            </div>

            {(['r', 'g', 'b'] as const).map((channel) => (
              <div key={channel} className="attribute-manager__control-row">
                <span className="attribute-manager__axis">{channel.toUpperCase()}</span>
                <input
                  className={isControlHighlighted(`appearance:rgb:${channel}:slider`) ? 'attribute-manager__slider is-highlighted' : 'attribute-manager__slider'}
                  data-attr-control={`appearance:rgb:${channel}:slider`}
                  data-attr-control-type="slider"
                  max={255}
                  min={0}
                  onChange={(event) => onRgbChange(channel, Number(event.target.value))}
                  step={1}
                  type="range"
                  value={colorRgb[channel]}
                />
                {renderHold(`appearance:rgb:${channel}:slider`)}
                <input
                  className="attribute-manager__number"
                  data-attr-control={`appearance:rgb:${channel}:number`}
                  max={255}
                  min={0}
                  onChange={(event) => onRgbChange(channel, Number(event.target.value))}
                  step={1}
                  type="number"
                  value={colorRgb[channel]}
                />
              </div>
            ))}

            <div className="attribute-manager__control-row">
              <span className="attribute-manager__axis">Hue</span>
              <input
                className={isControlHighlighted('appearance:color:spectrum') ? 'attribute-manager__slider attribute-manager__slider--spectrum is-highlighted' : 'attribute-manager__slider attribute-manager__slider--spectrum'}
                data-attr-control="appearance:color:spectrum"
                data-attr-control-type="slider"
                max={360}
                min={0}
                onChange={(event) => {
                  const nextHue = Number(event.target.value);
                  updateObject(activeObjectId, { color: hueToHex(nextHue) });
                }}
                step={1}
                type="range"
                value={hexToHue(selectedObject.color)}
              />
              {renderHold('appearance:color:spectrum')}
            </div>

            <div className="attribute-manager__control-row">
              <span className="attribute-manager__axis">Opacity</span>
              <input
                className={isControlHighlighted('appearance:opacity') ? 'attribute-manager__slider is-highlighted' : 'attribute-manager__slider'}
                data-attr-control="appearance:opacity"
                data-attr-control-type="slider"
                max={1}
                min={0}
                onChange={(event) => updateObject(activeObjectId, { opacity: clamp(Number(event.target.value), 0, 1) })}
                step={0.01}
                type="range"
                value={selectedObject.opacity}
              />
              {renderHold('appearance:opacity')}
              <input
                className="attribute-manager__number"
                max={1}
                min={0}
                onChange={(event) => updateObject(activeObjectId, { opacity: clamp(Number(event.target.value), 0, 1) })}
                step={0.01}
                type="number"
                value={selectedObject.opacity.toFixed(2)}
              />
            </div>
          </div>
        )}
      </section>

      <section className="attribute-manager__section attribute-manager__section--visibility">
        <button
          className="attribute-manager__section-trigger"
          data-attr-control="section:visibility"
          data-attr-control-type="button"
          onClick={() => toggleSection('visibility')}
          type="button"
        >
          <span className={expandedSections.visibility ? 'attribute-manager__chevron is-open' : 'attribute-manager__chevron'}>
            ▸
          </span>
          <span>Visibility</span>
          {renderHold('section:visibility')}
        </button>

        {expandedSections.visibility && (
          <div className="attribute-manager__section-body">
            <button
              className={selectedObject.visible ? 'attribute-manager__toggle is-on' : 'attribute-manager__toggle'}
              data-attr-control="visibility:toggle"
              data-attr-control-type="button"
              onClick={() => updateObject(activeObjectId, { visible: !selectedObject.visible })}
              type="button"
            >
              <span>{selectedObject.visible ? 'Hide Object' : 'Show Object'}</span>
              <span aria-hidden="true">{selectedObject.visible ? '👁' : '◌'}</span>
              {renderHold('visibility:toggle')}
            </button>
          </div>
        )}
      </section>

      <section className="attribute-manager__section attribute-manager__section--geometry">
        <button
          className="attribute-manager__section-trigger"
          data-attr-control="section:geometry"
          data-attr-control-type="button"
          onClick={() => toggleSection('geometry')}
          type="button"
        >
          <span className={expandedSections.geometry ? 'attribute-manager__chevron is-open' : 'attribute-manager__chevron'}>
            ▸
          </span>
          <span>Geometry</span>
          {renderHold('section:geometry')}
        </button>

        {expandedSections.geometry && (
          <div className="attribute-manager__section-body attribute-manager__stats">
            <div><span>Type</span><strong>{selectedObject.geometry.type}</strong></div>
            <div><span>Vertices</span><strong>{selectedObject.geometry.vertices}</strong></div>
            <div><span>Faces</span><strong>{selectedObject.geometry.faces}</strong></div>
          </div>
        )}
      </section>

      <section className="attribute-manager__section attribute-manager__section--object">
        <button
          className="attribute-manager__section-trigger"
          data-attr-control="section:object"
          data-attr-control-type="button"
          onClick={() => toggleSection('object')}
          type="button"
        >
          <span className={expandedSections.object ? 'attribute-manager__chevron is-open' : 'attribute-manager__chevron'}>
            ▸
          </span>
          <span>Object</span>
          {renderHold('section:object')}
        </button>

        {expandedSections.object && (
          <div className="attribute-manager__section-body attribute-manager__stats">
            <div className="attribute-manager__object-name-row">
              <span>Name</span>
              <input
                className="attribute-manager__text"
                data-attr-control="object:name"
                onChange={(event) => updateObject(activeObjectId, { name: event.target.value })}
                type="text"
                value={selectedObject.name}
              />
            </div>
            <div><span>Kind</span><strong>{selectedObject.kind}</strong></div>
            <div><span>ID</span><strong>{selectedObject.id}</strong></div>
          </div>
        )}
      </section>
    </aside>
  );
};
