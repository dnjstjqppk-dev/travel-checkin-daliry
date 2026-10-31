-- Migration 0013: Register Verified Multi-Source Travel and Aviation Crawlers
-- Enables Autonomous Ingestion Across Global Tourism Boards and Aviation Authorities

INSERT OR IGNORE INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active, fetch_interval_minutes) VALUES
  ('stb_singapore', 'Singapore Tourism Board (STB)', 'rss', 'https://news.google.com/rss/search?q=Singapore+Tourism+Board+announces&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60),
  ('jnto_japan', 'Japan National Tourism Organization (JNTO)', 'rss', 'https://news.google.com/rss/search?q=Japan+National+Tourism+Organization&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60),
  ('vietnam_tourism', 'Vietnam National Authority of Tourism (VNAT)', 'rss', 'https://news.google.com/rss/search?q=Vietnam+National+Authority+of+Tourism&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60),
  ('kto_korea', 'Korea Tourism Organization (KTO)', 'rss', 'https://news.google.com/rss/search?q=Korea+Tourism+Organization+visitkorea&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60),
  ('iata_newsroom', 'International Air Transport Association (IATA)', 'rss', 'https://news.google.com/rss/search?q=IATA+passenger+demand+aviation+outlook&hl=en-US&gl=US&ceid=US:en', 'Industry Association Report', 1, 60),
  ('capa_aviation', 'CAPA Centre for Aviation', 'rss', 'https://news.google.com/rss/search?q=CAPA+Centre+for+Aviation+routes&hl=en-US&gl=US&ceid=US:en', 'Industry Association Report', 1, 60),
  ('flightglobal_feed', 'FlightGlobal Aviation Intelligence', 'rss', 'https://news.google.com/rss/search?q=FlightGlobal+airline+fleets+orders&hl=en-US&gl=US&ceid=US:en', 'Editorial Fair Citation', 1, 60),
  ('unwto_world', 'UN World Tourism Organization (UN Tourism)', 'rss', 'https://news.google.com/rss/search?q=UN+Tourism+barometer+global+travel&hl=en-US&gl=US&ceid=US:en', 'International Agency Report', 1, 120),
  ('dot_philippines', 'Philippine Department of Tourism', 'rss', 'https://news.google.com/rss/search?q=Philippines+Department+of+Tourism+entry&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60),
  ('my_tourism', 'Tourism Malaysia Corporate PR', 'rss', 'https://news.google.com/rss/search?q=Tourism+Malaysia+visa+exemption&hl=en-US&gl=US&ceid=US:en', 'Official Tourism Board PR', 1, 60);

