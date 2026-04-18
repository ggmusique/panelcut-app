import { useState, useEffect } from 'react';

export default function NumInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  unit = 'cm',
  className = '',
  inputClassName = 'w-20 px-2 py-1 text-sm',
}) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const commit = () => {
    const n = parseFloat(localVal.replace(',', '.'));
    if (!isNaN(n) && n >= min) {
      onChange(n);
    } else {
      setLocalVal(String(value));
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      )}
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') setLocalVal(String(value));
          }}
          className={`bg-slate-800 border border-white/20 rounded text-slate-200 px-1.5 py-0.5 ${inputClassName}`}
        />
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}
