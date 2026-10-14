const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const major = require('./data_major.cjs');
const airline = require('./data_airline.cjs');
const hotel = require('./data_hotel.cjs');
const destination = require('./data_destination.cjs');
const realtime = require('./data_realtime.cjs');

const allArticles = [...major, ...airline, ...hotel, ...destination, ...realtime];
allArticles.sort((a, b) => a.id - b.id);

console.log(`Total articles to update: ${allArticles.length}`);

function escapeSql(str) {
  if (!str) return "''";
  return "'" + str.replace(/'/g, "''") + "'";
}

const nowIso = new Date().toISOString();

const sqlStatements = allArticles.map((art) => {
  return `UPDATE articles SET
  title = ${escapeSql(art.title)},
  slug = ${escapeSql(art.slug)},
  summary = ${escapeSql(art.summary)},
  content = ${escapeSql(art.content)},
  category = ${escapeSql(art.category)},
  author = ${escapeSql(art.author)},
  cover_image = ${escapeSql(art.cover_image)},
  updated_at = ${escapeSql(nowIso)}
WHERE id = ${art.id};`;
});

const sqlFilePath = path.resolve('scripts/update_all_50_articles.sql');
fs.writeFileSync(sqlFilePath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Wrote SQL to ${sqlFilePath}`);

// Update migration 0003 as well
const migrationPath = path.resolve('checkin-daily/frontend/migrations/0003_seed_verified_travel_articles.sql');
fs.writeFileSync(migrationPath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Updated migration file ${migrationPath}`);

// Execute on remote Cloudflare D1
console.log('Executing on remote Cloudflare D1 database: checkin-daily-db...');
try {
  const result = execSync('npx.cmd wrangler d1 execute checkin-daily-db --remote --file=scripts/update_all_50_articles.sql --yes', {
    stdio: 'inherit',
  });
  console.log('Successfully executed SQL on Cloudflare D1!');
} catch (err) {
  console.error('Failed to execute SQL on D1:', err);
  process.exit(1);
}
