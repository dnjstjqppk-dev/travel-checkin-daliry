// scripts/seed_full_translations.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const major = require('./translations/major.cjs');
const airline = require('./translations/airline.cjs');
const hotel = require('./translations/hotel.cjs');
const destination = require('./translations/destination.cjs');
const realtime = require('./translations/realtime.cjs');

const allTranslations = {
  ...major,
  ...airline,
  ...hotel,
  ...destination,
  ...realtime,
};

const articleIds = Object.keys(allTranslations).map(Number).sort((a, b) => a - b);
console.log(`Loaded translations for ${articleIds.length} articles.`);

// Validation: verify all 56 articles exist and have all 5 languages
const languages = ['en', 'zh', 'th', 'vi', 'es'];
const missing = [];
const invalid = [];

for (let id = 1; id <= 56; id++) {
  const trans = allTranslations[id];
  if (!trans) {
    missing.push(id);
    continue;
  }
  for (const lang of languages) {
    if (!trans[lang] || !trans[lang].title || !trans[lang].summary || !trans[lang].content) {
      invalid.push(`Article ${id} missing or incomplete in ${lang}`);
    }
  }
}

if (missing.length > 0) {
  console.error('Missing articles:', missing);
  process.exit(1);
}
if (invalid.length > 0) {
  console.error('Invalid translations:', invalid);
  process.exit(1);
}

console.log('✅ Validation passed: All 56 articles have complete translations in all 5 languages (en, zh, th, vi, es).');

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

const statements = [];

for (let id = 1; id <= 56; id++) {
  const trans = allTranslations[id];
  for (const lang of languages) {
    const item = trans[lang];
    statements.push(`INSERT INTO article_translations (article_id, lang, title, summary, content)
VALUES (${id}, '${lang}', '${escapeSql(item.title)}', '${escapeSql(item.summary)}', '${escapeSql(item.content)}')
ON CONFLICT(article_id, lang) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content;`);
  }
}

console.log(`Generated ${statements.length} SQL translation statements (${56 * 5} records).`);

// Split into batches to prevent any wrangler SQL size limits (e.g. 2 batches of 140 statements)
const batchSize = 100;
const batches = [];
for (let i = 0; i < statements.length; i += batchSize) {
  batches.push(statements.slice(i, i + batchSize));
}

console.log(`Split into ${batches.length} batches of statements.`);

for (let i = 0; i < batches.length; i++) {
  const batchFile = path.join(__dirname, `seed_translations_batch_${i + 1}.sql`);
  fs.writeFileSync(batchFile, batches[i].join('\n\n'), 'utf8');
  console.log(`Executing batch ${i + 1}/${batches.length} (${batches[i].length} statements)...`);
  const res = execSync(
    `npx.cmd wrangler d1 execute checkin-daily-db --remote --file="${batchFile}" --yes`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..'), maxBuffer: 50 * 1024 * 1024 }
  );
  console.log(`Batch ${i + 1} completed.`);
  fs.unlinkSync(batchFile);
}

console.log('🎉 Successfully executed all 280 translation updates on Cloudflare D1!');

