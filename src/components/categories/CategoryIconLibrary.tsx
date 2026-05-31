import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PRESET_ICONS, buildPresetUrl, isPresetUrl, getPresetId } from '../../constants/categoryIcons';

interface CategoryIconLibraryProps {
  currentUrl?: string | null;
  categoryColor?: string;
  onSelect: (url: string) => void;
}

// Group icons by their group label
const GROUPS = Array.from(new Set(PRESET_ICONS.map(i => i.group)));

const CategoryIconLibrary: React.FC<CategoryIconLibraryProps> = ({ currentUrl, categoryColor, onSelect }) => {
  const [open, setOpen] = useState(false);

  const currentPresetId = currentUrl && isPresetUrl(currentUrl) ? getPresetId(currentUrl) : null;

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Preset Icons</span>
        {open ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-slate-900/30">
          {GROUPS.map(group => (
            <div key={group} className="mb-3">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">{group}</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_ICONS.filter(icon => icon.group === group).map(icon => {
                  const IconComp = icon.icon;
                  const isActive = currentPresetId === icon.id;
                  const bg = categoryColor || icon.defaultColor;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => onSelect(buildPresetUrl(icon.id))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:border-blue-500/50 hover:bg-slate-800/60 ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                          : 'border-slate-800 bg-slate-800/30'
                      }`}
                      title={icon.label}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: bg }}
                      >
                        <IconComp size={16} className="text-slate-50" />
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight text-center truncate w-full">{icon.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-slate-600 mt-2 text-center">
            Or upload a custom image ↑
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryIconLibrary;
