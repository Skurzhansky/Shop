/* ============================================================
   app.js — РыбХоз Сети
   SPA-роутер, страницы, корзина, админ-режим, анимации фона
============================================================ */
(function(){
'use strict';

const S = Store;
S.load(); // синхронный быстрый старт (localStorage), затем перезагрузим из IndexedDB
Session.load(); // загружаем сессию пользователя сразу

const app = document.getElementById('app');
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const money = n => n.toLocaleString('ru-RU') + ' ₽';
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---- иконка-«сеть» как плейсхолдер изображения ---- */
const netPH = () => `<svg class="ph-net" viewBox="0 0 100 100">
  <g fill="none" stroke="currentColor" stroke-width="2.2">
    <path d="M8 22 Q50 12 92 22 L86 86 Q50 96 14 86 Z"/>
    ${[26,40,54,68,82].map(y=>`<path d="M${10+(y-22)*0.08} ${y} Q50 ${y-6} ${90-(y-22)*0.08} ${y}"/>`).join('')}
    ${[20,35,50,65,80].map(x=>`<path d="M${x} 18 L${x} 88"/>`).join('')}
  </g>
</svg>`;

const fishSVG = (cls='fd-fish') => `<img src="assets/fish.png" class="${cls}" alt="рыба" style="width:50px;height:62px;object-fit:contain">`;

/* ============================================================
   TOAST
============================================================ */
function toast(msg, type=''){
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toastStack').appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

/* ============================================================
   ШАПКА: счётчики, активная ссылка
============================================================ */
function refreshChrome(){
  const u = Session.user();
  if(u){
    $('#cartCount').textContent = (u.cart||[]).reduce((s,i)=>s+i.qty,0);
    $('#favBadge').textContent = (u.favorites||[]).length;
  } else {
    $('#cartCount').textContent = S.cartCount();
    $('#favBadge').textContent = S._favs.length;
  }
  const route = (location.hash||'#/').split('?')[0];
  $$('.mainnav-inner a[data-link]').forEach(a=>{
    a.classList.toggle('active', a.getAttribute('href')===route);
  });
  const adminBtn = $('#adminToggle');
  adminBtn.classList.toggle('on', S.state.isAdmin);
  adminBtn.textContent = S.state.isAdmin ? 'Выйти из админа' : 'Админ';
  $('#modeIndicator').textContent = S.state.isAdmin ? 'Режим администратора' : '';
  document.body.classList.toggle('admin', S.state.isAdmin);
}

/* ============================================================
   КОМПОНЕНТ: карточка товара
============================================================ */
function starRow(rating){
  let s='<span class="rstars">';
  for(let i=1;i<=5;i++){
    s += `<svg viewBox="0 0 24 24" class="${i<=rating?'':'empty'}"><use href="#star"/></svg>`;
  }
  return s+'</span>';
}

function stockLabel(p){
  if(p.stock<=0) return '<span class="prod-stock out">Нет в наличии</span>';
  if(p.stock<=8) return `<span class="prod-stock low">Осталось ${p.stock} шт</span>`;
  return `<span class="prod-stock in">В наличии · ${p.stock} шт</span>`;
}

function productCard(p, featured=false){
  const fav = S.isFav(p.id);
  const adminEdit = S.state.isAdmin ? `
    <div class="admin-edit">
      <button data-edit="${p.id}" title="Редактировать">${iconPencil()}</button>
      <button data-del="${p.id}" title="Удалить">${iconTrash()}</button>
    </div>` : '';
  const old = p.oldPrice ? `<span class="pold">${money(p.oldPrice)}</span>` : '';
  const badge = p.badge ? `<span class="hc-tag" style="position:absolute;top:14px;left:14px;background:var(--orange);color:#15293f">${esc(p.badge)}</span>` : '';

  return `<article class="prod-card ${featured?'featured':''}" data-pid="${p.id}">
    ${badge}${adminEdit}
    <div class="prod-top">
      <a class="prod-media" href="#/product?id=${p.id}" data-link>
        ${(p.images&&p.images[0])||p.image ? `<img src="${esc((p.images&&p.images[0])||p.image)}" alt="">` : netPH()}
      </a>
      <div class="prod-info">
        <a href="#/product?id=${p.id}" data-link><span class="prod-name">${esc(p.name)}</span></a>
        <span class="prod-sku">Артикул: ${esc(p.sku)}</span>
        <div class="prod-rating">${starRow(p.rating)} <span>${p.rating}.0 · ${p.reviews} отзывов</span></div>
        ${featured?`<p class="prod-desc">${esc(p.desc)}</p>`:''}
        ${stockLabel(p)}
      </div>
    </div>
    <div class="prod-bottom">
      <div class="prod-price"><span class="pv"><span class="cur">от </span>${money(p.price)}</span>${old}</div>
      <div class="prod-actions">
        <button class="icon-btn ${fav?'active':''}" data-fav="${p.id}" title="В избранное">
          <svg><use href="#heart"/></svg>
        </button>
        <button class="btn ${p.stock<=0?'ghost':''}" data-add="${p.id}" ${p.stock<=0?'disabled':''}>
          ${p.stock<=0?'Нет в наличии':'В корзину'}
        </button>
      </div>
    </div>
  </article>`;
}

function iconPencil(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17v3z"/><path d="M14 6l3 3"/></svg>';}
function iconTrash(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg>';}

/* ============================================================
   КОМПОНЕНТ: карточка-ГРУППА с каруселью товаров внутри
============================================================ */
function groupCard(g, big=false){
  // если у группы задана своя обложка — показываем её фоном на всю карточку
  const cover = g.cover;
  const slides = g.products.map((p,i)=>`
    <div class="gc-slide ${i===0?'active':''}" data-slide="${i}">
      <div class="gc-slide-img">${(p.images&&p.images[0])||p.image?`<img src="${esc((p.images&&p.images[0])||p.image)}">`:netPH()}</div>
      <div class="gc-slide-cap">
        <div>
          <div class="nm">${esc(p.name)}</div>
          <div class="sk">Артикул: ${esc(p.sku)}</div>
        </div>
        <div class="pr">${money(p.price)}</div>
      </div>
    </div>`).join('');

  const dots = g.products.map((_,i)=>`<button class="gc-dot ${i===0?'active':''}" data-dot="${i}" aria-label="Товар ${i+1}"></button>`).join('');

  // Витрина группы: либо своя обложка, либо карусель товаров
  const stage = cover
    ? `<div class="gc-stage gc-cover-stage" data-carousel="${g.id}">
         <img class="gc-cover-img" src="${esc(cover)}" alt="${esc(g.name)}">
       </div>`
    : `<div class="gc-stage" data-carousel="${g.id}">${slides}</div>
       <div class="gc-dots">${dots}</div>`;

  return `<article class="group-card ${big?'big':'small'}" data-group="${g.id}">
    <span class="gc-count">${g.products.length} тов.</span>
    ${S.state.isAdmin?`<button class="gc-edit" data-editgroup="${g.id}" title="Настроить витрину группы">🖼 Витрина</button>`:''}
    <div class="gc-head">
      <div>
        <div class="gc-title">${esc(g.name)}</div>
        <div class="gc-sub">${esc(g.tagline)}</div>
      </div>
      ${g.badge?`<span class="gc-badge">${esc(g.badge)}</span>`:''}
    </div>
    ${stage}
  </article>`;
}

/* запуск каруселей: каждый товар висит пару секунд, потом меняется */
const _carouselTimers = [];
function startCarousels(){
  _carouselTimers.forEach(t=>clearInterval(t)); _carouselTimers.length=0;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  $$('.gc-stage').forEach(stage=>{
    const card = stage.closest('.group-card');
    const slides = $$('.gc-slide', stage);
    const dots = $$('.gc-dot', card);
    if(slides.length<2) return;
    let cur=0, paused=false;
    function show(n){
      slides[cur].classList.remove('active'); dots[cur]?.classList.remove('active');
      cur=(n+slides.length)%slides.length;
      slides[cur].classList.add('active'); dots[cur]?.classList.add('active');
    }
    // ручное переключение точками
    dots.forEach((d,i)=>d.addEventListener('click',e=>{e.stopPropagation();show(i);}));
    // пауза при наведении
    card.addEventListener('mouseenter',()=>paused=true);
    card.addEventListener('mouseleave',()=>paused=false);
    const t=setInterval(()=>{ if(!paused) show(cur+1); }, 2600 + Math.random()*600);
    _carouselTimers.push(t);
  });
}

/* ============================================================
   СТРАНИЦА: ГЛАВНАЯ — 5 групп (Сети большой блок + 4 в сетке)
============================================================ */
function topSellersStrip(){
  // Собрать все товары из всех групп, отсортировать по продажам
  const all = [];
  S.state.groups.forEach(g => g.products.forEach(p => all.push({...p, groupId:g.id, groupName:g.name})));
  const top = all.filter(p=>p.stock>0).sort((a,b)=>b.sales-a.sales).slice(0,5);
  if(!top.length) return '';

  const cards = top.map((p, i) => {
    const img = (p.images&&p.images[0]) || p.image;
    const discount = p.oldPrice ? Math.round((1 - p.price/p.oldPrice)*100) : 0;
    return `
      <a class="tsp-card" href="#/product?id=${p.id}" data-link>
        <div class="tsp-rank">#${i+1}</div>
        <div class="tsp-img">
          ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : `<div class="tsp-ph">${netPH()}</div>`}
        </div>
        <div class="tsp-info">
          <div class="tsp-name">${esc(p.name)}</div>
          <div class="tsp-sku">Арт. ${esc(p.sku)}</div>
          <div class="tsp-bottom">
            <div class="tsp-price">${money(p.price)}</div>
            ${discount ? `<span class="tsp-disc">−${discount}%</span>` : ''}
          </div>
          <div class="tsp-sales">${p.sales} продаж</div>
        </div>
        ${i===0 ? '<div class="tsp-crown">🏆 Лидер</div>' : ''}
      </a>`;
  }).join('');

  return `
    <section class="tsp-wrap">
      <div class="tsp-head">
        <h2 class="tsp-title">🔥 Топ продаж</h2>
        <a href="#/catalog" data-link class="tsp-all">Весь каталог →</a>
      </div>
      <div class="tsp-row">${cards}</div>
    </section>`;
}

function pageHome(){
  const groups = S.state.groups;
  const main = groups[0];
  const rest = groups.slice(1);

  app.innerHTML = `
    ${adminBar()}

    <!-- ТОП ПРОДАЖ — горизонтальная полоса по продажам -->
    ${topSellersStrip()}

    <h2 class="page-title">Каталог по <span class="accent">группам товаров</span></h2>

    <section class="groups-wrap">
      ${groupCard(main, true)}
      <div class="groups-grid">
        ${rest.map(g=>groupCard(g)).join('')}
      </div>
    </section>

    <div class="cta-row">
      <button class="cta-big" data-link href="#/catalog">ПОМОЩЬ С ВЫБОРОМ</button>
    </div>
  `;
  startCarousels();
}

/* ============================================================
   СТРАНИЦА: ГРУППА — список всех товаров группы
============================================================ */
function pageGroup(params){
  const g = S.group(params.get('id'));
  if(!g){ app.innerHTML = emptyState('Группа не найдена','Возможно, она была удалена.','#/','На главную'); return; }

  app.innerHTML = `
    ${adminBar()}
    <div class="breadcrumbs"><a href="#/" data-link>Главная</a> / ${esc(g.name)}</div>
    <h1 class="page-title">${esc(g.name)}</h1>
    <p style="color:var(--ink-dim);margin:-8px 0 18px">${esc(g.tagline)} · ${g.products.length} позиций</p>
    <div class="toolbar">
      <select id="sortSel">
        <option value="pop">Сначала популярные</option>
        <option value="cheap">Сначала дешёвые</option>
        <option value="exp">Сначала дорогие</option>
        <option value="rating">По рейтингу</option>
      </select>
      <select id="stockSel">
        <option value="all">Все товары</option>
        <option value="in">Только в наличии</option>
        <option value="sale">Со скидкой</option>
      </select>
      <span class="spacer"></span>
      <span class="result-count" id="resCount"></span>
      ${S.state.isAdmin?`<button class="btn sm" id="addProd" data-gid="${g.id}">+ Товар в группу</button>`:''}
    </div>
    <div class="catalog-grid" id="grpGrid"></div>
  `;
  function render(){
    let l = g.products.map(p=>({...p, groupId:g.id, groupName:g.name}));
    const stock=$('#stockSel').value, sort=$('#sortSel').value;
    if(stock==='in') l=l.filter(p=>p.stock>0);
    if(stock==='sale') l=l.filter(p=>p.oldPrice);
    if(sort==='cheap') l.sort((a,b)=>a.price-b.price);
    if(sort==='exp') l.sort((a,b)=>b.price-a.price);
    if(sort==='rating') l.sort((a,b)=>b.rating-a.rating);
    if(sort==='pop') l.sort((a,b)=>b.sales-a.sales);
    $('#resCount').textContent = `Показано: ${l.length}`;
    $('#grpGrid').innerHTML = l.length? l.map(p=>productCard(p)).join('')
      : emptyState('В группе пока нет товаров','','#/','На главную');
  }
  $('#sortSel').onchange=render; $('#stockSel').onchange=render;
  render();
}

/* ============================================================
   СТРАНИЦА: КАТАЛОГ — все товары, сгруппированы по группам
============================================================ */
function pageCatalog(params){
  const q = (params.get('q')||'').toLowerCase();

  app.innerHTML = `
    ${adminBar()}
    <div class="breadcrumbs"><a href="#/" data-link>Главная</a> / Каталог</div>
    <h1 class="page-title">Каталог <span class="accent">сетей и снастей</span></h1>
    <div class="toolbar">
      <select id="grpSel">
        <option value="all">Все группы</option>
        ${S.state.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}
      </select>
      <select id="sortSel">
        <option value="pop">Сначала популярные</option>
        <option value="cheap">Сначала дешёвые</option>
        <option value="exp">Сначала дорогие</option>
        <option value="rating">По рейтингу</option>
      </select>
      <select id="stockSel">
        <option value="all">Все товары</option>
        <option value="in">Только в наличии</option>
        <option value="sale">Со скидкой</option>
      </select>
      <span class="spacer"></span>
      <span class="result-count" id="resCount"></span>
    </div>
    <div id="catBody"></div>
  `;

  function render(){
    const grpF=$('#grpSel').value, stock=$('#stockSel').value, sort=$('#sortSel').value;
    let total=0;
    const groups = S.state.groups.filter(g=> grpF==='all' || g.id===grpF);
    let html='';
    groups.forEach(g=>{
      let l = g.products.map(p=>({...p, groupId:g.id, groupName:g.name}));
      if(q) l = l.filter(p=>(p.name+p.sku+p.desc).toLowerCase().includes(q));
      if(stock==='in') l=l.filter(p=>p.stock>0);
      if(stock==='sale') l=l.filter(p=>p.oldPrice);
      if(sort==='cheap') l.sort((a,b)=>a.price-b.price);
      if(sort==='exp') l.sort((a,b)=>b.price-a.price);
      if(sort==='rating') l.sort((a,b)=>b.rating-a.rating);
      if(sort==='pop') l.sort((a,b)=>b.sales-a.sales);
      if(!l.length) return;
      total+=l.length;
      html += `<div class="cat-group">
        <div class="cat-group-head">
          <h2>${esc(g.name)}</h2>
          <a href="#/group?id=${g.id}" data-link class="btn ghost sm">Вся группа →</a>
        </div>
        <div class="catalog-grid">${l.map(p=>productCard(p)).join('')}</div>
      </div>`;
    });
    $('#resCount').textContent = `Найдено: ${total}`;
    $('#catBody').innerHTML = html || emptyState('Ничего не найдено','Попробуйте изменить фильтры или поисковый запрос.','#/catalog','Сбросить');
  }
  $('#grpSel').onchange=render; $('#sortSel').onchange=render; $('#stockSel').onchange=render;
  render();
}

/* ============================================================
   СТРАНИЦА: КАРТОЧКА ТОВАРА
============================================================ */
function pageProduct(params){
  const p = S.product(params.get('id'));
  if(!p){ app.innerHTML = emptyState('Товар не найден','Возможно, он был снят с продажи.','#/catalog','В каталог'); return; }

  let curVar = p.activeVar||0;
  let qty = 1;

  const reviewsData = [
    {a:'Андрей П.', d:'2 недели назад', t:'Сеть пришла быстро, оснащена аккуратно. Уже опробовал — уловистая, ячея ровная.'},
    {a:'Виктор С.', d:'месяц назад', t:'Беру второй раз. Качество стабильное, леска прочная. Рекомендую.'},
    {a:'Ольга М.', d:'2 месяца назад', t:'Муж доволен. Упаковано хорошо, ничего не запуталось.'}
  ];

  function render(){
    const old = p.oldPrice?`<span class="pp-oldprice">${money(p.oldPrice)}</span>`:'';
    const badge = p.badge?`<span class="pp-badge">${esc(p.badge)}</span>`:'';
    const imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    let curImg = 0;

    const galleryMain = imgs.length
      ? `<img src="${esc(imgs[0])}" id="ppMainImg">`
      : netPH();
    const thumbs = imgs.length
      ? imgs.map((src,i)=>`<div class="pp-thumb ${i===0?'active':''}" data-img="${i}"><img src="${esc(src)}"></div>`).join('')
      : [0,1,2].map(i=>`<div class="pp-thumb ${i===0?'active':''}">${netPH()}</div>`).join('');

    app.innerHTML = `
      ${adminBar()}
      <div class="breadcrumbs"><a href="#/" data-link>Главная</a> / <a href="#/group?id=${p.groupId}" data-link>${esc(p.groupName)}</a> / ${esc(p.name)}</div>
      <div class="product-page">
        <div class="pp-gallery">
          <div class="pp-main">${galleryMain}
            ${S.state.isAdmin?`<button class="pp-edit-photos" id="ppEditPhotos" title="Управление фото">📷 Изменить фото</button>`:''}
          </div>
          <div class="pp-thumbs" id="ppThumbs">${thumbs}</div>
        </div>
        <div class="pp-info">
          <h1>${esc(p.name)}</h1>
          <span class="prod-sku">Артикул: ${esc(p.sku)}</span>
          <div class="prod-rating" style="margin-top:8px">${starRow(p.rating)} <span>${p.rating}.0 · ${p.reviews} отзывов</span></div>
          <div class="pp-meta">
            <span class="pp-price"><span class="cur">от </span>${money(p.price)}</span>
            ${old}${badge}
          </div>
          ${stockLabel(p)}

          ${S.state.isAdmin?`<button class="btn block" id="ppFullEdit" style="margin:14px 0">✏️ Редактировать товар полностью</button>`:''}

          <div class="pp-section">
            <h3>Варианты</h3>
            <div class="var-row" id="varRow">
              ${p.variations.map((v,i)=>`<button class="var-chip ${i===curVar?'active':''}" data-v="${i}">${esc(v)}</button>`).join('')}
            </div>
          </div>

          <div class="pp-buy">
            <div class="qty-box">
              <button id="qMinus">−</button>
              <input id="qInput" value="${qty}" inputmode="numeric">
              <button id="qPlus">+</button>
            </div>
            <button class="btn big" id="buyBtn" ${p.stock<=0?'disabled':''}>${p.stock<=0?'Нет в наличии':'В корзину'}</button>
            <button class="icon-btn ${S.isFav(p.id)?'active':''}" id="favBtn"><svg><use href="#heart"/></svg></button>
          </div>
          <button class="btn ghost block" id="oneClick" style="margin-top:12px" ${p.stock<=0?'disabled':''}>⚡ Быстрый заказ в 1 клик</button>

          <div class="pp-section">
            <h3>Характеристики</h3>
            <table class="spec-table">
              ${Object.entries(p.specs).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
            </table>
          </div>

          <div class="pp-section">
            <h3>Описание</h3>
            <p class="prod-desc" style="font-size:.92rem">${esc(p.desc)}</p>
          </div>
        </div>
      </div>

      <section class="pp-section" style="margin-top:30px">
        <h3 style="font-size:1.3rem">Отзывы покупателей</h3>
        ${reviewsData.map(r=>`<div class="review">
          <div class="rh"><span class="ra">${esc(r.a)}</span><span class="rd">${esc(r.d)}</span></div>
          <div class="prod-rating" style="margin-bottom:6px">${starRow(5)}</div>
          <p>${esc(r.t)}</p>
        </div>`).join('')}
      </section>

      <h2 class="page-title" style="margin-top:34px">Другое из группы <span class="accent">«${esc(p.groupName)}»</span></h2>
      <div class="catalog-grid">
        ${(S.group(p.groupId)?.products||[]).filter(x=>x.id!==p.id).slice(0,2).map(x=>productCard({...x,groupId:p.groupId,groupName:p.groupName})).join('')}
      </div>
    `;

    // Переключение миниатюр
    const thumbsEl = $('#ppThumbs');
    if(thumbsEl && imgs.length){
      thumbsEl.onclick = e=>{
        const t = e.target.closest('[data-img]');
        if(!t) return;
        curImg = +t.dataset.img;
        const main = $('#ppMainImg');
        if(main) main.src = imgs[curImg];
        $$('.pp-thumb', thumbsEl).forEach(el=>el.classList.toggle('active', +el.dataset.img===curImg));
      };
    }

    // Кнопки админа
    const editPhotos = $('#ppEditPhotos');
    if(editPhotos) editPhotos.onclick = ()=>editProductModal(p.id, p.groupId);
    const fullEdit = $('#ppFullEdit');
    if(fullEdit) fullEdit.onclick = ()=>editProductModal(p.id, p.groupId);

    $('#varRow').onclick = e=>{ const b=e.target.closest('[data-v]'); if(b){curVar=+b.dataset.v; render();} };
    $('#qMinus').onclick=()=>{qty=Math.max(1,qty-1);$('#qInput').value=qty;};
    $('#qPlus').onclick=()=>{qty++;$('#qInput').value=qty;};
    $('#qInput').oninput=e=>{qty=Math.max(1,parseInt(e.target.value)||1);};
    $('#buyBtn').onclick=()=>{ S.addToCart(p.id,curVar,qty); refreshChrome(); toast('Добавлено в корзину','success'); };
    $('#favBtn').onclick=function(){ if(!Session.user()){ openAuthModal('login','Войдите, чтобы добавлять товары в избранное'); return; } S.toggleFav(p.id); this.classList.toggle('active'); refreshChrome(); };
    $('#oneClick').onclick=()=>oneClickModal(p,curVar,qty);
  }
  render();
}

/* ============================================================
   СТРАНИЦА: КОРЗИНА
============================================================ */
function pageCart(){
  if(!S._cart.length){
    app.innerHTML = adminBar()+emptyState('Корзина пуста','Загляните в каталог — у нас есть сети на любую рыбу.','#/catalog','В каталог');
    return;
  }
  function render(){
    const items = S._cart.map((it,idx)=>{
      const p=S.product(it.pid); if(!p)return'';
      const v = p.variations[it.var]||'';
      return `<div class="cart-item">
        <div class="ci-media">${(p.images&&p.images[0])||p.image?`<img src="${esc((p.images&&p.images[0])||p.image)}">`:netPH()}</div>
        <div>
          <div class="ci-name">${esc(p.name)}</div>
          <div class="ci-var">${esc(v)} · арт. ${esc(p.sku)}</div>
          <div class="qty-box" style="margin-top:8px">
            <button data-dec="${idx}">−</button>
            <input value="${it.qty}" data-qty="${idx}" inputmode="numeric">
            <button data-inc="${idx}">+</button>
          </div>
        </div>
        <div class="ci-right">
          <div class="ci-price">${money(p.price*it.qty)}</div>
          <button class="btn ghost sm" data-rm="${idx}">Удалить</button>
        </div>
      </div>`;
    }).join('');

    const total=S.cartTotal();
    const disc=S.currentDiscount();
    const discAmt=S.cartDiscountAmount();
    app.innerHTML = `
      ${adminBar()}
      <h1 class="page-title">Корзина</h1>
      <div class="cart-layout">
        <div class="panel" id="cartList">${items}</div>
        <div class="panel cart-summary">
          <div class="summary-row"><span>Товары (${S.cartCount()})</span><span>${money(S.cartSubtotal())}</span></div>
          ${disc>0?`<div class="summary-row" style="color:#5fd08a"><span>Скидка ${disc}%</span><span>−${money(discAmt)}</span></div>`:''}
          <div class="summary-row"><span>Доставка</span><span>рассчитается при оформлении</span></div>
          <div class="summary-row total"><span>Итого</span><span class="v">${money(total)}</span></div>
          <button class="btn block big" id="checkout" style="margin-top:16px">Оформить заказ</button>
          <button class="btn ghost block" data-link href="#/catalog" style="margin-top:10px">Продолжить покупки</button>
        </div>
      </div>`;

    $('#cartList').onclick = e=>{
      const t=e.target;
      if(t.dataset.rm!=null){ S.removeFromCart(+t.dataset.rm); refreshChrome(); render(); }
      if(t.dataset.inc!=null){ const i=+t.dataset.inc; S.setCartQty(i,S._cart[i].qty+1); refreshChrome(); render(); }
      if(t.dataset.dec!=null){ const i=+t.dataset.dec; S.setCartQty(i,S._cart[i].qty-1); refreshChrome(); render(); }
    };
    $$('#cartList [data-qty]').forEach(inp=>inp.onchange=e=>{
      S.setCartQty(+e.target.dataset.qty, parseInt(e.target.value)||1); refreshChrome(); render();
    });
    $('#checkout').onclick=()=>go('#/checkout');
  }
  render();
}

/* ============================================================
   СТРАНИЦА: ОФОРМЛЕНИЕ ЗАКАЗА
============================================================ */
function pageCheckout(){
  if(!S._cart.length){ go('#/catalog'); return; }
  const total=S.cartTotal();
  app.innerHTML = `
    ${adminBar()}
    <div class="breadcrumbs"><a href="#/cart" data-link>Корзина</a> / Оформление</div>
    <h1 class="page-title">Оформление заказа</h1>
    <div class="cart-layout">
      <div class="panel">
        <div class="form-grid">
          <div class="field"><label>Имя *</label><input id="fName" value="${esc(((Session.user()||{}).name||S.state.user.name)==='Гость'?'':((Session.user()||{}).name||S.state.user.name))}" placeholder="Как к вам обращаться"></div>
          <div class="field"><label>Телефон *</label><input id="fPhone" value="${esc(S.state.user.phone)}" placeholder="+7 ___ ___-__-__"></div>
          <div class="field"><label>Email</label><input id="fEmail" value="${esc(S.state.user.email)}" placeholder="для чека и статуса заказа"></div>

          <div class="field"><label>Способ доставки</label>
            <div class="radio-row" id="delivery">
              ${['Курьер','Самовывоз','СДЭК','Почта России','Boxberry','Яндекс Доставка'].map((d,i)=>`
                <label class="radio-card ${i===0?'active':''}"><input type="radio" name="del" ${i===0?'checked':''} value="${d}">${d}</label>`).join('')}
            </div>
          </div>

          <div class="field"><label>Способ оплаты</label>
            <div class="radio-row" id="payment">
              ${['Банковская карта','СБП','ЮKassa','Tinkoff Pay','SberPay','При получении'].map((d,i)=>`
                <label class="radio-card ${i===0?'active':''}"><input type="radio" name="pay" ${i===0?'checked':''} value="${d}">${d}</label>`).join('')}
            </div>
          </div>

          <div class="field"><label>Комментарий к заказу</label><textarea id="fComment" rows="3" placeholder="Например: позвонить за час до доставки"></textarea></div>
        </div>
      </div>
      <div class="panel checkout-summary">
        <h3 style="font-family:Montserrat;color:var(--orange);margin-top:0">Ваш заказ</h3>
        ${S._cart.map(it=>{const p=S.product(it.pid);return`<div class="summary-row"><span>${esc(p.name)} ×${it.qty}</span><span>${money(p.price*it.qty)}</span></div>`;}).join('')}
        ${S.currentDiscount()>0?`<div class="summary-row"><span>Подытог</span><span>${money(S.cartSubtotal())}</span></div><div class="summary-row" style="color:#5fd08a"><span>Скидка ${S.currentDiscount()}%</span><span>−${money(S.cartDiscountAmount())}</span></div>`:''}
        <div class="summary-row total"><span>К оплате</span><span class="v">${money(total)}</span></div>
        <p style="color:var(--ink-dim);font-size:.82rem;margin:12px 0">Начислим бонусов: <b style="color:var(--orange)">${Math.round(total*0.05)}</b></p>
        <button class="btn block big" id="placeOrder" style="margin-top:8px">Подтвердить заказ</button>
        <p style="color:#6f8aa0;font-size:.76rem;margin-top:12px">Нажимая кнопку, вы соглашаетесь с <a href="#/privacy" data-link style="color:var(--orange)">политикой конфиденциальности</a>.</p>
      </div>
    </div>`;

  $$('.radio-card').forEach(rc=>rc.onclick=()=>{
    const grp=rc.parentElement; $$('.radio-card',grp).forEach(x=>x.classList.remove('active')); rc.classList.add('active');
  });
  $('#placeOrder').onclick=()=>{
    const name=$('#fName').value.trim(), phone=$('#fPhone').value.trim();
    if(!name||!phone){ toast('Заполните имя и телефон','error'); return; }
    S.state.user={name,phone,email:$('#fEmail').value.trim()};
    const order=S.placeOrder({
      name,phone,
      delivery:$('#delivery input:checked').value,
      payment:$('#payment input:checked').value,
      comment:$('#fComment').value.trim()
    });
    refreshChrome();
    orderSuccessModal(order);
  };
}

/* ============================================================
   СТРАНИЦА: ИЗБРАННОЕ
============================================================ */
function pageFavorites(){
  // Гостю предлагаем войти
  if(!Session.user()){
    app.innerHTML = adminBar() + `<h1 class="page-title">Избранное</h1>` +
      `<div class="empty-state">
        <svg viewBox="0 0 24 24"><use href="#heart"/></svg>
        <h3>Войдите, чтобы пользоваться избранным</h3>
        <p>Сохраняйте понравившиеся товары в личном кабинете — они будут доступны с любого устройства.</p>
        <button class="btn" id="favLoginBtn" style="margin-top:6px">Войти или зарегистрироваться</button>
      </div>`;
    const b=$('#favLoginBtn');
    if(b) b.onclick=()=>openAuthModal('login','Войдите, чтобы пользоваться избранным');
    return;
  }
  const favs = S._favs.map(id=>S.product(id)).filter(Boolean);
  app.innerHTML = adminBar() + `<h1 class="page-title">Избранное</h1>` +
    (favs.length ? `<div class="catalog-grid">${favs.map(p=>productCard(p)).join('')}</div>`
                 : emptyState('В избранном пока пусто','Нажимайте на ♡ у товаров, чтобы сохранить их здесь.','#/catalog','В каталог'));
}

/* ============================================================
   СТРАНИЦА: ЛИЧНЫЙ КАБИНЕТ
============================================================ */
function pageAccount(params){
  const tab = params.get('tab')||'orders';
  app.innerHTML = `
    ${adminBar()}
    <h1 class="page-title">Личный кабинет</h1>
    <div class="account-tabs">
      <button data-tab="orders" class="${tab==='orders'?'active':''}">Мои заказы</button>
      <button data-tab="bonus" class="${tab==='bonus'?'active':''}">Бонусы</button>
      <button data-tab="profile" class="${tab==='profile'?'active':''}">Профиль</button>
      <button data-tab="fav" class="${tab==='fav'?'active':''}">Избранное</button>
    </div>
    <div id="accBody"></div>`;

  $$('.account-tabs button').forEach(b=>b.onclick=()=>go('#/account?tab='+b.dataset.tab));
  const body=$('#accBody');

  if(tab==='orders'){
    body.innerHTML = S._orders.length ? `<div class="panel">${
      S._orders.map(o=>`<div class="order-row">
        <div><div class="oid">Заказ ${o.id}</div><div class="ci-var">${o.date} · ${o.items.length} поз. · ${money(o.total)}</div></div>
        <div style="display:flex;gap:10px;align-items:center">
          <span class="ostatus ${o.status==='done'?'done':'way'}">${o.status==='done'?'Доставлен':'В пути'}</span>
          <button class="btn sm" data-reorder="${o.id}">Повторить</button>
        </div>
      </div>`).join('')
    }</div>` : emptyState('Заказов пока нет','Оформите первый заказ — он появится здесь.','#/catalog','В каталог');
    $$('[data-reorder]').forEach(b=>b.onclick=()=>{
      const o=S._orders.find(x=>x.id===b.dataset.reorder);
      o.items.forEach(it=>S.addToCart(it.pid,it.var,it.qty));
      refreshChrome(); toast('Товары добавлены в корзину','success'); go('#/cart');
    });
  }
  else if(tab==='bonus'){
    body.innerHTML = `<div class="panel" style="max-width:420px">
      <div class="bonus-card">
        <div style="font-weight:700">Бонусный счёт</div>
        <div class="bnum">${S.state.bonus}</div>
        <div style="font-weight:600">баллов · 1 балл = 1 ₽</div>
      </div>
      <p style="color:var(--ink-dim);margin-top:16px;font-size:.9rem">Возвращаем 5% бонусами с каждого заказа. Списать можно до 30% от суммы покупки.</p>
    </div>`;
  }
  else if(tab==='profile'){
    const u = Session.user();
    const avatar = u && u.avatar ? u.avatar : '';
    const initial = ((u&&u.name)||S.state.user.name||'Г').trim().charAt(0).toUpperCase();
    body.innerHTML = `<div class="panel" style="max-width:520px"><div class="form-grid">
      <div class="profile-avatar-row">
        <div class="profile-avatar" id="profAvatar">${avatar?`<img src="${esc(avatar)}" alt="">`:`<span>${esc(initial)}</span>`}</div>
        <div style="flex:1">
          <label class="btn sm" style="cursor:pointer;display:inline-block">
            📷 Сменить аватар
            <input type="file" id="avatarFile" accept="image/*" style="display:none">
          </label>
          ${avatar?`<button class="btn sm ghost" id="avatarRemove" style="margin-left:8px">Убрать</button>`:''}
          <p style="color:var(--ink-dim);font-size:.78rem;margin:8px 0 0">Квадратное фото будет обрезано автоматически.</p>
        </div>
      </div>
      <div class="field"><label>Имя</label><input id="pName" value="${esc(((u||{}).name||S.state.user.name))}"></div>
      <div class="field"><label>Телефон</label><input id="pPhone" value="${esc((u&&u.phone)||S.state.user.phone)}"></div>
      <div class="field"><label>Email</label><input id="pEmail" value="${esc((u&&u.email)||S.state.user.email)}" ${u?'readonly':''}></div>
      <div class="field"><label>О себе</label><textarea id="pBio" rows="3" placeholder="Расскажите о себе, любимых местах рыбалки…">${esc((u&&u.bio)||'')}</textarea></div>
      <button class="btn" id="saveProfile">Сохранить</button>
    </div></div>`;

    // временное хранилище нового аватара
    let newAvatar = avatar;
    const avFile = $('#avatarFile');
    if(avFile) avFile.onchange=function(){
      const f=this.files[0]; this.value='';
      if(!f) return;
      const reader=new FileReader();
      reader.onload=e=>openCropper(e.target.result, 1, (cropped)=>{
        newAvatar = cropped;
        $('#profAvatar').innerHTML = `<img src="${cropped}" alt="">`;
      });
      reader.readAsDataURL(f);
    };
    const avRm = $('#avatarRemove');
    if(avRm) avRm.onclick=()=>{ newAvatar=''; $('#profAvatar').innerHTML=`<span>${esc(initial)}</span>`; };

    $('#saveProfile').onclick=async ()=>{
      if(u){
        u.name=$('#pName').value||u.name;
        u.phone=$('#pPhone').value;
        u.bio=$('#pBio').value;
        u.avatar=newAvatar;
        Users.save(u);
        Session._u = u;
      } else {
        S.state.user={name:$('#pName').value||'Гость',phone:$('#pPhone').value,email:$('#pEmail').value};
        await S.save();
      }
      toast('Профиль сохранён','success');
      refreshAuthUI && refreshAuthUI();
      render();
    };
  }
  else if(tab==='fav'){
    const favs=S._favs.map(id=>S.product(id)).filter(Boolean);
    body.innerHTML = favs.length?`<div class="catalog-grid">${favs.map(p=>productCard(p)).join('')}</div>`
      :emptyState('В избранном пусто','','#/catalog','В каталог');
  }
}

/* ============================================================
   КОНТЕНТНЫЕ СТРАНИЦЫ
============================================================ */
function contentPage(key, title, html){
  const saved = S.state.content[key];
  const blocks = (S.state.sections && S.state.sections[key]) || [];
  const blocksHTML = blocks.map((b,i)=>`
    <div class="info-block">
      <div class="info-block-body" ${S.state.isAdmin?'contenteditable="true"':''} data-block="${key}" data-bidx="${i}">
        <h3>${b.title?esc(b.title):''}</h3>
        <div>${b.text||''}</div>
      </div>
      ${S.state.isAdmin?`<button class="info-block-del" data-delblock="${i}" title="Удалить блок">✕</button>`:''}
    </div>`).join('');

  app.innerHTML = `
    ${adminBar()}
    <div class="content-page">
      <h1 class="page-title">${title}</h1>
      <div class="editable" ${S.state.isAdmin?'contenteditable="true"':''} data-content="${key}">${saved||html}</div>
      <div class="info-blocks" id="infoBlocks">${blocksHTML}</div>
      ${S.state.isAdmin?`<button class="btn" id="addBlock" style="margin-top:18px">+ Добавить блок информации</button>`:''}
    </div>`;

  if(S.state.isAdmin){
    const addBtn = $('#addBlock');
    if(addBtn) addBtn.onclick = ()=>{
      if(!S.state.sections[key]) S.state.sections[key]=[];
      S.state.sections[key].push({title:'Новый блок', text:'Введите текст…'});
      S.save(); render();
    };
    $$('[data-delblock]').forEach(btn=>btn.onclick=()=>{
      if(confirm('Удалить этот блок информации?')){
        S.state.sections[key].splice(+btn.dataset.delblock,1);
        S.save(); render();
      }
    });
    // Сохранение текста блоков при потере фокуса
    $$('[data-block]').forEach(el=>{
      el.onblur=()=>{
        const i=+el.dataset.bidx;
        const h3=el.querySelector('h3'), body=el.querySelector('div');
        if(S.state.sections[key] && S.state.sections[key][i]){
          S.state.sections[key][i].title = h3?h3.textContent.trim():'';
          S.state.sections[key][i].text = body?body.innerHTML:'';
          S.save();
        }
      };
    });
  }
}

function pageAbout(){
  contentPage('about','О компании', `
    <p><b>РыбХоз Сети</b> — магазин рыболовных сетей и снастей. Мы поставляем готовую к работе оснастку для любительской и промысловой ловли по всей России.</p>
    <p>Работаем напрямую с производителями, поэтому держим честные цены и отвечаем за качество каждой сети. Перед отправкой проверяем оснастку, упаковываем так, чтобы ничего не запуталось в пути.</p>
    <h2>Почему нас выбирают</h2>
    <div class="info-cards">
      <div class="info-card"><h4>Готовая оснастка</h4><p>Сети приходят с грузилами и поплавками — установил и ловишь.</p></div>
      <div class="info-card"><h4>Доставка по РФ</h4><p>Курьер, ПВЗ, Почта России и транспортные компании.</p></div>
      <div class="info-card"><h4>Бонусы за заказы</h4><p>Возвращаем 5% баллами с каждой покупки.</p></div>
      <div class="info-card"><h4>QR на товар</h4><p>Печатаем QR-код для быстрого повторного заказа.</p></div>
    </div>
    <p>Контактное лицо: Сергей Смуров, +7 999 999-99-99.</p>`);
}

function pageDelivery(){
  contentPage('delivery','Доставка и оплата', `
    <h2>Способы доставки</h2>
    <ul>
      <li>Курьер по городу</li>
      <li>Самовывоз со склада</li>
      <li>СДЭК, Boxberry, Почта России</li>
      <li>Яндекс Доставка, Wildberries Truck, Авито Доставка</li>
    </ul>
    <p>Стоимость доставки рассчитывается автоматически при оформлении заказа по вашему адресу.</p>
    <h2>Способы оплаты</h2>
    <ul>
      <li>Банковские карты, СБП</li>
      <li>ЮKassa, Tinkoff Pay, SberPay</li>
      <li>Оплата при получении</li>
      <li>Банковский перевод для юридических лиц</li>
    </ul>
    <h2>Возвраты</h2>
    <p>Возврат и обмен брака принимаем через ПВЗ сторонних сервисов (Яндекс Маркет, Ozon, Wildberries) и напрямую на складе.</p>`);
}

function pageContacts(){
  contentPage('contacts','Контакты', `
    <div class="info-cards">
      <div class="info-card"><h4>Телефон</h4><p>+7 999 999-99-99<br>ежедневно 9:00–20:00</p></div>
      <div class="info-card"><h4>Email</h4><p>info@rybhoz-seti.ru</p></div>
      <div class="info-card"><h4>Контактное лицо</h4><p>Сергей Смуров</p></div>
      <div class="info-card"><h4>Самовывоз</h4><p>Склад работает по будням 10:00–18:00</p></div>
    </div>
    <p>Напишите нам в любое время — отвечаем в рабочие часы в течение дня.</p>`);
}

function pagePrivacy(){
  contentPage('privacy','Политика конфиденциальности', `
    <p>Мы используем ваши данные только для обработки и доставки заказов. Не передаём их третьим лицам, кроме служб доставки и платёжных систем, необходимых для выполнения заказа.</p>
    <h2>Какие данные мы собираем</h2>
    <ul><li>Имя и контактный телефон</li><li>Email для чека и статуса заказа</li><li>Адрес доставки</li></ul>
    <h2>Ваши права</h2>
    <p>Вы можете запросить удаление своих данных, написав на info@rybhoz-seti.ru.</p>`);
}

function pageBlog(){
  app.innerHTML = `
    ${adminBar()}
    <div class="blog-head">
      <h1 class="page-title" style="margin:0">Новости и <span class="accent">советы</span></h1>
      ${S.state.isAdmin?`<button class="btn" id="blogAdd">+ Добавить новость</button>`:''}
    </div>
    <div class="blog-grid">
      ${S.state.blog.map(b=>`<article class="blog-card">
        <div class="bc-img">${(b.images&&b.images[0])||b.image?`<img src="${esc((b.images&&b.images[0])||b.image)}" alt="">`:netPH()}</div>
        <div class="bc-body">
          <span class="bc-date">${esc(b.date)}</span>
          <h3 class="bc-title">${esc(b.title)}</h3>
          <p class="bc-ex">${esc(b.excerpt)}</p>
          ${b.body?`<p class="bc-full">${esc(b.body)}</p>`:''}
          ${S.state.isAdmin?`<div class="bc-admin">
            <button class="btn sm" data-blogedit="${b.id}">✏️ Редактировать</button>
            <button class="btn sm danger" data-blogdel="${b.id}">Удалить</button>
          </div>`:''}
        </div>
      </article>`).join('')}
    </div>`;

  if(S.state.isAdmin){
    const addBtn = $('#blogAdd');
    if(addBtn) addBtn.onclick = ()=>editBlogModal(null);
    $$('[data-blogedit]').forEach(b=>b.onclick=()=>editBlogModal(b.dataset.blogedit));
    $$('[data-blogdel]').forEach(b=>b.onclick=()=>{
      if(confirm('Удалить эту новость?')){
        const i = S.state.blog.findIndex(x=>x.id===b.dataset.blogdel);
        if(i>=0){ S.state.blog.splice(i,1); S.save(); toast('Новость удалена'); render(); }
      }
    });
  }
}

function editBlogModal(id){
  const existing = id ? S.state.blog.find(b=>b.id===id) : null;
  const b = existing ? Object.assign({}, existing) : {
    id:'nb'+Date.now(),
    date: new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}),
    title:'', excerpt:'', body:'', images:[]
  };
  if(!b.images) b.images = b.image ? [b.image] : [];

  const imgListHTML = ()=>(b.images||[]).map((src,i)=>`
    <div style="position:relative;display:inline-block">
      <img src="${esc(src)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid var(--orange)">
      <button data-rmbimg="${i}" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#e06464;color:#fff;border:none;cursor:pointer;font-size:.7rem;line-height:1">✕</button>
    </div>`).join('');

  openModal(`
    <h2>${id?'Редактировать новость':'Новая новость'}</h2>
    <div class="form-grid" style="margin-top:14px">
      <div class="field"><label>Дата</label><input id="bDate" value="${esc(b.date)}"></div>
      <div class="field"><label>Заголовок</label><input id="bTitle" value="${esc(b.title)}"></div>
      <div class="field"><label>Краткое описание (для карточки)</label><textarea id="bExcerpt" rows="2">${esc(b.excerpt)}</textarea></div>
      <div class="field"><label>Полный текст (необязательно)</label><textarea id="bBody" rows="5">${esc(b.body||'')}</textarea></div>
      <div class="field">
        <label>Фотографии</label>
        <div id="bImgList" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">${imgListHTML()}</div>
        <div style="display:flex;gap:8px">
          <input id="bImgUrl" placeholder="Вставьте URL фото…" style="flex:1">
          <button class="btn" id="bAddUrl" style="white-space:nowrap;padding:0 14px">+ URL</button>
        </div>
        <label class="btn" style="margin-top:8px;display:inline-block;cursor:pointer;padding:8px 14px;font-size:.85rem">
          📁 Загрузить файл
          <input type="file" id="bImgFile" accept="image/*" multiple style="display:none">
        </label>
      </div>
      <button class="btn block" id="bSave">${id?'Сохранить изменения':'Опубликовать'}</button>
    </div>
  `);

  function refreshBImg(){
    const list = $('#bImgList');
    list.innerHTML = imgListHTML();
    $$('[data-rmbimg]', list).forEach(btn=>{
      btn.onclick=(e)=>{ e.stopPropagation(); b.images.splice(+btn.dataset.rmbimg,1); refreshBImg(); };
    });
  }
  refreshBImg();

  $('#bAddUrl').onclick=()=>{
    const url=$('#bImgUrl').value.trim();
    if(!url) return;
    $('#bImgUrl').value='';
    openCropper(url, 16/9, (cropped)=>{
      if(!b.images)b.images=[];
      b.images.push(cropped);
      refreshBImg();
    });
  };
  $('#bImgFile').onchange=function(){
    const files = Array.from(this.files);
    this.value='';
    let i = 0;
    function next(){
      if(i >= files.length) return;
      const reader=new FileReader();
      reader.onload=e=>{
        openCropper(e.target.result, 16/9, (cropped)=>{
          if(!b.images)b.images=[];
          b.images.push(cropped);
          refreshBImg();
          i++; next();
        });
      };
      reader.readAsDataURL(files[i]);
    }
    next();
  };

  $('#bSave').onclick=()=>{
    b.date=$('#bDate').value.trim()||b.date;
    b.title=$('#bTitle').value.trim()||'Без заголовка';
    b.excerpt=$('#bExcerpt').value.trim();
    b.body=$('#bBody').value.trim();
    b.image=(b.images&&b.images[0])||null;
    if(id){
      const i=S.state.blog.findIndex(x=>x.id===id);
      if(i>=0) S.state.blog[i]=b;
    } else {
      S.state.blog.unshift(b);
    }
    S.save(); closeModal(); toast('Сохранено','success'); render();
  };
}

/* ============================================================
   ПУСТЫЕ СОСТОЯНИЯ
============================================================ */
function emptyState(title,text,link,btn){
  return `<div class="empty-state">
    <svg viewBox="0 0 100 100">${netPH().replace('<svg class="ph-net"','<g').replace('</svg>','</g>')}</svg>
    <h3>${title}</h3><p>${text}</p>
    ${link?`<button class="btn" style="margin-top:16px" data-link href="${link}">${btn}</button>`:''}
  </div>`;
}

/* ============================================================
   АДМИН-РЕЖИМ
============================================================ */
function adminBar(){
  if(!S.state.isAdmin) return '';
  const cloudOn = (typeof Cloud!=='undefined' && Cloud.enabled);
  const cloudTag = cloudOn
    ? `<span class="cloud-status on" title="Данные сохраняются в облаке и видны всем посетителям">☁ Облако подключено</span>`
    : `<span class="cloud-status off" title="Данные хранятся только в этом браузере. Настройте Supabase — см. SUPABASE_SETUP.md">⚠ Только этот браузер</span>`;
  return `<div class="admin-controls">
    <span class="hc-tag" style="background:var(--orange);color:#15293f;position:static">Режим администратора</span>
    ${cloudTag}
    <button class="btn sm" id="abAdd">+ Новый товар</button>
    <button class="btn sm ghost" id="abClients">👥 Клиенты</button>
    <button class="btn sm ghost" id="abDiscounts">% Скидки</button>
    <button class="btn sm" id="abSaveContent">💾 Сохранить всё</button>
    <button class="btn sm danger" id="abReset">Сбросить всё</button>
  </div>`;
}

function bindAdminBar(){
  if(!S.state.isAdmin) return;
  const add=$('#abAdd');
  if(add) add.onclick=()=>editProductModal(null, S.state.groups[0].id);
  const addP=$('#addProd');
  if(addP) addP.onclick=()=>editProductModal(null, addP.dataset.gid || S.state.groups[0].id);
  const sc=$('#abSaveContent');
  if(sc) sc.onclick=async ()=>{
    // собрать редактируемые тексты
    $$('.editable[data-content]').forEach(el=>{ S.state.content[el.dataset.content]=el.innerHTML; });
    // собрать тексты кастомных блоков, если открыта страница раздела
    $$('[data-block]').forEach(el=>{
      const key=el.dataset.block, i=+el.dataset.bidx;
      if(S.state.sections[key] && S.state.sections[key][i]){
        const h3=el.querySelector('h3'), body=el.querySelector('div');
        S.state.sections[key][i].title = h3?h3.textContent.trim():'';
        S.state.sections[key][i].text = body?body.innerHTML:'';
      }
    });
    sc.disabled=true; sc.textContent='Сохранение…';
    const ok = await S.save();
    sc.disabled=false; sc.textContent='💾 Сохранить всё';
    if(ok) toast('Все изменения сохранены','success');
    else toast('Не удалось сохранить — слишком большой объём данных','error');
  };
  const rs=$('#abReset');
  if(rs) rs.onclick=()=>{
    if(confirm('Сбросить все товары, тексты и заказы к исходным? Это действие необратимо.')){
      S.reset(); S.state.isAdmin=true; toast('Магазин сброшен к исходному состоянию'); render();
    }
  };
  const cl=$('#abClients');
  if(cl) cl.onclick=()=>clientsModal();
  const ds=$('#abDiscounts');
  if(ds) ds.onclick=()=>discountSettingsModal();
  if(!bindAdminBar._bound){ app.addEventListener('click', adminCardHandler); bindAdminBar._bound=true; }
}
function adminCardHandler(e){
  if(!S.state.isAdmin) return;
  const eg=e.target.closest('[data-editgroup]');
  if(eg){ e.preventDefault(); e.stopPropagation(); editGroupModal(eg.dataset.editgroup); return; }
  const ed=e.target.closest('[data-edit]'), dl=e.target.closest('[data-del]');
  if(ed){ e.preventDefault(); e.stopPropagation();
    const p=S.product(ed.dataset.edit);
    editProductModal(ed.dataset.edit, p?p.groupId:S.state.groups[0].id);
  }
  if(dl){ e.preventDefault(); e.stopPropagation();
    if(confirm('Удалить этот товар?')){
      for(const g of S.state.groups){
        const i=g.products.findIndex(p=>p.id===dl.dataset.del);
        if(i>=0){ g.products.splice(i,1); break; }
      }
      S.save(); toast('Товар удалён'); render();
    }
  }
}

/* ============================================================
   АДМИН: НАСТРОЙКА ВИТРИНЫ ГРУППЫ (обложка + название/подпись)
============================================================ */
function editGroupModal(gid){
  const g = S.state.groups.find(x=>x.id===gid);
  if(!g) return;
  // соотношение витрины: большая карточка ~16:7, обычная ~3:2; берём широкое 16:9
  const ASPECT = 16/9;

  function coverPreview(){
    return g.cover
      ? `<div style="position:relative;display:inline-block">
           <img src="${esc(g.cover)}" style="width:100%;max-width:340px;border-radius:10px;border:2px solid var(--orange);display:block">
           <button id="gRmCover" style="position:absolute;top:8px;right:8px;background:#e06464;color:#fff;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700">Убрать</button>
         </div>`
      : `<p style="color:var(--ink-dim);font-size:.85rem;margin:0">Обложка не задана — показывается карусель товаров группы.</p>`;
  }

  openModal(`
    <h2>Витрина группы</h2>
    <p style="color:var(--ink-dim);margin:4px 0 16px;font-size:.88rem">Загрузите свою картинку-обложку для группы «${esc(g.name)}». Она показывается на главной как лицо раздела. Без обложки крутится карусель товаров.</p>
    <div class="form-grid">
      <div class="field"><label>Название группы</label><input id="gName" value="${esc(g.name)}"></div>
      <div class="field"><label>Подпись</label><input id="gTagline" value="${esc(g.tagline||'')}"></div>
      <div class="field"><label>Бейдж (напр. «Главный товар»)</label><input id="gBadge" value="${esc(g.badge||'')}"></div>
      <div class="field">
        <label>Картинка-обложка</label>
        <div id="gCoverPreview" style="margin-bottom:10px">${coverPreview()}</div>
        <div style="display:flex;gap:8px">
          <input id="gCoverUrl" placeholder="Вставьте URL картинки…" style="flex:1">
          <button class="btn" id="gAddUrl" style="white-space:nowrap;padding:0 14px">+ URL</button>
        </div>
        <label class="btn" style="margin-top:8px;display:inline-block;cursor:pointer;padding:8px 14px;font-size:.85rem">
          📁 Загрузить файл
          <input type="file" id="gCoverFile" accept="image/*" style="display:none">
        </label>
      </div>
      <button class="btn block" id="gSave">Сохранить витрину</button>
    </div>
  `);

  function refreshCover(){
    $('#gCoverPreview').innerHTML = coverPreview();
    const rm=$('#gRmCover');
    if(rm) rm.onclick=()=>{ g.cover=null; refreshCover(); };
  }
  refreshCover();

  $('#gAddUrl').onclick=()=>{
    const url=$('#gCoverUrl').value.trim();
    if(!url) return;
    $('#gCoverUrl').value='';
    openCropper(url, ASPECT, (cropped)=>{ g.cover=cropped; refreshCover(); });
  };
  $('#gCoverFile').onchange=function(){
    const f=this.files[0]; this.value='';
    if(!f) return;
    const reader=new FileReader();
    reader.onload=e=>openCropper(e.target.result, ASPECT, (cropped)=>{ g.cover=cropped; refreshCover(); });
    reader.readAsDataURL(f);
  };
  $('#gSave').onclick=async ()=>{
    g.name=$('#gName').value.trim()||g.name;
    g.tagline=$('#gTagline').value.trim();
    g.badge=$('#gBadge').value.trim();
    const ok=await S.save();
    closeModal();
    toast(ok?'Витрина сохранена':'Не удалось сохранить','success');
    render();
  };
}

function adminLogin(){
  if(S.state.isAdmin){ S.state.isAdmin=false; refreshChrome(); render(); toast('Вы вышли из режима администратора'); return; }
  openModal(`
    <h2>Вход для администратора</h2>
    <p style="color:var(--ink-dim);margin:4px 0 16px">Введите пароль для редактирования магазина.</p>
    <div class="field"><label>Пароль</label><input type="password" id="admPass" placeholder="admin" autofocus></div>
    <p style="color:#6f8aa0;font-size:.78rem;margin:8px 0 16px">Демо-пароль: <b>admin</b></p>
    <button class="btn block" id="admEnter">Войти</button>
  `);
  const tryLogin=()=>{
    if($('#admPass').value==='admin'){
      S.state.isAdmin=true; closeModal(); refreshChrome(); render();
      toast('Добро пожаловать, администратор','success');
    } else toast('Неверный пароль','error');
  };
  $('#admEnter').onclick=tryLogin;
  $('#admPass').onkeydown=e=>{if(e.key==='Enter')tryLogin();};
}

/* ============================================================
   АДМИН: СПИСОК КЛИЕНТОВ — скидки и блокировка
============================================================ */
function clientsModal(){
  function rows(){
    const list = Users.all();
    if(!list.length) return `<tr><td colspan="6" style="text-align:center;color:var(--ink-dim);padding:24px">Пока нет зарегистрированных клиентов</td></tr>`;
    return list.map(u=>{
      const orders = (u.orders||[]).length;
      const auto = Users.autoDiscount(u);
      const eff = Users.effectiveDiscount(u);
      return `<tr class="${u.blocked?'cl-blocked':''}">
        <td>
          <div class="cl-name">${esc(u.name||'—')}</div>
          <div class="cl-email">${esc(u.email)}</div>
        </td>
        <td class="cl-center">${orders}</td>
        <td class="cl-center">${auto}%</td>
        <td class="cl-center">
          <input type="number" min="0" max="100" value="${u.manualDiscount||0}" data-manual="${esc(u.email)}" class="cl-discount-input">%
        </td>
        <td class="cl-center"><span class="cl-eff">${eff}%</span></td>
        <td class="cl-center">
          <button class="btn sm ${u.blocked?'':'ghost'}" data-block="${esc(u.email)}">${u.blocked?'Разблок.':'Заблок.'}</button>
        </td>
      </tr>`;
    }).join('');
  }

  openModal(`
    <h2>Клиенты</h2>
    <p style="color:var(--ink-dim);margin:4px 0 16px;font-size:.88rem">Управление скидками и доступом. Итоговая скидка = наибольшая из автоматической и ручной (не больше максимума ${S.discountMax()}%).</p>
    <div class="clients-table-wrap">
      <table class="clients-table">
        <thead><tr>
          <th>Клиент</th><th>Покупок</th><th>Авто</th><th>Ручная</th><th>Итого</th><th>Доступ</th>
        </tr></thead>
        <tbody id="clientsBody">${rows()}</tbody>
      </table>
    </div>
  `);

  function rebind(){
    $$('[data-manual]').forEach(inp=>{
      inp.onchange=()=>{
        Users.setManualDiscount(inp.dataset.manual, parseInt(inp.value)||0);
        // Обновляем только ячейку "Итого" в этой строке, не пересоздавая input
        const row = inp.closest('tr');
        const u = Users.get(inp.dataset.manual);
        const effCell = row.querySelector('.cl-eff');
        if(effCell) effCell.textContent = Users.effectiveDiscount(u) + '%';
        toast('Скидка обновлена','success');
      };
    });
    $$('[data-block]').forEach(btn=>{
      btn.onclick=()=>{
        const u = Users.get(btn.dataset.block);
        const willBlock = !(u&&u.blocked);
        Users.setBlocked(btn.dataset.block, willBlock);
        $('#clientsBody').innerHTML = rows();
        rebind();
        toast(willBlock?'Клиент заблокирован':'Клиент разблокирован');
      };
    });
  }
  rebind();
}

/* ============================================================
   АДМИН: НАСТРОЙКИ АВТОМАТИЧЕСКИХ СКИДОК
============================================================ */
function discountSettingsModal(){
  const d = S.state.discounts;

  function tierRows(){
    return d.tiers.map((t,i)=>`
      <div class="tier-row" data-tier="${i}">
        <span>от</span>
        <input type="number" min="1" value="${t.orders}" data-torders="${i}" class="tier-input"> покупок →
        <input type="number" min="0" max="100" value="${t.pct}" data-tpct="${i}" class="tier-input"> %
        <button class="tier-del" data-tdel="${i}" title="Удалить">✕</button>
      </div>`).join('');
  }

  openModal(`
    <h2>Настройки скидок</h2>
    <div class="form-grid" style="margin-top:14px">
      <label class="radio-card" style="cursor:pointer">
        <input type="checkbox" id="dEnabled" ${d.enabled?'checked':''}>
        Автоматические скидки включены
      </label>
      <div class="field">
        <label>Максимальная скидка, %</label>
        <input type="number" id="dMax" min="0" max="100" value="${d.max}">
      </div>
      <div class="field">
        <label>Пороги скидок (по числу покупок)</label>
        <div id="tierList" style="display:flex;flex-direction:column;gap:10px;margin-top:6px">${tierRows()}</div>
        <button class="btn sm ghost" id="addTier" style="margin-top:10px;align-self:flex-start">+ Добавить порог</button>
      </div>
      <button class="btn block" id="dSave">Сохранить настройки</button>
    </div>
  `);

  function rebindTiers(){
    $$('[data-torders]').forEach(inp=>inp.onchange=()=>{ d.tiers[+inp.dataset.torders].orders=parseInt(inp.value)||1; });
    $$('[data-tpct]').forEach(inp=>inp.onchange=()=>{ d.tiers[+inp.dataset.tpct].pct=parseInt(inp.value)||0; });
    $$('[data-tdel]').forEach(btn=>btn.onclick=()=>{
      d.tiers.splice(+btn.dataset.tdel,1);
      $('#tierList').innerHTML=tierRows(); rebindTiers();
    });
  }
  rebindTiers();

  $('#addTier').onclick=()=>{
    d.tiers.push({orders:10,pct:1});
    $('#tierList').innerHTML=tierRows(); rebindTiers();
  };
  $('#dSave').onclick=()=>{
    d.enabled=$('#dEnabled').checked;
    d.max=parseInt($('#dMax').value)||10;
    d.tiers.sort((a,b)=>a.orders-b.orders);
    S.save(); closeModal(); toast('Настройки скидок сохранены','success');
  };
}

function editProductModal(id, groupId){
  const existing = id ? S.rawProduct(id) : null;
  const curGroupId = existing ? S.product(id).groupId : (groupId || S.state.groups[0].id);
  const p = existing ? Object.assign({}, existing) : {
    id:'np'+Date.now(), name:'',sku:'',price:0,oldPrice:null,rating:5,reviews:0,
    stock:10,sales:0,desc:'',badge:'',variations:['Стандарт'],activeVar:0,specs:{},images:[]
  };
  if(!p.images) p.images = p.image ? [p.image] : [];

  const imgListHTML = ()=>(p.images||[]).map((src,i)=>`
    <div class="img-thumb-edit" data-idx="${i}" style="position:relative;display:inline-block">
      <img src="${esc(src)}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid var(--orange)">
      <button data-rmimg="${i}" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#e06464;color:#fff;border:none;cursor:pointer;font-size:.7rem;line-height:1">✕</button>
    </div>`).join('');

  openModal(`
    <h2>${id?'Редактировать товар':'Новый товар'}</h2>
    <div class="form-grid" style="margin-top:14px">
      <div class="field"><label>Группа</label>
        <select id="eGroup">
          ${S.state.groups.map(g=>`<option value="${g.id}" ${g.id===curGroupId?'selected':''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Название</label><input id="eName" value="${esc(p.name)}"></div>
      <div class="field"><label>Артикул (SKU)</label><input id="eSku" value="${esc(p.sku)}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="field"><label>Цена, ₽</label><input id="ePrice" type="number" value="${p.price}"></div>
        <div class="field"><label>Старая цена</label><input id="eOld" type="number" value="${p.oldPrice||''}"></div>
        <div class="field"><label>Остаток, шт</label><input id="eStock" type="number" value="${p.stock}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Бейдж (напр. «Хит»)</label><input id="eBadge" value="${esc(p.badge||'')}"></div>
        <div class="field"><label>Продаж (популярность)</label><input id="eSales" type="number" value="${p.sales}"></div>
      </div>
      <div class="field"><label>Описание</label><textarea id="eDesc" rows="3">${esc(p.desc)}</textarea></div>
      <div class="field"><label>Варианты (через запятую)</label><input id="eVars" value="${esc(p.variations.join(', '))}"></div>

      <div class="field">
        <label>Фотографии товара</label>
        <div id="imgPreviewList" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">${imgListHTML()}</div>
        <div style="display:flex;gap:8px">
          <input id="eImgUrl" placeholder="Вставьте URL фото…" style="flex:1">
          <button class="btn" id="eAddUrl" style="white-space:nowrap;padding:0 14px">+ URL</button>
        </div>
        <label class="btn" style="margin-top:8px;display:inline-block;cursor:pointer;padding:8px 14px;font-size:.85rem">
          📁 Загрузить файл
          <input type="file" id="eImgFile" accept="image/*" multiple style="display:none">
        </label>
      </div>

      <button class="btn block" id="eSave">${id?'Сохранить изменения':'Добавить товар'}</button>
    </div>
  `);

  // Управление изображениями
  function refreshImgPreview(){
    const list = $('#imgPreviewList');
    list.innerHTML = imgListHTML();
    // Навесить удаление
    $$('[data-rmimg]', list).forEach(btn=>{
      btn.onclick=(e)=>{ e.stopPropagation(); p.images.splice(+btn.dataset.rmimg,1); refreshImgPreview(); };
    });
  }
  refreshImgPreview();

  // Добавление по URL — с кадрированием
  $('#eAddUrl').onclick=()=>{
    const url=$('#eImgUrl').value.trim();
    if(!url) return;
    $('#eImgUrl').value='';
    // Загружаем как data URL для кропера (если внешний URL, пробуем напрямую)
    openCropper(url, 1, (cropped)=>{
      if(!p.images)p.images=[];
      p.images.push(cropped);
      refreshImgPreview();
    });
  };

  // Загрузка файлов — с кадрированием
  $('#eImgFile').onchange=function(){
    const files = Array.from(this.files);
    this.value='';
    // Обрабатываем по очереди через кропер
    let i = 0;
    function next(){
      if(i >= files.length) return;
      const reader=new FileReader();
      reader.onload=e=>{
        openCropper(e.target.result, 1, (cropped)=>{
          if(!p.images)p.images=[];
          p.images.push(cropped);
          refreshImgPreview();
          i++; next();
        });
      };
      reader.readAsDataURL(files[i]);
    }
    next();
  };

  $('#eSave').onclick=()=>{
    p.name=$('#eName').value.trim()||'Без названия';
    p.sku=$('#eSku').value.trim();
    p.price=+$('#ePrice').value||0;
    p.oldPrice=$('#eOld').value?+$('#eOld').value:null;
    p.stock=+$('#eStock').value||0;
    p.badge=$('#eBadge').value.trim()||null;
    p.sales=+$('#eSales').value||0;
    p.desc=$('#eDesc').value.trim();
    p.variations=$('#eVars').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(!p.variations.length)p.variations=['Стандарт'];
    p.activeVar=Math.min(p.activeVar||0,p.variations.length-1);
    // images already updated via refreshImgPreview
    p.image = (p.images&&p.images[0])||null; // backward compat
    const newGroupId=$('#eGroup').value;
    if(id){
      for(const g of S.state.groups){ const i=g.products.findIndex(x=>x.id===id); if(i>=0){g.products.splice(i,1);break;} }
    }
    const tg=S.group(newGroupId)||S.state.groups[0];
    tg.products.push(p);
    S.save(); closeModal(); toast('Сохранено','success'); render();
  };
}

/* ============================================================
   МОДАЛКИ: быстрый заказ, успех
============================================================ */
function oneClickModal(p,varIdx,qty){
  openModal(`
    <h2>Быстрый заказ в 1 клик</h2>
    <p style="color:var(--ink-dim);margin:4px 0 14px">${esc(p.name)} · ${esc(p.variations[varIdx]||'')} · ${qty} шт</p>
    <div class="form-grid">
      <div class="field"><label>Имя</label><input id="ocName" value="${esc(((Session.user()||{}).name||S.state.user.name)==='Гость'?'':((Session.user()||{}).name||S.state.user.name))}"></div>
      <div class="field"><label>Телефон *</label><input id="ocPhone" value="${esc(S.state.user.phone)}" placeholder="+7 ___ ___-__-__"></div>
      <button class="btn block big" id="ocSend">Заказать — ${money(p.price*qty)}</button>
      <p style="color:#6f8aa0;font-size:.78rem;text-align:center">Менеджер перезвонит для подтверждения</p>
    </div>
  `);
  $('#ocSend').onclick=()=>{
    const phone=$('#ocPhone').value.trim();
    if(!phone){toast('Укажите телефон','error');return;}
    const ocName=$('#ocName').value.trim()||'Гость';
    if(Session.user()) Session.user().name=ocName; else S.state.user.name=ocName;
    S.state.user.phone=phone;
    S.addToCart(p.id,varIdx,qty);
    const order=S.placeOrder({name:ocName,phone,delivery:'Уточнит менеджер',payment:'Уточнит менеджер',comment:'Быстрый заказ в 1 клик'});
    refreshChrome(); closeModal(); orderSuccessModal(order);
  };
}

function orderSuccessModal(order){
  openModal(`
    <div style="text-align:center;padding:10px">
      <div style="font-size:3rem">🎣</div>
      <h2>Заказ оформлен!</h2>
      <p style="color:var(--ink-dim);margin:8px 0">Номер заказа: <b style="color:var(--orange)">${order.id}</b></p>
      <p style="color:var(--ink-dim)">Сумма: <b>${money(order.total)}</b> · Начислено бонусов: <b style="color:var(--orange)">${Math.round(order.total*0.05)}</b></p>
      <p style="color:var(--ink-dim);font-size:.88rem;margin:14px 0">Мы свяжемся с вами по телефону для подтверждения. Спасибо за покупку в РыбХоз Сети!</p>
      <button class="btn" id="okOrder" style="margin-top:8px">К моим заказам</button>
    </div>
  `);
  $('#okOrder').onclick=()=>{closeModal();go('#/account?tab=orders');};
}

/* ============================================================
   КРОПЕР ИЗОБРАЖЕНИЙ — масштаб + позиция, кадрирование под нужное соотношение
============================================================ */
function openCropper(dataUrl, aspectRatio, onDone){
  // aspectRatio: ширина/высота нужной области (напр. 1 для квадрата, 4/3 и т.д.)
  const overlay = document.createElement('div');
  overlay.className = 'cropper-overlay';
  overlay.innerHTML = `
    <div class="cropper-modal">
      <h3 class="cropper-title">Кадрирование фото</h3>
      <p class="cropper-hint">Перетаскивайте фото и меняйте масштаб, чтобы выбрать видимую область</p>
      <div class="cropper-stage" id="cropStage">
        <img id="cropImg" crossorigin="anonymous" src="${dataUrl}" alt="">
        <div class="cropper-frame"></div>
      </div>
      <div class="cropper-zoom">
        <span>−</span>
        <input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1">
        <span>+</span>
      </div>
      <div class="cropper-actions">
        <button class="btn ghost" id="cropCancel">Отмена</button>
        <button class="btn" id="cropApply">Применить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('#cropStage');
  const img = overlay.querySelector('#cropImg');
  const zoomInput = overlay.querySelector('#cropZoom');

  // Размер рамки (видимой области)
  const FRAME_W = 320;
  const FRAME_H = Math.round(FRAME_W / aspectRatio);
  stage.style.width = FRAME_W + 'px';
  stage.style.height = FRAME_H + 'px';

  let scale = 1, posX = 0, posY = 0;
  let imgNatW = 0, imgNatH = 0, baseW = 0, baseH = 0;

  function clamp(){
    // Не давать выводить пустые поля за рамку
    const w = baseW * scale, h = baseH * scale;
    const minX = FRAME_W - w, minY = FRAME_H - h;
    posX = Math.min(0, Math.max(minX, posX));
    posY = Math.min(0, Math.max(minY, posY));
  }
  function apply(){
    clamp();
    img.style.width = (baseW*scale)+'px';
    img.style.height = (baseH*scale)+'px';
    img.style.transform = `translate(${posX}px, ${posY}px)`;
  }

  img.onload = ()=>{
    imgNatW = img.naturalWidth; imgNatH = img.naturalHeight;
    // Базовый размер: вписать "cover" в рамку
    const frameRatio = FRAME_W / FRAME_H;
    const imgRatio = imgNatW / imgNatH;
    if(imgRatio > frameRatio){ baseH = FRAME_H; baseW = FRAME_H * imgRatio; }
    else { baseW = FRAME_W; baseH = FRAME_W / imgRatio; }
    posX = (FRAME_W - baseW)/2;
    posY = (FRAME_H - baseH)/2;
    scale = 1;
    apply();
  };
  // Если картинка по URL не загрузилась (битая ссылка/CORS) — предложим сохранить ссылку как есть
  img.onerror = ()=>{
    cleanup();
    if (typeof dataUrl === 'string' && !dataUrl.startsWith('data:')) {
      // это внешний URL — сохраняем напрямую
      onDone(dataUrl);
      if (typeof toast === 'function') toast('Фото добавлено по ссылке (без кадрирования)','success');
    } else {
      if (typeof toast === 'function') toast('Не удалось загрузить изображение','error');
    }
  };
  if(img.complete && img.naturalWidth) img.onload();

  // Зум
  zoomInput.oninput = ()=>{
    const newScale = parseFloat(zoomInput.value);
    // Зум относительно центра рамки
    const cx = FRAME_W/2, cy = FRAME_H/2;
    const ratio = newScale/scale;
    posX = cx - (cx - posX)*ratio;
    posY = cy - (cy - posY)*ratio;
    scale = newScale;
    apply();
  };

  // Перетаскивание
  let dragging=false, sx=0, sy=0;
  function down(e){ dragging=true; const p=e.touches?e.touches[0]:e; sx=p.clientX-posX; sy=p.clientY-posY; }
  function move(e){ if(!dragging)return; const p=e.touches?e.touches[0]:e; posX=p.clientX-sx; posY=p.clientY-sy; apply(); e.preventDefault(); }
  function up(){ dragging=false; }
  stage.addEventListener('mousedown',down);
  window.addEventListener('mousemove',move);
  window.addEventListener('mouseup',up);
  stage.addEventListener('touchstart',down,{passive:false});
  window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',up);

  function cleanup(){
    window.removeEventListener('mousemove',move);
    window.removeEventListener('mouseup',up);
    window.removeEventListener('touchmove',move);
    window.removeEventListener('touchend',up);
    overlay.remove();
  }

  overlay.querySelector('#cropCancel').onclick = cleanup;
  overlay.querySelector('#cropApply').onclick = async ()=>{
    // Рендерим выбранную область в canvas
    clamp();
    const OUT_W = 800;
    const OUT_H = Math.round(OUT_W / aspectRatio);
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');
    const dispW = baseW*scale, dispH = baseH*scale;
    const k = imgNatW / dispW;
    const srcX = (-posX) * k;
    const srcY = (-posY) * k;
    const srcW = FRAME_W * k;
    const srcH = FRAME_H * k;

    let out;
    try {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H);
      out = canvas.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      // Внешний URL без CORS — кадрировать нельзя, сохраняем ссылку как есть
      cleanup();
      onDone(dataUrl);
      return;
    }

    // Если облако подключено — грузим картинку в Storage, получаем публичную ссылку
    const applyBtn = overlay.querySelector('#cropApply');
    if (typeof Cloud !== 'undefined' && Cloud.enabled) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Загрузка…';
      try {
        const url = await Cloud.uploadImage(out);
        cleanup();
        onDone(url);
        return;
      } catch (e) { /* fallback ниже */ }
      applyBtn.disabled = false;
      applyBtn.textContent = 'Применить';
    }
    cleanup();
    onDone(out);
  };
}

function openModal(html){
  $('#modalCard').innerHTML = `<button class="modal-close" id="modalClose">×</button>`+html;
  $('#modalOverlay').hidden=false;
  $('#modalClose').onclick=closeModal;
}
function closeModal(){ $('#modalOverlay').hidden=true; }
$('#modalOverlay').addEventListener('click',e=>{ if(e.target.id==='modalOverlay')closeModal(); });

/* ============================================================
   РОУТЕР
============================================================ */
const routes = {
  '#/': pageHome, '': pageHome,
  '#/catalog': pageCatalog,
  '#/group': pageGroup,
  '#/product': pageProduct,
  '#/cart': pageCart,
  '#/checkout': pageCheckout,
  '#/favorites': pageFavorites,
  '#/account': pageAccount,
  '#/about': pageAbout,
  '#/delivery': pageDelivery,
  '#/contacts': pageContacts,
  '#/privacy': pagePrivacy,
  '#/blog': pageBlog
};

function go(hash){ location.hash = hash; }

function render(){
  _carouselTimers.forEach(t=>clearInterval(t)); _carouselTimers.length=0;
  const hash = location.hash || '#/';
  const [path, qs] = hash.split('?');
  const params = new URLSearchParams(qs||'');
  const fn = routes[path] || pageHome;
  fn(params);
  bindAdminBar();
  refreshChrome();
  if(typeof closeMobileNav==='function') closeMobileNav();
  window.scrollTo({top:0,behavior:'instant'});
}

/* делегирование кликов: data-link, add, fav, группы */
document.addEventListener('click', e=>{
  // клик по точке карусели — не переходим в группу
  if(e.target.closest('.gc-dot')) return;

  const link = e.target.closest('[data-link]');
  if(link){
    const href = link.getAttribute('href');
    if(href){ e.preventDefault(); go(href); return; }
  }
  const add = e.target.closest('[data-add]');
  if(add && !add.disabled){
    const p=S.product(add.dataset.add);
    S.addToCart(p.id, p.activeVar||0, 1);
    refreshChrome(); toast('Добавлено в корзину','success'); return;
  }
  const fav = e.target.closest('[data-fav]');
  if(fav){
    if(!Session.user()){ openAuthModal('login','Войдите, чтобы добавлять товары в избранное'); return; }
    S.toggleFav(fav.dataset.fav);
    fav.classList.toggle('active');
    refreshChrome();
    return;
  }
  // клик по карточке-группе (но не по кнопкам редактирования)
  const gcard = e.target.closest('[data-group]');
  if(gcard && !e.target.closest('.admin-edit')){
    go('#/group?id='+gcard.dataset.group); return;
  }
});

/* шапка */
$('#cartBtn').onclick=()=>go('#/cart');
$('#adminToggle').onclick=adminLogin;
$('#searchInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){ go('#/catalog?q='+encodeURIComponent(e.target.value.trim())); closeMobileNav(); }
});

/* ============================================================
   АВТОРИЗАЦИЯ
============================================================ */
function openAuthModal(tab='login', hint=''){
  const ov = $('#authOverlay');
  ov.removeAttribute('hidden');
  switchTab(tab);
  // показать подсказку (зачем нужен вход), если передана
  let hintEl = $('#authHint');
  if(hint){
    if(!hintEl){
      hintEl = document.createElement('div');
      hintEl.id = 'authHint';
      hintEl.className = 'auth-hint';
      const card = $('#authOverlay .auth-card') || $('#authOverlay > div');
      if(card) card.insertBefore(hintEl, card.firstChild.nextSibling);
    }
    hintEl.textContent = hint;
    hintEl.style.display = 'block';
  } else if(hintEl){
    hintEl.style.display = 'none';
  }
  document.body.style.overflow='hidden';
}
function closeAuthModal(){
  $('#authOverlay').setAttribute('hidden','');
  document.body.style.overflow='';
}
$('#authClose').onclick = closeAuthModal;
$('#authOverlay').addEventListener('click',e=>{ if(e.target===$('#authOverlay')) closeAuthModal(); });

// Обновить шапку после логина/логаута
function refreshAuthUI(){
  const u = Session.user();
  const guest = $('#navGuest'), user = $('#navUser');
  if(u){
    guest.hidden=true; user.removeAttribute('hidden');
    const av = $('#userAvatar'); const nm = $('#userNameShort');
    if(u.avatar){ av.innerHTML = `<img src="${esc(u.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; }
    else { av.textContent = (u.name||'?')[0].toUpperCase(); }
    nm.textContent = (u.name||'').split(' ')[0] || u.email.split('@')[0];
    $('#favBadge').textContent = (u.favorites||[]).length;
    $('#cartCount').textContent = (u.cart||[]).reduce((s,i)=>s+i.qty,0);
  } else {
    guest.hidden=false; user.setAttribute('hidden','');
    $('#favBadge').textContent = 0;
    $('#cartCount').textContent = S.cartCount();
  }
}

// Вход
$('#btnLogin').onclick = ()=>openAuthModal('login');
$('#btnRegister').onclick = ()=>openAuthModal('register');

$('#btnDoLogin').onclick = ()=>{
  const email = $('#loginEmail').value.trim();
  const pass  = $('#loginPass').value;
  const err   = $('#loginError');
  if(!email||!pass){ showAuthErr(err,'Заполните все поля'); return; }
  const u = Users.login(email, pass);
  if(u==='blocked'){ showAuthErr(err,'Аккаунт заблокирован. Обратитесь в поддержку.'); return; }
  if(!u){ showAuthErr(err,'Неверный e-mail или пароль'); return; }
  Session.start(u);
  closeAuthModal();
  refreshAuthUI();
  toast(`Добро пожаловать, ${u.name||u.email}!`,'success');
  render();
};

$('#btnDoRegister').onclick = ()=>{
  const name  = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const phone = $('#regPhone').value.trim();
  const pass  = $('#regPass').value;
  const pass2 = $('#regPass2').value;
  const err   = $('#regError');
  if(!name||!email||!pass){ showAuthErr(err,'Заполните обязательные поля'); return; }
  if(pass.length<6){ showAuthErr(err,'Пароль должен быть не короче 6 символов'); return; }
  if(pass!==pass2){ showAuthErr(err,'Пароли не совпадают'); return; }
  const u = Users.register(name, email, phone, pass);
  if(!u){ showAuthErr(err,'Этот e-mail уже зарегистрирован'); return; }
  Session.start(u);
  closeAuthModal();
  refreshAuthUI();
  toast(`Аккаунт создан. Добро пожаловать, ${name}!`,'success');
  render();
};

$('#btnLogout').onclick = ()=>{
  Session.end(); refreshAuthUI(); toast('Вы вышли из аккаунта'); render();
};

// Пароль - сила
$('#regPass').addEventListener('input',function(){
  const v=this.value; const bar=$('#pwBar');
  const s=v.length>10&&/[A-Z]/.test(v)&&/\d/.test(v)?100:v.length>6?60:v.length>3?30:0;
  bar.style.width=s+'%';
  bar.style.background=s>=100?'#5fd08a':s>=60?'#F8791D':'#e06464';
});

function showAuthErr(el, msg){ el.textContent=msg; el.removeAttribute('hidden'); }

// Загрузить сессию при старте
Session.load();
refreshAuthUI();

/* мобильное меню (бургер) */
const burger=$('#burger'), mainnav=$('#mainnav');
function closeMobileNav(){ burger?.classList.remove('open'); mainnav?.classList.remove('open'); }
if(burger) burger.onclick=()=>{ burger.classList.toggle('open'); mainnav.classList.toggle('open'); };
// закрывать меню при клике по ссылке навигации
mainnav?.addEventListener('click', e=>{ if(e.target.closest('a[data-link]')) closeMobileNav(); });

window.addEventListener('hashchange', render);

/* ============================================================
   АНИМАЦИЯ ФОНА: сеть + пузырьки
============================================================ */
function initNet(){
  const cv=$('#netCanvas'); const ctx=cv.getContext('2d');
  let W,H,t=0; const cols=26, rows=16;
  function resize(){ W=cv.width=innerWidth; H=cv.height=innerHeight; }
  resize(); addEventListener('resize',resize);
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(248,121,29,0.9)'; ctx.lineWidth=1;
    const cw=W/(cols-1), ch=H/(rows-1);
    const pts=[];
    for(let r=0;r<rows;r++){ pts[r]=[];
      for(let c=0;c<cols;c++){
        const wave = reduce?0:Math.sin((c*0.5)+(r*0.35)+t)*6 + Math.cos((c*0.3)-(r*0.4)+t*0.7)*5;
        pts[r][c]={x:c*cw+wave, y:r*ch+wave*0.6};
      }
    }
    ctx.beginPath();
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const p=pts[r][c];
      if(c<cols-1){const n=pts[r][c+1];ctx.moveTo(p.x,p.y);ctx.lineTo(n.x,n.y);}
      if(r<rows-1){const n=pts[r+1][c];ctx.moveTo(p.x,p.y);ctx.lineTo(n.x,n.y);}
    }
    ctx.stroke();
    t+=0.012;
    requestAnimationFrame(draw);
  }
  if(reduce){ draw(); } else draw();
}

function initBubbles(){
  const cv=$('#bubbleCanvas'); const ctx=cv.getContext('2d');
  let W,H; const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function resize(){ W=cv.width=innerWidth; H=cv.height=innerHeight; }
  resize(); addEventListener('resize',resize);
  const N = reduce?0:34;
  const bs=[];
  for(let i=0;i<N;i++) bs.push(newB());
  function newB(){ return {
    x:Math.random()*W, y:H+Math.random()*H,
    r:1+Math.random()*4, sp:0.3+Math.random()*0.9,
    drift:(Math.random()-0.5)*0.5, a:0.06+Math.random()*0.18
  };}
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(const b of bs){
      b.y-=b.sp; b.x+=Math.sin(b.y*0.02)*b.drift;
      if(b.y< -10){ Object.assign(b,newB(),{y:H+10}); }
      ctx.beginPath();
      ctx.arc(b.x,b.y,b.r,0,7);
      ctx.fillStyle='rgba(180,220,255,'+b.a+')';
      ctx.fill();
      ctx.strokeStyle='rgba(210,235,255,'+(b.a*1.4)+')'; ctx.lineWidth=0.6; ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  if(!reduce) draw();
}

/* мерцающие блики «каустики» — как солнце играет в толще воды */
function initCaustics(){
  const cv=$('#causticsCanvas'); if(!cv) return; const ctx=cv.getContext('2d');
  let W,H,t=0; const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function resize(){ W=cv.width=Math.floor(innerWidth/2); H=cv.height=Math.floor(innerHeight/2); }
  resize(); addEventListener('resize',resize);
  // несколько «пятен» света, медленно дрейфующих и пульсирующих
  const blobs=[];
  for(let i=0;i<7;i++) blobs.push({
    x:Math.random(), y:Math.random(),
    r:0.18+Math.random()*0.22,
    sx:(Math.random()-0.5)*0.00018, sy:(Math.random()-0.5)*0.00012,
    ph:Math.random()*6.28
  });
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(const b of blobs){
      b.x+=b.sx; b.y+=b.sy;
      if(b.x<-0.2)b.x=1.2; if(b.x>1.2)b.x=-0.2;
      if(b.y<-0.2)b.y=1.2; if(b.y>1.2)b.y=-0.2;
      const pulse = reduce?0.5:(0.5+0.5*Math.sin(t+b.ph));
      const cx=b.x*W, cy=b.y*H, rad=b.r*Math.min(W,H)*(0.8+pulse*0.4);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,rad);
      const a=0.05+pulse*0.07;
      g.addColorStop(0,`rgba(150,220,235,${a})`);
      g.addColorStop(1,'rgba(150,220,235,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,rad,0,7); ctx.fill();
    }
    if(!reduce){ t+=0.01; requestAnimationFrame(draw); }
  }
  draw();
}

/* ============================================================
   СТАРТ
============================================================ */
initCaustics();
initNet();
initBubbles();
render();

// Загружаем надёжное хранилище (IndexedDB) и перерисовываем,
// чтобы подхватить сохранённые картинки/тексты, которые не влезли в localStorage
(async function(){
  try {
    await Promise.all([
      S.init(),
      Users.init ? Users.init() : Promise.resolve()
    ]);
    // восстановить сессию пользователя поверх свежих данных
    Session.load();
    render();
    refreshChrome && refreshChrome();
  } catch(e){ /* остаёмся на localStorage-версии */ }
})();

})();
