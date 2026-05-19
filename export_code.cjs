const fs = require('fs');
const path = require('path');

const filesToExport = [
  'index.html',
  'style.css',
  'main.js',
  'public/manifest.json',
  'public/sw.js',
  'package.json'
];

let mdContent = `# BÁO CÁO MÃ NGUỒN (SOURCE CODE) - TÍM GO V3.0\n\n`;
mdContent += `*Ngày xuất: ${new Date().toLocaleString('vi-VN')}*\n\n`;
mdContent += `---\n\n`;

filesToExport.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const ext = path.extname(filePath).replace('.', '');
    const content = fs.readFileSync(fullPath, 'utf8');
    
    let mdLang = ext;
    if (ext === 'js') mdLang = 'javascript';
    else if (ext === 'json') mdLang = 'json';
    else if (ext === 'html') mdLang = 'html';
    else if (ext === 'css') mdLang = 'css';

    mdContent += `## File: \`${filePath}\`\n\n`;
    mdContent += `\`\`\`${mdLang}\n${content}\n\`\`\`\n\n`;
  } else {
    mdContent += `## File: \`${filePath}\`\n\n`;
    mdContent += `> Không tìm thấy file.\n\n`;
  }
});

fs.writeFileSync('timgo_codebase.md', mdContent);
console.log('Thành công: Đã gộp source code vào file timgo_codebase.md');
