'use client';

import { STAT_BADGE, STAT_LABEL } from './constants';

const TYPE_DESC: Record<string, string> = {
  framework:  'Core principle or value underlying your position',
  claim:      'A direct assertion or point you are making',
  warrant:    'Reasoning that explains why the claim holds',
  evidence:   'Data, facts, or sources backing a warrant',
  impact:     'The significance or consequence of the argument',
  rebuttal:   'A direct challenge to the opposing statement',
  turn:       'Shows the opposing argument supports your side',
};

type Props = {
  parentTitle: string;
  allowedTypes: string[];
  onSelect: (type: string) => void;
  onClose: () => void;
};

export default function TypePickerModal({ parentTitle, allowedTypes, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl p-5">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            What type of statement?
          </p>
          <p className="text-sm text-slate-400 leading-snug">
            Supporting: <span className="text-slate-200">{parentTitle}</span>
          </p>
        </div>

        <div className={`grid gap-2 ${allowedTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {allowedTypes.map(type => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`flex flex-col gap-1 rounded-xl border-2 p-3.5 text-left transition-all
                hover:scale-[1.02] hover:brightness-125 active:scale-[0.98]
                ${STAT_BADGE[type] ?? 'bg-slate-700/40 text-slate-200 border-slate-600'}`}
            >
              <span className="font-semibold text-sm">{STAT_LABEL[type] ?? type}</span>
              <span className="text-[11px] opacity-70 leading-tight">{TYPE_DESC[type] ?? ''}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
