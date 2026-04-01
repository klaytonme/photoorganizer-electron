import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PathEntry() {
	const router = useRouter();
	const [pathValue, setPathValue] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const inputRef = useRef(null);

	useEffect(() => {
		inputRef.current?.focus();
		// Pick up error passed from organizer
		const err = sessionStorage.getItem('pathError');
		if (err) { setError(errorMessage(err)); sessionStorage.removeItem('pathError'); }
	}, []);

	function errorMessage(code) {
		if (code === 'dne') return 'No "raw" subfolder found at this path.';
		if (code === 'dir') return 'Path is not a directory.';
		return 'Unknown error.';
	}

	async function handleBrowse() {
		const selected = await window.api.selectFolder();
		if (selected) { setPathValue(selected); setError(''); }
	}

	async function handleSubmit() {
		if (!pathValue.trim()) return;
		setLoading(true);
		setError('');
		const result = await window.api.submitPath(pathValue.trim());
		setLoading(false);
		if (!result.ok) {
			setError(errorMessage(result.error));
		} else {
			sessionStorage.setItem('activePath', pathValue.trim());
			router.push('/organizer');
		}
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter') handleSubmit();
	}

	return (
		<div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-0 relative overflow-hidden">

			{/* Subtle background texture */}
			<div className="absolute inset-0 opacity-[0.03]"
				style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '32px 32px' }} />

			{/* Glow orb */}
			<div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
				style={{ background: 'radial-gradient(circle, rgba(232,213,176,0.06) 0%, transparent 70%)' }} />

			{/* Drag region for macOS titlebar */}
			<div className="drag-region absolute top-0 left-0 right-0 h-8" />

			<div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-8">

				{/* Logo / title */}
				<div className="flex flex-col items-center gap-2">
					<div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
						style={{ background: 'linear-gradient(135deg, #e8d5b0 0%, #a89060 100%)' }}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<polyline points="21 15 16 10 5 21" />
						</svg>
					</div>
					<h1 className="font-display text-3xl text-accent tracking-tight">Sorter</h1>
					<p className="font-sans text-sm text-neutral-500 tracking-wide">keyboard-driven photo organization</p>
				</div>

				{/* Input area */}
				<div className="w-full flex flex-col gap-3">
					<label className="font-mono text-xs text-neutral-500 uppercase tracking-widest">Photo Folder</label>

					<div className="flex gap-2">
						<input
							ref={inputRef}
							type="text"
							value={pathValue}
							onChange={e => { setPathValue(e.target.value); setError(''); }}
							onKeyDown={handleKeyDown}
							placeholder="/Users/you/Pictures/Tokyo"
							className="flex-1 h-12 px-4 rounded-lg font-mono text-sm outline-none transition-all duration-200"
							style={{
								background: '#1a1a1a',
								border: `1px solid ${error ? '#f87171' : pathValue ? '#e8d5b0' : '#2e2e2e'}`,
								color: '#e5e5e5',
								boxShadow: error ? '0 0 0 3px rgba(248,113,113,0.1)' : pathValue ? '0 0 0 3px rgba(232,213,176,0.08)' : 'none',
							}}
						/>
						<button
							onClick={handleBrowse}
							className="no-drag h-12 px-4 rounded-lg font-sans text-sm font-medium transition-all duration-150 flex items-center gap-2"
							style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#a0a0a0' }}
							onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#e5e5e5'; }}
							onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#a0a0a0'; }}
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
							</svg>
							Browse
						</button>
					</div>

					{/* Hint */}
					<p className="font-mono text-xs text-neutral-600">
						Expects a <span className="text-neutral-400">raw/</span> subfolder containing your photos
					</p>

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-sans"
							style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							{error}
						</div>
					)}

					{/* Submit */}
					<button
						onClick={handleSubmit}
						disabled={!pathValue.trim() || loading}
						className="no-drag w-full h-12 rounded-lg font-sans text-sm font-semibold transition-all duration-150 mt-1 flex items-center justify-center gap-2"
						style={{
							background: pathValue.trim() && !loading ? 'linear-gradient(135deg, #e8d5b0 0%, #c4a96a 100%)' : '#1a1a1a',
							color: pathValue.trim() && !loading ? '#0a0a0a' : '#444',
							border: '1px solid transparent',
							cursor: pathValue.trim() && !loading ? 'pointer' : 'not-allowed',
						}}
					>
						{loading ? (
							<>
								<svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
									<path d="M21 12a9 9 0 1 1-6.219-8.56" />
								</svg>
								Loading…
							</>
						) : 'Open folder →'}
					</button>
				</div>

				{/* Keyboard hint */}
				<div className="flex items-center gap-3 text-neutral-600 text-xs font-mono">
					<span className="px-2 py-1 rounded" style={{ background: '#1a1a1a', border: '1px solid #2e2e2e' }}>↵ enter</span>
					<span>to open</span>
				</div>
			</div>
		</div>
	);
}