/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'export',
	distDir: 'out',
	images: { unoptimized: true },
	// No basePath needed for Electron file:// loading
};

module.exports = nextConfig;