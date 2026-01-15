// Bluefy向けの最小Webアプリ
// 注意：Web Bluetoothはユーザー操作（ボタン）から開始が必要です
// 本FWではtapCharの値は0-255で周回するため、notifyの回数で叩き回数を数えます

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const PATTERN_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";
const TAP_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef2";

const el = (id) => document.getElementById(id);

const views = {
  connect: el("viewConnect"),
  cheer: el("viewCheer"),
  overlay: el("overlay"),
};

const panels = {
  home: el("panelHome"),
  missions: el("panelMissions"),
  gacha: el("panelGacha"),
  collection: el("panelCollection"),
  real: el("panelReal"),
};

const tabs = [
  { id: "tabHome", key: "home" },
  { id: "tabMissions", key: "missions" },
  { id: "tabGacha", key: "gacha" },
  { id: "tabCollection", key: "collection" },
];

const state = {
  device: null,
  server: null,
  service: null,
  patternChar: null,
  tapChar: null,
  isConnected: false,
  lastTapAt: null,
  notifyCount: 0,
  demo: false,
  levelDownAt: 0,
  lastComputedLevel: 0,
  lastWindowHits: 0,
  lastLevelUpAt: 0,
  pendingResult: null,
};

const storage = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function nowMs() { return Date.now(); }

function dateKeyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + da;
}

function initDataIfNeeded() {
  const today = dateKeyLocal();
  const session = storage.read("sessionState", null);
  if (!session || session.dateKey !== today) {
    storage.write("sessionState", {
      dateKey: today,
      totalHits: 0,
      hitTimes: [],
      passionLevel: 0,
      paused: false,
    });
    storage.write("dailyMissions", [
      { id: "m1", title: "30秒で10回こえる", reward: 2, progress: 0, target: 1, achieved: false, claimed: false },
      { id: "m2", title: "合計50回たたく", reward: 1, progress: 0, target: 50, achieved: false, claimed: false },
      { id: "m3", title: "熱さLv3にする", reward: 2, progress: 0, target: 1, achieved: false, claimed: false },
    ]);
  }

  if (storage.read("tickets", null) === null) storage.write("tickets", 0);
  if (storage.read("glitter", null) === null) storage.write("glitter", 0);
  if (storage.read("inventory", null) === null) storage.write("inventory", makeInitialInventory());
  if (storage.read("equippedItemId", null) === null) storage.write("equippedItemId", "");
  if (storage.read("equippedColor", null) === null) storage.write("equippedColor", "");
  if (storage.read("realWishlist", null) === null) storage.write("realWishlist", []);
  if (storage.read("firstBonusClaimed", null) === null) storage.write("firstBonusClaimed", false);
  if (storage.read("settings", null) === null) storage.write("settings", { sens: 50, vibe: 50, strength: 50 });
}

function makeInitialInventory() {
  const items = getItemCatalog();
  // 最初は3つだけ所持している状態でデモしやすくする
  const starter = ["tip_flame_a", "tip_mascot_a", "tip_mech_a"];
  return items.map((it) => ({
    itemId: it.itemId,
    name: it.name,
    ownedCount: starter.includes(it.itemId) ? 1 : 0,
    unlockedColors: starter.includes(it.itemId) ? [it.colors[0]] : [],
  }));
}

function getItemCatalog() {
  return [
    { itemId: "tip_flame_a", name: "ほのおキャップ", rarity: "N", colors: ["#00a7b5", "#0ea5e9", "#22c55e"] },
    { itemId: "tip_flame_b", name: "みずいろほのお", rarity: "N", colors: ["#0ea5e9", "#60a5fa", "#00a7b5"] },
    { itemId: "tip_flame_c", name: "きらめきほのお", rarity: "R", colors: ["#00a7b5", "#34d399", "#a78bfa"] },
    { itemId: "tip_flame_d", name: "ゆめいろほのお", rarity: "R", colors: ["#a78bfa", "#0ea5e9", "#00a7b5"] },
    { itemId: "tip_flame_e", name: "しずくほのお", rarity: "N", colors: ["#00a7b5", "#38bdf8", "#22c55e"] },

    { itemId: "tip_mascot_a", name: "まるまるマスコット", rarity: "N", colors: ["#00a7b5", "#0ea5e9", "#f59e0b"] },
    { itemId: "tip_mascot_b", name: "えがおマスコット", rarity: "N", colors: ["#0ea5e9", "#00a7b5", "#fb7185"] },
    { itemId: "tip_mascot_c", name: "げんきマスコット", rarity: "R", colors: ["#22c55e", "#00a7b5", "#0ea5e9"] },
    { itemId: "tip_mascot_d", name: "おうえんマスコット", rarity: "R", colors: ["#f59e0b", "#0ea5e9", "#00a7b5"] },
    { itemId: "tip_mascot_e", name: "きらきらマスコット", rarity: "SR", colors: ["#a78bfa", "#0ea5e9", "#00a7b5"] },

    { itemId: "tip_mech_a", name: "メカキャップ", rarity: "N", colors: ["#94a3b8", "#00a7b5", "#0ea5e9"] },
    { itemId: "tip_mech_b", name: "ライトメカ", rarity: "N", colors: ["#0ea5e9", "#94a3b8", "#00a7b5"] },
    { itemId: "tip_mech_c", name: "ネオンメカ", rarity: "R", colors: ["#00a7b5", "#22c55e", "#0ea5e9"] },
    { itemId: "tip_mech_d", name: "スターギア", rarity: "R", colors: ["#f59e0b", "#94a3b8", "#0ea5e9"] },
    { itemId: "tip_mech_e", name: "オーロラギア", rarity: "SR", colors: ["#a78bfa", "#22c55e", "#0ea5e9"] },
  ];
}

function pickGachaItem() {
  const catalog = getItemCatalog();
  // ハズレ無し。演出用にSRを少しだけ低確率
  // 重み: N=80, R=18, SR=2
  const pool = [];
  for (const it of catalog) {
    let w = 1;
    if (it.rarity === "N") w = 80;
    if (it.rarity === "R") w = 18;
    if (it.rarity === "SR") w = 2;
    for (let i = 0; i < w; i++) pool.push(it);
  }
  const idx = Math.floor(Math.random() × pool.length);
  return pool[idx];
}

function setConnPill(kind, text) {
  const pill = el("connPill");
  pill.classList.remove("pill-muted", "pill-ok", "pill-warn");
  pill.classList.add(kind);
  pill.textContent = text;
}

function setConnectViewState(stateText) {
  el("connState").textContent = stateText;
}

function showView(name) {
  for (const k of Object.keys(views)) {
    views[k].hidden = k !== name;
  }
}

function showOverlay(show) {
  views.overlay.hidden = !show;
  if (show) {
    setTab("home");
    renderAll();
  }
}

function setTab(tabKey) {
  for (const t of tabs) {
    const btn = el(t.id);
    const active = t.key === tabKey;
    btn.classList.toggle("tab-active", active);
  }
  for (const k of Object.keys(panels)) {
    panels[k].hidden = true;
  }
  if (tabKey === "home") panels.home.hidden = false;
  if (tabKey === "missions") panels.missions.hidden = false;
  if (tabKey === "gacha") panels.gacha.hidden = false;
  if (tabKey === "collection") panels.collection.hidden = false;
}

function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 1400);
}

function bluetoothSupported() {
  return !!navigator.bluetooth;
}

async function requestDevice() {
  if (!bluetoothSupported()) {
    el("bluetoothSupport").hidden = false;
    return;
  }
  el("bluetoothSupport").hidden = true;

  setConnectViewState("選択中…");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });
    state.device = device;
    el("deviceName").textContent = device.name || "不明なデバイス";
    el("btnConnect").disabled = false;
    setConnectViewState("デバイス選択済み");
  } catch (e) {
    setConnectViewState("未接続");
    toast("キャンセルしました");
  }
}

async function connectGatt() {
  if (!state.device) return;

  setConnectViewState("接続中…");
  setConnPill("pill-warn", "接続中…");

  try {
    state.device.addEventListener("gattserverdisconnected", onDisconnected);
    const server = await state.device.gatt.connect();
    state.server = server;

    const service = await server.getPrimaryService(SERVICE_UUID);
    state.service = service;

    const patternChar = await service.getCharacteristic(PATTERN_CHAR_UUID);
    const tapChar = await service.getCharacteristic(TAP_CHAR_UUID);

    state.patternChar = patternChar;
    state.tapChar = tapChar;

    tapChar.addEventListener("characteristicvaluechanged", onTapNotify);
    await tapChar.startNotifications();

    state.isConnected = true;
    state.demo = false;

    setConnectViewState("接続できた！");
    setConnPill("pill-ok", "接続OK");
    el("btnStart").disabled = false;

    renderAll();
    toast("つながりました");
  } catch (e) {
    state.isConnected = false;
    setConnectViewState("接続に失敗");
    setConnPill("pill-warn", "未接続");
    el("btnStart").disabled = true;
    toast("接続できませんでした");
  }
}

function onDisconnected() {
  state.isConnected = false;
  state.patternChar = null;
  state.tapChar = null;
  setConnPill("pill-warn", "切断");
  el("panelConn").textContent = "切断";
  toast("切れました");
}

function setTodayLabel() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const da = d.getDate();
  el("todayLabel").textContent = "きょう " + m + "月" + da + "日";
}

function readSession() {
  return storage.read("sessionState", { dateKey: dateKeyLocal(), totalHits: 0, hitTimes: [], passionLevel: 0, paused: false });
}

function writeSession(session) {
  storage.write("sessionState", session);
}

function pruneHitTimes(hitTimes, now) {
  const threshold = now - 30000;
  let idx = 0;
  while (idx < hitTimes.length && hitTimes[idx] < threshold) idx++;
  if (idx > 0) hitTimes.splice(0, idx);
  return hitTimes;
}

function computePassionLevel(windowHits) {
  if (windowHits >= 25) return 4;
  if (windowHits >= 20) return 3;
  if (windowHits >= 15) return 2;
  if (windowHits >= 10) return 1;
  return 0;
}

function scheduleLevelDownIfNeeded(newLevel) {
  // 急落防止：レベルが下がるのは少し待つ
  const now = nowMs();
  if (newLevel >= state.lastComputedLevel) {
    state.levelDownAt = 0;
    return;
  }
  if (state.levelDownAt === 0) state.levelDownAt = now + 3000;
}

function currentEffectiveLevel(session, computedLevel) {
  const now = nowMs();
  if (computedLevel >= session.passionLevel) return computedLevel;

  scheduleLevelDownIfNeeded(computedLevel);
  if (state.levelDownAt !== 0 && now < state.levelDownAt) {
    return session.passionLevel;
  }
  return computedLevel;
}

function updateDots(level) {
  for (let i = 1; i <= 5; i++) {
    const dot = el("dot" + i);
    dot.classList.toggle("dot-on", i <= level + 1);
  }
}

function applyFlameLevel(level) {
  const flame = el("flame");
  flame.classList.remove("flame-lv0", "flame-lv1", "flame-lv2", "flame-lv3", "flame-lv4");
  flame.classList.add("flame-lv" + level);
  updateDots(level);
}

function missionList() {
  return storage.read("dailyMissions", []);
}

function writeMissions(list) {
  storage.write("dailyMissions", list);
}

function checkAndUpdateMissions(session, windowHits, effectiveLevel) {
  const missions = missionList();
  let changed = false;

  for (const m of missions) {
    if (m.id === "m1") {
      if (!m.achieved && windowHits >= 10) { m.achieved = true; changed = true; }
      m.progress = m.achieved ? 1 : 0;
    }
    if (m.id === "m2") {
      const p = Math.min(session.totalHits, 50);
      if (m.progress !== p) { m.progress = p; changed = true; }
      if (!m.achieved && session.totalHits >= 50) { m.achieved = true; changed = true; }
    }
    if (m.id === "m3") {
      if (!m.achieved && effectiveLevel >= 3) { m.achieved = true; changed = true; }
      m.progress = m.achieved ? 1 : 0;
    }
  }

  if (changed) writeMissions(missions);
}

function onTapNotify(evt) {
  state.lastTapAt = nowMs();
  state.notifyCount++;

  const session = readSession();
  if (session.paused) {
    renderCheer();
    renderParentHome();
    return;
  }

  session.totalHits += 1;
  session.hitTimes.push(state.lastTapAt);
  pruneHitTimes(session.hitTimes, state.lastTapAt);
  const windowHits = session.hitTimes.length;

  const computedLevel = computePassionLevel(windowHits);
  state.lastWindowHits = windowHits;
  state.lastComputedLevel = computedLevel;

  const effectiveLevel = currentEffectiveLevel(session, computedLevel);
  session.passionLevel = effectiveLevel;

  // レベルアップ時演出
  if (effectiveLevel > session.passionLevel) {
    state.lastLevelUpAt = nowMs();
  }

  writeSession(session);

  checkAndUpdateMissions(session, windowHits, effectiveLevel);

  renderCheer();
  renderParentHome();
}

function tickCheer() {
  const session = readSession();
  const now = nowMs();
  pruneHitTimes(session.hitTimes, now);
  const windowHits = session.hitTimes.length;
  const computedLevel = computePassionLevel(windowHits);
  const effectiveLevel = currentEffectiveLevel(session, computedLevel);

  if (effectiveLevel !== session.passionLevel) {
    session.passionLevel = effectiveLevel;
    writeSession(session);
  }

  state.lastWindowHits = windowHits;
  state.lastComputedLevel = computedLevel;

  renderCheer();
  renderParentHome();
}

function renderCheer() {
  const session = readSession();
  el("hitCount").textContent = String(session.totalHits);

  applyFlameLevel(session.passionLevel);

  el("pauseBanner").hidden = !session.paused;

  const equippedId = storage.read("equippedItemId", "");
  const inv = storage.read("inventory", []);
  const item = inv.find((x) => x.itemId === equippedId && x.ownedCount > 0);
  const name = item ? item.name : "なし";
  el("equippedName").textContent = name;

  const equippedColor = storage.read("equippedColor", "");
  const color = equippedColor || (item && item.unlockedColors && item.unlockedColors[0]) || "rgba(0,167,181,0.25)";
  const tip = el("batTip");
  tip.style.background = color;
  tip.style.borderColor = "rgba(0,167,181,0.30)";
}

function renderParentHome() {
  const session = readSession();
  el("panelConn").textContent = state.isConnected ? "接続OK" : (state.demo ? "デモ" : "未接続");
  el("panelTotal").textContent = session.totalHits + "回";
  el("panelWindow").textContent = state.lastWindowHits + "回";
  el("panelLevel").textContent = "Lv" + session.passionLevel;

  const lastTapText = state.lastTapAt ? new Date(state.lastTapAt).toLocaleTimeString("ja-JP") : "なし";
  el("panelLastTap").textContent = lastTapText;

  const btnPause = el("btnPause");
  btnPause.textContent = session.paused ? "再開" : "いったん止める";
}

function renderMissions() {
  const tickets = storage.read("tickets", 0);
  el("ticketCount").textContent = String(tickets);
  el("ticketCount2").textContent = String(tickets);

  const firstClaimed = storage.read("firstBonusClaimed", false);
  el("firstBonusCard").hidden = firstClaimed;

  const list = missionList();
  const wrap = el("missionsList");
  wrap.innerHTML = "";

  for (const m of list) {
    const row = document.createElement("div");
    row.className = "item-row";

    const left = document.createElement("div");
    left.className = "item-left";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = m.title;
    const sub = document.createElement("div");
    sub.className = "item-sub";
    if (m.id === "m2") sub.textContent = m.progress + " / 50";
    else sub.textContent = m.progress + " / 1";
    left.appendChild(name);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = "チケット" + m.reward;
    actions.appendChild(badge);

    const btn = document.createElement("button");
    btn.className = "small-btn";
    btn.textContent = m.claimed ? "受取済み" : (m.achieved ? "うけとる" : "未達成");
    btn.disabled = m.claimed || !m.achieved;
    btn.addEventListener("click", () => claimMission(m.id));
    actions.appendChild(btn);

    row.appendChild(left);
    row.appendChild(actions);
    wrap.appendChild(row);
  }
}

function claimMission(id) {
  const list = missionList();
  const m = list.find((x) => x.id === id);
  if (!m || !m.achieved || m.claimed) return;
  m.claimed = true;
  writeMissions(list);

  const tickets = storage.read("tickets", 0) + m.reward;
  storage.write("tickets", tickets);
  toast("チケット +" + m.reward);
  renderAll();
}

function claimFirstBonus() {
  const claimed = storage.read("firstBonusClaimed", false);
  if (claimed) return;
  storage.write("firstBonusClaimed", true);
  const tickets = storage.read("tickets", 0) + 10;
  storage.write("tickets", tickets);
  toast("チケット +10");
  renderAll();
}

function renderGacha() {
  el("glitterCount").textContent = String(storage.read("glitter", 0));
  const resultCard = el("gachaResult");
  if (state.pendingResult) {
    resultCard.hidden = false;
    el("resultName").textContent = state.pendingResult.name;
    const v = el("resultVisual");
    v.style.background = "linear-gradient(180deg, rgba(0,167,181,0.22), rgba(14,165,233,0.10))";
  } else {
    resultCard.hidden = true;
  }
}

function renderCollection() {
  const equippedId = storage.read("equippedItemId", "");
  const inv = storage.read("inventory", []);
  const wishlist = storage.read("realWishlist", []);

  const equippedItem = inv.find((x) => x.itemId === equippedId && x.ownedCount > 0);
  el("equippedNow").textContent = equippedItem ? equippedItem.name : "なし";

  const grid = el("itemsGrid");
  grid.innerHTML = "";
  for (const item of inv) {
    if (item.ownedCount <= 0) continue;

    const card = document.createElement("div");
    card.className = "grid-card";

    const visual = document.createElement("div");
    visual.className = "grid-visual";
    const color = (item.unlockedColors && item.unlockedColors[0]) || "#00a7b5";
    visual.style.background = "linear-gradient(180deg, " + color + "33, rgba(14,165,233,0.08))";

    const title = document.createElement("div");
    title.className = "grid-title";
    title.textContent = item.name;

    const sub = document.createElement("div");
    sub.className = "grid-sub";
    sub.textContent = "所持 " + item.ownedCount;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const btnEquip = document.createElement("button");
    btnEquip.className = "small-btn";
    btnEquip.textContent = (item.itemId === equippedId) ? "装着中" : "つける";
    btnEquip.disabled = item.itemId === equippedId;
    btnEquip.addEventListener("click", () => equipItem(item.itemId));
    actions.appendChild(btnEquip);

    const toggleWrap = document.createElement("label");
    toggleWrap.className = "toggle";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = wishlist.includes(item.itemId);
    chk.addEventListener("change", () => toggleWishlist(item.itemId, chk.checked));
    const ttxt = document.createElement("span");
    ttxt.textContent = "現物化候補";
    toggleWrap.appendChild(chk);
    toggleWrap.appendChild(ttxt);

    card.appendChild(visual);
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(actions);
    card.appendChild(toggleWrap);

    grid.appendChild(card);
  }

  const w = el("wishlist");
  w.innerHTML = "";
  for (const id of wishlist) {
    const it = inv.find((x) => x.itemId === id);
    if (!it) continue;
    const row = document.createElement("div");
    row.className = "item-row";
    const left = document.createElement("div");
    left.className = "item-left";
    const nm = document.createElement("div");
    nm.className = "item-name";
    nm.textContent = it.name;
    const sub2 = document.createElement("div");
    sub2.className = "item-sub";
    sub2.textContent = "候補";
    left.appendChild(nm);
    left.appendChild(sub2);
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const btn = document.createElement("button");
    btn.className = "small-btn-ghost";
    btn.textContent = "はずす";
    btn.addEventListener("click", () => toggleWishlist(id, false));
    actions.appendChild(btn);
    row.appendChild(left);
    row.appendChild(actions);
    w.appendChild(row);
  }
}

function equipItem(itemId) {
  const inv = storage.read("inventory", []);
  const item = inv.find((x) => x.itemId === itemId && x.ownedCount > 0);
  if (!item) return;
  storage.write("equippedItemId", itemId);
  const color = item.unlockedColors && item.unlockedColors[0] ? item.unlockedColors[0] : "";
  storage.write("equippedColor", color);
  toast("つけた！");
  renderAll();
}

function toggleWishlist(itemId, on) {
  const list = storage.read("realWishlist", []);
  const idx = list.indexOf(itemId);
  if (on && idx === -1) list.push(itemId);
  if (!on && idx !== -1) list.splice(idx, 1);
  storage.write("realWishlist", list);
  renderAll();
}

function openRealPanel() {
  panels.collection.hidden = true;
  panels.real.hidden = false;

  const inv = storage.read("inventory", []);
  const wishlist = storage.read("realWishlist", []);
  const realList = el("realList");
  realList.innerHTML = "";
  for (const id of wishlist) {
    const it = inv.find((x) => x.itemId === id);
    if (!it) continue;
    const row = document.createElement("div");
    row.className = "item-row";
    const left = document.createElement("div");
    left.className = "item-left";
    const nm = document.createElement("div");
    nm.className = "item-name";
    nm.textContent = it.name;
    const sub = document.createElement("div");
    sub.className = "item-sub";
    sub.textContent = "プロト";
    left.appendChild(nm);
    left.appendChild(sub);
    row.appendChild(left);
    realList.appendChild(row);
  }
  el("realNext").hidden = true;
}

function backFromRealPanel() {
  panels.real.hidden = true;
  panels.collection.hidden = false;
}

function bindRealGate() {
  const btn = el("btnRealGate");
  let timer = null;

  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      el("realNext").hidden = false;
      toast("次へ");
    }, 2000);
  };
  const end = () => {
    clearTimeout(timer);
  };

  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", end);
  btn.addEventListener("pointerleave", end);
}

async function writePattern(id) {
  if (!state.patternChar) {
    toast("未接続");
    return;
  }
  try {
    await state.patternChar.writeValue(Uint8Array.of(id));
    toast("送信しました");
  } catch (e) {
    toast("送れませんでした");
  }
}

function rollGacha() {
  const tickets = storage.read("tickets", 0);
  if (tickets < 1) {
    toast("チケットが足りません");
    return;
  }
  storage.write("tickets", tickets - 1);

  const pick = pickGachaItem();
  state.pendingResult = pick;

  const inv = storage.read("inventory", []);
  const item = inv.find((x) => x.itemId === pick.itemId);
  if (item) {
    if (item.ownedCount > 0) {
      // かぶり：色が残っていれば解放、なければキラ粉
      const nextColor = nextUnlockColor(pick, item);
      if (nextColor) {
        item.unlockedColors.push(nextColor);
      } else {
        storage.write("glitter", storage.read("glitter", 0) + 1);
      }
      item.ownedCount += 1;
    } else {
      item.ownedCount = 1;
      item.unlockedColors = [pick.colors[0]];
    }
  }

  storage.write("inventory", inv);
  renderAll();
}

function nextUnlockColor(catalogItem, invItem) {
  const unlocked = new Set(invItem.unlockedColors || []);
  for (const c of catalogItem.colors) {
    if (!unlocked.has(c)) return c;
  }
  return "";
}

function renderAll() {
  const tickets = storage.read("tickets", 0);
  el("ticketCount").textContent = String(tickets);
  el("ticketCount2").textContent = String(tickets);

  renderCheer();
  renderParentHome();
  renderMissions();
  renderGacha();
  renderCollection();

  el("glitterCount").textContent = String(storage.read("glitter", 0));

  const s = storage.read("settings", { sens: 50, vibe: 50, strength: 50 });
  el("sens").value = s.sens;
  el("vibe").value = s.vibe;
  el("strength").value = s.strength;
}

function bindUi() {
  if (!bluetoothSupported()) el("bluetoothSupport").hidden = false;

  el("btnScan").addEventListener("click", requestDevice);
  el("btnConnect").addEventListener("click", connectGatt);

  el("btnStart").addEventListener("click", () => {
    showView("cheer");
    setTodayLabel();
    tickCheer();
    toast("応援スタート");
  });

  el("btnDemo").addEventListener("click", () => {
    state.demo = true;
    state.isConnected = false;
    setConnPill("pill-ok", "デモ");
    el("btnStart").disabled = false;
    showView("cheer");
    setTodayLabel();
    toast("デモ開始");
    startDemoTaps();
  });

  el("btnParent").addEventListener("click", () => showOverlay(true));
  el("btnCloseOverlay").addEventListener("click", () => showOverlay(false));

  for (const t of tabs) {
    el(t.id).addEventListener("click", () => {
      setTab(t.key);
      panels.real.hidden = true;
      el("realNext").hidden = true;
      renderAll();
    });
  }

  el("btnClaimFirst").addEventListener("click", claimFirstBonus);

  el("btnRoll").addEventListener("click", () => {
    rollGacha();
    toast("ひいた！");
  });

  el("btnEquipResult").addEventListener("click", () => {
    if (!state.pendingResult) return;
    equipItem(state.pendingResult.itemId);
    state.pendingResult = null;
    renderAll();
  });

  el("btnCloseResult").addEventListener("click", () => {
    state.pendingResult = null;
    renderAll();
  });

  el("btnGoReal").addEventListener("click", openRealPanel);
  el("btnBackFromReal").addEventListener("click", backFromRealPanel);

  bindRealGate();

  el("btnEvtPoint").addEventListener("click", () => writePattern(0));
  el("btnEvtChance").addEventListener("click", () => writePattern(1));
  el("btnEvtPinch").addEventListener("click", () => writePattern(2));
  el("btnEvtStop").addEventListener("click", () => writePattern(255));

  el("btnReconnect").addEventListener("click", async () => {
    if (state.device && state.device.gatt && !state.device.gatt.connected) {
      await connectGatt();
    } else if (state.isConnected) {
      toast("接続中です");
    } else {
      toast("デバイスを選んでください");
    }
  });

  el("btnDisconnect").addEventListener("click", () => {
    try {
      if (state.device && state.device.gatt && state.device.gatt.connected) state.device.gatt.disconnect();
    } catch (e) {}
    state.isConnected = false;
    setConnPill("pill-muted", "未接続");
    toast("きりはなしました");
  });

  el("btnPause").addEventListener("click", () => {
    const session = readSession();
    session.paused = !session.paused;
    writeSession(session);
    toast(session.paused ? "休憩" : "再開");
    renderAll();
  });

  el("btnEnd").addEventListener("click", () => {
    const session = readSession();
    session.totalHits = 0;
    session.hitTimes = [];
    session.passionLevel = 0;
    session.paused = false;
    writeSession(session);
    toast("おわりました");
    renderAll();
  });

  el("sens").addEventListener("input", () => saveSettings());
  el("vibe").addEventListener("input", () => saveSettings());
  el("strength").addEventListener("input", () => saveSettings());
}

function saveSettings() {
  storage.write("settings", {
    sens: Number(el("sens").value),
    vibe: Number(el("vibe").value),
    strength: Number(el("strength").value),
  });
}

function startDemoTaps() {
  // デモ用：画面をタップしたら叩き扱いにする
  const cheer = el("viewCheer");
  cheer.addEventListener("click", () => {
    if (!state.demo) return;
    // notifyが来た体で処理
    onTapNotify({ target: { value: null } });
  });
}

function boot() {
  initDataIfNeeded();
  bindUi();
  setConnPill("pill-muted", "未接続");
  showView("connect");

  // 定期更新：30秒窓の減衰を反映
  setInterval(() => {
    if (!views.cheer.hidden) tickCheer();
  }, 300);
}

boot();
