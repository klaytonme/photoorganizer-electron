const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
	selectFolder: () => ipcRenderer.invoke('select-folder'),
	submitPath: (p) => ipcRenderer.invoke('submit-path', p),
	reload: () => ipcRenderer.invoke('reload'),
	loadImage: () => ipcRenderer.invoke('load-image'),
	saveData: (data) => ipcRenderer.invoke('save-data', data),
	loadData: () => ipcRenderer.invoke('load-data'),
	organizeImages: (data) => ipcRenderer.invoke('organize-images', data),
	getTagConfig: () => ipcRenderer.invoke('get-tag-config'),
	setTagConfig: (tags) => ipcRenderer.invoke('set-tag-config', tags),
});