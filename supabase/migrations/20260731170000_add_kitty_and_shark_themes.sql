insert into public.submission_theme_products
  (id, name, description, distribution_mode, price_satang, enabled, preview_url, theme_config)
values
  (
    'hello-kitty-line-diary',
    'Kitty Line Diary',
    'ธีมคิตตี้ลายเส้นบนกระดาษครีม แต้มสีชมพูและเชอร์รี สำหรับพื้นที่ทำงานที่นุ่มนวล',
    'request',
    9900,
    true,
    '/themes/hello-kitty-line-diary.png',
    '{"primary":"#b85f67","canvas":"#fff8ef","surface":"#fffdf8","text":"#4b302b","accent":"#d9777e"}'::jsonb
  ),
  (
    'cute-shark-line-cove',
    'Cute Shark Line Cove',
    'ธีมฉลามน้อยออริจินัล ลายเส้นสีน้ำเงินทะเลบนพื้นครีม พร้อมฟองน้ำและเปลือกหอย',
    'request',
    9900,
    true,
    '/themes/cute-shark-line-cove.png',
    '{"primary":"#2f6f87","canvas":"#f7f6eb","surface":"#fffdf6","text":"#173c55","accent":"#df866f"}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  preview_url = excluded.preview_url,
  theme_config = excluded.theme_config,
  enabled = true,
  updated_at = now();
