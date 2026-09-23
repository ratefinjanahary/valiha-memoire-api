import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Regex to find local imports and append .js if not present
  content = content.replace(/(import\s+.*?from\s+['"])(\.[^'"]+)(['"])/g, (match, p1, p2, p3) => {
    if (!p2.endsWith('.js') && !p2.endsWith('.json')) {
      return `${p1}${p2}.js${p3}`;
    }
    return match;
  });
  
  // Custom fixes
  if (file.includes('memoire.service.ts')) {
    content = content.replace("import * as pdfParse from 'pdf-parse';", "import pdfParse from 'pdf-parse';");
    content = content.replace("file: Express.Multer.File", "file: any");
  }
  if (file.includes('local-storage.service.ts')) {
    content = content.replace("file: Express.Multer.File", "file: any");
  }
  if (file.includes('storage.interface.ts')) {
    content = content.replace("file: Express.Multer.File", "file: any");
  }
  if (file.includes('memoire.controller.ts')) {
    content = content.replace("file: Express.Multer.File", "file: any");
  }
  if (file.includes('search.controller.ts')) {
    content = content.replace("import { Response } from 'express';", "import type { Response } from 'express';");
  }

  fs.writeFileSync(file, content);
});

console.log('Imports fixed!');
