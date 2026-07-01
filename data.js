/* ============================================================
   data.js — данные магазина РыбХоз Сети v3
   Мультипользовательская система авторизации:
   - Users: таблица учётных записей по email
   - Session: активная сессия (sessionStorage)
   - Store: каталог товаров и контент (общий)
============================================================ */

const STORE_KEY    = 'rybhoz_store_v3';   // каталог, блог, настройки
const USERS_KEY    = 'rybhoz_users_v3';   // учётные записи пользователей
const SESSION_KEY  = 'rybhoz_session_v3'; // текущая сессия (sessionStorage)
const ADMIN_KEY    = 'rybhoz_admin_sess'; // admin флаг (sessionStorage)
const sp = o => o;

/* ============================================================
   ХРАНИЛИЩЕ — IndexedDB (вмещает картинки) с fallback на localStorage
   localStorage ограничен ~5МБ, картинки-data-URI быстро его переполняют
   и сохранение молча падает. IndexedDB вмещает сотни МБ.
============================================================ */
const DB = {
  _db: null,
  _ready: null,

  open() {
    if (this._ready) return this._ready;
    this._ready = new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      try {
        const req = indexedDB.open('rybhoz_db', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return this._ready;
  },

  async get(key) {
    const db = await this.open();
    if (!db) { try { return JSON.parse(localStorage.getItem(key)); } catch(e){ return null; } }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result != null ? req.result : null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },

  async set(key, value) {
    const db = await this.open();
    if (!db) {
      // fallback: localStorage (может не вместить большие данные)
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },

  async del(key) {
    const db = await this.open();
    if (!db) { try { localStorage.removeItem(key); } catch(e){} return; }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) { resolve(); }
    });
  }
};

/* ---------- КАТАЛОГ ---------- */
const DEFAULT_GROUPS = [
  {
    id:'g-seti', name:'Рыболовные сети', tagline:'Готовая оснастка для любой рыбы', badge:'Главный товар',
    products:[
      {id:'s1',name:'Сеть одностенная «Финка»',sku:'RHS-100',price:1290,oldPrice:1690,stock:36,rating:5,reviews:48,sales:312,
       desc:'Классическая одностенная сеть из лески. Готова к установке: грузила и поплавки уже на месте.',
       variations:['Ячея 30 мм','Ячея 40 мм','Ячея 50 мм','Ячея 60 мм'],activeVar:1,
       specs:sp({Тип:'Одностенная',Материал:'Леска (монофил)',Ячея:'40 мм',Высота:'1,8 м',Длина:'30 м',Оснастка:'Готовая'})},
      {id:'s2',name:'Сеть трёхстенная «Путанка»',sku:'RHS-205',price:1890,oldPrice:null,stock:22,rating:5,reviews:67,sales:540,
       desc:'Трёхстенная путанка повышенной уловистости. Внешние стенки крупной ячеи, внутренняя — мелкой.',
       variations:['Ячея 50 мм','Ячея 65 мм','Ячея 70 мм'],activeVar:1,
       specs:sp({Тип:'Трёхстенная',Материал:'Капрон / леска','Внутр. ячея':'65 мм',Высота:'1,5 м',Длина:'30 м',Оснастка:'Грузшнур'})},
      {id:'s3',name:'Кастинговая сеть «Американка»',sku:'RHS-310',price:3450,oldPrice:3990,stock:8,rating:4,reviews:39,sales:198,
       desc:'Накидная парашютная сеть. Быстрый заброс одной рукой, для живца и мелкой рыбы.',
       variations:['Ø 2,4 м','Ø 3,0 м','Ø 3,6 м'],activeVar:0,
       specs:sp({Тип:'Кастинговая',Диаметр:'2,4 м',Ячея:'14 мм',Огрузка:'0,9 кг',Сумка:'В комплекте'})},
      {id:'s4',name:'Бредень с мотней',sku:'RHS-420',price:5790,oldPrice:null,stock:5,rating:5,reviews:21,sales:87,
       desc:'Бредень для бригадной ловли на мелководье. Усиленные крылья, прочное сетеполотно.',
       variations:['Длина 15 м','Длина 20 м','Длина 25 м'],activeVar:1,
       specs:sp({Тип:'Бредень',Материал:'Капрон',Длина:'20 м','Высота крыла':'1,5 м',Мотня:'Усиленная',Ячея:'10 мм'})},
      {id:'s5',name:'Экран рыболовный «Телевизор»',sku:'RHS-515',price:640,oldPrice:790,stock:40,rating:4,reviews:33,sales:151,
       desc:'Компактный экран на рамке для ловли мелкой рыбы и живца с лодки.',
       variations:['0,7×1,0 м','1,0×1,5 м'],activeVar:1,
       specs:sp({Тип:'Экран',Материал:'Леска',Размер:'1,0×1,5 м',Ячея:'20 мм',Рамка:'Складная'})}
    ]
  },
  {
    id:'g-shnur', name:'Шнур рыболовный', tagline:'Плетёные и капроновые шнуры', badge:null,
    products:[
      {id:'sh1',name:'Шнур капроновый плетёный',sku:'SHN-110',price:320,oldPrice:null,stock:120,rating:5,reviews:58,sales:410,
       desc:'Прочный шнур для оснастки сетей. Не гниёт, держит узел.',
       variations:['Ø 2 мм · 50 м','Ø 3 мм · 50 м','Ø 4 мм · 50 м'],activeVar:1,
       specs:sp({Материал:'Капрон',Диаметр:'3 мм',Длина:'50 м',Разрывная:'180 кг'})},
      {id:'sh2',name:'Шнур грузовой со свинцом',sku:'SHN-220',price:540,oldPrice:690,stock:64,rating:5,reviews:41,sales:228,
       desc:'Грузовой шнур с впрессованным свинцом — нижняя подбора для сетей.',
       variations:['25 г/м · 30 м','40 г/м · 30 м'],activeVar:0,
       specs:sp({Материал:'ПП + свинец',Огрузка:'25 г/м',Длина:'30 м'})},
      {id:'sh3',name:'Шнур поплавочный (верхняя подбора)',sku:'SHN-330',price:380,oldPrice:null,stock:80,rating:4,reviews:27,sales:140,
       desc:'Плавучий шнур для верхней подборы сети. Яркий, заметный на воде.',
       variations:['Ø 4 мм · 50 м','Ø 5 мм · 50 м'],activeVar:0,
       specs:sp({Материал:'Вспен. ПП',Диаметр:'4 мм',Длина:'50 м',Плавучесть:'Положительная'})},
      {id:'sh4',name:'Шнур монтажный универсальный',sku:'SHN-440',price:260,oldPrice:null,stock:150,rating:4,reviews:19,sales:96,
       desc:'Тонкий прочный шнур для посадки и ремонта сетей.',
       variations:['Ø 1 мм · 100 м','Ø 1,5 мм · 100 м'],activeVar:0,
       specs:sp({Материал:'Капрон',Диаметр:'1 мм',Длина:'100 м'})}
    ]
  },
  {
    id:'g-poplavki', name:'Набор поплавков', tagline:'Поплавки для сетей и удочек', badge:null,
    products:[
      {id:'p1',name:'Поплавки сетевые пенопластовые',sku:'POP-100',price:210,oldPrice:null,stock:90,rating:5,reviews:62,sales:330,
       desc:'Набор сетевых поплавков из пенопласта. Лёгкие, не впитывают воду.',
       variations:['50 шт','100 шт','200 шт'],activeVar:1,
       specs:sp({Материал:'Пенопласт','В наборе':'100 шт',Размер:'25×12 мм'})},
      {id:'p2',name:'Поплавки сетевые ЭВА',sku:'POP-210',price:340,oldPrice:420,stock:70,rating:5,reviews:38,sales:205,
       desc:'Мягкие поплавки из ЭВА — прочнее пенопласта, не крошатся.',
       variations:['50 шт','100 шт'],activeVar:1,
       specs:sp({Материал:'ЭВА','В наборе':'100 шт',Размер:'30×14 мм'})},
      {id:'p3',name:'Поплавки удочные (набор)',sku:'POP-320',price:290,oldPrice:null,stock:55,rating:4,reviews:24,sales:118,
       desc:'Ассорти поплавков разной грузоподъёмности для удочки.',
       variations:['Набор 10 шт','Набор 20 шт'],activeVar:0,
       specs:sp({Тип:'Удочные','В наборе':'10 шт',Огрузка:'1–6 г'})},
      {id:'p4',name:'Кухтыли (буи) сигнальные',sku:'POP-430',price:480,oldPrice:null,stock:30,rating:4,reviews:15,sales:74,
       desc:'Сигнальные буи для обозначения постановки сетей на воде.',
       variations:['Ø 12 см','Ø 16 см'],activeVar:0,
       specs:sp({Материал:'Пластик',Диаметр:'12 см',Цвет:'Оранжевый'})}
    ]
  },
  {
    id:'g-prikormka', name:'Прикормка', tagline:'Привлечение и удержание рыбы', badge:'Сезон',
    products:[
      {id:'pr1',name:'Прикормка «Лещ-Карась» 1 кг',sku:'PRK-100',price:230,oldPrice:290,stock:140,rating:5,reviews:88,sales:520,
       desc:'Универсальная прикормка для леща и карася. Ароматизированная, хорошо лепится.',
       variations:['Ваниль','Мёд','Анис'],activeVar:0,
       specs:sp({Вес:'1 кг',Цель:'Лещ, карась',Аромат:'Ваниль'})},
      {id:'pr2',name:'Прикормка «Карп» 2 кг',sku:'PRK-210',price:410,oldPrice:null,stock:95,rating:5,reviews:54,sales:310,
       desc:'Питательная прикормка для карпа с крупной фракцией.',
       variations:['Кукуруза','Клубника','Специи'],activeVar:0,
       specs:sp({Вес:'2 кг',Цель:'Карп',Фракция:'Крупная'})},
      {id:'pr3',name:'Ароматизатор-дип жидкий',sku:'PRK-320',price:180,oldPrice:null,stock:200,rating:4,reviews:36,sales:160,
       desc:'Концентрированный ароматизатор для замачивания насадки.',
       variations:['100 мл','250 мл'],activeVar:0,
       specs:sp({Объём:'100 мл',Тип:'Дип',Аромат:'Мотыль'})},
      {id:'pr4',name:'Пеллетс прикормочный 0,8 кг',sku:'PRK-430',price:260,oldPrice:320,stock:80,rating:5,reviews:29,sales:142,
       desc:'Гранулированный пеллетс для прикормочной кормушки.',
       variations:['Ø 4 мм','Ø 6 мм','Ø 8 мм'],activeVar:1,
       specs:sp({Вес:'0,8 кг',Гранула:'6 мм',Тип:'Тонущий'})}
    ]
  },
  {
    id:'g-komplekt', name:'Комплектующие', tagline:'Всё для оснастки и ремонта', badge:null,
    products:[
      {id:'k1',name:'Грузила свинцовые сетевые',sku:'KMP-100',price:150,oldPrice:null,stock:300,rating:5,reviews:44,sales:260,
       desc:'Свинцовые грузила-кольца для нижней подборы сетей.',
       variations:['20 г · 20 шт','30 г · 20 шт','50 г · 10 шт'],activeVar:1,
       specs:sp({Материал:'Свинец',Вес:'30 г','В наборе':'20 шт'})},
      {id:'k2',name:'Игла сетевязальная (челнок)',sku:'KMP-210',price:90,oldPrice:null,stock:180,rating:5,reviews:31,sales:175,
       desc:'Пластиковый челнок для вязки и ремонта сетей.',
       variations:['Малый','Средний','Большой'],activeVar:1,
       specs:sp({Материал:'Пластик',Размер:'Средний',Длина:'150 мм'})},
      {id:'k3',name:'Карабины и вертлюги (набор)',sku:'KMP-320',price:170,oldPrice:210,stock:120,rating:4,reviews:22,sales:108,
       desc:'Набор карабинов с вертлюгами для оснастки.',
       variations:['№6 · 20 шт','№8 · 20 шт'],activeVar:0,
       specs:sp({Материал:'Сталь',Размер:'№6','В наборе':'20 шт'})},
      {id:'k4',name:'Ремкомплект для сетей',sku:'KMP-430',price:340,oldPrice:null,stock:60,rating:5,reviews:18,sales:80,
       desc:'Нить, челнок и шаблон ячеи в одном наборе для ремонта.',
       variations:['Базовый','Расширенный'],activeVar:0,
       specs:sp({Состав:'Нить + челнок + шаблон',Нить:'100 м'})},
      {id:'k5',name:'Шаблон для вязки ячеи',sku:'KMP-540',price:120,oldPrice:null,stock:140,rating:4,reviews:14,sales:62,
       desc:'Набор пластиковых шаблонов для ровной ячеи.',
       variations:['30/40 мм','50/60 мм'],activeVar:0,
       specs:sp({Материал:'Пластик',Размеры:'30/40 мм'})}
    ]
  }
];

const DEFAULT_BLOG = [
  {id:'b1',date:'18 июня 2026',title:'Как выбрать ячею сети под нужную рыбу',
   excerpt:'Разбираем: какая ячея ловит карася, какая — щуку, и почему «чем мельче — тем лучше» это миф.'},
  {id:'b2',date:'4 июня 2026',title:'Новинки сезона: кастинговые сети «Американка»',
   excerpt:'Привезли партию накидных сетей трёх диаметров. Рассказываем, кому и зачем они нужны.'},
  {id:'b3',date:'21 мая 2026',title:'Уход за рыболовной сетью: чтобы служила годами',
   excerpt:'Сушка, хранение, ремонт ячеи. Простые правила, которые продлевают жизнь снасти.'},
  {id:'b4',date:'7 мая 2026',title:'Правила любительского рыболовства 2026',
   excerpt:'Где и какими сетями можно ловить легально. Коротко о главных изменениях.'}
];

/* ============================================================
   УТИЛИТЫ
============================================================ */
function hashPass(pass) {
  /* простой детерминированный хэш для демо (не crpyto-safe!) */
  let h = 0x811c9dc5;
  for (let i = 0; i < pass.length; i++) {
    h ^= pass.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function uid() { return 'u' + Date.now() + Math.random().toString(36).slice(2, 7); }

/* ============================================================
   USERS — таблица пользователей
   Структура записи:
   { id, name, email, phone, passHash,
     cart:[{pid,var,qty}], favorites:[pid],
     orders:[], bonus:0, addresses:[], createdAt }
============================================================ */
const Users = {
  _table: null,

  /* асинхронная инициализация: облако (Supabase) → IndexedDB → localStorage */
  async init() {
    if (this._table) return;
    // 1) облако — общий список клиентов для всех устройств
    let cloudData = null;
    try {
      await Cloud.init();
      if (Cloud.enabled) cloudData = await Cloud.loadClients();
    } catch (e) { cloudData = null; }

    if (cloudData && Object.keys(cloudData).length) {
      this._table = cloudData;
      // подстрахуемся локально
      try { localStorage.setItem(USERS_KEY, JSON.stringify(this._table)); } catch (e) {}
      DB.set(USERS_KEY, this._table);
      return;
    }

    // 2) локальные данные
    let data = await DB.get(USERS_KEY);
    if (!data) {
      try { data = JSON.parse(localStorage.getItem(USERS_KEY)); } catch (e) { data = null; }
      if (data) { await DB.set(USERS_KEY, data); }
    }
    this._table = data || {};

    // если есть локальные клиенты, а в облаке пусто — зальём в облако
    if (Cloud.enabled && this._table && Object.keys(this._table).length) {
      try {
        for (const email in this._table) await Cloud.saveClient(this._table[email]);
      } catch (e) {}
    }
  },

  _load() {
    if (this._table) return;
    // синхронный fallback (если init ещё не отработал)
    try { this._table = JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch (e) { this._table = {}; }
  },

  _save() {
    // память + персистентность в IndexedDB (фоном)
    try { localStorage.setItem(USERS_KEY, JSON.stringify(this._table)); } catch (e) {}
    DB.set(USERS_KEY, this._table);
  },

  /* сохранить одного клиента в облако (вызывается из save(u)) */
  _saveClientCloud(u) {
    if (Cloud.enabled && u && u.email) {
      Cloud.saveClient(u).catch(() => {});
    }
  },

  /* новый пустой профиль */
  _blank(id, name, email, phone, passHash) {
    return { id, name, email: email.toLowerCase().trim(), phone, passHash,
      passwordSet: true,        // false — пароль сгенерирован автоматически (гостевой заказ), клиент его не знает
      cart: [], favorites: [], orders: [], bonus: 0,
      manualDiscount: 0,        // ручная скидка %, назначенная админом
      autoDiscountOff: false,   // автоскидка отключена индивидуально для этого клиента
      blocked: false,           // в чёрном списке
      avatar: '',               // аватар (data URI)
      bio: '',                  // информация о себе
      addresses: [], createdAt: new Date().toISOString() };
  },

  /* подсчёт автоматической скидки по числу выполненных покупок */
  autoDiscount(u) {
    const tiers = Store.discountTiers();
    const count = (u.orders || []).length;
    let pct = 0;
    for (const t of tiers) { if (count >= t.orders) pct = t.pct; }
    return pct;
  },

  /* итоговая скидка клиента = max(авто, ручная), но не больше максимума */
  effectiveDiscount(u) {
    if (!u) return 0;
    const auto = Store.discountsEnabled() ? this.autoDiscount(u) : 0;
    const manual = u.manualDiscount || 0;
    const maxD = Store.discountMax();
    return Math.min(Math.max(auto, manual), maxD);
  },

  setManualDiscount(email, pct) {
    const u = this.get(email);
    if (!u) return false;
    u.manualDiscount = Math.max(0, Math.min(100, pct));
    this.save(u);
    return true;
  },

  setBlocked(email, blocked) {
    const u = this.get(email);
    if (!u) return false;
    u.blocked = !!blocked;
    this.save(u);
    return true;
  },

  remove(email) {
    this._load();
    const key = email.toLowerCase().trim();
    delete this._table[key];
    this._save();
    if (Cloud.enabled) Cloud.deleteClient(key).catch(() => {});
  },

  /* регистрация → null если email уже занят */
  register(name, email, phone, pass) {
    this._load();
    const key = email.toLowerCase().trim();
    if (this._table[key]) return null; // уже существует
    const u = this._blank(uid(), name.trim(), key, phone.trim(), hashPass(pass));
    this._table[key] = u;
    this._save();
    this._saveClientCloud(u); // регистрация видна всем устройствам
    return u;
  },

  /* вход → user или null. Заблокированные → строка-ошибка 'blocked' */
  login(email, pass) {
    this._load();
    const u = this._table[email.toLowerCase().trim()];
    if (!u || u.passHash !== hashPass(pass)) return null;
    if (u.blocked) return 'blocked';
    return u;
  },

  /* сохранить изменения в конкретном пользователе */
  save(u) {
    this._load();
    this._table[u.email] = u;
    this._save();
    this._saveClientCloud(u); // синхронизация с облаком
  },

  get(email) {
    this._load();
    return this._table[email.toLowerCase().trim()] || null;
  },

  /* сменить пароль (требует старый — для аккаунтов с уже заданным паролем) */
  changePass(email, oldPass, newPass) {
    const u = this.get(email);
    if (!u || u.passHash !== hashPass(oldPass)) return false;
    u.passHash = hashPass(newPass);
    u.passwordSet = true;
    this.save(u);
    return true;
  },

  /* задать пароль впервые (без проверки старого — только для аккаунтов,
     где passwordSet=false, т.е. пароль был сгенерирован автоматически
     при гостевом заказе и клиент его не знает) */
  setPass(email, newPass) {
    const u = this.get(email);
    if (!u) return false;
    u.passHash = hashPass(newPass);
    u.passwordSet = true;
    this.save(u);
    return true;
  },

  all() { this._load(); return Object.values(this._table); }
};

/* ============================================================
   SESSION — текущая сессия пользователя
============================================================ */
const Session = {
  _u: null, // кешированный объект пользователя

  /* загрузить сессию из sessionStorage */
  load() {
    try {
      const email = sessionStorage.getItem(SESSION_KEY);
      this._u = email ? Users.get(email) : null;
    } catch (e) { this._u = null; }
    return this._u;
  },

  /* вернуть текущего пользователя (или null) */
  user() { return this._u; },

  /* залогинен? */
  loggedIn() { return !!this._u; },

  /* открыть сессию */
  start(u) {
    this._u = u;
    try { sessionStorage.setItem(SESSION_KEY, u.email); } catch (e) {}
  },

  /* завершить сессию */
  end() {
    this._u = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  },

  /* обновить кеш (после изменений пользователя) */
  refresh() {
    if (this._u) this._u = Users.get(this._u.email) || this._u;
  },

  /* ---- корзина текущего пользователя ---- */
  cartCount() { return (this._u?.cart || []).reduce((s, i) => s + i.qty, 0); },
  cartTotal(getProduct) {
    return (this._u?.cart || []).reduce((s, i) => {
      const p = getProduct(i.pid); return p ? s + p.price * i.qty : s;
    }, 0);
  },
  addToCart(pid, varIdx = 0, qty = 1) {
    if (!this._u) return false;
    const ex = this._u.cart.find(i => i.pid === pid && i.var === varIdx);
    if (ex) ex.qty += qty; else this._u.cart.push({ pid, var: varIdx, qty });
    Users.save(this._u); return true;
  },
  removeFromCart(idx) {
    if (!this._u) return;
    this._u.cart.splice(idx, 1); Users.save(this._u);
  },
  setCartQty(idx, qty) {
    if (!this._u) return;
    this._u.cart[idx].qty = Math.max(1, qty); Users.save(this._u);
  },
  clearCart() { if (this._u) { this._u.cart = []; Users.save(this._u); } },

  /* ---- избранное ---- */
  isFav(pid) { return (this._u?.favorites || []).includes(pid); },
  toggleFav(pid) {
    if (!this._u) return false;
    const i = this._u.favorites.indexOf(pid);
    if (i >= 0) this._u.favorites.splice(i, 1); else this._u.favorites.push(pid);
    Users.save(this._u); return true;
  },
  favCount() { return (this._u?.favorites || []).length; },

  /* ---- заказы ---- */
  placeOrder(info, getProduct) {
    if (!this._u) return null;
    const total = this.cartTotal(getProduct);
    const order = {
      id: 'RH-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleDateString('ru-RU'),
      items: JSON.parse(JSON.stringify(this._u.cart)),
      total, info, status: 'way'
    };
    this._u.orders.unshift(order);
    this._u.bonus += Math.round(total * 0.05);
    this._u.cart = [];
    Users.save(this._u);
    return order;
  }
};

/* ============================================================
   Store — каталог, блог и контент (общий для всех)
============================================================ */
const Store = {
  state: null,

  _defaults() {
    return {
      groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
      blog:   JSON.parse(JSON.stringify(DEFAULT_BLOG)),
      isAdmin: false,
      adminPassHash: hashPass('admin'), // пароль администратора (по умолчанию "admin", меняется в админ-панели)
      content: {},
      /* настройки скидок */
      discounts: {
        enabled: true,           // автоматические скидки включены
        max: 10,                 // максимальная скидка %
        tiers: [                 // пороги: orders покупок → pct%
          { orders: 10, pct: 1 },
          { orders: 30, pct: 2 },
          { orders: 50, pct: 4 },
          { orders: 80, pct: 6 },
          { orders: 120, pct: 8 },
          { orders: 200, pct: 10 }
        ]
      },
      /* кастомные блоки информации по разделам (about/delivery/contacts/privacy/...) */
      sections: {},
      /* guest mode data (when not logged in) */
      cart: [], favorites: [], orders: [], bonus: 0,
      user: { name:'Гость', phone:'', email:'' }
    };
  },

  discountsEnabled() { return !!(this.state.discounts && this.state.discounts.enabled); },
  discountMax() { return (this.state.discounts && this.state.discounts.max) || 10; },
  discountTiers() {
    const t = (this.state.discounts && this.state.discounts.tiers) || [];
    return t.slice().sort((a,b)=>a.orders-b.orders);
  },

  /* ---- пароль администратора ---- */
  checkAdminPass(pass) {
    return hashPass(pass||'') === (this.state.adminPassHash || hashPass('admin'));
  },
  async changeAdminPass(oldPass, newPass) {
    if (!this.checkAdminPass(oldPass)) return false;
    this.state.adminPassHash = hashPass(newPass);
    await this.save();
    return true;
  },

  /* асинхронная инициализация: облако (Supabase) → IndexedDB → localStorage */
  async init() {
    // 1) пробуем облако — это общие данные для всех посетителей
    let cloudRaw = null;
    try {
      await Cloud.init();
      if (Cloud.enabled) cloudRaw = await Cloud.loadState();
    } catch (e) { cloudRaw = null; }

    let raw = cloudRaw;

    // 2) если облако пустое/недоступно — берём локальные данные
    if (!raw || !raw.groups) {
      raw = await DB.get(STORE_KEY);
      if (!raw) {
        try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { raw = null; }
        if (raw) await DB.set(STORE_KEY, raw);
      }
      // если есть локальные данные, а облако настроено но пустое — зальём локальные в облако
      if (raw && raw.groups && Cloud.enabled && (!cloudRaw || !cloudRaw.groups)) {
        try { await Cloud.saveState(raw); } catch (e) {}
      }
    }

    try {
      this.state = raw ? Object.assign(this._defaults(), raw) : this._defaults();
      if (!this.state.groups) this.state.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
      if (!this.state.blog)   this.state.blog   = JSON.parse(JSON.stringify(DEFAULT_BLOG));
      if (!this.state.discounts) this.state.discounts = this._defaults().discounts;
      if (!this.state.sections)  this.state.sections = {};
    } catch (e) { this.state = this._defaults(); }
    this.state.isAdmin = false;
    return this.state;
  },

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      this.state = raw ? Object.assign(this._defaults(), JSON.parse(raw)) : this._defaults();
      if (!this.state.groups) this.state.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
      if (!this.state.blog)   this.state.blog   = JSON.parse(JSON.stringify(DEFAULT_BLOG));
      if (!this.state.discounts) this.state.discounts = this._defaults().discounts;
      if (!this.state.sections)  this.state.sections = {};
    } catch (e) { this.state = this._defaults(); }
    this.state.isAdmin = false;
    return this.state;
  },

  /* save → Promise<bool>. Пишет в облако (для всех) + локально (резерв) */
  save() {
    const {isAdmin, ...rest} = this.state;
    // локальный резерв
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rest)); } catch (e) {}
    const localP = DB.set(STORE_KEY, rest);
    // облако — общее хранилище
    if (Cloud.enabled) {
      return Cloud.saveState(rest).then(ok => ok).catch(() => localP);
    }
    return localP;
  },

  reset() {
    this.state = this._defaults(); this.save();
    try { localStorage.removeItem(USERS_KEY); } catch (e) {}
    DB.del(USERS_KEY);
    if (Users) Users._table = {};
  },

  group(id)  { return this.state.groups.find(g => g.id === id); },
  product(pid) {
    for (const g of this.state.groups) {
      const p = g.products.find(x => x.id === pid);
      if (p) return { ...p, groupId: g.id, groupName: g.name };
    }
    return null;
  },
  rawProduct(pid) {
    for (const g of this.state.groups) {
      const p = g.products.find(x => x.id === pid); if (p) return p;
    }
    return null;
  }
};

/* ============================================================
   COMPAT LAYER — Store получает методы корзины/избранного
   которые автоматически переключаются между Session и своими данными
============================================================ */
Object.defineProperties(Store, {
  _u:     { get(){ return Session._u; }, configurable:true },
  _cart:  { get(){ const u=Session._u; return u ? u.cart   : (this.state.cart   ||(this.state.cart   =[])); }, configurable:true },
  _favs:  { get(){ const u=Session._u; return u ? u.favorites:(this.state.favorites||(this.state.favorites=[])); }, configurable:true },
  _orders:{ get(){ const u=Session._u; return u ? u.orders  : (this.state.orders  ||(this.state.orders  =[])); }, configurable:true }
});

Object.assign(Store, {

  cartCount(){ return this._cart.reduce((s,i)=>s+i.qty,0); },
  cartSubtotal(){
    return this._cart.reduce((s,i)=>{const p=this.product(i.pid);return p?s+p.price*i.qty:s;},0);
  },
  /* текущая скидка % залогиненного клиента (0 для гостя) */
  currentDiscount(){
    const u = (typeof Session!=='undefined') ? Session._u : null;
    return u ? Users.effectiveDiscount(u) : 0;
  },
  cartDiscountAmount(){
    return Math.round(this.cartSubtotal() * this.currentDiscount() / 100);
  },
  cartTotal(){
    return this.cartSubtotal() - this.cartDiscountAmount();
  },
  addToCart(pid,varIdx=0,qty=1){
    if(this._u){ Session.addToCart(pid,varIdx,qty); return; }
    const ex=this._cart.find(i=>i.pid===pid&&i.var===varIdx);
    if(ex)ex.qty+=qty; else this._cart.push({pid,var:varIdx,qty});
    this.save();
  },
  removeFromCart(idx){ 
    if(this._u){Session.removeFromCart(idx);return;}
    this._cart.splice(idx,1); this.save(); 
  },
  setCartQty(idx,qty){
    if(this._u){Session.setCartQty(idx,qty);return;}
    this._cart[idx].qty=Math.max(1,qty); this.save();
  },
  isFav(pid){ return this._favs.includes(pid); },
  toggleFav(pid){
    if(this._u){Session.toggleFav(pid);return;}
    const i=this._favs.indexOf(pid);
    if(i>=0)this._favs.splice(i,1); else this._favs.push(pid);
    this.save();
  },
  placeOrder(info){
    if(this._u){ return Session.placeOrder(info,id=>this.product(id)); }

    // ГОСТЬ оформляет заказ без регистрации — аккаунт создаётся/находится
    // автоматически по email (если указан) или по телефону, и заказ
    // подвязывается к нему. Пароль не запрашивается: повторный вход
    // на этот же клиент сейчас возможен только с этого браузера
    // (сессия), либо через будущий вход по SMS/Telegram.
    const digits = (info.phone||'').replace(/\D/g,'');
    const key = (info.email && info.email.trim())
      ? info.email.trim().toLowerCase()
      : `g${digits || Date.now()}@guest.rybhoz`;

    let u = Users.get(key);
    if(!u){
      u = Users.register(info.name||'Клиент', key, info.phone||'', Math.random().toString(36).slice(2,10));
      if(u){ u.passwordSet = false; Users.save(u); }
    }

    if(u){
      // перенести локальную гостевую корзину/заказы (если были) в новый аккаунт
      const cart = JSON.parse(JSON.stringify(this._cart||[]));
      const total = cart.reduce((s,i)=>{const p=this.product(i.pid);return p?s+p.price*i.qty:s;},0);
      const order = { id:'RH-'+Math.floor(100000+Math.random()*900000),
        date:new Date().toLocaleDateString('ru-RU'),
        items: cart, total, info, status:'way' };
      u.orders.unshift(order);
      u.bonus = (u.bonus||0) + Math.round(total*0.05);
      u.cart = [];
      Users.save(u);
      Session.start(u); // тихо авторизуем в этом браузере — виден кабинет/бонусы/история
      this.state.cart = []; this.save();
      return order;
    }

    // фолбэк — если по какой-то причине аккаунт создать не удалось
    const total=this.cartTotal();
    const order={id:'RH-'+Math.floor(100000+Math.random()*900000),
      date:new Date().toLocaleDateString('ru-RU'),
      items:JSON.parse(JSON.stringify(this._cart)),total,info,status:'way'};
    this._orders.unshift(order);
    this.state.bonus=(this.state.bonus||0)+Math.round(total*0.05);
    this.state.cart=[]; this.save(); return order;
  }
});
