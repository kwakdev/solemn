CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  placement TEXT NOT NULL DEFAULT 'new_arrivals',
  description_json TEXT NOT NULL DEFAULT '[]',
  sizes_json TEXT NOT NULL DEFAULT '[]',
  images_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS products_placement_idx
ON products (placement, updated_at DESC);

INSERT OR IGNORE INTO products (
  id,
  slug,
  name,
  price_cents,
  placement,
  description_json,
  sizes_json,
  images_json
) VALUES
(
  '1',
  'tole-tole-cuddle',
  'TOLE TOLE “CUDDLE MODE”',
  13800,
  'new_arrivals',
  '["TOLE TOLE BEING HELD LIKE A TINY BABY","EXTRA LARGE EYES AND A VERY SERIOUS FACE","MAXIMUM CUDDLE MODE","VERY PATIENT AND SLIGHTLY CONFUSED","THE ORIGINAL TOLE TOLE PORTRAIT"]',
  '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]',
  '["/products/cat.png"]'
),
(
  '2',
  'tole-tole-pineapple',
  'TOLE TOLE “PINEAPPLE QUEEN”',
  24200,
  'new_arrivals',
  '["TOLE TOLE WEARING A PINEAPPLE CROWN","FULL TROPICAL FRUIT ENERGY","MATCHING PINEAPPLE SLICE INCLUDED IN THE PHOTO","CALM, REGAL, AND SLIGHTLY JUICY","THE QUEEN OF THE FRUIT BOWL"]',
  '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]',
  '["/products/cat2.png"]'
),
(
  '3',
  'tole-tole-strawberry-bob',
  'TOLE TOLE “STRAWBERRY BOB”',
  5800,
  'collection',
  '["TOLE TOLE WEARING A LONG BROWN BOB WIG","STRAWBERRY HAIR CLIPS ON BOTH SIDES","FRESH SALON LOOK","SERVING A VERY SERIOUS BEAUTY POSE","READY FOR HER CLOSE-UP"]',
  '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]',
  '["/products/cat3.png"]'
),
(
  '4',
  'tole-tole-busy-bee',
  'TOLE TOLE “BUSY BEE”',
  13800,
  'collection',
  '["TOLE TOLE WEARING A BLACK-AND-YELLOW BEE COSTUME","HOOD WITH TWO SOFT ANTENNAE","SITTING POLITELY IN THE KITCHEN","BUSY BEE ENERGY WITHOUT THE BUZZING","READY TO POLLINATE THE SNACK CABINET"]',
  '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]',
  '["/products/cat4.png"]'
),
(
  '5',
  'tole-tole-cheese-head',
  'TOLE TOLE “CHEESE HEAD”',
  23200,
  'memories',
  '["TOLE TOLE WEARING A GIANT CHEESE-SLICE HAT","BOLD YELLOW COLOR","A LITTLE ANNOYED BUT STILL FASHIONABLE","SERVING SHARP CHEDDAR ATTITUDE","NOT ACTUALLY MADE OF CHEESE"]',
  '[{"label":"1","stock":1},{"label":"2","stock":1},{"label":"3","stock":1},{"label":"4","stock":0}]',
  '["/products/cat5.png"]'
);
