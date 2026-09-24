import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    base: './',
    build: {
        target: 'esnext',
        minify: false,
        outDir: 'dist',
    },
    plugins: [
        {
            name: 'copy-package-json',
            closeBundle() {
                const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
                // Clean dev dependencies for output
                delete pkg.devDependencies;
                delete pkg.scripts;
                pkg.main = 'index.html';
                if (!pkg.logseq) {
                    pkg.logseq = {};
                }
                pkg.logseq.icon = './icon.png';
                fs.writeFileSync(
                    path.resolve(__dirname, 'dist/package.json'),
                    JSON.stringify(pkg, null, 2)
                );
                if (fs.existsSync('icon.png')) {
                    fs.copyFileSync('icon.png', path.resolve(__dirname, 'dist/icon.png'));
                }
            },
        },
    ],
});