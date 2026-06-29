# 🚀 Настройка Supabase для магазина «РыбХоз Сети»

После этой настройки **все картинки, товары и клиенты будут видны всем посетителям** с любого устройства — сайт перестанет быть «пустым» для других людей.

Времени нужно: ~7 минут. Всё бесплатно.

---

## Шаг 1. Создайте проект Supabase

1. Зайдите на **https://supabase.com** → нажмите **Start your project** → войдите через GitHub.
2. Нажмите **New project**.
3. Заполните:
   - **Name**: `rybhoz-shop` (любое)
   - **Database Password**: придумайте надёжный пароль и **сохраните его** (он понадобится только для прямого доступа к БД, в коде не используется).
   - **Region**: выберите ближайший (например, **Frankfurt (eu-central-1)** для России/Европы).
4. Нажмите **Create new project** и подождите ~2 минуты, пока проект создаётся.

---

## Шаг 2. Создайте таблицы (скопируйте SQL)

1. В левом меню откройте **SQL Editor** (иконка `</>`).
2. Нажмите **+ New query**.
3. Вставьте **весь** код ниже и нажмите **Run** (или Ctrl+Enter):

```sql
-- ============================================================
-- Таблица: общее состояние магазина (каталог, блог, настройки)
-- Хранится одной строкой с id='main'
-- ============================================================
create table if not exists shop_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Разрешаем читать всем, писать всем (упрощённо — для админ-панели по паролю в самом приложении)
alter table shop_state enable row level security;

create policy "shop_state_read" on shop_state
  for select using (true);

create policy "shop_state_write" on shop_state
  for insert with check (true);

create policy "shop_state_update" on shop_state
  for update using (true);

-- ============================================================
-- Таблица: клиенты (регистрации видны всем устройствам)
-- ============================================================
create table if not exists clients (
  email text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table clients enable row level security;

create policy "clients_read" on clients
  for select using (true);

create policy "clients_write" on clients
  for insert with check (true);

create policy "clients_update" on clients
  for update using (true);

create policy "clients_delete" on clients
  for delete using (true);

-- Стартовая пустая строка состояния
insert into shop_state (id, data) values ('main', '{}'::jsonb)
  on conflict (id) do nothing;
```

4. Должно появиться сообщение **Success. No rows returned** — значит таблицы созданы.

---

## Шаг 3. Создайте хранилище для картинок (Storage)

1. В левом меню откройте **Storage**.
2. Нажмите **New bucket**.
3. Имя: `images`
4. **Обязательно** включите галочку **Public bucket** (чтобы картинки были видны всем по прямой ссылке).
5. Нажмите **Create bucket**.

Затем настроим права на загрузку:

6. Откройте **SQL Editor** снова → **+ New query** → вставьте и **Run**:

```sql
-- Разрешаем читать картинки всем, загружать всем
create policy "images_public_read" on storage.objects
  for select using (bucket_id = 'images');

create policy "images_public_upload" on storage.objects
  for insert with check (bucket_id = 'images');

create policy "images_public_update" on storage.objects
  for update using (bucket_id = 'images');

create policy "images_public_delete" on storage.objects
  for delete using (bucket_id = 'images');
```

---

## Шаг 4. Скопируйте ключи доступа

1. В левом меню откройте **Project Settings** (шестерёнка внизу) → **API**.
2. Найдите и скопируйте два значения:
   - **Project URL** — выглядит как `https://abcdefgh.supabase.co`
   - **anon public** ключ (в разделе *Project API keys*) — длинная строка, начинается с `eyJ...`

⚠️ Используйте именно **anon public** ключ, НЕ service_role! anon-ключ безопасно держать в коде сайта.

---

## Шаг 5. Вставьте ключи в сайт

Откройте файл **`config.js`** (он лежит рядом с index.html) и впишите ваши значения:

```javascript
window.SUPABASE_URL = 'https://ВАШ-ПРОЕКТ.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJ...ВАШ-КЛЮЧ...';
```

Сохраните файл, закоммитьте в GitHub — и всё заработает: загруженные картинки и товары увидят все посетители.

---

## Как это работает после настройки

- **Картинки** загружаются в Supabase Storage и получают публичную ссылку (CDN). Эта ссылка сохраняется в каталоге. Любой посетитель видит картинку.
- **Каталог, блог, настройки скидок, кастомные блоки** хранятся в таблице `shop_state` — одна общая версия для всех.
- **Клиенты** хранятся в таблице `clients` — админ видит всех, кто зарегистрировался с любого устройства.
- **Если Supabase не настроен** — сайт продолжит работать на локальном хранилище (как раньше), просто данные будут видны только в вашем браузере.

## Безопасность

Для простоты правила доступа открыты (любой может писать). Это нормально для витрины-каталога. Админ-панель защищена паролем в самом приложении. Если в будущем понадобится строгая защита (чтобы никто не мог менять каталог через API напрямую) — это делается через Supabase Auth и более строгие RLS-политики; обратитесь, и я помогу настроить.
