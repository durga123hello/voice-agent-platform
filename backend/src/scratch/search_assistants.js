const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        search(fullPath);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('assistants') || content.includes('v1/assistants')) {
          console.log(`Found in: ${fullPath}`);
        }
      }
    }
  }
}

search(path.join(__dirname, '../..'));
