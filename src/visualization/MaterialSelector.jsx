import React from 'react';

export const FINISHES = [
  { id: 'oak',    name: 'Chêne naturel',   baseR: 210, baseG: 180, baseB: 148, grainR: 170, grainG: 140, grainB: 100 },
  { id: 'walnut', name: 'Noyer',           baseR: 120, baseG:  85, baseB:  55, grainR:  80, grainG:  50, grainB:  25 },
  { id: 'white',  name: 'Blanc mat',       baseR: 248, baseG: 246, baseB: 242, grainR: 230, grainG: 228, grainB: 224 },
  { id: 'gray',   name: 'Gris anthracite', baseR:  80, baseG:  82, baseB:  86, grainR:  60, grainG:  62, grainB:  66 },
  { id: 'pine',   name: 'Pin clair',       baseR: 230, baseG: 210, baseB: 170, grainR: 200, grainG: 180, grainB: 140 },
  { id: 'ebony',  name: 'Wengé',           baseR:  45, baseG:  32, baseB:  22, grainR:  28, grainG:  18, grainB:  10 },
  { id: 'cherry', name: 'Merisier',        baseR: 195, baseG: 130, baseB:  90, grainR: 155, grainG:  95, grainB:  55 },
];

export default function MaterialSelector({ finish, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>Finition</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FINISHES.map(f => (
          <button
            key={f.id}
            title={f.name}
            aria-label={f.name}
            aria-pressed={finish === f.id}
            onClick={() => onChange(f.id)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: `rgb(${f.baseR},${f.baseG},${f.baseB})`,
              border: '2px solid rgba(255,255,255,0.12)',
              outline: finish === f.id ? '2px solid #ea580c' : '2px solid transparent',
              outlineOffset: 2,
              cursor: 'pointer',
              padding: 0,
              boxSizing: 'border-box',
              transition: 'outline 0.15s',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
