const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cmd = 'npx.cmd wrangler d1 execute checkin-daily-db --remote --command="SELECT id, category, title, summary, content FROM articles ORDER BY id;" --json';
console.log('Executing wrangler command to fetch articles...');
const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const parsed = JSON.parse(raw);
const articles = parsed[0].results;
console.log(`Successfully fetched ${articles.length} articles!`);

const outPath = path.join(__dirname, 'clean_articles.json');
fs.writeFileSync(outPath, JSON.stringify(articles, null, 2), 'utf8');
console.log(`Saved clean articles to ${outPath}`);

