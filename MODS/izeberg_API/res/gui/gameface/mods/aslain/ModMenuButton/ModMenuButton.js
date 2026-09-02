import { MediaContext } from "../../libs/media.js";
import { ModelObserver } from "../../libs/model.js";
import { playSound } from "../../libs/sound.js";
import { showTooltip, hideTooltip } from "../../libs/views.js";
const standalone = document.getElementById("root")?.hasAttribute("standalone") || false;
const media = MediaContext(standalone);
const model = ModelObserver(standalone ? 0 : "ModMenuButton");
const ICON_GRID = 48;
const ICON_ACCENT = "#E0A248";
const ICON_TILE = "#25282B";
const ICON_TILE_EDGE = "#333538";
const ICON_LINE = "#D7D2C5";
const ICON_PARTS = [
{ x: 2, y: 2, w: 44, h: 44, r: 11, fill: ICON_TILE, edge: ICON_TILE_EDGE },
{ x: 21, y: 11, w: 6, h: 26, r: 3, accent: true },
{ x: 11, y: 21, w: 26, h: 6, r: 3, accent: true },
{ x: 18.4, y: 18.4, w: 11.2, h: 11.2, r: 5.6, fill: ICON_TILE },
{ x: 21.4, y: 21.4, w: 5.2, h: 5.2, r: 2.6, fill: ICON_LINE },
{ x: 12, y: 12, w: 4, h: 4, r: 2, fill: ICON_LINE },
{ x: 32, y: 12, w: 4, h: 4, r: 2, fill: ICON_LINE },
{ x: 12, y: 32, w: 4, h: 4, r: 2, fill: ICON_LINE },
{ x: 32, y: 32, w: 4, h: 4, r: 2, fill: ICON_LINE },
];
const drawIcon = (host, size, accent) => {
const unit = size / ICON_GRID;
while (host.firstChild) host.removeChild(host.firstChild);
host.style.width = `${size}rem`;
host.style.height = `${size}rem`;
ICON_PARTS.forEach((part) => {
const node = document.createElement("div");
node.style.position = "absolute";
node.style.left = `${part.x * unit}rem`;
node.style.top = `${part.y * unit}rem`;
node.style.width = `${part.w * unit}rem`;
node.style.height = `${part.h * unit}rem`;
node.style.borderRadius = `${part.r * unit}rem`;
node.style.backgroundColor = part.accent ? accent : part.fill;
if (part.edge) {
node.style.boxSizing = "border-box";
node.style.borderWidth = `${1.2 * unit}rem`;
node.style.borderStyle = "solid";
node.style.borderColor = part.edge;
}
host.appendChild(node);
});
};
const updateButton = () => {
const button = document.querySelector(".modmenuButton");
if (!button) return;
const isMediumScreen = typeof button.closest === "function"
? !!button.closest(".mediaMediumWidth")
: media.width / (media.scale || 1) > 1366;
const physical = media.scale > 1 ? 64 : (isMediumScreen ? 32 : 24);
const size = physical / (media.scale || 1);
const stored = String(model.model.accent || "").replace("#", "");
const accent = /^[0-9a-fA-F]{6}$/.test(stored) ? `#${stored}` : ICON_ACCENT;
const image = button.querySelector(".modmenuIcon");
if (image) {
const signature = `${size}:${accent}`;
if (image.modmenuSignature !== signature) {
image.modmenuSignature = signature;
drawIcon(image, size, accent);
}
}
if (!standalone && document.body) {
if (model.model.hideModsList) {
document.body.classList.add("modmenuSoloButton");
} else {
document.body.classList.remove("modmenuSoloButton");
}
}
if (standalone) {
const root = document.getElementById("root");
if (root) {
root.classList.toggle("modmenuShifted", model.model.placement === "shifted");
}
return;
}
const box = isMediumScreen ? 32 : 24;
const overhang = Math.max(0, (size - box) / 2);
button.style.marginLeft = overhang ? `${overhang}rem` : "";
if (media.scale > 1 && media.scale < 2) {
const offset = media.width * media.scale < 1366 ? 30 : 15;
button.style.marginRight = `${6 + offset / media.scale + overhang}rem`;
} else {
button.style.marginRight = `${6 + overhang}rem`;
}
button.classList.toggle("modmenuOpen", !!model.model.pickerOpen);
if (!updateButton.recheck) {
updateButton.recheck = true;
window.requestAnimationFrame(() => {
updateButton.recheck = false;
updateButton();
reportAnchor();
});
}
};
const parsedEntries = () => {
try {
return JSON.parse(model.model.entriesJson || "[]");
} catch (e) {
return [];
}
};
const requestList = () => {
const entries = parsedEntries();
if (entries.length === 1 && entries[0].source !== "group") {
model.model.onEntryPick({ data: JSON.stringify({ ...entries[0], standalone }) });
return;
}
model.model.onButtonClick({ data: JSON.stringify({ list: true, standalone }) });
};
const reportGeometry = (wrapper) => {
try {
const button = wrapper.querySelector(".modmenuButton");
if (!button) return;
const w = wrapper.getBoundingClientRect();
const b = button.getBoundingClientRect();
model.model.onButtonClick({
data: JSON.stringify({
probe: {
scale: getComputedStyle(document.documentElement).fontSize,
view: [Math.round(window.innerWidth), Math.round(window.innerHeight)],
wrapper: [Math.round(w.left), Math.round(w.top), Math.round(w.width), Math.round(w.height)],
button: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
fromRight: Math.round(w.right - b.right),
fromBottom: Math.round(w.bottom - b.bottom),
cls: wrapper.className,
placement: model.model.placement,
},
}),
});
} catch (e) {
}
};
let lastAnchor = "";
const reportAnchor = () => {
if (standalone) return;
try {
const button = document.querySelector(".modmenuButton");
if (!button) return;
const rect = button.getBoundingClientRect();
if (!rect || !rect.width) return;
const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 1;
const anchor = {
x: Math.round((rect.left + rect.width / 2) / rem),
top: Math.round(rect.top / rem),
};
const signature = `${anchor.x}:${anchor.top}`;
if (signature === lastAnchor) return;
lastAnchor = signature;
model.model.onButtonClick({ data: JSON.stringify({ anchor }) });
} catch (e) {
}
};
const createButton = () => {
const button = document.createElement("div");
button.className = "modmenuButton";
const TOOLTIP_DELAY = 400;
let tooltipTimer = null;
const cancelTooltip = () => {
if (tooltipTimer !== null) {
clearTimeout(tooltipTimer);
tooltipTimer = null;
}
hideTooltip();
};
button.addEventListener("mousedown", (event) => {
cancelTooltip();
if (event.button === 2) {
playSound("play");
model.model.onButtonClick({ data: JSON.stringify({ standalone }) });
return;
}
if (event.button !== 0) return;
playSound("play");
requestList();
});
button.addEventListener("mouseenter", () => {
playSound("highlight");
tooltipTimer = setTimeout(() => {
tooltipTimer = null;
showTooltip(model.model.title, model.model.description);
}, TOOLTIP_DELAY);
});
button.addEventListener("mouseleave", () => {
cancelTooltip();
});
const image = document.createElement("div");
image.className = "modmenuIcon";
button.appendChild(image);
return button;
};
engine.whenReady.then(() => {
media.onUpdate(() => {
updateButton();
});
media.subscribe();
model.onUpdate(() => {
updateButton();
});
model.subscribe();
if (standalone) {
const wrapper = document.querySelector("div.media-wrapper");
if (wrapper) {
wrapper.appendChild(createButton());
updateButton();
reportGeometry(wrapper);
}
return;
}
const observer = new MutationObserver(() => {
const gameMenuButton = document.querySelector('div[data-test-id="menu"]');
const footerSection = gameMenuButton?.parentNode;
if (gameMenuButton && footerSection && !footerSection.querySelector(".modmenuButton")) {
footerSection.insertBefore(createButton(), gameMenuButton);
updateButton();
}
});
observer.observe(document.body, { childList: true, subtree: true });
});