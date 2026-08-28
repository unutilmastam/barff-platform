import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderThemeCss } from '../src/theme.js';

const target = fileURLToPath(new URL('../theme.css', import.meta.url));
writeFileSync(target, renderThemeCss(), 'utf8');
console.info(`Wrote ${target}`);
