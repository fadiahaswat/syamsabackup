const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const auditResults = {
    fixedDimensions: [], 
    flexWithoutGap: [], 
    gridWithoutResponsive: [], 
    missingFlexShrinkIcon: []
};

walkDir(srcDir, (filePath) => {
    const ext = path.extname(filePath);
    if (ext !== '.html' && ext !== '.js' && ext !== '.css') return;

    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');

    // 1. Audit Fixed Pixel Dimensions
    const fixedWidthRegex = /w-\[\d+px\]|style=["'][^"']*width:\s*\d+px/gi;
    const fixedHeightRegex = /h-\[\d+px\]|style=["'][^"']*height:\s*\d+px/gi;
    let match;
    while ((match = fixedWidthRegex.exec(content)) !== null) {
        auditResults.fixedDimensions.push({
            file: relativePath,
            match: match[0],
            line: content.substring(0, match.index).split('\n').length
        });
    }
    while ((match = fixedHeightRegex.exec(content)) !== null) {
        auditResults.fixedDimensions.push({
            file: relativePath,
            match: match[0],
            line: content.substring(0, match.index).split('\n').length
        });
    }

    // 2. Audit HTML-specific classes
    if (ext === '.html') {
        const classRegex = /class=["']([^"']+)["']/gi;
        while ((match = classRegex.exec(content)) !== null) {
            const classList = match[1];
            const classes = classList.split(/\s+/);
            const isFlex = classes.includes('flex') || classes.includes('inline-flex');
            const hasGap = classes.some(c => c.startsWith('gap-'));
            
            // Check for flex layouts without gap
            if (isFlex && !hasGap) {
                // Ignore layouts with very simple single children or standard flex items that don't need gap
                // but flag it for review
                auditResults.flexWithoutGap.push({
                    file: relativePath,
                    classes: classList,
                    line: content.substring(0, match.index).split('\n').length
                });
            }

            // Check grid without responsive design
            const isGrid = classes.includes('grid');
            const hasGridCols = classes.some(c => c.startsWith('grid-cols-'));
            const hasResponsiveGrid = classes.some(c => c.match(/^(sm|md|lg|xl):grid-cols-/));
            if (isGrid && hasGridCols && !hasResponsiveGrid) {
                // If it's 1-column grid or simple layout, maybe it's fine, but let's flag cols > 1
                const colsMatch = classList.match(/grid-cols-(\d+)/);
                const cols = colsMatch ? parseInt(colsMatch[1], 10) : 1;
                if (cols > 1) {
                    auditResults.gridWithoutResponsive.push({
                        file: relativePath,
                        classes: classList,
                        line: content.substring(0, match.index).split('\n').length
                    });
                }
            }
        }

        // Check for Lucide icons inside flex blocks that might need flex-shrink-0
        const iconRegex = /<i\s+[^>]*class=["']([^"']*)["'][^>]*data-lucide/gi;
        while ((match = iconRegex.exec(content)) !== null) {
            const classes = match[1].split(/\s+/);
            if (!classes.includes('flex-shrink-0') && !classes.includes('shrink-0')) {
                auditResults.missingFlexShrinkIcon.push({
                    file: relativePath,
                    match: match[0],
                    line: content.substring(0, match.index).split('\n').length
                });
            }
        }
    }
});

// Write Markdown Report
let md = `# Audit Autolayout & Responsive Spacing\n\n`;
md += `Tanggal Audit: ${new Date().toISOString().split('T')[0]}\n\n`;

md += `## 1. Fixed Pixel Dimensions (Lebar/Tinggi Tetap)\n`;
md += `Penggunaan ukuran piksel tetap (\`w-[...px]\` atau inline style) dapat merusak sifat responsif dari Autolayout.\n\n`;
if (auditResults.fixedDimensions.length === 0) {
    md += `*Tidak ditemukan pelanggaran ukuran tetap.*\n\n`;
} else {
    md += `| File | Baris | Kode / Kelas |\n`;
    md += `| --- | --- | --- |\n`;
    auditResults.fixedDimensions.forEach(item => {
        md += `| [${path.basename(item.file)}](file:///${path.resolve(__dirname, '..', item.file).replace(/\\/g, '/')}) | ${item.line} | \`${item.match}\` |\n`;
    });
    md += `\n`;
}

md += `## 2. Grid Tanpa Responsivitas (\`grid-cols-X\` Tanpa Breakpoint)\n`;
md += `Grid layout dengan beberapa kolom yang tidak menyesuaikan jumlah kolomnya di layar kecil (mobile) dapat menyebabkan konten terpotong atau terlalu sempit.\n\n`;
if (auditResults.gridWithoutResponsive.length === 0) {
    md += `*Tidak ditemukan grid non-responsif.*\n\n`;
} else {
    md += `| File | Baris | Kelas Grid |\n`;
    md += `| --- | --- | --- |\n`;
    auditResults.gridWithoutResponsive.forEach(item => {
        md += `| [${path.basename(item.file)}](file:///${path.resolve(__dirname, '..', item.file).replace(/\\/g, '/')}) | ${item.line} | \`${item.classes}\` |\n`;
    });
    md += `\n`;
}

md += `## 3. Flexbox Tanpa Spacing Gap (\`flex\` Tanpa \`gap-X\`)\n`;
md += `Penggunaan flexbox tanpa gap memaksa developer menggunakan margin manual di setiap child element. Direkomendasikan menggunakan kelas \`gap\` pada parent untuk pengelolaan jarak yang lebih konsisten.\n\n`;
if (auditResults.flexWithoutGap.length === 0) {
    md += `*Tidak ditemukan flexbox tanpa gap.*\n\n`;
} else {
    md += `| File | Baris | Kelas Flex |\n`;
    md += `| --- | --- | --- |\n`;
    // Limit output to top 30 to keep report clean
    const items = auditResults.flexWithoutGap.slice(0, 40);
    items.forEach(item => {
        md += `| [${path.basename(item.file)}](file:///${path.resolve(__dirname, '..', item.file).replace(/\\/g, '/')}) | ${item.line} | \`${item.classes}\` |\n`;
    });
    if (auditResults.flexWithoutGap.length > 40) {
        md += `| ... | ... | *(Total ${auditResults.flexWithoutGap.length} temuan)* |\n`;
    }
    md += `\n`;
}

md += `## 4. Icon di Flexbox Tanpa \`shrink-0\` / \`flex-shrink-0\`\n`;
md += `Ikon di dalam container flexbox sering terdistorsi (menyusut) saat teks di sebelahnya terlalu panjang jika tidak diberi kelas \`shrink-0\`.\n\n`;
if (auditResults.missingFlexShrinkIcon.length === 0) {
    md += `*Semua ikon sudah menggunakan shrink-0.*\n\n`;
} else {
    md += `| File | Baris | Tag Ikon |\n`;
    md += `| --- | --- | --- |\n`;
    const items = auditResults.missingFlexShrinkIcon.slice(0, 40);
    items.forEach(item => {
        md += `| [${path.basename(item.file)}](file:///${path.resolve(__dirname, '..', item.file).replace(/\\/g, '/')}) | ${item.line} | \`${item.match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\` |\n`;
    });
    if (auditResults.missingFlexShrinkIcon.length > 40) {
        md += `| ... | ... | *(Total ${auditResults.missingFlexShrinkIcon.length} temuan)* |\n`;
    }
    md += `\n`;
}

fs.writeFileSync(path.join(__dirname, '..', 'AUDIT-AUTOLAYOUT.md'), md, 'utf8');
console.log('Audit completed. Saved to AUDIT-AUTOLAYOUT.md');
