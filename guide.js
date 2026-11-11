'use strict';

const { heroes, maps, warnings = [] } = await loadGuideData();

async function loadGuideData() {
  try {
    const response = await fetch('./data/guide.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Guide data request failed: ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.heroes) || !Array.isArray(data.maps)) {
      throw new Error('Guide data is missing heroes or maps');
    }
    return data;
  } catch (error) {
    const notice = document.getElementById('data-warning');
    notice.textContent = 'ガイドのデータを読み込めませんでした。ページを再読み込みしてください。';
    notice.hidden = false;
    document.getElementById('count').textContent = '';
    throw error;
  }
}
const sections = {
  heroes: { name: 'ヒーロー', english: 'HEROES', entries: heroes, groups: {
    tank: ['タンク', 'TANK', '#cddfed'], damage: ['ダメージ', 'DAMAGE', '#f7dcd0'], support: ['サポート', 'SUPPORT', '#dcead9']
  }},
  maps: { name: 'マップ', english: 'MAPS', entries: maps, groups: {
    control: ['コントロール', 'CTL', '#d8e2ec'], escort: ['エスコート', 'ESC', '#efddc6'], hybrid: ['ハイブリッド', 'HYB', '#e8ddee'], push: ['プッシュ', 'PSH', '#d9e7d6'], flash: ['フラッシュポイント', 'FLP', '#f0d9d2']
  }}
};
const byId = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const url = (value) => typeof value === 'string' && /^https:\/\//i.test(value) ? escape(value) : '';
const imageUrl = (src) => typeof src === 'string' && /^(assets\/(maps|heroes)\/[a-z0-9.-]+)$/i.test(src) ? escape(src) : url(src);
const image = (src, extra = '', fallback = '') => imageUrl(src) ? '<img src="' + imageUrl(src) + '" alt="" ' + extra + (imageUrl(fallback) ? ' data-fallback="' + imageUrl(fallback) + '"' : '') + '>' : '';
const sourceLink = (src, label) => url(src) ? '<a href="' + url(src) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a>' : '';
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
const dialog = byId('detail');
const query = byId('query');
const view = { heroes: { group: 'all', query: '' }, maps: { group: 'all', query: '' } };
let current = 'heroes';
let openId = '';
let previousTile = '';
let activeCode = '';

function createEntryCards() {
  const coverHeroes = ['dva', 'genji', 'kiriko'].map((key) => image(heroes.find((hero) => hero.id === key)?.image)).join('');
  const mapCover = maps.find((map) => map.id === 'suravasa');
  byId('entry').innerHTML = '<a class="entry" href="#heroes"><span class="entry-art hero-art" aria-hidden="true">' + coverHeroes +
    '</span><strong>ヒーローを探す</strong><small>ロール・武器・アビリティ</small>' + arrow +
    '</a><a class="entry maps" href="#maps">' + image(mapCover?.image, 'class="entry-art cover"', mapCover?.fallbackImage) +
    '<strong>マップを探す</strong><small>ルール・おつゆコメント</small>' + arrow + '</a>';
}
const normalize = (value) => value.normalize('NFKC').toLowerCase().normalize('NFD').replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC')
  .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 96))
  .replace(/[\s・.：:\-ー\u0027’]/g, '');

function renderGrid() {
  const section = sections[current];
  const { group, query: text } = view[current];
  const needle = normalize(text);
  const found = section.entries.filter((item) => (group === 'all' || group === item.group)
    && (!needle || [item.name, item.id, item.code, ...(item.aliases || [])].some((value) => value && normalize(value).includes(needle))));
  const grid = byId('grid');
  grid.className = current === 'maps' ? 'grid maps' : 'grid';
  grid.innerHTML = found.map((item) => {
    const [label, short, tone] = section.groups[item.group];
    const pattern = current === 'maps' ? '<span class="map-pattern" aria-hidden="true"><b>' + short + '</b></span>' : '';
    return '<a class="tile" id="tile-' + escape(item.id) + '" href="#' + current + '/' + escape(item.id) + '" style="--tone:' + tone + '">' +
      '<span class="tile-art ' + (current === 'maps' ? 'map' : 'hero') + '">' + pattern + image(item.image, 'loading="lazy"', item.fallbackImage) + '</span>' +
      '<span class="tile-meta"><small>' + label + '</small><strong>' + escape(item.name) + '</strong>' + arrow + '</span></a>';
  }).join('') || '<p class="empty">見つかりませんでした。検索語や絞り込みを変えてみてください。</p>';
  byId('count').textContent = found.length + '件';
}
function renderSection() {
  const section = sections[current];
  byId('section-title').textContent = section.name + '一覧';
  byId('section-en').textContent = section.english;
  const searchLabel = section.name + '名を検索';
  byId('search-label').textContent = searchLabel;
  query.placeholder = searchLabel;
  query.value = view[current].query;
  document.querySelectorAll('nav [data-tab]').forEach((link) => {
    if (link.dataset.tab === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  byId('filters').innerHTML = [['all', ['すべて']], ...Object.entries(section.groups)].map(([key, [label]]) =>
    '<button class="filter" type="button" data-group="' + key + '" aria-pressed="' + (view[current].group === key) + '">' + label + '</button>').join('');
  renderGrid();
}
function entriesList(items, className, suffix = '') {
  return '<dl class="' + className + '">' + items.map(([name, value]) =>
    '<div><dt>' + escape(name) + '</dt><dd>' + escape(typeof value === 'object' ? JSON.stringify(value) : value) + suffix + '</dd></div>').join('') + '</dl>';
}
function ability(card) {
  const stats = Object.entries(card.stats || {}).filter(([, value]) => value !== '' && value != null);
  return '<article class="ability"><span class="ability-icon" aria-hidden="true">' + (image(card.icon, 'loading="lazy"') || '✦') + '</span><div><h4>' +
    escape(card.name || card.en) + '</h4>' + (card.description ? '<p>' + escape(card.description) + '</p>' : '') +
    (stats.length || card.details.length || card.source ? '<details><summary>詳しい数値・出典</summary>' +
    (stats.length ? entriesList(stats, 'stat-list') : '') + card.details.map((detail) => '<p>' + escape(detail) + '</p>').join('') +
    (url(card.source) ? '<p>' + sourceLink(card.source, '出典を見る') + '</p>' : '') + '</details>' : '') + '</div></article>';
}
const comment = (text) => text ? '<h3>おつゆコメント</h3><p class="map-note">' + escape(text) + '</p>' : '';
function drawRadar(canvas, ratings) {
  const width = canvas.clientWidth;
  if (!width) return;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const cx = width / 2;
  const cy = height / 2;
  const fontSize = width < 300 ? 11 : 12;
  ctx.font = '700 ' + fontSize + 'px "Noto Sans JP", "Yu Gothic", sans-serif';
  const axes = ratings.map(([label, score], index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / ratings.length;
    return { label, score, x: Math.cos(angle), y: Math.sin(angle) };
  });
  const labelSpace = Math.max(...axes.map((axis) => ctx.measureText(axis.label).width));
  const radius = Math.max(20, Math.min(99, height / 2 - 33, cx - labelSpace - 18));
  const point = (axis, fraction) => [cx + axis.x * radius * fraction, cy + axis.y * radius * fraction];
  function polygon(fraction) {
    ctx.beginPath();
    axes.forEach((axis, index) => {
      const [x, y] = point(axis, fraction(axis));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d7dce3';
  for (let ring = 1; ring <= 5; ring += 1) {
    polygon(() => ring / 5);
    ctx.stroke();
  }
  for (const axis of axes) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...point(axis, 1));
    ctx.stroke();
  }
  const value = (axis) => Math.min(5, Math.max(0, axis.score)) / 5;
  polygon(value);
  ctx.fillStyle = '#ff75414b';
  ctx.fill();
  ctx.strokeStyle = '#a83a14';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const axis of axes) {
    ctx.beginPath();
    ctx.arc(...point(axis, value(axis)), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#a83a14';
    ctx.fill();
    const [x, y] = point(axis, 1);
    ctx.textAlign = Math.abs(axis.x) < .15 ? 'center' : axis.x > 0 ? 'left' : 'right';
    ctx.textBaseline = Math.abs(axis.x) < .15 ? (axis.y < 0 ? 'bottom' : 'top') : 'middle';
    ctx.fillStyle = '#263248';
    ctx.fillText(axis.label, x + axis.x * 10, y + axis.y * 10);
  }
}
let radarObserver;
function mountRadar(ratings) {
  radarObserver?.disconnect();
  const canvas = byId('radar-chart');
  if (!canvas) return;
  radarObserver = new ResizeObserver(() => drawRadar(canvas, ratings));
  radarObserver.observe(canvas);
  document.fonts?.ready.then(() => drawRadar(canvas, ratings));
}
function ratingDetail(item) {
  const ratings = Object.entries(item.ratings || {}).filter(([, score]) => Number.isFinite(score));
  if (!ratings.length) return '';
  return '<details class="rating-panel" open><summary>おつゆの性能評価・構成適性</summary>' +
    '<div class="rating-content">' +
    (ratings.length >= 3 ? '<canvas id="radar-chart" aria-hidden="true"></canvas>' : '') +
    entriesList(ratings, 'rating-list', ' / 5') + '</div>' +
    '<p class="media-note">ダイブは機動力を活かして飛び込む、ポークは離れた場所から削る、ラッシュは味方と一緒に距離を詰める構成です。</p></details>';
}
function heroDetail(item) {
  const groups = Object.create(null);
  for (const card of item.cards) (groups[card.group || 'その他'] ||= []).push(card);
  const keyGroups = ['メイン・サブ攻撃', 'スキル', 'ウルト'];
  const cards = keyGroups.filter((key) => groups[key]).map((key) => '<section><h3>' + key + '</h3>' + groups[key].map(ability).join('') + '</section>').join('');
  const extra = Object.entries(groups).filter(([key]) => !keyGroups.includes(key)).map(([key, values]) =>
    '<details><summary>' + escape(key) + '</summary>' + values.map(ability).join('') + '</details>').join('');
  return comment(item.note) + ratingDetail(item) + cards + extra;
}
const mapRules = {"control":"1つの拠点を取り合います。確保すると進捗が増え、100%に到達したチームがラウンドを取ります。","escort":"攻撃側はペイロードを進め、防衛側はその進行を止めます。","hybrid":"攻撃側はまず拠点を取り、そのあとペイロードを進めます。防衛側はそれを止めます。","push":"ロボットを使って、自チームのバリケードを相手より遠くまで押します。","flash":"順に有効になる拠点を取り合い、決着がつくたびに次の拠点へ移動します。"};
function mapDetail(item) {
  return comment(item.comment) + '<h3>このマップでやること</h3><p>' + escape(mapRules[item.group]) + '</p>' +
    (item.feature ? '<p class="map-feature">' + escape(item.feature) + '</p>' : '') +
    (item.code ? '<h3>カスタムゲームコード</h3><div class="code-line"><code>' + escape(item.code) +
      '</code><button class="copy" type="button">コピー</button><span id="copy-status" class="media-note" role="status"></span></div>' : '') +
    (item.image ? '<h3>マップ画像</h3>' + image(item.image, 'class="detail-map-img"', item.fallbackImage) : '') +
    (item.note || item.source ? '<p class="media-note">' + escape(item.note) + ' ' + sourceLink(item.source, '画像の出典') + '</p>' : '');
}
function showDetail(item) {
  const [group, , tone] = sections[current].groups[item.group];
  openId = item.id;
  previousTile = 'tile-' + item.id;
  activeCode = item.code || '';
  const tags = item.tags?.length ? '<div class="tag-row">' + item.tags.map((tag) => '<span class="tag">' + escape(tag) + '</span>').join('') + '</div>' : '';
  byId('detail-content').innerHTML = '<header class="detail-banner" style="--tone:' + tone + '"><div><p class="eyebrow">' +
    group + '</p><h2 id="detail-title">' + escape(item.name) + '</h2>' + tags + '</div>' +
    (current === 'heroes' ? image(item.image) : '') + '</header><div class="detail-body">' +
    (current === 'heroes' ? heroDetail(item) : mapDetail(item)) + '</div>';
  if (!dialog.open) dialog.showModal();
  mountRadar(Object.entries(item.ratings || {}).filter(([, score]) => Number.isFinite(score)));
  dialog.scrollTop = 0;
  byId('close').focus({ preventScroll: true });
}
function route(initial = false) {
  const [tab, id] = location.hash.slice(1).split('/');
  if (tab === 'guide') return;
  const next = tab === 'maps' ? 'maps' : 'heroes';
  if (next !== current || initial) {
    current = next;
    renderSection();
  }
  const item = sections[current].entries.find((entry) => entry.id === id);
  if (item) {
    if (openId !== item.id || !dialog.open) showDetail(item);
    return;
  }
  if (dialog.open) {
    dialog.close();
    openId = '';
    (byId(previousTile) || query).focus({ preventScroll: true });
  } else if (!initial && tab === 'home') {
    window.scrollTo(0, 0);
  } else if (!initial && tab in sections) {
    byId('guide').scrollIntoView({ block: 'start' });
  }
}
function closeDetail() {
  if (history.state?.guideDetail) history.back();
  else {
    history.replaceState(null, '', '#' + current);
    route();
  }
}
query.addEventListener('input', () => {
  view[current].query = query.value;
  renderGrid();
});
byId('filters').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-group]');
  if (!button) return;
  view[current].group = button.dataset.group;
  byId('filters').querySelectorAll('button').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
  renderGrid();
});
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const target = link.hash.slice(1);
  if (link.classList.contains('tile')) {
    event.preventDefault();
    history.pushState({ guideDetail: true }, '', link.hash);
    route();
  } else if (target in sections && link.hash === location.hash) {
    event.preventDefault();
    byId('guide').scrollIntoView({ block: 'start' });
  }
});
document.addEventListener('error', (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.dataset.fallback) {
    const fallback = img.dataset.fallback;
    delete img.dataset.fallback;
    img.src = fallback;
  } else {
    img.hidden = true;
  }
}, true);
byId('close').addEventListener('click', closeDetail);
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDetail();
});
dialog.addEventListener('click', async (event) => {
  if (event.target === dialog) closeDetail();
  if (!event.target.closest('.copy')) return;
  const status = byId('copy-status');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(activeCode);
    } else {
      const field = document.createElement('textarea');
      field.value = activeCode;
      dialog.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard unavailable');
    }
    status.textContent = 'コピーしました';
  } catch {
    status.textContent = 'コードを選択してコピーしてください';
  }
});
window.addEventListener('hashchange', () => route());
if (warnings.length) {
  byId('data-warning').textContent = warnings.join(' ');
  byId('data-warning').hidden = false;
}
query.disabled = false;
createEntryCards();
route(true);
