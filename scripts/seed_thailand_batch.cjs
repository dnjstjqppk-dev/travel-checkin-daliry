// scripts/seed_thailand_batch.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const thailandArticles = require('./batch100/thailand_part1.cjs');

console.log(`Loaded ${thailandArticles.length} Thailand articles from thailand_part1.cjs.`);

function escapeSql(str) {
  if (!str) return "''";
  return "'" + str.replace(/'/g, "''") + "'";
}

const languages = ['en', 'zh', 'th', 'vi', 'es'];
const articleStatements = [];
const cityStatements = [];
const translationStatements = [];

const nowIso = new Date().toISOString();

for (const art of thailandArticles) {
  const ko = art.ko || {};
  // 1. Insert into articles
  articleStatements.push(`INSERT INTO articles (id, title, slug, summary, content, category, author, cover_image, status, view_count, published_at, created_at, updated_at)
VALUES (
  ${art.id},
  ${escapeSql(ko.title || art.title)},
  ${escapeSql(art.slug)},
  ${escapeSql(ko.summary || art.summary || '')},
  ${escapeSql(ko.content || art.content || '')},
  ${escapeSql(art.category)},
  ${escapeSql(art.author || '체크인데일리 취재팀')},
  ${escapeSql(art.cover_image || '')},
  'published',
  ${art.view_count || 500},
  ${escapeSql(art.published_at || nowIso)},
  ${escapeSql(nowIso)},
  ${escapeSql(nowIso)}
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  slug = excluded.slug,
  summary = excluded.summary,
  content = excluded.content,
  category = excluded.category,
  author = excluded.author,
  cover_image = excluded.cover_image,
  status = excluded.status,
  view_count = excluded.view_count,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;`);

  // 2. Insert into article_cities
  if (Array.isArray(art.city_ids)) {
    for (const cityId of art.city_ids) {
      cityStatements.push(`INSERT OR IGNORE INTO article_cities (article_id, city_id) VALUES (${art.id}, ${escapeSql(cityId)});`);
    }
  }

  // 3. Insert into article_translations
  for (const lang of languages) {
    if (art[lang]) {
      const t = art[lang];
      translationStatements.push(`INSERT INTO article_translations (article_id, lang, title, summary, content)
VALUES (${art.id}, '${lang}', ${escapeSql(t.title)}, ${escapeSql(t.summary)}, ${escapeSql(t.content)})
ON CONFLICT(article_id, lang) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content;`);
    }
  }
}

console.log(`Generated:
- ${articleStatements.length} article statements
- ${cityStatements.length} city mapping statements
- ${translationStatements.length} translation statements`);

const allSql = [
  '-- Seed Thailand Articles (IDs 57 - 66)',
  ...articleStatements,
  '-- Article Cities',
  ...cityStatements,
  '-- Article Translations',
  ...translationStatements,
].join('\n\n');

const sqlPath = path.resolve('scripts/seed_thailand_batch.sql');
fs.writeFileSync(sqlPath, allSql, 'utf8');
console.log(`Wrote SQL to ${sqlPath} (${(allSql.length / 1024).toFixed(1)} KB)`);

// Execute on Cloudflare D1
console.log('Executing on remote Cloudflare D1 (checkin-daily-db)...');
try {
  const output = execSync(
    `npx.cmd wrangler d1 execute checkin-daily-db --remote --file="${sqlPath}" --yes`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..'), maxBuffer: 50 * 1024 * 1024 }
  );
  console.log(output);
  console.log('🎉 Successfully seeded Thailand articles (57-66) and all 5 translations into Remote D1!');
} catch (err) {
  console.error('Failed to execute on remote D1:', err);
  process.exit(1);
}

