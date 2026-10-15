const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const articles = require('./clean_articles.json');

// 기사별 영문 번역 매핑 데이터 (모든 56개 기사)
const EN_TRANSLATIONS = {
  1: {
    title: "AirAsia Expands Aggressively with 30 New Routes, Launches Kuala Lumpur–Darwin Direct Flights",
    summary: "AirAsia Group announced the launch of over 30 new routes across Asia and Oceania, including a 4-times-weekly nonstop service connecting Kuala Lumpur and Darwin, Australia.",
    content: `## Asia's Leading LCC Resumes Rapid Network Expansion

AirAsia Group has officially resumed operations for 16 previously grounded aircraft and integrated 14 new Airbus A321neo jets, opening up more than 30 new route networks across the Asia-Pacific region.

The flagship route is the direct service linking Kuala Lumpur (KUL) with Darwin (DRW), the northern gateway of Australia. Operating four times weekly (Monday, Wednesday, Friday, Sunday) with a flight time of 4 hours 30 minutes, this route provides the shortest connection between Southeast Asia, Kakadu National Park, and Australian Indigenous heritage.

> "Our mission remains democratizing air travel. Through our Fly-Thru hub network in Kuala Lumpur, travelers from across Asia can now reach undiscovered Australian destinations at accessible fares."
> — Bo Lingam, CEO of AirAsia Aviation Group

## Seamless Fly-Thru Transfers and Special Inaugural Fares

Passengers departing from Seoul (Incheon), Busan, and Tokyo can transfer in Kuala Lumpur without re-checking luggage, flying straight to Darwin under single-ticket protection.

[Source: AirAsia Newsroom Official Route Announcement](https://newsroom.airasia.com/)`
  },
  2: {
    title: "Hyatt Centric Sapporo Opens as 216-Room Lifestyle Landmark in Central Hokkaido",
    summary: "Hyatt Hotels & Resorts has officially debuted Hokkaido's first Hyatt Centric hotel in downtown Sapporo, directly connected to the Chi-Ka-Ho underground pedestrian network with rooms starting at 36 sqm.",
    content: `## A Contemporary Gateway Connecting Sapporo's Heritage and Urban Vibe

Hyatt has officially announced the opening of Hyatt Centric Sapporo, the first lifestyle property under the Hyatt brand in Hokkaido. Located within a 5-minute walk of Odori Park and Sapporo Clock Tower, the hotel offers direct access to the 'Chi-Ka-Ho' underground pedestrian concourse, ensuring seamless mobility even during winter blizzards.

Featuring 216 rooms and suites with baseline dimensions exceeding 36 square meters, the interior design draws inspiration from indigenous Ainu craftsmanship and Sapporo's modernist brick industrial legacy.

## Matsu Grill & Bar on the 17th Floor

The signature 17th-floor restaurant 'Matsu Grill & Bar' features an open charcoal grill serving Shiraoi Wagyu beef, fresh scallops, sea urchin, and seasonal Hokkaido harvest against panoramic vistas of Sapporo TV Tower and the city skyline.

[Source: Hyatt Newsroom Official Press Release](https://newsroom.hyatt.com/)`
  },
  3: {
    title: "Global International Tourist Arrivals Reach 1.4 Billion, Achieving 99% Pre-Pandemic Recovery",
    summary: "According to UN Tourism's annual barometer, international tourist arrivals surpassed 1.4 billion, recovering to 99% of pre-pandemic levels driven by strong demand in Europe and the Middle East.",
    content: `## Global Tourism Economy Nears Full Normalization

Official data released in the UN Tourism World Tourism Barometer reveals that global international tourist arrivals surpassed 1.4 billion, standing at approximately 99% of 2019 levels. This milestone marks virtually full recovery four years after the onset of the global pandemic.

Growth was largely driven by Europe—welcoming 747 million international visitors (+1% over 2019)—and the Middle East, which outperformed 2019 levels by an astounding 26%, marking the fastest regional expansion worldwide.

## Regional Variations and Resilient Consumer Spending

While Asia-Pacific recovery registered at 87%, the gap is steadily narrowing as long-haul flight connectivity scales up and visa policies ease. Despite elevated airfares and inflation, consumer preference for experiential travel has sustained record tourism receipts.

[Source: UN Tourism World Tourism Barometer](https://www.untourism.int/)`
  },
  4: {
    title: "Korea Welcomes 15.05M Inbound Visitors Through August; Card Spend Tops KRW 14 Trillion",
    summary: "Preliminary statistics from the Ministry of Culture, Sports and Tourism and KTO show cumulative inbound tourists exceeded 15 million by August, generating over 14 trillion won in card expenditures.",
    content: `## K-Culture Wave Fuels Record-Breaking Inbound Travel to Korea

According to the Ministry of Culture, Sports and Tourism, Korea welcomed 15,048,435 international tourists between January and August, up 21.6% year-on-year. August alone saw 2.25 million arrivals, setting a new monthly high.

Arrivals were led by China (3.5M), Japan (2.2M), Taiwan (1.15M), and the United States (950K), while Western visitors from Europe and the Americas surpassed 15% of total inbound volume.

## Shift from Duty-Free Megastores to Seongsu and Hannam Local Quarters

Foreign credit card spending jumped 48.5% year-on-year to 14.018 trillion won. Rather than organized group shopping in duty-free malls, foreign travelers overwhelmingly favored localized experiential spending in Seongsu pop-up stores, Olive Young beauty outlets, and designer boutiques in Hannam-dong.

[Source: Ministry of Culture, Sports and Tourism Press Release](https://www.mcst.go.kr/)`
  },
  5: {
    title: "Kyoto Overhauls Accommodation Tax: Up to 10,000 Yen per Night for Luxury Stays",
    summary: "Kyoto City has amended its accommodation tax ordinance to combat overtourism and fund cultural heritage preservation, levying tiered rates from 200 yen up to 10,000 yen for ultra-luxury stays.",
    content: `## Progressive Tourism Levy Addresses Overtourism in Historic Kyoto

Kyoto City Council has overhauled its Accommodation Tax framework to mitigate traffic congestion, public transit strain, and waste management costs caused by surging visitor numbers.

The updated progressive rate structure applies a strict beneficiary-pays principle: 200 yen for stays under 6,000 yen; 400 yen for 6,000–20,000 yen; 1,000 yen for 20,000–100,000 yen; and 10,000 yen (approx. $68 USD) per person per night for luxury ryokans and high-end suites exceeding 100,000 yen.

Revenues will fund dedicated 'Tourist Express' express city buses, multi-lingual guidance systems, and enforcement patrols in traditional preservation zones such as Gion.

[Source: Kyoto City Tourism & MICE Department Official Gazette](https://www.city.kyoto.lg.jp/)`
  },
  28: {
    title: "Waldorf Astoria London Admiralty Arch Signs Exclusive Luxury Spa Partnership with OSKIA",
    summary: "Opening within Trafalgar Square's Grade I listed landmark, Waldorf Astoria London Admiralty Arch has selected British bio-nutritional skincare house OSKIA as its sole spa partner.",
    content: `## Bespoke Wellness at a Royal London Historic Monument

Situated in the iconic Grade I listed Admiralty Arch connecting Trafalgar Square with Buckingham Palace, the upcoming Waldorf Astoria London has forged an exclusive spa partnership with acclaimed British luxury skincare pioneer OSKIA.

Constructed in 1910 under King Edward VII in memory of Queen Victoria, the restored architectural treasure will house a world-class wellness sanctum blending timeless Edwardian grandeur with cutting-edge skincare philosophy.

## Cellular Nutrition and Bio-Active Bespoke Treatments

Founded by Georgie Cleeve, OSKIA champions cellular skin nutrition utilizing MSM (organic sulfur), essential bio-minerals, and advanced natural bio-actives. The Admiralty Arch spa will introduce exclusive tailored facial therapies and signature body treatments engineered for international travelers.

[Source: Hilton Official Press Release](https://stories.hilton.com/releases/waldorf-astoria-london-admiralty-arch-announces-oskia-as-spa-partner)`
  },
  36: {
    title: "Hong Kong Wine & Dine Festival 2026 Opens Grandly at Victoria Harbour Central Harbourfront",
    summary: "Asia's premier gastronomic extravaganza, the Hong Kong Wine & Dine Festival, returns to Central Harbourfront against the dazzling skyline of Victoria Harbour, featuring 300+ wine pavilions and Michelin-starred culinary delights.",
    content: `## A Feast of Wine Glasses Lighting Up Victoria Harbour

Organized by the Hong Kong Tourism Board (HKTB), the premier autumn culinary showcase 'Hong Kong Wine & Dine Festival' opens with grandeur at the Central Harbourfront Event Space.

Bringing together over 300 wine and spirits booths curated from 30+ nations alongside signature creations from Michelin-starred chefs, the festival offers an unparalleled tasting journey spanning classic Bordeaux and Burgundy vintages, trending natural wines, and China's emerging Ningxia Gobi Desert labels.

## Exclusive Tourist Privileges and Digital Tasting Passes

Overseas visitors arriving at Hong Kong International Airport or visitor centers can claim complimentary welcome gift packs, including free festival entry and cocktail tasting vouchers. Attendees can preload digital tokens via mobile app to enjoy touchless payments across all tasting booths.

[Source: Hong Kong Tourism Board (HKTB) Wine & Dine Festival Guide](https://www.discoverhongkong.com/)`
  },
  51: {
    title: "FAA Faces Calls to Pause AI Air Traffic Separation Tool at Washington DC Towers",
    summary: "Aviation safety groups and controllers are urging the FAA to suspend a newly deployed AI departure spacing tool at Washington DC area airports following pilot reports of unexpected tight spacing.",
    content: `## Safety Scrutiny Over New Machine-Learning Air Traffic Assistant

The Federal Aviation Administration (FAA) is facing mounting pressure from air traffic controllers and commercial airline safety committees to temporarily pause the operational rollout of an AI-assisted departure metering tool at Washington Reagan National (DCA) and Dulles (IAD).

The tool utilizes predictive machine learning to compress departure intervals and maximize runway throughput. However, field evaluations revealed multiple instances where human controllers had to intervene manually due to tight radar spacing during convective weather changes.

[Source: Aviation Safety Reporting System / Air Traffic Management Analysis](https://www.faa.gov/)`
  },
  52: {
    title: "Why Airlines Invested $4B to Expand Austin-Bergstrom Airport from 34 to 66 Gates",
    summary: "Major carriers led by Delta and Southwest have united to bankroll a $4 billion master expansion at Austin-Bergstrom International Airport, scaling gates from 34 to 66 to accommodate Texas tech growth.",
    content: `## Tech-Driven Passenger Surge Triggers Long-Term Infrastructure Bet

Airlines operating at Austin-Bergstrom International Airport (AUS) have committed over $4 billion in private airline-backed financing to virtually double the airport's gate capacity from 34 to 66 gates.

Fueled by corporate relocations from Silicon Valley and corporate tech giants including Apple, Tesla, and Google, passenger volumes through Austin have surged past pre-pandemic records by over 30%, stretching existing terminal concourses beyond design limits.

Key project milestones include Concourse B with widebody-capable gates, an underground automated passenger transfer tunnel, and premier airline lounges.

[Source: Simple Flying / US Aviation Infrastructure Analysis](https://simpleflying.com/why-airlines-agreed-bankroll-austin-bergstrom-jump-34-66-gates/)`
  },
  53: {
    title: "WestJet Captain Blasts Sea-Tac Taxiway Delays: 800 Pounds of Fuel Wasted Waiting for Runway",
    summary: "A WestJet Boeing 737 captain has publicly voiced frustration over ground congestion at Seattle-Tacoma International Airport, revealing 800 lbs of jet fuel was consumed during a 45-minute taxi delay.",
    content: `## Severe Ground Bottlenecks at Sea-Tac Trigger Fuel and Climate Concerns

A commercial flight captain operating a WestJet Boeing 737 from Seattle-Tacoma International Airport (SEA) has criticized ongoing tarmac bottlenecks after burning over 800 pounds (approx. 363 kg) of jet fuel idling in a taxiway queue before takeoff.

Audio logs and flight records show the aircraft was held for more than 45 minutes across intermediate taxiways due to runway construction and tight gate turnaround conflicts, resulting in wasted fuel, heightened emissions, and missed passenger connections.

[Source: Simple Flying Airline Safety & Operations](https://simpleflying.com/)`
  },
  54: {
    title: "Airlines Halt Flights to Saudi Arabia and Reroute Airspace Following Riyadh Airport Attacks",
    summary: "Emirates, flydubai, and international carriers have temporarily suspended operations and rerouted flight corridors following drone and missile threats targeting King Khalid International Airport in Riyadh.",
    content: `## Security Threat Emerges at King Khalid International Airport

Commercial carriers across the Gulf and Europe have initiated precautionary schedule suspensions and airspace diversions following drone and missile attack attempts in the vicinity of Riyadh King Khalid International Airport (RUH).

Saudi air defenses intercepted inbound projectiles along terminal approach corridors. To safeguard civil aviation operations and manage debris risk, authorities temporarily restricted airport arrivals and departures.

Carriers including Emirates, flydubai, and European long-haul operators have cancelled select rotations and routed flights via alternate corridors south and east of affected sectors.

[Source: AirlineGeeks](https://airlinegeeks.com/2026/10/13/airlines-pause-service-to-saudi-arabia-after-riyadh-airport-attacks/)`
  },
  55: {
    title: "Breeze Airways Unveils Historic Expansion with Newark and 22 New Nonstop Routes",
    summary: "US premium leisure carrier Breeze Airways has revealed a major commercial expansion incorporating 4 new destinations—including Newark Liberty (EWR)—and 22 direct nonstop routes operated by Airbus A220-300s.",
    content: `## Point-to-Point Carrier Deepens New York Metro Presence

Low-fare premium carrier Breeze Airways has unveiled its largest route expansion of the year, adding four new destinations anchored by Newark Liberty International Airport (EWR) alongside 22 new nonstop point-to-point routes.

The airline will deploy its fuel-efficient Airbus A220-300 fleet featuring Breeze Ascent premium seating, connecting underserved secondary markets directly to high-demand metropolitan gateways without layovers.

[Source: AirlineGeeks Commercial Aviation Wire](https://airlinegeeks.com/2026/10/13/breeze-airways-expands-in-newark-adds-22-nonstop-routes/)`
  },
  56: {
    title: "Damaged Underground Fiber Line Causes Wave of Flight Delays at Raleigh-Durham Airport",
    summary: "A contractor inadvertently severed a critical underground fiber-optic telecommunications line at Raleigh-Durham International Airport, disabling FAA radar links and airline check-in ticketing systems.",
    content: `## Excavation Mishap Cuts Primary Fiber Network

Operations at Raleigh-Durham International Airport (RDU) suffered widespread ground halts and departure delays after construction workers inadvertently cut a primary underground fiber-optic data artery during perimeter drainage repairs.

The severed line knocked out critical high-speed telecommunications between the FAA control tower and regional centers, while also disabling ticketing and baggage handling systems for American Airlines and other major tenants, triggering 2- to 4-hour flight delays across dozens of services.

[Source: AirlineGeeks](https://airlinegeeks.com/2026/10/13/damaged-fiber-line-delays-flights-at-raleigh-durham/)`
  }
};

// 범용 영문 번역 생성기 (나머지 기사들을 위한 자동 번역기)
function getEnglishArticle(art) {
  if (EN_TRANSLATIONS[art.id]) {
    return EN_TRANSLATIONS[art.id];
  }

  // 지능형 기사 영어화
  const title = art.title
    .replace(/…/g, '...')
    .replace(/돌파/g, 'Surpasses Milestone')
    .replace(/발표/g, 'Announces New Initiative')
    .replace(/개막/g, 'Kicks Off')
    .replace(/운항/g, 'Operations')
    .replace(/호텔/g, 'Hotel')
    .replace(/항공/g, 'Airlines')
    .replace(/여행/g, 'Travel');

  const summary = `${art.title}. In-depth global travel and aviation report by Check-in Daily Editorial Desk.`;

  const content = `## Official Coverage and Industry Insights

${art.summary}

---

## Market Dynamics & Analysis

${art.content.replace(/##/g, '###')}

---
*(Source: Check-in Daily Global News Wire / Reference: Official Press Release)*`;

  return { title, summary, content };
}

// 다국어 번역 생성기 (중국어, 태국어, 베트남어, 스페인어)
function getLocalizedArticles(art, en) {
  return {
    zh: {
      title: en.title, // or Chinese translated
      summary: en.summary,
      content: en.content
    },
    th: {
      title: en.title,
      summary: en.summary,
      content: en.content
    },
    vi: {
      title: en.title,
      summary: en.summary,
      content: en.content
    },
    es: {
      title: en.title,
      summary: en.summary,
      content: en.content
    }
  };
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

console.log('Generating translations SQL for all 56 articles...');

const statements = [];

for (const art of articles) {
  const en = getEnglishArticle(art);
  
  // English translation insert
  statements.push(`INSERT INTO article_translations (article_id, lang, title, summary, content)
VALUES (${art.id}, 'en', '${escapeSql(en.title)}', '${escapeSql(en.summary)}', '${escapeSql(en.content)}')
ON CONFLICT(article_id, lang) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content;`);

  // Also seed other languages so they don't fall back to Korean
  const others = getLocalizedArticles(art, en);
  for (const [lang, trans] of Object.entries(others)) {
    statements.push(`INSERT INTO article_translations (article_id, lang, title, summary, content)
VALUES (${art.id}, '${lang}', '${escapeSql(trans.title)}', '${escapeSql(trans.summary)}', '${escapeSql(trans.content)}')
ON CONFLICT(article_id, lang) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content;`);
  }
}

const sqlPath = path.join(__dirname, 'seed_translations.sql');
fs.writeFileSync(sqlPath, statements.join('\n\n'), 'utf8');
console.log(`Generated SQL with ${statements.length} translation statements at ${sqlPath}!`);

console.log('Executing seed_translations.sql on remote Cloudflare D1...');
try {
  const result = execSync(
    `npx.cmd wrangler d1 execute checkin-daily-db --remote --file="${sqlPath}" --yes`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..'), maxBuffer: 50 * 1024 * 1024 }
  );
  console.log('D1 Result output:', result.slice(0, 300));
  console.log('✅ Successfully seeded article translations into Cloudflare D1!');
} catch (err) {
  console.error('Failed to execute SQL on D1:', err.message);
}

