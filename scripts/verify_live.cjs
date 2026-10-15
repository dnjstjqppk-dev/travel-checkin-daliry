const https = require('https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function verifyAll() {
  console.log('--- STARTING LIVE VERIFICATION ---');

  // 1. Footer & Live Clock Check
  const homeHtml = await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/news');
  console.log('QA-13 (Footer without dev tag):', !homeHtml.includes('BANGKOK POST STYLE ARCHITECTURE'));
  console.log('QA-13 (Footer official publisher info):', homeHtml.includes('서울 아-52914'));
  console.log('QA-11 (Clock rendered dynamically):', homeHtml.includes('bkp-datetime-label'));

  // 2. Hotel Article 28 Check (QA-05, QA-08, QA-09)
  const art28Html = await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/news/hotel/article/28');
  console.log('QA-05 (Article 28 no 1,200m2):', !art28Html.includes('1,200㎡'));
  console.log('QA-05 (Article 28 no apple stem cells):', !art28Html.includes('스위스 사과'));
  console.log('QA-05 (Article 28 has OSKIA):', art28Html.includes('OSKIA'));
  console.log('QA-08 (Article 28 exact press release URL):', art28Html.includes('waldorf-astoria-london-admiralty-arch-announces-oskia-as-spa-partner'));
  console.log('QA-09 (Article 28 editorial photo credit):', art28Html.includes('Unsplash 에디토리얼 라이선스'));

  // 3. Airline Article 54 Check (QA-01, QA-07, QA-12)
  const art54Html = await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/news/airline/article/54');
  console.log('QA-01 (Article 54 no boilerplate 60-90 tips):', !art54Html.includes('출발 60일~90일 전 프로모션'));
  console.log('QA-01 & QA-07 (Article 54 fluent Korean):', art54Html.includes('킹 칼리드 국제공항'));

  // 4. Region Hub Check (QA-02, QA-14)
  const regHtml = await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/news/region');
  console.log('QA-02 & QA-14 (Region Hub EXPLORE BY REGION):', regHtml.includes('EXPLORE BY REGION'));
  console.log('QA-02 & QA-14 (Region Hub Country Tabs):', regHtml.includes('bkp-country-pill'));

  // 5. Realtime Ranking Check (QA-03, QA-15)
  const rtHtml = await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/news/realtime');
  console.log('QA-03 & QA-15 (Realtime subtitle):', rtHtml.includes('최다 조회순 및 트렌딩 랭킹'));
  console.log('QA-03 & QA-15 (Realtime rank badges):', rtHtml.includes('bkp-card-rank-badge') && rtHtml.includes('1위'));

  // 6. Exchange Rates API Check (QA-06)
  const ratesJson = JSON.parse(await fetchText('https://travel-checkin-daily.dnjstjqppk.workers.dev/api/exchange-rates?refresh=true'));
  console.log('QA-06 (Exchange Rates stale is false):', ratesJson.stale === false);
  console.log('QA-06 (Exchange Rates source live):', ratesJson.source.includes('Live Market'));
  console.log('QA-06 (Exchange Rates USD rate exists):', ratesJson.rates.some(r => r.currency === 'USD' && r.krwPrice > 1000));

  console.log('--- ALL QA VERIFICATION CHECKS COMPLETE ---');
}

verifyAll().catch(console.error);
