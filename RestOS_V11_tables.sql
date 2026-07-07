-- ============================================================
-- RestOS V11 — Tables Scan Factures + Beverage Cost
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ── Table des factures scannées ──
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  amount_ht numeric,
  amount_ttc numeric,
  vat numeric,
  items jsonb,
  status text default 'processed',
  created_at timestamptz default now()
);

-- ── Table des boissons (beverage cost) ──
create table if not exists beverages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  category text default 'vin',  -- vin, biere, spiritueux, soft, chaud
  cost_price numeric,
  selling_price numeric,
  margin_pct integer,
  stock_qty numeric default 0,
  stock_alert_qty numeric default 0,
  unit text default 'bouteille',
  supplier text,
  created_at timestamptz default now()
);

-- ── Désactiver RLS (cohérent avec le reste du projet) ──
alter table invoices disable row level security;
alter table beverages disable row level security;

-- ============================================================
-- Seed beverages exemple pour Les Portes du MSM
-- (optionnel — décommente et remplace les UUIDs si besoin)
-- ============================================================

-- La Salicorne
insert into beverages (restaurant_id, name, category, cost_price, selling_price, margin_pct, stock_qty, unit) values
('d8a42276-0613-44c8-8bef-73f02958daec', 'Muscadet Sèvre-et-Maine', 'vin', 4.50, 24.00, 81, 48, 'bouteille'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Côtes du Rhône rouge', 'vin', 5.20, 26.00, 80, 36, 'bouteille'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Champagne brut', 'vin', 18.00, 58.00, 69, 24, 'bouteille'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Bière blonde pression', 'biere', 0.45, 5.50, 92, 4, 'fût'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'IPA artisanale', 'biere', 1.20, 7.00, 83, 60, 'bouteille'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Ricard 2cl', 'spiritueux', 0.60, 4.50, 87, 12, 'bouteille'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Coca-Cola', 'soft', 0.35, 3.50, 90, 120, 'canette'),
('d8a42276-0613-44c8-8bef-73f02958daec', 'Café expresso', 'chaud', 0.25, 2.20, 89, 200, 'verre');

-- Le Pré Salé (cave gastronomique)
insert into beverages (restaurant_id, name, category, cost_price, selling_price, margin_pct, stock_qty, unit) values
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Sancerre blanc 2022', 'vin', 9.50, 42.00, 77, 30, 'bouteille'),
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Pouilly-Fumé', 'vin', 11.00, 48.00, 77, 24, 'bouteille'),
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Saint-Émilion Grand Cru', 'vin', 22.00, 78.00, 72, 18, 'bouteille'),
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Champagne millésimé', 'vin', 32.00, 95.00, 66, 12, 'bouteille'),
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Calvados Pays d''Auge 12 ans', 'spiritueux', 3.50, 14.00, 75, 6, 'bouteille'),
('bd78488b-71d5-4655-a365-1b4136bcc144', 'Eau minérale plate 75cl', 'soft', 0.80, 6.00, 87, 48, 'bouteille');

-- L'Hippocampe (crêperie — cidres)
insert into beverages (restaurant_id, name, category, cost_price, selling_price, margin_pct, stock_qty, unit) values
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Cidre brut fermier', 'biere', 2.20, 12.00, 82, 36, 'bouteille'),
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Cidre doux', 'biere', 2.20, 12.00, 82, 30, 'bouteille'),
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Bolée de cidre', 'biere', 0.80, 4.50, 82, 100, 'verre'),
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Jus de pomme artisanal', 'soft', 0.90, 4.00, 78, 48, 'bouteille'),
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Café', 'chaud', 0.25, 2.00, 88, 150, 'verre'),
('72ea95c3-52f6-4230-9326-3c6f6c9271da', 'Chouchen', 'spiritueux', 1.50, 6.50, 77, 12, 'verre');
