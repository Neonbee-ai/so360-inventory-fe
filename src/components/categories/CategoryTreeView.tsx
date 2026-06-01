import React, { useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, X, Check, Camera, Loader2 } from 'lucide-react';
import { TreeNode } from '../../utils/categoryTree';
import { mediaService } from '../../services/mediaService';
import { renderCategoryIcon } from '../../constants/categoryIcons';

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#64748B'];

interface CategoryTreeViewProps {
    tree: TreeNode[];
    onAdd?: (name: string, description: string, parentId?: string) => Promise<void>;
    onUpdate: (id: string, data: { name?: string; description?: string; icon_url?: string | null; image_url?: string | null; color?: string | null }) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    canManage: boolean;
    onSelect: (id: string) => void;
    showAddRoot?: boolean;
    onShowAddRootChange?: (v: boolean) => void;
}

interface TreeItemProps {
    node: TreeNode;
    onAdd?: (name: string, description: string, parentId?: string) => Promise<void>;
    onUpdate: (id: string, data: { name?: string; description?: string; icon_url?: string | null; image_url?: string | null; color?: string | null }) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    canManage: boolean;
    onSelect: (id: string) => void;
}

const CategoryAvatar: React.FC<{
    node: TreeNode;
    canManage: boolean;
    onUpdate: (id: string, data: { icon_url?: string | null }) => Promise<void>;
}> = ({ node, canManage, onUpdate }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setUploadError('Max 2MB'); return; }
        if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setUploadError('PNG/JPG/SVG only'); return; }
        setUploadError(null);
        setUploading(true);
        try {
            const { url } = await mediaService.uploadFile(file);
            await onUpdate(node.id, { icon_url: url });
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const bg = node.color || '#334155';

    return (
        <div className="relative flex-shrink-0">
            <label className={`block w-7 h-7 rounded-lg overflow-hidden group/avatar ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="relative w-full h-full">
                    {uploading ? (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: bg }}>
                            <Loader2 size={12} className="text-slate-50 animate-spin" />
                        </div>
                    ) : renderCategoryIcon({
                        iconUrl: node.icon_url,
                        imageUrl: node.image_url,
                        name: node.name,
                        color: node.color,
                        size: 28,
                    })}
                    {canManage && !uploading && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <Camera size={10} className="text-slate-50" />
                        </div>
                    )}
                </div>
                {canManage && (
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleFileChange} />
                )}
            </label>
            {node.image_url && !node.icon_url && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-slate-900"
                    title="Has banner image"
                />
            )}
            {uploadError && (
                <div className="absolute left-0 top-8 z-10 bg-rose-900 border border-rose-500/50 text-rose-300 text-xs px-2 py-1 rounded whitespace-nowrap">
                    {uploadError}
                </div>
            )}
        </div>
    );
};

const TreeItem: React.FC<TreeItemProps> = ({ node, onAdd, onUpdate, onDelete, canManage, onSelect }) => {
    const [expanded, setExpanded] = useState(true);
    const [showAddChild, setShowAddChild] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const [editColor, setEditColor] = useState(node.color || '');
    const [childName, setChildName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const hasChildren = node.children.length > 0;

    const handleAddChild = async () => {
        if (!childName.trim()) return;
        setIsAdding(true);
        try {
            await onAdd?.(childName.trim(), '', node.id);
            setChildName('');
            setShowAddChild(false);
            setExpanded(true);
        } finally {
            setIsAdding(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) {
            setIsEditing(false);
            setEditName(node.name);
            return;
        }
        setIsSaving(true);
        try {
            const updates: { name?: string; color?: string | null } = {};
            if (editName.trim() !== node.name) updates.name = editName.trim();
            if (editColor !== (node.color || '')) updates.color = editColor || null;
            if (Object.keys(updates).length > 0) await onUpdate(node.id, updates);
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete "${node.name}"?`)) return;
        await onDelete?.(node.id);
    };

    return (
        <div>
            <div className="flex items-start gap-1 group py-1.5 px-2 rounded-lg hover:bg-slate-800/50 transition-colors" style={{ paddingLeft: `${node.depth * 20 + 8}px` }}>
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className={`w-5 h-5 flex items-center justify-center text-slate-500 mt-0.5 flex-shrink-0 ${hasChildren ? 'hover:text-slate-300' : 'invisible'}`}
                >
                    {hasChildren && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </button>

                <CategoryAvatar node={node} canManage={canManage} onUpdate={onUpdate} />

                {isEditing ? (
                    <div className="flex flex-col gap-2 flex-1 mt-0.5">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-sm text-slate-50 flex-1"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setIsEditing(false); setEditName(node.name); setEditColor(node.color || ''); } }}
                            />
                            <button onClick={handleSaveEdit} disabled={isSaving} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                            <button onClick={() => { setIsEditing(false); setEditName(node.name); setEditColor(node.color || ''); }} className="text-slate-400 hover:text-slate-50"><X size={14} /></button>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditColor(c)}
                                    className="w-5 h-5 rounded-full border-2 transition-all"
                                    style={{ background: c, borderColor: editColor === c ? 'white' : 'transparent' }}
                                />
                            ))}
                            {editColor && (
                                <button
                                    type="button"
                                    onClick={() => setEditColor('')}
                                    className="text-xs text-slate-500 hover:text-slate-300 ml-1"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 min-w-0 mt-0.5">
                            <span
                                className="text-sm text-slate-300 block truncate cursor-pointer hover:text-slate-50"
                                onClick={() => onSelect(node.id)}
                            >{node.name}</span>
                            {node.description && (
                                <span className="text-xs text-slate-500 block truncate">{node.description}</span>
                            )}
                        </div>
                        {canManage && (
                            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                <button
                                    onClick={() => setShowAddChild(true)}
                                    className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                    title="Add subcategory"
                                >
                                    + Sub
                                </button>
                                <button onClick={() => setIsEditing(true)} className="p-1 text-slate-500 hover:text-amber-400" title="Edit"><Pencil size={12} /></button>
                                <button onClick={handleDelete} className="p-1 text-slate-500 hover:text-rose-400" title="Delete"><Trash2 size={12} /></button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showAddChild && (
                <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${(node.depth + 1) * 20 + 40}px` }}>
                    <input
                        type="text"
                        value={childName}
                        onChange={e => setChildName(e.target.value)}
                        placeholder="Subcategory name..."
                        className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-sm text-slate-50 flex-1"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleAddChild(); if (e.key === 'Escape') setShowAddChild(false); }}
                    />
                    <button onClick={handleAddChild} disabled={isAdding} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs disabled:opacity-50">
                        {isAdding ? '...' : 'Add'}
                    </button>
                    <button onClick={() => setShowAddChild(false)} className="text-slate-400 hover:text-slate-50"><X size={14} /></button>
                </div>
            )}

            {expanded && hasChildren && (
                <div>
                    {node.children.map(child => (
                        <TreeItem key={child.id} node={child} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} canManage={canManage} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CategoryTreeView: React.FC<CategoryTreeViewProps> = ({ tree, onAdd, onUpdate, onDelete, canManage, onSelect, showAddRoot: controlledShowAdd, onShowAddRootChange }) => {
    const [internalShowAdd, setInternalShowAdd] = useState(false);
    const showAddRoot = controlledShowAdd !== undefined ? controlledShowAdd : internalShowAdd;
    const setShowAddRoot = (v: boolean) => {
        if (controlledShowAdd !== undefined) {
            onShowAddRootChange?.(v);
        } else {
            setInternalShowAdd(v);
        }
    };
    const [rootName, setRootName] = useState('');
    const [isAddingRoot, setIsAddingRoot] = useState(false);

    const handleAddRoot = async () => {
        if (!rootName.trim()) return;
        setIsAddingRoot(true);
        try {
            await onAdd?.(rootName.trim(), '');
            setRootName('');
            setShowAddRoot(false);
        } finally {
            setIsAddingRoot(false);
        }
    };

    return (
        <div>
            {tree.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">No categories created yet</p>
            ) : (
                <div className="space-y-0.5">
                    {tree.map(node => (
                        <TreeItem key={node.id} node={node} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} canManage={canManage} onSelect={onSelect} />
                    ))}
                </div>
            )}

            {canManage && (
                <div className="mt-3">
                    {showAddRoot ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={rootName}
                                onChange={e => setRootName(e.target.value)}
                                placeholder="Category name..."
                                className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-sm text-slate-50 flex-1"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleAddRoot(); if (e.key === 'Escape') setShowAddRoot(false); }}
                            />
                            <button onClick={handleAddRoot} disabled={isAddingRoot} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-sm disabled:opacity-50">
                                {isAddingRoot ? '...' : 'Add'}
                            </button>
                            <button onClick={() => setShowAddRoot(false)} className="text-slate-400 hover:text-slate-50"><X size={14} /></button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddRoot(true)}
                            className="border border-dashed border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-400 hover:border-slate-500 transition-all flex items-center gap-1"
                        >
                            <Plus size={14} /> Add Category
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CategoryTreeView;
