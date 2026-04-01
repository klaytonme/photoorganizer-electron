import { useState, useEffect, useRef } from 'react';

const RESERVED_KEYS = ['Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', ' '];
const PRESET_COLORS = ['#f472b6', '#60a5fa', '#facc15', '#4ade80', '#fb923c', '#a78bfa', '#34d399', '#f87171'];

export default function TagSettingsModal({ isOpen, onClose, tags, onSave }) {
	const [localTags, setLocalTags] = useState([]);
	const [editingKey, setEditingKey] = useState(null); // index of tag being rebound
	const [errors, setErrors] = useState({});

	useEffect(() => {
		if (isOpen) setLocalTags(tags.map(t => ({ ...t })));
	}, [isOpen, tags]);

	function updateTag(idx, field, value) {
		setLocalTags(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
		setErrors(prev => { const n = { ...prev }; delete n[`${idx}-${field}`]; return n; });
	}

	function handleKeyCapture(e, idx) {
		e.preventDefault();
		const key = e.key;
		if (RESERVED_KEYS.includes(key)) return;
		if (key.length > 1) return; // ignore modifier-only etc
		// Check uniqueness
		const conflict = localTags.findIndex((t, i) => i !== idx && t.key === key);
		if (conflict >= 0) {
			setErrors(prev => ({ ...prev, [`${idx}-key`]: `"${key}" already used by ${localTags[conflict].label}` }));
		} else {
			updateTag(idx, 'key', key);
			setErrors(prev => { const n = { ...prev }; delete n[`${idx}-key`]; return n; });
		}
		setEditingKey(null);
	}

	function addTag() {
		setLocalTags(prev => [...prev, {
			id: `tag_${Date.now()}`,
			key: '',
			label: 'New Tag',
			folder: 'New Tag',
			color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
		}]);
	}

	function removeTag(idx) {
		setLocalTags(prev => prev.filter((_, i) => i !== idx));
	}

	function validate() {
		const errs = {};
		localTags.forEach((t, i) => {
			if (!t.key) errs[`${i}-key`] = 'Required';
			if (!t.label.trim()) errs[`${i}-label`] = 'Required';
			if (!t.folder.trim()) errs[`${i}-folder`] = 'Required';
		});
		setErrors(errs);
		return Object.keys(errs).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		onSave(localTags);
		onClose();
	}

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
			<div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
				style={{ background: '#111', border: '1px solid #2e2e2e', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>

				{/* Header */}
				<div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: '#1e1e1e' }}>
					<div>
						<h2 className="font-display text-xl text-accent">Tag Settings</h2>
						<p className="font-mono text-xs text-neutral-500 mt-0.5">configure tags, keybinds, and folders</p>
					</div>
					<button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
						style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#666' }}
						onMouseEnter={e => e.currentTarget.style.color = '#e5e5e5'}
						onMouseLeave={e => e.currentTarget.style.color = '#666'}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				{/* Reserved keys note */}
				<div className="px-6 py-3 border-b flex items-center gap-2 text-xs font-mono text-neutral-500"
					style={{ borderColor: '#1e1e1e', background: '#0d0d0d' }}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
					Reserved: <span className="text-neutral-400">Enter</span> (confirm) · <span className="text-neutral-400">Backspace</span> (trash) · <span className="text-neutral-400">←→</span> (grid)
				</div>

				{/* Tag list */}
				<div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
					{localTags.map((tag, idx) => (
						<TagRow
							key={tag.id}
							tag={tag}
							idx={idx}
							errors={errors}
							editingKey={editingKey}
							setEditingKey={setEditingKey}
							onUpdate={updateTag}
							onRemove={removeTag}
							onKeyCapture={handleKeyCapture}
							presetColors={PRESET_COLORS}
						/>
					))}

					<button onClick={addTag}
						className="w-full h-10 rounded-xl font-sans text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 mt-1"
						style={{ background: '#1a1a1a', border: '1px dashed #2e2e2e', color: '#666' }}
						onMouseEnter={e => { e.currentTarget.style.borderColor = '#e8d5b0'; e.currentTarget.style.color = '#e8d5b0'; }}
						onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#666'; }}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						Add tag
					</button>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#1e1e1e' }}>
					<button onClick={onClose}
						className="h-9 px-5 rounded-lg font-sans text-sm font-medium transition-colors"
						style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888' }}
						onMouseEnter={e => e.currentTarget.style.color = '#e5e5e5'}
						onMouseLeave={e => e.currentTarget.style.color = '#888'}>
						Cancel
					</button>
					<button onClick={handleSave}
						className="h-9 px-5 rounded-lg font-sans text-sm font-semibold transition-all duration-150"
						style={{ background: 'linear-gradient(135deg, #e8d5b0 0%, #c4a96a 100%)', color: '#0a0a0a' }}>
						Save changes
					</button>
				</div>
			</div>
		</div>
	);
}


function TagRow({ tag, idx, errors, editingKey, setEditingKey, onUpdate, onRemove, onKeyCapture, presetColors }) {
	const keyBtnRef = useRef(null);

	return (
		<div className="rounded-xl p-4 flex flex-col gap-3"
			style={{ background: '#1a1a1a', border: `1px solid ${errors[`${idx}-key`] || errors[`${idx}-label`] ? '#f87171' : '#242424'}` }}>

			<div className="flex items-center gap-3">
				{/* Color swatch */}
				<div className="relative group">
					<div className="w-7 h-7 rounded-lg cursor-pointer ring-2 ring-transparent hover:ring-white/20 transition-all"
						style={{ background: tag.color }} />
					<div className="absolute left-0 top-9 z-10 hidden group-hover:flex flex-wrap gap-1 p-2 rounded-xl shadow-xl"
						style={{ background: '#111', border: '1px solid #2e2e2e', width: '116px' }}>
						{presetColors.map(c => (
							<button key={c} onClick={() => onUpdate(idx, 'color', c)}
								className="w-6 h-6 rounded-md transition-transform hover:scale-110"
								style={{ background: c, outline: c === tag.color ? '2px solid white' : 'none', outlineOffset: '1px' }} />
						))}
					</div>
				</div>

				{/* Label */}
				<input type="text" value={tag.label}
					onChange={e => onUpdate(idx, 'label', e.target.value)}
					placeholder="Tag name"
					className="flex-1 h-8 px-3 rounded-lg font-sans text-sm outline-none transition-all"
					style={{ background: '#111', border: `1px solid ${errors[`${idx}-label`] ? '#f87171' : '#2e2e2e'}`, color: '#e5e5e5' }} />

				{/* Keybind capture */}
				<div className="relative">
					{editingKey === idx ? (
						<button ref={keyBtnRef} autoFocus
							onKeyDown={e => onKeyCapture(e, idx)}
							onBlur={() => setEditingKey(null)}
							className="w-10 h-8 rounded-lg font-mono text-sm font-bold flex items-center justify-center animate-pulse"
							style={{ background: '#e8d5b0', color: '#0a0a0a', border: '2px solid #e8d5b0' }}>
							?
						</button>
					) : (
						<button onClick={() => { setEditingKey(idx); setTimeout(() => keyBtnRef.current?.focus(), 0); }}
							className="w-10 h-8 rounded-lg font-mono text-sm font-bold flex items-center justify-center transition-all"
							style={{
								background: tag.key ? '#242424' : '#1a1a1a',
								border: `1px solid ${errors[`${idx}-key`] ? '#f87171' : tag.key ? tag.color + '80' : '#2e2e2e'}`,
								color: tag.key ? tag.color : '#444',
							}}>
							{tag.key || '·'}
						</button>
					)}
				</div>

				{/* Remove */}
				<button onClick={() => onRemove(idx)}
					className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
					style={{ background: '#111', border: '1px solid #2e2e2e', color: '#444' }}
					onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
					onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#444'; }}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
						<polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
					</svg>
				</button>
			</div>

			{/* Folder name */}
			<div className="flex items-center gap-2">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className="flex-shrink-0">
					<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				</svg>
				<input type="text" value={tag.folder}
					onChange={e => onUpdate(idx, 'folder', e.target.value)}
					placeholder="Output folder name"
					className="flex-1 h-7 px-2 rounded-lg font-mono text-xs outline-none transition-all"
					style={{ background: '#111', border: `1px solid ${errors[`${idx}-folder`] ? '#f87171' : '#1e1e1e'}`, color: '#888' }} />
			</div>

			{/* Inline errors */}
			{(errors[`${idx}-key`] || errors[`${idx}-label`]) && (
				<p className="text-xs font-mono" style={{ color: '#f87171' }}>
					{errors[`${idx}-key`] || errors[`${idx}-label`]}
				</p>
			)}
		</div>
	);
}