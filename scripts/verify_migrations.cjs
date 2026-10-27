const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');

const migrationsDir = path.join('checkin-daily', 'frontend', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
console.log('Testing migrations:', files);

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  db.exec(sql);
  console.log('✓ Executed:', file);
}

const articlesCount = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
const translationsCount = db.prepare('SELECT COUNT(*) as c FROM article_translations').get().c;
const reactionsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='article_reactions'").get();
const newsletterTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='newsletter_subscribers'").get();
const contactTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contact_inquiries'").get();
const rateLimitTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'").get();
const siteSettingsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_settings'").get();
const siteUrlSetting = db.prepare("SELECT value FROM site_settings WHERE key='site_url'").get();

console.log('Articles count:', articlesCount);
console.log('Translations count:', translationsCount);
console.log('Reactions table:', reactionsTable?.name);
console.log('Newsletter table:', newsletterTable?.name);
console.log('Contact table:', contactTable?.name);
console.log('Rate limits table:', rateLimitTable?.name);
console.log('Site settings table:', siteSettingsTable?.name, 'site_url:', siteUrlSetting?.value);

if (articlesCount === 66 && translationsCount === 330 && siteSettingsTable) {
  console.log('SUCCESS: All 66 articles and 330 translations verified 100%!');
} else {
  throw new Error(`Integrity check mismatch: articles=${articlesCount}, translations=${translationsCount}`);
}

