const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../../../frontend/src');

function searchDir(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('type') && content.includes('transcript')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('transcript') || line.includes('isFinal') || line.includes('text')) {
            console.log(`${file}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

searchDir(srcDir);
