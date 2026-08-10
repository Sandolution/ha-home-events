/* home-events-panel — the Events editor in the sidebar.
 *
 * Hand-written, no build step. This host has no JavaScript runtime, so nothing
 * here can be compiled, bundled or type-checked; the same constraint shaped the
 * four cards and it shapes this. Plain custom element, plain DOM, one
 * stylesheet, no framework.
 *
 * Three rules it is built on.
 *
 * Every control exists because a key exists, and no control exists without one.
 * The form cannot describe an event the card would refuse, and it has no
 * vocabulary of its own to learn.
 *
 * A control that is only meaningful in some configurations is only on screen in
 * those configurations. `match: any|all` appears when a filter names its second
 * dimension, which is exactly when the card starts demanding it; the one/many
 * wording appears when the event groups, because a row that does not count has
 * nothing to count.
 *
 * Nothing here answers a question the card can answer. "Matches 24 entities"
 * comes from the card's own filter engine, imported; YAML is parsed by the
 * integration and nowhere else. A second implementation that agreed would be a
 * worse bug than any it could catch, because it would be confidently right
 * about a card that is wrong.
 */

const PANEL_BUILD = "2026-08-11a";

/* The seven dimensions, in the order the ladder ranks them: the most specific
 * way of naming a thing first, because that is the order somebody reaches for
 * them in. `pick` names the Home Assistant element that knows about that kind
 * of thing, and `reg` the registry to show names from. */
const FILTER_DIMS = [
  { key: "entities", label: "Entity", pick: "ha-entity-picker" },
  { key: "entity_globs", label: "Pattern", pick: null, hint: "light.*stairs*" },
  { key: "devices", label: "Device", pick: "ha-device-picker", reg: "devices" },
  { key: "labels", label: "Label", pick: "ha-label-picker", reg: "labels" },
  { key: "areas", label: "Area", pick: "ha-area-picker", reg: "areas" },
  { key: "floors", label: "Floor", pick: "ha-floor-picker", reg: "floors" },
  { key: "domains", label: "Domain", pick: null, hint: "light" },
];

const SEVERITIES = [
  { key: null, label: "Default" },
  { key: "alert", label: "Alert" },
  { key: "attention", label: "Attention" },
  { key: "active", label: "Active" },
  { key: "info", label: "Info" },
];
const GROUPS = [
  { key: null, label: "No" },
  { key: "area", label: "Per room" },
  { key: "all", label: "One row" },
];
const TIME_MODES = ["since", "until", "ago", "remaining"];
/* The card's PLURAL_KEYS: the slots a counting row may word two ways. */
const PLURAL_KEYS = ["title", "status", "icon"];

const TEXT_SLOTS = [
  { key: "title", label: "Title", hint: "The domain's own wording" },
  { key: "detail", label: "Detail", hint: "Usually the room" },
  { key: "status", label: "Status", hint: "The domain's own wording" },
  { key: "icon", label: "Icon", hint: "mdi:…" },
];

const STARTER = {
  category: "alerts",
  include: { domains: ["binary_sensor"] },
  conditions: [{ condition: "state", state: "on" }],
  severity: "alert",
};

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const humanise = (s) =>
  String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* `for:` is a clock string, a number of seconds, or the mapping the
 * automation editor writes. String() on the mapping is the [object Object]
 * this project has already shipped once. */
function duration(value) {
  if (value && typeof value === "object") {
    const p = (n) => String(n || 0).padStart(2, "0");
    return `${p(value.hours)}:${p(value.minutes)}:${p(value.seconds)}`;
  }
  return String(value);
}

/* window.confirm is a browser convenience rather than a guarantee. Where it
 * is missing, the answer is yes: the alternative is a panel that cannot
 * discard a draft because it cannot ask about it. */
const ask = (question) =>
  typeof confirm === "function" ? confirm(question) : true;

const clone = (v) => JSON.parse(JSON.stringify(v == null ? null : v));

/* Home Assistant registers ha-entity-picker and its siblings lazily, as pages
 * use them, and a panel page uses almost none of them. This is the way in that
 * every custom card editor uses: ask the frontend for its card helpers, build
 * a throwaway entities card, and ask that card for its config element - which
 * imports the pickers on the way.
 *
 * It is not a documented promise, so nothing here depends on it working. What
 * it returns is which elements turned up; the form asks that before drawing a
 * picker and falls back to a text field, which is no worse than typing the
 * same thing into YAML. */
async function loadHaComponents() {
  const want = ["ha-entity-picker", "ha-area-picker", "ha-floor-picker",
                "ha-label-picker", "ha-device-picker", "ha-icon-picker"];
  const have = () => want.filter((n) => !!customElements.get(n));
  if (have().length === want.length) return have();
  try {
    const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
    if (helpers) {
      const card = await helpers.createCardElement({ type: "entities", entities: [] });
      if (card && card.constructor && card.constructor.getConfigElement) {
        await card.constructor.getConfigElement();
      }
    }
  } catch (err) {
    console.warn("home-events-panel: could not preload Home Assistant's pickers", err);
  }

  /* That gets four of the six. ha-floor-picker and ha-device-picker are not
   * reached by an entities card's editor, and measuring which ones turned up
   * is the only way anyone would know - they simply would not appear.
   *
   * ha-selector is core's dispatcher: handed a selector it imports the element
   * that draws it. So the ones still missing are asked for by name, off
   * screen, and then thrown away. Anything that still does not turn up falls
   * back to a text field. */
  if (have().length < want.length && customElements.get("ha-selector")) {
    const stage = document.createElement("div");
    stage.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
    document.body.appendChild(stage);
    try {
      for (const kind of ["entity", "device", "area", "floor", "label", "icon"]) {
        const sel = document.createElement("ha-selector");
        sel.selector = { [kind]: {} };
        stage.appendChild(sel);
      }
      /* Two frames: one for the dispatcher to run, one for what it imported
       * to define itself. */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await Promise.race([
        Promise.all(want.map((n) => customElements.whenDefined(n))),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (err) {
      console.warn("home-events-panel: ha-selector would not fetch the rest", err);
    } finally {
      stage.remove();
    }
  }
  return have();
}

/* The card's own filter engine, from wherever Lovelace is serving the card.
 * Versioned URL and all - the resource record is the only place that knows
 * which build is current. Missing card, missing count: the form still works,
 * it just stops being able to say how many entities a filter selects. */
async function loadEngine(hass) {
  try {
    const rows = await hass.callWS({ type: "lovelace/resources" });
    const row = (rows || []).find((r) => /home-event-card\.js/.test(r.url || ""));
    if (!row) return null;
    return await import(row.url);
  } catch (err) {
    console.warn("home-events-panel: no filter engine, so no match counts", err);
    return null;
  }
}

class HomeEventsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._presets = {};
    this._presetId = "default";
    this._selected = null;
    this._renamedFrom = null;
    this._draft = null;
    this._name = "";
    this._mode = "form"; // form | yaml | library
    this._dirty = false;
    this._built = false;
    this._pickers = [];
    this._pending = [];
    this._reg = { areas: {}, floors: {}, labels: {}, devices: {} };
    this._engine = null;
    this._match = null;
    this._showMatches = false;
    this._unsub = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._start();
  }

  get hass() {
    return this._hass;
  }

  set narrow(_v) {}
  set route(_v) {}
  set panel(_v) {}

  connectedCallback() {
    if (!this._built) this._build();
    if (this._hass && !this._unsub) this._subscribe();
  }

  disconnectedCallback() {
    if (this._unsub) {
      this._unsub.then((off) => off()).catch(() => {});
      this._unsub = null;
    }
  }

  /* ------------------------------------------------------------- the wire */

  _ws(payload) {
    return this._hass.connection.sendMessagePromise(payload);
  }

  _subscribe() {
    this._unsub = this._hass.connection.subscribeMessage(
      () => this._reload(),
      { type: "home_events/subscribe" }
    );
  }

  async _start() {
    const [, elements, engine] = await Promise.all([
      this._loadRegistries(),
      loadHaComponents(),
      loadEngine(this._hass),
    ]);
    this._elements = elements;
    this._engine = engine;
    await this._load();
  }

  /* Names, not ids, everywhere a person reads them. Four labels in this house
   * have ids that no longer match what they are called, which is exactly the
   * kind of thing an editor showing raw ids would quietly hand back. */
  async _loadRegistries() {
    const kinds = [
      ["areas", "config/area_registry/list", "area_id"],
      ["floors", "config/floor_registry/list", "floor_id"],
      ["labels", "config/label_registry/list", "label_id"],
      ["devices", "config/device_registry/list", "id"],
    ];
    await Promise.all(kinds.map(async ([key, type, id]) => {
      try {
        const list = await this._hass.callWS({ type });
        const map = {};
        for (const row of list || []) map[row[id]] = row;
        this._reg[key] = map;
      } catch (err) {
        this._reg[key] = {};
      }
    }));
  }

  async _load() {
    try {
      const res = await this._ws({ type: "home_events/get" });
      this._presets = res.presets || {};
      if (!this._presets[this._presetId]) {
        this._presetId = Object.keys(this._presets)[0] || "default";
      }
      this._renderShell();
      const names = Object.keys(this._events());
      if (names.length) this._openEvent(names[0]);
      else this._newEvent();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _reload() {
    const res = await this._ws({ type: "home_events/get" });
    this._presets = res.presets || {};
    this._renderList();
    if (this._dirty) this._say("Changed elsewhere. Your edit is still here.");
  }

  _preset() {
    return this._presets[this._presetId] || { events: {}, categories: [] };
  }

  _events() {
    return this._preset().events || {};
  }

  _categories() {
    const declared = (this._preset().categories || []).map((c) => c.id);
    for (const e of Object.values(this._events())) {
      if (e.category && declared.indexOf(e.category) === -1) declared.push(e.category);
    }
    if (!declared.length) declared.push("alerts");
    return declared;
  }

  _catLabel(id) {
    const c = (this._preset().categories || []).find((x) => x.id === id);
    return (c && c.label) || humanise(id);
  }

  /* ---------------------------------------------------------------- shell */

  _build() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="app">
        <header class="bar">
          <button class="icon" data-act="menu" title="Sidebar">&#9776;</button>
          <div class="title">Events</div>
          <select class="preset"></select>
          <span class="grow"></span>
          <button class="ghost" data-act="library">Whole library</button>
          <button class="ghost" data-act="new">New event</button>
        </header>
        <main>
          <aside class="list"></aside>
          <section class="editor">
            <div class="ed-head">
              <input class="name" spellcheck="false" autocomplete="off"
                     placeholder="event_name">
              <div class="tabs">
                <button data-act="tab-form" class="tab">Form</button>
                <button data-act="tab-yaml" class="tab">YAML</button>
              </div>
              <span class="grow"></span>
              <button class="ghost danger" data-act="delete">Delete</button>
              <button class="primary" data-act="save">Save</button>
            </div>
            <div class="pane"></div>
            <div class="msg"></div>
          </section>
        </main>
      </div>`;

    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      list: $(".list"), name: $(".name"), pane: $(".pane"), msg: $(".msg"),
      preset: $(".preset"), del: $('[data-act="delete"]'), tabs: $(".tabs"),
    };

    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("input", (e) => this._onInput(e));
    this.shadowRoot.addEventListener("change", (e) => this._onInput(e));
    this.shadowRoot.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this._save();
      }
    });
    this._el.name.addEventListener("input", () => {
      this._name = this._el.name.value;
      this._dirty = true;
    });
    this._el.preset.addEventListener("change", (e) => {
      this._presetId = e.target.value;
      this._load();
    });
    this._built = true;
  }

  _renderShell() {
    const ids = Object.keys(this._presets);
    this._el.preset.innerHTML = ids
      .map((id) => `<option value="${esc(id)}"${id === this._presetId ? " selected" : ""}>` +
        `${esc(this._presets[id].name || humanise(id))}</option>`)
      .join("");
    this._el.preset.style.display = ids.length > 1 ? "" : "none";
    this._renderList();
  }

  _renderList() {
    const events = this._events();
    const names = Object.keys(events);
    if (!names.length) {
      this._el.list.innerHTML =
        `<div class="empty">Nothing here yet.<br><br>` +
        `<b>New event</b> starts one. <b>Whole library</b> takes a whole ` +
        `preset pasted in as YAML.</div>`;
      return;
    }
    const order = [];
    const buckets = {};
    for (const name of names) {
      const cat = events[name].category || "generic";
      if (!buckets[cat]) {
        buckets[cat] = [];
        order.push(cat);
      }
      buckets[cat].push(name);
    }
    const declared = (this._preset().categories || []).map((c) => c.id);
    order.sort((a, b) => {
      const ia = declared.indexOf(a), ib = declared.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    this._el.list.innerHTML = order.map((cat) => {
      const rows = buckets[cat].map((name) => {
        const e = events[name];
        const off = e.enabled === false;
        const sel = name === this._selected && this._mode !== "library";
        const what = [
          e.group ? "grouped" : "",
          (e.conditions || []).length
            ? `${e.conditions.length} condition${e.conditions.length > 1 ? "s" : ""}`
            : "any state",
        ].filter(Boolean).join(" · ");
        return `<div class="row${sel ? " sel" : ""}${off ? " off" : ""}" ` +
          `data-event="${esc(name)}" tabindex="0">` +
          `<span class="dot sev-${esc(e.severity || "info")}"></span>` +
          `<span class="nm">${esc(name)}</span>` +
          `<span class="sub">${esc(what)}</span></div>`;
      }).join("");
      return `<div class="cat">${esc(this._catLabel(cat))}</div>${rows}`;
    }).join("");
  }

  /* --------------------------------------------------------------- opening */

  async _openEvent(name) {
    if (!(await this._confirmDiscard())) return;
    const event = this._events()[name];
    if (!event) return;
    this._selected = name;
    this._renamedFrom = name;
    this._name = name;
    this._draft = clone(event) || {};
    this._mode = "form";
    this._dirty = false;
    this._match = null;
    this._showMatches = false;
    this._el.name.value = name;
    this._el.name.disabled = false;
    this._el.del.style.display = "";
    this._el.tabs.style.display = "";
    this._say("");
    this._renderList();
    this._renderPane();
  }

  async _newEvent() {
    if (!(await this._confirmDiscard())) return;
    this._selected = null;
    this._renamedFrom = null;
    this._name = "";
    this._draft = clone(STARTER);
    this._mode = "form";
    this._dirty = true;
    this._match = null;
    this._el.name.value = "";
    this._el.name.disabled = false;
    this._el.del.style.display = "none";
    this._el.tabs.style.display = "";
    this._say("Name it, then save. The name is what a card refers to.");
    this._renderList();
    this._renderPane();
    this._el.name.focus();
  }

  async _openLibrary() {
    if (!(await this._confirmDiscard())) return;
    try {
      const res = await this._ws({ type: "home_events/export", preset: this._presetId });
      this._mode = "library";
      this._selected = null;
      this._renamedFrom = null;
      this._draft = null;
      this._el.name.value = this._preset().name || this._presetId;
      this._el.name.disabled = true;
      this._el.del.style.display = "none";
      this._el.tabs.style.display = "none";
      this._dirty = false;
      this._renderPane(res.yaml);
      this._say("The whole preset, categories and all. Paste one in to replace it.");
      this._renderList();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  /* Both tabs describe the same event and only one of them is holding what
   * has been typed, so switching with unsaved work asks first rather than
   * quietly keeping whichever copy the server last saw. */
  async _toForm() {
    if (this._mode === "form") return;
    if (!(await this._confirmDiscard())) return;
    this._draft = this._selected ? clone(this._events()[this._selected]) || {} : this._draft;
    this._mode = "form";
    this._dirty = false;
    this._renderPane();
  }

  async _openYaml() {
    if (this._mode === "form" && !(await this._confirmDiscard())) return;
    if (!this._selected) {
      /* An event that has never been saved has no YAML on the server to ask
       * for. JSON is YAML, which is the shortest honest answer here. */
      this._mode = "yaml";
      this._dirty = false;
      this._renderPane(JSON.stringify(this._draft, null, 2));
      return;
    }
    try {
      const res = await this._ws({
        type: "home_events/export", preset: this._presetId, event: this._selected,
      });
      this._mode = "yaml";
      this._dirty = false;
      this._renderPane(res.yaml);
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  /* ---------------------------------------------------------------- panes */

  _renderPane(text) {
    for (const p of this._pickers) p.remove();
    this._pickers = [];
    this._pending = [];
    this.shadowRoot.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.act === `tab-${this._mode}`);
    });

    if (this._mode !== "form") {
      this._el.pane.innerHTML =
        `<textarea class="yaml" spellcheck="false" wrap="off" ` +
        `autocapitalize="off" autocomplete="off">${esc(text || "")}</textarea>`;
      return;
    }
    this._el.pane.innerHTML = this._formHtml();
    this._mountPickers();
    this._recount();
  }

  _formHtml() {
    const d = this._draft || {};
    const grouped = d.group === true || d.group === "area" || d.group === "all";
    const cats = this._categories();

    return (
      /* -------------------------------------------------------- what */
      `<div class="fs">
         <div class="legend">What <span class="q">— which entities does this cover?</span></div>
         ${this._filterHtml("include", d.include || {})}
         ${this._filterHtml("exclude", d.exclude || {})}
         <div class="count" data-count></div>
       </div>` +

      /* -------------------------------------------------------- when */
      `<div class="fs">
         <div class="legend">When <span class="q">— and in which state?</span></div>
         ${this._conditionsHtml(d.conditions)}
       </div>` +

      /* ------------------------------------------------ how it reads */
      `<div class="fs">
         <div class="legend">How it reads</div>
         <div class="field"><div class="label">Section</div><div>
           <select data-set="category">
             <option value=""${d.category ? "" : " selected"}>Generic (default)</option>
             ${cats.map((c) => `<option value="${esc(c)}"` +
               `${c === (d.category || "") ? " selected" : ""}>${esc(this._catLabel(c))}</option>`).join("")}
             ${cats.indexOf(d.category) === -1 && d.category
                 ? `<option value="${esc(d.category)}" selected>${esc(d.category)}</option>` : ""}
           </select>
           <input class="newcat" data-set="category-new" placeholder="or a new one"
                  value="" spellcheck="false">
         </div></div>

         <div class="field"><div class="label">Severity</div>
           <div class="sev">${SEVERITIES.map((s) =>
             `<button class="chipbtn sev-${esc(s.key || "none")}` +
             `${(d.severity || null) === s.key ? " on" : ""}" ` +
             `data-set="severity" data-value="${esc(s.key || "")}">` +
             `<span class="dot sev-${esc(s.key || "none")}"></span>${esc(s.label)}</button>`).join("")}
           </div>
         </div>

         <div class="field"><div class="label">Group</div>
           <div class="seg">${GROUPS.map((g) =>
             `<button data-set="group" data-value="${esc(g.key || "")}"` +
             `${this._groupOf(d) === g.key ? ' class="on"' : ""}>${esc(g.label)}</button>`).join("")}
           </div>
         </div>

         ${TEXT_SLOTS.map((slot) => this._slotHtml(slot, d, grouped)).join("")}

         <div class="field"><div class="label">Time</div><div class="inline">
           <label class="check"><input type="checkbox" data-set="show_time"
             ${d.show_time === false ? "" : "checked"}> Show it</label>
           <select data-set="time_mode"${d.show_time === false ? " disabled" : ""}>
             <option value="">Default (since)</option>
             ${TIME_MODES.map((m) => `<option value="${m}"` +
               `${d.time_mode === m ? " selected" : ""}>${humanise(m)}</option>`).join("")}
           </select>
         </div></div>

         <div class="field"><div class="label">Enabled</div><div>
           <label class="check"><input type="checkbox" data-set="enabled"
             ${d.enabled === false ? "" : "checked"}> Show this event at all</label>
         </div></div>
       </div>`
    );
  }

  _groupOf(d) {
    if (d.group === true || d.group === "area") return "area";
    if (d.group === "all") return "all";
    return null;
  }

  /* A slot is one piece of text, until the event groups and the slot is one
   * that counts - then it may be two, and a button says so rather than a
   * second row of options being there all along. */
  _slotHtml(slot, d, grouped) {
    const value = d[slot.key];
    const plural = PLURAL_KEYS.indexOf(slot.key) !== -1;
    const pair = plural && value && typeof value === "object";
    const body = pair
      ? `<div class="pair">
           <label><span>one</span><input data-set="${slot.key}.one"
             value="${esc(value.one || "")}" spellcheck="false"></label>
           <label><span>many</span><input data-set="${slot.key}.many"
             value="${esc(value.many || "")}" spellcheck="false"></label>
         </div>`
      : `<input data-set="${slot.key}" value="${esc(typeof value === "string" ? value : "")}"
                placeholder="${esc(slot.hint)}" spellcheck="false">`;
    const toggle = plural && grouped
      ? `<button class="link" data-act="plural" data-value="${slot.key}">` +
        (pair ? "one wording" : "two wordings, by count") + `</button>`
      : "";
    return `<div class="field"><div class="label">${esc(slot.label)}</div>` +
      `<div>${body}${toggle}</div></div>`;
  }

  /* Conditions are read as rows and edited as YAML, for now: drawing them is
   * the fiddliest UI in the panel and the one most worth getting right rather
   * than quickly. What matters here is that the form never rewrites what it
   * cannot draw - it shows the condition and leaves it exactly as written. */
  _conditionsHtml(conditions) {
    const list = Array.isArray(conditions) ? conditions : [];
    if (!list.length) {
      return `<div class="hint">No conditions, so this event shows every
        entity it covers, in any state.</div>`;
    }
    return list.map((c) => {
      const kind = c.condition;
      let parts;
      if (kind === "state") {
        parts = [["State", ""], [c.state_not !== undefined ? "is not" : "is", ""],
                 [JSON.stringify(c.state_not !== undefined ? c.state_not : c.state), "val"]];
      } else if (kind === "numeric_state") {
        parts = [["Numeric state", ""]];
        if (c.attribute) parts.push(["attribute", ""], [c.attribute, "val"]);
        if (c.above !== undefined) parts.push(["above", ""], [String(c.above), "val"]);
        if (c.below !== undefined) parts.push(["below", ""], [String(c.below), "val"]);
      } else if (kind === "time") {
        parts = [["Time", ""]];
        if (c.after) parts.push(["after", ""], [c.after, "val"]);
        if (c.before) parts.push(["before", ""], [c.before, "val"]);
        if (c.weekday) parts.push(["on", ""], [[].concat(c.weekday).join(", "), "val"]);
      } else {
        parts = [[humanise(kind), ""],
                 [`${(c.conditions || []).length} nested`, "val"]];
      }
      if (c.for) parts.push(["for", ""], [duration(c.for), "val"]);
      return `<div class="cond">` +
        parts.map(([t, cls]) => `<span class="pill ${cls}">${esc(t)}</span>`).join("") +
        `</div>`;
    }).join("") +
    `<div class="hint">Conditions are edited on the YAML tab for now.</div>`;
  }

  /* ------------------------------------------------------------- filters */

  _filterHtml(side, filter) {
    /* On screen because the key is there, not because it has anything in
     * it: a row is added empty and then filled, and keying this on length
     * meant the row you had just asked for never appeared. */
    const used = FILTER_DIMS.filter((d) => filter[d.key] !== undefined);
    const free = FILTER_DIMS.filter((d) => filter[d.key] === undefined);
    const rows = used.map((dim) => {
      const chips = (filter[dim.key] || []).map((v, i) =>
        `<span class="chip${side === "exclude" ? " neg" : ""}">${esc(this._chipLabel(dim, v))}` +
        `<button class="x" data-act="unchip" data-side="${side}" data-dim="${dim.key}" ` +
        `data-index="${i}" title="Remove">×</button></span>`).join("");
      /* A real picker is a filled Material text field - 56px tall, its own
       * fill, its own underline - and putting one inside the chip box next to
       * a 24px chip makes the row look broken. It gets a line of its own,
       * capped in width. A text fallback is small enough to stay inline. */
      const slot = `<div data-slot="${side}:${dim.key}"></div>`;
      const big = this._hasPicker(dim);
      const box = chips || !big
        ? `<div class="control">${chips}${big ? "" : slot}</div>`
        : "";
      return `<div class="field"><div class="label">${esc(dim.label)}</div>` +
        `<div>${box}${big ? `<div class="adder">${slot}</div>` : ""}</div></div>`;
    }).join("");

    /* The one place the card demands an answer, asked at the moment it starts
     * to matter and not before. */
    const match = used.length > 1
      ? `<div class="field"><div class="label"></div><div class="hint">
           Entities in
           <span class="seg small">
             <button data-set="${side}.match" data-value="any"${
               filter.match === "any" ? ' class="on"' : ""}>any</button>
             <button data-set="${side}.match" data-value="all"${
               filter.match === "all" ? ' class="on"' : ""}>all</button>
           </span>
           of these
         </div></div>`
      : "";

    return `<div class="filter">
        <div class="field"><div class="label strong">${side === "include" ? "Include" : "Except"}</div>
          <div class="adds">${free.map((d) =>
            `<button class="ghost sm" data-act="adddim" data-side="${side}" ` +
            `data-dim="${d.key}">+ ${esc(d.label)}</button>`).join("")}</div>
        </div>
        ${rows}${match}
      </div>`;
  }

  _hasPicker(dim) {
    return !!(dim.pick && customElements.get(dim.pick));
  }

  _chipLabel(dim, value) {
    if (!dim.reg) return value;
    const row = this._reg[dim.reg][value];
    if (!row) return value;
    return row.name || row.name_by_user || row.original_name || value;
  }

  /* The pickers are elements, not markup: they take `.hass` as a property and
   * answer with an event. So the form renders an empty slot and they are put
   * into it afterwards. */
  _mountPickers() {
    for (const slot of this._el.pane.querySelectorAll("[data-slot]")) {
      const [side, key] = slot.dataset.slot.split(":");
      const dim = FILTER_DIMS.find((d) => d.key === key);
      slot.appendChild(this._pickerFor(side, dim));
    }
  }

  _pickerFor(side, dim) {
    const add = (value, render = true) => {
      if (value == null || value === "") return;
      const filter = this._draft[side] || (this._draft[side] = {});
      const list = filter[dim.key] || (filter[dim.key] = []);
      for (const v of [].concat(value)) if (list.indexOf(v) === -1) list.push(v);
      this._dirty = true;
      if (render) this._renderPane();
    };

    if (this._hasPicker(dim)) {
      const el = document.createElement(dim.pick);
      el.hass = this._hass;
      el.allowCustomEntity = true;
      el.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const v = e.detail && e.detail.value;
        el.value = "";
        add(v);
      });
      return el;
    }

    /* No picker: a text field, which is what the same value looks like in
     * YAML anyway. Domains get a list of the ones this house actually has. */
    const wrap = document.createElement("span");
    wrap.className = "fallback";
    const input = document.createElement("input");
    input.placeholder = dim.hint || "add…";
    input.spellcheck = false;
    if (dim.key === "domains") {
      const list = document.createElement("datalist");
      list.id = `domains-${side}`;
      const seen = new Set();
      for (const id of Object.keys(this._hass.states || {})) {
        seen.add(id.slice(0, id.indexOf(".")));
      }
      list.innerHTML = [...seen].sort().map((d) => `<option value="${esc(d)}">`).join("");
      wrap.appendChild(list);
      input.setAttribute("list", list.id);
    }
    /* Enter commits, and so does leaving the field. Typing `light` and
     * clicking Save used to save an event with no filter in it and then
     * explain that it needed one, about a word still on the screen. */
    const commit = (render) => {
      const v = input.value.trim();
      if (!v) return false;
      input.value = "";
      add(v, render);
      return true;
    };
    this._pending.push(commit);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      commit(true);
    });
    input.addEventListener("blur", () => commit(true));
    wrap.appendChild(input);
    return wrap;
  }

  /* ------------------------------------------------------------ the count */

  _recount() {
    const box = this._el.pane.querySelector("[data-count]");
    if (!box) return;
    const include = this._draft && this._draft.include;
    const anything = include && Object.keys(include).some(
      (k) => k !== "match" && (include[k] || []).length
    );
    if (!this._engine || !anything) {
      box.innerHTML = "";
      return;
    }
    let ids;
    try {
      ids = this._engine.matchEntities(this._hass, {
        include: clone(this._draft.include),
        exclude: this._draft.exclude ? clone(this._draft.exclude) : null,
        registries: { labels: this._reg.labels, floors: this._reg.floors },
      });
    } catch (err) {
      /* A half-written filter is the normal case in an editor: two dimensions
       * and no `match` yet is a sentence somebody is in the middle of. */
      box.innerHTML = `<span class="dim">${esc(this._reason(err))}</span>`;
      return;
    }
    this._match = ids;
    const n = ids.length;
    box.innerHTML =
      `<span class="ok">Matches ${n} ${n === 1 ? "entity" : "entities"}</span>` +
      (n ? `<button class="link" data-act="showmatches">${
        this._showMatches ? "hide them" : "show them"}</button>` : "") +
      (this._showMatches ? this._matchesHtml(ids) : "");
  }

  _matchesHtml(ids) {
    const byArea = new Map();
    for (const id of ids) {
      const st = this._hass.states[id] || {};
      const entity = (this._hass.entities || {})[id] || {};
      const area = this._areaNameOf(id, entity) || "Elsewhere";
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push([id, (st.attributes || {}).friendly_name || id]);
    }
    const rooms = [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return `<div class="matches">` + rooms.map(([area, rows]) =>
      `<div class="mroom">${esc(area)} <span class="dim">${rows.length}</span></div>` +
      rows.slice(0, 40).map(([id, name]) =>
        `<div class="mrow"><span>${esc(name)}</span><code>${esc(id)}</code></div>`).join("") +
      (rows.length > 40 ? `<div class="mrow dim">and ${rows.length - 40} more</div>` : "")
    ).join("") + `</div>`;
  }

  _areaNameOf(entityId, entity) {
    let areaId = entity.area_id;
    if (!areaId && entity.device_id) {
      const dev = this._reg.devices[entity.device_id];
      areaId = dev && dev.area_id;
    }
    const area = areaId && this._reg.areas[areaId];
    return area ? area.name : null;
  }

  /* -------------------------------------------------------------- editing */

  _onClick(e) {
    const el = e.composedPath().find(
      (n) => n && n.dataset && (n.dataset.act || n.dataset.event || n.dataset.set)
    );
    if (!el) return;
    if (el.dataset.event) return this._openEvent(el.dataset.event);

    if (el.dataset.set && el.tagName === "BUTTON") {
      this._set(el.dataset.set, el.dataset.value);
      return;
    }
    switch (el.dataset.act) {
      case "save": return this._save();
      case "delete": return this._delete();
      case "new": return this._newEvent();
      case "library": return this._openLibrary();
      case "tab-form": return this._toForm();
      case "tab-yaml": return this._openYaml();
      case "adddim": {
        const f = this._draft[el.dataset.side] || (this._draft[el.dataset.side] = {});
        f[el.dataset.dim] = f[el.dataset.dim] || [];
        /* A second dimension is the moment the card starts demanding an
         * answer, so the answer gets written down rather than drawn as a
         * default the filter does not actually hold. `all` because the common
         * shape is "this kind of thing, in this place" - and the count under
         * the block says immediately if that was the wrong guess. */
        const dims = Object.keys(f).filter((k) => k !== "match");
        if (dims.length > 1 && !f.match) f.match = "all";
        this._dirty = true;
        return this._renderPane();
      }
      case "unchip": {
        const f = this._draft[el.dataset.side] || {};
        const list = f[el.dataset.dim] || [];
        list.splice(Number(el.dataset.index), 1);
        if (!list.length) delete f[el.dataset.dim];
        if (!Object.keys(f).length) delete this._draft[el.dataset.side];
        this._dirty = true;
        return this._renderPane();
      }
      case "plural": {
        const key = el.dataset.value;
        const v = this._draft[key];
        this._draft[key] = v && typeof v === "object"
          ? (v.one || v.many || "")
          : { one: typeof v === "string" ? v : "", many: "" };
        this._dirty = true;
        return this._renderPane();
      }
      case "showmatches":
        this._showMatches = !this._showMatches;
        return this._recount();
      case "menu":
        return this.dispatchEvent(
          new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
        );
    }
  }

  _onInput(e) {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.set) {
      if (el && el.classList && el.classList.contains("yaml")) this._dirty = true;
      return;
    }
    if (el.tagName === "BUTTON") return;
    /* A new section name changes what the form draws, and redrawing takes the
     * focus with it. So it lands when the field is left, not per keystroke. */
    if (el.dataset.set === "category-new" && e.type !== "change") return;
    const value = el.type === "checkbox" ? el.checked : el.value;
    this._set(el.dataset.set, value, el);
  }

  /* One place where a control becomes a key, so what the form can express and
   * what the schema holds stay the same list. Empty means "not set": the key
   * is removed rather than written as an empty string, because the card's
   * defaults are better than a blank. */
  _set(path, value, el) {
    const d = this._draft;
    if (!d) return;
    this._dirty = true;
    let structural = false;

    if (path === "category-new") {
      if (!value) return;
      d.category = value.trim().toLowerCase().replace(/\s+/g, "_");
      structural = true;
    } else if (path === "severity") {
      if (value) d.severity = value; else delete d.severity;
      structural = true;
    } else if (path === "group") {
      if (value) d.group = value; else delete d.group;
      structural = true; // the wording slots depend on it
    } else if (path === "show_time") {
      if (value === false) d.show_time = false; else delete d.show_time;
      structural = true;
    } else if (path === "enabled") {
      if (value === false) d.enabled = false; else delete d.enabled;
    } else if (path === "time_mode") {
      if (value) d.time_mode = value; else delete d.time_mode;
    } else if (path === "category") {
      d.category = value;
      structural = true;
    } else if (path.indexOf(".") !== -1) {
      const [head, tail] = path.split(".");
      if (head === "include" || head === "exclude") {
        const f = d[head] || (d[head] = {});
        f[tail] = value;
        structural = true;
      } else {
        const slot = d[head] && typeof d[head] === "object" ? d[head] : (d[head] = {});
        if (value) slot[tail] = value; else delete slot[tail];
      }
    } else if (value === "" || value == null) {
      delete d[path];
    } else {
      d[path] = value;
    }

    if (structural) this._renderPane();
    else if (el && el.dataset.set.indexOf("include") === 0) this._recount();
  }

  /* --------------------------------------------------------------- saving */

  /* What gets stored is what somebody meant, not the scaffolding they meant it
   * with. A dimension row is added empty and filled afterwards; one that never
   * got filled is a row on a screen, not a fact about the house, and writing
   * `entities: []` into the library would put it in front of the next person
   * to read the YAML. `match` goes the same way once there is nothing left for
   * it to decide between. */
  _cleaned() {
    const draft = clone(this._draft) || {};
    for (const side of ["include", "exclude"]) {
      const filter = draft[side];
      if (!filter) continue;
      for (const dim of FILTER_DIMS) {
        if (Array.isArray(filter[dim.key]) && !filter[dim.key].length) {
          delete filter[dim.key];
        }
      }
      const dims = Object.keys(filter).filter((k) => k !== "match");
      if (dims.length < 2) delete filter.match;
      if (!Object.keys(filter).length) delete draft[side];
    }
    return draft;
  }

  async _save() {
    /* Whatever is still sitting in an add-field counts: it is on the screen,
     * so it is part of what was meant. No redraw - the draft is what the save
     * reads, and redrawing mid-save would pull the button out from under the
     * click that started this. */
    for (const commit of this._pending) commit(false);
    try {
      if (this._mode === "library") {
        const text = this._el.pane.querySelector(".yaml").value;
        await this._ws({ type: "home_events/import", preset: this._presetId, yaml: text });
        this._dirty = false;
        await this._reload();
        this._say("Saved");
        return;
      }
      const name = this._el.name.value.trim();
      /* JSON is YAML, so the form's object goes through the same command the
       * text editor uses and gets the same validation, the same rename
       * handling and the same place in the order. */
      const text = this._mode === "yaml"
        ? this._el.pane.querySelector(".yaml").value
        : JSON.stringify(this._cleaned(), null, 2);
      const msg = {
        type: "home_events/save_event", preset: this._presetId, name, yaml: text,
      };
      if (this._renamedFrom && this._renamedFrom !== name) msg.rename_from = this._renamedFrom;
      await this._ws(msg);
      this._selected = name;
      this._renamedFrom = name;
      this._name = name;
      this._dirty = false;
      this._el.del.style.display = "";
      await this._reload();
      if (this._mode === "yaml") {
        this._draft = clone(this._events()[name]) || {};
      }
      this._say("Saved");
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _delete() {
    if (!this._selected) return;
    if (!ask(`Delete the event "${this._selected}"?`)) return;
    try {
      await this._ws({
        type: "home_events/delete_event", preset: this._presetId, name: this._selected,
      });
      this._dirty = false;
      await this._reload();
      const names = Object.keys(this._events());
      if (names.length) await this._openEvent(names[0]);
      else await this._newEvent();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _confirmDiscard() {
    if (!this._dirty) return true;
    return ask("There are unsaved changes here. Discard them?");
  }

  _reason(err) {
    if (!err) return "Something went wrong.";
    if (typeof err === "string") return err;
    return err.message || err.error || JSON.stringify(err);
  }

  _say(text, bad) {
    this._el.msg.textContent = text || "";
    this._el.msg.className = "msg" + (text ? (bad ? " bad" : " good") : "");
  }
}

const STYLES = `
:host {
  display: block;
  height: 100vh;
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  font-family: var(--ha-font-family-body, Roboto, sans-serif);
  --bar-h: 56px;
}
.app { display: flex; flex-direction: column; height: 100%; }

.bar {
  display: flex; align-items: center; gap: 12px;
  height: var(--bar-h); flex: none; padding: 0 16px; box-sizing: border-box;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, #fff);
}
.title { font-size: 20px; }
.grow { flex: 1; }

button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid transparent;
  padding: 7px 14px; background: transparent; color: inherit; }
button:hover { background: rgba(127,127,127,.16); }
button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
.bar .ghost { border-color: rgba(255,255,255,.35); }
.icon { font-size: 20px; padding: 4px 8px; line-height: 1; }
.editor .ghost { border-color: var(--divider-color, rgba(127,127,127,.3)); }
.ghost.sm { padding: 4px 10px; font-size: 13px; border-style: dashed; color: var(--secondary-text-color); }
.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); font-weight: 500; }
.danger { color: var(--error-color, #d8574a); }
.link { padding: 2px 6px; font-size: 13px; color: var(--primary-color); }

select, input[type="text"], input:not([type]) {
  font: inherit; font-size: 14px; padding: 7px 9px;
  border-radius: 8px; background: transparent; color: inherit;
  border: 1px solid var(--divider-color, rgba(127,127,127,.35));
  min-width: 0;
}
/* The options are drawn by the browser, not by this stylesheet, and they take
   the colours off the element rather than off anything around it. Inheriting
   put a dark theme's near-white text on the popup's own white background,
   which is a list you cannot read. Both ends stated, on the select and on the
   option, because which one a platform honours is not something to bet on. */
select {
  background: var(--card-background-color, #fff);
  color: var(--primary-text-color, #000);
}
select option {
  background: var(--card-background-color, #fff);
  color: var(--primary-text-color, #000);
}
.bar select { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.35); padding: 5px 8px; }
.bar select option { color: var(--primary-text-color); background: var(--card-background-color); }

main {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
  gap: 16px; padding: 16px; box-sizing: border-box;
}
@media (max-width: 860px) { main { grid-template-columns: 1fr; } }

.list, .editor {
  background: var(--card-background-color, #fff);
  border-radius: var(--ha-card-border-radius, 16px);
  box-shadow: var(--ha-card-box-shadow, none);
  min-height: 0;
}
.list { padding: 8px; overflow: auto; }
.editor { display: flex; flex-direction: column; padding: 12px 16px; overflow: hidden; }
.empty { padding: 24px 16px; color: var(--secondary-text-color); line-height: 1.5; }

.cat { font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color); padding: 14px 10px 6px; }
.row { display: grid; grid-template-columns: 8px minmax(0,1fr) auto; align-items: center;
  gap: 10px; padding: 8px 10px; border-radius: 9px; cursor: pointer; }
.row:hover { background: rgba(127,127,127,.10); }
.row.sel { background: rgba(127,127,127,.18); }
.row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.row.off { opacity: .45; }
.nm { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; }

.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--secondary-text-color); }
.sev-alert .dot, .dot.sev-alert { background: var(--error-color, #d8574a); }
.sev-attention .dot, .dot.sev-attention { background: var(--warning-color, #d8a24e); }
.sev-active .dot, .dot.sev-active { background: var(--success-color, #5cb87f); }
.sev-info .dot, .dot.sev-info { background: var(--secondary-text-color); }
.dot.sev-none { background: transparent; box-shadow: inset 0 0 0 1px var(--secondary-text-color); }

.ed-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; flex: none; }
.name { font-size: 16px; width: 220px; }
.name:disabled { border-color: transparent; opacity: .7; }
.tabs { display: inline-flex; border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-radius: 8px; overflow: hidden; }
.tabs .tab { border-radius: 0; padding: 6px 14px; font-size: 13px; color: var(--secondary-text-color); }
.tabs .tab.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }

.pane { flex: 1; min-height: 0; overflow: auto; }
textarea.yaml {
  width: 100%; height: 100%; box-sizing: border-box;
  font-family: var(--ha-font-family-code, ui-monospace, Menlo, Consolas, monospace);
  font-size: 13px; line-height: 1.55; tab-size: 2; padding: 12px;
  border-radius: 10px; border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  background: var(--primary-background-color); color: var(--primary-text-color); resize: none;
}

/* A fieldset per question. The rules are the only structure - a card inside a
   card would be a second surface for no reason. */
.fs { border-top: 1px solid var(--divider-color, rgba(127,127,127,.18)); padding: 16px 0 10px; }
.fs:first-child { border-top: 0; padding-top: 2px; }
.legend { font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--secondary-text-color); margin-bottom: 14px;
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.legend .q { font-size: 12px; letter-spacing: 0; text-transform: none; font-style: italic; }

.field { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px;
  align-items: start; margin-bottom: 10px; }
.label { font-size: 13px; color: var(--secondary-text-color); padding-top: 8px; }
.label.strong { color: var(--primary-text-color); font-weight: 500; }
.field > div > input, .field > div > select { width: 100%; box-sizing: border-box; }
.field .inline { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.newcat { margin-top: 6px; }

.filter { margin-bottom: 4px; }
.adds { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 3px; }
.control { display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-radius: 10px; padding: 6px; min-height: 24px; }
.control > * { flex: 0 1 auto; }
.control > [data-slot] { flex: 1 1 200px; min-width: 140px; }
.fallback { display: block; }
.fallback input { width: 100%; box-sizing: border-box; }

/* The picker's own line, capped: it is one control for adding one thing, not
   the subject of the row.

   ha-entity-picker is not a text field. Inside it is ha-picker-field, and
   inside that an ha-combo-box-item - a list item - which takes its fill from
   --ha-color-form-background and draws its underline from
   --ha-color-border-neutral-loud. Two rounds of MWC variables did nothing
   because none of them were ever being read; these are, and the browser is
   where that stopped being a guess.

   Its 56px is set on a rule inside ha-picker-field's own shadow root, which
   nothing out here can outbid. So the height is Home Assistant's, and the
   border it sits in is this form's, and the two meet in the middle: the fill
   and the underline come off, and the wrapper carries the same outline every
   other control here has. */
.adder { margin-top: 6px; max-width: 380px; }
.adder > [data-slot] {
  border: 1px solid var(--divider-color, rgba(127,127,127,.35));
  border-radius: 8px;
  overflow: hidden;
}
.adder > [data-slot] > * {
  display: block;
  --ha-color-form-background: transparent;
  --ha-color-border-neutral-loud: transparent;
  --mdc-typography-subtitle1-font-size: 14px;
  --mdc-typography-body1-font-size: 14px;
  --mdc-icon-size: 20px;
}
.adder > [data-slot]:focus-within { border-color: var(--primary-color); }

.chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px;
  padding: 3px 4px 3px 11px; font-size: 13px;
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary-color) 34%, transparent); }
.chip.neg { background: color-mix(in srgb, var(--error-color, #d8574a) 12%, transparent);
  border-color: color-mix(in srgb, var(--error-color, #d8574a) 34%, transparent); }
.chip .x { padding: 0 5px; font-size: 15px; line-height: 1; color: var(--secondary-text-color); }

.seg { display: inline-flex; border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-radius: 8px; overflow: hidden; }
.seg button { border-radius: 0; padding: 6px 13px; font-size: 13px; color: var(--secondary-text-color); }
.seg button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
.seg.small button { padding: 2px 9px; font-size: 12px; }

.sev { display: flex; flex-wrap: wrap; gap: 6px; }
.chipbtn { display: inline-flex; align-items: center; gap: 7px; font-size: 13px;
  padding: 5px 12px; border-radius: 999px;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  color: var(--secondary-text-color); }
.chipbtn.on { color: var(--primary-text-color); border-color: currentColor; }

.pair { display: grid; gap: 6px; }
.pair label { display: grid; grid-template-columns: 42px minmax(0,1fr); gap: 8px; align-items: center; }
.pair span { font-size: 11px; color: var(--secondary-text-color); }
.check { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; }

.cond { display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
  border: 1px solid var(--divider-color, rgba(127,127,127,.25));
  border-radius: 9px; padding: 7px 10px; margin-bottom: 7px; }
.pill { border: 1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius: 7px;
  padding: 3px 9px; font-size: 12.5px; color: var(--secondary-text-color); }
.pill.val { font-family: var(--ha-font-family-code, monospace); color: var(--primary-text-color); }
.hint { font-size: 12.5px; color: var(--secondary-text-color); padding-top: 6px; line-height: 1.5; }

.count { padding: 10px 0 0; font-size: 13px; display: block; }
.count .ok { color: var(--success-color, #5cb87f); font-weight: 500; }
.count .dim, .dim { color: var(--secondary-text-color); }
.matches { margin-top: 8px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.18));
  padding-top: 8px; max-height: 260px; overflow: auto; }
.mroom { font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color); padding: 10px 0 4px; }
.mrow { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; padding: 2px 0; }
.mrow code { font-family: var(--ha-font-family-code, monospace); font-size: 11.5px;
  color: var(--secondary-text-color); }

.msg { min-height: 20px; padding-top: 8px; font-size: 13px; flex: none;
  color: var(--secondary-text-color); white-space: pre-wrap; }
.msg.bad { color: var(--error-color, #d8574a); }
.msg.good { color: var(--success-color, #5cb87f); }
`;

if (!customElements.get("home-events-panel")) {
  customElements.define("home-events-panel", HomeEventsPanel);
  console.info(
    `%c home-events-panel %c ${PANEL_BUILD} `,
    "background:#3f51b5;color:#fff;border-radius:3px 0 0 3px;padding:2px 4px",
    "background:#555;color:#fff;border-radius:0 3px 3px 0;padding:2px 4px"
  );
}
