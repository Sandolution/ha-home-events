/* home-events-panel — the Events editor in the sidebar.
 *
 * Hand-written, no build step. This host has no JavaScript runtime, so nothing
 * here can be compiled, bundled or type-checked; the same constraint shaped the
 * four cards and it shapes this. Plain custom element, plain DOM, one
 * stylesheet, no framework.
 *
 * It deliberately depends on no `ha-*` element. Those are registered lazily by
 * the frontend as pages use them, and a panel page uses almost none of them, so
 * reaching for `ha-form` or `ha-entity-picker` here is a bet that they happen
 * to be loaded. That bet is worth making later, for the picker UI - and when it
 * is made it will be behind a check with a plain-input fallback. For now the
 * panel is HTML, styled from Home Assistant's own theme variables so it looks
 * like it belongs.
 *
 * YAML is never parsed here. The server holds the only parser and the only
 * validator, so what the panel shows and what the card will get cannot drift,
 * and a typo is answered with a sentence instead of a broken dashboard. The
 * store keeps structure, not text: comments and blank lines do not survive a
 * save, exactly as they do not in automations.yaml.
 */

const PANEL_BUILD = "2026-08-10a";

const STARTER = `category: alerts
include:
  domains: [binary_sensor]
conditions:
  - condition: state
    state: "on"
severity: alert
`;

const SEVERITY_COLOUR = {
  alert: "var(--error-color, #d8574a)",
  attention: "var(--warning-color, #d8a24e)",
  active: "var(--success-color, #5cb87f)",
  info: "var(--secondary-text-color)",
};

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const humanise = (s) =>
  String(s || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

class HomeEventsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._presets = {};
    this._presetId = "default";
    /* What the editor is holding: an event name, or the whole library. Both
     * are text on the way in and on the way out; only the server knows what
     * the text means. */
    this._selected = null;
    this._mode = "event";
    this._renamedFrom = null;
    this._dirty = false;
    this._built = false;
    this._unsub = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._load();
  }

  get hass() {
    return this._hass;
  }

  /* Home Assistant sets these on every panel. Ignored, but declared so it is
   * clear they were not forgotten: this panel has no routes of its own and
   * lays out the same at either width. */
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

  async _ws(payload) {
    return this._hass.connection.sendMessagePromise(payload);
  }

  _subscribe() {
    /* The panel is not the only editor: a second tab, or a future service
     * call, changes the same library. Following the store rather than trusting
     * the last thing this tab did is the difference between an editor and a
     * cache with opinions. */
    this._unsub = this._hass.connection.subscribeMessage(
      () => this._reload(),
      { type: "home_events/subscribe" }
    );
  }

  async _load() {
    try {
      const res = await this._ws({ type: "home_events/get" });
      this._presets = res.presets || {};
      this._schema = res.schema_version;
      if (!this._presets[this._presetId]) {
        this._presetId = Object.keys(this._presets)[0] || "default";
      }
      this._renderShell();
      const names = Object.keys(this._events());
      if (names.length) this._openEvent(names[0]);
      else this._openLibrary();
    } catch (err) {
      this._say(err && err.message ? err.message : String(err), true);
    }
  }

  async _reload() {
    const res = await this._ws({ type: "home_events/get" });
    this._presets = res.presets || {};
    this._renderList();
    /* An unsaved edit is the one thing a background refresh must not throw
     * away, so the editor is left exactly as it is and says why. */
    if (this._dirty) this._say("Changed elsewhere - your edit is still here", false);
  }

  _preset() {
    return this._presets[this._presetId] || { events: {}, categories: [] };
  }

  _events() {
    return this._preset().events || {};
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
              <input class="name" spellcheck="false" autocomplete="off">
              <span class="grow"></span>
              <button class="ghost danger" data-act="delete">Delete</button>
              <button class="primary" data-act="save">Save</button>
            </div>
            <textarea class="yaml" spellcheck="false" autocapitalize="off"
                      autocomplete="off" wrap="off"></textarea>
            <div class="msg"></div>
          </section>
        </main>
      </div>`;

    const $ = (sel) => this.shadowRoot.querySelector(sel);
    this._el = {
      list: $(".list"),
      name: $(".name"),
      yaml: $(".yaml"),
      msg: $(".msg"),
      preset: $(".preset"),
      del: $('[data-act="delete"]'),
    };

    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this._el.yaml.addEventListener("input", () => {
      this._dirty = true;
      this._say("");
    });
    this._el.name.addEventListener("input", () => {
      this._dirty = true;
    });
    this._el.preset.addEventListener("change", (e) => {
      this._presetId = e.target.value;
      this._load();
    });
    this.shadowRoot.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this._save();
      }
    });
    this._built = true;
  }

  _onClick(e) {
    const el = e.composedPath().find((n) => n && n.dataset && (n.dataset.act || n.dataset.event));
    if (!el) return;
    if (el.dataset.event) return this._openEvent(el.dataset.event);
    switch (el.dataset.act) {
      case "save":
        return this._save();
      case "delete":
        return this._delete();
      case "new":
        return this._newEvent();
      case "library":
        return this._openLibrary();
      case "menu":
        return this.dispatchEvent(
          new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
        );
    }
  }

  _renderShell() {
    const ids = Object.keys(this._presets);
    this._el.preset.innerHTML = ids
      .map(
        (id) =>
          `<option value="${esc(id)}"${id === this._presetId ? " selected" : ""}>` +
          `${esc(this._presets[id].name || humanise(id))}</option>`
      )
      .join("");
    this._el.preset.style.display = ids.length > 1 ? "" : "none";
    this._renderList();
  }

  _renderList() {
    const events = this._events();
    const names = Object.keys(events);
    if (!names.length) {
      this._el.list.innerHTML =
        `<div class="empty">No events yet.<br><br>` +
        `Start one with <b>New event</b>, or paste a library you already ` +
        `have into <b>Whole library</b>.</div>`;
      return;
    }

    /* Grouped by the section they land in, in the order the categories are
     * declared, because that is the order they will be read on the card. */
    const declared = (this._preset().categories || []).map((c) => c.id);
    const label = {};
    for (const c of this._preset().categories || []) {
      label[c.id] = c.label || humanise(c.id);
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
    order.sort((a, b) => {
      const ia = declared.indexOf(a);
      const ib = declared.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    this._el.list.innerHTML = order
      .map((cat) => {
        const rows = buckets[cat]
          .map((name) => {
            const e = events[name];
            const off = e.enabled === false;
            const dot = SEVERITY_COLOUR[e.severity] || SEVERITY_COLOUR.info;
            const sel = name === this._selected && this._mode === "event";
            const what = [
              e.group ? "grouped" : "",
              (e.conditions || []).length
                ? `${e.conditions.length} condition${e.conditions.length > 1 ? "s" : ""}`
                : "any state",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              `<div class="row${sel ? " sel" : ""}${off ? " off" : ""}" ` +
              `data-event="${esc(name)}" tabindex="0">` +
              `<span class="dot" style="background:${dot}"></span>` +
              `<span class="nm">${esc(name)}</span>` +
              `<span class="sub">${esc(what)}</span></div>`
            );
          })
          .join("");
        return `<div class="cat">${esc(label[cat] || humanise(cat))}</div>${rows}`;
      })
      .join("");
  }

  /* --------------------------------------------------------------- editing */

  async _openEvent(name) {
    if (!(await this._confirmDiscard())) return;
    try {
      const res = await this._ws({
        type: "home_events/export",
        preset: this._presetId,
        event: name,
      });
      this._mode = "event";
      this._selected = name;
      this._renamedFrom = name;
      this._el.name.value = name;
      this._el.name.disabled = false;
      this._el.del.style.display = "";
      this._el.yaml.value = res.yaml;
      this._dirty = false;
      this._say("");
      this._renderList();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _openLibrary() {
    if (!(await this._confirmDiscard())) return;
    try {
      const res = await this._ws({
        type: "home_events/export",
        preset: this._presetId,
      });
      this._mode = "library";
      this._selected = null;
      this._renamedFrom = null;
      this._el.name.value = this._presets[this._presetId]?.name || this._presetId;
      this._el.name.disabled = true;
      this._el.del.style.display = "none";
      this._el.yaml.value = res.yaml;
      this._dirty = false;
      this._say("The whole preset, categories and all. Paste one in to replace it.");
      this._renderList();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _newEvent() {
    if (!(await this._confirmDiscard())) return;
    this._mode = "event";
    this._selected = null;
    this._renamedFrom = null;
    this._el.name.value = "";
    this._el.name.disabled = false;
    this._el.del.style.display = "none";
    this._el.yaml.value = STARTER;
    this._dirty = true;
    this._say("Name it, then save. The name is what a card refers to.");
    this._renderList();
    this._el.name.focus();
  }

  async _save() {
    const yamlText = this._el.yaml.value;
    try {
      if (this._mode === "library") {
        await this._ws({
          type: "home_events/import",
          preset: this._presetId,
          yaml: yamlText,
        });
      } else {
        const name = this._el.name.value.trim();
        const msg = {
          type: "home_events/save_event",
          preset: this._presetId,
          name,
          yaml: yamlText,
        };
        if (this._renamedFrom && this._renamedFrom !== name) {
          msg.rename_from = this._renamedFrom;
        }
        await this._ws(msg);
        this._selected = name;
        this._renamedFrom = name;
        this._el.del.style.display = "";
      }
      this._dirty = false;
      await this._reload();
      this._say("Saved");
    } catch (err) {
      /* The server's words, not a summary of them: it says which event, which
       * key, and what would have been wrong with it. */
      this._say(this._reason(err), true);
    }
  }

  async _delete() {
    if (this._mode !== "event" || !this._selected) return;
    if (!confirm(`Delete the event "${this._selected}"?`)) return;
    try {
      await this._ws({
        type: "home_events/delete_event",
        preset: this._presetId,
        name: this._selected,
      });
      this._dirty = false;
      await this._reload();
      const names = Object.keys(this._events());
      if (names.length) await this._openEvent(names[0]);
      else await this._openLibrary();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _confirmDiscard() {
    if (!this._dirty) return true;
    return confirm("There are unsaved changes here. Discard them?");
  }

  _reason(err) {
    if (!err) return "Something went wrong";
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
  height: var(--bar-h); flex: none;
  padding: 0 16px;
  box-sizing: border-box;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, #fff);
}
.title { font-size: 20px; font-weight: 400; }
.grow { flex: 1; }

button {
  font: inherit; cursor: pointer;
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 7px 14px;
  background: transparent;
  color: inherit;
}
button:hover { background: rgba(127,127,127,.16); }
button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
.bar .ghost { border-color: rgba(255,255,255,.35); }
.icon { font-size: 20px; padding: 4px 8px; line-height: 1; }
.editor .ghost { border-color: var(--divider-color, rgba(127,127,127,.3)); }
.primary {
  background: var(--primary-color); color: var(--text-primary-color, #fff);
  font-weight: 500;
}
.danger { color: var(--error-color, #d8574a); }
select {
  font: inherit; padding: 5px 8px; border-radius: 8px;
  background: rgba(255,255,255,.12); color: inherit;
  border: 1px solid rgba(255,255,255,.35);
}
select option { color: var(--primary-text-color); background: var(--card-background-color); }

main {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
}
@media (max-width: 800px) { main { grid-template-columns: 1fr; } }

.list, .editor {
  background: var(--card-background-color, #fff);
  border-radius: var(--ha-card-border-radius, 16px);
  box-shadow: var(--ha-card-box-shadow, none);
  overflow: auto;
  min-height: 0;
}
.list { padding: 8px; }
.empty { padding: 24px 16px; color: var(--secondary-text-color); line-height: 1.5; }

/* The section eyebrow, in the same treatment the cards use, so the panel and
   what it is editing read as one thing. */
.cat {
  font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color);
  padding: 14px 10px 6px;
}
.row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
}
.row:hover { background: rgba(127,127,127,.10); }
.row.sel { background: rgba(127,127,127,.18); }
.row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.row.off { opacity: .45; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.nm {
  font-size: 14px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sub { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; }

.editor { display: flex; flex-direction: column; padding: 12px 14px; overflow: hidden; }
.ed-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; }
.name {
  font: inherit; font-size: 16px;
  padding: 7px 10px; min-width: 0; width: 260px;
  border-radius: 8px;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  background: transparent; color: inherit;
}
.name:disabled { border-color: transparent; opacity: .7; }

textarea {
  flex: 1; min-height: 0;
  font-family: var(--ha-font-family-code, ui-monospace, Menlo, Consolas, monospace);
  font-size: 13px; line-height: 1.55;
  tab-size: 2;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  resize: none;
}
textarea:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 0; }

.msg {
  min-height: 20px;
  padding-top: 8px;
  font-size: 13px;
  color: var(--secondary-text-color);
  white-space: pre-wrap;
}
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
