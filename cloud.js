/* ============================================================
   cloud.js — облачное хранилище (Supabase)
   - состояние магазина (каталог/блог/настройки) в таблице shop_state
   - клиенты в таблице clients
   - картинки в Storage bucket 'images' (публичные ссылки)

   Если ключи не заданы в config.js — Cloud.enabled = false,
   и приложение работает на локальном IndexedDB как раньше.
============================================================ */
const Cloud = {
  enabled: false,
  _sb: null,
  _ready: null,

  /* загрузка SDK Supabase с CDN + инициализация */
  init() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
      if (!url || !key) { this.enabled = false; return false; }
      try {
        await this._loadSDK();
        // глобальный supabase из UMD-сборки
        this._sb = window.supabase.createClient(url, key);
        this.enabled = true;
        return true;
      } catch (e) {
        console.warn('Supabase init failed, falling back to local storage', e);
        this.enabled = false;
        return false;
      }
    })();
    return this._ready;
  },

  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('SDK load failed'));
      document.head.appendChild(s);
    });
  },

  /* ---------- СОСТОЯНИЕ МАГАЗИНА ---------- */
  async loadState() {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this._sb
        .from('shop_state').select('data').eq('id', 'main').single();
      if (error) { console.warn('loadState error', error); return null; }
      return data ? data.data : null;
    } catch (e) { console.warn('loadState exception', e); return null; }
  },

  async saveState(stateObj) {
    if (!this.enabled) return false;
    try {
      const { error } = await this._sb
        .from('shop_state')
        .upsert({ id: 'main', data: stateObj, updated_at: new Date().toISOString() });
      if (error) { console.warn('saveState error', error); return false; }
      return true;
    } catch (e) { console.warn('saveState exception', e); return false; }
  },

  /* ---------- КЛИЕНТЫ ---------- */
  async loadClients() {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this._sb.from('clients').select('email, data');
      if (error) { console.warn('loadClients error', error); return null; }
      const table = {};
      (data || []).forEach(row => { table[row.email] = row.data; });
      return table;
    } catch (e) { console.warn('loadClients exception', e); return null; }
  },

  async saveClient(clientObj) {
    if (!this.enabled || !clientObj || !clientObj.email) return false;
    try {
      const { error } = await this._sb
        .from('clients')
        .upsert({ email: clientObj.email, data: clientObj, updated_at: new Date().toISOString() });
      if (error) { console.warn('saveClient error', error); return false; }
      return true;
    } catch (e) { console.warn('saveClient exception', e); return false; }
  },

  async deleteClient(email) {
    if (!this.enabled) return false;
    try {
      const { error } = await this._sb.from('clients').delete().eq('email', email);
      return !error;
    } catch (e) { return false; }
  },

  /* ---------- КАРТИНКИ ----------
     Принимает dataURL (или http-URL), грузит в Storage,
     возвращает публичную ссылку. http(s)-ссылки и уже-загруженные
     supabase-ссылки возвращаются как есть. */
  async uploadImage(dataUrl) {
    if (!this.enabled) return dataUrl; // нет облака — оставляем как есть (data URI)
    // Уже публичная ссылка (не data:) — не трогаем
    if (typeof dataUrl === 'string' && !dataUrl.startsWith('data:')) return dataUrl;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const name = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await this._sb.storage.from('images').upload(name, blob, {
        contentType: blob.type, upsert: false
      });
      if (error) { console.warn('uploadImage error', error); return dataUrl; }
      const { data } = this._sb.storage.from('images').getPublicUrl(name);
      return (data && data.publicUrl) ? data.publicUrl : dataUrl;
    } catch (e) { console.warn('uploadImage exception', e); return dataUrl; }
  }
};
