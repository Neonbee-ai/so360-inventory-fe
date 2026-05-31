import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, Plus, X } from 'lucide-react';
import { ItemCategory } from '../../types/inventory';
import { buildCategoryTree, flattenTree } from '../../utils/categoryTree';
import { renderCategoryIcon } from '../../constants/categoryIcons';

interface CategoryPickerProps {
    categories: ItemCategory[];
    value: string;
    onChange: (id: string) => void;
    onQuickAdd?: (name: string, parentId?: string) => Promise<void>;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({ categories, value, onChange, onQuickAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddName, setQuickAddName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const flatList = useMemo(() => {
        const tree = buildCategoryTree(categories);
        return flattenTree(tree);
    }, [categories]);

    const getPath = (id: string): string => {
        const cat = categories.find(c => c.id === id);
        if (!cat) return '';
        if (!cat.parent_id) return cat.name;
        const parentPath = getPath(cat.parent_id);
        return parentPath ? `${parentPath} / ${cat.name}` : cat.name;
    };

    const filtered = useMemo(() => {
        if (!search.trim()) return flatList;
        const s = search.toLowerCase();
        return flatList.filter(n => {
            const path = getPath(n.id).toLowerCase();
            return path.includes(s) || n.name.toLowerCase().includes(s);
        });
    }, [flatList, search]);

    const selectedPath = value ? getPath(value) : '';

    const handleQuickAdd = async () => {
        if (!quickAddName.trim() || !onQuickAdd) return;
        setIsAdding(true);
        try {
            await onQuickAdd(quickAddName.trim());
            setQuickAddName('');
            setShowQuickAdd(false);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            >
                <span className={`text-sm ${value ? 'text-slate-200' : 'text-slate-600'} truncate`}>
                    {selectedPath || 'Select category...'}
                </span>
                <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-8 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                                placeholder="Search categories..."
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-44">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700/50 transition-colors ${!value ? 'text-blue-400' : 'text-slate-400'}`}
                        >
                            None
                        </button>
                        {filtered.map(node => {
                            const path = search.trim() && node.depth > 0 ? getPath(node.id) : null;
                            return (
                                <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => { onChange(node.id); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2 ${node.id === value ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'}`}
                                    style={{ paddingLeft: search.trim() ? '16px' : `${node.depth * 16 + 16}px` }}
                                >
                                    {renderCategoryIcon({
                                        iconUrl: node.icon_url,
                                        imageUrl: node.image_url,
                                        name: node.name,
                                        color: node.color,
                                        size: 20,
                                    })}
                                    <span className="truncate">
                                        {path || (node.depth > 0 && !search.trim() ? (
                                            <><span className="text-slate-600">{'  '.repeat(node.depth)}└ </span>{node.name}</>
                                        ) : node.name)}
                                    </span>
                                </button>
                            );
                        })}
                        {filtered.length === 0 && (
                            <p className="px-4 py-3 text-sm text-slate-500 text-center">No categories found</p>
                        )}
                    </div>

                    {onQuickAdd && (
                        <div className="border-t border-slate-700 p-2">
                            {showQuickAdd ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={quickAddName}
                                        onChange={e => setQuickAddName(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-50 placeholder:text-slate-600"
                                        placeholder="Category name..."
                                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setShowQuickAdd(false); }}
                                        autoFocus
                                    />
                                    <button onClick={handleQuickAdd} disabled={isAdding} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs disabled:opacity-50">
                                        {isAdding ? '...' : 'Add'}
                                    </button>
                                    <button onClick={() => setShowQuickAdd(false)} className="text-slate-400 hover:text-slate-50"><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAdd(true)}
                                    className="w-full text-left px-3 py-1.5 text-sm text-slate-500 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus size={14} /> Create new category
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CategoryPicker;
