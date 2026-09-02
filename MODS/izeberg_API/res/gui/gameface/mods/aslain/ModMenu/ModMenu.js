(function () {
'use strict';
var root = document.getElementById('mm-root');
var payload = null;
var loc = {};
var mods = [];
var hotkeys = {};
var multiColumn = false;
var windowEntries = [];
var pickerMode = false;
var columnsGranted = false;
var surfaceW = 1920;
var surfaceH = 1080;
var panelW = 1600;
var panelH = 860;
var panelLeft = 0;
var panelTop = 0;
var selectedLinkage = null;
var values = {};
var baseline = {};
var controls = {};
var searchText = '';
var resultsMode = null;
var RESULTS_MIN_CHARS = 2;
var RESULTS_LIMIT = 150;
var letterFilter = null;
var keyboardMode = false;
var azMode = 'off';
var lastPushSeq = 0;
var lastAckedSeq = 0;
var scaleHandler = null;
var lastSurfaceW = 0;
var lastSurfaceH = 0;
var openDropdown = null;
var openDropdownOwner = null;
var acceptingHotkey = null;
var hoveredNudge = null;
var MINI_ICON_BOX = 18;
var MINI_ICON_MAX_ZOOM = 1.25;
var refreshScrollbars = function () {};
var scrollHover = null;
var setColumnMode = function () {};
var refreshEntriesButton = function () {};
var openEntriesMenu = function () {};
var refreshSearchUi = function () {};
var openHotkeyInfo = {keys: null, accepting: false};
var refreshOpenHotkeyRow = function () {};
function command(name, args) {
try {
if (window.model && typeof window.model[name] === 'function') {
if (args === undefined) window.model[name]();
else window.model[name](args);
}
} catch (error) {
uiLog('jserror command ' + name + ': ' + error);
}
}
function jsonCommand(name, obj) {
command(name, {data: JSON.stringify(obj)});
}
var uiLogBudget = 10;
function uiLog(step) {
if (String(step).indexOf('jserror') < 0) return;
if (uiLogBudget <= 0) return;
uiLogBudget -= 1;
command('onUiLog', {text: String(step)});
}
var lastHoverSound = 0;
var enginePlaySoundBroken = false;
var UI_SOUND_EVENTS = {hover: 'highlight', click: 'highlightx'};
function playUiSound(name) {
if (name === 'hover') {
var now = Date.now();
if (now - lastHoverSound < 60) return;
lastHoverSound = now;
}
if (!enginePlaySoundBroken && window.engine && typeof window.engine.call === 'function') {
try {
window.engine.call('PlaySound', UI_SOUND_EVENTS[name] || name).catch(function () {
enginePlaySoundBroken = true;
jsonCommand('playSound', {name: name});
});
return;
} catch (error) {
enginePlaySoundBroken = true;
}
}
jsonCommand('playSound', {name: name});
}
function bindSounds(node, clickToo) {
node.addEventListener('mouseenter', function () {
if (isNodeGated(node)) return;
playUiSound('hover');
});
if (clickToo !== false) {
node.addEventListener('mousedown', function (event) {
if (event.button !== 0 || isNodeGated(node)) return;
playUiSound('click');
});
}
}
var SOUND_CLASSES = [
'mm-row', 'mm-button', 'mm-tool', 'mm-seg-item', 'mm-reset', 'mm-switch',
'mm-az-letter', 'mm-dd-head', 'mm-dd-item', 'mm-radio', 'mm-swatch',
'mm-pal-slot', 'mm-stepper-btn', 'mm-mini-btn', 'mm-key', 'mm-ctx-item',
'mm-slider-track', 'mm-search-clear',
];
function el(tag, className, parent) {
var node = document.createElement(tag);
if (className) node.className = className;
if (parent) parent.appendChild(node);
if (className) {
var first = className.split(' ')[0];
for (var i = 0; i < SOUND_CLASSES.length; i += 1) {
if (SOUND_CLASSES[i] === first) {
bindSounds(node);
break;
}
}
}
return node;
}
function clearNode(node) {
while (node.firstChild) node.removeChild(node.firstChild);
}
function pointerScale() {
return getScale() || 1;
}
function notePointer(event) {
}
function clientToRoot(x, y) {
var k = pointerScale();
return {x: Number(x || 0) / k, y: Number(y || 0) / k};
}
function rootRelativeRect(node) {
var scale = getScale() || 1;
var rect = node.getBoundingClientRect();
return {
left: rect.left / scale,
top: rect.top / scale,
width: rect.width / scale,
height: rect.height / scale,
};
}
function pointerIn(event) {
notePointer(event);
return clientToRoot(event.clientX, event.clientY);
}
function getScale() {
try {
if (typeof viewEnv !== 'undefined' && typeof viewEnv.remToPx === 'function') {
var rem = Number(viewEnv.remToPx(1));
if (isFinite(rem) && rem > 0.1 && rem < 8) return rem;
}
} catch (error) {}
try {
if (typeof viewEnv !== 'undefined' && typeof viewEnv.getScale === 'function') {
var value = Number(viewEnv.getScale());
if (isFinite(value) && value > 0.1 && value < 8) return value;
}
} catch (error) {}
return 1;
}
var ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', nbsp: '\u00a0'};
function decodeEntities(text) {
return String(text).replace(/&(amp|lt|gt|quot|nbsp|#\d+);/g, function (m, name) {
if (name.charAt(0) === '#') return String.fromCharCode(parseInt(name.slice(1), 10));
return ENTITIES[name] || m;
});
}
function parseRuns(markup) {
var s = String(markup == null ? '' : markup);
var runs = [];
var colors = [];
var sizes = [];
var bold = 0, italic = 0, underline = 0;
var pos = 0;
var pushText = function (chunk) {
if (!chunk) return;
var parts = decodeEntities(chunk).replace(/\r/g, '').split('\n');
for (var pi = 0; pi < parts.length; pi += 1) {
if (pi > 0) runs.push({br: true});
if (!parts[pi]) continue;
runs.push({
text: parts[pi],
color: colors.length ? colors[colors.length - 1] : null,
size: sizes.length ? sizes[sizes.length - 1] : 0,
b: bold > 0, i: italic > 0, u: underline > 0,
});
}
};
while (pos < s.length) {
var lt = s.indexOf('<', pos);
if (lt < 0) { pushText(s.slice(pos)); break; }
pushText(s.slice(pos, lt));
var gt = s.indexOf('>', lt);
if (gt < 0) { pushText(s.slice(lt)); break; }
var raw = s.slice(lt + 1, gt);
var t = raw.trim().toLowerCase();
if (t === 'b') bold += 1;
else if (t === '/b') bold = Math.max(0, bold - 1);
else if (t === 'i') italic += 1;
else if (t === '/i') italic = Math.max(0, italic - 1);
else if (t === 'u') underline += 1;
else if (t === '/u') underline = Math.max(0, underline - 1);
else if (t === 'br' || t === 'br/' || t === 'br /') runs.push({br: true});
else if (t === '/font') { colors.pop(); sizes.pop(); }
else if (t.indexOf('font') === 0) {
var c = /color=['"]?(#[0-9a-fA-F]{3,8})/.exec(raw);
colors.push(c ? c[1] : (colors.length ? colors[colors.length - 1] : null));
var sz = /size=['"]?(\d+)/.exec(raw);
sizes.push(sz ? +sz[1] : (sizes.length ? sizes[sizes.length - 1] : 0));
} else if (t.indexOf('img') === 0) {
var srcM = /src=['"]([^'"]+)['"]/.exec(raw);
var wM = /width=['"]?(\d+)/.exec(raw);
var hM = /height=['"]?(\d+)/.exec(raw);
var hsM = /hspace=['"]?(-?\d+)/.exec(raw);
var vsM = /vspace=['"]?(-?\d+)/.exec(raw);
if (srcM) {
runs.push({img: srcM[1], w: wM ? +wM[1] : 0, h: hM ? +hM[1] : 0,
hspace: hsM ? +hsM[1] : null, vspace: vsM ? +vsM[1] : null});
}
} else if (t === 'li' || t === '/li') {
if (t === 'li') {
runs.push({br: true});
runs.push({text: '• ', color: colors.length ? colors[colors.length - 1] : null});
}
} else if (t.indexOf('p') === 0 && (t === 'p' || t.charAt(1) === ' ' || t === '/p')) {
var alignM = /align=['"]?(left|center|right)/i.exec(raw);
runs.push({br: true, align: alignM ? alignM[1].toLowerCase() : null});
}
pos = gt + 1;
}
return runs;
}
var LONG_TOKEN = 34;
var LONG_TOKEN_BASE_SIZE = 13;
function scaleMarkupImage(img, url, w, h) {
if (!(w > 0 && h > 0)) return;
try {
var canvas = document.createElement('canvas');
if (!canvas || typeof canvas.getContext !== 'function') return;
var ctx = canvas.getContext('2d');
if (!ctx) return;
canvas.width = w;
canvas.height = h;
canvas.className = img.className;
canvas.style.width = w + 'rem';
canvas.style.height = h + 'rem';
if (img.style.marginLeft) canvas.style.marginLeft = img.style.marginLeft;
if (img.style.marginRight) canvas.style.marginRight = img.style.marginRight;
if (img.style.position) {
canvas.style.position = img.style.position;
canvas.style.top = img.style.top;
}
var source = new Image();
source.addEventListener('load', function () {
try {
ctx.drawImage(source, 0, 0, w, h);
} catch (error) {
uiLog('jserror canvas draw: ' + error);
return;
}
if (img.parentNode) img.parentNode.replaceChild(canvas, img);
});
source.src = url;
} catch (error) {
uiLog('jserror canvas image: ' + error);
}
}
function stepperSign(node, isPlus) {
el('div', 'mm-step-bar-h', node);
if (isPlus) el('div', 'mm-step-bar-v', node);
}
function breakLimitFor(fontSize) {
if (fontSize > LONG_TOKEN_BASE_SIZE) {
return Math.max(3, Math.round(LONG_TOKEN * LONG_TOKEN_BASE_SIZE / fontSize));
}
return LONG_TOKEN;
}
function breakLongToken(word, fontSize) {
var limit = breakLimitFor(fontSize);
if (word.length <= limit) return [word];
var chunks = [];
var chunk = '';
var sepAt = Math.min(12, limit);
for (var i = 0; i < word.length; i += 1) {
var ch = word.charAt(i);
chunk += ch;
if ((ch === '\\' || ch === '/') && chunk.length >= sepAt) {
chunks.push(chunk);
chunk = '';
} else if (chunk.length >= limit) {
chunks.push(chunk);
chunk = '';
}
}
if (chunk) chunks.push(chunk);
return chunks;
}
function collectDescendants(node, out) {
var kids = node.children;
if (!kids) return;
for (var i = 0; i < kids.length; i += 1) {
out.push(kids[i]);
collectDescendants(kids[i], out);
}
}
function contentSpan(box) {
var kids = box.children;
if (!kids || !kids.length) return null;
var top = null;
var bottom = null;
for (var i = 0; i < kids.length; i += 1) {
if (kids[i].style && kids[i].style.top) continue;
var r = rootRelativeRect(kids[i]);
if (!(r.height > 0)) continue;
if (top === null || r.top < top) top = r.top;
if (bottom === null || r.top + r.height > bottom) bottom = r.top + r.height;
}
if (top === null || bottom === null) return null;
return Math.ceil(bottom - top);
}
function raiseToContent(box, need) {
if (need === null || !box || !box.parentNode) return;
if (!(need > rootRelativeRect(box).height + 1)) return;
var had = parseInt(box.style.minHeight, 10) || 0;
if (need > had) box.style.minHeight = need + 'rem';
}
var richHeightCache = {};
var richHeightKeys = [];
var RICH_CACHE_MAX = 200;
function rememberRowHeights(markup, heights) {
if (!markup || !heights.length) return;
if (!richHeightCache.hasOwnProperty(markup)) {
richHeightKeys.push(markup);
while (richHeightKeys.length > RICH_CACHE_MAX) {
delete richHeightCache[richHeightKeys.shift()];
}
}
richHeightCache[markup] = heights;
}
function fixRowHeights(rows, host, markup) {
for (var r = 0; r < rows.length; r += 1) {
var row = rows[r];
if (!row || !row.parentNode) continue;
var kids = [];
collectDescendants(row, kids);
if (!kids.length) continue;
var top = null;
var bottom = null;
for (var c = 0; c < kids.length; c += 1) {
if (kids[c].style && kids[c].style.top) continue;
var box = rootRelativeRect(kids[c]);
if (!(box.height > 0)) continue;
if (top === null || box.top < top) top = box.top;
if (bottom === null || box.top + box.height > bottom) {
bottom = box.top + box.height;
}
}
if (top === null || bottom === null) continue;
raiseToContent(row, Math.ceil(bottom - top));
}
if (markup) {
var measured = [];
for (var q = 0; q < rows.length; q += 1) {
measured.push(parseInt(rows[q].style.minHeight, 10) || 0);
}
rememberRowHeights(markup, measured);
}
raiseToContent(host, contentSpan(host));
var up = host ? host.parentNode : null;
var hops = 0;
while (up && up !== root && hops < 6) {
raiseToContent(up, contentSpan(up));
if (String(up.className || '').indexOf('mm-comp') >= 0) break;
up = up.parentNode;
hops += 1;
}
}
var pendingImageHosts = [];
function notifyMarkupImageLoaded(node) {
for (var i = 0; i < pendingImageHosts.length; i += 1) {
var entry = pendingImageHosts[i];
if (entry.node !== node) continue;
if (!node.parentNode) return;
fixRowHeights(entry.rows, node, entry.markup);
return;
}
}
function renderRich(node, markup) {
clearNode(node);
if (node.className.indexOf('mm-rich') < 0) node.className += ' mm-rich';
var runs = parseRuns(markup);
var i;
var line = null;
var lineFilled = false;
var sized = [];
var pendingAlign = null;
var pendingGap = false;
var pairBox = null;
var takeGap = function (node) {
if (!pendingGap || !node || !node.style) return;
node.style.marginLeft = '0.3em';
pendingGap = false;
};
var openLine = function () {
if (!line) {
line = el('div', 'mm-rt-line', node);
if (pendingAlign) {
line.style.justifyContent = pendingAlign === 'center' ? 'center'
: (pendingAlign === 'right' ? 'flex-end' : 'flex-start');
}
lineFilled = false;
}
return line;
};
for (i = 0; i < runs.length; i += 1) {
var run = runs[i];
if (run.br) {
if ('align' in run) pendingAlign = run.align;
if (line && lineFilled) {
line = null;
} else {
el('div', 'mm-rt-line mm-rt-empty', node);
line = null;
}
continue;
}
if (run.img) {
pairBox = el('div', 'mm-rt-pair', openLine());
var img = el('img', 'mm-rt-img', pairBox);
takeGap(pairBox);
img.src = imageUrl(run.img);
if (run.w) img.style.width = run.w + 'rem';
if (run.h) img.style.height = run.h + 'rem';
if (run.hspace !== null && run.hspace !== undefined) {
img.style.marginLeft = run.hspace + 'rem';
img.style.marginRight = run.hspace + 'rem';
}
if (!run.w && !run.h) {
(function (node2, imgNode) {
imgNode.addEventListener('load', function () {
notifyMarkupImageLoaded(node2);
});
}(node, img));
}
if (run.vspace !== null && run.vspace !== undefined) {
img.style.position = 'relative';
img.style.top = run.vspace + 'rem';
}
if (run.w && run.h) scaleMarkupImage(img, imageUrl(run.img), run.w, run.h);
lineFilled = true;
continue;
}
var rawRun = String(run.text);
var leadGap = /^[ \t\u00a0]/.test(rawRun);
var tokens = rawRun.split(/[ \t\u00a0]+/);
var solid = [];
for (var t = 0; t < tokens.length; t += 1) {
if (tokens[t]) solid.push(tokens[t]);
}
if (!solid.length) {
if (rawRun.length) {
pairBox = null;
var kids = line ? line.childNodes : null;
var last = (kids && kids.length) ? kids[kids.length - 1] : null;
if (last && last.style) {
last.style.marginRight = '0.4em';
} else {
pendingGap = true;
}
}
continue;
}
var glued = (pairBox && !leadGap) ? pairBox : null;
pairBox = null;
for (var w = 0; w < solid.length; w += 1) {
var target = (w === 0 && glued) ? glued : openLine();
var chunks = (solid[w].length > breakLimitFor(Number(run.size) || 0))
? null : [solid[w]];
if (!chunks) {
var longItem = el('div', 'mm-rt mm-rt-break', target);
longItem.textContent = solid[w];
if (run.color) longItem.style.color = run.color;
if (run.size) {
longItem.style.fontSize = run.size + 'rem';
var longBox = Math.round(run.size * 1.25);
longItem.style.lineHeight = longBox + 'rem';
var longHost = line || target;
var hadLong = parseInt(longHost.style.minHeight, 10) || 0;
if (longBox > hadLong) longHost.style.minHeight = longBox + 'rem';
if (sized[sized.length - 1] !== longHost) sized.push(longHost);
}
if (run.b) longItem.style.fontWeight = '700';
if (run.i) longItem.style.fontStyle = 'italic';
if (run.u) longItem.style.textDecoration = 'underline';
if (w === 0) takeGap(longItem);
lineFilled = true;
continue;
}
for (var c = 0; c < chunks.length; c += 1) {
var item = el('div', c < chunks.length - 1
? 'mm-rt mm-rt-glue' : 'mm-rt', target);
item.textContent = chunks[c];
if (run.color) item.style.color = run.color;
if (run.size) {
item.style.fontSize = run.size + 'rem';
var lineBox = Math.round(run.size * 1.25);
item.style.lineHeight = lineBox + 'rem';
var heightHost = line || target;
var had = parseInt(heightHost.style.minHeight, 10) || 0;
if (lineBox > had) heightHost.style.minHeight = lineBox + 'rem';
if (sized[sized.length - 1] !== heightHost) sized.push(heightHost);
}
if (run.b) item.style.fontWeight = '700';
if (run.i) item.style.fontStyle = 'italic';
if (run.u) item.style.textDecoration = 'underline';
if (w === 0 && c === 0) {
if (leadGap) item.style.marginLeft = '0.3em';
else takeGap(item);
}
}
}
lineFilled = true;
}
var knownHeights = richHeightCache[markup];
if (knownHeights) {
for (var kh = 0; kh < sized.length && kh < knownHeights.length; kh += 1) {
if (knownHeights[kh] > 0) {
var had = parseInt(sized[kh].style.minHeight, 10) || 0;
if (knownHeights[kh] > had) {
sized[kh].style.minHeight = knownHeights[kh] + 'rem';
}
}
}
}
if (sized.length) {
for (var pe = pendingImageHosts.length - 1; pe >= 0; pe -= 1) {
if (pendingImageHosts[pe].node === node) pendingImageHosts.splice(pe, 1);
}
pendingImageHosts.push({node: node, rows: sized, markup: markup});
while (pendingImageHosts.length > 40) pendingImageHosts.shift();
var repair = function () { fixRowHeights(sized, node, markup); };
afterTwoFrames(function () {
repair();
window.setTimeout(repair, 60);
});
}
}
function setLabel(node, text, useHTML) {
var s = String(text == null ? '' : text);
var plain = s.indexOf('<') < 0 && s.indexOf('&') < 0;
if ((useHTML === false || plain) && s.indexOf('\n') < 0) {
clearNode(node);
node.textContent = useHTML === false ? s : decodeEntities(s);
return;
}
if (useHTML === false) {
renderRich(node, s.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
return;
}
renderRich(node, s);
}
function plainText(text) {
return String(text == null ? '' : text).replace(/<[^>]*>/g, '').trim();
}
function normColor(value) {
var s = String(value == null ? '' : value).trim();
if (s && s.charAt(0) !== '#') s = '#' + s;
return s;
}
function valueEquals(a, b) {
if (a === b) return true;
if (typeof a === 'number' && typeof b === 'number') return a === b;
try {
return JSON.stringify(a) === JSON.stringify(b);
} catch (error) {
return false;
}
}
function readPayload() {
try {
payload = JSON.parse(String(window.model && window.model.payload || '{}'));
} catch (error) {
uiLog('jserror payload parse: ' + error);
payload = {};
}
loc = payload.loc || {};
mods = payload.mods || [];
hotkeys = payload.hotkeys || {};
windowEntries = payload.windowEntries || [];
pickerMode = !!payload.pickerMode;
multiColumn = !!payload.multiColumnMode;
columnsGranted = fourColumnsFit();
if (payload.azMode) azMode = String(payload.azMode);
openHotkeyInfo = {keys: payload.openHotkey || null, accepting: false};
var ui = payload.menuSettings || {};
if (ui.accent && /^[0-9a-fA-F]{6}$/.test(String(ui.accent).replace('#', ''))) {
accentColor = String(ui.accent).replace('#', '').toLowerCase();
}
if (ui.background && /^[0-9a-fA-F]{6}$/.test(String(ui.background).replace('#', ''))) {
backgroundColor = String(ui.background).replace('#', '').toLowerCase();
}
windowTransparent = !!ui.transparent;
var storedAlpha = Number(ui.backgroundAlpha);
if (isFinite(storedAlpha) && storedAlpha >= 0.3 && storedAlpha <= 1) {
backgroundAlpha = storedAlpha;
}
fullScreen = !!ui.fullScreen;
menuFont = String(ui.font || 'default').toLowerCase();
applyFont();
var storedFontScale = Number(ui.fontScale);
if (isFinite(storedFontScale) && storedFontScale >= 0.8 && storedFontScale <= 1.6) {
fontScale = storedFontScale;
}
applyFontScale();
menuLanguage = String(ui.language || 'auto').toLowerCase();
var storedScale = Number(ui.scale);
if (isFinite(storedScale) && storedScale >= 0.7 && storedScale <= 2) {
panelScale = storedScale;
}
userPresets = [];
var storedPresets = payload.colorPresets || [];
for (var p = 0; p < 48; p += 1) {
var slotValue = storedPresets[p];
userPresets.push(slotValue ? String(slotValue).replace('#', '').toLowerCase() : null);
}
modStyles = payload.modStyles || {};
modIcons = payload.modIcons || {};
var registry = payload.images || {};
for (var token in registry) {
if (registry.hasOwnProperty(token)) imageRegistry[token] = registry[token];
}
applyGeometry(payload);
values = {};
baseline = {};
for (var i = 0; i < mods.length; i += 1) seedMod(mods[i]);
snapshotShadow();
}
function applyGeometry(data) {
if (data.gameScale) {
var gs = Number(data.gameScale);
if (isFinite(gs) && gs > 0.4 && gs < 4) gameScale = gs;
}
if (data.surface) {
surfaceW = Number(data.surface.width) || surfaceW;
surfaceH = Number(data.surface.height) || surfaceH;
}
if (data.panel) {
panelW = Number(data.panel.width) || panelW;
panelH = Number(data.panel.height) || panelH;
if (data.panel.left !== undefined) panelLeft = Number(data.panel.left) || 0;
if (data.panel.top !== undefined) panelTop = Number(data.panel.top) || 0;
}
}
function stashTemplateImages(template) {
var apply = function (tpl) {
eachComponent(tpl, function (comp) {
if (comp.type !== 'Image') return;
comp.templateImage = {
source: comp.source || '',
atlas: comp.atlas || null,
width: comp.width,
height: comp.height,
label: comp.label,
collapsed: !!comp.collapsed,
};
});
};
apply(template);
if (template.multiColumnTemplate) apply(template.multiColumnTemplate);
}
function seedMod(template, keepBaseline) {
var linkage = template.linkage;
stashTemplateImages(template);
var store = values[linkage] = {};
if ('enabled' in template) store.enabled = !!template.enabled;
eachComponent(template, function (comp) {
if (comp.varName !== undefined && 'value' in comp) store[comp.varName] = comp.value;
});
if (keepBaseline && baseline[linkage]) {
var base = baseline[linkage];
for (var key in store) {
if (store.hasOwnProperty(key) && !(key in base)) base[key] = store[key];
}
return;
}
baseline[linkage] = JSON.parse(JSON.stringify(store));
}
function eachComponent(template, callback) {
var columns = ['column1', 'column2', 'column3', 'column4'];
for (var c = 0; c < columns.length; c += 1) {
var list = template[columns[c]];
if (!list) continue;
for (var i = 0; i < list.length; i += 1) callback(list[i], columns[c]);
}
}
function findMod(linkage) {
for (var i = 0; i < mods.length; i += 1) {
if (mods[i].linkage === linkage) return mods[i];
}
return null;
}
function activeColumns() {
return multiColumn && columnsGranted;
}
function activeTemplate(mod) {
if (activeColumns() && mod.multiColumnTemplate) return mod.multiColumnTemplate;
return mod;
}
function displaySlots(template) {
var names = ['column1', 'column2', 'column3', 'column4'];
var n = activeColumns() ? 4 : 2;
var s, i, j;
var hasWide = (template.column3 && template.column3.length) ||
(template.column4 && template.column4.length);
if (activeColumns() && !hasWide) {
var all = [];
for (i = 0; i < 2; i += 1) {
var src = template[names[i]];
if (src) for (j = 0; j < src.length; j += 1) all.push(src[j]);
}
if (all.length >= n * 2) {
var hasLabels = false;
for (i = 0; i < all.length; i += 1) {
if (all[i] && all[i].type === 'Label') { hasLabels = true; break; }
}
var wrapped = fillWrapSlots(all, n, hasLabels);
if (hasLabels && !wrapped[n - 1].length) wrapped = fillWrapSlots(all, n, false);
return wrapped;
}
}
var slots = [];
for (s = 0; s < n; s += 1) slots.push([]);
for (i = 0; i < names.length; i += 1) {
var col = template[names[i]];
if (!col || !col.length) continue;
var target = slots[i % n];
for (j = 0; j < col.length; j += 1) target.push(col[j]);
}
return slots;
}
function fillWrapSlots(all, n, labelBreaks) {
var slots = [];
for (var s = 0; s < n; s += 1) slots.push([]);
var share = all.length / n;
var wcol = 0;
var count = 0;
for (var i = 0; i < all.length; i += 1) {
var entry = all[i];
var boundary = labelBreaks ? !!(entry && entry.type === 'Label') : true;
var forceBreak = count >= share * 2;
if ((boundary || forceBreak) && count >= share && wcol < n - 1) {
wcol += 1;
count = 0;
}
slots[wcol].push(entry);
count += 1;
}
return slots;
}
function isHotkeyVar(mod, varName) {
var hit = false;
eachComponent(activeTemplate(mod), function (comp) {
if (comp.varName === varName && comp.type === 'HotKey') hit = true;
});
return hit;
}
function keysetEquals(a, b) {
var sorted = function (value) {
if (!value || typeof value.slice !== 'function') return value;
return value.slice().sort();
};
return valueEquals(sorted(a), sorted(b));
}
function modChangedVars(linkage) {
var mod = findMod(linkage);
var current = values[linkage] || {};
var base = baseline[linkage] || {};
var changed = [];
for (var key in current) {
if (!current.hasOwnProperty(key)) continue;
if (mod && isHotkeyVar(mod, key)) {
if (!keysetEquals(current[key], base[key])) changed.push(key);
continue;
}
if (!valueEquals(current[key], base[key])) changed.push(key);
}
return changed;
}
function findComponent(mod, varName) {
var found = null;
eachComponent(activeTemplate(mod), function (comp) {
if (!found && comp.varName === varName) found = comp;
});
return found;
}
function keysetText(parts) {
var out = [];
if (parts.modifierCtrl) out.push('CTRL');
if (parts.modifierAlt) out.push('ALT');
if (parts.modiferShift) out.push('SHIFT');
if (parts.text) out.push(parts.text);
return out.length ? out.join(' + ') : null;
}
var VALUE_SPEC = /%([-+0]*)(\d*)(?:\.(\d+))?([fdis])/;
function formatValue(format, value) {
var text = String(format == null ? '{{value}}' : format);
if (text.indexOf('{{value}}') >= 0) return text.replace('{{value}}', String(value));
var spec = VALUE_SPEC.exec(text);
if (!spec) return text;
var flags = spec[1] || '';
var width = Number(spec[2]) || 0;
var precision = spec[3] === undefined ? null : Number(spec[3]);
var conv = spec[4];
var number = Number(value);
var numeric = conv !== 's' && typeof value !== 'boolean' && value !== null &&
value !== '' && isFinite(number);
var body;
if (!numeric) {
body = String(value);
} else if (conv === 'f') {
body = number.toFixed(precision === null ? 6 : Math.min(20, precision));
} else {
body = String(number < 0 ? Math.ceil(number) : Math.floor(number));
}
var sign = '';
if (numeric) {
if (body.charAt(0) === '-') {
sign = '-';
body = body.slice(1);
} else if (flags.indexOf('+') >= 0) {
sign = '+';
}
}
var pad = width - (sign.length + body.length);
if (pad > 0) {
var zeros = numeric && flags.indexOf('0') >= 0 && flags.indexOf('-') < 0;
var fill = new Array(pad + 1).join(zeros ? '0' : '\u00A0');
if (flags.indexOf('-') >= 0) body = body + fill;
else if (zeros) body = fill + body;
else sign = fill + sign;
}
var filled = sign + body;
return text.replace(spec[0], function () { return filled; }).replace(/%%/g, '%');
}
function describeValue(linkage, comp, value, wanted) {
if (comp === null) {
return {text: value ? 'On' : 'Off'};
}
var type = comp.type;
if (type === 'CheckBox') return {text: value ? 'On' : 'Off'};
if (type === 'HotKey') {
var entry = (hotkeys[linkage] || {})[comp.varName] || {};
var parts = wanted === 'old'
? {text: entry.savedText, modifierCtrl: entry.savedModifierCtrl,
modifierAlt: entry.savedModifierAlt, modiferShift: entry.savedModiferShift}
: entry;
var text = keysetText(parts);
return text ? {text: text} : {text: 'not set', muted: true};
}
if (type === 'Dropdown' || type === 'RadioButtonGroup' || type === 'StepSlider') {
var option = (comp.options || [])[Number(value)];
if (option) return {text: plainText(option.label)};
return {text: String(value), raw: true};
}
if (type === 'Slider') {
return {text: formatValue(comp.format, value)};
}
if (type === 'ColorChoice') {
return {text: '#' + String(value).toUpperCase(), swatch: String(value)};
}
if (type === 'CheckBoxColor') {
var box = (value && typeof value === 'object') ? value : {enabled: false, color: 'ffffff'};
return {text: (box.enabled ? 'On' : 'Off') + ', #' + String(box.color).toUpperCase(),
swatch: String(box.color)};
}
if (type === 'RangeSlider') {
var pair = value || [];
return {text: String(pair[0]) + ' - ' + String(pair[1])};
}
if (value === '' || value === null || value === undefined) return {text: 'empty', muted: true};
if (typeof value === 'object') return {text: JSON.stringify(value), raw: true};
return {text: clipValue(String(value))};
}
var VALUE_CLIP = 60;
function clipValue(text) {
if (text.length <= VALUE_CLIP) return text;
return text.slice(0, VALUE_CLIP - 3) + '...';
}
function changeGroups() {
var CHARS_WORD = plainText(loc.reviewChars || 'characters');
var groups = [];
for (var i = 0; i < mods.length; i += 1) {
var mod = mods[i];
var changed = modChangedVars(mod.linkage);
if (!changed.length) continue;
var rows = [];
for (var c = 0; c < changed.length; c += 1) {
var varName = changed[c];
var comp = varName === 'enabled' ? null : findComponent(mod, varName);
var label = comp ? plainText(comp.text || varName) : varName;
if (comp === null && varName === 'enabled') label = 'Mod enabled';
rows.push({
linkage: mod.linkage,
varName: varName,
label: label || varName,
from: describeValue(mod.linkage, comp, (baseline[mod.linkage] || {})[varName], 'old'),
to: describeValue(mod.linkage, comp, (values[mod.linkage] || {})[varName], 'new')
});
var row = rows[rows.length - 1];
if (row.from.text === row.to.text) {
var oldRaw = (baseline[mod.linkage] || {})[varName];
var newRaw = (values[mod.linkage] || {})[varName];
if (typeof oldRaw === 'string' && typeof newRaw === 'string' && oldRaw !== newRaw) {
row.from = {text: String(oldRaw.length) + ' ' + CHARS_WORD, muted: true};
row.to = {text: String(newRaw.length) + ' ' + CHARS_WORD, muted: true};
}
}
}
groups.push({linkage: mod.linkage, name: modDisplayName(mod), rows: rows});
}
return groups;
}
function totalChanges() {
var count = 0;
for (var linkage in values) {
if (values.hasOwnProperty(linkage)) count += modChangedVars(linkage).length;
}
return count;
}
var reviewNode = null;
function closeReview() {
if (reviewNode && reviewNode.parentNode) reviewNode.parentNode.removeChild(reviewNode);
reviewNode = null;
}
function reviewValueNode(parent, cls, described) {
var node = el('div', cls, parent);
if (described.swatch) {
var chip = el('div', 'mm-review-swatch', node);
chip.style.backgroundColor = '#' + described.swatch;
}
var text = el('div', described.raw ? 'mm-review-raw' : 'mm-review-text', node);
if (described.muted) text.className += ' mm-review-muted';
text.textContent = described.text;
return node;
}
function openReview() {
var groups = changeGroups();
if (!groups.length) return;
if (gearMenu) closeGearMenu();
closeContextMenu();
closeOpenDropdown();
hideTooltip();
reviewNode = el('div', 'mm-review', root);
zoomFloating(reviewNode);
var head = el('div', 'mm-review-head', reviewNode);
head.textContent = plainText(loc.reviewTitle || 'Unsaved changes');
var body = el('div', 'mm-review-body', reviewNode);
for (var g = 0; g < groups.length; g += 1) {
var group = groups[g];
var title = el('div', 'mm-review-mod', body);
title.textContent = group.name;
for (var r = 0; r < group.rows.length; r += 1) {
(function (row) {
var line = el('div', 'mm-review-row', body);
var label = el('div', 'mm-review-label', line);
label.textContent = row.label;
reviewValueNode(line, 'mm-review-from', row.from);
el('div', 'mm-review-arrow', line).textContent = '>';
reviewValueNode(line, 'mm-review-to', row.to);
line.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0) return;
closeReview();
selectMod(row.linkage);
revealVar(row.linkage, row.varName);
});
}(group.rows[r]));
}
}
var WIDTH = 520;
reviewNode.style.width = WIDTH + 'rem';
reviewNode.style.left = '0rem';
reviewNode.style.top = '0rem';
reviewNode.style.visibility = 'hidden';
var probe = null;
var measure = function () {
if (!reviewNode) return;
probe = el('div', 'mm-review-probe', root);
var cells = reviewNode.getElementsByClassName('mm-review-text');
for (var m = 0; m < cells.length; m += 1) {
el('div', '', probe).textContent = cells[m].textContent;
}
window.requestAnimationFrame(place);
};
var place = function () {
if (!reviewNode) return;
var k = getScale() || 1;
var widest = 0;
var spans = probe ? probe.childNodes : [];
for (var n = 0; n < spans.length; n += 1) {
var w = (Number(spans[n].offsetWidth) || 0) / k;
if (w > widest) widest = w;
}
if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
probe = null;
var column = Math.max(40, Math.min(170, Math.ceil(widest) + 20));
var sides = reviewNode.getElementsByClassName('mm-review-from');
var s2 = reviewNode.getElementsByClassName('mm-review-to');
for (var c2 = 0; c2 < sides.length; c2 += 1) sides[c2].style.width = column + 'rem';
for (var c3 = 0; c3 < s2.length; c3 += 1) s2[c3].style.width = column + 'rem';
var anchor = rootRelativeRect(document.getElementById('mm-counter'));
var height = (Number(reviewNode.offsetHeight) || 0) / k;
var maxHeight = Math.max(140, anchor.top - 24);
if (height > maxHeight) {
var headHeight = (Number(document.getElementsByClassName('mm-review-head')[0].offsetHeight) || 0) / k;
body.style.maxHeight = (maxHeight - headHeight - 20) + 'rem';
body.style.overflowY = 'auto';
height = maxHeight;
}
var x = anchor.left;
if (x + WIDTH > surfaceW - 12) x = surfaceW - 12 - WIDTH;
if (x < 12) x = 12;
reviewNode.style.left = Math.round(x) + 'rem';
reviewNode.style.top = Math.round(Math.max(12, anchor.top - height - 8)) + 'rem';
reviewNode.style.visibility = 'visible';
refreshScrollbars();
};
window.requestAnimationFrame(function () { window.requestAnimationFrame(measure); });
}
function toggleReview() {
if (reviewNode) closeReview();
else openReview();
}
function revealVar(linkage, varName) {
var store = controls[linkage] || {};
var node = store[varName] && store[varName].node;
if (!node) return;
var box = document.getElementById('mm-opts');
var top = rootRelativeRect(node).top - rootRelativeRect(box).top;
if (top < 0 || top > rootRelativeRect(box).height - 40) {
box.scrollTop = box.scrollTop + top - 40;
refreshScrollbars();
}
var HALF = 220;
var CYCLES = 2;
var PEAK = 0.13;
var started = Date.now();
var step = function () {
if (!node.parentNode) return;
var elapsed = Date.now() - started;
if (elapsed >= HALF * 2 * CYCLES) {
node.style.backgroundColor = '';
return;
}
var phase = (elapsed % (HALF * 2)) / HALF;
var linear = phase <= 1 ? phase : 2 - phase;
var eased = linear * linear * (3 - 2 * linear);
node.style.backgroundColor = '#' + mixWithBackdrop(accentColor, PEAK * eased);
window.requestAnimationFrame(step);
};
window.requestAnimationFrame(step);
}
function updateFooter() {
var count = 0;
var modCount = 0;
for (var linkage in values) {
if (!values.hasOwnProperty(linkage)) continue;
var changed = modChangedVars(linkage).length;
count += changed;
if (changed > 0) modCount += 1;
}
var counter = document.getElementById('mm-counter');
counter.style.display = count > 0 ? 'flex' : 'none';
document.getElementById('mm-counter-pill').textContent = String(count);
document.getElementById('mm-counter-text').textContent =
plainText(loc.unsavedChanges || 'unsaved changes') +
' (' + plainText(loc.unsavedMods || 'mods') + ': ' + modCount + ')';
var apply = document.getElementById('mm-apply');
var pending = count > 0 || lookDirty;
apply.className = pending ? 'mm-button mm-button-secondary' : 'mm-button mm-button-secondary mm-disabled';
renderListDirtyDots();
}
function notifyLive(linkage) {
var envelope = {};
envelope[linkage] = values[linkage];
window.requestAnimationFrame(function () {
window.requestAnimationFrame(function () {
jsonCommand('componentChanged', envelope);
});
});
}
function applyChanges() {
closeReview();
if (lookDirty) saveMenuSettings();
var data = {};
var any = false;
for (var linkage in values) {
if (!values.hasOwnProperty(linkage)) continue;
if (modChangedVars(linkage).length > 0) {
data[linkage] = values[linkage];
any = true;
}
}
if (!any) return;
jsonCommand('sendModsData', data);
for (var key in data) {
if (data.hasOwnProperty(key)) baseline[key] = JSON.parse(JSON.stringify(values[key]));
}
snapshotShadow();
updateFooter();
}
var shadow = {};
var undoStack = [];
var redoStack = [];
var replaying = false;
var HISTORY_LIMIT = 200;
var CONTINUOUS_TYPES = {
Slider: true, StepSlider: true, RangeSlider: true,
NumericStepper: true, TextInput: true,
ColorChoice: true, CheckBoxColor: true,
};
var COALESCE_WINDOW = 700;
function snapshotShadow() {
shadow = JSON.parse(JSON.stringify(values));
undoStack = [];
redoStack = [];
updateHistoryButtons();
}
function recordChange(linkage, varName) {
if (replaying) return;
var current = (values[linkage] || {})[varName];
var previous = (shadow[linkage] || {})[varName];
if (valueEquals(current, previous)) return;
var top = undoStack[undoStack.length - 1];
var mod = findMod(linkage);
var comp = varName === 'enabled' ? null : findComponent(mod, varName);
var continuous = !!comp && CONTINUOUS_TYPES[comp.type];
var now = Date.now();
var merges = top && top.linkage === linkage && top.varName === varName &&
continuous && (now - (top.at || 0)) < COALESCE_WINDOW;
if (merges) {
top.to = JSON.parse(JSON.stringify(current));
top.at = now;
if (valueEquals(top.from, top.to)) undoStack.pop();
} else {
undoStack.push({
linkage: linkage,
varName: varName,
at: now,
from: previous === undefined ? undefined : JSON.parse(JSON.stringify(previous)),
to: JSON.parse(JSON.stringify(current)),
});
if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
}
redoStack = [];
if (!shadow[linkage]) shadow[linkage] = {};
shadow[linkage][varName] = JSON.parse(JSON.stringify(current));
updateHistoryButtons();
}
function syncShadow(linkage, varName) {
if (!shadow[linkage]) shadow[linkage] = {};
var value = (values[linkage] || {})[varName];
shadow[linkage][varName] = value === undefined
? undefined : JSON.parse(JSON.stringify(value));
}
var LOOK_KEYS = ['accent', 'background', 'backgroundAlpha', 'scale', 'transparent'];
function currentLook() {
return {
accent: accentColor,
background: backgroundColor,
backgroundAlpha: backgroundAlpha,
scale: panelScale,
transparent: windowTransparent,
};
}
function applyLook(values) {
var seen = false;
if (values.accent && /^[0-9a-fA-F]{6}$/.test(String(values.accent))) {
accentColor = String(values.accent).toLowerCase();
seen = true;
}
if (values.background && /^[0-9a-fA-F]{6}$/.test(String(values.background))) {
backgroundColor = String(values.background).toLowerCase();
seen = true;
}
var alpha = Number(values.backgroundAlpha);
if (isFinite(alpha) && alpha >= 0.3 && alpha <= 1) {
backgroundAlpha = alpha;
seen = true;
}
if (values.transparent !== undefined) {
windowTransparent = !!values.transparent;
seen = true;
}
var scale = Number(values.scale);
if (isFinite(scale) && scale >= 0.7 && scale <= 2) {
panelScale = scale;
applyScale();
seen = true;
}
if (seen) applyTheme();
return seen;
}
function recordLookChange(before) {
var after = currentLook();
var changed = false;
for (var i = 0; i < LOOK_KEYS.length; i += 1) {
if (!valueEquals(before[LOOK_KEYS[i]], after[LOOK_KEYS[i]])) changed = true;
}
if (!changed) return;
undoStack.push({kind: 'look', at: Date.now(), from: before, to: after});
if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
redoStack = [];
updateHistoryButtons();
}
function dropLookSteps() {
var keep = function (step) { return step.kind !== 'look'; };
undoStack = undoStack.filter(keep);
redoStack = redoStack.filter(keep);
updateHistoryButtons();
}
function stepIsLive(step) {
if (step.kind === 'look') return true;
var mod = findMod(step.linkage);
if (!mod || !values[step.linkage]) return false;
if (step.varName === 'enabled') return 'enabled' in values[step.linkage];
return !!findComponent(mod, step.varName);
}
function replayStep(step, value) {
if (step.kind === 'look') {
closeReview();
applyLook(value);
return;
}
replaying = true;
try {
values[step.linkage][step.varName] = JSON.parse(JSON.stringify(value));
if (!shadow[step.linkage]) shadow[step.linkage] = {};
shadow[step.linkage][step.varName] = JSON.parse(JSON.stringify(value));
var mod = findMod(step.linkage);
var comp = step.varName === 'enabled' ? null : findComponent(mod, step.varName);
if (comp && comp.type === 'HotKey') {
jsonCommand('hotkeyAction', {
linkage: step.linkage, varName: step.varName,
action: 'set', keyset: value || [],
});
}
closeReview();
selectMod(step.linkage);
refreshGates(step.linkage);
updateFooter();
notifyLive(step.linkage);
revealVar(step.linkage, step.varName);
} finally {
replaying = false;
}
}
function undoStep() {
while (undoStack.length) {
var step = undoStack.pop();
if (!stepIsLive(step)) continue;
redoStack.push(step);
replayStep(step, step.from);
updateHistoryButtons();
return;
}
updateHistoryButtons();
}
function redoStep() {
while (redoStack.length) {
var step = redoStack.pop();
if (!stepIsLive(step)) continue;
undoStack.push(step);
replayStep(step, step.to);
updateHistoryButtons();
return;
}
updateHistoryButtons();
}
function historyTooltip(step, value, title) {
if (step.kind === 'look') {
return '{HEADER}' + title + '{/HEADER}{BODY}' +
plainText(loc.windowLook || 'Window look') + '{/BODY}';
}
var mod = findMod(step.linkage);
if (!mod) return '';
var comp = step.varName === 'enabled' ? null : findComponent(mod, step.varName);
var label = comp ? plainText(comp.text || step.varName) : 'Mod enabled';
var now = describeValue(step.linkage, comp, (values[step.linkage] || {})[step.varName], 'new');
var next = describeValue(step.linkage, comp, value, 'new');
if (now.text === next.text) {
var rawNow = (values[step.linkage] || {})[step.varName];
if (typeof rawNow === 'string' && typeof value === 'string' && rawNow !== value) {
var chars = plainText(loc.reviewChars || 'characters');
now = {text: String(rawNow.length) + ' ' + chars};
next = {text: String(value.length) + ' ' + chars};
}
}
return '{HEADER}' + title + '{/HEADER}{BODY}' + modDisplayName(mod) + '<br>' +
label + ':  ' + now.text + '  >  ' + next.text + '{/BODY}';
}
function updateHistoryButtons() {
var undoBtn = document.getElementById('mm-undo');
var redoBtn = document.getElementById('mm-redo');
if (!undoBtn || !redoBtn) return;
var undoTop = undoStack[undoStack.length - 1];
var redoTop = redoStack[redoStack.length - 1];
undoBtn.className = undoTop ? 'mm-hist-btn' : 'mm-hist-btn mm-disabled';
redoBtn.className = redoTop ? 'mm-hist-btn' : 'mm-hist-btn mm-disabled';
}
function historyTooltipText(top, pick, title) {
return function () {
var step = top();
if (!step) return '';
return historyTooltip(step, pick(step), title);
};
}
function onControlEdited(linkage, varName) {
recordChange(linkage, varName);
refreshGates(linkage);
updateFooter();
}
var NEW_FLARE_HOVER_MS = 2500;
function clearNewFlare(linkage, comp, wrap) {
if (!comp || !comp.newFeature || !comp.varName) return;
jsonCommand('markFeatureSeen', {linkage: linkage, varName: comp.varName});
delete comp.newFeature;
if (!wrap) {
var entry = (controls[linkage] || {})[comp.varName];
wrap = entry && entry.node;
}
if (wrap && wrap.className) {
wrap.className = wrap.className.replace(/(^|\s)mm-new(?=\s|$)/g, '');
}
renderList();
}
function dismissFlareOnAttention(linkage, comp, wrap) {
var timer = null;
var stop = function () {
if (timer === null) return;
window.clearTimeout(timer);
timer = null;
};
wrap.addEventListener('mousedown', function () {
stop();
clearNewFlare(linkage, comp, wrap);
}, true);
wrap.addEventListener('mouseenter', function () {
stop();
if (!comp.newFeature) return;
timer = window.setTimeout(function () {
timer = null;
clearNewFlare(linkage, comp, wrap);
}, NEW_FLARE_HOVER_MS);
});
wrap.addEventListener('mouseleave', stop);
}
function onControlChanged(linkage, varName, comp) {
recordChange(linkage, varName);
clearNewFlare(linkage, comp, null);
refreshGates(linkage);
updateFooter();
notifyLive(linkage);
}
function gateNumeric(value) {
if (typeof value === 'boolean') return value ? 1 : 0;
if (typeof value === 'number') return isFinite(value) ? value : null;
if (typeof value === 'string' && value !== '' && isFinite(Number(value))) return Number(value);
return null;
}
function gateEquals(masterValue, expected) {
if (valueEquals(masterValue, expected)) return true;
var a = gateNumeric(masterValue);
var b = gateNumeric(expected);
return a !== null && b !== null && a === b;
}
function gateInList(masterValue, list) {
for (var i = 0; i < list.length; i += 1) {
if (gateEquals(masterValue, list[i])) return true;
}
return false;
}
function compareGate(masterValue, condition, expected) {
switch (condition || '==') {
case '!=':
if (Array.isArray(expected)) return !gateInList(masterValue, expected);
return !gateEquals(masterValue, expected);
case '>': return Number(masterValue) > Number(expected);
case '>=': return Number(masterValue) >= Number(expected);
case '<': return Number(masterValue) < Number(expected);
case '<=': return Number(masterValue) <= Number(expected);
default:
if (Array.isArray(expected)) return gateInList(masterValue, expected);
return gateEquals(masterValue, expected);
}
}
function gateSatisfied(linkage, comp) {
var store = values[linkage] || {};
if (comp.conditions && comp.conditions.length) {
var logic = comp.conditionsLogic === 'OR' ? 'OR' : 'AND';
var hits = 0;
for (var i = 0; i < comp.conditions.length; i += 1) {
var c = comp.conditions[i];
var master = store[c.masterVarName];
var ok = ('masterValue' in c)
? compareGate(master, c.condition, c.masterValue)
: !!master;
if (ok) hits += 1;
}
return logic === 'OR' ? hits > 0 : hits === comp.conditions.length;
}
if (comp.masterVarName !== undefined) {
var masterValue = store[comp.masterVarName];
if ('masterValue' in comp) return compareGate(masterValue, comp.condition, comp.masterValue);
return !!masterValue;
}
return true;
}
function refreshGates(linkage) {
var registry = controls[linkage] || {};
for (var key in registry) {
if (registry.hasOwnProperty(key)) registry[key].refreshGate();
}
var opts = document.getElementById('mm-opts');
if (opts) applyColumnSpans(opts);
}
var tooltipNode = null;
var tooltipBody = null;
var tooltipBar = null;
var tooltipThumb = null;
var tooltipKeyWidth = 0;
var ROWS_RE = /\{ROWS\}([\s\S]*?)\{\/ROWS\}/g;
function measureKeyWidth(text) {
var s = String(text == null ? '' : text);
var widest = 0;
ROWS_RE.lastIndex = 0;
var m = ROWS_RE.exec(s);
while (m) {
var lines = m[1].split(String.fromCharCode(10));
for (var i = 0; i < lines.length; i += 1) {
var cut = lines[i].indexOf('|');
if (cut < 0) continue;
var keyLen = plainText(lines[i].slice(0, cut)).length;
if (keyLen > widest) widest = keyLen;
}
m = ROWS_RE.exec(s);
}
return widest ? (widest * 7 + 6) : 0;
}
function buildRowsTable(host, text, spaced) {
var table = el('div', 'mm-tt-table', host);
if (spaced) table.className += ' mm-tooltip-gap';
var lines = String(text).split(String.fromCharCode(10));
for (var li = 0; li < lines.length; li += 1) {
var rawLine = lines[li];
if (!rawLine.replace(/[ 	]+/g, '')) continue;
var bar = rawLine.indexOf('|');
var row = el('div', 'mm-tt-row', table);
if (bar < 0) {
setLabel(el('div', 'mm-tt-rowhead', row), rawLine);
continue;
}
var keyCell = el('div', 'mm-tt-key', row);
if (tooltipKeyWidth) keyCell.style.width = tooltipKeyWidth + 'rem';
setLabel(keyCell, rawLine.slice(0, bar));
setLabel(el('div', 'mm-tt-val', row), rawLine.slice(bar + 1));
}
}
function renderBlockText(host, text, blockClass) {
var s = String(text == null ? '' : text);
ROWS_RE.lastIndex = 0;
var m = ROWS_RE.exec(s);
if (!m) {
setLabel(el('div', blockClass, host), s);
return;
}
var at = 0;
while (m) {
var before = s.slice(at, m.index);
if (before.replace(/\s+/g, '')) setLabel(el('div', blockClass, host), before);
var kids = host.children;
var prev = kids.length ? kids[kids.length - 1] : null;
var prevWasTable = !!prev &&
String(prev.className || '').indexOf('mm-tt-table') >= 0;
buildRowsTable(host, m[1], kids.length > 0 && !prevWasTable);
at = ROWS_RE.lastIndex;
m = ROWS_RE.exec(s);
}
var after = s.slice(at);
if (after.replace(/\s+/g, '')) setLabel(el('div', blockClass, host), after);
}
function parseTooltip(raw) {
var s = String(raw == null ? '' : raw);
var pattern = /\{(HEADER|BODY|NOTE|ATTENTION)\}([\s\S]*?)\{\/\1\}/g;
var blocks = [];
var last = 0;
var match = pattern.exec(s);
while (match) {
var before = s.slice(last, match.index);
if (before.replace(/\s+/g, '')) blocks.push({kind: 'body', text: before});
blocks.push({kind: match[1].toLowerCase(), text: match[2]});
last = pattern.lastIndex;
match = pattern.exec(s);
}
var tail = s.slice(last);
if (tail.replace(/\s+/g, '')) blocks.push({kind: 'body', text: tail});
if (!blocks.length) blocks.push({kind: 'body', text: s});
return blocks;
}
var tooltipVisible = false;
var tooltipTimer = null;
var lastMouseX = 0;
var lastMouseY = 0;
var TOOLTIP_PIN_HEIGHT = 220;
var tooltipPinned = false;
var currentTooltipContent = null;
var tooltipEstimatedHeight = 0;
var tooltipEstimatedWidth = 0;
var tooltipToken = 0;
var tooltipSizeCache = null;
function tooltipSize() {
if (tooltipSizeCache) return tooltipSizeCache;
var k = getScale() || 1;
var w = (Number(tooltipNode.offsetWidth) || 0) / k;
var h = (Number(tooltipNode.offsetHeight) || 0) / k;
if (!(w > 0 && h > 0)) {
return {
w: tooltipEstimatedWidth || 340,
h: tooltipEstimatedHeight || 120,
};
}
tooltipSizeCache = {w: w, h: h};
return tooltipSizeCache;
}
var TOOLTIP_WHEEL_STEP = 46;
var TOOLTIP_SCROLL_SLACK = 3;
function tooltipScrollSpan() {
if (!tooltipVisible || !tooltipBody) return 0;
var span = (Number(tooltipBody.scrollHeight) || 0) - (Number(tooltipBody.clientHeight) || 0);
return span > TOOLTIP_SCROLL_SLACK ? span : 0;
}
function syncTooltipBar() {
if (!tooltipBar || !tooltipThumb) return;
var span = tooltipScrollSpan();
if (!span) {
tooltipThumb.style.height = '0px';
tooltipBar.className = 'mm-vscroll mm-tt-bar';
return;
}
tooltipBar.className = 'mm-vscroll mm-tt-bar mm-vscroll-live';
var view = Number(tooltipBody.clientHeight) || 0;
var total = Number(tooltipBody.scrollHeight) || 0;
var barH = Number(tooltipBar.clientHeight) || 0;
if (!barH || !total) return;
var thumbH = Math.max(18, Math.round(barH * view / total));
var ratio = (Number(tooltipBody.scrollTop) || 0) / span;
tooltipThumb.style.height = thumbH + 'px';
tooltipThumb.style.marginTop = Math.round((barH - thumbH) * ratio) + 'px';
}
function tooltipWheel(event) {
var span = tooltipScrollSpan();
if (!span) return false;
var delta = Number(event.deltaY);
if (!delta) delta = -Number(event.wheelDelta || 0);
var next = (Number(tooltipBody.scrollTop) || 0)
+ (delta > 0 ? -TOOLTIP_WHEEL_STEP : TOOLTIP_WHEEL_STEP);
if (next < 0) next = 0;
if (next > span) next = span;
tooltipBody.scrollTop = Math.round(next);
syncTooltipBar();
event.preventDefault();
event.stopPropagation();
return true;
}
function positionTooltip(force) {
if (tooltipPinned && !force) return;
if (force) tooltipSizeCache = null;
var size = tooltipSize();
var width = size.w;
var height = size.h;
if (height > TOOLTIP_PIN_HEIGHT) tooltipPinned = true;
var point = clientToRoot(lastMouseX, lastMouseY);
var x = point.x + 16;
var y = point.y + 20;
if (x + width > surfaceW - 8) x = point.x - width - 12;
if (y + height > surfaceH - 8) y = point.y - height - 12;
if (x < 0) x = 0;
if (y + height > surfaceH - 8) y = Math.max(8, surfaceH - 8 - height);
if (y < 8) y = 8;
tooltipNode.style.left = Math.round(x) + 'rem';
tooltipNode.style.top = Math.round(y) + 'rem';
}
var tooltipAnchorBox = null;
var tooltipAnchorNode = null;
var TOOLTIP_ANCHOR_PAD = 4;
function noteTooltipAnchor(node) {
tooltipAnchorNode = node;
tooltipAnchorBox = null;
try {
var rect = node.getBoundingClientRect();
if (rect && (rect.width || rect.height)) {
tooltipAnchorBox = {
left: rect.left, top: rect.top,
right: rect.left + rect.width, bottom: rect.top + rect.height,
};
}
} catch (error) {}
}
function pointerOffTooltipAnchor() {
if (!tooltipAnchorBox && tooltipAnchorNode) noteTooltipAnchor(tooltipAnchorNode);
var box = tooltipAnchorBox;
if (!box) return false;
return lastMouseX < box.left - TOOLTIP_ANCHOR_PAD ||
lastMouseX > box.right + TOOLTIP_ANCHOR_PAD ||
lastMouseY < box.top - TOOLTIP_ANCHOR_PAD ||
lastMouseY > box.bottom + TOOLTIP_ANCHOR_PAD;
}
var pointerFrameQueued = false;
function schedulePointerFrame() {
if (pointerFrameQueued) return;
pointerFrameQueued = true;
window.requestAnimationFrame(function () {
pointerFrameQueued = false;
if (tooltipVisible) positionTooltip();
if (scrollHover) {
var here = clientToRoot(lastMouseX, lastMouseY);
scrollHover(here.x, here.y);
}
});
}
function leaveTooltipAnchor() {
hideTooltip();
}
var TOOLTIP_DELAY = 600;
var TOOLTIP_HIDE_DELAY = 120;
var tooltipHideTimer = null;
function showTooltipContent(tooltip) {
currentTooltipContent = String(tooltip);
tooltipSizeCache = null;
var parsed = parseTooltip(tooltip);
tooltipKeyWidth = measureKeyWidth(tooltip);
clearNode(tooltipBody);
for (var bi = 0; bi < parsed.length; bi += 1) {
var kind = parsed[bi].kind;
if (!String(parsed[bi].text || '').replace(/\s+/g, '')) continue;
if (kind === 'attention') {
var band = el('div', 'mm-tooltip-attention', tooltipBody);
var mark = el('div', 'mm-tt-warn', band);
el('div', 'mm-tt-warn-tri', mark);
el('div', 'mm-tt-warn-bang', mark).textContent = '!';
setLabel(el('div', 'mm-tt-warn-text', band), parsed[bi].text);
continue;
}
var blockClass = 'mm-tooltip-body';
if (kind === 'header') blockClass = 'mm-tooltip-header';
else if (kind === 'note') blockClass = 'mm-tooltip-note';
if (kind === 'header' && tooltipBody.children.length) blockClass += ' mm-tooltip-gap';
renderBlockText(tooltipBody, parsed[bi].text, blockClass);
}
var text = String(tooltip);
var images = (text.match(/<img/gi) || []).length;
var hasTable = text.indexOf('{ROWS}') >= 0;
var wide = images > 0 || hasTable;
tooltipNode.className = wide
? 'mm-tooltip mm-tooltip-wide mm-visible' : 'mm-tooltip mm-visible';
var chrome = wide ? 26 : 20;
tooltipBody.style.maxHeight = Math.max(120, Math.round(surfaceH - 16 - chrome)) + 'rem';
tooltipBody.scrollTop = 0;
var plain = text.replace(/<[^>]*>/g, ' ').replace(/\{\/?[A-Z]+\}/g, ' ');
var longest = 0;
var pieces = plain.split(String.fromCharCode(10));
for (var pi = 0; pi < pieces.length; pi += 1) {
longest = Math.max(longest, pieces[pi].length);
}
tooltipEstimatedWidth = wide ? 620 : Math.max(120, Math.min(340, longest * 7 + 26));
var perLine = wide ? 100 : Math.max(20, Math.floor(tooltipEstimatedWidth / 7));
tooltipEstimatedHeight = images
? 90 + Math.ceil(images / 5) * 56 + Math.ceil(text.length / 400) * 20
: 34 + Math.ceil(text.length / perLine) * 19;
tooltipNode.className += ' mm-measuring';
tooltipVisible = true;
tooltipPinned = false;
var token = ++tooltipToken;
window.requestAnimationFrame(function () {
window.requestAnimationFrame(function () {
if (!tooltipVisible || token !== tooltipToken) return;
syncTooltipBar();
positionTooltip(true);
tooltipNode.className = tooltipNode.className.replace(' mm-measuring', '');
window.requestAnimationFrame(function () {
if (!tooltipVisible || token !== tooltipToken) return;
syncTooltipBar();
positionTooltip(true);
});
});
});
}
function isNodeGated(node) {
var current = node;
while (current && current !== root) {
if (current.getAttribute && current.getAttribute('data-gated') === '1') return true;
current = current.parentNode;
}
return false;
}
function attachTooltip(node, tooltip) {
if (!tooltip) return;
var resolve = typeof tooltip === 'function' ? tooltip : function () { return tooltip; };
node.addEventListener('mouseenter', function (event) {
if (isNodeGated(node)) return;
tooltip = resolve();
if (!tooltip) return;
if (event && event.clientX !== undefined) {
lastMouseX = Number(event.clientX) || lastMouseX;
lastMouseY = Number(event.clientY) || lastMouseY;
}
noteTooltipAnchor(node);
if (pointerOffTooltipAnchor()) return;
if (tooltipHideTimer) {
window.clearTimeout(tooltipHideTimer);
tooltipHideTimer = null;
}
if (tooltipTimer) window.clearTimeout(tooltipTimer);
if (tooltipVisible) {
if (currentTooltipContent === String(tooltip)) {
return;
}
hideTooltip();
}
tooltipTimer = window.setTimeout(function () {
tooltipTimer = null;
if (pointerOffTooltipAnchor()) return;
showTooltipContent(tooltip);
}, TOOLTIP_DELAY);
});
node.addEventListener('mouseleave', function () {
if (tooltipTimer) {
window.clearTimeout(tooltipTimer);
tooltipTimer = null;
}
if (tooltipHideTimer) window.clearTimeout(tooltipHideTimer);
if (pointerOffTooltipAnchor()) {
hideTooltip();
return;
}
tooltipHideTimer = window.setTimeout(hideTooltip, TOOLTIP_HIDE_DELAY);
});
}
function hideTooltip() {
tooltipToken += 1;
if (tooltipTimer) {
window.clearTimeout(tooltipTimer);
tooltipTimer = null;
}
if (tooltipHideTimer) {
window.clearTimeout(tooltipHideTimer);
tooltipHideTimer = null;
}
tooltipVisible = false;
tooltipSizeCache = null;
currentTooltipContent = null;
tooltipNode.className = 'mm-tooltip';
if (tooltipBody) tooltipBody.scrollTop = 0;
if (tooltipBar) tooltipBar.className = 'mm-vscroll mm-tt-bar';
}
function bindHoldRepeat(node, action) {
var startTimer = null;
var repeatTimer = null;
var stop = function () {
if (startTimer) { window.clearTimeout(startTimer); startTimer = null; }
if (repeatTimer) { window.clearInterval(repeatTimer); repeatTimer = null; }
};
node.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
action();
stop();
startTimer = window.setTimeout(function () {
repeatTimer = window.setInterval(action, 60);
}, 400);
});
node.addEventListener('mouseup', stop);
node.addEventListener('mouseleave', stop);
document.addEventListener('mouseup', stop);
}
var ctxNode = null;
var ctxOwner = null;
function zoomFloating(node) {
if (!node) return;
var zoom = 1;
try {
zoom = panelBox().zoom || 1;
} catch (error) {
zoom = 1;
}
if (zoom === 1) {
node.style.transform = 'none';
return;
}
node.style.transformOrigin = '0 0';
node.style.transform = 'scale(' + zoom + ')';
node.style.visibility = 'hidden';
afterTwoFrames(function () {
if (!node.parentNode) return;
node.style.visibility = '';
var k = getScale() || 1;
var w = ((Number(node.offsetWidth) || 0) / k) * zoom;
var h = ((Number(node.offsetHeight) || 0) / k) * zoom;
var left = parseFloat(node.style.left) || 0;
var top = parseFloat(node.style.top) || 0;
if (left + w > surfaceW - 8) left = surfaceW - 8 - w;
if (top + h > surfaceH - 8) top = surfaceH - 8 - h;
node.style.left = Math.round(Math.max(8, left)) + 'rem';
node.style.top = Math.round(Math.max(8, top)) + 'rem';
});
}
function closeContextMenu() {
if (ctxNode && ctxNode.parentNode) ctxNode.parentNode.removeChild(ctxNode);
ctxNode = null;
ctxOwner = null;
}
function showContextMenu(x, y, items, opts) {
closeContextMenu();
closeOpenDropdown();
hideTooltip();
opts = opts || {};
ctxNode = el('div', opts.help ? 'mm-ctx mm-ctx-help' : 'mm-ctx', root);
zoomFloating(ctxNode);
ctxOwner = opts.owner || null;
for (var i = 0; i < items.length; i += 1) {
(function (item) {
if (item.rule) { el('div', 'mm-ctx-rule', ctxNode); return; }
var cls = 'mm-ctx-item';
if (item.enabled === false) cls += ' mm-ctx-disabled';
if (item.selected) cls += ' mm-ctx-sel';
var node = el('div', cls, ctxNode);
if (item.code !== undefined && item.code !== null) {
var code = el('div', 'mm-ctx-code', node);
code.textContent = item.code;
var text = el('div', 'mm-ctx-text', node);
text.textContent = item.label;
} else {
node.textContent = item.label;
}
node.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0 || item.enabled === false) return;
closeContextMenu();
item.onClick();
});
}(items[i]));
}
var point = opts.rootSpace ? {x: x, y: y} : clientToRoot(x, y);
var width = opts.width || 170;
var height = 10;
for (var h = 0; h < items.length; h += 1) {
height += items[h].rule ? 13 : 30;
}
x = point.x;
y = point.y;
if (x + width > surfaceW - 8) x = surfaceW - 8 - width;
if (y + height > surfaceH - 8) y = y - height;
if (x < 0) x = 0;
if (y < 0) y = 0;
ctxNode.style.left = Math.round(x) + 'rem';
ctxNode.style.top = Math.round(y) + 'rem';
}
function onRightClick(node, handler) {
var lastFired = 0;
var fire = function (event) {
event.preventDefault();
event.stopPropagation();
var now = Date.now();
if (now - lastFired < 250) return;
lastFired = now;
handler(event);
};
node.addEventListener('mousedown', function (event) {
if (event.button === 2) fire(event);
});
node.addEventListener('contextmenu', fire);
}
function hsvToRgb(h, s, v) {
var c = v * s;
var hp = (h % 360) / 60;
var xx = c * (1 - Math.abs(hp % 2 - 1));
var r = 0, g = 0, b = 0;
if (hp < 1) { r = c; g = xx; }
else if (hp < 2) { r = xx; g = c; }
else if (hp < 3) { g = c; b = xx; }
else if (hp < 4) { g = xx; b = c; }
else if (hp < 5) { r = xx; b = c; }
else { r = c; b = xx; }
var m = v - c;
return {
r: Math.round((r + m) * 255),
g: Math.round((g + m) * 255),
b: Math.round((b + m) * 255),
};
}
function rgbToHsv(r, g, b) {
r /= 255; g /= 255; b /= 255;
var max = Math.max(r, g, b);
var min = Math.min(r, g, b);
var d = max - min;
var h = 0;
if (d > 0) {
if (max === r) h = 60 * (((g - b) / d) % 6);
else if (max === g) h = 60 * ((b - r) / d + 2);
else h = 60 * ((r - g) / d + 4);
}
if (h < 0) h += 360;
return {h: h, s: max === 0 ? 0 : d / max, v: max};
}
function rgbToHex(r, g, b) {
var to2 = function (n) {
var s = Math.max(0, Math.min(255, n)).toString(16);
return s.length < 2 ? '0' + s : s;
};
return to2(r) + to2(g) + to2(b);
}
function hexToRgb(value) {
var s = String(value == null ? '' : value).trim().replace('#', '');
if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
return {
r: parseInt(s.slice(0, 2), 16),
g: parseInt(s.slice(2, 4), 16),
b: parseInt(s.slice(4, 6), 16),
};
}
var picker = null;
var userPresets = [];
function closeColorPicker(revert) {
if (!picker) return;
endPaletteEdit();
var closing = picker;
if (picker.node.parentNode) picker.node.parentNode.removeChild(picker.node);
picker = null;
if (revert && closing.applied && closing.onApply && closing.initialBare) {
closing.onApply(closing.initialBare);
}
}
var PICKER_SV_W = 250;
var PICKER_SV_H = 230;
var PICKER_HUE_W = 246;
var PICKER_RGB_W = 164;
function pickerHex() {
var rgb = hsvToRgb(picker.h, picker.s, picker.v);
var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
if (picker.withAlpha) {
var a = Math.max(0, Math.min(255, Math.round(picker.a)));
var text = a.toString(16);
hex += text.length < 2 ? '0' + text : text;
}
return hex;
}
function pickerSetHex(hex) {
var bare = String(hex == null ? '' : hex).trim().replace('#', '');
if (picker && picker.withAlpha && /^[0-9a-fA-F]{8}$/.test(bare)) {
picker.a = parseInt(bare.slice(6, 8), 16);
hex = bare.slice(0, 6);
}
var rgb = hexToRgb(hex);
if (!rgb) return;
var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
picker.h = hsv.h; picker.s = hsv.s; picker.v = hsv.v;
pickerUpdate();
}
function pickerUpdate() {
var pure = hsvToRgb(picker.h, 1, 1);
if (picker.svNode) {
picker.svNode.style.background = '#' + rgbToHex(pure.r, pure.g, pure.b);
var svW = PICKER_SV_W, svH = PICKER_SV_H;
picker.svKnob.style.left = Math.round(picker.s * svW - 6) + 'rem';
picker.svKnob.style.top = Math.round((1 - picker.v) * svH - 6) + 'rem';
picker.hueKnob.style.left = Math.round(picker.h / 360 * PICKER_HUE_W - 6) + 'rem';
picker.hexInput.value = '#' + pickerHex();
}
var hex = pickerHex();
picker.prevNew.style.background = '#' + hex;
if (picker.rgbRows) {
for (var ri = 0; ri < picker.rgbRows.length; ri += 1) picker.rgbRows[ri]();
}
hex = hex.toLowerCase();
if (picker.lastLiveHex !== hex) {
picker.lastLiveHex = hex;
if (picker.editSlot >= 0) {
picker.editTouched = true;
picker.repaintPalette();
}
}
}
function openColorPicker(opts) {
closeColorPicker();
closeContextMenu();
var overlay = el('div', 'mm-overlay', root);
overlay.style.width = surfaceW + 'rem';
overlay.style.height = surfaceH + 'rem';
overlay.addEventListener('mousedown', function (event) {
if (ctxNode) {
closeContextMenu();
event.stopPropagation();
return;
}
if (event.target === overlay) closeColorPicker(true);
event.stopPropagation();
});
var box = el('div', 'mm-picker', overlay);
var title = el('div', 'mm-picker-title', box);
title.textContent = opts.title || plainText(loc.popupColor || 'COLOR');
picker = {
node: overlay, h: 0, s: 0, v: 1, onApply: opts.onApply, lastLiveHex: null,
editSlot: -1, editTouched: false, applied: false,
withAlpha: !!opts.alpha, a: 255,
repaintPalette: function () {},
};
var initialBareValue = String(opts.initial == null ? '' : opts.initial).replace('#', '');
if (picker.withAlpha && /^[0-9a-fA-F]{8}$/.test(initialBareValue)) {
picker.a = parseInt(initialBareValue.slice(6, 8), 16);
opts.initial = initialBareValue.slice(0, 6);
}
var initialRgb = hexToRgb(opts.initial);
if (initialRgb) {
var hsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);
picker.h = hsv.h; picker.s = hsv.s; picker.v = hsv.v;
}
var initialHex = initialRgb
? rgbToHex(initialRgb.r, initialRgb.g, initialRgb.b) : 'ffffff';
picker.initialBare = initialHex.toLowerCase();
picker.lastLiveHex = picker.initialBare;
var main = el('div', 'mm-picker-main', box);
var prevOld = null;
if (!opts.presetsOnly) {
var sv = el('div', 'mm-sv', main);
picker.svNode = sv;
el('div', 'mm-sv-white', sv);
el('div', 'mm-sv-black', sv);
picker.svKnob = el('div', 'mm-sv-knob', sv);
var side = el('div', 'mm-picker-side', main);
var hue = el('div', 'mm-hue', side);
picker.hueKnob = el('div', 'mm-hue-knob', hue);
var preview = el('div', 'mm-picker-preview', side);
prevOld = el('div', 'mm-prev-box mm-prev-old', preview);
prevOld.style.background = '#' + initialHex;
picker.prevNew = el('div', 'mm-prev-box mm-prev-new', preview);
var hexRow = el('div', 'mm-picker-hexrow', side);
var hexLabel = el('div', 'mm-picker-hexlabel', hexRow);
hexLabel.textContent = 'HEX';
picker.hexInput = el('input', 'mm-picker-hex', hexRow);
picker.hexInput.type = 'text';
picker.hexInput.addEventListener('change', function () {
pickerSetHex(picker.hexInput.value);
});
var rgbBlock = el('div', 'mm-picker-rgb', side);
picker.rgbRows = [];
var channels = [
{name: 'R', index: 0},
{name: 'G', index: 1},
{name: 'B', index: 2},
];
if (picker.withAlpha) channels.push({name: 'A', index: 3});
for (var ci = 0; ci < channels.length; ci += 1) {
(function (channel) {
var row = el('div', 'mm-rgb-row', rgbBlock);
var label = el('div', 'mm-rgb-label', row);
label.textContent = channel.name;
var track = el('div', 'mm-rgb-track', row);
el('div', 'mm-slider-rail', track);
var fill = el('div', 'mm-slider-fill', track);
var knob = el('div', 'mm-slider-knob', track);
var valueNode = el('input', 'mm-rgb-value', row);
valueNode.type = 'text';
var channelValue = function () {
if (channel.index === 3) return Math.round(picker.a);
var rgb = hsvToRgb(picker.h, picker.s, picker.v);
return [rgb.r, rgb.g, rgb.b][channel.index];
};
var refresh = function () {
var value = channelValue();
var ratio = value / 255;
fill.style.width = Math.round(ratio * PICKER_RGB_W) + 'rem';
knob.style.left = Math.round(ratio * PICKER_RGB_W - 7) + 'rem';
var text = String(value);
if (valueNode.value !== text) valueNode.value = text;
};
var setChannel = function (value) {
if (channel.index === 3) {
picker.a = Math.max(0, Math.min(255, Math.round(value)));
pickerUpdate();
return;
}
var rgb = hsvToRgb(picker.h, picker.s, picker.v);
var parts = [rgb.r, rgb.g, rgb.b];
parts[channel.index] = Math.max(0, Math.min(255, Math.round(value)));
var hsvNow = rgbToHsv(parts[0], parts[1], parts[2]);
picker.h = hsvNow.h;
picker.s = hsvNow.s;
picker.v = hsvNow.v;
pickerUpdate();
};
valueNode.addEventListener('input', function () {
var cleaned = String(valueNode.value).replace(/[^0-9]/g, '');
if (cleaned !== valueNode.value) valueNode.value = cleaned;
});
var commitTyped = function () {
var typed = parseInt(valueNode.value, 10);
if (isFinite(typed)) setChannel(typed);
else refresh();
};
valueNode.addEventListener('change', commitTyped);
valueNode.addEventListener('blur', commitTyped);
valueNode.addEventListener('keydown', function (event) {
if (event.keyCode === 13) {
commitTyped();
try { valueNode.blur(); } catch (e) {}
}
});
var setFrom = function (event) {
var rect = rootRelativeRect(track);
var point = pointerIn(event);
var ratio = Math.max(0, Math.min(1,
(point.x - rect.left) / (rect.width || 164)));
if (channel.index === 3) {
picker.a = Math.round(ratio * 255);
pickerUpdate();
return;
}
var rgb = hsvToRgb(picker.h, picker.s, picker.v);
var parts = [rgb.r, rgb.g, rgb.b];
parts[channel.index] = Math.round(ratio * 255);
var hsvNow = rgbToHsv(parts[0], parts[1], parts[2]);
picker.h = hsvNow.h;
picker.s = hsvNow.s;
picker.v = hsvNow.v;
pickerUpdate();
};
var dragging = false;
track.addEventListener('mousedown', function (event) {
if (event.button !== 0 || ctxNode) return;
dragging = true;
setFrom(event);
});
document.addEventListener('mousemove', function (event) {
if (picker && dragging) setFrom(event);
});
document.addEventListener('mouseup', function () { dragging = false; });
picker.rgbRows.push(refresh);
refresh();
}(channels[ci]));
}
var applyRow = el('div', 'mm-picker-applyrow', box);
var applyBtn = el('button', 'mm-button mm-button-secondary mm-picker-apply', applyRow);
applyBtn.type = 'button';
applyBtn.textContent = plainText(loc.buttonApply || 'Apply');
applyBtn.addEventListener('click', function () {
if (!picker) return;
commitPaletteEdit();
picker.repaintPalette();
var hex = pickerHex().toLowerCase();
picker.initialBare = hex;
picker.applied = true;
picker.onApply(hex);
if (prevOld) prevOld.style.background = '#' + hex;
});
var svDrag = false, hueDrag = false;
var previewAt = function (h, s, v) {
var rgb = hsvToRgb(h, s, v);
picker.prevNew.style.background = '#' + rgbToHex(rgb.r, rgb.g, rgb.b);
};
var restorePreview = function () {
if (!picker) return;
picker.prevNew.style.background = '#' + pickerHex();
};
var svFrom = function (event) {
var rect = rootRelativeRect(sv);
var point = pointerIn(event);
picker.s = Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 250)));
picker.v = 1 - Math.max(0, Math.min(1, (point.y - rect.top) / (rect.height || 230)));
pickerUpdate();
};
var hueFrom = function (event) {
var rect = rootRelativeRect(hue);
var point = pointerIn(event);
picker.h = 360 * Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 246)));
pickerUpdate();
};
sv.addEventListener('mousemove', function (event) {
if (!picker || svDrag || hueDrag) return;
var rect = rootRelativeRect(sv);
var point = pointerIn(event);
var s = Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 250)));
var v = 1 - Math.max(0, Math.min(1, (point.y - rect.top) / (rect.height || 230)));
previewAt(picker.h, s, v);
});
sv.addEventListener('mouseleave', restorePreview);
hue.addEventListener('mousemove', function (event) {
if (!picker || svDrag || hueDrag) return;
var rect = rootRelativeRect(hue);
var point = pointerIn(event);
var h = 360 * Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 246)));
previewAt(h, picker.s, picker.v);
});
hue.addEventListener('mouseleave', restorePreview);
sv.addEventListener('mousedown', function (event) {
if (event.button !== 0 || ctxNode) return;
svDrag = true;
svFrom(event);
});
hue.addEventListener('mousedown', function (event) {
if (event.button !== 0 || ctxNode) return;
hueDrag = true;
hueFrom(event);
});
document.addEventListener('mousemove', function (event) {
if (!picker) return;
if (svDrag) svFrom(event);
if (hueDrag) hueFrom(event);
});
document.addEventListener('mouseup', function () { svDrag = false; hueDrag = false; });
prevOld.addEventListener('mousedown', function () { pickerSetHex(initialHex); });
} else {
var onlySide = el('div', 'mm-picker-side', main);
picker.prevNew = el('div', 'mm-prev-box mm-prev-new', onlySide);
}
if (opts.presets && opts.presets.length) {
renderModPresets(box, opts.presets);
} else if (!opts.presetsOnly) {
renderUserPalette(box);
}
var buttons = el('div', 'mm-picker-buttons', box);
el('div', 'mm-footer-spacer', buttons);
var cancelBtn = el('button', 'mm-button mm-button-ghost', buttons);
cancelBtn.type = 'button';
cancelBtn.textContent = plainText(loc.buttonCancel || 'Cancel');
cancelBtn.addEventListener('click', function () { closeColorPicker(true); });
var okBtn = el('button', 'mm-button mm-button-primary', buttons);
okBtn.type = 'button';
okBtn.textContent = plainText(loc.buttonOK || 'OK');
okBtn.addEventListener('click', function () {
var hex = pickerHex().toLowerCase();
var apply = picker.onApply;
closeColorPicker(false);
apply(hex);
});
pickerUpdate();
}
function bindHoverPreview(slot, getBare) {
slot.addEventListener('mouseenter', function () {
if (!picker) return;
var bare = getBare();
if (bare) picker.prevNew.style.background = '#' + bare;
});
slot.addEventListener('mouseleave', function () {
if (!picker) return;
picker.prevNew.style.background = '#' + pickerHex();
});
}
function renderModPresets(box, presets) {
var grid = el('div', 'mm-palette', box);
var current = pickerHex().toLowerCase();
for (var i = 0; i < presets.length && i < 24; i += 1) {
(function (hex) {
var bare = String(hex || '').replace('#', '').toLowerCase();
var slot = el('div', 'mm-pal-slot', grid);
if (bare) slot.style.background = '#' + bare;
if (bare === current) slot.className += ' mm-pal-sel';
slot.addEventListener('mousedown', function (event) {
if (event.button !== 0 || !bare || ctxNode) return;
if (picker.svNode) pickerSetHex(bare);
else { picker.h = 0; pickerSetByBare(bare); }
});
bindHoverPreview(slot, function () { return bare; });
}(presets[i]));
}
}
function pickerSetByBare(bare) {
var rgb = hexToRgb(bare);
if (!rgb) return;
var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
picker.h = hsv.h; picker.s = hsv.s; picker.v = hsv.v;
pickerUpdate();
}
var PALETTE_COLUMNS = 12;
function visiblePaletteSlots() {
var lastFilled = -1;
for (var i = 0; i < userPresets.length; i += 1) {
if (userPresets[i]) lastFilled = i;
}
var rows = Math.max(1, Math.ceil((lastFilled + 1) / PALETTE_COLUMNS));
var start = (rows - 1) * PALETTE_COLUMNS;
var full = true;
for (var s = start; s < start + PALETTE_COLUMNS; s += 1) {
if (!userPresets[s]) { full = false; break; }
}
if (full && rows < 4) rows += 1;
return rows * PALETTE_COLUMNS;
}
function renderUserPalette(box) {
var grid = el('div', 'mm-palette', box);
var rebuild = function () {
clearNode(grid);
var slots = visiblePaletteSlots();
for (var i = 0; i < slots; i += 1) {
(function (index) {
var value = userPresets[index] || null;
var editing = !!picker && picker.editSlot === index;
var cls = 'mm-pal-slot';
if (editing) cls += ' mm-pal-edit';
else if (value && picker && value === pickerHex().toLowerCase()) {
cls += ' mm-pal-sel';
}
var slot = el('div', cls, grid);
if (value) slot.style.background = '#' + value;
bindHoverPreview(slot, function () { return value; });
slot.addEventListener('mousedown', function (event) {
if (event.button !== 0 || ctxNode || !picker) return;
if (!value) {
endPaletteEdit();
picker.editSlot = index;
picker.editTouched = false;
rebuild();
return;
}
if (picker.editSlot === index) return;
endPaletteEdit();
pickerSetHex(value);
rebuild();
});
onRightClick(slot, function (event) {
if (!value || !picker) return;
showContextMenu(event.clientX, event.clientY, [
{label: plainText(loc.presetEdit || 'Edit preset'), onClick: function () {
if (!picker) return;
endPaletteEdit();
picker.editSlot = index;
picker.editTouched = false;
rebuild();
}},
{label: plainText(loc.presetCopyHex || 'Copy hex code'), onClick: function () {
jsonCommand('colorAction', {action: 'copyhex', value: value});
}},
{label: plainText(loc.presetClear || 'Clear preset'), onClick: function () {
userPresets[index] = null;
if (picker && picker.editSlot === index) picker.editSlot = -1;
jsonCommand('saveUserColorPresets', userPresets);
rebuild();
}},
]);
});
}(i));
}
};
picker.repaintPalette = rebuild;
rebuild();
}
function endPaletteEdit() {
if (!picker) return;
picker.editSlot = -1;
picker.editTouched = false;
}
function commitPaletteEdit() {
if (!picker || picker.editSlot < 0) return;
var slot = picker.editSlot;
picker.editSlot = -1;
picker.editTouched = false;
userPresets[slot] = pickerHex().toLowerCase();
jsonCommand('saveUserColorPresets', userPresets);
}
var PICKER_MIN_W = 260;
var PICKER_MAX_W = 520;
function sizePickerWidth(box, list, scale) {
var names = list.getElementsByClassName('mm-picker-name');
var items = list.getElementsByClassName('mm-picker-item');
if (!items.length) return;
var saved = [];
var i;
for (i = 0; i < names.length; i += 1) {
saved.push([names[i].style.flexGrow, names[i].style.flexShrink]);
names[i].style.flexGrow = '0';
names[i].style.flexShrink = '0';
}
var FRAME = 50 + 14 + 32;
var ALERT = 26;
var widest = 0;
for (i = 0; i < items.length; i += 1) {
var textW = (Number((names[i] || {}).offsetWidth) || 0) / scale;
var rowW = FRAME + textW;
if (items[i].getElementsByClassName('mm-picker-alert').length) rowW += ALERT;
if (rowW > widest) widest = rowW;
}
for (i = 0; i < names.length; i += 1) {
names[i].style.flexGrow = saved[i][0] || '';
names[i].style.flexShrink = saved[i][1] || '';
}
if (widest <= FRAME) return;
var wanted = Math.max(PICKER_MIN_W, Math.min(PICKER_MAX_W, Math.ceil(widest) + 8));
box.style.width = wanted + 'rem';
centerPickerOnButton(box, wanted);
}
function armRamp(deg) {
var rgb = hexToRgb(accentColor);
if (!rgb) return '';
return 'linear-gradient(' + deg + 'deg, rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b +
',0) 0%, #' + mixWithBackdrop(accentColor, 0.26) + ' 18%, #' +
mixWithBackdrop(accentColor, 0.5) + ' 100%)';
}
function centerPickerOnButton(box, width) {
var anchor = Number(payload.pickerAnchorX) || 0;
if (!(anchor > 0) || !(width > 0)) return;
var left = Math.round(anchor - width / 2);
if (left + width > surfaceW - 8) left = surfaceW - 8 - width;
if (left < 8) left = 8;
box.style.left = left + 'rem';
box.style.right = 'auto';
var tail = root.getElementsByClassName('mm-picker-tail')[0];
if (!tail) return;
var TAIL_HALF = 43;
var atX = Math.round(anchor - TAIL_HALF);
if (atX < left + 10) atX = left + 10;
if (atX > left + width - 10 - TAIL_HALF * 2) atX = left + width - 10 - TAIL_HALF * 2;
tail.style.left = atX + 'rem';
tail.style.display = 'block';
}
var MARK_GRID = 48;
var MARK_PARTS = [
{x: 2, y: 2, w: 44, h: 44, r: 11, cls: 'mm-mark-tile'},
{x: 21, y: 11, w: 6, h: 26, r: 3, cls: 'mm-mark-bar'},
{x: 11, y: 21, w: 26, h: 6, r: 3, cls: 'mm-mark-bar'},
{x: 18.4, y: 18.4, w: 11.2, h: 11.2, r: 5.6, cls: 'mm-mark-lens'},
{x: 21.4, y: 21.4, w: 5.2, h: 5.2, r: 2.6, cls: 'mm-mark-dot'},
{x: 12, y: 12, w: 4, h: 4, r: 2, cls: 'mm-mark-dot'},
{x: 32, y: 12, w: 4, h: 4, r: 2, cls: 'mm-mark-dot'},
{x: 12, y: 32, w: 4, h: 4, r: 2, cls: 'mm-mark-dot'},
{x: 32, y: 32, w: 4, h: 4, r: 2, cls: 'mm-mark-dot'}
];
var OWN_ICON = /aslainMenu\/icon(_\d+)?\.png$/i;
function drawIconPlaceholder(host, size) {
clearNode(host);
var dot = el('div', 'mm-icon-fallback', host);
dot.style.width = Math.round(size * 0.34) + 'rem';
dot.style.height = Math.round(size * 0.34) + 'rem';
dot.style.left = Math.round(size * 0.33) + 'rem';
dot.style.top = Math.round(size * 0.33) + 'rem';
}
function drawBrandMark(host, size) {
var unit = size / MARK_GRID;
clearNode(host);
for (var i = 0; i < MARK_PARTS.length; i += 1) {
var part = MARK_PARTS[i];
var node = el('div', part.cls, host);
node.style.left = (part.x * unit) + 'rem';
node.style.top = (part.y * unit) + 'rem';
node.style.width = (part.w * unit) + 'rem';
node.style.height = (part.h * unit) + 'rem';
node.style.borderRadius = (part.r * unit) + 'rem';
if (part.cls === 'mm-mark-tile') node.style.borderWidth = (1.2 * unit) + 'rem';
}
}
function renderPicker() {
var windowEl = document.getElementById('mm-window');
if (windowEl) windowEl.style.display = 'none';
var box = el('div', 'mm-picker-box', root);
zoomFloating(box);
var pickerBottom = Number(payload.pickerBottom) || 60;
box.style.bottom = pickerBottom + 'rem';
var tail = el('div', 'mm-picker-tail', root);
el('div', 'mm-picker-tail-fill', tail);
el('div', 'mm-picker-tail-mouth', tail);
var arms = el('div', 'mm-picker-tail-arms', tail);
var halfLeft = el('div', 'mm-picker-tail-half mm-picker-tail-half-left', arms);
var halfRight = el('div', 'mm-picker-tail-half mm-picker-tail-half-right', arms);
var armLeft = el('div', 'mm-picker-tail-arm mm-picker-tail-arm-left', halfLeft);
var armRight = el('div', 'mm-picker-tail-arm mm-picker-tail-arm-right', halfRight);
var ramp = armRamp(90);
var rampMirror = armRamp(270);
if (ramp) {
armLeft.style.background = ramp;
armRight.style.background = rampMirror;
}
tail.style.bottom = (pickerBottom - 32) + 'rem';
tail.style.display = 'none';
var head = el('div', 'mm-picker-head', box);
head.textContent = plainText(loc.entriesPick || 'Mod settings');
var list = el('div', 'mm-picker-list', box);
if (!windowEntries.length) {
var none = el('div', 'mm-picker-none', list);
none.textContent = plainText(loc.entriesNone || 'No mod is using this menu yet');
}
var ordered = windowEntries.slice().sort(function (a, b) {
return (a.own ? 1 : 0) - (b.own ? 1 : 0);
});
for (var i = 0; i < ordered.length; i += 1) {
(function (entry, index) {
if (index > 0 && entry.own && !ordered[index - 1].own) {
el('div', 'mm-picker-rule', list);
}
var item = el('div', 'mm-picker-item', list);
if (entry.enabled === false) item.className += ' mm-picker-off';
if (entry.icon && OWN_ICON.test(String(entry.icon))) {
drawBrandMark(el('div', 'mm-picker-icon mm-mark', item), 50);
} else if (entry.icon) {
var icon = el('img', 'mm-picker-icon', item);
icon.src = imageUrl(entry.icon);
} else {
drawIconPlaceholder(el('div', 'mm-picker-icon mm-picker-noicon', item), 50);
}
var name = el('div', 'mm-picker-name', item);
name.textContent = entry.name;
if (entry.alerting) {
var mark = el('div', 'mm-picker-alert', item);
mark.textContent = '!';
}
item.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0 || entry.enabled === false) return;
playUiSound('click');
if (entry.source === 'group') {
openEntryGroup(entry, item);
return;
}
jsonCommand('invokeEntry', {
id: entry.id, source: entry.source, numID: entry.numID,
});
});
item.addEventListener('mouseenter', function () { playUiSound('hover'); });
}(ordered[i], i));
}
afterTwoFrames(function () {
if (!box.parentNode) return;
var k = getScale() || 1;
var available = (Number(root.offsetHeight) || 0) / k;
if (available <= 0) available = surfaceH;
var headRoom = (Number(head.offsetHeight) || 0) / k;
var ceiling = Math.max(120, available - pickerBottom - 40 - headRoom - 18);
list.style.maxHeight = Math.round(ceiling) + 'rem';
sizePickerWidth(box, list, k);
refreshScrollbars();
});
var armed = false;
window.setTimeout(function () { armed = true; }, 400);
document.addEventListener('mousedown', function (event) {
if (!armed) return;
if (!event.target.closest('.mm-picker-box')) command('closeView');
});
}
function modDisplayName(mod) {
return plainText(mod.modDisplayName || mod.linkage);
}
function countNewFeatures(mod) {
var count = 0;
eachComponent(activeTemplate(mod), function (comp) {
if (comp.newFeature) count += 1;
});
return count;
}
function modVisible(mod) {
var name = modDisplayName(mod);
if (searchText && !modMatchesSearch(mod, name)) return false;
if (letterFilter && name.charAt(0).toUpperCase() !== letterFilter) return false;
return true;
}
function modMatchesSearch(mod, name) {
var term = searchText.toLowerCase();
if (name.toLowerCase().indexOf(term) >= 0) return true;
var hit = false;
eachOption(activeTemplate(mod), function (comp) {
if (!hit && optionMatches(comp, term)) hit = true;
});
return hit;
}
function updateHeaderCounters() {
var shown = 0;
var withNew = 0;
for (var i = 0; i < mods.length; i += 1) {
if (modVisible(mods[i])) shown += 1;
if (countNewFeatures(mods[i]) > 0) withNew += 1;
}
function modsCountText(count) {
var one = plainText(loc.headerModsOne) || '{0} mod';
var many = plainText(loc.headerModsMany) || '{0} mods';
var form;
if (loc.pluralRule === 'slavic') {
var last = count % 10;
var lastTwo = count % 100;
if (last === 1 && lastTwo !== 11) {
form = one;
} else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
form = plainText(loc.headerModsFew) || many;
} else {
form = many;
}
} else {
form = count === 1 ? one : many;
}
return form.replace('{0}', String(count));
}
var hits = String(loc.searchHits || 'found {0} of {1} mods');
var filtering = !!searchText || !!letterFilter;
document.getElementById('mm-hits').textContent = filtering
? hits.replace('{0}', String(shown)).replace('{1}', String(mods.length))
: '';
var subtitleNode = document.getElementById('mm-subtitle');
clearNode(subtitleNode);
el('div', 'mm-sub-text', subtitleNode).textContent = modsCountText(mods.length);
if (withNew > 0) {
el('div', 'mm-sub-sep', subtitleNode).textContent = '-';
var link = el('div', resultsMode === 'new'
? 'mm-sub-link mm-sub-link-on' : 'mm-sub-link', subtitleNode);
link.textContent = String(plainText(loc.headerNew) || '{0} with new options')
.replace('{0}', String(withNew));
bindSounds(link, true);
link.addEventListener('click', function () {
if (resultsMode === 'new') {
resultsMode = null;
} else {
clearSearchBox();
resultsMode = 'new';
}
renderList();
renderDetail();
});
}
}
function headerListLeft(width) {
var tools = document.getElementsByClassName('mm-header-tools');
if (!tools.length) return 8;
var rect = rootRelativeRect(tools[0]);
var left = rect.left + rect.width - width;
return left < 8 ? 8 : left;
}
function openEntryGroup(group, anchorNode) {
var members = group.members || [];
if (!members.length) return;
var items = [];
for (var i = 0; i < members.length; i += 1) {
(function (member) {
items.push({
label: member.name,
enabled: member.enabled !== false,
code: member.alerting ? '!' : undefined,
onClick: function () {
jsonCommand('invokeEntry', {
id: member.id, source: member.source, numID: member.numID,
});
},
});
}(members[i]));
}
var rect = rootRelativeRect(anchorNode);
var groupWidth = 240;
showContextMenu(headerListLeft(groupWidth), rect.top + rect.height + 4,
items, {rootSpace: true, owner: anchorNode, width: groupWidth});
}
function eachOption(template, callback) {
var columns = ['column1', 'column2', 'column3', 'column4'];
for (var c = 0; c < columns.length; c += 1) {
var list = template[columns[c]];
if (!list) continue;
var section = '';
for (var i = 0; i < list.length; i += 1) {
var comp = list[i] || {};
if (comp.type === 'Label') {
var heading = /^[-\s]+(.*[^-\s])[-\s]+$/.exec(plainText(comp.text));
if (heading) section = heading[1];
continue;
}
if (comp.varName === undefined) continue;
callback(comp, section);
}
}
}
function optionMatches(comp, term) {
if (plainText(comp.text).toLowerCase().indexOf(term) >= 0) return true;
var options = comp.options || [];
for (var i = 0; i < options.length; i += 1) {
var label = options[i] && options[i].label;
if (label && plainText(label).toLowerCase().indexOf(term) >= 0) return true;
}
return false;
}
function resultPath(mod, comp, section) {
var parts = [modDisplayName(mod)];
if (comp.tab) parts.push(String(comp.tab));
if (section) parts.push(section);
return parts.join('  >  ');
}
function collectResults() {
var term = String(searchText).toLowerCase();
var wantNew = resultsMode === 'new';
var rows = [];
var dropped = 0;
var push = function (row) {
if (rows.length >= RESULTS_LIMIT) dropped += 1;
else rows.push(row);
};
for (var i = 0; i < mods.length; i += 1) {
(function (mod) {
var name = modDisplayName(mod);
var nameHit = !wantNew && !!term && name.toLowerCase().indexOf(term) >= 0;
if (nameHit) {
push({linkage: mod.linkage, varName: null, tab: null, label: name,
path: '', isNew: countNewFeatures(mod) > 0});
}
eachOption(activeTemplate(mod), function (comp, section) {
if (wantNew) {
if (!comp.newFeature) return;
} else if (nameHit || !optionMatches(comp, term)) {
return;
}
push({
linkage: mod.linkage,
varName: comp.varName,
tab: comp.tab ? String(comp.tab) : null,
label: plainText(comp.text) || String(comp.varName),
path: resultPath(mod, comp, section),
isNew: !!comp.newFeature,
});
});
}(mods[i]));
}
return {rows: rows, dropped: dropped};
}
function clearSearchBox() {
var input = document.getElementById('mm-search');
if (input) input.value = '';
searchText = '';
refreshSearchUi();
}
function openResult(row) {
resultsMode = null;
if (row.tab) activeTabs[row.linkage] = row.tab;
selectMod(row.linkage);
scrollRowIntoView(row.linkage);
if (row.varName !== null && row.varName !== undefined) {
revealVar(row.linkage, row.varName);
}
}
function markAllResultsSeen() {
var linkages = [];
for (var i = 0; i < mods.length; i += 1) {
if (countNewFeatures(mods[i]) > 0) linkages.push(mods[i].linkage);
}
if (!linkages.length) return;
jsonCommand('markAllFeaturesSeen', {linkages: linkages});
}
function renderResults() {
var opts = document.getElementById('mm-opts');
var nameNode = document.getElementById('mm-modname');
var headLeft = nameNode.parentNode;
var resetBtn = document.getElementById('mm-modreset');
var headRight = resetBtn.parentNode;
clearAtlasTimers();
imageFits = [];
clearNode(opts);
hideTooltip();
closeOpenDropdown();
renderModErrorBar(null);
renderTabStrip({linkage: ''}, [], null);
var oldIcon = headLeft.getElementsByClassName('mm-head-icon');
while (oldIcon.length) headLeft.removeChild(oldIcon[0]);
resetBtn.style.display = 'none';
document.getElementById('mm-modswitch').style.display = 'none';
var oldMark = document.getElementById('mm-markall');
if (oldMark && oldMark.parentNode) oldMark.parentNode.removeChild(oldMark);
var isNew = resultsMode === 'new';
setLabel(nameNode, isNew
? (plainText(loc.resultsNewTitle) || 'New options')
: (plainText(loc.resultsTitle) || 'Search results'));
if (isNew) {
var markAll = el('button', 'mm-reset', headRight);
markAll.id = 'mm-markall';
markAll.textContent = plainText(loc.markAllRead) || 'Mark all as read';
bindSounds(markAll, true);
markAll.addEventListener('click', markAllResultsSeen);
}
opts.className = 'mm-opts mm-opts-res';
var found = collectResults();
var box = el('div', 'mm-res', opts);
if (!found.rows.length) {
var empty = el('div', 'mm-res-empty', box);
empty.textContent = plainText(loc.resultsEmpty) || 'Nothing matches';
}
for (var i = 0; i < found.rows.length; i += 1) {
(function (row) {
var node = el('div', row.varName === null ? 'mm-res-row mm-res-mod' : 'mm-res-row', box);
bindSounds(node, true);
var main = el('div', 'mm-res-main', node);
var label = el('div', 'mm-res-label', main);
label.textContent = row.label;
if (row.isNew && resultsMode !== 'new') el('div', 'mm-res-new', main);
if (row.path) {
var path = el('div', 'mm-res-path', node);
path.textContent = row.path;
}
node.addEventListener('click', function () { openResult(row); });
}(found.rows[i]));
}
if (found.dropped > 0) {
var more = el('div', 'mm-res-more', box);
more.textContent = String(plainText(loc.resultsMore) || '{0} more - narrow the search')
.replace('{0}', String(found.dropped));
}
opts.scrollTop = 0;
refreshScrollbars();
}
function syncResultsMode() {
var wanted = searchText.length >= RESULTS_MIN_CHARS ? 'search' : null;
if (!wanted && resultsMode === 'new' && !searchText) wanted = 'new';
var before = resultsMode;
resultsMode = wanted;
if (resultsMode || before) renderDetail();
}
function renderList() {
var list = document.getElementById('mm-list');
clearNode(list);
if (!mods.length) {
var none = el('div', 'mm-list-none', list);
none.textContent = plainText(loc.entriesNone || 'No mod is using this menu yet');
}
for (var i = 0; i < mods.length; i += 1) {
(function (mod) {
var name = modDisplayName(mod);
if (!modVisible(mod)) return;
var row = el('div', 'mm-row', list);
row.setAttribute('data-linkage', mod.linkage);
var store = values[mod.linkage] || {};
var refreshRowClass = function () {
var cls = 'mm-row';
if (mod.linkage === selectedLinkage) cls += ' mm-row-active';
if (('enabled' in store) && !store.enabled) cls += ' mm-row-off';
row.className = cls;
};
refreshRowClass();
var dot = el('div', 'mm-row-dot', row);
if ('enabled' in store) {
if (store.enabled) dot.className += ' mm-on';
} else {
dot.style.visibility = 'hidden';
}
if (modIcons[mod.linkage]) {
var rowIcon = el('img', 'mm-row-icon', row);
rowIcon.src = imageUrl(modIcons[mod.linkage]);
}
var nameNode = el('div', 'mm-row-name', row);
nameNode.textContent = name;
var badges = el('div', 'mm-row-badges', row);
var newCount = countNewFeatures(mod);
if (newCount > 0) {
var badge = el('div', 'mm-badge-new', badges);
badge.textContent = String(newCount);
}
var dirty = el('div', 'mm-dirty-dot', badges);
dirty.style.display = modChangedVars(mod.linkage).length > 0 ? 'flex' : 'none';
dot.addEventListener('mousedown', function (event) {
if (!('enabled' in store)) return;
store.enabled = !store.enabled;
dot.className = store.enabled ? 'mm-row-dot mm-on' : 'mm-row-dot';
refreshRowClass();
onControlChanged(mod.linkage, 'enabled', null);
if (mod.linkage === selectedLinkage) renderDetail();
event.stopPropagation();
});
row.addEventListener('click', function () {
selectMod(mod.linkage);
});
}(mods[i]));
}
renderAz();
updateHeaderCounters();
refreshScrollbars();
}
function renderListDirtyDots() {
var list = document.getElementById('mm-list');
var rows = list.childNodes;
for (var i = 0; i < rows.length; i += 1) {
var row = rows[i];
var linkage = row.getAttribute && row.getAttribute('data-linkage');
if (!linkage) continue;
var dots = row.getElementsByClassName('mm-dirty-dot');
if (dots.length) {
dots[0].style.display = modChangedVars(linkage).length > 0 ? 'flex' : 'none';
}
}
}
function renderAz() {
var az = document.getElementById('mm-az');
var rail = document.getElementById('mm-az-rail');
clearNode(az);
clearNode(rail);
az.className = azMode === 'grid' ? 'mm-az' : 'mm-az mm-hidden';
rail.className = azMode === 'rail' ? 'mm-az-rail mm-on' : 'mm-az-rail';
if (azMode === 'off') return;
var host = azMode === 'rail' ? rail : az;
var present = {};
for (var i = 0; i < mods.length; i += 1) {
var name = modDisplayName(mods[i]);
if (name) present[name.charAt(0).toUpperCase()] = true;
}
var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (var j = 0; j < letters.length; j += 1) {
(function (letter) {
var node = el('div', 'mm-az-letter', host);
var glyph = el('div', 'mm-az-glyph', node);
glyph.textContent = letter;
if (!present[letter]) {
node.className += ' mm-az-disabled';
return;
}
if (letter === letterFilter) node.className += ' mm-az-active';
node.addEventListener('click', function () {
letterFilter = letterFilter === letter ? null : letter;
renderList();
});
}(letters.charAt(j)));
}
}
function selectMod(linkage, quiet) {
resultsMode = null;
selectedLinkage = linkage;
renderList();
renderDetail();
var opts = document.getElementById('mm-opts');
opts.scrollTop = 0;
refreshScrollbars();
if (!quiet) jsonCommand('saveSelectedMod', {linkage: linkage});
}
function stepSelection(delta) {
var visible = [];
for (var i = 0; i < mods.length; i += 1) {
if (modVisible(mods[i])) visible.push(mods[i].linkage);
}
if (!visible.length) return;
var at = visible.indexOf(selectedLinkage);
var next = at < 0 ? (delta > 0 ? 0 : visible.length - 1) : at + delta;
if (next < 0) next = 0;
if (next >= visible.length) next = visible.length - 1;
if (visible[next] === selectedLinkage) return;
setKeyboardMode(true);
selectMod(visible[next]);
scrollRowIntoView(visible[next]);
}
function setKeyboardMode(on) {
if (keyboardMode === on || !root) return;
keyboardMode = on;
var cls = String(root.className).replace(/\s*mm-keyboard/g, '');
root.className = on ? cls + ' mm-keyboard' : cls;
}
function scrollRowIntoView(linkage) {
var list = document.getElementById('mm-list');
var row = list ? list.querySelector('[data-linkage="' + linkage + '"]') : null;
if (!list || !row) return;
var rowTop = Number(row.offsetTop) || 0;
var rowHeight = Number(row.offsetHeight) || 0;
var viewport = Number(list.clientHeight) || 0;
if (!viewport) return;
if (rowTop >= list.scrollTop && rowTop + rowHeight <= list.scrollTop + viewport) return;
list.scrollTop = Math.max(0, rowTop - Math.round(viewport / 3));
refreshScrollbars();
}
var TAB_COLUMNS = ['column1', 'column2', 'column3', 'column4'];
var activeTabs = {};
function templateTabs(template) {
var tabs = [];
for (var c = 0; c < TAB_COLUMNS.length; c += 1) {
var list = template[TAB_COLUMNS[c]] || [];
for (var i = 0; i < list.length; i += 1) {
var name = list[i] && list[i].tab;
if (!name) continue;
name = String(name);
if (tabs.indexOf(name) < 0) tabs.push(name);
}
}
if (tabs.length && hasFullWidthTab(template) && hasUntaggedComponents(template)) {
tabs.push(COLLECTOR_TAB);
}
return tabs;
}
var COLLECTOR_TAB = '__mm_ungrouped__';
function tabIsFullWidth(template, tab) {
for (var c = 0; c < TAB_COLUMNS.length; c += 1) {
var list = template[TAB_COLUMNS[c]] || [];
for (var i = 0; i < list.length; i += 1) {
if (list[i] && String(list[i].tab || '') === tab && list[i].tabFullWidth) return true;
}
}
return false;
}
function hasFullWidthTab(template) {
for (var c = 0; c < TAB_COLUMNS.length; c += 1) {
var list = template[TAB_COLUMNS[c]] || [];
for (var i = 0; i < list.length; i += 1) {
if (list[i] && list[i].tabFullWidth) return true;
}
}
return false;
}
function hasUntaggedComponents(template) {
for (var c = 0; c < TAB_COLUMNS.length; c += 1) {
var list = template[TAB_COLUMNS[c]] || [];
for (var i = 0; i < list.length; i += 1) {
if (list[i] && !list[i].tab) return true;
}
}
return false;
}
function tabLabel(tab) {
return tab === COLLECTOR_TAB ? (plainText(loc.tabUngrouped) || 'Ungrouped') : tab;
}
function templateForTab(template, tab) {
var copy = {};
for (var key in template) {
if (template.hasOwnProperty(key)) copy[key] = template[key];
}
for (var c = 0; c < TAB_COLUMNS.length; c += 1) {
var list = template[TAB_COLUMNS[c]];
if (!list) continue;
var kept = [];
var collecting = hasFullWidthTab(template) && hasUntaggedComponents(template);
for (var i = 0; i < list.length; i += 1) {
var own = String((list[i] && list[i].tab) || '');
if (tab === COLLECTOR_TAB) {
if (!own) kept.push(list[i]);
} else if (own === tab) {
kept.push(list[i]);
} else if (!own && !collecting) {
kept.push(list[i]);
}
}
copy[TAB_COLUMNS[c]] = kept;
}
return copy;
}
function renderTabStrip(mod, tabs, activeTab) {
var detail = document.getElementById('mm-detail');
if (!detail) return;
var old = detail.getElementsByClassName('mm-tabs');
while (old.length) old[0].parentNode.removeChild(old[0]);
if (tabs.length < 2) {
detail.className = String(detail.className).replace(/\s*mm-has-tabs/g, '');
return;
}
if (String(detail.className).indexOf('mm-has-tabs') < 0) {
detail.className = detail.className + ' mm-has-tabs';
}
var strip = el('div', 'mm-tabs');
for (var i = 0; i < tabs.length; i += 1) {
(function (name) {
var node = el('div', name === activeTab ? 'mm-tab mm-tab-on' : 'mm-tab', strip);
node.textContent = tabLabel(name);
bindSounds(node, true);
node.addEventListener('mousedown', function () {
if (activeTabs[mod.linkage] === name) return;
activeTabs[mod.linkage] = name;
renderDetail();
});
})(tabs[i]);
}
var wrap = detail.getElementsByClassName('mm-opts-wrap')[0];
if (wrap) detail.insertBefore(strip, wrap);
else detail.appendChild(strip);
}
function renderDetail() {
if (resultsMode) {
renderResults();
return;
}
var mod = findMod(selectedLinkage);
var nameNode = document.getElementById('mm-modname');
var opts = document.getElementById('mm-opts');
var resetBtn = document.getElementById('mm-modreset');
var switchNode = document.getElementById('mm-modswitch');
clearAtlasTimers();
imageFits = [];
clearNode(opts);
opts.className = 'mm-opts';
hideTooltip();
closeOpenDropdown();
if (!mod) {
renderModErrorBar(null);
nameNode.textContent = '';
resetBtn.style.display = 'none';
switchNode.style.display = 'none';
renderTabStrip({linkage: ''}, [], null);
return;
}
var template = activeTemplate(mod);
var headLeft = nameNode.parentNode;
var oldMark = document.getElementById('mm-markall');
if (oldMark && oldMark.parentNode) oldMark.parentNode.removeChild(oldMark);
var oldIcon = headLeft.getElementsByClassName('mm-head-icon');
while (oldIcon.length) headLeft.removeChild(oldIcon[0]);
if (modIcons[mod.linkage]) {
var headIcon = el('img', 'mm-head-icon');
headIcon.src = imageUrl(modIcons[mod.linkage]);
headLeft.insertBefore(headIcon, nameNode);
}
setLabel(nameNode, mod.modDisplayName || mod.linkage);
resetBtn.style.display = 'flex';
attachTooltip(resetBtn, loc.resetTooltip);
attachTooltip(switchNode, loc.stateTooltip);
var store = values[mod.linkage];
if ('enabled' in store) {
switchNode.style.display = 'flex';
switchNode.className = store.enabled ? 'mm-switch mm-on' : 'mm-switch';
} else {
switchNode.style.display = 'none';
}
opts.setAttribute('data-mod', mod.linkage);
controls[mod.linkage] = {};
renderModErrorBar(mod.linkage);
var tabs = templateTabs(template);
var activeTab = null;
if (tabs.length > 1) {
activeTab = tabs.indexOf(activeTabs[mod.linkage]) >= 0
? activeTabs[mod.linkage]
: tabs[0];
template = templateForTab(template, activeTab);
}
renderTabStrip(mod, tabs, activeTab);
var slots;
if (activeTab && activeTab !== COLLECTOR_TAB && tabIsFullWidth(mod, activeTab)) {
var wide = [];
for (var wc = 0; wc < TAB_COLUMNS.length; wc += 1) {
var wlist = template[TAB_COLUMNS[wc]] || [];
for (var wi = 0; wi < wlist.length; wi += 1) wide.push(wlist[wi]);
}
slots = [wide];
} else {
slots = displaySlots(template);
}
var spanned = {};
for (var sc = 0; sc < slots.length; sc += 1) {
var slist = slots[sc] || [];
for (var si = 0; si < slist.length; si += 1) {
var sspan = Number((slist[si] || {}).span) || 1;
for (var sk = 1; sk < sspan && sc + sk < slots.length; sk += 1) {
spanned[sc + sk] = true;
}
}
}
for (var c = 0; c < slots.length; c += 1) {
var list = slots[c];
if (!list.length) continue;
var colNode = el('div', 'mm-col', opts);
for (var i = 0; i < list.length; i += 1) {
try {
colNode.appendChild(renderComponent(mod, list[i], i));
} catch (error) {
var failed = list[i] || {};
var name = failed.varName || failed.type || ('#' + i);
uiLog('jserror component ' + mod.linkage + '.' + name + ': ' + error);
var stub = el('div', 'mm-comp mm-comp-broken', colNode);
stub.textContent = String(plainText(failed.text || name));
}
}
restoreSpanFiller(colNode, mod.linkage, c, !!spanned[c]);
}
refreshGates(mod.linkage);
applyColumnSpans(opts);
refreshScrollbars();
runImageFits();
}
function applyColumnSpans(opts) {
try {
spanColumns(opts);
} catch (error) {
uiLog('jserror applyColumnSpans ' + (error && error.message ? error.message : error));
}
}
function spanColumns(opts) {
var columns = [];
for (var node = opts.firstChild; node; node = node.nextSibling) {
if (node.nodeType === 1 && String(node.className || '').indexOf('mm-col') >= 0) {
columns.push(node);
}
}
if (columns.length < 2) return;
var spans = [];
for (var c = 0; c < columns.length; c += 1) {
for (var child = columns[c].firstChild; child; child = child.nextSibling) {
if (child.nodeType !== 1) continue;
var span = Number(child.getAttribute('data-span')) || 1;
if (span < 2) continue;
var reach = Math.min(span, columns.length - c);
if (reach < 2) continue;
spans.push({node: child, column: c, reach: reach});
}
}
if (!spans.length) return;
for (var i = 0; i < spans.length; i += 1) {
if (!spans[i].node.parentNode) continue;
var reachWidth = (spans[i].reach * 100) + '%';
if (spans[i].node.style.width !== reachWidth) {
spans[i].node.style.width = reachWidth;
}
}
afterTwoFrames(function () {
try {
for (var j = 0; j < spans.length; j += 1) {
var entry = spans[j];
if (!entry.node.parentNode) continue;
var top = Number(entry.node.offsetTop) || 0;
var bottom = top + (Number(entry.node.offsetHeight) || 0);
for (var k = 1; k < entry.reach; k += 1) {
clearBand(columns[entry.column + k], top, bottom,
selectedLinkage, entry.column + k);
}
}
refreshScrollbars();
} catch (error) {
uiLog('jserror spanHeights ' + (error && error.message ? error.message : error));
}
});
}
var spanFillerCache = {};
function spanFillerKey(linkage, columnIndex) {
return linkage + '|' + (multiColumn ? '4' : '2') + '|' + columnIndex;
}
function restoreSpanFiller(column, linkage, columnIndex, isSpanned) {
var known = spanFillerCache[spanFillerKey(linkage, columnIndex)];
if (!known || !(known.height > 0)) {
if (!isSpanned) return;
column.style.visibility = 'hidden';
window.setTimeout(function () { column.style.visibility = ''; }, 500);
return;
}
var before = column.children[known.index];
if (!before) return;
var filler = document.createElement('div');
filler.className = 'mm-span-filler';
filler.style.height = Math.round(known.height) + 'px';
column.insertBefore(filler, before);
}
function clearBand(column, top, bottom, linkage, columnIndex) {
if (!column) return;
var fillers = column.getElementsByClassName('mm-span-filler');
var filler = fillers.length ? fillers[0] : null;
while (fillers.length > 1) fillers[1].parentNode.removeChild(fillers[1]);
var currentH = filler ? (Number(filler.offsetHeight) || 0) : 0;
var collided = null;
var collidedNaturalTop = 0;
var passed = false;
for (var child = column.firstChild; child; child = child.nextSibling) {
if (child.nodeType !== 1) continue;
if (child === filler) { passed = true; continue; }
var off = passed ? currentH : 0;
var naturalTop = (Number(child.offsetTop) || 0) - off;
var naturalBottom = naturalTop + (Number(child.offsetHeight) || 0);
if (naturalBottom > top) { collided = child; collidedNaturalTop = naturalTop; break; }
}
var height = collided ? bottom - collidedNaturalTop : 0;
if (!collided || height <= 0) {
if (filler) filler.parentNode.removeChild(filler);
if (linkage) delete spanFillerCache[spanFillerKey(linkage, columnIndex)];
column.style.visibility = '';
return;
}
if (!filler) {
filler = document.createElement('div');
filler.className = 'mm-span-filler';
}
if (filler.parentNode !== column || filler.nextSibling !== collided) {
column.insertBefore(filler, collided);
}
column.style.visibility = '';
var target = Math.round(height) + 'px';
if (filler.style.height !== target) filler.style.height = target;
if (linkage) {
var at = 0;
for (var n = 0; n < column.children.length; n += 1) {
if (column.children[n] === filler) { at = n; break; }
}
spanFillerCache[spanFillerKey(linkage, columnIndex)] = {
index: at, height: Math.round(height),
};
}
}
function renderComponent(mod, comp, index) {
var linkage = mod.linkage;
var wrap = el('div', 'mm-comp');
if (comp.masterIndent) wrap.className += ' mm-indent';
if (comp.newFeature) wrap.className += ' mm-new';
dismissFlareOnAttention(linkage, comp, wrap);
if (Number(comp.span) > 1) wrap.setAttribute('data-span', String(Number(comp.span)));
var refresh = function () {};
switch (comp.type) {
case 'Empty':
wrap.style.height = (comp.height || 20) + 'rem';
break;
case 'Label':
var section = /^[-\s]+(.*[^-\s])[-\s]+$/.exec(plainText(comp.text));
if (section) {
wrap.className += ' mm-section';
var head = el('div', 'mm-comp-label', wrap);
head.textContent = section[1].toUpperCase();
} else {
wrap.className += ' mm-label-only';
setLabel(el('div', 'mm-comp-label', wrap), comp.text, comp.useHTML);
}
break;
case 'CheckBox':
refresh = renderCheckbox(wrap, linkage, comp);
break;
case 'RadioButtonGroup':
refresh = renderRadioGroup(wrap, linkage, comp);
break;
case 'Dropdown':
refresh = renderDropdown(wrap, linkage, comp);
break;
case 'Slider':
refresh = renderSlider(wrap, linkage, comp, false);
break;
case 'StepSlider':
refresh = renderSlider(wrap, linkage, comp, true);
break;
case 'TextInput':
refresh = renderTextInput(wrap, linkage, comp);
break;
case 'NumericStepper':
refresh = renderStepper(wrap, linkage, comp);
break;
case 'HotKey':
refresh = renderHotkey(wrap, linkage, comp);
break;
case 'ColorChoice':
refresh = renderColorChoice(wrap, linkage, comp);
break;
case 'CheckBoxColor':
refresh = renderCheckboxColor(wrap, linkage, comp);
break;
case 'RangeSlider':
refresh = renderRangeSlider(wrap, linkage, comp);
break;
case 'Button':
setLabel(el('div', 'mm-comp-label', el('div', 'mm-comp-row', wrap)),
comp.text || '', comp.useHTML);
break;
case 'Image':
refresh = renderImage(wrap, linkage, comp);
break;
default:
setLabel(el('div', 'mm-comp-label', wrap), comp.text, comp.useHTML);
break;
}
if (comp.tooltip) {
var hoverPair = addInfoMarker(wrap);
if (hoverPair) {
attachTooltip(hoverPair, comp.tooltip);
} else if (comp.type === 'Image') {
var caption = wrap.getElementsByClassName('mm-image-label');
if (caption.length) attachTooltip(caption[0], comp.tooltip);
} else {
var labelNodes = wrap.getElementsByClassName('mm-comp-label');
attachTooltip(labelNodes.length ? labelNodes[0] : wrap, comp.tooltip);
}
}
if (comp.button && comp.varName !== undefined) {
addMiniButton(wrap, linkage, comp);
}
var entry = {
comp: comp,
node: wrap,
refresh: refresh,
refreshGate: function () {
var ok = gateSatisfied(linkage, comp);
var cls = 'mm-comp';
if (comp.masterIndent) cls += ' mm-indent';
if (comp.newFeature) cls += ' mm-new';
if (!ok) cls += comp.gateHides ? ' mm-hidden' : ' mm-gated';
if (wrap.className !== cls) wrap.className = cls;
var gated = ok ? '0' : '1';
if (wrap.getAttribute('data-gated') !== gated) {
wrap.setAttribute('data-gated', gated);
}
},
};
if (comp.varName !== undefined) {
controls[linkage][comp.varName] = entry;
} else {
controls[linkage]['#' + (comp.type || 'x') + index + Math.floor(index)] = entry;
}
return wrap;
}
function isGatedNode(wrap) {
return wrap.getAttribute('data-gated') === '1';
}
function addInfoMarker(wrap) {
var labels = wrap.getElementsByClassName('mm-comp-label');
if (!labels.length) return null;
var labelNode = labels[0];
var parent = labelNode.parentNode;
if (parent === wrap && wrap.className.indexOf('mm-section') < 0) {
var labelRow = el('div', 'mm-comp-row');
wrap.insertBefore(labelRow, labelNode);
labelRow.appendChild(labelNode);
parent = labelRow;
}
if (!parent || parent.className.indexOf('mm-comp-row') < 0) return null;
labelNode.style.flex = '0 1 auto';
var pair = el('div', 'mm-label-pair');
parent.insertBefore(pair, labelNode);
pair.appendChild(labelNode);
var icon = el('div', 'mm-info', pair);
el('div', 'mm-info-dot', icon);
el('div', 'mm-info-stem', icon);
parent.insertBefore(el('div', 'mm-row-spacer'), pair.nextSibling);
return pair;
}
function controlBlock(wrap) {
var found = null;
for (var node = wrap.firstChild; node; node = node.nextSibling) {
if (node.nodeType !== 1) continue;
var cls = node.className || '';
if (cls.indexOf('mm-comp-row') >= 0) continue;
found = node;
}
return found;
}
function addMiniButton(wrap, linkage, comp) {
var cfg = comp.button || {};
var btn = el('button', 'mm-mini-btn');
btn.type = 'button';
var iconSource = cfg.iconSource || cfg.icon;
if (!cfg.text && !iconSource) {
return;
}
if (cfg.text && iconSource) {
var pairFrame = el('div', 'mm-mini-btn-iconbox', btn);
if (cfg.iconGlyph) {
var pairGlyph = el('img', 'mm-glyph', pairFrame);
pairGlyph.src = 'img/' + cfg.iconGlyph + '.png';
} else {
var pairIcon = el('img', 'mm-mini-btn-icon', pairFrame);
pairIcon.src = imageUrl(iconSource);
var pairInk = cfg.iconInk;
if (pairInk && pairInk.length === 6 && pairInk[2] > 0 && pairInk[3] > 0) {
var pairZoom = Math.min(MINI_ICON_MAX_ZOOM,
Math.min(MINI_ICON_BOX / pairInk[2], MINI_ICON_BOX / pairInk[3]));
pairIcon.style.width = Math.round(pairInk[4] * pairZoom) + 'rem';
pairIcon.style.height = Math.round(pairInk[5] * pairZoom) + 'rem';
pairIcon.style.left = Math.round((MINI_ICON_BOX - pairInk[2] * pairZoom) / 2 - pairInk[0] * pairZoom) + 'rem';
pairIcon.style.top = Math.round((MINI_ICON_BOX - pairInk[3] * pairZoom) / 2 - pairInk[1] * pairZoom) + 'rem';
} else {
pairIcon.style.width = MINI_ICON_BOX + 'rem';
pairIcon.style.height = MINI_ICON_BOX + 'rem';
}
}
var pairText = el('div', 'mm-mini-btn-text', btn);
pairText.textContent = plainText(cfg.text);
} else if (cfg.text) {
btn.textContent = plainText(cfg.text);
} else if (iconSource) {
btn.className += ' mm-mini-btn-icononly';
var ink = cfg.iconInk;
var frame = el('div', 'mm-mini-btn-iconbox', btn);
if (cfg.iconGlyph) {
var glyph = el('img', 'mm-glyph', frame);
glyph.src = 'img/' + cfg.iconGlyph + '.png';
} else {
var icon = el('img', 'mm-mini-btn-icon', frame);
icon.src = imageUrl(iconSource);
if (ink && ink.length === 6 && ink[2] > 0 && ink[3] > 0) {
var zoom = Math.min(MINI_ICON_MAX_ZOOM,
Math.min(MINI_ICON_BOX / ink[2], MINI_ICON_BOX / ink[3]));
icon.style.width = Math.round(ink[4] * zoom) + 'rem';
icon.style.height = Math.round(ink[5] * zoom) + 'rem';
icon.style.left = Math.round((MINI_ICON_BOX - ink[2] * zoom) / 2 - ink[0] * zoom) + 'rem';
icon.style.top = Math.round((MINI_ICON_BOX - ink[3] * zoom) / 2 - ink[1] * zoom) + 'rem';
} else {
icon.style.width = MINI_ICON_BOX + 'rem';
icon.style.height = MINI_ICON_BOX + 'rem';
}
}
if (cfg.iconOffsetLeft) frame.style.marginLeft = cfg.iconOffsetLeft + 'rem';
if (cfg.iconOffsetTop) frame.style.marginTop = cfg.iconOffsetTop + 'rem';
}
if (cfg.height) btn.style.height = cfg.height + 'rem';
if (cfg.height) btn.style.lineHeight = (cfg.height - 2) + 'rem';
var rows = wrap.getElementsByClassName('mm-comp-row');
var labelRow = rows.length ? rows[0] : null;
var control = controlBlock(wrap);
var isRadioList = control && (control.className || '').indexOf('mm-radio-list') >= 0;
var hasLabelText = !!plainText(comp.text || '').replace(/\s+/g, '');
var optionRow = null;
if (isRadioList && !hasLabelText) {
var options = control.getElementsByClassName('mm-radio');
if (options.length) optionRow = options[0];
}
if (isRadioList && labelRow && !optionRow) control = null;
var anchorRow = optionRow || labelRow;
var fixed = cfg.fixedPositioning && comp.width;
if (fixed && anchorRow) {
labelRow = anchorRow;
var btnWidth = cfg.width || 30;
btn.style.width = btnWidth + 'rem';
if (cfg.align === 'right') {
btn.style.marginLeft = '0';
btn.style.flexGrow = '0';
btn.style.flexShrink = '0';
if (cfg.offsetLeft) btn.style.marginRight = (-cfg.offsetLeft) + 'rem';
var labels = labelRow.getElementsByClassName('mm-comp-label');
if (labels.length) {
labels[0].style.flexGrow = '0';
labels[0].style.flexShrink = '1';
labels[0].style.flexBasis = 'auto';
}
var radioLabels = labelRow.getElementsByClassName('mm-radio-label');
if (radioLabels.length) {
radioLabels[0].style.flexGrow = '0';
radioLabels[0].style.flexShrink = '1';
radioLabels[0].style.flexBasis = 'auto';
}
el('div', 'mm-row-spacer', labelRow);
labelRow.appendChild(btn);
} else {
btn.style.position = 'absolute';
btn.style.marginLeft = '0';
btn.style.left = Math.round(comp.width + (cfg.offsetLeft || 0)) + 'rem';
btn.style.top = '0';
btn.style.bottom = '0';
btn.style.marginTop = 'auto';
btn.style.marginBottom = 'auto';
labelRow.style.position = 'relative';
labelRow.appendChild(btn);
}
} else if (control) {
if (cfg.width) btn.style.width = cfg.width + 'rem';
var slot = el('div', 'mm-ctl-row');
control.parentNode.insertBefore(slot, control);
slot.appendChild(control);
slot.appendChild(btn);
if (cfg.offsetLeft) btn.style.marginLeft = (8 + cfg.offsetLeft) + 'rem';
if (cfg.offsetTop) {
btn.style.position = 'relative';
btn.style.top = cfg.offsetTop + 'rem';
}
} else {
if (cfg.width) btn.style.width = cfg.width + 'rem';
var host = labelRow || wrap;
var labels = host.getElementsByClassName('mm-comp-label');
if (labels.length) {
labels[0].style.flexGrow = '0';
labels[0].style.flexShrink = '1';
labels[0].style.flexBasis = 'auto';
}
var spacers = host.getElementsByClassName('mm-row-spacer');
if (spacers.length) host.insertBefore(btn, spacers[0]);
else {
host.appendChild(btn);
el('div', 'mm-row-spacer', host);
}
if (cfg.offsetLeft) btn.style.marginLeft = (8 + cfg.offsetLeft) + 'rem';
if (cfg.offsetTop) {
btn.style.position = 'relative';
btn.style.top = cfg.offsetTop + 'rem';
}
}
btn.addEventListener('click', function (event) {
jsonCommand('buttonAction', {
linkage: linkage, varName: comp.varName,
value: values[linkage][comp.varName],
});
event.stopPropagation();
});
}
function renderCheckbox(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row mm-check-row', wrap);
var sw = el('div', 'mm-switch', row);
el('div', 'mm-switch-knob', sw);
var label = el('div', 'mm-comp-label', row);
setLabel(label, comp.text, comp.useHTML);
var refresh = function () {
sw.className = values[linkage][comp.varName] ? 'mm-switch mm-on' : 'mm-switch';
};
var toggle = function () {
if (isGatedNode(wrap)) return;
values[linkage][comp.varName] = !values[linkage][comp.varName];
refresh();
onControlChanged(linkage, comp.varName, comp);
};
sw.addEventListener('click', toggle);
label.addEventListener('click', toggle);
refresh();
return refresh;
}
function renderRadioGroup(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var list = el('div', comp.inline ? 'mm-radio-list mm-inline' : 'mm-radio-list', wrap);
var options = comp.options || [];
var items = [];
var refresh = function () {
var value = Number(values[linkage][comp.varName]) || 0;
for (var i = 0; i < items.length; i += 1) {
items[i].className = i === value ? 'mm-radio mm-on' : 'mm-radio';
}
};
for (var i = 0; i < options.length; i += 1) {
(function (idx) {
var item = el('div', 'mm-radio', list);
el('div', 'mm-radio-dot', item);
setLabel(el('div', 'mm-radio-label', item), options[idx].label, comp.useHTML);
item.addEventListener('click', function () {
if (isGatedNode(wrap)) return;
values[linkage][comp.varName] = idx;
refresh();
onControlChanged(linkage, comp.varName, comp);
});
items.push(item);
}(i));
}
refresh();
return refresh;
}
function stepDropdown(delta) {
if (!openDropdown || !openDropdown.mmStep) return;
openDropdown.mmStep(delta);
}
function nodeWithin(child, parent) {
for (var node = child; node; node = node.parentNode) {
if (node === parent) return true;
}
return false;
}
function followOpenDropdown(host, deltaPx) {
if (!openDropdown || !openDropdownOwner || !deltaPx) return;
if (host && !nodeWithin(openDropdownOwner, host)) return;
try {
var scale = getScale() || 1;
var delta = deltaPx / scale;
var top = parseFloat(openDropdown.style.top) || 0;
openDropdown.style.top = Math.round(top - delta) + 'rem';
openDropdown.mmFieldTop = (Number(openDropdown.mmFieldTop) || 0) - delta;
if (!host) return;
var band = rootRelativeRect(host);
var fieldTop = openDropdown.mmFieldTop;
var fieldBottom = fieldTop + (Number(openDropdown.mmFieldHeight) || 0);
var lead = Math.min(48, Math.abs(delta));
var gone = fieldBottom <= band.top - lead ||
fieldTop >= band.top + band.height + lead;
openDropdown.style.visibility = gone ? 'hidden' : '';
} catch (error) {
closeOpenDropdown();
}
}
function closeOpenDropdown() {
if (openDropdown && openDropdown.parentNode) {
openDropdown.parentNode.removeChild(openDropdown);
}
openDropdown = null;
openDropdownOwner = null;
}
function measureWidestOption(options, useHTML, done) {
var host = el('div', 'mm-dd-measure', root);
var items = [];
for (var i = 0; i < options.length; i += 1) {
var item = el('div', 'mm-dd-measure-item', host);
setLabel(item, options[i].label, useHTML);
items.push(item);
}
afterTwoFrames(function () {
var widest = 0;
for (var j = 0; j < items.length; j += 1) {
var w = Number(items[j].offsetWidth) || 0;
if (w > widest) widest = w;
}
if (host.parentNode) host.parentNode.removeChild(host);
done(widest);
});
}
var DD_FRAME = 10 + 10 + 8 + 8 + 2;
var DD_BREATHING = 14;
var DD_CHAR_GUESS = 6.6;
var DD_POPUP_MAX = 240;
var DD_POPUP_PAD = 4;
var DD_ROW = 28;
var ddWidthCache = {};
function prewarmDropdownWidths(done) {
var seen = {};
var jobs = [];
for (var m = 0; m < mods.length; m += 1) {
eachComponent(mods[m], function (comp) {
if (!comp || comp.type !== 'Dropdown') return;
if (comp.width || comp.fullWidth) return;
var options = comp.options || [];
if (!options.length) return;
var key = optionsKey(options);
if (seen[key] || ddWidthCache[key]) return;
seen[key] = true;
jobs.push({key: key, options: options, useHTML: comp.useHTML});
});
}
if (!jobs.length) {
done();
return;
}
var k = getScale() || 1;
var host = el('div', 'mm-dd-measure', root);
var built = [];
for (var j = 0; j < jobs.length; j += 1) {
var items = [];
for (var o = 0; o < jobs[j].options.length; o += 1) {
var item = el('div', 'mm-dd-measure-item', host);
setLabel(item, jobs[j].options[o].label, jobs[j].useHTML);
items.push(item);
}
built.push(items);
}
afterTwoFrames(function () {
for (var b = 0; b < built.length; b += 1) {
var widest = 0;
for (var i = 0; i < built[b].length; i += 1) {
var w = Number(built[b][i].offsetWidth) || 0;
if (w > widest) widest = w;
}
if (!widest) continue;
var want = Math.ceil(widest / k + DD_FRAME + DD_BREATHING);
ddWidthCache[jobs[b].key] = Math.max(DD_MIN_WIDTH, want);
}
if (host.parentNode) host.parentNode.removeChild(host);
done();
});
}
function optionsKey(options) {
var parts = [];
for (var i = 0; i < options.length; i += 1) {
parts.push(String((options[i] || {}).label || ''));
}
return parts.join('');
}
function guessTextWidth(text) {
var units = 0;
for (var i = 0; i < text.length; i += 1) {
var c = text.charCodeAt(i);
var wide = (c >= 0x1100 && c <= 0x11FF) || (c >= 0x2E80 && c <= 0xA4CF) ||
(c >= 0xAC00 && c <= 0xD7AF) || (c >= 0xF900 && c <= 0xFAFF) ||
(c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xFF00 && c <= 0xFF60);
units += wide ? 2 : 1;
}
return units * DD_CHAR_GUESS;
}
var DD_MIN_WIDTH = 90;
function fitDropdown(dd, options, useHTML, cacheKey) {
if (!dd.parentNode || !options.length) return;
var k = getScale() || 1;
var available = (Number(dd.parentNode.offsetWidth) || 0) / k;
if (!available) return;
var currentW = (Number(dd.offsetWidth) || 0) / k;
measureWidestOption(options, useHTML, function (raw) {
if (!dd.parentNode) return;
var widest = raw / k;
var want = Math.ceil(widest + DD_FRAME + DD_BREATHING);
if (want < DD_MIN_WIDTH) want = DD_MIN_WIDTH;
if (!widest) return;
if (cacheKey) ddWidthCache[cacheKey] = Math.min(want, Math.round(available));
if (want >= available) {
if (currentW && currentW < available) dd.style.width = '';
return;
}
if (want < currentW) return;
dd.style.width = want + 'rem';
});
}
function renderDropdown(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var dd = el('div', 'mm-dd', wrap);
if (comp.width) dd.style.width = comp.width + 'rem';
var head = el('div', 'mm-dd-head', dd);
var current = el('div', 'mm-dd-current', head);
el('div', 'mm-chev', head);
var options = comp.options || [];
if (!comp.width && !comp.fullWidth) {
var ddKey = optionsKey(options);
var known = ddWidthCache[ddKey];
if (known) {
dd.style.width = known + 'rem';
} else {
var longest = 0;
for (var oi = 0; oi < options.length; oi += 1) {
var w = guessTextWidth(plainText(options[oi].label));
if (w > longest) longest = w;
}
if (longest) {
var guess = longest + DD_FRAME + DD_BREATHING;
dd.style.width = Math.max(DD_MIN_WIDTH, Math.round(guess)) + 'rem';
}
afterTwoFrames(function () {
fitDropdown(dd, options, comp.useHTML, ddKey);
});
}
}
var currentIndex = function () {
var value = Number(values[linkage][comp.varName]);
if (!isFinite(value) || value < 0) value = 0;
if (options.length && value >= options.length) value = options.length - 1;
return value;
};
var refresh = function () {
var option = options[currentIndex()];
if (option) setLabel(current, option.label, comp.useHTML);
else current.textContent = String(values[linkage][comp.varName] || '');
};
var openPopup = function () {
closeOpenDropdown();
var popup = el('div', 'mm-dd-popup', root);
zoomFloating(popup);
var list = el('div', 'mm-dd-list', popup);
var bar = el('div', 'mm-dd-bar', popup);
var thumb = el('div', 'mm-dd-thumb', bar);
bar.style.display = 'none';
var syncBar = function () {
var total = Number(list.scrollHeight) || 0;
var view = Number(list.clientHeight) || 0;
if (!total || !view || !(total - view > SCROLL_SLACK)) {
bar.style.display = 'none';
list.className = 'mm-dd-list';
return;
}
if (list.scrollTop > total - view) list.scrollTop = total - view;
if (list.scrollTop < 0) list.scrollTop = 0;
bar.style.display = 'flex';
list.className = 'mm-dd-list mm-dd-scrolled';
var barH = Number(bar.clientHeight) || 0;
var thumbH = Math.max(20, Math.round(barH * view / total));
thumb.style.height = thumbH + 'px';
thumb.style.marginTop =
Math.round((barH - thumbH) * (list.scrollTop / (total - view))) + 'px';
};
var value = currentIndex();
for (var i = 0; i < options.length; i += 1) {
(function (idx) {
var item = el('div', idx === value
? 'mm-dd-item mm-dd-sel' : 'mm-dd-item', list);
setLabel(item, options[idx].label, comp.useHTML);
if (options[idx].tooltip) attachTooltip(item, options[idx].tooltip);
item.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
values[linkage][comp.varName] = idx;
refresh();
closeOpenDropdown();
onControlChanged(linkage, comp.varName, comp);
event.stopPropagation();
});
}(i));
}
popup.addEventListener('wheel', function (event) {
if (tooltipWheel(event)) return;
var delta = Number(event.deltaY);
if (!delta) delta = -Number(event.wheelDelta || 0);
list.scrollTop += (delta > 0 ? -60 : 60);
syncBar();
event.preventDefault();
event.stopPropagation();
});
popup.mmPlace = function (firstTime) {
var box = rootRelativeRect(head);
if (!box || !(box.width > 0)) return;
popup.mmFieldTop = box.top;
popup.mmFieldHeight = box.height;
var tall = firstTime
? Math.min(240, options.length * 28 + 8)
: (Number(popup.offsetHeight) || 0) / (getScale() || 1);
if (firstTime) {
popup.style.width = Math.max(DD_MIN_WIDTH, Math.round(box.width)) + 'rem';
}
popup.style.left = Math.round(box.left) + 'rem';
var under = box.top + box.height + 2;
popup.style.top = (under + tall > surfaceH - 8)
? Math.max(4, Math.round(box.top - tall - 2)) + 'rem'
: Math.round(under) + 'rem';
};
popup.mmPlace(true);
var rect = rootRelativeRect(head);
popup.mmCursor = currentIndex();
popup.mmStep = function (delta) {
var items = list.getElementsByClassName('mm-dd-item');
if (!items.length) return;
var next = Math.max(0, Math.min(options.length - 1, popup.mmCursor + delta));
if (next === popup.mmCursor) return;
popup.mmCursor = next;
var chosen = currentIndex();
for (var i = 0; i < items.length; i += 1) {
var cls = i === chosen ? 'mm-dd-item mm-dd-sel' : 'mm-dd-item';
if (i === next) cls += ' mm-dd-cursor';
items[i].className = cls;
}
var row = items[next];
var top = Number(row.offsetTop) || 0;
var rowH = Number(row.offsetHeight) || 0;
if (top < list.scrollTop) list.scrollTop = top;
else if (top + rowH > list.scrollTop + list.clientHeight) {
list.scrollTop = top + rowH - list.clientHeight;
}
syncBar();
};
popup.mmCommit = function () {
var picked = popup.mmCursor;
if (picked === currentIndex()) { closeOpenDropdown(); return; }
values[linkage][comp.varName] = picked;
refresh();
closeOpenDropdown();
onControlChanged(linkage, comp.varName, comp);
};
openDropdown = popup;
openDropdownOwner = head;
var rowsFit = Math.floor((DD_POPUP_MAX - DD_POPUP_PAD * 2) / DD_ROW);
if (options.length > rowsFit) {
bar.style.display = 'flex';
list.className = 'mm-dd-list mm-dd-scrolled';
}
afterTwoFrames(syncBar);
window.setTimeout(syncBar, 120);
afterTwoFrames(function () {
var selected = list.children[value];
if (!selected) return;
var view = Number(list.clientHeight) || 0;
var top = Number(selected.offsetTop) || 0;
if (view && top + (Number(selected.offsetHeight) || 0) > view) {
list.scrollTop = Math.max(0, top - Math.round(view / 2));
syncBar();
}
});
};
head.addEventListener('mousedown', function (event) {
if (event.button !== 0 || isGatedNode(wrap)) return;
var wasOwner = openDropdownOwner === head;
closeOpenDropdown();
if (!wasOwner) openPopup();
event.stopPropagation();
});
refresh();
return refresh;
}
function attachDefaultMenu(node, wrap, linkage, comp, refresh) {
onRightClick(node, function (event) {
if (isGatedNode(wrap)) return;
var mod = findMod(linkage);
var defaults = (mod && mod.defaults) || {};
var value = defaults[comp.varName];
var known = value !== undefined && value !== null;
var current = values[linkage][comp.varName];
showContextMenu(event.clientX, event.clientY, [
{
label: plainText(loc.buttonDefault || 'Default'),
enabled: known && !valueEquals(current, value),
onClick: function () {
values[linkage][comp.varName] = value;
refresh();
onControlChanged(linkage, comp.varName, comp);
},
},
]);
});
}
function renderSlider(wrap, linkage, comp, stepMode) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var box = el('div', 'mm-slider', wrap);
var track = el('div', 'mm-slider-track', box);
el('div', 'mm-slider-rail', track);
var fill = el('div', 'mm-slider-fill', track);
var knob = el('div', 'mm-slider-knob', track);
var valueNode = el('div', 'mm-slider-value', box);
var options = comp.options || [];
var min = stepMode ? 0 : Number(comp.minimum) || 0;
var max = stepMode ? Math.max(0, options.length - 1) : Number(comp.maximum) || 100;
var interval = stepMode ? 1 : Number(comp.snapInterval) || 1;
var format = comp.format || '{{value}}';
var dragging = false;
var display = function (value) {
if (stepMode) {
var option = options[Number(value) || 0];
return option ? plainText(option.label) : String(value);
}
return formatValue(format, value);
};
var lastPercent = -1;
var lastText = null;
var refresh = function () {
var value = Number(values[linkage][comp.varName]) || 0;
var span = max - min || 1;
var percent = Math.max(0, Math.min(1, (value - min) / span)) * 100;
if (percent !== lastPercent) {
fill.style.width = percent + '%';
knob.style.left = percent + '%';
lastPercent = percent;
}
var text = display(value);
if (text !== lastText) {
valueNode.textContent = text;
lastText = text;
}
};
var setFromEvent = function (event) {
var rect = rootRelativeRect(track);
var width = rect.width || (track.clientWidth / (getScale() || 1)) || 200;
var ratio = Math.max(0, Math.min(1, (pointerIn(event).x - rect.left) / width));
var raw = min + ratio * (max - min);
var snapped = Math.round(raw / interval) * interval;
snapped = Number(snapped.toFixed(6));
if (snapped < min) snapped = min;
if (snapped > max) snapped = max;
if (snapped !== values[linkage][comp.varName]) {
values[linkage][comp.varName] = snapped;
refresh();
onControlChanged(linkage, comp.varName, comp);
}
};
var nudge = function (steps) {
if (isGatedNode(wrap)) return;
var value = Number(values[linkage][comp.varName]) || 0;
var next = Number((value + steps * interval).toFixed(6));
if (next < min) next = min;
if (next > max) next = max;
if (next === value) return;
values[linkage][comp.varName] = next;
refresh();
onControlChanged(linkage, comp.varName, comp);
};
track.addEventListener('mousedown', function (event) {
if (isGatedNode(wrap)) return;
dragging = true;
setFromEvent(event);
});
document.addEventListener('mousemove', function (event) {
if (dragging) setFromEvent(event);
});
document.addEventListener('mouseup', function () { dragging = false; });
var wheelEnteredAt = 0;
box.addEventListener('wheel', function (event) {
if (tooltipWheel(event)) return;
if (!wheelOwnedByControl(wheelEnteredAt)) return;
var delta = Number(event.deltaY);
if (!delta) delta = -Number(event.wheelDelta || 0);
nudge(delta > 0 ? 1 : -1);
event.preventDefault();
event.stopPropagation();
});
box.addEventListener('mouseenter', function () {
wheelEnteredAt = Date.now();
hoveredNudge = nudge;
});
box.addEventListener('mouseleave', function () {
if (hoveredNudge === nudge) hoveredNudge = null;
});
attachDefaultMenu(box, wrap, linkage, comp, refresh);
refresh();
return refresh;
}
function renderRangeSlider(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var box = el('div', 'mm-stepper', wrap);
var min = Number(comp.minimum) || 0;
var max = Number(comp.maximum) || 100;
var refresh = function () {};
var makeSide = function (index) {
var minus = el('div', 'mm-stepper-btn mm-stepper-btn-minus', box);
stepperSign(minus, false);
var valueNode = el('input', 'mm-stepper-value', box);
valueNode.type = 'text';
var plus = el('div', 'mm-stepper-btn mm-stepper-btn-plus', box);
stepperSign(plus, true);
plus.style.marginRight = '10rem';
var read = function () {
var pair = values[linkage][comp.varName] || [min, max];
var text = String(pair[index]);
if (valueNode.value !== text) valueNode.value = text;
};
valueNode.addEventListener('input', function () {
var cleaned = String(valueNode.value).replace(/[^0-9.,-]/g, '');
if (cleaned !== valueNode.value) valueNode.value = cleaned;
});
var commitTyped = function () {
if (isGatedNode(wrap)) { read(); return; }
var typed = parseFloat(String(valueNode.value).replace(',', '.'));
if (!isFinite(typed)) { read(); return; }
var pair = (values[linkage][comp.varName] || [min, max]).slice();
pair[index] = Math.max(min, Math.min(max, typed));
if (pair[0] > pair[1]) pair[index === 0 ? 0 : 1] = pair[index === 0 ? 1 : 0];
values[linkage][comp.varName] = pair;
refreshAll();
onControlChanged(linkage, comp.varName, comp);
};
valueNode.addEventListener('change', commitTyped);
valueNode.addEventListener('blur', commitTyped);
var bump = function (delta) {
if (isGatedNode(wrap)) return;
var pair = (values[linkage][comp.varName] || [min, max]).slice();
pair[index] = Math.max(min, Math.min(max, Number(pair[index]) + delta));
if (index === 0 && pair[0] > pair[1]) pair[0] = pair[1];
if (index === 1 && pair[1] < pair[0]) pair[1] = pair[0];
values[linkage][comp.varName] = pair;
refreshAll();
onControlChanged(linkage, comp.varName, comp);
};
bindHoldRepeat(minus, function () { bump(-(Number(comp.snapInterval) || 1)); });
bindHoldRepeat(plus, function () { bump(Number(comp.snapInterval) || 1); });
return read;
};
var readers = [makeSide(0), makeSide(1)];
var refreshAll = function () { readers[0](); readers[1](); };
refresh = refreshAll;
attachDefaultMenu(box, wrap, linkage, comp, refreshAll);
refreshAll();
return refresh;
}
var previewRequests = {};
var PREVIEW_DELAY = 400;
function previewKey(linkage, varName) {
return linkage + '|' + varName;
}
var previewTokenWarned = {};
function reportPreviewToken(linkage, varName, got, want) {
var key = previewKey(linkage, varName);
if (previewTokenWarned[key]) return;
previewTokenWarned[key] = true;
uiLog('jserror input preview for ' + key + ' answered with token ' + got +
' while ' + want + ' was asked - the answer was dropped. Pass the token' +
' straight back from the handler, unchanged.');
}
var lastPreview = {};
function applyInputPreview(linkage, args) {
var pending = previewRequests[previewKey(linkage, args.varName)];
if (!pending || !pending.node) return;
if (args.token !== pending.token) {
reportPreviewToken(linkage, args.varName, args.token, pending.token);
return;
}
var content = args.content == null ? '' : args.content;
lastPreview[previewKey(linkage, args.varName)] = content;
if (pending.node.mmShown === content) return;
pending.node.mmShown = content;
setLabel(pending.node, content, true);
var remeasure = function () {
var opts = document.getElementById('mm-opts');
if (opts) applyColumnSpans(opts);
};
afterTwoFrames(function () {
remeasure();
window.setTimeout(remeasure, 60);
});
}
var WHEEL_ARM_MS = 350;
var WHEEL_STREAK_MS = 450;
var lastPageWheelAt = 0;
function notePageWheel() {
lastPageWheelAt = Date.now();
}
function wheelOwnedByControl(enteredAt) {
if (!enteredAt) return false;
var now = Date.now();
if (now - lastPageWheelAt < WHEEL_STREAK_MS) return false;
return (now - enteredAt) >= WHEEL_ARM_MS;
}
function renderTextInput(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var multi = !!comp.textArea;
var previewBox = null;
var previewBody = null;
var firstPreview = null;
if (comp.hasPreview) {
previewBox = el('div', 'mm-preview', wrap);
var head = el('div', 'mm-preview-head', previewBox);
var caption = el('div', 'mm-preview-title', head);
caption.textContent = plainText(loc.previewTitle || 'Preview');
var toggle = el('div', 'mm-preview-toggle', head);
previewBody = el('div', 'mm-preview-body', previewBox);
var seen = lastPreview[previewKey(linkage, comp.varName)];
if (seen !== undefined) {
previewBody.mmShown = seen;
setLabel(previewBody, seen, true);
} else if (comp.previewSeed) {
previewBody.mmShown = comp.previewSeed;
setLabel(previewBody, comp.previewSeed, true);
}
var shown = true;
var applyShown = function () {
previewBody.style.display = shown ? 'flex' : 'none';
toggle.textContent = shown ? '–' : '+';
};
toggle.addEventListener('click', function () {
shown = !shown;
applyShown();
});
applyShown();
}
var input = el(multi ? 'textarea' : 'input', multi ? 'mm-input mm-textarea' : 'mm-input', wrap);
if (multi) {
var rows = Number(comp.textRows) || 4;
input.rows = rows;
if (comp.textColumns) input.cols = Number(comp.textColumns);
input.setAttribute('data-mm-rows', rows);
sizeTextArea(input);
} else {
input.type = 'text';
}
if (comp.width) input.style.width = comp.width + 'rem';
if (comp.maxLength) input.maxLength = Number(comp.maxLength);
if (comp.monospace) input.className += ' mm-mono';
var converts = !!(comp.convertNLtoBR && comp.valueIsHTML);
var toField = function (stored) {
var text = String(stored == null ? '' : stored);
return converts ? text.replace(/<br\s*\/?>/gi, '\n') : text;
};
var fromField = function (typed) {
var text = String(typed == null ? '' : typed);
return converts ? text.replace(/\r\n/g, '\n').replace(/\n/g, '<br>') : text;
};
var lineCap = Number(comp.textColumns) || 0;
if (lineCap) {
input.addEventListener('input', function () {
var prev = String(input.mmLastGood == null ? '' : input.mmLastGood);
var lines = String(input.value).split('\n');
var prevLines = prev.split('\n');
var refused = false;
for (var i = 0; i < lines.length; i += 1) {
if (lines[i].length <= lineCap) continue;
var was = i < prevLines.length ? prevLines[i].length : 0;
if (lines[i].length > Math.max(lineCap, was)) { refused = true; break; }
}
if (!refused) {
input.mmLastGood = input.value;
return;
}
var caret = Number(input.selectionStart) || 0;
var removed = input.value.length - prev.length;
input.value = prev;
try {
var at = Math.max(0, caret - removed);
input.setSelectionRange(at, at);
} catch (error) {
}
});
}
var refresh = function () {
input.value = toField(values[linkage][comp.varName]);
input.mmLastGood = input.value;
if (firstPreview) firstPreview();
};
if (previewBox) {
var previewTimer = 0;
var previewSeq = 0;
var askPreview = function () {
previewSeq += 1;
previewRequests[previewKey(linkage, comp.varName)] = {
token: previewSeq, node: previewBody,
};
jsonCommand('inputPreviewRequest', {
linkage: linkage, varName: comp.varName,
text: fromField(input.value), token: previewSeq,
});
};
var schedulePreview = function () {
if (previewTimer) window.clearTimeout(previewTimer);
previewTimer = window.setTimeout(askPreview, PREVIEW_DELAY);
};
input.addEventListener('input', schedulePreview);
firstPreview = askPreview;
}
input.addEventListener('change', function () {
if (isGatedNode(wrap)) return;
values[linkage][comp.varName] = fromField(input.value);
onControlChanged(linkage, comp.varName, comp);
});
input.addEventListener('input', function () {
var typed = fromField(input.value);
if (valueEquals(values[linkage][comp.varName], typed)) return;
values[linkage][comp.varName] = typed;
onControlEdited(linkage, comp.varName);
});
if (multi) {
input.addEventListener('keydown', function (event) {
if (event.keyCode === 13) event.stopPropagation();
});
}
refresh();
return refresh;
}
function renderStepper(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var box = el('div', 'mm-stepper', wrap);
var minus = el('div', 'mm-stepper-btn mm-stepper-btn-minus', box);
stepperSign(minus, false);
var valueNode = el('input', 'mm-stepper-value', box);
valueNode.type = 'text';
var plus = el('div', 'mm-stepper-btn mm-stepper-btn-plus', box);
stepperSign(plus, true);
var min = Number(comp.minimum) || 0;
var max = Number(comp.maximum) || 100;
var interval = Number(comp.snapInterval) || 1;
var refresh = function () {
var text = String(values[linkage][comp.varName]);
if (valueNode.value !== text) valueNode.value = text;
};
valueNode.addEventListener('input', function () {
var cleaned = String(valueNode.value).replace(/[^0-9.,-]/g, '');
if (cleaned !== valueNode.value) valueNode.value = cleaned;
});
var commitTyped = function () {
if (isGatedNode(wrap)) { refresh(); return; }
var typed = parseFloat(String(valueNode.value).replace(',', '.'));
if (!isFinite(typed)) { refresh(); return; }
var steps = Math.round((typed - min) / interval);
var value = Number((min + steps * interval).toFixed(6));
value = Math.max(min, Math.min(max, value));
if (value === values[linkage][comp.varName]) { refresh(); return; }
values[linkage][comp.varName] = value;
refresh();
onControlChanged(linkage, comp.varName, comp);
};
valueNode.addEventListener('change', commitTyped);
valueNode.addEventListener('blur', commitTyped);
valueNode.addEventListener('keydown', function (event) {
if (event.keyCode === 13) { commitTyped(); try { valueNode.blur(); } catch (e) {} }
});
var bump = function (delta) {
if (isGatedNode(wrap)) return;
var value = Number(values[linkage][comp.varName]) || 0;
value = Math.max(min, Math.min(max, value + delta));
values[linkage][comp.varName] = value;
refresh();
onControlChanged(linkage, comp.varName, comp);
};
bindHoldRepeat(minus, function () { bump(-interval); });
bindHoldRepeat(plus, function () { bump(interval); });
attachDefaultMenu(box, wrap, linkage, comp, refresh);
refresh();
return refresh;
}
function hotkeyData(linkage, varName, comp) {
var byMod = hotkeys[linkage] || {};
return byMod[varName] || comp.hotkey || {text: '', isEmpty: true};
}
function renderHotkey(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var box = el('div', 'mm-hotkey', row);
var refresh = function () {
clearNode(box);
var data = hotkeyData(linkage, comp.varName, comp);
var cls = 'mm-hotkey';
if (data.isAccepting) cls += ' mm-accepting';
if (data.isEmpty) cls += ' mm-empty';
box.className = cls;
var parts = [];
if (data.modifierCtrl) parts.push('CTRL');
if (data.modifierAlt) parts.push('ALT');
if (data.modiferShift) parts.push('SHIFT');
parts.push(data.isAccepting ? '...' : (data.text || '—'));
for (var i = 0; i < parts.length; i += 1) {
var key = el('div', 'mm-key', box);
key.textContent = parts[i];
}
};
box.addEventListener('click', function () {
if (isGatedNode(wrap)) return;
var data = hotkeyData(linkage, comp.varName, comp);
var action = data.isAccepting ? 'stopAccept' : 'startAccept';
acceptingHotkey = data.isAccepting ? null : {linkage: linkage, varName: comp.varName};
jsonCommand('hotkeyAction', {linkage: linkage, varName: comp.varName, action: action});
});
onRightClick(box, function (event) {
if (isGatedNode(wrap)) return;
var data = hotkeyData(linkage, comp.varName, comp);
showContextMenu(event.clientX, event.clientY, [
{label: plainText(loc.buttonDefault || 'Default'), onClick: function () {
jsonCommand('hotkeyAction', {linkage: linkage, varName: comp.varName, action: 'default'});
}},
{label: plainText(loc.buttonClear || 'Clear'), enabled: !data.isEmpty, onClick: function () {
jsonCommand('hotkeyAction', {linkage: linkage, varName: comp.varName, action: 'clear'});
}},
]);
});
refresh();
return refresh;
}
var RGBA_RE = /^[0-9a-fA-F]{8}$/;
function wantsAlpha(comp, bareValue) {
return !!comp.alpha || RGBA_RE.test(String(bareValue || '').replace('#', ''));
}
function withHashConvention(oldValue, bareHex) {
return (String(oldValue || '').charAt(0) === '#' ? '#' : '') + bareHex;
}
function colorSwatchMenu(event, linkage, comp, getBare) {
var mod = findMod(linkage);
var defaults = (mod && mod.defaults) || {};
var hasDefault = defaults[comp.varName] !== undefined && defaults[comp.varName] !== null;
showContextMenu(event.clientX, event.clientY, [
{label: plainText(loc.buttonDefault || 'Default'), enabled: hasDefault, onClick: function () {
jsonCommand('colorAction', {action: 'reset', linkage: linkage, varName: comp.varName});
}},
{label: plainText(loc.presetCopyHex || 'Copy hex code'), enabled: !!getBare(), onClick: function () {
jsonCommand('colorAction', {action: 'copyhex', value: getBare()});
}},
]);
}
function renderColorChoice(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
setLabel(el('div', 'mm-comp-label', row), comp.text, comp.useHTML);
var box = el('div', 'mm-colorbox', row);
var swatch = el('div', 'mm-swatch', box);
var input = el('input', 'mm-hex-input', box);
input.type = 'text';
var bare = function () {
return String(values[linkage][comp.varName] || '').replace('#', '');
};
var applyBare = function (hex) {
values[linkage][comp.varName] = withHashConvention(values[linkage][comp.varName], hex);
refresh();
onControlChanged(linkage, comp.varName, comp);
};
var refresh = function () {
var stored = String(values[linkage][comp.varName] || '');
var color = normColor(stored);
swatch.style.background = '#' + color.replace('#', '').slice(0, 6) || '#000000';
input.value = color;
};
input.addEventListener('change', function () {
if (isGatedNode(wrap)) return;
var raw = String(input.value).trim().replace('#', '');
if (/^[0-9a-fA-F]{6}$/.test(raw) || RGBA_RE.test(raw)) applyBare(raw.toLowerCase());
else refresh();
});
swatch.addEventListener('mousedown', function (event) {
if (event.button !== 0 || isGatedNode(wrap)) return;
openColorPicker({
title: plainText(comp.text) || plainText(loc.popupColor || 'COLOR'),
initial: bare(),
presets: comp.presets,
presetsOnly: !!comp.presetsOnly,
alpha: wantsAlpha(comp, bare()),
onApply: applyBare,
});
event.stopPropagation();
});
onRightClick(swatch, function (event) {
if (isGatedNode(wrap)) return;
colorSwatchMenu(event, linkage, comp, bare);
});
refresh();
return refresh;
}
function renderCheckboxColor(wrap, linkage, comp) {
var row = el('div', 'mm-comp-row', wrap);
var label = el('div', 'mm-comp-label', row);
setLabel(label, comp.text, comp.useHTML);
var box = el('div', 'mm-colorbox', row);
var sw = el('div', 'mm-switch', box);
el('div', 'mm-switch-knob', sw);
var swatch = el('div', 'mm-swatch', box);
var input = el('input', 'mm-hex-input', box);
input.type = 'text';
var current = function () {
var value = values[linkage][comp.varName];
if (!value || typeof value !== 'object') value = {enabled: false, color: 'ffffff'};
return value;
};
var refresh = function () {
var value = current();
sw.className = value.enabled ? 'mm-switch mm-on' : 'mm-switch';
var color = normColor(value.color);
swatch.style.background = '#' + color.replace('#', '').slice(0, 6) || '#000000';
input.value = color;
};
var applyBare = function (hex) {
var value = current();
values[linkage][comp.varName] = {
enabled: value.enabled,
color: withHashConvention(value.color, hex),
};
refresh();
onControlChanged(linkage, comp.varName, comp);
};
sw.addEventListener('click', function () {
if (isGatedNode(wrap)) return;
var value = current();
values[linkage][comp.varName] = {enabled: !value.enabled, color: value.color};
refresh();
onControlChanged(linkage, comp.varName, comp);
});
input.addEventListener('change', function () {
if (isGatedNode(wrap)) return;
var raw = String(input.value).trim().replace('#', '');
if (/^[0-9a-fA-F]{6}$/.test(raw) || RGBA_RE.test(raw)) applyBare(raw.toLowerCase());
else refresh();
});
swatch.addEventListener('mousedown', function (event) {
if (event.button !== 0 || isGatedNode(wrap)) return;
openColorPicker({
title: plainText(comp.text) || plainText(loc.popupColor || 'COLOR'),
initial: String(current().color || '').replace('#', ''),
presets: comp.presets,
presetsOnly: !!comp.presetsOnly,
alpha: wantsAlpha(comp, String(current().color || '')),
onApply: applyBare,
});
event.stopPropagation();
});
onRightClick(swatch, function (event) {
if (isGatedNode(wrap)) return;
colorSwatchMenu(event, linkage, comp, function () {
return String(current().color || '').replace('#', '');
});
});
refresh();
return refresh;
}
var TITLE_BLOCK_MIN = 220;
var TITLE_BLOCK_MAX = 420;
var imageRegistry = {};
var modIcons = {};
function imageUrl(source) {
var s = String(source || '');
if (s.indexOf('mm-img://') === 0) return imageRegistry[s] || '';
if (s.indexOf('img://') === 0) s = s.slice(6);
if (!s) return '';
if (s.indexOf('data:') === 0) return s;
if (s.indexOf('coui://') === 0 || s.indexOf('file://') === 0) return s;
s = s.replace(/\\/g, '/').replace(/^\/+/, '');
if (/^[A-Za-z]:\//.test(s)) return encodeURI('file:///' + s);
if (s.indexOf('gui/') === 0) return 'coui://' + s;
var dir = String(payload && payload.gameDir || '').replace(/\/+$/, '');
if (dir) return encodeURI('file:///' + dir + '/' + s);
return 'coui://' + s;
}
var atlasTimers = [];
function clearAtlasTimers() {
for (var i = 0; i < atlasTimers.length; i += 1) atlasTimers[i]();
atlasTimers.length = 0;
}
function renderAtlas(host, atlas) {
var scale = 1;
if (atlas.width || atlas.height) {
var sx = atlas.width ? atlas.width / atlas.frameWidth : Infinity;
var sy = atlas.height ? atlas.height / atlas.frameHeight : Infinity;
scale = Math.min(sx, sy);
if (!isFinite(scale) || scale <= 0) scale = 1;
}
var frameW = Math.round(atlas.frameWidth * scale);
var frameH = Math.round(atlas.frameHeight * scale);
var rows = Math.ceil(atlas.count / atlas.columns);
var viewport = el('div', 'mm-atlas', host);
viewport.style.width = frameW + 'rem';
viewport.style.height = frameH + 'rem';
var sheet = el('img', 'mm-atlas-img', viewport);
sheet.src = imageUrl(atlas.atlasSrc);
sheet.style.width = (atlas.columns * frameW) + 'rem';
sheet.style.height = (rows * frameH) + 'rem';
var frame = 0;
var applyFrame = function () {
var col = frame % atlas.columns;
var row = Math.floor(frame / atlas.columns);
sheet.style.transform =
'translate(' + (-col * frameW) + 'rem, ' + (-row * frameH) + 'rem)';
};
var fps = Number(atlas.fps) > 0 ? Number(atlas.fps) : 12;
var stepMs = 1000 / fps;
var alive = true;
var lastTs = 0;
var acc = 0;
var loop = function (ts) {
if (!alive) return;
ts = typeof ts === 'number' ? ts : Date.now();
if (!lastTs) lastTs = ts;
acc += ts - lastTs;
lastTs = ts;
var advanced = false;
while (acc >= stepMs) {
acc -= stepMs;
frame += 1;
if (frame >= atlas.count) frame = atlas.loop ? 0 : atlas.count - 1;
advanced = true;
}
if (advanced) applyFrame();
window.requestAnimationFrame(loop);
};
applyFrame();
window.requestAnimationFrame(loop);
var stop = function () {
alive = false;
if (viewport.parentNode) viewport.parentNode.removeChild(viewport);
};
atlasTimers.push(stop);
return stop;
}
var fittedReported = {};
var imageFits = [];
var imageFitPass = 0;
function runImageFits() {
var token = ++imageFitPass;
var attempt = function (left) {
if (token !== imageFitPass) return;
var pending = false;
for (var i = 0; i < imageFits.length; i += 1) {
if (!imageFits[i]()) pending = true;
}
if (pending && left > 0) {
window.requestAnimationFrame(function () { attempt(left - 1); });
}
};
window.requestAnimationFrame(function () { attempt(300); });
}
function clearImageFitted(frame) {
var hosts = [frame];
if (frame.parentNode) hosts.push(frame.parentNode);
var boxNode = frame.parentNode && frame.parentNode.parentNode
? frame.parentNode.parentNode.parentNode : null;
if (boxNode) hosts.push(boxNode);
for (var i = 0; i < hosts.length; i += 1) {
var badges = hosts[i].getElementsByClassName('mm-image-fit');
while (badges.length) badges[0].parentNode.removeChild(badges[0]);
}
}
var modErrors = {};
function renderModErrorBar(linkage) {
var existing = document.getElementById('mm-warnbar');
if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
var store = linkage ? modErrors[linkage] : null;
if (!store) return;
var seenVars = {};
var firstError = '';
for (var where in store) {
if (!store.hasOwnProperty(where)) continue;
var entry = store[where];
if (!firstError) firstError = String(entry.error || '');
if (entry.varName) seenVars[entry.varName] = true;
}
var vars = [];
for (var name in seenVars) {
if (seenVars.hasOwnProperty(name)) vars.push(name);
}
var detail = document.getElementById('mm-detail');
var optsWrap = detail.getElementsByClassName('mm-opts-wrap')[0];
var bar = el('div', 'mm-warnbar');
bar.id = 'mm-warnbar';
detail.insertBefore(bar, optsWrap);
var title = el('div', 'mm-warnbar-title', bar);
title.textContent = plainText(loc.modErrorTitle || 'This mod reported an error');
var body = el('div', 'mm-warnbar-body', bar);
body.textContent = plainText(loc.modErrorSafe || 'Your settings are safe and still apply.') + ' ' +
plainText(loc.modErrorFailed || "One of this mod's own actions failed - some of its features may not respond.") + ' ' +
plainText(loc.modErrorReport || "Report this to the mod's author, not to the modpack.");
var tech = el('div', 'mm-warnbar-tech', bar);
tech.textContent = vars.length === 1 ? vars[0] + ' - ' + firstError : firstError;
}
function pictureAspect(comp) {
var w = Number(comp.liveNaturalWidth || comp.naturalWidth) || 0;
var h = Number(comp.liveNaturalHeight || comp.naturalHeight) || 0;
return (w > 0 && h > 0) ? {w: w, h: h} : null;
}
function setPictureSize(pic, comp, widthRem, heightRem) {
if (!pic) return;
var a = pictureAspect(comp);
var w = Number(widthRem) > 0 ? Math.floor(widthRem) : 0;
var h = Number(heightRem) > 0 ? Math.floor(heightRem) : 0;
if (!w && !h) {
if (!a) return;
w = a.w;
}
if (a) {
var f = Math.min(w ? w / a.w : Infinity, h ? h / a.h : Infinity);
if (!isFinite(f) || f <= 0) f = 1;
w = Math.max(1, Math.round(a.w * f));
h = Math.max(1, Math.round(a.h * f));
}
pic.style.width = w ? w + 'rem' : '';
pic.style.height = h ? h + 'rem' : '';
}
function markImageFitted(linkage, comp, frame, declaredW, fittedW, ownSource, labelHost) {
frame.mmFitFrom = declaredW;
frame.mmFitTo = fittedW;
frame.mmFitOwn = !!ownSource;
var host = labelHost || frame;
if (labelHost) labelHost.style.display = 'flex';
if (!host.getElementsByClassName('mm-image-fit').length) {
var badge = el('div', 'mm-image-fit', host);
el('div', 'mm-image-fit-bar', badge);
el('div', 'mm-image-fit-dot', badge);
attachTooltip(badge, function () {
var head = frame.mmFitOwn
? (loc.imageFitted || 'Image scaled down')
: (loc.imageFittedWindow || 'Scaled down to fit the window');
return '{HEADER}' + plainText(head) +
'{/HEADER}{BODY}' + frame.mmFitFrom + ' > ' + frame.mmFitTo + ' px{/BODY}';
});
}
var token = linkage + '|' + (comp.varName || comp.source || comp.src || '') +
'|' + declaredW + '|' + fittedW + '|' + (ownSource ? 'own' : 'win');
if (fittedReported[token]) return;
fittedReported[token] = true;
jsonCommand('imageFitted', {
linkage: linkage,
ownSource: !!ownSource,
varName: comp.varName || null,
source: String(comp.source || comp.src || (comp.atlas && comp.atlas.source) || ''),
requested: declaredW,
fitted: fittedW,
});
}
function renderImage(wrap, linkage, comp) {
var fitSlot = imageFits.length;
imageFits.push(function () { return true; });
var box = el('div', 'mm-image-box', wrap);
var labelNode = el('div', 'mm-image-label', box);
var media = el('div', 'mm-image-media', box);
var stopAtlas = null;
var refresh = function () {
if (stopAtlas) {
stopAtlas();
stopAtlas = null;
}
clearNode(media);
var url = imageUrl(comp.liveSource || comp.source || comp.src);
var templateAtlas = comp.atlas && comp.atlas.source ? comp.atlas : null;
var wantW = comp.liveSource ? (Number(comp.liveWidth) || 0) : (Number(comp.width) || 0);
var wantH = comp.liveSource ? (Number(comp.liveHeight) || 0) : (Number(comp.height) || 0);
if (comp.collapsed || (!url && !comp.atlasLive && !templateAtlas)) {
box.style.display = 'none';
return;
}
box.style.display = 'flex';
media.style.justifyContent = comp.align === 'left' ? 'flex-start'
: (comp.align === 'right' ? 'flex-end' : 'center');
box.style.alignItems = media.style.justifyContent;
media.style.alignItems = comp.valign === 'top' ? 'flex-start'
: (comp.valign === 'bottom' ? 'flex-end' : 'center');
var anchor = el('div', 'mm-image-anchor', media);
var frame = el('div', 'mm-image-frame', anchor);
frame.style.justifyContent = media.style.justifyContent;
frame.style.alignItems = media.style.alignItems;
var boxW = comp.containerWidth || comp.width;
var boxH = comp.containerHeight || comp.height;
if (comp.autoFit && !boxW && !boxH) {
boxW = Number(comp.liveNaturalWidth || comp.naturalWidth) || 0;
boxH = Number(comp.liveNaturalHeight || comp.naturalHeight) || 0;
}
if (boxW) frame.style.width = boxW + 'rem';
if (boxH) frame.style.height = boxH + 'rem';
if (comp.atlasLive) {
stopAtlas = renderAtlas(frame, comp.atlasLive);
} else if (templateAtlas) {
stopAtlas = renderAtlas(frame, {
atlasSrc: templateAtlas.source,
frameWidth: templateAtlas.frameWidth,
frameHeight: templateAtlas.frameHeight,
columns: templateAtlas.columns,
count: templateAtlas.count,
fps: templateAtlas.fps,
loop: templateAtlas.loop !== false,
width: comp.width,
height: comp.height,
});
} else {
var known = pictureAspect(comp);
var img = known ? el('div', 'mm-image', frame)
: el('img', 'mm-image mm-image-raw', frame);
if (known) img.style.backgroundImage = "url('" + url + "')";
else img.src = url;
if (!wantW && !wantH) {
var headW0 = Number(comp.liveNaturalWidth || comp.naturalWidth) || 0;
var headH0 = Number(comp.liveNaturalHeight || comp.naturalHeight) || 0;
if (headW0 && headH0) {
var baseW = boxW ? Math.min(headW0, Number(boxW)) : headW0;
img.style.width = Math.floor(baseW) + 'rem';
img.style.height = Math.round(baseW * headH0 / headW0) + 'rem';
}
}
if (wantW || wantH) setPictureSize(img, comp, wantW, wantH);
if (!wantW && !boxW) {
var clampNatural = function () {
window.requestAnimationFrame(function () {
if (!img.parentNode || !wrap.parentNode) return;
var kn = getScale() || 1;
var availN = (Number(wrap.parentNode.clientWidth) || 0) / kn - 16;
var naturalW = Number(comp.liveNaturalWidth || comp.naturalWidth) ||
((Number(img.offsetWidth) || 0) / kn);
if (availN > 20 && naturalW > availN + 1) {
setPictureSize(img, comp, availN);
markImageFitted(linkage, comp, frame, Math.round(naturalW), Math.floor(availN),
false, labelNode);
}
});
};
img.addEventListener('load', clampNatural);
clampNatural();
}
}
var atlasWidth = Number(comp.atlasLive ? comp.atlasLive.width : comp.width) || 0;
var atlasSource = comp.atlasLive || (templateAtlas ? {
atlasSrc: templateAtlas.source,
frameWidth: templateAtlas.frameWidth,
frameHeight: templateAtlas.frameHeight,
columns: templateAtlas.columns,
count: templateAtlas.count,
fps: templateAtlas.fps,
loop: templateAtlas.loop !== false,
} : null);
var sizeAtlas = function (width) {
if (!stopAtlas || !atlasSource || atlasWidth === width) return;
atlasWidth = width;
stopAtlas();
var scaled = {};
for (var key in atlasSource) {
if (atlasSource.hasOwnProperty(key)) scaled[key] = atlasSource[key];
}
if (width) {
scaled.width = width;
scaled.height = undefined;
}
stopAtlas = renderAtlas(frame, scaled);
};
imageFits[fitSlot] = function () {
if (!wrap.parentNode || !frame.parentNode) return false;
var k = getScale() || 1;
var avail = (Number(wrap.parentNode.clientWidth) || 0) / k - 16;
if (avail <= 20) return false;
if (boxW) avail = Math.min(avail, Number(boxW));
var pic = frame.getElementsByClassName('mm-image')[0];
if (boxW) frame.style.width = boxW + 'rem';
if (boxH) frame.style.height = boxH + 'rem';
if (pic && (wantW || wantH)) {
pic.style.width = wantW ? wantW + 'rem' : '';
pic.style.height = wantH ? wantH + 'rem' : '';
}
var declaredW = Number(boxW) || wantW;
if (!declaredW && comp.atlasLive) {
declaredW = Number(comp.atlasLive.width) || Number(comp.atlasLive.frameWidth) || 0;
} else if (!declaredW && templateAtlas) {
declaredW = Number(templateAtlas.frameWidth) || 0;
}
if (!declaredW) {
if (!pic) return true;
var headNat = pictureAspect(comp);
var naturalW = headNat ? headNat.w : ((Number(pic.offsetWidth) || 0) / k);
if (naturalW <= 0) return false;
if (naturalW > avail + 1) {
setPictureSize(pic, comp, avail);
markImageFitted(linkage, comp, frame, Math.round(naturalW), Math.floor(avail),
false, labelNode);
} else {
clearImageFitted(frame);
}
return true;
}
if (declaredW <= avail) {
sizeAtlas(Number(comp.width) || 0);
var ownW = 0;
if (pic && !wantW) {
var own = pictureAspect(comp);
ownW = own ? own.w : ((Number(pic.offsetWidth) || 0) / k);
}
if (pic && ownW > declaredW + 1) {
setPictureSize(pic, comp, declaredW);
markImageFitted(linkage, comp, frame,
Math.round(ownW), Math.floor(declaredW), true, labelNode);
return true;
}
clearImageFitted(frame);
return true;
}
var fittedW = Math.floor(avail);
var factor = avail / declaredW;
if (boxW) {
frame.style.width = fittedW + 'rem';
labelNode.style.width = fittedW + 'rem';
}
if (boxW && boxH) frame.style.height = Number(boxH) + 'rem';
var sourceKey = String(comp.liveSource || comp.source || comp.src || '');
var head = pictureAspect(comp);
if (pic && head) {
pic.mmNaturalW = head.w;
pic.mmNaturalH = head.h;
pic.mmMeasuredFor = sourceKey;
} else if (pic) {
if (pic.mmMeasuredFor !== sourceKey) {
pic.mmNaturalW = 0;
pic.mmNaturalH = 0;
pic.mmMeasuredFor = sourceKey;
}
if (!pic.mmNaturalW || !pic.mmNaturalH) {
var mw = (Number(pic.offsetWidth) || 0) / k;
var mh0 = (Number(pic.offsetHeight) || 0) / k;
if (mw > 0 && mh0 > 0) {
pic.mmNaturalW = mw;
pic.mmNaturalH = mh0;
} else {
return false;
}
}
}
var pictureW = wantW || Number(comp.liveNaturalWidth || comp.naturalWidth) ||
(pic ? pic.mmNaturalW : 0);
if (!pictureW) return false;
var pictureTooWide = pictureW > avail + 1;
if (!pictureTooWide) {
if (pic) {
if (wantW || wantH) {
setPictureSize(pic, comp, wantW, wantH);
} else {
var back = pictureAspect(comp);
if (back) {
setPictureSize(pic, comp,
boxW ? Math.min(back.w, Number(boxW)) : back.w);
}
}
}
if (stopAtlas) sizeAtlas(Number(comp.width) || 0);
clearImageFitted(frame);
return true;
}
if (stopAtlas) {
sizeAtlas(fittedW);
} else if (pic) {
setPictureSize(pic, comp, avail);
}
markImageFitted(linkage, comp, frame, Math.round(pictureW), fittedW,
!!(boxW && pictureW > Number(boxW) + 1), labelNode);
return true;
};
if (comp.label) {
labelNode.style.display = 'flex';
if (boxW) labelNode.style.width = Number(boxW) + 'rem';
setLabel(labelNode, comp.label, comp.useHTML);
var align = comp.labelAlign === 'center' ? 'center'
: (comp.labelAlign === 'right' ? 'flex-end' : 'flex-start');
labelNode.style.justifyContent = align;
labelNode.style.alignItems = align;
labelNode.style.textAlign = comp.labelAlign === 'center' ? 'center'
: (comp.labelAlign === 'right' ? 'right' : 'left');
} else {
labelNode.style.display = 'none';
}
};
refresh();
return refresh;
}
var MOD_STYLE_PROPS = {
'color': true,
'background': true,
'background-color': true,
'border-color': true,
'border-top-color': true,
'border-right-color': true,
'border-bottom-color': true,
'border-left-color': true,
'outline-color': true,
'fill': true,
'stroke': true,
'opacity': true,
};
var MOD_STYLE_FORBIDDEN = /(^|[\s,>+~])(html|body|:root|\*)([\s,>+~]|$)|mm-window|mm-header|mm-footer|mm-sidebar|mm-root|mm-backdrop|@import|@media|@font-face/i;
var MOD_STYLE_BAD_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|!important/i;
var modStyles = {};
var modStyleNode = null;
function sanitizeDeclarations(text) {
var kept = [];
var parts = String(text).split(';');
for (var i = 0; i < parts.length; i += 1) {
var colon = parts[i].indexOf(':');
if (colon < 0) continue;
var prop = parts[i].slice(0, colon).trim().toLowerCase();
var value = parts[i].slice(colon + 1).trim();
if (!MOD_STYLE_PROPS[prop]) continue;
if (!value || MOD_STYLE_BAD_VALUE.test(value)) continue;
kept.push(prop + ': ' + value);
}
return kept.join('; ');
}
function scopeSelector(selector, linkage) {
var one = selector.trim();
if (!one || MOD_STYLE_FORBIDDEN.test(one)) return null;
var isRowRule = /(^|[\s.])mm-row/.test(one);
var scope = isRowRule
? '.mm-row[data-linkage="' + linkage + '"]'
: '.mm-opts[data-mod="' + linkage + '"]';
if (isRowRule && /^\.mm-row($|[.:\s])/.test(one)) {
return scope + one.replace(/^\.mm-row/, '');
}
return scope + ' ' + one;
}
function sanitizeModCss(css, linkage) {
var out = [];
var text = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
var blocks = text.split('}');
for (var i = 0; i < blocks.length; i += 1) {
var open = blocks[i].indexOf('{');
if (open < 0) continue;
var selectors = blocks[i].slice(0, open).split(',');
var body = sanitizeDeclarations(blocks[i].slice(open + 1));
if (!body) continue;
var scoped = [];
for (var s = 0; s < selectors.length; s += 1) {
var one = scopeSelector(selectors[s], linkage);
if (one) scoped.push(one);
}
if (scoped.length) out.push(scoped.join(', ') + ' { ' + body + ' }');
}
return out.join('\n');
}
function applyModStyles() {
if (!modStyleNode) {
modStyleNode = document.createElement('style');
document.head.appendChild(modStyleNode);
}
var sheets = [];
for (var linkage in modStyles) {
if (!modStyles.hasOwnProperty(linkage) || !modStyles[linkage]) continue;
var scoped = sanitizeModCss(modStyles[linkage], linkage);
if (scoped) sheets.push(scoped);
}
modStyleNode.textContent = sheets.join('\n');
}
var DEFAULT_ACCENT = 'e0a248';
var DEFAULT_BACKGROUND = '171a1d';
var accentColor = DEFAULT_ACCENT;
var backgroundColor = DEFAULT_BACKGROUND;
var DEFAULT_PANEL_SCALE = 1;
var panelScale = DEFAULT_PANEL_SCALE;
var PANEL_SCALE_MIN = 0.7;
var PANEL_SCALE_MAX = 2.0;
var PANEL_SCALE_STEP = 0.1;
var gameScale = 1;
var fullScreen = false;
var windowTransparent = false;
var DEFAULT_BACKGROUND_ALPHA = 0.9;
var backgroundAlpha = DEFAULT_BACKGROUND_ALPHA;
var BACKGROUND_ALPHA_SIDE = 0.88;
var lookDirty = false;
var menuLanguage = 'auto';
var DEFAULT_MENU_FONT = 'default';
var menuFont = DEFAULT_MENU_FONT;
var CJK_FALLBACK = ', WarheliosJA, WarheliosKO, WarheliosZHCN, WarheliosZHTW';
var MENU_FONTS = {
'default': 'Warhelios' + CJK_FALLBACK,
'pfdinmax': 'PFDINMax' + CJK_FALLBACK,
};
function applyFont() {
var family = MENU_FONTS[menuFont] || MENU_FONTS['default'];
if (document.body) document.body.style.fontFamily = family;
}
function pickFont(key) {
menuFont = MENU_FONTS[key] ? key : 'default';
ddWidthCache = {};
applyFont();
saveMenuSettings();
}
var DEFAULT_FONT_SCALE = 1;
var fontScale = DEFAULT_FONT_SCALE;
var ALPHA_STEP = 5;
var ALPHA_MIN = 30;
var ALPHA_MAX = 95;
var FONT_SIZE_STEP = 0.05;
var FONT_SCALE_MIN = 0.8;
var FONT_SCALE_MAX = 1.6;
var FONT_SIZE_BASES = {
'10': 10, '11': 11, '115': 11.5, '12': 12, '125': 12.5,
'13': 13, '135': 13.5, '14': 14, '15': 15, '18': 18,
};
var LINE_HEIGHT_BASES = {
'12': 12, '14': 14, '15': 15, '16': 16, '18': 18, '20': 20,
'22': 22, '26': 26, '28': 28, '30': 30, '34': 34,
};
var TEXTAREA_LINE = 18;
var TEXTAREA_CHROME = 18;
function applyFontScale() {
ddWidthCache = {};
var css = document.documentElement.style;
var name;
for (name in FONT_SIZE_BASES) {
if (FONT_SIZE_BASES.hasOwnProperty(name)) {
css.setProperty('--mm-fs-' + name, (FONT_SIZE_BASES[name] * fontScale) + 'rem');
}
}
for (name in LINE_HEIGHT_BASES) {
if (LINE_HEIGHT_BASES.hasOwnProperty(name)) {
css.setProperty('--mm-lh-' + name, (LINE_HEIGHT_BASES[name] * fontScale) + 'rem');
}
}
var areas = document.getElementsByClassName('mm-textarea');
for (var i = 0; i < areas.length; i += 1) sizeTextArea(areas[i]);
}
function sizeTextArea(input) {
var rows = Number(input.getAttribute('data-mm-rows')) || 4;
var line = TEXTAREA_LINE * fontScale;
var box = (rows * line + TEXTAREA_CHROME) + 'rem';
input.style.lineHeight = line + 'rem';
input.style.height = box;
input.style.maxHeight = box;
}
function pickLanguage(code) {
menuLanguage = code || 'auto';
jsonCommand('setMenuLanguage', {code: menuLanguage});
}
var gearMenu = null;
function mixHex(hex, other, amount) {
var a = hexToRgb(hex) || {r: 94, g: 200, b: 216};
var b = other;
return rgbToHex(
Math.round(a.r * amount + b.r * (1 - amount)),
Math.round(a.g * amount + b.g * (1 - amount)),
Math.round(a.b * amount + b.b * (1 - amount)));
}
function mixWithBackdrop(hex, amount) {
return mixHex(hex, hexToRgb(backgroundColor) || {r: 23, g: 27, b: 34}, amount);
}
function shade(hex, amount) {
return mixHex(hex, {r: 0, g: 0, b: 0}, amount);
}
function lift(hex, amount) {
return mixHex(hex, {r: 255, g: 255, b: 255}, amount);
}
function inkOn(hex) {
var rgb = hexToRgb(hex) || {r: 94, g: 200, b: 216};
var luma = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
return luma > 0.55 ? '#1B140B' : '#F5EFE3';
}
function applyTheme() {
var css = document.documentElement.style;
var setVar = function (name, value) { css.setProperty(name, value); };
setVar('--mm-accent', '#' + accentColor);
setVar('--mm-accent-dim', '#' + mixWithBackdrop(accentColor, 0.50));
setVar('--mm-accent-deep', '#' + mixWithBackdrop(accentColor, 0.26));
setVar('--mm-accent-ink', inkOn(accentColor));
setVar('--mm-warn-dim', '#' + mixWithBackdrop('e8b84b', 0.50));
setVar('--mm-bg-panel', '#' + lift(backgroundColor, 0.94));
setVar('--mm-line', '#' + lift(backgroundColor, 0.88));
setVar('--mm-line-strong', '#' + lift(backgroundColor, 0.80));
setVar('--mm-bg-hover', '#' + lift(backgroundColor, 0.97));
setVar('--mm-bg-bar', '#' + shade(backgroundColor, 0.82));
setVar('--mm-bg-side', '#' + shade(backgroundColor, 0.9));
setVar('--mm-bg-solid', '#' + backgroundColor);
if (windowTransparent) {
var rgb = hexToRgb(backgroundColor) || {r: 23, g: 27, b: 34};
setVar('--mm-bg', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + backgroundAlpha + ')');
} else {
setVar('--mm-bg', '#' + backgroundColor);
}
}
function saveMenuSettings() {
lookDirty = false;
jsonCommand('saveMenuSettings', {
accent: accentColor,
background: backgroundColor,
backgroundAlpha: backgroundAlpha,
transparent: windowTransparent,
scale: panelScale,
fullScreen: fullScreen,
font: menuFont,
fontScale: fontScale,
});
}
function resetMenuSettings() {
command('resetMenuLook');
if (menuLanguage && menuLanguage !== 'auto') pickLanguage('auto');
}
function openHelpMenu(anchor) {
if (ctxNode && ctxOwner === anchor) { closeContextMenu(); return; }
if (gearMenu) closeGearMenu();
hideTooltip();
var rows = [
[keysetText(openHotkeyInfo.keys || {}), plainText(loc.helpOpen) || 'Open this menu'],
['CTRL + F', plainText(loc.helpSearch) || 'Jump to the search box'],
['UP / DOWN', plainText(loc.helpArrows) || 'Move through the mod list'],
['LEFT / RIGHT', plainText(loc.helpSlider) || 'Move the slider under the cursor'],
['ESC', plainText(loc.helpEscape) || 'Step back, then close the window'],
['RMB', plainText(loc.helpRightClick) || 'Options for hotkeys and color slots'],
];
var items = [];
for (var i = 0; i < rows.length; i += 1) {
if (!rows[i][0]) continue;
items.push({code: rows[i][0], label: rows[i][1], onClick: function () {}});
}
var rect = rootRelativeRect(anchor);
var width = 340;
showContextMenu(headerListLeft(width), rect.top + rect.height + 4, items,
{rootSpace: true, owner: anchor, width: width, help: true});
}
function closeGearMenu() {
if (gearMenu && gearMenu.parentNode) gearMenu.parentNode.removeChild(gearMenu);
gearMenu = null;
if (openHotkeyInfo.accepting) jsonCommand('menuHotkeyAction', {action: 'stop'});
refreshOpenHotkeyRow = function () {};
closeContextMenu();
}
function openGearMenu(anchor) {
closeGearMenu();
closeReview();
var menu = el('div', 'mm-gearmenu', root);
zoomFloating(menu);
gearMenu = menu;
var title = el('div', 'mm-gearmenu-title', menu);
var titleText = el('div', 'mm-gearmenu-title-text', title);
titleText.textContent = plainText(loc.menuSettings || 'MENU SETTINGS');
var resetLook = el('button', 'mm-gear-reset', title);
resetLook.type = 'button';
resetLook.textContent = plainText(loc.resetConfirmSubmit || 'Reset');
resetLook.addEventListener('click', function () {
askConfirm(
plainText(loc.menuSettings || 'MENU SETTINGS'),
plainText(loc.menuResetMessage ||
"Reset the menu's own appearance and shortcuts to defaults? " +
'Mod settings are not touched.'),
plainText(loc.resetConfirmSubmit || 'Reset'),
resetMenuSettings);
});
var languages = (payload && payload.languages) || [];
if (languages.length) {
var langRow = el('div', 'mm-gear-row', menu);
var langLabel = el('div', 'mm-gear-label', langRow);
langLabel.textContent = plainText(loc.menuLanguage || 'Language');
var langBtn = el('button', 'mm-gear-default mm-gear-lang', langRow);
langBtn.type = 'button';
var languageEntry = function (code) {
for (var i = 0; i < languages.length; i += 1) {
if (languages[i].code === code) return languages[i];
}
return null;
};
var showLanguage = function () {
var entry = menuLanguage && menuLanguage !== 'auto' ? languageEntry(menuLanguage) : null;
clearNode(langBtn);
var chip = el('div', 'mm-ctx-code', langBtn);
chip.textContent = entry ? entry.code.toUpperCase() : '';
var text = el('div', 'mm-ctx-text', langBtn);
text.textContent = entry ? entry.name : plainText(loc.languageAuto || 'Auto');
};
langBtn.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
if (ctxOwner === langBtn) {
closeContextMenu();
event.stopPropagation();
return;
}
var items = [{
label: plainText(loc.languageAuto || 'Auto'),
code: '',
selected: !menuLanguage || menuLanguage === 'auto',
enabled: true,
onClick: function () { pickLanguage('auto'); showLanguage(); },
}];
for (var i = 0; i < languages.length; i += 1) {
(function (entry) {
items.push({
label: entry.name,
code: entry.code.toUpperCase(),
selected: menuLanguage === entry.code,
enabled: true,
onClick: function () { pickLanguage(entry.code); showLanguage(); },
});
}(languages[i]));
}
var rect = rootRelativeRect(langBtn);
showContextMenu(rect.left, rect.top + rect.height + 4, items,
{rootSpace: true, width: Math.max(190, Math.round(rect.width)), owner: langBtn});
event.stopPropagation();
});
showLanguage();
}
var fontRow = el('div', 'mm-gear-row', menu);
var fontLabel = el('div', 'mm-gear-label', fontRow);
fontLabel.textContent = plainText(loc.menuFont || 'Font');
var fontBtn = el('button', 'mm-gear-default mm-gear-lang', fontRow);
fontBtn.type = 'button';
var fontItems = [
{key: 'default', label: plainText(loc.fontDefault || 'Default')},
{key: 'pfdinmax', label: plainText(loc.fontPfdin || 'PFDINMax')},
];
var fontLabelFor = function (key) {
for (var i = 0; i < fontItems.length; i += 1) {
if (fontItems[i].key === key) return fontItems[i].label;
}
return fontItems[0].label;
};
var showFont = function () {
clearNode(fontBtn);
var text = el('div', 'mm-ctx-text', fontBtn);
text.textContent = fontLabelFor(menuFont);
};
fontBtn.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
if (ctxOwner === fontBtn) {
closeContextMenu();
event.stopPropagation();
return;
}
var items = [];
for (var i = 0; i < fontItems.length; i += 1) {
(function (entry) {
items.push({
label: entry.label,
selected: menuFont === entry.key,
enabled: true,
onClick: function () { pickFont(entry.key); showFont(); },
});
}(fontItems[i]));
}
var rect = rootRelativeRect(fontBtn);
showContextMenu(rect.left, rect.top + rect.height + 4, items,
{rootSpace: true, width: Math.max(190, Math.round(rect.width)), owner: fontBtn});
event.stopPropagation();
});
showFont();
var accentRow = el('div', 'mm-gear-row', menu);
var accentLabel = el('div', 'mm-gear-label', accentRow);
accentLabel.textContent = plainText(loc.accentColor || 'Accent color');
var swatch = el('div', 'mm-swatch', accentRow);
swatch.style.background = '#' + accentColor;
var resetAccent = el('button', 'mm-gear-default', accentRow);
resetAccent.type = 'button';
resetAccent.textContent = plainText(loc.buttonDefault || 'Default');
var bgRow = el('div', 'mm-gear-row', menu);
var bgLabel = el('div', 'mm-gear-label', bgRow);
bgLabel.textContent = plainText(loc.backgroundColor || 'Background color');
var bgSwatch = el('div', 'mm-swatch', bgRow);
bgSwatch.style.background = '#' + backgroundColor;
var resetBg = el('button', 'mm-gear-default', bgRow);
resetBg.type = 'button';
resetBg.textContent = plainText(loc.buttonDefault || 'Default');
bgSwatch.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
openColorPicker({
title: plainText(loc.backgroundColor || 'Background color'),
initial: backgroundColor,
onApply: function (hex) {
backgroundColor = hex;
bgSwatch.style.background = '#' + hex;
applyTheme();
saveMenuSettings();
},
});
event.stopPropagation();
});
resetBg.addEventListener('click', function () {
backgroundColor = DEFAULT_BACKGROUND;
bgSwatch.style.background = '#' + backgroundColor;
applyTheme();
saveMenuSettings();
});
var columnsRow = el('div', 'mm-gear-row', menu);
var columnsLabel = el('div', 'mm-gear-label', columnsRow);
columnsLabel.textContent = plainText(loc.columnLayout || 'Option columns');
var columnsSeg = el('div', 'mm-seg', columnsRow);
var col2Item = el('div', 'mm-seg-item', columnsSeg);
col2Item.textContent = '2 col';
var col4Item = el('div', 'mm-seg-item', columnsSeg);
col4Item.textContent = '4 col';
var showColumns = function () {
var room = fourColumnsFit();
col2Item.className = multiColumn ? 'mm-seg-item' : 'mm-seg-item mm-on';
col4Item.className = (multiColumn ? 'mm-seg-item mm-on' : 'mm-seg-item') +
(room ? '' : ' mm-disabled');
col4Item.setAttribute('title', room ? '' : plainText(loc.columnsNoRoom || ''));
};
col2Item.addEventListener('click', function () { setColumnMode(false); showColumns(); });
col4Item.addEventListener('click', function () {
if (!fourColumnsFit()) return;
setColumnMode(true);
showColumns();
});
attachTooltip(col4Item, function () {
return fourColumnsFit() ? '' :
'{HEADER}' + plainText(loc.columnLayout || 'Option columns') + '{/HEADER}{BODY}' +
plainText(loc.columnsNoRoom || 'The window is too narrow for four columns.') + '{/BODY}';
});
showColumns();
var azRow = el('div', 'mm-gear-row', menu);
var azLabel = el('div', 'mm-gear-label', azRow);
azLabel.textContent = plainText(loc.azLayout || 'A to Z index');
var azSeg = el('div', 'mm-seg', azRow);
var azItems = [
['grid', el('div', 'mm-seg-item', azSeg), loc.azGrid || 'Grid'],
['rail', el('div', 'mm-seg-item', azSeg), loc.azRail || 'Rail'],
['off', el('div', 'mm-seg-item', azSeg), loc.azOff || 'Off'],
];
var showAz = function () {
for (var a = 0; a < azItems.length; a += 1) {
azItems[a][1].className = azMode === azItems[a][0]
? 'mm-seg-item mm-on' : 'mm-seg-item';
}
};
for (var az = 0; az < azItems.length; az += 1) {
(function (mode, node) {
node.textContent = plainText(azItems[az][2]);
node.addEventListener('click', function () {
if (azMode === mode) return;
azMode = mode;
jsonCommand('saveAzMode', {mode: azMode});
if (azMode === 'off' && letterFilter) {
letterFilter = null;
renderList();
}
renderAz();
showAz();
});
}(azItems[az][0], azItems[az][1]));
}
showAz();
var scaleRow = el('div', 'mm-gear-row', menu);
var scaleLabel = el('div', 'mm-gear-label', scaleRow);
scaleLabel.textContent = plainText(loc.panelScale || 'Panel scale');
var scaleBox = el('div', 'mm-stepper', scaleRow);
var scaleMinus = el('div', 'mm-stepper-btn mm-stepper-btn-minus', scaleBox);
stepperSign(scaleMinus, false);
var scaleValue = el('div', 'mm-stepper-value mm-gear-scale', scaleBox);
var scalePlus = el('div', 'mm-stepper-btn mm-stepper-btn-plus', scaleBox);
stepperSign(scalePlus, true);
var showScale = function () {
scaleValue.textContent = Math.round(panelScale * 100) + '%';
};
var stepScale = function (direction) {
var next = Math.round((panelScale + direction * PANEL_SCALE_STEP) * 10) / 10;
next = Math.max(PANEL_SCALE_MIN, Math.min(PANEL_SCALE_MAX, next));
if (next === panelScale) return;
panelScale = next;
showScale();
applyScale(false);
refreshScrollbars();
saveMenuSettings();
};
scaleMinus.addEventListener('click', function () { stepScale(-1); });
scalePlus.addEventListener('click', function () { stepScale(1); });
showScale();
var fontSizeRow = el('div', 'mm-gear-row', menu);
var fontSizeLabel = el('div', 'mm-gear-label', fontSizeRow);
fontSizeLabel.textContent = plainText(loc.fontSize || 'Font size');
var fontSizeBox = el('div', 'mm-stepper', fontSizeRow);
var fontMinus = el('div', 'mm-stepper-btn mm-stepper-btn-minus', fontSizeBox);
stepperSign(fontMinus, false);
var fontSizeValue = el('div', 'mm-stepper-value mm-gear-scale', fontSizeBox);
var fontPlus = el('div', 'mm-stepper-btn mm-stepper-btn-plus', fontSizeBox);
stepperSign(fontPlus, true);
var showFontSize = function () {
fontSizeValue.textContent = Math.round(fontScale * 100) + '%';
};
var stepFontSize = function (direction) {
var next = Math.round((fontScale + direction * FONT_SIZE_STEP) * 100) / 100;
next = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, next));
if (next === fontScale) return;
fontScale = next;
showFontSize();
applyFontScale();
refreshScrollbars();
saveMenuSettings();
};
fontMinus.addEventListener('click', function () { stepFontSize(-1); });
fontPlus.addEventListener('click', function () { stepFontSize(1); });
showFontSize();
var hotkeyRow = el('div', 'mm-gear-row', menu);
var hotkeyLabel = el('div', 'mm-gear-label', hotkeyRow);
hotkeyLabel.textContent = plainText(loc.openHotkey || 'Open hotkey');
var hotkeyBox = el('div', 'mm-hotkey', hotkeyRow);
refreshOpenHotkeyRow = function () {
if (!hotkeyBox.parentNode) return;
clearNode(hotkeyBox);
var text = keysetText(openHotkeyInfo.keys || {});
hotkeyBox.className = openHotkeyInfo.accepting ? 'mm-hotkey mm-accepting'
: (text ? 'mm-hotkey' : 'mm-hotkey mm-empty');
var parts = openHotkeyInfo.accepting ? ['...'] : (text ? text.split(' + ') : ['—']);
for (var i = 0; i < parts.length; i += 1) {
el('div', 'mm-key', hotkeyBox).textContent = parts[i];
}
};
refreshOpenHotkeyRow();
hotkeyBox.addEventListener('click', function () {
jsonCommand('menuHotkeyAction', {action: openHotkeyInfo.accepting ? 'stop' : 'start'});
});
onRightClick(hotkeyBox, function (event) {
showContextMenu(event.clientX, event.clientY, [
{label: plainText(loc.buttonDefault || 'Default'), onClick: function () {
jsonCommand('menuHotkeyAction', {action: 'default'});
}},
{label: plainText(loc.buttonClear || 'Clear'), onClick: function () {
jsonCommand('menuHotkeyAction', {action: 'clear'});
}},
]);
});
var transparentRow = el('div', 'mm-gear-row', menu);
var transparentLabel = el('div', 'mm-gear-label', transparentRow);
transparentLabel.textContent = plainText(loc.transparentWindow || 'Transparent window');
var toggle = el('div', windowTransparent ? 'mm-switch mm-on' : 'mm-switch', transparentRow);
el('div', 'mm-switch-knob', toggle);
var alphaRow = el('div', 'mm-gear-row', menu);
var alphaLabel = el('div', 'mm-gear-label', alphaRow);
alphaLabel.textContent = plainText(loc.transparencyLevel || 'Transparency');
var alphaBox = el('div', 'mm-stepper', alphaRow);
var alphaMinus = el('div', 'mm-stepper-btn mm-stepper-btn-minus', alphaBox);
stepperSign(alphaMinus, false);
var alphaValue = el('div', 'mm-stepper-value mm-gear-scale', alphaBox);
var alphaPlus = el('div', 'mm-stepper-btn mm-stepper-btn-plus', alphaBox);
stepperSign(alphaPlus, true);
var showAlpha = function () {
alphaValue.textContent = (100 - Math.round(backgroundAlpha * 100)) + '%';
alphaRow.style.opacity = windowTransparent ? '1' : '0.38';
};
var stepAlpha = function (direction) {
if (!windowTransparent) return;
var current = Math.round(backgroundAlpha * 100);
var next = direction > 0
? Math.floor((current - 1) / ALPHA_STEP) * ALPHA_STEP
: Math.ceil((current + 1) / ALPHA_STEP) * ALPHA_STEP;
next = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, next));
if (next === current) return;
backgroundAlpha = next / 100;
showAlpha();
applyTheme();
saveMenuSettings();
};
alphaMinus.addEventListener('click', function () { stepAlpha(-1); });
alphaPlus.addEventListener('click', function () { stepAlpha(1); });
showAlpha();
swatch.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
openColorPicker({
title: plainText(loc.accentColor || 'Accent color'),
initial: accentColor,
onApply: function (hex) {
accentColor = hex;
swatch.style.background = '#' + hex;
applyTheme();
saveMenuSettings();
},
});
event.stopPropagation();
});
resetAccent.addEventListener('click', function () {
accentColor = DEFAULT_ACCENT;
swatch.style.background = '#' + accentColor;
applyTheme();
saveMenuSettings();
});
toggle.addEventListener('click', function () {
windowTransparent = !windowTransparent;
toggle.className = windowTransparent ? 'mm-switch mm-on' : 'mm-switch';
showAlpha();
applyTheme();
saveMenuSettings();
});
menu.addEventListener('mousedown', function (event) { event.stopPropagation(); });
var rect = rootRelativeRect(anchor);
var width = 320;
var left = rect.left + rect.width - width;
if (left < 8) left = 8;
menu.style.left = Math.round(left) + 'rem';
menu.style.top = Math.round(rect.top + rect.height + 6) + 'rem';
}
function processPush() {
var raw = String(window.model && window.model.push || '');
if (!raw) return;
var outbox;
try {
outbox = JSON.parse(raw);
} catch (error) {
uiLog('jserror push parse: ' + error);
return;
}
for (var i = 0; i < outbox.length; i += 1) {
var envelope = outbox[i];
if (!envelope || Number(envelope.seq) <= lastPushSeq) continue;
lastPushSeq = Number(envelope.seq);
try {
handlePush(envelope.type, envelope.args || {});
} catch (error) {
uiLog('jserror push ' + envelope.type + ': ' + error);
}
}
if (lastPushSeq > lastAckedSeq) {
lastAckedSeq = lastPushSeq;
jsonCommand('ackPush', {seq: lastAckedSeq});
}
}
function handlePush(type, args) {
var linkage = args.linkage;
switch (type) {
case 'setHotkeys':
hotkeys = args.hotkeys || {};
for (var hk in hotkeys) {
if (!hotkeys.hasOwnProperty(hk)) continue;
for (var varName in hotkeys[hk]) {
if (!hotkeys[hk].hasOwnProperty(varName)) continue;
var entry = hotkeys[hk][varName];
var keyset = entry.keyset || [];
if (values[hk]) values[hk][varName] = keyset;
if (!entry.isPending && baseline[hk]) {
baseline[hk][varName] = keyset.slice ? keyset.slice() : keyset;
}
if (entry.isPending) recordChange(hk, varName);
else syncShadow(hk, varName);
}
}
refreshHotkeyControls();
renderListDirtyDots();
updateFooter();
break;
case 'reloadMod':
replaceMod(linkage, args.template);
break;
case 'menuSettings':
var lookBefore = currentLook();
applyLook(args);
if (args.kind === 'apply') {
recordLookChange(lookBefore);
if (args.save !== true) lookDirty = true;
updateFooter();
} else if (args.kind === 'reset') {
menuFont = String(args.font || 'default').toLowerCase();
var freshFont = Number(args.fontScale);
fontScale = (isFinite(freshFont) && freshFont >= 0.8 && freshFont <= 1.6)
? freshFont : DEFAULT_FONT_SCALE;
ddWidthCache = {};
applyFont();
applyFontScale();
if (multiColumn !== !!args.multiColumnMode) {
multiColumn = !!args.multiColumnMode;
renderDetail();
command('replayLiveImages');
}
refreshScrollbars();
lookDirty = false;
dropLookSteps();
updateFooter();
var gearHost = document.getElementById('mm-gear');
if (gearMenu && gearHost) {
closeGearMenu();
openGearMenu(gearHost);
}
} else if (args.kind === 'revert') {
lookDirty = false;
updateFooter();
dropLookSteps();
}
break;
case 'entriesChanged':
windowEntries = args.entries || [];
refreshEntriesButton();
break;
case 'modError':
var report = args.entry || {};
var touched = null;
if (args.action === 'set' && report.linkage) {
if (!modErrors[report.linkage]) modErrors[report.linkage] = {};
modErrors[report.linkage][report.where || 'x'] = report;
touched = report.linkage;
} else if (args.action === 'clear' && report.linkage && modErrors[report.linkage]) {
delete modErrors[report.linkage][report.where || 'x'];
var left = false;
for (var mk in modErrors[report.linkage]) {
if (modErrors[report.linkage].hasOwnProperty(mk)) { left = true; break; }
}
if (!left) delete modErrors[report.linkage];
touched = report.linkage;
}
if (touched && touched === selectedLinkage) renderDetail();
break;
case 'resetMod':
if (values[linkage] && args.values) {
for (var key in args.values) {
if (args.values.hasOwnProperty(key)) values[linkage][key] = args.values[key];
}
for (var sk in args.values) {
if (args.values.hasOwnProperty(sk)) syncShadow(linkage, sk);
}
undoStack = [];
redoStack = [];
updateHistoryButtons();
restoreTemplateImages(linkage);
var registry = controls[linkage] || {};
for (var rk in registry) {
if (registry.hasOwnProperty(rk)) registry[rk].refresh();
}
refreshGates(linkage);
if (linkage === selectedLinkage) {
var headSwitch = document.getElementById('mm-modswitch');
var store = values[linkage];
if ('enabled' in store) {
headSwitch.className = store.enabled ? 'mm-switch mm-on' : 'mm-switch';
}
renderListDirtyDots();
}
updateFooter();
notifyLive(linkage);
}
break;
case 'updateImage':
applyImageUpdate(linkage, args);
break;
case 'inputPreview':
applyInputPreview(linkage, args);
break;
case 'setColorValue':
if (values[linkage]) {
var entry = (controls[linkage] || {})[args.varName];
var currentValue = values[linkage][args.varName];
if (currentValue && typeof currentValue === 'object' && 'color' in currentValue) {
values[linkage][args.varName] = {enabled: currentValue.enabled, color: args.color};
} else {
values[linkage][args.varName] = args.color;
}
if (entry) entry.refresh();
updateFooter();
notifyLive(linkage);
}
break;
case 'markAllFeaturesSeen':
var mod = findMod(linkage);
if (mod) {
eachComponent(mod, function (comp) { delete comp.newFeature; });
if (mod.multiColumnTemplate) {
eachComponent(mod.multiColumnTemplate, function (comp) { delete comp.newFeature; });
}
if (resultsMode === 'new') {
var anyNew = false;
for (var mi = 0; mi < mods.length; mi += 1) {
if (countNewFeatures(mods[mi]) > 0) { anyNew = true; break; }
}
if (!anyNew) resultsMode = null;
}
renderList();
if (resultsMode || linkage === selectedLinkage) renderDetail();
}
break;
case 'updateImageAtlas':
applyAtlasUpdate(linkage, args);
break;
case 'images':
for (var token in args) {
if (args.hasOwnProperty(token)) imageRegistry[token] = args[token];
}
break;
case 'panel':
applyGeometry(args);
applyScale(true);
refreshScrollbars();
break;
case 'modStyle':
if (args.css) modStyles[linkage] = args.css;
else delete modStyles[linkage];
applyModStyles();
break;
case 'locale':
if (args.loc) loc = args.loc;
if (args.language) menuLanguage = args.language;
applyLocalization();
refreshSearchUi();
renderList();
renderDetail();
updateFooter();
if (gearMenu) {
var gearAnchor = document.getElementById('mm-gear');
closeGearMenu();
if (gearAnchor) openGearMenu(gearAnchor);
}
break;
case 'modIcon':
if (args.source) modIcons[linkage] = args.source;
else delete modIcons[linkage];
renderList();
if (linkage === selectedLinkage) renderDetail();
break;
case 'escape':
handleEscape();
break;
case 'openHotkey':
openHotkeyInfo = {keys: args.keys || null, accepting: !!args.accepting};
refreshOpenHotkeyRow();
break;
case 'hotkeyToggle':
if (!totalChanges() && !isTextEntry(document.activeElement) &&
!ctxNode && !picker && !gearMenu && !reviewNode && !confirmBox) {
command('closeView');
}
break;
}
}
function refreshHotkeyControls() {
for (var linkage in controls) {
if (!controls.hasOwnProperty(linkage)) continue;
var registry = controls[linkage];
for (var key in registry) {
if (registry.hasOwnProperty(key) && registry[key].comp.type === 'HotKey') {
registry[key].refresh();
}
}
}
}
function layoutSignature(template) {
var parts = [];
eachComponent(template, function (comp, column) {
parts.push(column, comp.type, comp.varName, comp.text,
comp.options ? comp.options.length : 0);
});
return parts.join('|');
}
function replaceMod(linkage, template) {
if (!template) return;
var index = -1;
for (var i = 0; i < mods.length; i += 1) {
if (mods[i].linkage === linkage) { index = i; break; }
}
if (index < 0) return;
var wide = mods[index].multiColumnTemplate;
var sameLayout = linkage === selectedLinkage &&
layoutSignature(mods[index]) === layoutSignature(template) &&
(!!wide === !!template.multiColumnTemplate) &&
(!wide || layoutSignature(wide) === layoutSignature(template.multiColumnTemplate));
if (sameLayout) {
mergeComponents(mods[index], template);
if (wide && template.multiColumnTemplate) {
mergeComponents(wide, template.multiColumnTemplate);
} else {
mods[index].multiColumnTemplate = template.multiColumnTemplate;
}
mods[index].enabled = template.enabled;
mods[index].defaults = template.defaults;
seedMod(mods[index], true);
var registry = controls[linkage] || {};
for (var key in registry) {
if (registry.hasOwnProperty(key)) registry[key].refresh();
}
refreshGates(linkage);
} else {
carryLiveImages(mods[index], template);
mods[index] = template;
seedMod(template, true);
if (linkage === selectedLinkage) renderDetail();
}
renderList();
updateFooter();
}
function mergeComponents(oldTemplate, newTemplate) {
var oldComps = [];
var newComps = [];
eachComponent(oldTemplate, function (comp) { oldComps.push(comp); });
eachComponent(newTemplate, function (comp) { newComps.push(comp); });
for (var ci = 0; ci < oldComps.length && ci < newComps.length; ci += 1) {
for (var ok in oldComps[ci]) {
if (oldComps[ci].hasOwnProperty(ok) && ok !== 'atlasLive' &&
ok !== 'liveSource' && !(ok in newComps[ci])) {
delete oldComps[ci][ok];
}
}
for (var ck in newComps[ci]) {
if (newComps[ci].hasOwnProperty(ck)) oldComps[ci][ck] = newComps[ci][ck];
}
}
}
function carryLiveImages(oldTemplate, newTemplate) {
if (!oldTemplate || !newTemplate) return;
var live = {};
var collect = function (tpl) {
if (!tpl) return;
eachComponent(tpl, function (comp) {
if (comp.type === 'Image') {
live[comp.varName] = {atlas: comp.atlasLive || null, source: comp.liveSource || '',
width: Number(comp.liveWidth) || 0, height: Number(comp.liveHeight) || 0,
collapsed: !!comp.collapsed};
}
});
};
collect(oldTemplate);
collect(oldTemplate.multiColumnTemplate);
var paste = function (tpl) {
if (!tpl) return;
eachComponent(tpl, function (comp) {
if (comp.type !== 'Image') return;
var carried = live[comp.varName];
if (!carried) return;
if (carried.atlas) {
comp.atlasLive = carried.atlas;
comp.collapsed = false;
} else if (carried.source) {
comp.liveSource = carried.source;
comp.liveWidth = carried.width || 0;
comp.liveHeight = carried.height || 0;
comp.collapsed = false;
} else if (carried.collapsed) {
comp.collapsed = true;
}
});
};
paste(newTemplate);
paste(newTemplate.multiColumnTemplate);
}
function restoreTemplateImages(linkage) {
var mod = findMod(linkage);
if (!mod) return false;
var restored = false;
var apply = function (template) {
eachComponent(template, function (comp) {
if (comp.type !== 'Image') return;
var saved = comp.templateImage;
if (saved) {
comp.source = saved.source;
comp.atlas = saved.atlas;
comp.width = saved.width;
comp.height = saved.height;
comp.label = saved.label;
comp.collapsed = saved.collapsed;
}
comp.atlasLive = null;
comp.liveSource = '';
comp.liveWidth = 0;
comp.liveHeight = 0;
restored = true;
});
};
apply(mod);
if (mod.multiColumnTemplate) apply(mod.multiColumnTemplate);
return restored;
}
function applyImageUpdate(linkage, args) {
var mod = findMod(linkage);
if (!mod) return;
var apply = function (template) {
eachComponent(template, function (comp) {
if (comp.type === 'Image' && comp.varName === args.varName) {
comp.liveSource = args.source;
comp.atlasLive = null;
comp.atlas = null;
if (args.naturalWidth) comp.liveNaturalWidth = Number(args.naturalWidth) || 0;
if (args.naturalHeight) comp.liveNaturalHeight = Number(args.naturalHeight) || 0;
if (args.width !== null && args.width !== undefined) {
comp.liveWidth = Number(args.width) || 0;
}
if (args.height !== null && args.height !== undefined) {
comp.liveHeight = Number(args.height) || 0;
}
comp.collapsed = !!args.removeImage;
if (args.label !== null && args.label !== undefined) comp.label = args.label;
}
});
};
apply(mod);
if (mod.multiColumnTemplate) apply(mod.multiColumnTemplate);
if (linkage === selectedLinkage) {
var entry = (controls[linkage] || {})[args.varName];
if (entry) {
entry.refresh();
runImageFits();
}
}
}
function applyAtlasUpdate(linkage, args) {
var mod = findMod(linkage);
if (!mod) return;
args = args || {};
var apply = function (template) {
eachComponent(template, function (comp) {
if (comp.type === 'Image' && comp.varName === args.varName) {
comp.atlasLive = args;
comp.collapsed = false;
comp.liveSource = '';
}
});
};
apply(mod);
if (mod.multiColumnTemplate) apply(mod.multiColumnTemplate);
if (linkage === selectedLinkage) {
var entry = (controls[linkage] || {})[args.varName];
if (entry) {
entry.refresh();
runImageFits();
}
}
}
var lastEscapeTick = 0;
function isTextEntry(node) {
var tag = node ? String(node.tagName || '').toLowerCase() : '';
return tag === 'input' || tag === 'textarea';
}
function handleEscape() {
var now = Date.now();
if (now - lastEscapeTick < 150) return;
lastEscapeTick = now;
if (ctxNode) { closeContextMenu(); return; }
if (openDropdown) { closeOpenDropdown(); return; }
if (reviewNode) { closeReview(); return; }
if (gearMenu) { closeGearMenu(); return; }
if (confirmBox) { closeConfirm(); return; }
var search = document.getElementById('mm-search');
var active = document.activeElement;
if (active && active !== search && isTextEntry(active)) {
try { active.blur(); } catch (error) {}
return;
}
if (picker) { closeColorPicker(true); return; }
if (search && (search.value || active === search)) {
search.value = '';
searchText = '';
refreshSearchUi();
renderList();
syncResultsMode();
try { search.blur(); } catch (error) {}
return;
}
if (resultsMode) {
resultsMode = null;
renderList();
renderDetail();
return;
}
command('closeView');
}
var confirmBox = null;
function closeConfirm() {
if (confirmBox && confirmBox.parentNode) confirmBox.parentNode.removeChild(confirmBox);
confirmBox = null;
}
function askConfirm(title, message, submitLabel, onConfirm) {
closeConfirm();
var overlay = el('div', 'mm-overlay', root);
confirmBox = overlay;
overlay.style.width = surfaceW + 'rem';
overlay.style.height = surfaceH + 'rem';
overlay.addEventListener('mousedown', function (event) {
if (event.target === overlay) closeConfirm();
event.stopPropagation();
});
var box = el('div', 'mm-dialog', overlay);
var head = el('div', 'mm-dialog-title', box);
setLabel(head, title);
var body = el('div', 'mm-dialog-body', box);
setLabel(body, message);
var row = el('div', 'mm-dialog-buttons', box);
el('div', 'mm-footer-spacer', row);
var cancel = el('button', 'mm-button mm-button-ghost', row);
cancel.type = 'button';
cancel.textContent = plainText(loc.buttonCancel || 'Cancel');
cancel.addEventListener('click', closeConfirm);
var submit = el('button', 'mm-button mm-button-primary', row);
submit.type = 'button';
submit.textContent = plainText(submitLabel || loc.buttonOK || 'OK');
submit.addEventListener('click', function () {
closeConfirm();
onConfirm();
});
}
var SCROLL_SLACK = 14;
function bindWheelScroll(nodeId, scrollbarId) {
var node = document.getElementById(nodeId);
var bar = document.getElementById(scrollbarId);
var thumb = bar ? bar.firstChild : null;
var hasScroll = false;
var near = false;
var hot = false;
var applyBarClass = function () {
if (!bar) return;
var cls = 'mm-vscroll';
if (hasScroll) cls += ' mm-vscroll-live';
if (near) cls += ' mm-vscroll-near';
if (hot) cls += ' mm-vscroll-hot';
if (bar.className !== cls) bar.className = cls;
};
var lastScrollTop = Number(node.scrollTop) || 0;
var dropAnchored = function () {
var top = Number(node.scrollTop) || 0;
if (top === lastScrollTop) return;
var moved = top - lastScrollTop;
lastScrollTop = top;
followOpenDropdown(node, moved);
tooltipAnchorBox = null;
var total = Number(node.scrollHeight) || 0;
var view = Number(node.clientHeight) || 0;
if (!(total - view > SCROLL_SLACK)) return;
closeContextMenu();
};
var setBarState = function (value) {
hasScroll = value;
applyBarClass();
};
var setNear = function (value) {
near = value;
applyBarClass();
};
var setHot = function (value) {
hot = value;
applyBarClass();
};
var update = function () {
dropAnchored();
if (!thumb) return;
var total = Number(node.scrollHeight) || 0;
var view = Number(node.clientHeight) || 0;
if (!total || !view || !(total - view > SCROLL_SLACK)) {
if (node.scrollTop) node.scrollTop = 0;
thumb.style.height = '0px';
setBarState(false);
return;
}
if (node.scrollTop > total - view) node.scrollTop = total - view;
setBarState(true);
var barH = bar.clientHeight;
var thumbH = Math.max(24, Math.round(barH * view / total));
var maxTop = barH - thumbH;
var ratio = node.scrollTop / (total - view);
thumb.style.height = thumbH + 'px';
thumb.style.marginTop = Math.round(maxTop * ratio) + 'px';
};
var SCROLL_IMPULSE = 22;
var SCROLL_FRICTION = 0.90;
var SCROLL_MAX_VEL = 130;
var scrollPos = null;
var scrollVel = 0;
var gliding = false;
var glide = function () {
var span = (Number(node.scrollHeight) || 0) - (Number(node.clientHeight) || 0);
if (span < 0) span = 0;
if (scrollPos === null) scrollPos = Number(node.scrollTop) || 0;
scrollPos += scrollVel;
scrollVel *= SCROLL_FRICTION;
if (scrollPos <= 0) { scrollPos = 0; scrollVel = 0; }
if (scrollPos >= span) { scrollPos = span; scrollVel = 0; }
node.scrollTop = Math.round(scrollPos);
update();
if (Math.abs(scrollVel) < 0.4) {
scrollVel = 0;
scrollPos = null;
gliding = false;
return;
}
window.requestAnimationFrame(glide);
};
node.addEventListener('wheel', function (event) {
if (tooltipWheel(event)) return;
notePageWheel();
var delta = Number(event.deltaY);
if (!delta) delta = -Number(event.wheelDelta || 0);
if (scrollPos === null) scrollPos = Number(node.scrollTop) || 0;
scrollVel += (delta > 0 ? -SCROLL_IMPULSE : SCROLL_IMPULSE);
if (scrollVel > SCROLL_MAX_VEL) scrollVel = SCROLL_MAX_VEL;
if (scrollVel < -SCROLL_MAX_VEL) scrollVel = -SCROLL_MAX_VEL;
if (!gliding) {
gliding = true;
window.requestAnimationFrame(glide);
}
event.preventDefault();
});
var dragging = false;
var dragFromY = 0;
var dragFromTop = 0;
thumb.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
scrollVel = 0;
scrollPos = null;
dragging = true;
dragFromY = pointerIn(event).y;
dragFromTop = node.scrollTop;
event.preventDefault();
event.stopPropagation();
});
document.addEventListener('mousemove', function (event) {
if (!dragging) return;
var total = Number(node.scrollHeight) || 0;
var view = Number(node.clientHeight) || 0;
if (!(total - view > SCROLL_SLACK)) return;
var rect = rootRelativeRect(bar);
var barH = rect.height;
var thumbH = Math.max(24, Math.round(barH * view / total));
var maxTop = barH - thumbH;
if (maxTop <= 0) return;
node.scrollTop = dragFromTop + (pointerIn(event).y - dragFromY) * (total - view) / maxTop;
update();
});
document.addEventListener('mouseup', function () { dragging = false; });
bar.addEventListener('mousedown', function (event) {
if (event.button !== 0 || dragging) return;
var rect = rootRelativeRect(thumb);
var y = pointerIn(event).y;
if (y >= rect.top && y <= rect.top + rect.height) return;
node.scrollTop += (y < rect.top ? -1 : 1) * (Number(node.clientHeight) || 0);
update();
});
var column = bar.parentNode;
update.hover = function (x, y) {
if (dragging) return;
var inside = function (rect, pad) {
return x >= rect.left - pad && x <= rect.left + rect.width + pad &&
y >= rect.top - pad && y <= rect.top + rect.height + pad;
};
setNear(column ? inside(rootRelativeRect(column), 0) : false);
setHot(inside(rootRelativeRect(bar), 3));
};
window.requestAnimationFrame(update);
return update;
}
function resizeSurface(width, height) {
try {
if (typeof viewEnv !== 'undefined' && typeof viewEnv.resizeViewPx === 'function') {
viewEnv.resizeViewPx(width, height);
}
} catch (error) {}
}
function scheduleReassert(width, height, times) {
if (times <= 0) return;
window.requestAnimationFrame(function () {
resizeSurface(width, height);
scheduleReassert(width, height, times - 1);
});
}
function panelBox() {
var zoom = Math.max(PANEL_SCALE_MIN, Math.min(PANEL_SCALE_MAX, panelScale));
var left = panelLeft;
var top = panelTop;
var boxW = panelW;
var boxH = panelH;
if (fullScreen) {
left = 0;
top = 0;
boxW = surfaceW;
boxH = surfaceH;
}
return {
zoom: zoom,
width: Math.round(boxW / zoom),
height: Math.round(boxH / zoom),
left: left,
top: top,
full: fullScreen,
};
}
var SIDEBAR_WIDTH = 300;
var MIN_COLUMN_WIDTH = 300;
function fourColumnsFit() {
var box = panelBox();
return (box.width - SIDEBAR_WIDTH) >= MIN_COLUMN_WIDTH * 4;
}
function enforceColumnRoom() {
var granted = fourColumnsFit();
if (granted === columnsGranted) return false;
columnsGranted = granted;
if (multiColumn) renderDetail();
return multiColumn;
}
function applyScale(notify) {
if (lastSurfaceW !== surfaceW || lastSurfaceH !== surfaceH) {
lastSurfaceW = surfaceW;
lastSurfaceH = surfaceH;
closeOpenDropdown();
closeContextMenu();
closeGearMenu();
}
var scale = getScale();
var width = Math.ceil(surfaceW * scale);
var height = Math.ceil(surfaceH * scale);
root.style.transform = 'none';
root.style.width = surfaceW + 'rem';
root.style.height = surfaceH + 'rem';
var windowEl = document.getElementById('mm-window');
var box = panelBox();
windowEl.style.left = box.left + 'rem';
windowEl.style.top = box.top + 'rem';
if (!enforceColumnRoom()) {
runImageFits();
}
windowEl.style.width = box.width + 'rem';
windowEl.style.height = box.height + 'rem';
windowEl.style.transformOrigin = '0 0';
windowEl.style.transform = box.zoom === 1 ? 'none' : 'scale(' + box.zoom + ')';
windowEl.style.borderRadius = box.full ? '0rem' : '10rem';
document.documentElement.style.width = width + 'px';
document.documentElement.style.height = height + 'px';
document.body.style.width = width + 'px';
document.body.style.height = height + 'px';
resizeSurface(width, height);
scheduleReassert(width, height, 4);
if (notify) command('onReady');
}
function fitTitleBlock() {
var block = document.getElementsByClassName('mm-title-block')[0];
var title = document.getElementById('mm-title');
if (!block || !title) return;
block.style.flexBasis = 'auto';
block.style.overflow = 'visible';
title.style.alignSelf = 'flex-start';
window.requestAnimationFrame(function () {
window.requestAnimationFrame(function () {
var k = getScale() || 1;
var w = (Number(title.offsetWidth) || 0) / k;
title.style.alignSelf = '';
block.style.overflow = '';
if (w <= 0) { block.style.flexBasis = ''; return; }
var want = Math.max(TITLE_BLOCK_MIN, Math.ceil(w));
block.style.flexBasis = Math.min(want, TITLE_BLOCK_MAX) + 'rem';
});
});
}
function applyBranding() {
var branding = payload && payload.branding;
if (!branding) return;
if (branding.title) {
document.getElementById('mm-title').textContent = plainText(branding.title);
fitTitleBlock();
}
if (!branding.icon) return;
var logo = document.getElementsByClassName('mm-logo');
if (!logo.length) return;
clearNode(logo[0]);
logo[0].className = 'mm-logo mm-logo-custom';
var img = el('img', 'mm-logo-img', logo[0]);
img.src = imageUrl(branding.icon);
}
function applyLocalization() {
document.getElementById('mm-title').textContent = plainText(loc.windowTitle || 'Mods settings');
fitTitleBlock();
document.getElementById('mm-search-ph').textContent = plainText(loc.searchPlaceholder || '');
document.getElementById('mm-cancel').textContent = plainText(loc.buttonCancel || 'Cancel');
document.getElementById('mm-apply').textContent = plainText(loc.buttonApply || 'Apply');
document.getElementById('mm-save').textContent = plainText(loc.buttonSaveClose || 'Save and close');
}
function initialize() {
tooltipNode = document.getElementById('mm-tooltip');
tooltipBody = document.getElementById('mm-tooltip-scroll');
tooltipBar = document.getElementById('mm-tooltip-bar');
tooltipThumb = tooltipBar ? tooltipBar.firstChild : null;
readPayload();
applyLocalization();
applyBranding();
var colmode = document.getElementById('mm-colmode');
var col2 = document.getElementById('mm-col2');
var col4 = document.getElementById('mm-col4');
var smallScreen = panelW < 1280;
var refreshColmode = function () {
col2.className = multiColumn ? 'mm-seg-item' : 'mm-seg-item mm-on';
col4.className = multiColumn ? 'mm-seg-item mm-on' : 'mm-seg-item';
};
setColumnMode = function (value) {
if (multiColumn === value) return;
multiColumn = value;
refreshColmode();
jsonCommand('saveMultiColumnMode', {value: multiColumn});
renderDetail();
command('replayLiveImages');
};
colmode.style.display = 'none';
columnsGranted = fourColumnsFit() && !smallScreen;
refreshColmode();
col2.addEventListener('click', function () { setColumnMode(false); });
col4.addEventListener('click', function () { setColumnMode(true); });
document.getElementById('mm-close').addEventListener('click', function () {
command('closeView');
});
document.getElementById('mm-cancel').addEventListener('click', function () {
command('closeView');
});
document.getElementById('mm-apply').addEventListener('click', applyChanges);
document.getElementById('mm-save').addEventListener('click', function () {
applyChanges();
command('closeView');
});
document.getElementById('mm-modreset').addEventListener('click', function () {
if (!selectedLinkage) return;
var doReset = function () {
jsonCommand('requestModReset', {linkage: selectedLinkage});
};
if (loc.resetSkipConfirm) {
doReset();
return;
}
askConfirm(
loc.resetConfirmTitle || 'Reset settings',
loc.resetConfirmMessage || 'Reset this mod to its default settings?',
loc.resetConfirmSubmit || 'Reset',
doReset);
});
document.getElementById('mm-modswitch').addEventListener('click', function () {
var store = values[selectedLinkage];
if (!store || !('enabled' in store)) return;
store.enabled = !store.enabled;
renderDetail();
renderList();
onControlChanged(selectedLinkage, 'enabled', null);
});
var searchInput = document.getElementById('mm-search');
var searchPh = document.getElementById('mm-search-ph');
var searchClear = document.getElementById('mm-search-clear');
var refreshPlaceholder = function () {
searchPh.style.display = searchInput.value ? 'none' : 'flex';
searchClear.style.display = searchInput.value ? 'flex' : 'none';
};
refreshSearchUi = refreshPlaceholder;
searchClear.addEventListener('mousedown', function (event) {
searchInput.value = '';
searchText = '';
refreshPlaceholder();
renderList();
syncResultsMode();
try { searchInput.blur(); } catch (error) {}
event.preventDefault();
event.stopPropagation();
});
searchInput.addEventListener('input', function (event) {
searchText = String(event.target.value || '');
refreshPlaceholder();
renderList();
syncResultsMode();
});
searchInput.addEventListener('focus', function () {
refreshPlaceholder();
syncResultsMode();
});
searchInput.addEventListener('blur', refreshPlaceholder);
searchPh.addEventListener('mousedown', function (event) {
searchInput.focus();
event.preventDefault();
});
refreshPlaceholder();
document.addEventListener('mousedown', function () {
closeOpenDropdown();
closeContextMenu();
closeGearMenu();
closeReview();
});
var entriesBtn = document.getElementById('mm-entries');
refreshEntriesButton = function () {
entriesBtn.style.display = windowEntries.length ? 'flex' : 'none';
};
attachTooltip(entriesBtn, function () {
return '{HEADER}' + plainText(loc.entriesOther || 'Other mods') + '{/HEADER}{BODY}' +
plainText(loc.entriesOtherBody || 'Windows registered by other mods') + '{/BODY}';
});
openEntriesMenu = function () {
if (!windowEntries.length) return;
if (ctxNode && ctxOwner === entriesBtn) { closeContextMenu(); return; }
if (gearMenu) closeGearMenu();
hideTooltip();
var items = [];
var listed = windowEntries.slice().sort(function (a, b) {
return (b.own ? 1 : 0) - (a.own ? 1 : 0);
});
for (var i = 0; i < listed.length; i += 1) {
if (i > 0 && !listed[i].own && listed[i - 1].own) {
items.push({rule: true});
}
(function (entry) {
items.push({
label: entry.name,
enabled: entry.enabled !== false,
code: entry.alerting ? '!' : undefined,
onClick: function () {
if (entry.source === 'group') {
openEntryGroup(entry, entriesBtn);
return;
}
jsonCommand('invokeEntry', {
id: entry.id, source: entry.source, numID: entry.numID,
});
},
});
}(listed[i]));
}
var rect = rootRelativeRect(entriesBtn);
var listWidth = 240;
showContextMenu(headerListLeft(listWidth), rect.top + rect.height + 4,
items, {rootSpace: true, owner: entriesBtn, width: listWidth});
};
entriesBtn.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0 || !windowEntries.length) return;
playUiSound('click');
openEntriesMenu();
});
refreshEntriesButton();
var undoBtn = document.getElementById('mm-undo');
var redoBtn = document.getElementById('mm-redo');
var undoIcon = el('div', 'mm-hist-icon mm-hist-back', undoBtn);
el('div', 'mm-hist-arc', undoIcon);
el('div', 'mm-hist-head', undoIcon);
var redoIcon = el('div', 'mm-hist-icon mm-hist-fwd', redoBtn);
el('div', 'mm-hist-arc', redoIcon);
el('div', 'mm-hist-head', redoIcon);
attachTooltip(undoBtn, historyTooltipText(
function () { return undoStack[undoStack.length - 1]; },
function (step) { return step.from; },
plainText(loc.historyUndo || 'Undo')));
attachTooltip(redoBtn, historyTooltipText(
function () { return redoStack[redoStack.length - 1]; },
function (step) { return step.to; },
plainText(loc.historyRedo || 'Redo')));
undoBtn.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0 || !undoStack.length) return;
playUiSound('click');
hideTooltip();
undoStep();
});
redoBtn.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0 || !redoStack.length) return;
playUiSound('click');
hideTooltip();
redoStep();
});
undoBtn.addEventListener('mouseenter', function () {
if (undoStack.length) playUiSound('hover');
});
redoBtn.addEventListener('mouseenter', function () {
if (redoStack.length) playUiSound('hover');
});
var counter = document.getElementById('mm-counter');
counter.addEventListener('mousedown', function (event) {
event.stopPropagation();
if (event.button !== 0) return;
playUiSound('click');
toggleReview();
});
counter.addEventListener('mouseenter', function () { playUiSound('hover'); });
document.addEventListener('mousemove', function (event) {
notePointer(event);
if (keyboardMode &&
(Number(event.clientX || 0) !== lastMouseX ||
Number(event.clientY || 0) !== lastMouseY)) {
setKeyboardMode(false);
}
lastMouseX = Number(event.clientX || 0);
lastMouseY = Number(event.clientY || 0);
if (tooltipVisible && pointerOffTooltipAnchor()) leaveTooltipAnchor();
schedulePointerFrame();
});
document.addEventListener('keydown', function (event) {
if (event.ctrlKey && event.keyCode === 70) {
document.getElementById('mm-search').focus();
event.preventDefault();
return;
}
if (hoveredNudge && !acceptingHotkey && !isTextEntry(document.activeElement)) {
var code = event.keyCode;
if (code === 37 || code === 40) {
hoveredNudge(-1);
event.preventDefault();
return;
}
if (code === 39 || code === 38) {
hoveredNudge(1);
event.preventDefault();
return;
}
}
if (openDropdown && event.keyCode === 13 && openDropdown.mmCommit) {
openDropdown.mmCommit();
event.preventDefault();
return;
}
if (!acceptingHotkey && (event.keyCode === 38 || event.keyCode === 40)) {
if (openDropdown) {
stepDropdown(event.keyCode === 40 ? 1 : -1);
event.preventDefault();
return;
}
if (!isTextEntry(document.activeElement)) {
stepSelection(event.keyCode === 40 ? 1 : -1);
event.preventDefault();
return;
}
}
if (event.keyCode !== 27 || acceptingHotkey) return;
handleEscape();
});
var updateListScroll = bindWheelScroll('mm-list', 'mm-list-scroll');
var updateOptsScroll = bindWheelScroll('mm-opts', 'mm-opts-scroll');
var measureScrollbars = function () {
updateListScroll();
updateOptsScroll();
};
refreshScrollbars = function () {
window.requestAnimationFrame(function () {
measureScrollbars();
window.requestAnimationFrame(measureScrollbars);
});
window.setTimeout(measureScrollbars, 120);
};
scrollHover = function (x, y) {
if (updateListScroll.hover) updateListScroll.hover(x, y);
if (updateOptsScroll.hover) updateOptsScroll.hover(x, y);
};
applyTheme();
applyModStyles();
var fullButton = document.getElementById('mm-full');
fullButton.addEventListener('click', function () {
fullScreen = !fullScreen;
applyScale(false);
refreshScrollbars();
saveMenuSettings();
});
var gearButton = document.getElementById('mm-gear');
gearButton.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
if (gearMenu) closeGearMenu();
else openGearMenu(gearButton);
event.stopPropagation();
});
var helpButton = document.getElementById('mm-help');
if (helpButton) {
helpButton.addEventListener('mousedown', function (event) {
if (event.button !== 0) return;
openHelpMenu(helpButton);
event.stopPropagation();
});
}
var staticIds = ['mm-close', 'mm-gear', 'mm-full', 'mm-help', 'mm-col2', 'mm-col4',
'mm-cancel', 'mm-apply', 'mm-save', 'mm-modreset', 'mm-modswitch', 'mm-search-clear'];
for (var si = 0; si < staticIds.length; si += 1) {
var staticNode = document.getElementById(staticIds[si]);
if (staticNode) bindSounds(staticNode);
}
if (pickerMode) {
renderPicker();
} else {
prewarmDropdownWidths(function () {
renderList();
if (mods.length) {
var remembered = String(payload.selectedMod || '');
var restore = remembered && findMod(remembered) ? remembered : mods[0].linkage;
selectMod(restore, true);
if (restore !== mods[0].linkage) {
afterTwoFrames(function () { scrollRowIntoView(restore); });
}
}
updateFooter();
});
}
if (!pickerMode) {
window.requestAnimationFrame(function () {
command('replayLiveImages');
});
}
try {
if (window.engine && typeof window.engine.on === 'function') {
window.engine.on('viewEnv.onDataChanged', processPush);
scaleHandler = function () {
window.requestAnimationFrame(function () {
window.requestAnimationFrame(function () { applyScale(false); });
});
};
window.engine.on('self.onScaleUpdated', scaleHandler);
}
} catch (error) {}
window.setInterval(processPush, 250);
applyScale(true);
}
window.addEventListener('unload', function () {
clearAtlasTimers();
try {
if (window.engine && typeof window.engine.off === 'function') {
if (scaleHandler) window.engine.off('self.onScaleUpdated', scaleHandler);
window.engine.off('viewEnv.onDataChanged', processPush);
}
} catch (error) {}
});
function afterTwoFrames(callback) {
window.requestAnimationFrame(function () {
window.requestAnimationFrame(callback);
});
}
if (window.engine && window.engine.whenReady) {
var domBuilt = window.isDomBuilt
? Promise.resolve()
: new Promise(function (resolve) {
window.engine.on('self.onDomBuilt', resolve);
});
Promise.all([window.engine.whenReady, domBuilt]).then(function () {
afterTwoFrames(initialize);
});
} else {
afterTwoFrames(initialize);
}
}());