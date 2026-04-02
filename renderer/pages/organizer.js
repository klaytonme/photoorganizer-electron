import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import TagSettingsModal from '../components/TagSettingsModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_SLOTS = 9; // max simultaneous views

// Grid layout per number of visible photos
const GRID_LAYOUTS = {
	1: { rows: 1, cols: 1 },
	2: { rows: 1, cols: 2 },
	3: { rows: 1, cols: 3 },
	4: { rows: 2, cols: 2 },
	5: { rows: 2, cols: 3 },
	6: { rows: 2, cols: 3 },
	7: { rows: 3, cols: 3 },
	8: { rows: 3, cols: 3 },
	9: { rows: 3, cols: 3 },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Organizer() {
	const router = useRouter();

	// Core data
	const [imageData, setImageData] = useState([]); // all loaded images
	const [loadedConfig, setLoadedConfig] = useState([]); // from config.json
	const [tags, setTags] = useState([]);
	const [loadingDone, setLoadingDone] = useState(false);
	const [loadingStatus, setLoadingStatus] = useState('Initializing…');

	// View state
	const [imagesViewed, setImagesViewed] = useState([]); // imageData indices currently in grid
	const [viewsSelected, setViewsSelected] = useState([]); // grid slot indices selected
	const [lastThumbIdx, setLastThumbIdx] = useState(0);
	const [zoom, setZoom] = useState(1);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	// UI state
	const [showTagModal, setShowTagModal] = useState(false);
	const [saving, setSaving] = useState(false);
	const [organizing, setOrganizing] = useState(false);
	const [toast, setToast] = useState(null);

	const thumbRowRef = useRef(null);
	const imageDataRef = useRef(imageData);
	const tagsRef = useRef(tags);

	useEffect(() => { imageDataRef.current = imageData; }, [imageData]);
	useEffect(() => { tagsRef.current = tags; }, [tags]);

	// ── Init ────────────────────────────────────────────────────────────────────

	useEffect(() => {
		async function init() {
			await window.api.reload();
			const tagConfig = await window.api.getTagConfig();
			setTags(tagConfig);

			const config = await window.api.loadData();
			setLoadedConfig(config);

			setLoadingStatus('Loading images…');
			loadImages(config);
		}
		init();
	}, []);

	async function loadImages(existingConfig) {
		let first = true;
		while (true) {
			const data = await window.api.loadImage();

			if (data.code === 'dne' || data.code === 'dir') {
				sessionStorage.setItem('pathError', data.code);
				router.push('/');
				return;
			}

			if (data.code === 'end') break;

			const existing = (existingConfig || loadedConfig).find(e => e.name === data.name);

			const newImg = {
				name: data.name,
				data: data.dat,
				tags: existing ? existing.tags : '',
			};

			setImageData(prev => {
				const next = [...prev, newImg];
				if (first) {
					setImagesViewed([next.length - 1]);
					setLastThumbIdx(next.length - 1);
					first = false;
				}
				return next;
			});

			setLoadingStatus(`Loaded ${data.name}`);
		}

		setLoadingDone(true);
		showToast('All photos loaded');
	}

	// ── Tag helpers ──────────────────────────────────────────────────────────────

	function hasTag(imgIdx, key) {
		return imageDataRef.current[imgIdx]?.tags.includes(key) ?? false;
	}

	function toggleTag(imgIdx, key) {
		setImageData(prev => prev.map((img, i) => {
			if (i !== imgIdx) return img;
			const tags = img.tags.includes(key)
				? img.tags.replace(key, '')
				: img.tags + key;
			return { ...img, tags };
		}));
	}

	// ── View management ──────────────────────────────────────────────────────────

	function addView(refId) {
		setImagesViewed(prev => {
			if (prev.length >= GRID_SLOTS) return prev;
			if (prev.includes(refId)) return prev;
			if (refId >= imageDataRef.current.length) return prev;
			return [...prev, refId];
		});
	}

	function removeView(refId) {
		setImagesViewed(prev => {
			if (prev.length <= 1) return prev;
			return prev.filter(id => id !== refId);
		});
	}

	function addNextView() {
		setImagesViewed(prev => {
			if (prev.length >= GRID_SLOTS) return prev;
			let next = lastThumbIdx;
			while (prev.includes(next)) next++;
			if (next >= imageDataRef.current.length) return prev;
			return [...prev, next];
		});
	}

	function removeLastView() {
		setImagesViewed(prev => {
			if (prev.length <= 1) return prev;
			if (viewsSelected.length > 0) {
				const toRemoveSlot = viewsSelected[viewsSelected.length - 1];
				const toRemoveId = prev[toRemoveSlot];
				if (toRemoveId == null) return prev;
				setViewsSelected(vs => vs.filter(s => s !== toRemoveSlot));
				return prev.filter(id => id !== toRemoveId);
			}
			return prev.slice(0, -1);
		});
	}

	// ── Keyboard handler ─────────────────────────────────────────────────────────

	const handleKeyDown = useCallback((e) => {
		if (showTagModal) return;

		const iv = imageDataRef.current;
		const currentViewed = imagesViewed;

		if (e.key === 'ArrowRight') { e.preventDefault(); addNextView(); return; }
		if (e.key === 'ArrowLeft') { e.preventDefault(); removeLastView(); return; }

		// Tag keys
		const currentTags = tagsRef.current;
		const tagKey = currentTags.find(t => t.key === e.key);
		const isTrash = e.key === 'Backspace';

		if (tagKey || isTrash) {
			e.preventDefault();
			const key = isTrash ? 't' : tagKey.key;
			const targets = viewsSelected.length > 0
				? viewsSelected.map(slot => currentViewed[slot]).filter(id => id != null)
				: currentViewed;

			targets.forEach(imgIdx => toggleTag(imgIdx, key));
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();

			const viewed = [...imagesViewed];

			// Build confirmed set including what we are about to confirm.
			// Cannot rely on imageDataRef since setImageData hasn't flushed yet.
			const confirmedAfter = new Set(
				imageDataRef.current
					.map((img, i) => img.tags.includes('c') ? i : null)
					.filter(i => i !== null)
			);
			viewed.forEach(i => confirmedAfter.add(i));

			// Mark all viewed as confirmed
			viewed.forEach(imgIdx => {
				if (!hasTag(imgIdx, 'c')) toggleTag(imgIdx, 'c');
			});

			// Find next unconfirmed using pre-computed set
			const nextIdx = imageDataRef.current.findIndex((_, i) => !confirmedAfter.has(i));

			if (nextIdx === -1) {
				showToast('All photos reviewed! Hit Save or Organize.');
				return;
			}

			setImagesViewed([nextIdx]);
			setViewsSelected([]);
			setLastThumbIdx(nextIdx);
			setZoom(1);

			// Scroll thumbnail into view
			setTimeout(() => {
				const row = thumbRowRef.current;
				const thumb = row?.querySelector(`[data-refid="${nextIdx}"]`);
				if (thumb && row) {
					const offset = thumb.getBoundingClientRect().left - row.getBoundingClientRect().left;
					row.scrollBy({ left: offset - 10, behavior: 'smooth' });
				}
			}, 50);

			return;
		}
	}, [showTagModal, imagesViewed, viewsSelected]);

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	// ── Mouse ────────────────────────────────────────────────────────────────────

	useEffect(() => {
		function onMove(e) {
			setMousePos({ x: (2 * e.clientX / window.innerWidth), y: (2 * e.clientY / window.innerHeight) });
		}
		function onWheel(e) {
			const rect = thumbRowRef.current?.getBoundingClientRect();
			if (rect && e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) return;
			setZoom(prev => {
				const next = prev + e.deltaY * -0.001;
				return Math.max(0.5, Math.min(4, next));
			});
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('wheel', onWheel, { passive: true });
		return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('wheel', onWheel); };
	}, []);

	// ── Save / Organize ───────────────────────────────────────────────────────────

	function buildConfig() {
		const config = imageData.map(img => ({ name: img.name, tags: img.tags }));
		for (const entry of loadedConfig) {
			if (!config.find(i => i.name === entry.name)) config.push(entry);
		}
		return config;
	}

	async function handleSave() {
		setSaving(true);
		await window.api.saveData(buildConfig());
		setSaving(false);
		showToast('Saved!');
	}

	async function handleOrganize() {
		setOrganizing(true);
		await window.api.saveData(buildConfig());
		await window.api.organizeImages(buildConfig());
		setOrganizing(false);
		showToast('Photos organized into folders!');
	}

	async function handleSaveTags(newTags) {
		await window.api.setTagConfig(newTags);
		setTags(newTags);
		showToast('Tag settings saved');
	}

	function showToast(msg) {
		setToast(msg);
		setTimeout(() => setToast(null), 2500);
	}

	// ── Layout ────────────────────────────────────────────────────────────────────

	const visibleCount = imagesViewed.length;
	const layout = GRID_LAYOUTS[Math.max(1, Math.min(visibleCount, 9))];

	// ── Render ────────────────────────────────────────────────────────────────────

	return (
		<div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: '#0a0a0a' }}>

			{/* Header - is the drag region; interactive children use no-drag */}
			<div className="drag-region flex items-center gap-3 px-5 py-2 flex-shrink-0 z-20"
				style={{ background: '#0f0f0f', borderBottom: '1px solid #1e1e1e' }}>

				{/* Logo - left-padded to clear macOS traffic lights (~70px) */}
				<div className="no-drag flex items-center gap-2 mr-4" style={{ paddingLeft: '65px' }}>
					<div className="w-6 h-6 rounded-md flex items-center justify-center"
						style={{ background: 'linear-gradient(135deg, #e8d5b0 0%, #a89060 100%)' }}>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
						</svg>
					</div>
					<span className="font-display text-sm text-accent">Sorter</span>
				</div>

				<div className="flex-1" />

				{/* Tag pills */}
				<div className="no-drag flex items-center gap-2">
					{tags.map(tag => (
						<Tooltip label={tag.label}>
							<div key={tag.id} className="tag-pill" style={{ borderColor: tag.color + '40', color: tag.color }}>
								<kbd className="font-mono text-[12px]">{tag.key}</kbd>
								{/* <span>{tag.label}</span> */}
							</div>
						</Tooltip>
					))}
					<Tooltip label="Trash">
						<div className="tag-pill" style={{ borderColor: '#f8717140', color: '#f87171' }}>
							<kbd className="font-mono text-[12px]">⌫</kbd>
							{/* <span>Trash</span> */}
						</div>
					</Tooltip>
				</div>

				<div className="flex-1" />

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					<HeaderBtn onClick={() => setShowTagModal(true)} title="Tag Settings">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
						</svg>
						Tags
					</HeaderBtn>
					<HeaderBtn onClick={handleSave} loading={saving} title="Save">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
						</svg>
						{saving ? 'Saving…' : 'Save'}
					</HeaderBtn>
					<HeaderBtn onClick={handleOrganize} loading={organizing} accent title="Organize">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
						</svg>
						{organizing ? 'Organizing…' : 'Organize'}
					</HeaderBtn>
				</div>
			</div>

			{/* Main grid */}
			<div className="flex-1 overflow-hidden p-3 pb-0">
				<PhotoGrid
					imagesViewed={imagesViewed}
					viewsSelected={viewsSelected}
					imageData={imageData}
					tags={tags}
					layout={layout}
					zoom={zoom}
					mousePos={mousePos}
					onToggleSelect={(slotIdx) => {
						setViewsSelected(prev =>
							prev.includes(slotIdx) ? prev.filter(s => s !== slotIdx) : [...prev, slotIdx]
						);
					}}
				/>
			</div>

			{/* Thumbnail strip */}
			<div className="flex-shrink-0 px-3 pb-3 pt-2">
				<div ref={thumbRowRef}
					className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar"
					style={{ height: '90px', background: '#0f0f0f', borderRadius: '12px', padding: '8px', border: '1px solid #1e1e1e' }}>
					{imageData.map((img, idx) => (
						<ThumbCard
							key={idx}
							img={img}
							idx={idx}
							tags={tags}
							isViewed={imagesViewed.includes(idx)}
							onClick={() => {
								if (imagesViewed.includes(idx)) removeView(idx);
								else { addView(idx); setLastThumbIdx(idx); }
							}}
						/>
					))}
					{!loadingDone && (
						<div className="flex-shrink-0 flex items-center gap-2 px-3 text-xs font-mono text-neutral-600">
							<div className="w-3 h-3 rounded-full border border-neutral-600 border-t-transparent animate-spin" />
							{loadingStatus}
						</div>
					)}
				</div>
			</div>

			{/* Keyboard hints bar */}
			<div className="flex-shrink-0 flex items-center justify-center gap-4 pb-2 text-xs font-mono text-neutral-700">
				<KbdHint keys={['←', '→']} label="add/remove view" />
				<KbdHint keys={['↵']} label="confirm & next" />
				<KbdHint keys={['⌫']} label="trash" />
				<KbdHint keys={['scroll']} label="zoom" />
			</div>

			{/* Toast */}
			{toast && (
				<div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-sans z-50 pointer-events-none"
					style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#e5e5e5', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
					{toast}
				</div>
			)}

			{/* Tag settings modal */}
			<TagSettingsModal
				isOpen={showTagModal}
				onClose={() => setShowTagModal(false)}
				tags={tags}
				onSave={handleSaveTags}
			/>
		</div>
	);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PhotoGrid({ imagesViewed, viewsSelected, imageData, tags, layout, zoom, mousePos, onToggleSelect }) {
	const { rows, cols } = layout;

	return (
		<div className="h-full w-full flex flex-col gap-2"
			style={{ display: 'grid', gridTemplateRows: `repeat(${rows}, 1fr)`, gap: '8px' }}>
			{Array.from({ length: rows }).map((_, rowIdx) => (
				<div key={rowIdx} className="flex gap-2" style={{ minHeight: 0 }}>
					{Array.from({ length: cols }).map((_, colIdx) => {
						const slotIdx = rowIdx * cols + colIdx;
						const imgIdx = imagesViewed[slotIdx];
						if (imgIdx == null) return <div key={colIdx} className="flex-1" />;
						const img = imageData[imgIdx];
						if (!img) return <div key={colIdx} className="flex-1" />;
						const isSelected = viewsSelected.includes(slotIdx);

						return (
							<div key={colIdx}
								className="flex-1 relative rounded-xl overflow-hidden cursor-pointer transition-all duration-100"
								style={{
									border: `2px solid ${isSelected ? '#4ade80' : '#1e1e1e'}`,
									boxShadow: isSelected ? '0 0 0 2px rgba(74,222,128,0.2)' : 'none',
									minHeight: 0,
								}}
								onClick={() => onToggleSelect(slotIdx)}>

								{/* Photo */}
								<PhotoImage img={img} zoom={zoom} mousePos={mousePos} />

								{/* Tag indicators */}
								<TagBadges img={img} tags={tags} />

								{/* Confirmed check */}
								{img.tags.includes('c') && (
									<div className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
										style={{ background: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.5)' }}>
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</div>
								)}

								{/* Selected overlay */}
								{isSelected && <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(74,222,128,0.06)' }} />}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}


function PhotoImage({ img, zoom, mousePos }) {
	const containerRef = useRef(null);
	const imgRef = useRef(null);

	useEffect(() => {
		const container = containerRef.current;
		const image = imgRef.current;
		if (!container || !image) return;

		const containerAR = container.clientHeight / container.clientWidth;
		const imageAR = image.clientHeight / image.clientWidth;

		if (containerAR < imageAR) {
			image.style.width = `${100 * zoom}%`;
			image.style.height = 'auto';
		} else {
			image.style.height = `${100 * zoom}%`;
			image.style.width = 'auto';
		}

		// Center the image, then offset by mouse position (only has effect when zoomed in)
		const overflowX = Math.min(0, container.clientWidth - image.clientWidth);
		const overflowY = Math.min(0, container.clientHeight - image.clientHeight);
		const insetX = Math.max(0, (container.clientWidth - image.clientWidth) / 2);
		const insetY = Math.max(0, (container.clientHeight - image.clientHeight) / 2);
		const offsetX = insetX + overflowX * (mousePos.x / 2);
		const offsetY = insetY + overflowY * (mousePos.y / 2);

		// console.log(overflowX, overflowY, insetX, insetY);
		// console.log(insetY + overflowY * (mousePos.y / 2))

		image.style.left = `${offsetX}px`;
		image.style.top = `${offsetY}px`;
		// console.log(image.style.top);
	});

	return (
		<div ref={containerRef} className="absolute inset-0 overflow-hidden">
			<img
				ref={imgRef}
				src={`data:image/jpeg;base64,${img.data}`}
				alt={img.name}
				className="absolute max-w-none"
				draggable={false}
				style={{ transition: 'none' }}
			/>
		</div>
	);
}

function TagBadges({ img, tags }) {
	const activeTags = tags.filter(t => img.tags.includes(t.key));
	const isTrashed = img.tags.includes('t');

	if (activeTags.length === 0 && !isTrashed) return null;

	return (
		<div className="absolute top-2 left-2 flex flex-wrap gap-1 pointer-events-none">
			{activeTags.map(tag => (
				<div key={tag.key} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium"
					style={{ background: tag.color + '22', border: `1px solid ${tag.color}66`, color: tag.color }}>
					{tag.label}
				</div>
			))}
			{isTrashed && (
				<div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium"
					style={{ background: '#f8717122', border: '1px solid #f8717166', color: '#f87171' }}>
					Trash
				</div>
			)}
		</div>
	);
}

function ThumbCard({ img, idx, tags, isViewed, onClick }) {
	const activeTags = tags.filter(t => img.tags.includes(t.key));

	return (
		<div
			data-refid={idx}
			onClick={onClick}
			className="relative flex-shrink-0 h-full rounded-lg overflow-hidden cursor-pointer transition-all duration-100"
			style={{
				aspectRatio: '1 / 1',
				border: `2px solid ${isViewed ? '#4ade80' : '#1e1e1e'}`,
				boxShadow: isViewed ? '0 0 0 2px rgba(74,222,128,0.15)' : 'none',
			}}>
			<img src={`data:image/jpeg;base64,${img.data}`} alt={img.name}
				className="w-full h-full object-cover" draggable={false} />

			{/* Tag dot indicators */}
			{activeTags.length > 0 && (
				<div className="absolute bottom-1 left-1 flex gap-0.5">
					{activeTags.map(tag => (
						<div key={tag.key} className="w-2 h-2 rounded-full" style={{ background: tag.color }} />
					))}
				</div>
			)}

			{img.tags.includes('t') && (
				<div className="absolute inset-0 flex items-center justify-center"
					style={{ background: 'rgba(248,113,113,0.5)' }}>
					<svg width="16" height="16" viewBox="0 0 30 30" fill="none" strokeLinecap="round">
						<line x1="25" y1="5" x2="5" y2="25" strokeWidth="8" stroke="#ffffff" /><line x1="5" y1="5" x2="25" y2="25" strokeWidth="8" stroke="#ffffff" />
						<line x1="25" y1="5" x2="5" y2="25" strokeWidth="5" stroke="#ff4444" /><line x1="5" y1="5" x2="25" y2="25" strokeWidth="5" stroke="#ff4444" />
					</svg>
				</div>
			)}

			{img.tags.includes('c') && (
				<div className="absolute bottom-1 right-1 w-3 h-3 rounded-full flex items-center justify-center"
					style={{ background: '#4ade80' }}>
					<svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
			)}
		</div>
	);
}

function HeaderBtn({ onClick, children, loading, accent, title }) {
	return (
		<button onClick={onClick} disabled={loading} title={title}
			className="no-drag h-8 px-3 rounded-lg font-sans text-xs font-medium flex items-center gap-1.5 transition-all duration-150"
			style={accent ? {
				background: 'linear-gradient(135deg, #e8d5b0 0%, #c4a96a 100%)',
				color: '#0a0a0a',
				border: '1px solid transparent',
			} : {
				background: '#1a1a1a',
				color: '#888',
				border: '1px solid #2e2e2e',
			}}
			onMouseEnter={e => { if (!accent) e.currentTarget.style.color = '#e5e5e5'; }}
			onMouseLeave={e => { if (!accent) e.currentTarget.style.color = '#888'; }}>
			{children}
		</button>
	);
}

function KbdHint({ keys, label }) {
	return (
		<div className="flex items-center gap-1">
			{keys.map(k => (
				<kbd key={k} className="px-1.5 py-0.5 rounded font-mono text-[10px]"
					style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#555' }}>
					{k}
				</kbd>
			))}
			<span className="text-[11px]">{label}</span>
		</div>
	);
}

function Tooltip({ label, children }) {
	return (
		<div className="relative group">
			{children}
			<div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md text-xs font-sans whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
				style={{
					background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#e5e5e5',
					boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
				}}>
				{label}
				{/* Arrow */}
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0"
					style={{
						borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
						borderBottom: '4px solid #3a3a3a'
					}} />
			</div>
		</div>
	);
}