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

const PANEL_BUILD = "2026-08-11d";

/* The seven ways of naming a set of entities, most specific first - which is
 * the order the card's own ladder ranks them in, and the order somebody
 * reaches for them in.
 *
 * They are one list here because they are one list on screen: a filter is a
 * list of criteria and each criterion is one of these, chosen from a menu. The
 * split this replaced - a target picker for five of them and text rows for the
 * other two - made two kinds of thing out of what is one kind of thing.
 *
 * `pick` is the Home Assistant element that knows how to choose one, and `reg`
 * the registry to read a name out of for display. */
const FILTER_DIMS = [
  { key: "entities", label: "Entity", pick: "ha-entity-picker" },
  { key: "devices", label: "Device", pick: "ha-device-picker", reg: "devices" },
  { key: "areas", label: "Area", pick: "ha-area-picker", reg: "areas" },
  { key: "floors", label: "Floor", pick: "ha-floor-picker", reg: "floors" },
  { key: "labels", label: "Label", pick: "ha-label-picker", reg: "labels" },
  { key: "domains", label: "Domain", hint: "light" },
  { key: "entity_globs", label: "Pattern", hint: "light.*stairs*" },
];

/* An event says how loud it is, in a word, and Info is the quiet end.
 *
 * The card also understands the key being absent, which means "let the entity's
 * own state decide" - alarm panels, vacuums, timers and climate have opinions
 * and nothing else does. That is a real setting and the YAML tab still writes
 * it, but it is not one to be in by accident: this form always names a word, so
 * an event that has never been told reads Info, which is what all but four
 * domains would have decided anyway. */
const SEVERITIES = [
  { key: "alert", label: "Alert" },
  { key: "attention", label: "Attention" },
  { key: "active", label: "Active" },
  { key: "info", label: "Info" },
];
const DEFAULT_SEVERITY = "info";
const GROUPS = [
  { key: null, label: "No" },
  { key: "area", label: "Per room" },
  { key: "all", label: "One row" },
];
const TIME_MODES = ["since", "until", "ago", "remaining"];
/* The conditions that hold other conditions. Core's own three, and the card
 * evaluates them the way core does: and passes when every one inside passes,
 * or when any does, not when none does. */
const GROUP_KINDS = ["and", "or", "not"];
/* The card's PLURAL_KEYS: the slots a counting row may word two ways. */
const PLURAL_KEYS = ["title", "status", "icon"];

/* Not a section: the option in the list that asks for one. It is a word no
 * category id can be, because a category id is what this form makes of what
 * somebody typed, and it never makes this. */
const NEW_CATEGORY = "__new__";

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
  severity: "info",
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

/* What the field shows for `for:`. A mapping becomes the clock string it
 * means; anything else is already text. */
function durationText(value) {
  if (value && typeof value === "object") {
    const p = (n) => String(n || 0).padStart(2, "0");
    return `${p(value.hours)}:${p(value.minutes)}:${p(value.seconds)}`;
  }
  return value == null ? "" : String(value);
}

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
      for (const kind of ["entity", "device", "area", "floor", "label",
                          "icon"]) {
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
    this._mode = "visual"; // visual | yaml | library
    this._dirty = false;
    this._built = false;
    this._pickers = [];
    this._pending = [];
    /* Which criterion is currently a picker, and which of the three questions
     * is on screen. Both are where the person is looking, not what they have
     * written, so neither survives opening another event. */
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
    this._sub = "what";
    this._reg = { areas: {}, floors: {}, labels: {}, devices: {} };
    this._engine = null;
    this._match = null;
    /* Shown unless it is put away: the whole point of counting is being able
     * to see what was counted. */
    this._showMatches = true;
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
    /* A section named in this editor and not yet saved is still the name that
     * was typed: the store has not been told about it, and until it is, this
     * is the only place that knows how it is spelled. */
    if (this._newCategory && this._newCategory.id === id) {
      return this._newCategory.label;
    }
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
        </header>
        <main>
          <aside class="side">
            <button class="primary wide" data-act="new">New event</button>
            <div class="list"></div>
          </aside>
          <section class="editor">
            <div class="ed-head">
              <input class="name" spellcheck="false" autocomplete="off"
                     placeholder="event_name">
              <div class="tabs">
                <button data-act="tab-visual" class="tab">Visual</button>
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
      this._setDirty(true);
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
    this._draft = this._formShape(clone(event) || {});
    this._mode = "visual";
    this._setDirty(false);
    this._match = null;
    this._sub = "what";
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
    this._el.name.value = name;
    this._el.name.disabled = false;
    this._el.del.style.display = "";
    this._el.tabs.style.display = "";
    this._say("");
    this._renderList();
    this._renderPane();
  }

  /* An event as this form can say it.
   *
   * The form has no word for "no severity", so an event that has never been
   * told one reads Info - and reads it in the draft as well as on the screen,
   * because a form that shows one thing and saves another is the bug this
   * project has already fixed twice. Nothing is written until something is
   * saved: the draft is not dirty for having been read.
   *
   * The card still understands the key being absent, and the YAML tab still
   * writes it, so nothing is taken away - only the way in by accident. */
  _formShape(event) {
    if (!event.severity) event.severity = DEFAULT_SEVERITY;
    return event;
  }

  async _newEvent() {
    if (!(await this._confirmDiscard())) return;
    this._selected = null;
    this._renamedFrom = null;
    this._name = "";
    this._draft = clone(STARTER);
    this._mode = "visual";
    this._setDirty(true);
    this._match = null;
    this._sub = "what";
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
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
      this._setDirty(false);
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
  async _toVisual() {
    if (this._mode === "visual") return;
    if (!(await this._confirmDiscard())) return;
    this._draft = this._selected
      ? this._formShape(clone(this._events()[this._selected]) || {})
      : this._draft;
    this._mode = "visual";
    this._setDirty(false);
    this._renderPane();
  }

  async _openYaml() {
    if (this._mode === "visual" && !(await this._confirmDiscard())) return;
    if (!this._selected) {
      /* An event that has never been saved has no YAML on the server to ask
       * for. JSON is YAML, which is the shortest honest answer here. */
      this._mode = "yaml";
      this._setDirty(false);
      this._renderPane(JSON.stringify(this._draft, null, 2));
      return;
    }
    try {
      const res = await this._ws({
        type: "home_events/export", preset: this._presetId, event: this._selected,
      });
      this._mode = "yaml";
      this._setDirty(false);
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
    /* Which drawing this is. Controls made here carry the number and refuse to
     * write once it has moved on - see _pickerFor. */
    this._gen = (this._gen || 0) + 1;
    this.shadowRoot.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.act === `tab-${this._mode}`);
    });

    if (this._mode !== "visual") {
      this._el.pane.innerHTML =
        `<textarea class="yaml" spellcheck="false" wrap="off" ` +
        `autocapitalize="off" autocomplete="off">${esc(text || "")}</textarea>`;
      return;
    }
    this._el.pane.innerHTML = this._formHtml();
    this._mountPickers();
    /* A field that appeared because it was asked for should not also have to
     * be clicked. */
    const newcat = this._el.pane.querySelector(".newcat");
    if (newcat) newcat.focus();
    this._recount();
  }

  _formHtml() {
    const d = this._draft || {};
    const grouped = d.group === true || d.group === "area" || d.group === "all";
    const cats = this._categories();
    const sub = this._sub || "what";
    const tab = (id, label) =>
      `<button data-act="sub-${id}" class="subtab${sub === id ? " on" : ""}">` +
      `${esc(label)}</button>`;
    const tabs = `<div class="subtabs">${tab("what", "What")}` +
      `${tab("when", "When")}${tab("how", "How")}</div>`;

    if (sub === "when") {
      return tabs + `<div class="fs">
         <div class="legend">When <span class="q">— and in which state?</span></div>
         ${this._conditionsHtml(d.conditions)}
       </div>`;
    }
    if (sub === "what") {
      return tabs + `<div class="fs">
         <div class="legend">What <span class="q">— which entities does this cover?</span></div>
         ${this._filterHtml("include", d.include || {})}
         ${this._filterHtml("exclude", d.exclude || {})}
         <div class="count" data-count></div>
       </div>`;
    }

    return (
      tabs +
      `<div class="fs">
         <div class="legend">How <span class="q">— how should the row read?</span></div>

         <div class="field"><div class="label">Enabled</div><div>
           <label class="check"><input type="checkbox" data-set="enabled"
             ${d.enabled === false ? "" : "checked"}> Show this event</label>
         </div></div>

         <div class="field"><div class="label">Section</div><div>
           <select data-set="category">
             <option value=""${d.category || this._newcat ? "" : " selected"}>Generic (default)</option>
             ${cats.map((c) => `<option value="${esc(c)}"` +
               `${!this._newcat && c === (d.category || "") ? " selected" : ""}>` +
               `${esc(this._catLabel(c))}</option>`).join("")}
             ${cats.indexOf(d.category) === -1 && d.category
                 ? `<option value="${esc(d.category)}"${this._newcat ? "" : " selected"}>` +
                   `${esc(this._catLabel(d.category))}</option>` : ""}
             <option value="${NEW_CATEGORY}"${this._newcat ? " selected" : ""}>New section…</option>
           </select>
           ${this._newcat
             ? `<input class="newcat" data-set="category-new" spellcheck="false"
                       placeholder="Name it, then press enter" value="">`
             : ""}
         </div></div>

         <div class="field"><div class="label">Severity</div>
           <div class="sev">${SEVERITIES.map((s) =>
             `<button class="chipbtn sev-${esc(s.key)}` +
             `${(d.severity || DEFAULT_SEVERITY) === s.key ? " on" : ""}" ` +
             `data-set="severity" data-value="${esc(s.key)}">` +
             `<span class="dot sev-${esc(s.key)}"></span>${esc(s.label)}</button>`).join("")}
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
             ${d.show_time === false ? "" : "checked"}> Show</label>
           <select data-set="time_mode"${d.show_time === false ? " disabled" : ""}>
             <option value="">Default (since)</option>
             ${TIME_MODES.map((m) => `<option value="${m}"` +
               `${d.time_mode === m ? " selected" : ""}>${humanise(m)}</option>`).join("")}
           </select>
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
    /* mdi has seven thousand icons in it and a text field is a poor way to
     * find one, so where Home Assistant's picker is available it is used - and
     * opened out of sight, exactly as a criterion's is. */
    const icons = slot.key === "icon" && this._hasEl("ha-icon-picker");
    const field = (path, current) => {
      if (!icons) {
        return `<input data-set="${path}" value="${esc(typeof current === "string" ? current : "")}"
                  placeholder="${esc(slot.hint)}" spellcheck="false">`;
      }
      const being = this._editing;
      const open = being && being.type === "icon" && being.path === path;
      const set = typeof current === "string" && current;
      return `<div class="crit iconrow${open ? " open" : ""}">
          ${set ? `<ha-icon class="preview" icon="${esc(current)}"></ha-icon>` : ""}
          <button class="val${set ? "" : " empty"}" data-act="editicon"
                  data-path="${path}">${esc(set ? current : "Choose an icon…")}</button>
          ${set ? `<button class="x row-x" data-act="clearicon"
                  data-path="${path}" title="Remove">×</button>` : ""}
          ${open ? `<span class="pickhost" data-iconslot="${path}"></span>` : ""}
        </div>`;
    };
    /* A grouped row stands for however many entities it collected, so these
       slots may be worded twice: once for a row that turned out to be a
       single thing, once for a row that is a tally. The button says what
       pressing it does, and the labels say when each wording is used. */
    const body = pair
      ? `<div class="pair">
           <label><span>if it is one</span>${field(`${slot.key}.one`, value.one)}</label>
           <label><span>if it is more</span>${field(`${slot.key}.many`, value.many)}</label>
         </div>`
      : field(slot.key, value);
    const toggle = plural && grouped
      ? `<button class="link" data-act="plural" data-value="${slot.key}">` +
        (pair
          ? "Use one wording, whatever the count"
          : "Word it differently when it counts more than one") + `</button>`
      : "";
    return `<div class="field"><div class="label">${esc(slot.label)}</div>` +
      `<div>${body}${toggle}</div></div>`;
  }

  /* Conditions, as rows.
   *
   * The vocabulary is core's own - state, numeric_state, time, `for:`, and the
   * and/or/not groups - so the rows are the automation editor's rows, near
   * enough that there is nothing new to learn. A group holds conditions and is
   * drawn as one: a word for how its contents add up, and the contents
   * indented under it, however deep that goes.
   *
   * Every control carries the path to the condition it belongs to - "0",
   * "0.2", "0.2.1" - so one set of handlers works at any depth. The separator
   * between the path and the field is a colon, because the path already uses
   * dots.
   *
   * `entity` is not offered. A condition here tests the entity the event
   * matched, which is the whole point of the filter above it; pointing one at
   * some other entity is a real thing the card supports and a rare thing to
   * want, so it lives on the YAML tab. */
  _conditionsHtml(conditions, path = "") {
    const list = Array.isArray(conditions) ? conditions : [];
    const rows = list
      .map((c, i) => this._condHtml(c, path === "" ? String(i) : `${path}.${i}`))
      .join("");
    const empty = list.length ? "" : path === ""
      ? `<div class="hint">No conditions, so this event shows every entity it
          covers, in any state.</div>`
      : `<div class="hint">Nothing in here yet.</div>`;
    /* What a list of conditions means, said once it means anything: the card
     * requires all of them, which is worth saying where a group two lines
     * below says "any of". */
    const all = list.length > 1 && path === ""
      ? `<div class="hint">All of these have to be true.</div>` : "";
    return all + rows + empty +
      `<button class="ghost sm" data-act="addcond" data-path="${path}">` +
      `+ Add condition</button>`;
  }

  _condHtml(c, path) {
    const kind = c.condition;
    const pick = (name, value, options) =>
      `<select data-cond="${path}:${name}">` +
      options.map(([v, label]) =>
        `<option value="${esc(v)}"${String(value) === v ? " selected" : ""}>` +
        `${esc(label)}</option>`).join("") + `</select>`;
    const text = (name, value, hint, cls = "") =>
      `<input class="cv ${cls}" data-cond="${path}:${name}" spellcheck="false"
              value="${esc(value == null ? "" : value)}" placeholder="${esc(hint)}">`;

    let body;
    if (kind === "state") {
      const negated = c.state_not !== undefined;
      const value = negated ? c.state_not : c.state;
      body =
        pick("mode", negated ? "state_not" : "state",
             [["state", "is"], ["state_not", "is not"]]) +
        text("value", [].concat(value == null ? "" : value).join(", "), "on");
    } else if (kind === "numeric_state") {
      body =
        text("attribute", c.attribute, "attribute", "narrow") +
        `<span class="lbl">above</span>` + text("above", c.above, "", "num") +
        `<span class="lbl">below</span>` + text("below", c.below, "", "num");
    } else if (kind === "time") {
      body =
        `<span class="lbl">after</span>` + text("after", c.after, "07:00:00", "num") +
        `<span class="lbl">before</span>` + text("before", c.before, "23:00:00", "num") +
        text("weekday", [].concat(c.weekday || []).join(", "), "any day", "narrow");
    }

    const kinds = [["state", "State"], ["numeric_state", "Numeric state"],
                   ["time", "Time"], ["and", "All of"], ["or", "Any of"],
                   ["not", "None of"]];
    if (!kinds.some(([k]) => k === kind)) kinds.push([kind, humanise(kind)]);

    const remove = `<button class="x row-x" data-act="delcond" ` +
      `data-path="${path}" title="Remove this condition">×</button>`;

    /* A group is a row that holds rows. The word on it says how what is inside
     * adds up, and what is inside is drawn by the same code as everything
     * else, one level in. */
    if (GROUP_KINDS.indexOf(kind) !== -1) {
      return `<div class="group">
          <div class="cond ghead">${pick("condition", kind, kinds)}
            <span class="lbl">${kind === "not"
              ? "of these may be true" : "of these"}</span>
            <span class="grow"></span>${remove}</div>
          <div class="subconds">${this._conditionsHtml(c.conditions, path)}</div>
        </div>`;
    }

    return `<div class="cond">` +
      pick("condition", kind, kinds) + body +
      (kind === "state" || kind === "numeric_state"
        ? `<span class="lbl">for</span>` + text("for", durationText(c.for), "0:05:00", "num")
        : "") +
      `<span class="grow"></span>${remove}</div>`;
  }

  /* Where a path points, and the list it lives in.
   *
   * "0.2" is the third condition inside the first one. An empty path is the
   * event's own list, which is the only one that is not inside anything. */
  _condAt(path) {
    const parts = String(path === undefined ? "" : path).split(".").filter(Boolean);
    let list = this._draft.conditions || [];
    let cond = null;
    for (const part of parts) {
      cond = list[Number(part)];
      if (!cond) return null;
      list = cond.conditions || [];
    }
    return cond;
  }

  _condListAt(path) {
    if (!path) return this._draft.conditions || (this._draft.conditions = []);
    const cond = this._condAt(path);
    if (!cond) return null;
    return cond.conditions || (cond.conditions = []);
  }

  /* One control, one key. Everything a row can say is said here, so what the
   * form can express and what the schema holds stay the same list. */
  _setCond(path, field, value) {
    const c = this._condAt(path);
    if (!c) return;
    const drop = (...keys) => keys.forEach((k) => delete c[k]);

    if (field === "condition") {
      /* Changing the kind keeps nothing but the timing: an `above` on a state
       * condition is not a value with a new home, it is a mistake waiting.
       *
       * One exception, and it is the obvious one: all of / any of / none of
       * are the same question asked three ways, so switching between them
       * keeps what is inside. */
      const wasGroup = GROUP_KINDS.indexOf(c.condition) !== -1;
      const isGroup = GROUP_KINDS.indexOf(value) !== -1;
      const kept = c.for;
      const children = c.conditions;
      for (const k of Object.keys(c)) delete c[k];
      c.condition = value;
      if (isGroup) {
        c.conditions = wasGroup && Array.isArray(children) ? children : [];
      } else {
        if (value === "state") c.state = "on";
        if (kept !== undefined) c.for = kept;
      }
    } else if (field === "mode") {
      const current = c.state !== undefined ? c.state : c.state_not;
      drop("state", "state_not");
      c[value] = current === undefined ? "on" : current;
    } else if (field === "value") {
      const key = c.state_not !== undefined ? "state_not" : "state";
      const parts = String(value).split(",").map((s) => s.trim()).filter(Boolean);
      c[key] = parts.length > 1 ? parts : (parts[0] || "");
    } else if (field === "weekday") {
      const parts = String(value).split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length) c.weekday = parts; else drop("weekday");
    } else if (field === "above" || field === "below") {
      if (value === "") drop(field);
      else c[field] = isNaN(Number(value)) ? value : Number(value);
    } else if (value === "" || value == null) {
      drop(field);
    } else {
      c[field] = value;
    }
    this._setDirty(true);
  }

  /* ------------------------------------------------------------- filters */

  /* Every criterion in a filter, in the order it is written down in.
   *
   * A filter is a mapping of kind to values, and both a mapping and its lists
   * keep the order they were built in - through the store, through JSON, and
   * through the YAML dump. So the order on screen is the order on disk, and
   * moving a row is a change to the file rather than a preference held
   * somewhere on the side. */
  _critList(filter) {
    const out = [];
    for (const key of Object.keys(filter || {})) {
      if (key === "match") continue;
      const dim = FILTER_DIMS.find((d) => d.key === key);
      if (!dim) continue;
      (filter[key] || []).forEach((value, index) => out.push({ dim, index, value }));
    }
    return out;
  }

  /* A filter is a list of criteria, and every criterion is the same shape: a
   * kind, a value, a way of moving it, and a way of taking it off again. Two
   * areas are two rows, the same as an area and a domain are two rows, because
   * to the person writing it they are the same kind of statement.
   *
   * A chosen criterion is a line of text. Home Assistant's pickers are 56px
   * tall and there is no arguing with them, so only the one being chosen is a
   * picker; the rest sit at the height of everything else on the form. Clicking
   * a value opens it again. */
  _filterHtml(side, filter) {
    const list = this._critList(filter);
    const rows = list.map(({ dim, index, value }, at) =>
      this._critRow(side, dim, index, this._chipLabel(dim, value), {
        first: at === 0, last: at === list.length - 1, alone: list.length < 2,
      }));
    const being = this._editing;
    if (being && being.type === "crit" && being.side === side && being.index == null) {
      const dim = FILTER_DIMS.find((d) => d.key === being.dim);
      rows.push(this._critRow(side, dim, null, `Choose ${dim.label.toLowerCase()}…`));
    }

    const add = `<select class="addcrit" data-act="addcrit" data-side="${side}">
        <option value="">+ Add criterion</option>
        ${FILTER_DIMS.map((d) =>
          `<option value="${esc(d.key)}">${esc(d.label)}</option>`).join("")}
      </select>`;

    /* How the criteria add up, said whenever there is more than one of them.
     *
     * The card only has a choice to make when two different kinds are named:
     * two areas are always "either area", because an entity is in one room and
     * asking for both would select nothing. So with one kind the line is a
     * sentence rather than a control - and it is still a line, because two
     * rows and nothing saying how they combine is the question this answers. */
    const named = FILTER_DIMS.filter((d) => (filter[d.key] || []).length).length;
    const count = this._critList(filter).length;
    const match = named > 1
      ? `<div class="hint matchline">
           Entities in
           <span class="seg small">
             <button data-set="${side}.match" data-value="any"${
               filter.match === "any" ? ' class="on"' : ""}>any</button>
             <button data-set="${side}.match" data-value="all"${
               filter.match === "all" ? ' class="on"' : ""}>all</button>
           </span>
           of these
         </div>`
      : count > 1
      ? `<div class="hint matchline">Entities in <b>any</b> of these — two of
           one kind can only mean either.</div>`
      : "";

    const none = rows.length ? "" :
      `<div class="hint">${side === "include"
        ? "Nothing yet. An event covers what its criteria name."
        : "Nothing excepted."}</div>`;

    return `<div class="field"><div class="label strong">` +
      (side === "include" ? "Include" : "Except") +
      `</div><div class="crits">${rows.join("")}${none}${add}${match}</div></div>`;
  }

  /* One criterion: a kind, a value that is a button, and a way of taking it
   * off again.
   *
   * Clicking the value chooses another, and choosing is Home Assistant's own
   * chooser: every ha-*-picker opens a search box and a list of its own,
   * floated over the page. That chooser is the whole of what is worth showing,
   * so the picker field it belongs to is mounted out of sight at the row and
   * opened straight away - one click, and the list is there. Putting the field
   * on screen first only ever meant a second click on a control this form
   * cannot make its own size anyway.
   *
   * The two dimensions Home Assistant lends no picker for are a word each, and
   * a word is typed in the row itself. */
  _critRow(side, dim, index, label, where) {
    const being = this._editing;
    const open = being && being.type === "crit" && being.side === side &&
      being.dim === dim.key && being.index === index;
    const at = `data-side="${side}" data-dim="${dim.key}" ` +
      `data-index="${index == null ? "" : index}"`;
    const slot = `data-slot="${side}:${dim.key}:${index == null ? "" : index}"`;
    const value = open && !this._hasPicker(dim)
      ? `<span class="inlineslot" ${slot}></span>`
      : `<button class="val${index == null ? " empty" : ""}" data-act="editcrit" ${at}
                 title="Choose another">${esc(label)}</button>` +
        (open ? `<span class="pickhost" ${slot}></span>` : "");
    /* A row still being chosen has no place in the order yet, and one row on
     * its own has nowhere to go. */
    const move = where && !where.alone
      ? `<button class="mv" data-act="critup" ${at} title="Move up"
                 ${where.first ? "disabled" : ""}>↑</button>
         <button class="mv" data-act="critdown" ${at} title="Move down"
                 ${where.last ? "disabled" : ""}>↓</button>`
      : "";
    return `<div class="crit${open ? " open" : ""}">
        <span class="kind">${esc(dim.label)}</span>
        ${value}
        ${move}
        <button class="x row-x" data-act="${index == null ? "cancelcrit" : "unchip"}" ${at}
                title="${index == null ? "Cancel" : "Remove"}">×</button>
      </div>`;
  }

  /* Moving a criterion.
   *
   * Within its own kind it swaps with its neighbour. At the edge of its kind
   * it is the kind that moves, and the rows of that kind travel with it -
   * because a filter is a mapping of kind to values, and "an area, then an
   * entity, then another area" is a sentence the file cannot hold. So rows of
   * a kind stay together, and pressing the arrow always moves the row it is
   * on: first past its own siblings, then past the block above or below. */
  _moveCrit(side, dimKey, index, delta) {
    const filter = this._draft[side];
    if (!filter) return;
    const list = filter[dimKey] || [];
    const to = index + delta;
    if (to >= 0 && to < list.length) {
      list.splice(to, 0, list.splice(index, 1)[0]);
    } else {
      const keys = Object.keys(filter).filter((k) => k !== "match");
      const at = keys.indexOf(dimKey);
      const swap = at + delta;
      if (at === -1 || swap < 0 || swap >= keys.length) return;
      keys.splice(swap, 0, keys.splice(at, 1)[0]);
      /* Rebuilt rather than reassigned: a mapping's order is the order its
       * keys were put in, and there is no other way to say it. */
      const rebuilt = {};
      for (const key of keys) rebuilt[key] = filter[key];
      if (filter.match) rebuilt.match = filter.match;
      this._draft[side] = rebuilt;
    }
    this._setDirty(true);
    this._renderPane();
  }

  _hasEl(tag) {
    return !!customElements.get(tag);
  }

  /* A dimension has a picker of its own only where Home Assistant has one to
   * lend; the other two are text either way. */
  _hasPicker(dim) {
    return !!(dim.pick && this._hasEl(dim.pick));
  }

  /* `match` belongs to a filter that names two things, and an empty row names
   * nothing. One place decides it, so the question the form asks and the
   * answer it stores cannot disagree.
   *
   * The two sides start from opposite answers, because they are asked for
   * opposite reasons. Include narrows: a floor and a domain means the lights
   * on that floor, not every light in the house plus every device on the
   * floor. Except widens: naming a room and a pattern means neither of them,
   * and an exception that only applied where both were true would except
   * almost nothing. */
  _syncMatch(side) {
    const filter = this._draft[side];
    if (!filter) return;
    const named = FILTER_DIMS.filter((d) => (filter[d.key] || []).length).length;
    if (named < 2) delete filter.match;
    else if (!filter.match) filter.match = side === "exclude" ? "any" : "all";
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
      const [side, key, index] = slot.dataset.slot.split(":");
      const dim = FILTER_DIMS.find((d) => d.key === key);
      const el = this._pickerFor(side, dim, index === "" ? null : Number(index));
      slot.appendChild(el);
      if (slot.classList.contains("pickhost")) {
        this._openPicker(el);
      } else {
        const input = slot.querySelector("input");
        if (input && input.focus) input.focus();
      }
    }
    for (const box of this._el.pane.querySelectorAll("[data-iconslot]")) {
      const el = this._iconFor(box.dataset.iconslot);
      box.appendChild(el);
      this._openPicker(el);
    }
  }

  /* Ask a picker to show its list.
   *
   * Five of the six have open(). ha-icon-picker does not, and the
   * ha-generic-picker inside it does - both established in a browser rather
   * than guessed at, along with the part that matters here: calling open()
   * before the picker has drawn does nothing at all, silently. So this waits
   * for it to have drawn, which is one frame on a warm module and rather more
   * on the first use of a cold one. */
  _openPicker(el, tries = 30) {
    if (!el.isConnected) return;
    const drawn = el.shadowRoot && el.shadowRoot.childElementCount;
    const inner = drawn && el.shadowRoot.querySelector("ha-generic-picker");
    const target = typeof el.open === "function"
      ? el
      : inner && typeof inner.open === "function" ? inner : null;
    if (drawn && target) return target.open();
    if (tries) requestAnimationFrame(() => this._openPicker(el, tries - 1));
  }

  /* mdi has 7000 icons and a text field is a poor way to find one of them. */
  _iconFor(path) {
    const el = document.createElement("ha-icon-picker");
    el.hass = this._hass;
    const [head, tail] = path.split(".");
    const current = tail ? (this._draft[head] || {})[tail] : this._draft[head];
    el.value = typeof current === "string" ? current : "";
    el.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      this._set(path, e.detail ? e.detail.value : "");
    });
    return el;
  }

  /* The control for choosing one criterion's value. Home Assistant's own where
   * it has one, a text field where it does not - and either way it is on
   * screen only while something is being chosen. */
  _pickerFor(side, dim, index) {
    /* Which draft this control belongs to, and which drawing of the form.
     *
     * A text field commits when it is left, and "left" includes being left
     * behind: focusing something in a freshly drawn pane blurs whatever was
     * focused before, and a listener from the previous render then wrote its
     * old value into whichever event happened to be open now. Opening a new
     * event inherited an area from the last one edited - a bug that would have
     * been very hard to see and impossible to reproduce on purpose.
     *
     * The same late blur bites within one event too, which is what the second
     * half of this guard is for. Adding a criterion straight after typing one
     * put a row on the screen and then took it away again: the departing
     * field's blur arrived after the new row had been drawn, committed a value
     * that was already committed, and cleared the row being filled in as it
     * went. Found by the harness rather than by use, which is the only reason
     * it is not still in here.
     *
     * So the closure knows both the draft it was made for and the drawing it
     * was made in, and writes to those or to nothing. */
    const owner = this._draft;
    const gen = this._gen;
    const commit = (value, render = true) => {
      if (value == null || value === "") return false;
      if (this._draft !== owner || this._gen !== gen) return false;
      const filter = this._draft[side] || (this._draft[side] = {});
      const list = filter[dim.key] || (filter[dim.key] = []);
      if (index == null) {
        if (list.indexOf(value) === -1) list.push(value);
      } else {
        list[index] = value;
      }
      this._syncMatch(side);
      this._setDirty(true);
      this._editing = null;
      /* Saving flushes these without redrawing: the draft is what the save
       * reads, and pulling the pane out from under the click that started it
       * is how a Save button stops working. */
      if (render) this._renderPane();
      return true;
    };
    const current = index == null
      ? "" : ((this._draft[side] || {})[dim.key] || [])[index] || "";

    if (this._hasPicker(dim)) {
      const el = document.createElement(dim.pick);
      el.hass = this._hass;
      el.allowCustomEntity = true;
      el.value = current;
      el.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const v = e.detail && e.detail.value;
        if (v) commit(v);
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
    input.value = current;
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
    const send = (render = true) => commit(input.value.trim(), render);
    this._pending.push(send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this._editing = null;
        return this._renderPane();
      }
      if (e.key !== "Enter") return;
      e.preventDefault();
      send();
    });
    input.addEventListener("blur", () => send());
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
        this._showMatches ? "hide" : "show them"}</button>` : "") +
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
      `<div class="mroom">${esc(area)} <span class="dim">(${rows.length})</span></div>` +
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
    /* A row stops being the one being edited when the eye moves on. Clicks
     * inside Home Assistant's own chooser never reach here - it draws its list
     * outside this shadow root - so this only sees clicks on the form itself. */
    const path = e.composedPath();
    if (this._editing && !path.some((n) => n && n.classList &&
        (n.classList.contains("inlineslot") || n.classList.contains("val")))) {
      /* Leaving a field commits it - otherwise clicking Save with a word still
       * typed threw the word away and then explained that the filter was
       * empty. */
      for (const send of this._pending) send(false);
      this._editing = null;
      this._renderPane();
    }
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
      case "tab-visual": return this._toVisual();
      case "tab-yaml": return this._openYaml();
      case "critup":
      case "critdown":
        return this._moveCrit(el.dataset.side, el.dataset.dim,
          Number(el.dataset.index), el.dataset.act === "critup" ? -1 : 1);
      case "editcrit":
        this._editing = {
          type: "crit", side: el.dataset.side, dim: el.dataset.dim,
          index: el.dataset.index === "" ? null : Number(el.dataset.index),
        };
        return this._renderPane();
      case "cancelcrit":
        this._editing = null;
        return this._renderPane();
      case "editicon":
        this._editing = { type: "icon", path: el.dataset.path };
        return this._renderPane();
      case "clearicon":
        this._set(el.dataset.path, "");
        this._editing = null;
        return this._renderPane();
      case "sub-what":
      case "sub-when":
      case "sub-how":
        this._sub = el.dataset.act.slice(4);
        return this._renderPane();
      case "unchip": {
        const f = this._draft[el.dataset.side] || {};
        const list = f[el.dataset.dim] || [];
        list.splice(Number(el.dataset.index), 1);
        if (!list.length) delete f[el.dataset.dim];
        this._syncMatch(el.dataset.side);
        if (!Object.keys(f).length) delete this._draft[el.dataset.side];
        this._setDirty(true);
        return this._renderPane();
      }
      case "plural": {
        const key = el.dataset.value;
        const v = this._draft[key];
        this._draft[key] = v && typeof v === "object"
          ? (v.one || v.many || "")
          : { one: typeof v === "string" ? v : "", many: "" };
        this._setDirty(true);
        return this._renderPane();
      }
      case "addcond": {
        const list = this._condListAt(el.dataset.path);
        if (!list) return;
        list.push({ condition: "state", state: "on" });
        this._setDirty(true);
        return this._renderPane();
      }
      case "delcond": {
        const path = String(el.dataset.path);
        const parts = path.split(".");
        const index = Number(parts.pop());
        const list = this._condListAt(parts.join("."));
        if (!list) return;
        const going = list[index];
        /* A group takes what is inside it, and nothing on screen says how much
         * that is once it is folded into one line. */
        if (going && GROUP_KINDS.indexOf(going.condition) !== -1 &&
            (going.conditions || []).length &&
            !ask(`Remove this group and the ${going.conditions.length} ` +
                 "conditions inside it?")) {
          return;
        }
        list.splice(index, 1);
        if (!list.length && !parts.length) delete this._draft.conditions;
        this._setDirty(true);
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
    /* Choosing a kind from the menu opens a row of that kind, waiting for its
     * value. The menu itself never holds a selection. */
    if (el && el.dataset && el.dataset.act === "addcrit") {
      const dim = el.value;
      el.value = "";
      if (!dim) return;
      this._editing = { type: "crit", side: el.dataset.side, dim, index: null };
      return this._renderPane();
    }
    if (el && el.dataset && el.dataset.cond) {
      const [path, field] = el.dataset.cond.split(":");
      const value = el.type === "checkbox" ? el.checked : el.value;
      /* Turning a group into something else empties it, and an emptied group
       * cannot be got back by choosing the old word again. */
      if (field === "condition") {
        const current = this._condAt(path);
        const wasGroup = current && GROUP_KINDS.indexOf(current.condition) !== -1;
        const inside = wasGroup ? (current.conditions || []).length : 0;
        if (inside && GROUP_KINDS.indexOf(value) === -1 &&
            !ask(`Make this a ${humanise(value).toLowerCase()} condition? ` +
                 `The ${inside} conditions inside it will be removed.`)) {
          return this._renderPane();
        }
      }
      this._setCond(path, field, value);
      /* The kind of condition decides which fields exist; everything else is
       * a value in a field that is already there and must not take the focus
       * away mid-word. */
      if (field === "condition" || field === "mode") this._renderPane();
      return;
    }
    if (!el || !el.dataset || !el.dataset.set) {
      if (el && el.classList && el.classList.contains("yaml")) this._setDirty(true);
      return;
    }
    if (el.tagName === "BUTTON") return;
    /* "New section…" is a choice about what to answer with, not an answer. It
     * puts a field there and leaves the event in the section it was already
     * in until that field says otherwise. */
    if (el.dataset.set === "category" && el.value === NEW_CATEGORY) {
      this._newcat = true;
      return this._renderPane();
    }
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
    this._setDirty(true);
    let structural = false;

    if (path === "category-new") {
      /* Named, or thought better of: either way the field has had its turn. */
      this._newcat = false;
      const label = String(value).trim();
      if (label) {
        /* Two things, not one. The id is what an event stores and what the
         * card groups by, so it is plain and lowercase; the label is what was
         * typed, capitals and all, and it is kept beside it. Deriving the
         * label back from the id was where "TV alerts" became "Tv Alerts".
         *
         * It is only written when the event is, so a section thought better
         * of leaves nothing behind. */
        this._newCategory = null;
        const id = label.toLowerCase().replace(/\s+/g, "_");
        d.category = id;
        if (this._catLabel(id) !== label) this._newCategory = { id, label };
      }
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

  /* Put a newly named section in the preset, keeping the spelling.
   *
   * The preset is fetched again rather than taken from the cache: this writes
   * the whole of it back, and writing back a copy that was read minutes ago
   * would undo anything saved in between. */
  async _writeCategory() {
    const pending = this._newCategory;
    if (!pending) return;
    const res = await this._ws({ type: "home_events/get" });
    const preset = clone((res.presets || {})[this._presetId]);
    if (!preset) return;
    const cats = preset.categories || (preset.categories = []);
    if (!cats.some((c) => c.id === pending.id)) {
      cats.push({ id: pending.id, label: pending.label });
      await this._ws({
        type: "home_events/save", preset: this._presetId, data: preset,
      });
    }
    this._newCategory = null;
  }

  async _save() {
    /* Whatever is still sitting in an add-field counts: it is on the screen,
     * so it is part of what was meant. No redraw - the draft is what the save
     * reads, and redrawing mid-save would pull the button out from under the
     * click that started this. */
    for (const send of this._pending) send(false);
    try {
      if (this._mode === "library") {
        const text = this._el.pane.querySelector(".yaml").value;
        await this._ws({ type: "home_events/import", preset: this._presetId, yaml: text });
        this._setDirty(false);
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
      /* A section named while writing this event exists once the event does,
       * and not before. It goes first: an event landing in a section the
       * preset has never heard of would read by its id until the next write. */
      await this._writeCategory();
      await this._ws(msg);
      this._selected = name;
      this._renamedFrom = name;
      this._name = name;
      this._setDirty(false);
      this._el.del.style.display = "";
      await this._reload();
      if (this._mode === "yaml") {
        this._draft = this._formShape(clone(this._events()[name]) || {});
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
      this._setDirty(false);
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

  /* One place where "there is something to save" is decided, so the button can
   * say it. A Save that is always available is a Save that tells you nothing;
   * this one is lit exactly when pressing it would do something. */
  _setDirty(value) {
    this._dirty = value;
    const save = this.shadowRoot.querySelector('[data-act="save"]');
    if (!save) return;
    const nothing = !value && this._mode !== "library";
    save.disabled = nothing;
    save.classList.toggle("idle", nothing);
    save.textContent = value ? "Save" : "Saved";
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

.side { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.side .wide { width: 100%; }
.list, .editor {
  background: var(--card-background-color, #fff);
  border-radius: var(--ha-card-border-radius, 16px);
  box-shadow: var(--ha-card-box-shadow, none);
  min-height: 0;
}
.list { padding: 8px; overflow: auto; flex: 1; }
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
/* Two halves of one answer - whether to show a time, and which time - so they
   sit on one line. The rule above gives everything in a field the full width,
   which put them on two. */
.field .inline > select, .field .inline > input { width: auto; }
.field .inline > select { min-width: 150px; }
.newcat { margin-top: 6px; }


/* Three questions, one at a time, and they stay where they are: the pane
   scrolls under them, so which question you are answering is never something
   you have to scroll back up to check. */
.subtabs {
  display: flex; gap: 4px; padding: 2px 0 14px;
  position: sticky; top: 0; z-index: 6;
  background: var(--card-background-color, #fff);
}
.subtab {
  padding: 6px 14px; font-size: 13px; border-radius: 999px;
  color: var(--secondary-text-color);
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
}
.subtab.on {
  color: var(--primary-text-color);
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
}

/* One criterion, one line. Two areas are two lines, the same as an area and a
   domain are two lines, because they are the same kind of statement. */
.crits { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.crit {
  display: flex; align-items: center; gap: 10px;
  width: 100%; min-height: 32px;
}
.crit .kind {
  font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--secondary-text-color);
  width: 62px; flex: none;
}
.crit .val {
  flex: 1; text-align: left; font-size: 14px; padding: 6px 10px;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-radius: 8px; color: inherit; background: transparent;
}
.crit .val:hover { border-color: var(--primary-color); }
/* Where a picker goes to be opened without being seen.
   Home Assistant's chooser anchors itself to the field it belongs to, so the
   field is parked at the row - same left edge, same width - and made
   invisible. What drops down then reads as this row's own list, and the row
   stays at the height of the rest of the form. */
.crit { position: relative; }
.crit .val.empty { color: var(--secondary-text-color); border-style: dashed; }
.crit.open .val { border-color: var(--primary-color); }
.crit .preview { --mdc-icon-size: 20px; width: 20px; color: var(--secondary-text-color); }
.crit.iconrow .kind { display: none; }
.pickhost {
  position: absolute; left: 62px; right: 0; top: 0; height: 0;
  overflow: hidden; opacity: 0; pointer-events: none;
}
.crit.iconrow .pickhost { left: 0; }
.pickhost > * { display: block; width: 100%; }
/* Typed rather than chosen: the two dimensions Home Assistant lends no picker
   for are a word each, and the word is typed in the row itself. */
.inlineslot { flex: 1; min-width: 0; }
.inlineslot .fallback, .inlineslot input { width: 100%; box-sizing: border-box; }
.inlineslot input { border-color: var(--primary-color); padding: 6px 10px; }
.addcrit {
  font-size: 13px; padding: 5px 9px; margin-top: 2px;
  color: var(--secondary-text-color);
  border-style: dashed;
}
.matchline { padding-top: 8px; }
.fallback { display: block; }
.fallback input { width: 100%; box-sizing: border-box; }

/* A row that can be taken away says so at the end of itself. */
.field.sub { grid-template-columns: 96px minmax(0, 1fr) auto; }
.row-x {
  border: 0; background: none; cursor: pointer;
  color: var(--secondary-text-color); font-size: 17px; line-height: 1;
  padding: 6px 8px; border-radius: 6px;
}
.row-x:hover { background: rgba(127,127,127,.16); color: var(--error-color, #d8574a); }
/* Ordering a filter is for reading it, not for what it selects - so the arrows
   are quiet, and they only exist where there is somewhere to go. */
.mv {
  border: 0; background: none; cursor: pointer; padding: 4px 3px;
  color: var(--secondary-text-color); font-size: 13px; line-height: 1;
  border-radius: 6px;
}
.mv:hover:not([disabled]) { background: rgba(127,127,127,.16); color: var(--primary-text-color); }
.mv[disabled] { opacity: .25; cursor: default; }
.primary.idle {
  background: transparent; color: var(--secondary-text-color);
  border-color: var(--divider-color, rgba(127,127,127,.3)); cursor: default;
}

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
.pair label { display: grid; grid-template-columns: 76px minmax(0,1fr); gap: 8px; align-items: center; }
.pair span { font-size: 11px; color: var(--secondary-text-color); }
.check { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; }

.cond { display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
  border: 1px solid var(--divider-color, rgba(127,127,127,.25));
  border-radius: 9px; padding: 7px 10px; margin-bottom: 7px; }
.cond .grow { flex: 1; }

/* A group of conditions: the word that says how they add up, and the rail
   under it holding what it applies to. The rail is what makes the nesting
   readable at a glance - which is the whole reason the group is drawn at all
   rather than left as YAML. */
.group { margin-bottom: 7px; }
.group > .ghead { margin-bottom: 0; border-bottom-left-radius: 0;
  border-bottom-right-radius: 0; }
.group > .subconds {
  margin: 0 0 0 13px; padding: 8px 0 2px 13px;
  border-left: 2px solid var(--divider-color, rgba(127,127,127,.25));
}
.group > .subconds > .hint { padding-bottom: 6px; }
.cond select, .cond .cv {
  font: inherit; font-size: 13px; padding: 5px 8px; border-radius: 7px;
  background: var(--card-background-color, transparent); color: inherit;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
}
.cond .cv { width: 150px; }
.cond .cv.num { width: 78px; }
.cond .cv.narrow { width: 110px; }
.cond .lbl { font-size: 12px; color: var(--secondary-text-color); }
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
