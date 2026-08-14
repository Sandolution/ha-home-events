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

const PANEL_BUILD = "2026-08-14f";

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
/* home-event-card.js: SORT_MODES, and the one that is not a mode - a section
 * that says nothing follows whatever the card was told. */
const SORTS = [
  { key: "", label: "As the card says" },
  { key: "recent", label: "Newest first" },
  { key: "duration", label: "Longest first" },
  { key: "name", label: "By name" },
];

const GROUPS = [
  { key: null, label: "No" },
  { key: "area", label: "Per room" },
  { key: "all", label: "One row" },
];
const TIME_MODES = ["since", "until", "ago", "remaining"];
const DEFAULT_TIME_MODE = "since";
/* The conditions that hold other conditions. Core's own three, and the card
 * evaluates them the way core does: and passes when every one inside passes,
 * or when any does, not when none does. */
const GROUP_KINDS = ["and", "or", "not"];
/* The card's PLURAL_KEYS: the slots that may be worded once per kind of row.
 * Grouping makes three - a single thing on its own, a member of an open group,
 * and the group itself - and they are read in three different places. */
const PLURAL_KEYS = ["title", "detail", "status", "icon", "time_mode"];
/* The card's WORDING_KEYS, with what each is called on the form. `each` falls
 * back to `one` when it is left empty, which is what every config written
 * before there was a third wording relies on. */
const WORDINGS = [
  ["one", "on its own", "A row for a single thing, with nothing above it saying what it is"],
  ["each", "inside a group", "Read under the group's row, which has already named them. Empty means: the same as on its own"],
  ["many", "the group row", "The row that stands for the lot and counts them"],
];

/* Not a section: the option in the list that asks for one. It is a word no
 * category id can be, because a category id is what this form makes of what
 * somebody typed, and it never makes this. */
const NEW_CATEGORY = "__new__";

/* What the card calls the section for events that name none. It is a section
 * like any other once it exists on screen - it has a heading, it holds rows,
 * and it sorts them - so it is arranged like any other. What it is not is a
 * section an event can be *put* in: that is what leaving Section alone does. */
const GENERIC_CATEGORY = "generic";

const TEXT_SLOTS = [
  { key: "title", label: "Title", hint: "The domain's own wording" },
  { key: "detail", label: "Detail", hint: "Usually the room" },
  { key: "status", label: "Status", hint: "The domain's own wording" },
  { key: "icon", label: "Icon", hint: "mdi:…" },
];

/* What a new event starts as.
 *
 * Deliberately without an `include`: what an event covers is the one thing
 * only its author knows, and a filter put there to be helpful is a filter
 * somebody has to notice and take off. The state condition is different - it
 * is the same for nearly every event ever written here, and it is one field to
 * change rather than a criterion to remove. */
const STARTER = {
  category: "alerts",
  conditions: [{ condition: "state", state: "on" }],
  severity: "info",
};

/* The preview card's own options.
 *
 * Not the dashboard's: there may be several dashboards drawing this library
 * and the panel has no way to know which one is being thought about. What it
 * shows is the entry - the row itself, with no section heading around it and
 * no cap worth hitting. Everything about how the row *reads* comes from the
 * event, which is the half being edited. */
const PREVIEW_CONFIG = {
  type: "custom:home-event-card",
  group_by: "none",
  split_sections: false,
  max: 4,
  hide_when_empty: false,
};
/* The overview's card. Not the preview's: this one is the whole library on a
 * dashboard, so it keeps its sections and its headings, and is capped at a
 * screenful because it is there to be recognised rather than read. */
const HOME_CONFIG = {
  type: "custom:home-event-card",
  group_by: "category",
  split_sections: true,
  max: 12,
  hide_when_empty: false,
};

/* How many entities "many" is. Enough that a count reads as a count and the
 * plural wording is exercised; few enough that the answer is still one row to
 * look at rather than a list to scan. */
const PREVIEW_MANY = 3;

/* What can go in Title, Detail, Status and Icon. Read at the bottom of the How
 * tab, where the fields it is about are - a syntax explained somewhere else is
 * a syntax nobody finds.
 *
 * Every value in the second column was produced by rendering that template
 * through the card, not written from memory. A cheat sheet is read as
 * documentation and believed, so a wrong one is worse than none - see
 * scratchpad/jsenv/probe_examples.mjs, which is what produced them.
 *
 * The entities are invented. A worked example does not need anybody's bedroom
 * in it, and an invented lamp is steadier than a real one: a real brightness
 * changes the moment somebody dims it.
 *
 * Kept as data rather than as a block of markup so the columns stay columns
 * and the list can be checked against the card's own _interp. */
const EXAMPLE_ENTITY = "a light called Kitchen | Ceiling, switched on";
const PLACEHOLDERS = [
  ["{name}", "Ceiling", "the entity, without the room"],
  ["{area}", "Kitchen", "the room it is in"],
  ["{state}", "On", "what it is doing, in words"],
  ["{state.raw}", "on", "the same, spelled the way a condition spells it"],
  ["{attr.brightness}", "128", "any attribute, by name"],
  ["{attr.friendly_name}", "Kitchen | Ceiling", "the whole name, room and all"],
  ["{state@sensor.other}", "—", "some other entity's state, not this one's"],
  ["{n}", "—", "how many rows this one stands for, on a grouped event"],
];

/* Three replacements and what they actually did, on two more invented names
 * of the shape integrations produce: a room, a device, a machine word. The
 * pattern goes after the first | inside the braces. */
/* Write a literal pipe as [|], never as \| .
 *
 * The card draws a name as Home Assistant has it, so patterns about names are
 * mostly patterns about pipes - and a pipe is the one character here that is
 * easy to get wrong twice. Bare, it means alternation. Escaped as \| it is
 * correct until something adds a second backslash on the way in, and then
 * \\| is "a backslash, or the other thing", which quietly matches the empty
 * side and eats whatever came next. In a character class it is a pipe and
 * cannot be anything else.
 *
 * Every line here is checked against the card's own interpolation - see
 * check_examples in the harness - so what this page promises is what the row
 * will say. */
const FILTER_EXAMPLES = [
  ["{name|s/^[^|]+[|] //}",
   "Ground Floor | Air Purifier | Error", "Air Purifier | Error",
   "drop the first segment, when the name starts with somewhere"],
  ["{name|s/ [|] (State|Error|Status)$//}",
   "Kitchen | Dishwasher | State", "Kitchen | Dishwasher",
   "drop the machine word an integration put on the end"],
  ["{name|s/^[^|]+[|] | [|] (State|Error|Status)$//g}",
   "Ground Floor | Air Purifier | Error", "Air Purifier",
   "both at once — two alternatives and g, since a slot gets one replace"],
  ["{name|s/\\s*[|]\\s*/ — /g}",
   "Kitchen | Dishwasher | State", "Kitchen — Dishwasher — State",
   "every pipe becomes a dash — that is what g is for"],
  ["{name|s/^.*[|] //}",
   "Gas | Consumption | Daily", "Daily",
   "the last segment on its own"],
  ["{name|s/^(.*) [|] (.*)$/$2 of $1/}",
   "Gas | Consumption | Daily", "Daily of Gas | Consumption",
   "$1 and $2 are whatever the brackets caught"],
];

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

/* What each setting is, in one or two sentences, for the person hovering it.
 *
 * Kept in one place rather than beside each control: they are read together,
 * they have to agree with each other about what things are called, and a
 * label that has drifted from its explanation is worse than no explanation.
 * Every one says what the setting does and what happens when it is left
 * alone, because "what if I do not touch this" is the question a form cannot
 * answer by looking at it. */
const HELP = {
  enabled: "Show this event at all. A disabled event stays in the library and " +
    "is drawn on no card.",
  category: "Which section the row appears in. Sections are named, arranged " +
    "and sorted under Sections.",
  severity: "How loud the row is: the colour of its dot, and where it sorts. " +
    "Alerts come first, and a card can promote them into their own section.",
  group: "Draw one row per room, or one row for the lot, instead of a row for " +
    "every entity. A group that turns out to hold one thing is drawn as that " +
    "thing.\n\n" +
    "A Home Assistant group is different and needs nothing set here: name one " +
    "under What > Entities and it becomes the row, with the members that are " +
    "in the state below it. A tap opens the list and holding the row opens " +
    "the group's own controls, where one switch turns off the lot. A group " +
    "whose members this same event also covers is dropped in favour of them - " +
    "there would be nothing new in the row.\n\n" +
    "Grouping makes three kinds of row, read in three places, so Title, " +
    "Detail, Status, Icon and Time can each be worded three ways: a thing on " +
    "its own, a thing inside an opened group, and the group's own row. Leave " +
    "the middle one empty and it reads the same as on its own.",
  title: "The first line of the row. Left empty, the domain decides - a light " +
    "says its name, an alarm says the panel. {name}, {state} and {attr.x} are " +
    "filled in from the entity.\n\n" +
    "A | inside the braces runs a replace on what was read, written as " +
    "s/pattern/replacement/flags. So to drop the room off the front of a " +
    "name and the machine word off the end:\n\n" +
    "    {name|s/^[^|]+[|] | [|] (State|Error|Status)$//g}\n\n" +
    "{name} is the friendly name exactly as Home Assistant has it, pipes and " +
    "all, which is why the pattern looks for them - a literal pipe is written " +
    "[|]. Add words to the list to strip more; after the last slash, i " +
    "ignores case and g replaces every match instead of only the first.",
  detail: "The quieter line beside the title. Usually the room, which is what " +
    "it says if this is left empty. Same placeholders and the same " +
    "s/pattern/replacement/ filter as Title.\n\n" +
    "A row that groups is the exception: it says the room on its title line " +
    "already, so leaving this empty leaves the line empty rather than saying " +
    "the room twice. Give the group a Title of its own and the room moves " +
    "down here. Anything written here is drawn either way.",
  status: "What the row says on the right: what the entity is doing. Left " +
    "empty, the domain decides. Same placeholders and the same " +
    "s/pattern/replacement/ filter as Title.",
  icon: "The icon at the start of the row. Left empty, the entity's own icon " +
    "is used - and where it has none, the one Home Assistant would have " +
    "drawn for it, from its device class or its integration.",
  time: "Whether the row carries a time, and which way it runs: since and ago " +
    "count up from the last change, until and remaining count down to what is " +
    "next.\n\n" +
    "A grouped row reads its own clock: counting up it runs from the first of " +
    "them, counting down it runs to the last - so it can want a different " +
    "word from the rows inside it. Off is off for the whole event.",
  include: "Which entities this event covers. Every criterion is a way of " +
    "naming some - a domain, a room, a floor, a label, a device, an entity, " +
    "or a pattern.",
  exclude: "Entities to leave out of what Include selected. An event with " +
    "nothing here covers everything Include names.",
  conditions: "And in which state. An event with no conditions shows every " +
    "entity it covers, whatever they are doing.",
  sort: "How the rows inside a section read. Severity always comes first and " +
    "countdowns always run soonest-first; this decides the rest.",
  sections: "The order sections read in, what each is called, and how each " +
    "one sorts its rows.",
  library: "The whole library as YAML - sections, defaults and every event. " +
    "Paste one in to replace it.",
  newevent: "Start an event. It covers nothing until you say what it covers.",
  "tab-what": "Which entities this event is about. Every event needs at " +
    "least one criterion here - it is the only question with no sensible " +
    "default, because only you know what the event is for.",
  "tab-when": "And in which state they have to be. Leave it empty and the " +
    "event shows every entity it covers, whatever they are doing.",
  "tab-how": "How the row reads once it appears: which section, how loud, " +
    "whether it groups, and the words on the line. Everything here has a " +
    "default, so a new event draws something before it is touched.",
  preview: "The row itself, drawn by the card rather than imitated: a " +
    "home-event-card holding nothing but this event. It shows a sample - one " +
    "of the entities this covers, or a few of them for the counting wording " +
    "- whatever state they happen to be in, because how a row reads is a " +
    "different question from which rows there are. That one is on the When " +
    "tab. Section headings are left off: what a card puts around the row is " +
    "the card's half.",
};
const tip = (key) => (HELP[key] ? ` title="${esc(HELP[key])}"` : "");

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
    this._library = { events: {}, categories: [] };
    this._selected = null;
    this._renamedFrom = null;
    this._draft = null;
    this._mode = "visual"; // visual | yaml | library
    this._dirty = false;
    this._built = false;
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
    this._reflectTimer = null;
    /* The card drawing the preview row, kept between redraws so typing in
     * Title updates a row rather than building a card per keystroke. */
    this._preview = null;
    this._cheatOpen = false;
    /* Whether the sample row is one thing or several. Where the person is
     * looking, not what they have written, so it is not saved. */
    this._previewMany = false;
    /* Shown unless it is put away: the whole point of counting is being able
     * to see what was counted. */
    this._showMatches = true;
    this._unsub = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._start();
    else this._laterReflect();
  }

  /* The house moves while the editor is open, and what the counts and the
   * preview are about is the house: a light going on should show up in "3 of
   * 26 are in this state", and in the row underneath it, without anything
   * being clicked. Home Assistant pushes a new hass on every state change,
   * which in this house is several a second, so this recomputes on a trailing
   * second - live enough to watch, cheap enough to ignore. */
  _laterReflect() {
    if (this._reflectTimer) return;
    if (this._mode !== "visual" && this._mode !== "home") return;
    if (!this._el || !this._el.pane) return;
    this._reflectTimer = setTimeout(() => {
      this._reflectTimer = null;
      if (this._mode === "visual") this._reflect();
      /* The overview's card is the house, so it moves with it. Only the card:
       * the tiles count what is written down, which no state change alters,
       * and recomputing every event's matcher once a second to watch four
       * numbers hold still is work nobody asked for. */
      else if (this._mode === "home" && this._home) this._home.hass = this._hass;
    }, 1000);
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
    if (this._reflectTimer) {
      clearTimeout(this._reflectTimer);
      this._reflectTimer = null;
    }
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
    const [, , engine] = await Promise.all([
      this._loadRegistries(),
      loadHaComponents(),
      loadEngine(this._hass),
    ]);
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
      this._library = await this._fresh();
      this._renderList();
      /* Nothing is opened. This used to land on Object.keys()[0] - the first
       * event the store happened to hold, which is not the first one in the
       * list, because the list is grouped by section. So a reload put the
       * cursor in an event nobody had chosen, and the next thing typed was
       * typed into it. An editor with nothing in it is a worse first screen
       * than one showing the wrong thing only if there is nothing to put
       * there, and there is: the library, and the card it draws. */
      this._openHome();
    } catch (err) {
      this._say(this._reason(err), true);
    }
  }

  async _reload() {
    this._library = await this._fresh();
    this._renderList();
    if (this._dirty) this._say("Changed elsewhere. Your edit is still here.");
  }

  /* The library, asked for now rather than remembered: every write sends the
   * whole of it back, and sending a copy that was read minutes ago would undo
   * anything saved in between.
   *
   * `schema_version` comes off - that is the integration talking about
   * itself, and writing it back would be a key the library has never heard
   * of. */
  async _fresh() {
    const out = { ...(await this._ws({ type: "home_events/library" })) };
    delete out.schema_version;
    if (!out.events) out.events = {};
    if (!out.categories) out.categories = [];
    return out;
  }

  _events() {
    return this._library.events || {};
  }

  _categories() {
    const declared = (this._library.categories || []).map((c) => c.id);
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
    const c = (this._library.categories || []).find((x) => x.id === id);
    return (c && c.label) || humanise(id);
  }

  /* ---------------------------------------------------------------- shell */

  _build() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="app">
        <header class="bar">
          <button class="icon" data-act="menu" title="Sidebar">&#9776;</button>
          <button class="title" data-act="home" title="Back to the overview">Events<span
            class="build" title="The build this
            page is running. Home Assistant fetches a panel module once per
            page load, so an edit to the panel is invisible until a full
            reload - Ctrl-Shift-R, or Cmd-Shift-R.">${PANEL_BUILD}</span></button>
          <span class="grow"></span>
          <button class="ghost" data-act="sections" title="${esc(HELP.sections)}">Sections</button>
          <button class="ghost" data-act="library" title="${esc(HELP.library)}">Whole library</button>
        </header>
        <main>
          <aside class="side">
            <div class="sidetop">
              <button class="icon square" data-act="home"
                      title="The overview">&#8962;</button>
              <button class="primary grow" data-act="new"
                      title="${esc(HELP.newevent)}">New event</button>
            </div>
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
      del: $('[data-act="delete"]'), tabs: $(".tabs"),
      save: $('[data-act="save"]'), head: $(".ed-head"),
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
      this._setDirty(true);
    });
    this._built = true;
  }

  _renderList() {
    const events = this._events();
    const names = Object.keys(events);
    if (!names.length) {
      this._el.list.innerHTML =
        `<div class="empty">Nothing here yet.<br><br>` +
        `<b>New event</b> starts one. <b>Whole library</b> takes a whole ` +
        `library pasted in as YAML.</div>`;
      return;
    }
    const order = [];
    const buckets = {};
    for (const name of names) {
      const cat = events[name].category || GENERIC_CATEGORY;
      if (!buckets[cat]) {
        buckets[cat] = [];
        order.push(cat);
      }
      buckets[cat].push(name);
    }
    const declared = (this._library.categories || []).map((c) => c.id);
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
      const head = `<button class="cat" data-act="editcat" data-cat="${esc(cat)}"
          title="Settings for this section">${esc(this._catLabel(cat))}</button>`;
      return head + rows;
    }).join("");
  }

  /* ------------------------------------------------------------ the overview */

  /* Where the page starts, and where Delete and the title button lead back to.
   *
   * It is not a splash screen. It answers the two questions somebody arriving
   * here actually has - what is in this library, and what does it look like on
   * a dashboard right now - using the card itself for the second, the same way
   * the preview does. */
  async _openHome(force) {
    if (!force && !(await this._confirmDiscard())) return;
    this._mode = "home";
    this._selected = null;
    this._renamedFrom = null;
    this._draft = null;
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
    this._setDirty(false);
    this._el.name.value = "";
    this._el.name.disabled = true;
    this._el.head.style.display = "none";
    this._say("");
    this._renderList();
    this._renderPane();
  }

  /* Counts, from the library rather than from the house: how many events there
   * are, how many are switched off, how many sections they sit in, and how
   * much of the house they cover between them. The last one needs the card's
   * matcher; without it the tile is left out rather than guessed at. */
  _libraryFacts() {
    const events = Object.values(this._events());
    const off = events.filter((e) => e.enabled === false).length;
    const facts = [
      [events.length, events.length === 1 ? "event" : "events"],
      [this._categories().length, "sections"],
    ];
    if (off) facts.push([off, "switched off"]);
    if (this._engine && this._hass) {
      const ids = new Set();
      for (const e of events) {
        if (e.enabled === false) continue;
        try {
          for (const id of this._engine.matchEntities(this._hass, {
            include: clone(e.include),
            exclude: e.exclude ? clone(e.exclude) : null,
            registries: { labels: this._reg.labels, floors: this._reg.floors },
          })) ids.add(id);
        } catch (err) {
          /* One unfinished event should not cost the whole tile. */
        }
      }
      facts.push([ids.size, "entities watched"]);
    }
    return facts;
  }

  _homeHtml() {
    const facts = this._libraryFacts();
    const empty = !Object.keys(this._events()).length;
    return `<div class="home">
      <p class="lede">${empty
        ? `This library is empty. An event is a rule for what a card should
           say about part of the house — start with one.`
        : `Nothing is open. Pick an event on the left to change it, or start
           a new one.`}</p>
      <div class="tiles">${facts.map(([n, what]) =>
        `<div class="tile"><b>${n}</b><span>${esc(what)}</span></div>`).join("")}
      </div>
      ${empty ? "" : `
      <h2>What a card is showing right now</h2>
      <div data-homecard></div>
      <p class="hint">A real card, reading this library against the house as it
        is this second — not a mock-up. What a dashboard shows also depends on
        that card's own options, so yours may be capped or sorted differently.</p>`}
      <h2>Where things are</h2>
      <ul class="ways">
        <li><b>The list on the left</b> is every event, under the section it
          files rows into. Click one to edit it.</li>
        <li><b>New event</b> starts an empty one. It is not written down until
          it is saved and named.</li>
        <li><b>Sections</b> is the order the headings come in, what each is
          called, and how the rows inside one are sorted.</li>
        <li><b>Whole library</b> is all of it as YAML — how it leaves this
          machine and how it comes back.</li>
      </ul>
    </div>`;
  }

  /* The card on the overview. Kept between redraws for the same reason the
   * preview is: a card rebuilt on every state change is a card that flickers
   * for a living. */
  _paintHome() {
    const host = this._el.pane.querySelector("[data-homecard]");
    if (!host) return;
    if (!customElements.get("home-event-card")) {
      host.innerHTML = `<div class="hint">The card is not among this
        dashboard's resources, so there is nothing here to draw with.</div>`;
      return;
    }
    let card = this._home;
    if (!card) {
      card = document.createElement("home-event-card");
      try {
        card.setConfig({ ...HOME_CONFIG });
      } catch (err) {
        host.innerHTML = `<div class="hint">${esc(this._reason(err))}</div>`;
        return;
      }
      this._home = card;
    }
    if (card.parentNode !== host) {
      host.innerHTML = "";
      host.appendChild(card);
    }
    /* The saved library, handed over rather than fetched, so this shows what
     * is written down - which is what a dashboard would be reading too. */
    card.library = this._library;
    card.hass = this._hass;
  }

  /* --------------------------------------------------------------- opening */

  async _openEvent(name) {
    if (!(await this._confirmDiscard())) return;
    const event = this._events()[name];
    if (!event) return;
    this._selected = name;
    this._renamedFrom = name;
    this._draft = this._formShape(clone(event) || {});
    this._mode = "visual";
    this._setDirty(false);
    this._sub = "what";
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
    this._el.name.value = name;
    this._el.name.disabled = false;
    this._el.head.style.display = "";
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
    /* Same reasoning as severity: the form has four words for this and no
     * fifth one meaning "whichever the domain picks", so an event that has
     * never said reads Since - which is what all but one domain does anyway.
     * The exception is `timer`, which counts down, and an event covering
     * timers wants Remaining chosen for it. */
    if (!event.time_mode) event.time_mode = DEFAULT_TIME_MODE;
    return event;
  }

  async _newEvent() {
    if (!(await this._confirmDiscard())) return;
    this._selected = null;
    this._renamedFrom = null;
    this._draft = this._formShape(clone(STARTER));
    this._mode = "visual";
    this._setDirty(true);
    this._sub = "what";
    this._editing = null;
    this._newcat = false;
    this._newCategory = null;
    this._el.name.value = "";
    this._el.name.disabled = false;
    this._el.head.style.display = "";
    this._el.del.style.display = "none";
    this._el.tabs.style.display = "";
    this._say("Name it, then save. The name is what a card refers to.");
    this._renderList();
    this._renderPane();
    this._el.name.focus();
  }

  /* The sections, which are the other half of how a card reads: which order
   * they come in, what each is called, and how the rows inside one are
   * ordered. All three are properties of the library rather than of any one
   * event, so they live behind their own button rather than on the form. */
  async _openSections(focus) {
    if (!(await this._confirmDiscard())) return;
    this._mode = "sections";
    /* Which row was asked for, so a heading clicked in the list lands on that
     * section rather than on a page of them. */
    this._focusSection = focus || null;
    this._selected = null;
    this._renamedFrom = null;
    this._draft = null;
    /* Every section that exists: the ones the library arranges, then the ones
     * only an event has heard of, which is exactly the order a card puts them
     * in. Listing them is what makes them arrangeable. */
    const declared = (this._library.categories || []).map((c) => ({
      id: c.id, label: c.label || "", sort: c.sort || "",
    }));
    for (const id of this._categories()) {
      if (!declared.some((c) => c.id === id)) declared.push({ id, label: "", sort: "" });
    }
    /* The section for events that name none. Listed only when something is in
     * it, because an empty one is a heading for nothing - but listed like any
     * other when it is, since it has rows to sort and a heading to name. */
    const homeless = Object.values(this._events())
      .some((e) => !(e.category || "").trim());
    if (homeless && !declared.some((c) => c.id === GENERIC_CATEGORY)) {
      declared.push({ id: GENERIC_CATEGORY, label: "", sort: "" });
    }
    this._sections = declared;
    this._defaultSort = this._library.sort || "";
    this._el.name.value = "Sections";
    this._el.name.disabled = true;
    this._el.head.style.display = "";
    this._el.del.style.display = "none";
    this._el.tabs.style.display = "none";
    this._setDirty(false);
    this._renderPane();
    this._say(focus
      ? `${this._catLabel(focus)}: how it is arranged, and how it sorts its rows.`
      : "The order sections read in, and how each one sorts its rows.");
    this._renderList();
  }

  _sectionsHtml() {
    const rows = this._sections.map((c, i) => {
      const used = Object.values(this._events()).filter((e) =>
        c.id === GENERIC_CATEGORY
          ? !(e.category || "").trim()
          : (e.category || "") === c.id).length;
      const asked = this._focusSection === c.id;
      return `<div class="crit secrow${asked ? " asked" : ""}">
          <input class="secname" data-sec="${i}.label" spellcheck="false"
                 placeholder="Name this section"
                 value="${esc(c.label || humanise(c.id))}">
          <select data-sec="${i}.sort">
            ${SORTS.map((o) => `<option value="${esc(o.key)}"` +
              `${(c.sort || "") === o.key ? " selected" : ""}>` +
              `${esc(o.key ? o.label
                : this._defaultSort ? "Same as above" : "As the card says")}</option>`).join("")}
          </select>
          <span class="dim count-of">${used} ${used === 1 ? "event" : "events"}</span>
          <button class="mv" data-act="secup" data-index="${i}" title="Move up"
                  ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="mv" data-act="secdown" data-index="${i}" title="Move down"
                  ${i === this._sections.length - 1 ? "disabled" : ""}>↓</button>
          <button class="x row-x" data-act="secdel" data-index="${i}"
                  title="Stop arranging this one">×</button>
        </div>`;
    }).join("");
    return `<div class="fs">
        <div class="legend">Sections
          <span class="q">— the order they read in, and how each sorts its rows</span></div>
        <div class="crits wide">
          <div class="secrow head">
            <span class="dim"${tip("sort")}>Rows read, unless a section says otherwise</span>
            <select data-defaultsort>
              ${SORTS.map((o) => `<option value="${esc(o.key)}"` +
                `${this._defaultSort === o.key ? " selected" : ""}>` +
                `${esc(o.key ? o.label : "As the card says")}</option>`).join("")}
            </select>
            <span></span><span></span><span></span><span></span>
          </div>
          ${rows}
          <button class="ghost sm" data-act="secadd">+ Add section</button>
        </div>
        <div class="hint">A section an event names but this list does not is
          drawn after these, sorted the way the card is. Taking one off this
          list does not touch its events - it only stops arranging it.</div>
      </div>`;
  }

  async _saveSections() {
    const library = await this._fresh();
    /* A row that was added and never named has nothing to arrange, and two
       rows that ended up with one id would be one section twice. */
    const seen = new Set();
    if (this._defaultSort) library.sort = this._defaultSort;
    else delete library.sort;
    library.categories = this._sections.filter((c) => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).map((c) => {
      const out = { id: c.id };
      if (c.label && c.label !== humanise(c.id)) out.label = c.label;
      if (c.sort) out.sort = c.sort;
      return out;
    });
    await this._ws({ type: "home_events/save", data: library });
    this._setDirty(false);
    await this._reload();
    this._say("Saved");
  }

  async _openLibrary() {
    if (!(await this._confirmDiscard())) return;
    try {
      const res = await this._ws({ type: "home_events/export" });
      this._mode = "library";
      this._selected = null;
      this._renamedFrom = null;
      this._draft = null;
      this._el.name.value = "Whole library";
      this._el.name.disabled = true;
      this._el.head.style.display = "";
      this._el.del.style.display = "none";
      this._el.tabs.style.display = "none";
      this._setDirty(false);
      this._renderPane(res.yaml);
      this._say("The whole library, categories and all. Paste one in to replace it.");
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
        type: "home_events/export", event: this._selected,
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
    this._pending = [];
    /* Which drawing this is. Controls made here carry the number and refuse to
     * write once it has moved on - see _pickerFor. */
    this._gen = (this._gen || 0) + 1;
    this.shadowRoot.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.act === `tab-${this._mode}`);
    });

    if (this._mode === "home") {
      this._el.pane.innerHTML = this._homeHtml();
      this._paintHome();
      return;
    }
    if (this._mode === "sections") {
      this._el.pane.innerHTML = this._sectionsHtml();
      const asked = this._el.pane.querySelector(".secrow.asked select");
      if (asked) asked.focus();
      return;
    }
    if (this._mode !== "visual") {
      this._el.pane.innerHTML =
        `<textarea class="yaml" spellcheck="false" wrap="off" ` +
        `autocapitalize="off" autocomplete="off">${esc(text || "")}</textarea>`;
      return;
    }
    this._el.pane.innerHTML = this._formHtml();
    this._mountPickers();
    /* Whether the cheat sheet is open is where the person is looking, so it
     * survives a redraw but not the panel being left. */
    const cheat = this._el.pane.querySelector("[data-cheat]");
    if (cheat) cheat.addEventListener("toggle", () => { this._cheatOpen = cheat.open; });
    /* A field that appeared because it was asked for should not also have to
     * be clicked. */
    const newcat = this._el.pane.querySelector(".newcat");
    if (newcat) newcat.focus();
    this._reflect();
  }

  /* Everything on screen that answers "what would this do, right now": the
   * match counts and the preview row. Both are about the house rather than
   * about the form, so they are refreshed together and by the same clock. */
  _reflect() {
    this._recount();
    this._repaintPreview();
  }

  /* The row, drawn by the card.
   *
   * A real <home-event-card>, handed the draft as a library of one event and
   * the live hass. The panel has no renderer of its own and is not getting
   * one: a second one that agreed with the card most of the time would be a
   * preview you could not trust, which is worse than no preview.
   *
   * The element is kept and moved rather than rebuilt, so typing in Title
   * updates a row instead of replacing a card eight times a second. */
  _repaintPreview() {
    const host = this._el.pane.querySelector("[data-preview]");
    if (!host) return;
    if (!customElements.get("home-event-card")) {
      host.innerHTML = `<div class="hint">The card is not among this
        dashboard's resources, so there is nothing here to draw the row
        with.</div>`;
      return;
    }
    const draft = clone(this._draft) || {};
    if (!draft.include || !Object.keys(draft.include).some(
      (k) => k !== "match" && (draft.include[k] || []).length)) {
      if (this._preview) this._preview.remove();
      host.innerHTML = `<div class="hint">Nothing to draw yet — say what this
        event covers on the What tab.</div>`;
      return;
    }
    /* A sample, not the result.
     *
     * Drawing what the event actually shows put anything from nothing to
     * fifty rows here, and neither teaches anything about wording: an empty
     * box because the house happens to be quiet reads as a broken preview,
     * and fifty rows is a list nobody is reading. So the preview is one
     * specimen of what this event covers - or a handful, when the question is
     * how it reads while counting - and the conditions are set aside, because
     * "which of these are on" is the tab next door's question and it answers
     * it against the real house.
     *
     * The specimens are real entities with their real names, states and
     * attributes. Nothing here is invented: a made-up light would be drawn by
     * the same renderer as a real one right up to the point where it was not. */
    const sample = this._sampleIds(draft);
    if (!sample.ids.length) {
      if (this._preview) this._preview.remove();
      host.innerHTML = `<div class="hint">The criteria on the What tab select
        nothing right now, so there is no entity to draw a row from.</div>`;
      return;
    }
    draft.include = { entities: sample.ids };
    delete draft.exclude;
    delete draft.conditions;
    let card = this._preview;
    if (!card) {
      card = document.createElement("home-event-card");
      try {
        card.setConfig({ ...PREVIEW_CONFIG });
      } catch (err) {
        host.innerHTML = `<div class="hint">${esc(this._reason(err))}</div>`;
        return;
      }
      this._preview = card;
    }
    if (card.parentNode !== host) {
      host.innerHTML = "";
      host.appendChild(card);
    }
    /* Switched off is a fact about where the row is drawn, not about how it
     * reads, so the preview draws it anyway and says so. */
    const off = draft.enabled === false;
    delete draft.enabled;
    /* No section: with no headings on the preview a category would only
     * decide which of two identical surfaces the row landed on. */
    delete draft.category;
    const name = (this._el.name.value || "").trim() || "preview";
    card.library = {
      categories: [],
      non_areas: this._library.non_areas,
      events: { [name]: draft },
    };
    card.hass = this._hass;
    /* Opened, when there is something to open. Two of the three wordings live
     * inside a group - the row that counts, and the rows it counts - and one
     * of them cannot be checked against a chevron. The card is asked the way
     * a person would ask, with a click, so what appears is what a click
     * produces rather than what this file thinks a click produces. */
    if (this._previewMany) this._openPreviewGroup(card);
    host.querySelectorAll(".prevnote").forEach((n) => n.remove());
    /* Only when something is wrong. A line under every preview saying which
     * entity it sampled was a sentence to read past on the way to the row it
     * was about - the row is the answer, and the One/Many buttons above it
     * already say what kind of answer it is. */
    const say = card.libraryError
      ? `Not drawable yet: ${card.libraryError}`
      : off
        ? "Switched off, so no card draws it. This is how it would read."
        : "";
    if (say) {
      host.insertAdjacentHTML("beforeend",
        `<div class="hint prevnote">${esc(say)}</div>`);
    }
  }

  /* Click the group open, if it is drawn shut. The card keeps which rows are
   * open across a repaint, so this is a one-off per preview rather than
   * something to redo on every keystroke. */
  _openPreviewGroup(card) {
    const root = card.shadowRoot;
    if (!root) return;
    const row = root.querySelector(".ev[data-group]");
    if (!row) return;                        // nothing grouped here
    if (row.getAttribute("aria-expanded") === "true") return;
    row.dispatchEvent(new CustomEvent("click", { bubbles: true, composed: true }));
  }

  /* Which entities the sample is drawn from.
   *
   * One is one: the first thing the criteria select, so the row reads the way
   * a single thing reads. Many wants several that would land in the *same*
   * row, which for an event grouping by room means several in one room -
   * otherwise "many" would be several rows rather than one row counting, and
   * the wording being previewed is the counting one.
   *
   * Only entities the card would actually draw are candidates. The two lists
   * differ: `domains: [light]` selects a light group and its members alike,
   * and the card draws the members only, so sampling from the filter's answer
   * picked a group helper and previewed an empty card. The card exports the
   * rule rather than this file restating it.
   *
   * Ordered by entity id rather than by whatever the registry hands back, so
   * the sample does not change under the person editing it. */
  _sampleIds(draft) {
    let ids = [];
    try {
      ids = this._engine
        ? this._engine.matchEntities(this._hass, {
            include: clone(draft.include),
            exclude: draft.exclude ? clone(draft.exclude) : null,
            registries: { labels: this._reg.labels, floors: this._reg.floors },
          })
        : [];
      if (this._engine && this._engine.drawableEntities) {
        /* A group this event draws as a group is not what drawableEntities is
         * about: that predicate answers for groups whose members the same
         * event covers, which the card draws instead of them. Both questions
         * are the card's own, so both are asked of it. */
        const drawn = new Set(this._engine.drawableEntities(this._hass, ids));
        const groups = new Set(this._engine.groupRowEntities
          ? this._engine.groupRowEntities(this._hass, ids, (draft.include || {}).entities)
          : []);
        ids = ids.filter((id) => drawn.has(id) || groups.has(id));
      }
    } catch (err) {
      return { ids: [] };
    }
    ids = ids.slice().sort();
    if (!ids.length) return { ids: [] };
    if (!this._previewMany) return { ids: [ids[0]] };
    if (this._groupOf(draft) === "area") {
      /* The whole of one room, not a handful of it: the card is going to fold
       * these into a single row and put a number on it, and a number that is
       * three when the room holds seven is a preview that lies about the row
       * it is previewing. The biggest room wins, so there is a count at all. */
      const byArea = new Map();
      for (const id of ids) {
        const key = this._areaNameOf(id, (this._hass.entities || {})[id] || {}) || "";
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key).push(id);
      }
      return { ids: [...byArea.values()].sort((a, b) => b.length - a.length)[0] };
    }
    if (this._groupOf(draft) === "all") return { ids };
    return { ids: ids.slice(0, PREVIEW_MANY) };
  }

  _formHtml() {
    const d = this._draft || {};
    const grouped = d.group === true || d.group === "area" || d.group === "all";
    const cats = this._categories().filter((c) => c !== GENERIC_CATEGORY);
    const sub = this._sub || "what";
    /* What each one has in it, on the tab itself.
     *
     * Three pills read as three buttons that do three unrelated things; a tab
     * strip reads as one form with three pages, which is what this is - an
     * event is not finished until all three have been looked at. The note is
     * the other half of saying so: a tab that says "2 criteria" has been
     * answered, and one that says "needs one" is the reason Save will refuse.
     *
     * When has no note when it is empty, because empty is a real answer
     * there - "whatever state they are in" - where an empty What is not. */
    const nCrit = this._critList(d.include || {}).length;
    const nCond = (d.conditions || []).length;
    const NOTES = {
      what: nCrit
        ? [`${nCrit} criteri${nCrit === 1 ? "on" : "a"}`, ""]
        : ["needs one", " want"],
      when: nCond ? [`${nCond} condition${nCond === 1 ? "" : "s"}`, ""] : ["", ""],
      how: ["", ""],
    };
    const tab = (id, label) => {
      const [note, cls] = NOTES[id];
      return `<button data-act="sub-${id}" class="subtab${sub === id ? " on" : ""}"` +
        `${tip(`tab-${id}`)}><span class="subname">${esc(label)}</span>` +
        (note ? `<span class="subnote${cls}">${esc(note)}</span>` : "") +
        `</button>`;
    };
    const tabs = `<div class="subtabs">${tab("what", "What")}` +
      `${tab("when", "When")}${tab("how", "How")}</div>`;

    if (sub === "when") {
      return tabs + `<div class="fs">
         <div class="legend"${tip("conditions")}>When
           <span class="q">— and in which state?</span></div>
         ${this._conditionsHtml(d.conditions)}
         <div class="count" data-count></div>
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

         <div class="field"><div class="label"${tip("enabled")}>Enabled</div><div>
           <label class="check"><input type="checkbox" data-set="enabled"
             ${d.enabled === false ? "" : "checked"}> Show this event</label>
         </div></div>

         <div class="field"><div class="label"${tip("category")}>Section</div><div>
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

         <div class="field"><div class="label"${tip("severity")}>Severity</div>
           <div class="sev">${SEVERITIES.map((s) =>
             `<button class="chipbtn sev-${esc(s.key)}` +
             `${(d.severity || DEFAULT_SEVERITY) === s.key ? " on" : ""}" ` +
             `data-set="severity" data-value="${esc(s.key)}">` +
             `<span class="dot sev-${esc(s.key)}"></span>${esc(s.label)}</button>`).join("")}
           </div>
         </div>

         <div class="field"><div class="label"${tip("group")}>Group</div>
           <div class="seg">${GROUPS.map((g) =>
             `<button data-set="group" data-value="${esc(g.key || "")}"` +
             `${this._groupOf(d) === g.key ? ' class="on"' : ""}>${esc(g.label)}</button>`).join("")}
           </div>
         </div>

         ${TEXT_SLOTS.map((slot) => this._slotHtml(slot, d, grouped)).join("")}

         ${this._timeHtml(d, grouped)}

         <div class="field chiprow"><div class="label"${tip("preview")}>Reads as</div><div>
           <div class="seg small previewseg">
             <button data-act="prevone"${this._previewMany ? "" : ' class="on"'}
                     title="How the row reads for a single thing, on its own">One</button>
             <button data-act="prevmany"${this._previewMany ? ' class="on"' : ""}
                     title="The group's own row, drawn open, so the rows inside
it are underneath it">Grouped</button>
           </div>
           <div class="previewbox"><div data-preview></div></div>
         </div></div>
       </div>
       ${this._examplesHtml()}`
    );
  }

  /* The syntax, at the bottom of the tab whose fields use it.
   *
   * Shut by default and remembered while the panel is open: it is a thing to
   * consult, not a thing to read every time, and somebody who has opened it
   * once is probably writing several templates in a row. */
  _examplesHtml() {
    const row = (cells) => `<div class="exrow">${cells}</div>`;
    return `<details class="cheat"${this._cheatOpen ? " open" : ""} data-cheat>
        <summary>(?) What you can write in Title, Detail, Status and Icon</summary>
        <div class="cheatbody">
          <div class="exhead">Placeholders <span class="dim">— reading
            ${esc(EXAMPLE_ENTITY)}</span></div>
          ${PLACEHOLDERS.map(([tpl, out, what]) => row(
            `<code>${esc(tpl)}</code>` +
            `<span class="exout">${esc(out)}</span>` +
            `<span class="dim">${esc(what)}</span>`)).join("")}

          <div class="exhead">Replacing <span class="dim">— a | inside the
            braces runs s/pattern/replacement/flags on what was read</span></div>
          ${FILTER_EXAMPLES.map(([tpl, from, to, what]) =>
            `<div class="exblock"><code>${esc(tpl)}</code>` +
            `<div class="exwas">${esc(from)} <span class="dim">→</span> ` +
            `<span class="exout">${esc(to)}</span></div>` +
            `<div class="dim">${esc(what)}</div></div>`).join("")}

          <div class="hint"><b>A literal pipe is <code>[|]</code></b> — not
            <code>\\|</code>. A bare <code>|</code> means alternation, and an
            escaped one turns into <code>\\\\|</code> the moment anything
            escapes it twice, which reads as "a backslash, or nothing" and
            silently eats the next character. In brackets it can only be a
            pipe.<br>
            Only the first | separates the name from the pattern, so a pattern
            may still have alternation in it: <code>s/a|b//</code> is one
            replacement, not two. After the last slash, <b>i</b> ignores case
            and <b>g</b> replaces every match instead of the first. There is no
            case conversion — <code>\\U</code> is just two characters.<br>
            <b>{name}</b> is the friendly name exactly as Home Assistant has
            it, pipes and all, which is why these patterns look for them. A
            pattern that will not compile leaves the text alone and says so in
            the browser console.</div>
        </div>
      </details>`;
  }

  /* Time, which is a slot like the wordings are: a group of timers counting
   * down to whichever ends last can want saying differently from the timers
   * inside it - "14m remaining" over "Running since 12:40". Off is off for
   * the whole event, so the checkbox stays single. */
  _timeHtml(d, grouped) {
    const value = d.time_mode;
    const pair = value && typeof value === "object";
    const shown = d.show_time !== false;
    const pick = (path, current) =>
      `<select data-set="${path}"${shown ? "" : " disabled"}>` +
      /* An empty option only where there is something for empty to mean: in a
         mapping, a half nobody filled in is "the same as the others". */
      (path === "time_mode" ? "" :
        `<option value=""${current ? "" : " selected"}>—</option>`) +
      TIME_MODES.map((m) => `<option value="${m}"` +
        `${(current || (path === "time_mode" ? DEFAULT_TIME_MODE : "")) === m
          ? " selected" : ""}>${humanise(m)}</option>`).join("") +
      `</select>`;
    const body = pair
      ? `<div class="pair">${WORDINGS.map(([k, label, why]) =>
          `<label title="${esc(why)}"><span>${esc(label)}</span>` +
          `${pick(`time_mode.${k}`, value[k])}</label>`).join("")}</div>`
      : pick("time_mode", value);
    const toggle = grouped
      ? `<button class="link" data-act="plural" data-value="time_mode">` +
        (pair ? "Use one wording everywhere" : "Word it differently for a group") +
        `</button>`
      : "";
    return `<div class="field"><div class="label"${tip("time")}>Time</div>
      <div class="${pair ? "" : "inline"}">
        <label class="check"><input type="checkbox" data-set="show_time"
          ${shown ? "checked" : ""}> Show</label>
        ${body}${toggle}
      </div></div>`;
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
    const field = (path, current, hint) => {
      if (!icons) {
        return `<input data-set="${path}" value="${esc(typeof current === "string" ? current : "")}"
                  placeholder="${esc(hint || slot.hint)}" spellcheck="false">`;
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
    /* Grouping makes three kinds of row and they are read in three places, so
       these slots may be worded three ways. The button says what pressing it
       does; the labels say where each wording lands. */
    /* The middle box says what leaving it empty will do, rather than repeating
       the hint from the box above it: it falls back to `one`, and the only
       place that is written down is here. */
    const body = pair
      ? `<div class="pair">${WORDINGS.map(([k, label, why]) =>
           `<label title="${esc(why)}"><span>${esc(label)}</span>` +
           `${field(`${slot.key}.${k}`, value[k],
             k === "each" && value.one ? "Same as on its own" : "")}</label>`)
           .join("")}</div>`
      : field(slot.key, value);
    const toggle = plural && grouped
      ? `<button class="link" data-act="plural" data-value="${slot.key}">` +
        (pair
          ? "Use one wording everywhere"
          : "Word it differently for a group") + `</button>`
      : "";
    return `<div class="field"><div class="label"${tip(slot.key)}>` +
      `${esc(slot.label)}</div>` +
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
      .map((c, i) => this._condHtml(c, path === "" ? String(i) : `${path}.${i}`,
        { first: i === 0, last: i === list.length - 1, alone: list.length < 2 }))
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

  _condHtml(c, path, where) {
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

    /* The arrows and the cross, kept together at the right-hand end of the
     * row. Conditions are read down the page in the order they are written -
     * and inside a group that order is the argument itself - so being able to
     * move one is the same need the filter above has. A row on its own has
     * nowhere to go, so it gets no arrows. */
    const move = where && !where.alone
      ? `<button class="mv" data-act="condup" data-path="${path}" title="Move up"
                 ${where.first ? "disabled" : ""}>↑</button>
         <button class="mv" data-act="conddown" data-path="${path}" title="Move down"
                 ${where.last ? "disabled" : ""}>↓</button>`
      : "";
    const acts = `<span class="acts">${move}` +
      `<button class="x row-x" data-act="delcond" data-path="${path}" ` +
      `title="Remove this condition">×</button></span>`;

    /* A group is a row that holds rows. The word on it says how what is inside
     * adds up, and what is inside is drawn by the same code as everything
     * else, one level in. */
    if (GROUP_KINDS.indexOf(kind) !== -1) {
      return `<div class="group">
          <div class="cond ghead"><span class="fields">
            ${pick("condition", kind, kinds)}
            <span class="lbl">${kind === "not"
              ? "of these may be true" : "of these"}</span>
          </span>${acts}</div>
          <div class="subconds">${this._conditionsHtml(c.conditions, path)}</div>
        </div>`;
    }

    /* The fields wrap; the arrows and the cross do not. A numeric-state
     * condition is five controls wide and will not fit a narrow panel on one
     * line, and arrows that went over the fold with them would be a reorder
     * control that moves about. */
    return `<div class="cond"><span class="fields">` +
      pick("condition", kind, kinds) + body +
      (kind === "state" || kind === "numeric_state"
        ? `<span class="lbl">for</span>` + text("for", durationText(c.for), "0:05:00", "num")
        : "") +
      `</span>` + acts + `</div>`;
  }

  /* Moving a condition, among the ones it sits with.
   *
   * Only among its siblings: an arrow that lifted a row out of an "any of"
   * group would change what the event means, and nothing about an arrow says
   * it might. Crossing a group boundary is a delete and an add. */
  _moveCond(path, delta) {
    const parts = String(path).split(".");
    const index = Number(parts.pop());
    const list = this._condListAt(parts.join("."));
    if (!list) return;
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(index, 1)[0]);
    this._setDirty(true);
    this._renderPane();
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

    return `<div class="field"><div class="label strong"${tip(side)}>` +
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

  /* The count box is redrawn whenever the house moves, which here is several
   * times a second, and the list inside it is 260px of scroll. Rewriting
   * identical markup threw away where somebody had scrolled to about once a
   * second - so the list was unreadable exactly while it was being read.
   *
   * Nothing is written unless something changed, and when something has, the
   * offset is put back. Same rule the card follows for a scrolled section, and
   * the same reason: a position somebody chose is not the card's to reset.
   *
   * The last markup is kept on the element rather than on the panel, because
   * a redraw of the pane makes a new box and a stale string would match it. */
  _setCount(box, html) {
    if (box._html === html) return;
    const was = box.querySelector(".matches");
    const y = was ? was.scrollTop : 0;
    box._html = html;
    box.innerHTML = html;
    const now = box.querySelector(".matches");
    if (now && y) now.scrollTop = y;
  }

  _recount() {
    const box = this._el.pane.querySelector("[data-count]");
    if (!box) return;
    const include = this._draft && this._draft.include;
    const anything = include && Object.keys(include).some(
      (k) => k !== "match" && (include[k] || []).length
    );
    if (!this._engine || !anything) {
      this._setCount(box, anything || this._sub !== "when" ? "" :
        `<span class="dim">Nothing to check yet — say what this event covers
          on the What tab.</span>`);
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
      this._setCount(box, `<span class="dim">${esc(this._reason(err))}</span>`);
      return;
    }
    this._setCount(box, this._sub === "when"
      ? this._passingHtml(ids)
      : this._matchCountHtml(ids));
  }

  _matchCountHtml(ids) {
    const n = ids.length;
    return `<span class="ok">Matches ${n} ${n === 1 ? "entity" : "entities"}</span>` +
      (n ? `<button class="link" data-act="showmatches">${
        this._showMatches ? "hide" : "show them"}</button>` : "") +
      this._groupNoteHtml(ids) +
      (this._showMatches ? this._matchesHtml(ids) : "");
  }

  /* Groups are the one place where what a filter selects and what the card
   * draws come apart, so the count says so rather than leaving somebody to
   * find out from an empty card. A group is a row with its members inside,
   * unless this same event covers those members - then they are the rows and
   * it steps aside.
   *
   * The card answers both halves; the panel only asks. */
  _groupNoteHtml(ids) {
    if (!this._engine || !this._engine.groupRowEntities || !ids.length) return "";
    const states = (this._hass || {}).states || {};
    const rows = this._engine.groupRowEntities(
      this._hass, ids, ((this._draft || {}).include || {}).entities);
    const aside = ids.filter((id) =>
      Array.isArray(((states[id] || {}).attributes || {}).entity_id) &&
      rows.indexOf(id) === -1);
    if (!rows.length && !aside.length) return "";
    const say = [];
    if (rows.length) {
      say.push(`${rows.length} ${rows.length === 1 ? "is a group" : "are groups"}` +
        ", drawn as one row each with the members that are in this state inside it");
    }
    if (aside.length) {
      say.push(`${aside.length} ${aside.length === 1 ? "is a group" : "are groups"}` +
        " whose contents this event covers as well, so what is inside them is" +
        " drawn instead");
    }
    return `<div class="dim">${esc(say.join("; "))}.</div>`;
  }

  /* The same view, asked of the conditions: of the entities this event covers,
   * which are in the state it is about - right now, as the card would decide
   * it. The card's own evaluator answers, so writing a condition here and
   * watching a room appear is the same thing the dashboard will do with it.
   *
   * It is a snapshot with a clock in it: `for: 5 minutes` is false until it is
   * true, and this recomputes as the house moves. */
  _passingHtml(ids) {
    const conditions = (this._draft || {}).conditions;
    const total = ids.length;
    if (!conditions || !conditions.length) {
      return `<span class="ok">No conditions, so all ${total} of them show` +
        ` whatever state they are in</span>`;
    }
    if (!this._engine.passingEntities) {
      /* An older card is still the card the dashboard draws with, and it is
       * the one this borrows from. Saying so beats a blank space. */
      return `<span class="dim">The card on this dashboard is too old to
        answer this. Reload it, or check the resource version.</span>`;
    }
    let passing;
    try {
      passing = this._engine.passingEntities(this._hass, ids, clone(conditions));
    } catch (err) {
      return `<span class="dim">${esc(this._reason(err))}</span>`;
    }
    const n = passing.length;
    const head = n
      ? `<span class="ok">${n} of ${total} ${n === 1 ? "is" : "are"} in this
          state right now</span>`
      : `<span class="dim">None of the ${total} are in this state right now
          — nothing would show.</span>`;
    return head +
      (n ? `<button class="link" data-act="showmatches">${
        this._showMatches ? "hide" : "show them"}</button>` : "") +
      (n && this._showMatches ? this._matchesHtml(passing) : "");
  }

  /* Every entity, by room: what it is called, what to call it in a condition,
   * and the state it is in - in that order, on one line, reading from the
   * left. Three columns pushed apart across a wide panel made the state a
   * thing to go and find; a sentence does not.
   *
   * The state is the raw one, not the humanised one: it is there to be typed
   * into a condition on the tab next door, and a condition matches `heat`,
   * never `Heat`. It is the difference between writing a condition and
   * guessing at one. */
  _matchesHtml(ids) {
    const byArea = new Map();
    for (const id of ids) {
      const st = this._hass.states[id] || {};
      const entity = (this._hass.entities || {})[id] || {};
      const area = this._areaNameOf(id, entity) || "Elsewhere";
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push([id, (st.attributes || {}).friendly_name || id, st.state]);
    }
    const rooms = [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return `<div class="matches">` + rooms.map(([area, rows]) =>
      `<div class="mroom">${esc(area)} <span class="dim">(${rows.length})</span></div>` +
      rows.slice(0, 40).map(([id, name, state]) =>
        `<div class="mrow"><span class="mname">${esc(name)}</span>` +
        `<code class="mid">(${esc(id)})</code>` +
        `<span class="msep">-</span>` +
        `<code class="mstate" title="The state right now, as a condition would ` +
        `have to spell it">${esc(state == null ? "?" : state)}</code></div>`).join("") +
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
      case "home": return this._openHome();
      case "new": return this._newEvent();
      case "library": return this._openLibrary();
      case "sections": return this._openSections();
      case "editcat": return this._openSections(el.dataset.cat);
      case "tab-visual": return this._toVisual();
      case "tab-yaml": return this._openYaml();
      case "critup":
      case "critdown":
        return this._moveCrit(el.dataset.side, el.dataset.dim,
          Number(el.dataset.index), el.dataset.act === "critup" ? -1 : 1);
      case "condup":
      case "conddown":
        return this._moveCond(el.dataset.path,
          el.dataset.act === "condup" ? -1 : 1);
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
        /* Collapsing keeps the first wording that says anything rather than
         * the first slot: someone who wrote only the group's wording and then
         * changed their mind should not be handed an empty box.
         *
         * And three empty boxes collapse to no key at all, not to "". Every
         * other field here deletes rather than writing an empty string - this
         * one did not, and an event came back from it carrying `status: ""`,
         * which is a written instruction to draw nothing where there had been
         * nothing written at all. */
        if (v && typeof v === "object") {
          const kept = v.one || v.each || v.many || "";
          if (kept) this._draft[key] = kept; else delete this._draft[key];
        } else {
          this._draft[key] = { one: typeof v === "string" ? v : "", each: "", many: "" };
        }
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
      case "secup":
      case "secdown": {
        const at = Number(el.dataset.index);
        const to = at + (el.dataset.act === "secup" ? -1 : 1);
        if (to < 0 || to >= this._sections.length) return;
        this._sections.splice(to, 0, this._sections.splice(at, 1)[0]);
        this._setDirty(true);
        return this._renderPane();
      }
      case "secdel":
        this._sections.splice(Number(el.dataset.index), 1);
        this._setDirty(true);
        return this._renderPane();
      case "secadd":
        this._sections.push({ id: "", label: "", sort: "" });
        this._setDirty(true);
        this._renderPane();
        return this._el.pane.querySelector(".secrow:last-of-type .secname").focus();
      case "prevone":
      case "prevmany":
        this._previewMany = el.dataset.act === "prevmany";
        return this._renderPane();
      case "showmatches":
        this._showMatches = !this._showMatches;
        return this._recount();  // the list, not the row: the preview is unchanged
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
    if (el && el.dataset && el.dataset.defaultsort !== undefined) {
      this._defaultSort = el.value;
      this._setDirty(true);
      /* The sections below read "same as above" or "as the card says"
       * depending on this, so they are redrawn with it. */
      return this._renderPane();
    }
    if (el && el.dataset && el.dataset.sec) {
      const [index, field] = el.dataset.sec.split(".");
      const row = this._sections[Number(index)];
      if (!row) return;
      row[field] = el.value;
      /* A section added here has no id until it has a name, and the name is
       * where the id comes from - the same rule as naming one from the form,
       * so the two cannot disagree about what "TV alerts" is called. */
      if (field === "label" && !row.id && e.type === "change" && el.value.trim()) {
        row.id = el.value.trim().toLowerCase().replace(/\s+/g, "_");
        this._setDirty(true);
        return this._renderPane();
      }
      this._setDirty(true);
      return;
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
      else this._reflect();
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
      /* Generic is the absence of a section, not a section called "". An
       * empty string here reached the store and read as an event filed under
       * nothing, which is what it is - so it is written that way. */
      if (value) d.category = value; else delete d.category;
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

    /* Every field is worth reflecting, not only the ones the counts are
     * about: a wording typed into Title changes the row below it. Both halves
     * of _reflect leave immediately when the thing they draw into is not on
     * this tab, so asking always is cheaper than working out who to ask. */
    if (structural) this._renderPane();
    else this._reflect();
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

  /* Put a newly named section in the library, keeping the spelling. */
  async _writeCategory() {
    const pending = this._newCategory;
    if (!pending) return;
    const library = await this._fresh();
    const cats = library.categories || (library.categories = []);
    if (!cats.some((c) => c.id === pending.id)) {
      cats.push({ id: pending.id, label: pending.label });
      await this._ws({ type: "home_events/save", data: library });
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
      if (this._mode === "sections") return await this._saveSections();
      if (this._mode === "library") {
        const text = this._el.pane.querySelector(".yaml").value;
        await this._ws({ type: "home_events/import", yaml: text });
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
        type: "home_events/save_event", name, yaml: text,
      };
      if (this._renamedFrom && this._renamedFrom !== name) msg.rename_from = this._renamedFrom;
      /* A section named while writing this event exists once the event does,
       * and not before. It goes first: an event landing in a section the
       * library has never heard of would read by its id until the next write. */
      await this._writeCategory();
      await this._ws(msg);
      this._selected = name;
      this._renamedFrom = name;
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
        type: "home_events/delete_event", name: this._selected,
      });
      this._setDirty(false);
      await this._reload();
      /* Not into whichever event is now first. Something was just deleted;
       * landing in a neighbour is how the next keystroke edits it. */
      await this._openHome(true);
      this._say("Deleted");
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
/* A button now, because it goes back to the overview - and one that has to
   keep looking like the title it already was, since a title that suddenly
   reads as a control is a control nobody trusts. The hover is the only tell,
   which is the amount of tell a way back needs. */
button.title {
  font: inherit; font-size: 20px; display: flex; align-items: baseline; gap: 9px;
  background: none; border: 0; padding: 4px 8px; margin-inline-start: -8px;
  border-radius: 9px; color: inherit; cursor: pointer;
}
button.title:hover { background: rgba(255,255,255,.14); }
button.title:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
/* Readable without hovering, and quiet enough not to be part of the title.
   A panel that has been updated and not reloaded looks exactly like a panel
   that is broken, and that has now cost two rounds of "it does not do that" -
   so which build is on screen is a thing to glance at, not to go and find. */
.title .build {
  font-size: 11px; font-weight: 400; opacity: .5; letter-spacing: .04em;
  font-family: var(--ha-font-family-code, monospace);
}
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
/* The way back, beside the way forward. Square and quiet: it is the same
   destination as the title in the toolbar, and two loud buttons side by side
   would make a choice out of what is really one button and one exit. */
.sidetop { display: flex; gap: 8px; align-items: stretch; }
.sidetop .grow { flex: 1; }
.icon.square {
  width: 38px; padding: 0; font-size: 19px; line-height: 1; flex: none;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-radius: 10px; color: var(--secondary-text-color);
}
.icon.square:hover { background: rgba(127,127,127,.12); color: var(--primary-text-color); }
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

/* The overview. One column, no surfaces of its own: the editor it sits in is
   already a card, and a card inside a card is a border for the sake of one. */
.home { display: flex; flex-direction: column; gap: 18px; padding: 4px 2px 24px; }
.home .lede { margin: 0; font-size: 15px; line-height: 1.5; max-width: 62ch; }
.home h2 {
  margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: var(--secondary-text-color);
}
/* Counted things, so the digits line up and the words underneath do not
   compete with them. */
.tiles { display: flex; flex-wrap: wrap; gap: 10px; }
.tile {
  display: flex; flex-direction: column; gap: 2px; min-width: 104px;
  padding: 10px 14px; border-radius: 12px;
  background: rgba(127,127,127,.10);
}
.tile b { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; }
.tile span { font-size: 11px; color: var(--secondary-text-color); }
.home .ways { margin: 0; padding-inline-start: 18px; display: flex;
  flex-direction: column; gap: 7px; font-size: 13px; line-height: 1.5;
  color: var(--secondary-text-color); max-width: 70ch; }
.home .ways b { color: var(--primary-text-color); font-weight: 500; }
/* The card draws on the dashboard's background, not on the editor's. */
.home [data-homecard] {
  background: var(--primary-background-color);
  border-radius: 14px; padding: 12px; max-width: 560px;
}

.cat { display: block; width: 100%; text-align: start; font: inherit;
  font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color); padding: 14px 10px 6px;
  background: none; border: 0; border-radius: 8px; }
button.cat { cursor: pointer; }
button.cat:hover { color: var(--primary-text-color); background: rgba(127,127,127,.10); }
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
/* Separators, and only separators.
   A rule between two parts of a form is there to say where one ends, and it
   does that at half the weight the theme's divider paints at - on this theme
   a full divider measures 13 luma over the pane and this measures 6, which is
   still a line and no longer a fence. Stated as a mix of the theme's own
   colour so it follows the theme, and stated twice so a browser that does not
   know color-mix keeps the plain one.
   Control borders are not in here: an input whose edge has faded is an input
   nobody can find. */
.fs { border-top: 1px solid var(--divider-color, rgba(127,127,127,.18)); padding: 16px 0 10px; }
.fs { border-top-color: color-mix(in srgb,
  var(--divider-color, rgba(127,127,127,.18)) 55%, transparent); }
.fs:first-child { border-top: 0; padding-top: 2px; }
.legend { font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--secondary-text-color); margin-bottom: 14px;
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.legend .q { font-size: 12px; letter-spacing: 0; text-transform: none; font-style: italic; }

/* Labels line up with the words beside them, not with the boxes those words
   are in.
   The label used to sit 8px down, which centres it against a 32px input -
   which is what most of these fields hold. It is wrong by however much any
   other control differs: 4px against the severity chips, 5px against a select
   or a checkbox, and 5px against the preview's 22px One/Many chip, where it
   is most visible because the chip is small and filled. Aligning on the
   baseline asks the question the eye is actually asking. */
.field { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px;
  align-items: baseline; margin-bottom: 10px; }
.label { font-size: 13px; color: var(--secondary-text-color); }
.label.strong { color: var(--primary-text-color); font-weight: 500; }
.field > div > input, .field > div > select { width: 100%; box-sizing: border-box; }
.field .inline { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.field .inline > .hint { padding-top: 0; }
/* Two halves of one answer - whether to show a time, and which time - so they
   sit on one line. The rule above gives everything in a field the full width,
   which put them on two. */
.field .inline > select, .field .inline > input { width: auto; }
.field .inline > select { min-width: 150px; }
.newcat { margin-top: 6px; }


/* Three questions, one at a time, and they stay where they are: the pane
   scrolls under them, so which question you are answering is never something
   you have to scroll back up to check. */
/* A tab strip, not three pills.
   Three separated pills read as three buttons doing three unrelated things.
   Tabs sharing one rule read as one form with three pages, which is what this
   is: an event is not finished until all three have been looked at. The rule
   runs the full width and the active tab sits on it, breaking it - that
   join is what says the pane below belongs to this tab. */
.subtabs {
  display: flex; gap: 2px; padding: 2px 0 0; margin-bottom: 14px;
  position: sticky; top: 0; z-index: 6;
  background: var(--card-background-color, #fff);
  /* Lighter than a plain divider: the rule is here to say where the pane
     starts, and the open tab's accent is doing the pointing. Mixed from the
     theme's own divider rather than picked, so it still follows the theme -
     and stated twice, because a browser that does not know color-mix drops
     the second line and keeps the first. */
  border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.3));
  border-bottom-color: color-mix(in srgb,
    var(--divider-color, rgba(127,127,127,.3)) 55%, transparent);
}
/* An inactive tab is a label with nothing around it; the open one is a shape.
   It takes the pane's own background and a border on three sides, and its
   bottom edge - painted after the strip's rule, because a child paints over
   its parent - covers the rule for exactly its own width. That break is the
   whole illusion: the tab and the pane below it are one surface, and the two
   beside it are not. The accent caps the top rather than underlining the
   bottom, because the bottom is where the tab joins the pane and a line there
   would be the seam it is trying not to have. */
.subtab {
  display: flex; align-items: baseline; gap: 7px;
  padding: 9px 15px 9px; font-size: 14px;
  border-radius: 9px 9px 0 0;
  color: var(--secondary-text-color);
  border: 1px solid transparent; border-bottom: 0;
  margin-bottom: -1px; /* over the rule, so the open tab can break it */
}
.subtab:hover:not(.on) {
  color: var(--primary-text-color);
  background: var(--secondary-background-color, rgba(127,127,127,.08));
}
.subtab.on {
  color: var(--primary-text-color);
  font-weight: 500;
  background: var(--card-background-color, #fff);
  border-color: var(--divider-color, rgba(127,127,127,.3));
  border-color: color-mix(in srgb,
    var(--divider-color, rgba(127,127,127,.3)) 55%, transparent);
  box-shadow: inset 0 2px 0 0 var(--primary-color);
}
.subtab:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
/* What is in that tab, said quietly enough to stay a tab label. The one that
   is not quiet is the one that stops a save: an event with nothing under What
   covers nothing, and the schema refuses it. */
.subnote { font-size: 11.5px; font-weight: 400; color: var(--secondary-text-color); }
.subnote.want { color: var(--warning-color, #d9a441); }

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

/* One section: what it is called, how it sorts, how many events are in it,
   and where it sits. */
.crits.wide { align-items: stretch; }
.crits.wide > .ghost { align-self: flex-start; }
/* A grid, not a row of flexed things: "1 event" and "4 events" are different
   widths, and a row that sizes its own columns made every name field a
   different length. The columns are the same for every section or they are
   not columns. */
.crits.wide .secrow {
  display: grid; gap: 8px; align-items: center;
  grid-template-columns: minmax(0, 1fr) 170px 72px auto auto auto;
}
.secrow .secname { min-width: 0; }
.secrow select { width: 100%; }
.secrow .count-of { font-size: 12px; white-space: nowrap; text-align: end; }
/* The library's own answer, over the column of section answers it is the
   default for. Same grid, so the two selects are the same control in the same
   place rather than two controls that happen to be near each other. */
.secrow.head { padding-bottom: 4px; }
/* Reading from the left, like everything else on the page. Right-aligning it
   put the sentence in the middle of a wide panel, next to a control it was
   only loosely about. */
.secrow.head .dim { font-size: 12.5px; }
/* The one that was asked for, when a section heading in the list is what
   opened this view. */
.secrow.asked { outline: 1px solid var(--primary-color); outline-offset: 3px;
  border-radius: 8px; }
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
/* Wide enough for "inside a group" on one line: the labels are the only thing
   saying which row each box is about, and one wrapping onto two lines pushes
   its own field out of line with the others. */
.pair label { display: grid; grid-template-columns: 104px minmax(0,1fr); gap: 8px; align-items: center; }
.pair span { font-size: 11px; color: var(--secondary-text-color); }
.check { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; }

/* Two parts: the controls, which wrap, and the arrows, which stay at the
   right-hand end however many lines the controls take. */
.cond { display: flex; gap: 7px; align-items: center;
  border: 1px solid var(--divider-color, rgba(127,127,127,.25));
  border-radius: 9px; padding: 7px 10px; margin-bottom: 7px; }
.cond > .fields { flex: 1 1 auto; min-width: 0;
  display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.cond > .acts { flex: none; display: flex; align-items: center; gap: 1px; }

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
  font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 7px;
  box-sizing: border-box;
  background: var(--card-background-color, transparent); color: inherit;
  border: 1px solid var(--divider-color, rgba(127,127,127,.3));
}
/* The value is the long one - "No error, Standby, Idle, Inactive" is a real
   thing to write in it - so it takes the room the row has going spare, up to
   the point where a text box stops being readable. The fixed ones are sized
   to what actually goes in them: 0:05:00, 23:00:00, a weekday or two. */
/* min-width as well as the basis on the fixed ones: without it they inherit
   the value field's floor and a numeric-state row - attribute, above, below,
   for - is wide enough to wrap onto a second line. */
.cond .cv { flex: 1 1 220px; min-width: 130px; max-width: 380px; }
.cond .cv.num { flex: 0 0 96px; min-width: 96px; }
.cond .cv.narrow { flex: 0 0 150px; min-width: 150px; }
.cond .lbl { font-size: 12px; color: var(--secondary-text-color); }
.hint { font-size: 12.5px; color: var(--secondary-text-color); padding-top: 6px; line-height: 1.5; }

.count { padding: 10px 0 0; font-size: 13px; display: block; }
.count .ok { color: var(--success-color, #5cb87f); font-weight: 500; }
.count .dim, .dim { color: var(--secondary-text-color); }
.matches { margin-top: 8px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.18));
  border-top-color: color-mix(in srgb,
    var(--divider-color, rgba(127,127,127,.18)) 55%, transparent);
  padding-top: 8px; max-height: 260px; overflow: auto; }
.mroom { font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color); padding: 10px 0 4px; }
/* One line, left to right, nothing pushed to an edge: name, id, state. Only
   the first two give way when the panel is narrow, and the id gives way first
   - the state is the thing being read. */
.mrow { display: flex; gap: 6px; align-items: baseline; font-size: 13px;
  padding: 2px 0; }
.mrow .mname { flex: 0 1 auto; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.mrow code { font-family: var(--ha-font-family-code, monospace); font-size: 11.5px;
  color: var(--secondary-text-color); }
/* The state is what the tab next door is being written about, so it reads as
   a value rather than as a footnote. */
.mrow .mstate { flex: none; color: var(--primary-text-color); white-space: nowrap; }
.mrow .msep { flex: none; color: var(--secondary-text-color); }
.mrow .mid { flex: 0 2 auto; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }

/* The ground a dashboard would put the card on, and nothing else. A dashed
   border made a box inside a box, and the card is meant to look here exactly
   as it looks there - that is the whole claim the preview makes. What marks it
   as a preview is the label beside it and the One/Many buttons above it, not
   chrome drawn around the card. */
/* One measured pixel, and the only one on this form.
   The label and the chip beside it share a baseline exactly - both sets of
   glyphs end on the same row, which is what jsenv/probe_ink.mjs reads off a
   6x screenshot. It still looks high, and it looks high for a reason: the
   label is 13px and the chip's word is 12px inside a filled pill, so the eye
   compares the pill's block centre against the label's, not the baseline they
   share. That gap measures 0.83px. Baseline is the right rule for text beside
   text; a filled chip is not text beside text. */
.field.chiprow .label { position: relative; top: 1px; }
.previewseg { margin-bottom: 8px; }
.previewbox {
  border-radius: 10px; padding: 8px 0; min-height: 44px;
  background: var(--primary-background-color, transparent);
}
.previewbox .hint { padding-top: 0; }
.previewbox .prevnote { padding-top: 8px; }

/* The syntax, at the bottom of the tab that uses it. Shut until it is wanted:
   it is a reference, and a reference that is always open is a wall. */
.cheat { margin: 18px 0 4px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.18));
  border-top-color: color-mix(in srgb,
    var(--divider-color, rgba(127,127,127,.18)) 55%, transparent);
  padding-top: 12px; }
.cheat summary { cursor: pointer; font-size: 13px; color: var(--secondary-text-color);
  list-style: none; display: flex; align-items: center; gap: 7px; }
.cheat summary::-webkit-details-marker { display: none; }
.cheat summary::before { content: "▸"; font-size: 11px; }
.cheat[open] summary::before { content: "▾"; }
.cheat summary:hover { color: var(--primary-text-color); }
.cheatbody { padding: 10px 0 0 18px; }
.exhead { font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--secondary-text-color); padding: 12px 0 6px; }
.exhead .dim { text-transform: none; letter-spacing: 0; font-size: 12px; }
/* Three columns: what you write, what it comes out as, what that means. The
   template column is sized to the longest of them so the arrows line up. */
.exrow { display: grid; grid-template-columns: 260px minmax(0, 190px) minmax(0, 1fr);
  gap: 14px; align-items: baseline; padding: 2px 0; font-size: 13px; }
.exrow code, .exblock code { font-family: var(--ha-font-family-code, monospace);
  font-size: 12px; color: var(--primary-text-color); overflow-wrap: anywhere; }
.exout { color: var(--success-color, #5cb87f); }
.exblock { padding: 6px 0; }
.exwas { font-size: 13px; padding-top: 3px; }
.cheat .hint code { font-family: var(--ha-font-family-code, monospace); font-size: 12px; }

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
