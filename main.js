const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');

const isDev = process.env.NODE_ENV === 'development';
const CONFIG_FILENAME = 'config.json';
const RAW_DIR = 'raw';

let mainWindow;
let currentPath = null;
let loadedImages = []; // tracks already-loaded image paths

// ─── Tag config (persists in userData) ───────────────────────────────────────

const DEFAULT_TAGS = [
	{ id: 'h', key: 'h', label: 'Favorites', folder: 'Favorites', color: '#f472b6' },
	{ id: 's', key: 's', label: 'Beauty Shots', folder: 'Beauty Shots', color: '#60a5fa' },
	{ id: 'f', key: 'f', label: 'Funniest', folder: 'Funniest', color: '#facc15' },
];

function getTagConfigPath() {
	return path.join(app.getPath('userData'), 'tagConfig.json');
}

function loadTagConfig() {
	const p = getTagConfigPath();
	if (fs.existsSync(p)) {
		try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { }
	}
	return DEFAULT_TAGS;
}

function saveTagConfig(tags) {
	fs.writeFileSync(getTagConfigPath(), JSON.stringify(tags, null, 2));
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 900,
		minHeight: 600,
		backgroundColor: '#0a0a0a',
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	const url = isDev
		? 'http://localhost:3000'
		: `file://${path.join(__dirname, 'renderer/out/index.html')}`;

	mainWindow.loadURL(url);
	if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Open native folder picker
ipcMain.handle('select-folder', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory'],
	});
	return result.canceled ? null : result.filePaths[0];
});

// Validate and set path
ipcMain.handle('submit-path', async (_, folderPath) => {
	const rawPath = path.join(folderPath, RAW_DIR);
	if (!fs.existsSync(rawPath)) return { ok: false, error: 'dne' };
	if (!fs.statSync(rawPath).isDirectory()) return { ok: false, error: 'dir' };
	currentPath = folderPath;
	loadedImages = [];
	return { ok: true };
});

// Reset loaded images (called on organizer mount)
ipcMain.handle('reload', async () => {
	loadedImages = [];
	return true;
});

// Load next unloaded image
ipcMain.handle('load-image', async () => {
	if (!currentPath) return { code: 'err' };
	const rawPath = path.join(currentPath, RAW_DIR);

	const EXTS = ['.png', '.jpg', '.jpeg', '.heic', '.webp'];
	let files;
	try {
		files = (await fsPromises.readdir(rawPath)).sort();
	} catch {
		return { code: 'dne' };
	}

	for (const filename of files) {
		if (!EXTS.includes(path.extname(filename).toLowerCase())) continue;
		const fullPath = path.join(rawPath, filename);
		if (loadedImages.includes(fullPath)) continue;

		try {
			// Use sharp for fast resizing + HEIC support via sharp's built-in
			const sharp = require('sharp');
			const buffer = await sharp(fullPath)
				.rotate() // auto-orient from EXIF
				.resize({ width: 1600, withoutEnlargement: true })
				.jpeg({ quality: 85 })
				.toBuffer();

			loadedImages.push(fullPath);
			return {
				code: 'ok',
				name: filename,
				dat: buffer.toString('base64'),
			};
		} catch (e) {
			console.error('Error loading image:', filename, e.message);
			return { code: 'err', name: filename };
		}
	}

	return { code: 'end' };
});

// Save config.json to photo directory
ipcMain.handle('save-data', async (_, imageData) => {
	if (!currentPath) return false;
	const configPath = path.join(currentPath, CONFIG_FILENAME);
	await fsPromises.writeFile(configPath, JSON.stringify(imageData, null, 2));
	return true;
});

// Load config.json from photo directory
ipcMain.handle('load-data', async () => {
	if (!currentPath) return [];
	const configPath = path.join(currentPath, CONFIG_FILENAME);
	if (!fs.existsSync(configPath)) return [];
	try {
		const data = JSON.parse(await fsPromises.readFile(configPath, 'utf8'));
		// Mark previously-loaded images so they're skipped in load-image
		for (const img of data) {
			const imgPath = path.join(currentPath, RAW_DIR, img.name);
			if (!loadedImages.includes(imgPath)) {
				loadedImages.push(imgPath);
			}
		}
		return data;
	} catch {
		return [];
	}
});

// Copy tagged images into folders
ipcMain.handle('organize-images', async (_, imageData) => {
	if (!currentPath) return false;
	const tags = loadTagConfig();

	// Build folder map from tag config
	const tagFolders = {};
	for (const tag of tags) {
		tagFolders[tag.key] = path.join(currentPath, tag.folder);
	}
	// "All confirmed" folder
	tagFolders['c_all'] = path.join(currentPath, 'All');

	// Create folders
	for (const folderPath of Object.values(tagFolders)) {
		await fsPromises.mkdir(folderPath, { recursive: true });
	}

	for (const image of imageData) {
		const imagePath = path.join(currentPath, RAW_DIR, image.name);
		if (!fs.existsSync(imagePath)) continue;

		// Copy to each tag folder
		for (const tag of tags) {
			if (image.tags.includes(tag.key)) {
				const dest = path.join(tagFolders[tag.key], image.name);
				if (!fs.existsSync(dest)) await fsPromises.copyFile(imagePath, dest);
			}
		}

		if (image.tags.includes('t')) continue; // trashed

		// Copy confirmed (c) to All
		if (image.tags.includes('c')) {
			const dest = path.join(tagFolders['c_all'], image.name);
			if (!fs.existsSync(dest)) await fsPromises.copyFile(imagePath, dest);
		}
	}

	return true;
});

// Tag config CRUD
ipcMain.handle('get-tag-config', () => loadTagConfig());
ipcMain.handle('set-tag-config', (_, tags) => { saveTagConfig(tags); return true; });