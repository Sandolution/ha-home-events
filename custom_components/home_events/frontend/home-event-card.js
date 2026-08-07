/*
 * home-event-card
 *
 * One card answering one question: what is happening in this house right now.
 *
 * It replaces the ~25 hand-written mushroom-template-cards in the Overview
 * dashboard, each with its own visibility block, its own Jinja duration
 * arithmetic and its own colour logic. Those cards were correct but they were
 * not a system: every new appliance meant another card, another OR branch in
 * the heading's visibility list, and another copy of the same
 * "as_timestamp(now()) - as_timestamp(last_changed)" template. Nothing tied
 * them together, so the rows drifted apart visually as they were added.
 *
 * The model here is deliberately small. Everything the house is doing is
 * flattened into one shape - an EVENT - and every event is drawn with the same
 * four-quadrant row:
 *
 *     [icon]  Title .................. Status
 *             Where / detail .......... Time
 *
 * Left is what and where, right is state and when. Because every source fills
 * the same four slots, a dishwasher, a radiator and a ventilation timer line up
 * in the same columns and the list can be read down rather than card by card.
 *
 * ---------------------------------------------------------------------------
 * Discovery over declaration
 *
 * The entities in this house follow strict conventions - `area_device_*` ids
 * and "Area | Device | Detail" friendly names - so the card discovers its own
 * events instead of being told about them, the same trick home-utility-card
 * uses for its appliance ranking. An empty config:
 *
 *     type: custom:home-event-card
 *
 * already finds the lights, appliances, climate, timers, media and covers.
 * Config exists to *exclude* and to tune, not to enumerate. Adding a smart plug
 * with a `sensor.<area>_<device>_state` twin makes it appear on its own.
 *
 * ---------------------------------------------------------------------------
 * Severity, not colour-per-domain
 *
 * The old cards coloured by domain (radiators green, ventilation green,
 * appliances green-or-orange). That spends the palette on classification the
 * icon already carries. Here colour means urgency only:
 *
 *   alert      red     something is wrong or open        (dryer door, error)
 *   attention  amber   finished, waiting on a human      (dishwasher Done)
 *   active     green   running normally, no action       (washer, radiator)
 *   info       grey    a state, not an event             (lights, media)
 *
 * Lights and media deliberately sit in that last band. They are things you may
 * want to know, not things asking anything of you, and colouring them the same
 * green as a running dryer would teach the eye to skip green.
 *
 * Calendars are not here at all. An appointment belongs beside the person it
 * belongs to - see home-person-card - not in a list of what the house is
 * doing. This card owns the house; that one owns the people.
 *
 * Climate is the one exception: cooling borrows the theme's cool blue, because
 * heat and cold are the one distinction a glance should never have to read.
 *
 * ---------------------------------------------------------------------------
 * Motion and cost
 *
 * This runs 24/7 on a wall tablet. `hass` fires on every state change in a
 * house with 1700+ entities, so the card keeps a cached index of *candidate*
 * entities (rebuilt only when the entity count changes), builds a model from
 * those alone, and compares a signature before touching the DOM. Durations
 * tick on a 30s interval that updates text nodes in place rather than
 * re-rendering, and the interval is suspended while the tab is hidden.
 *
 * ---------------------------------------------------------------------------
 * Config
 *
 *   type: custom:home-event-card       (required, and sufficient)
 *   group_by:        category | area | severity | none   default category
 *   sort:            recent | duration | name            default recent
 *   max:             integer, default 14; the rest become a "+n more" line
 *   compact:         false | true | "auto" — one line per event. "auto"
 *                    tightens once past compact_threshold rows
 *   compact_threshold: integer, default 8
 *   max_per_section: rows a section shows before overflowing, 0 = uncapped
 *   overflow:        scroll | hide — what happens to the rest
 *   hide_when_empty: bool, default false
 *   empty_text:      string shown when the house is quiet
 *   promote_alerts:  bool, default true — anything red is filed under
 *                    "Needs attention" rather than its own category
 *   split_sections:  bool, default true — a card per section. Turn off for
 *                    `group_by: area`, which otherwise makes a card per room
 *   exclude:         list of entity id substrings, hidden from every source
 *   exclude_areas:   list of area names or ids, hidden from every source
 *   animate:         bool, default true
 *
 *   sources: every source takes `enabled`, `exclude` and `exclude_areas`,
 *   plus its own options:
 *     lights:     aggregate (area|entity), min_minutes
 *     appliances: include_standby (default false)
 *     climate:    show_idle
 *     timers:     —
 *     media:      include_paused (default false)
 *     house:      —
 *
 *   Each source also accepts the shorthand `lights: false`.
 *   An unknown key under `sources` or `custom` throws rather than being
 *   ignored, and names the nearest valid option.
 *
 *   custom: list of entities conventions cannot reach. The four slots map to
 *   the row grammar, and mixing them up is the easy mistake:
 *
 *       title   -> top left      the thing            ("Air purifier")
 *       detail  -> bottom left   where, or about      ("Living Room")
 *       status  -> top right     the state word       ("Fill water reservoir")
 *       (time)  -> bottom right  automatic
 *
 *   `detail` is not "the text to show" - it is the *location* slot. Put the
 *   state in `status`, or the row loses its right-hand column and stops
 *   lining up with every other row on the card. Omitting `detail` falls back
 *   to the entity's area, which is usually what you want.
 *
 *     - entity: alarm_control_panel.alarm_master
 *       when: disarmed             # state, or list; omit for "not off/idle"
 *       conditions:                # all must hold, AND
 *         - after: "20:00"         # a time window; wraps midnight
 *           before: "06:00"
 *         - weekday: [mon, tue, wed, thu, fri]   # optional
 *         - entity: binary_sensor.x  # or an entity, with state / state_not
 *           state: "on"
 *       title: Alarm
 *       detail: "{state}"          # humanised; {state.raw} is not.
 *                                  # also {attr.x}, optionally @other.entity
 *       severity: attention        # alert | attention | active | info
 *       group: alerts
 */

const CARD_BUILD = "2026-08-06b";

/* ------------------------------------------------------------------ config */

/* Groups are rendered in this order when group_by is "category". The order is
 * a priority statement: things that need a human come first, then things that
 * are running, then things that are merely scheduled. */
const GROUPS = [
  { id: "alerts", label: "Needs attention" },
  { id: "climate", label: "Climate" },
  { id: "appliances", label: "Appliances" },
  { id: "media", label: "Media" },
  { id: "lights", label: "Lights" },
  { id: "house", label: "House" },
];

const SEVERITY_RANK = { alert: 0, attention: 1, active: 2, info: 3 };

/* Lights that exist to control other lights, or that are never really "on" in
 * the sense a person means. Adaptive Lighting's switches sit permanently on and
 * would otherwise report every staircase as lit forever; group helpers would
 * double-count their own members; tablet screens are not room lighting.
 *
 * Matched as substrings of the entity id, so these read as naming conventions
 * rather than as a list of specific entities to maintain. */
const LIGHT_EXCLUDE = [
  "_group",
  "_adaptive",
  "_override",
  "_lightener",
  "_screen",
  "light.dummy",
];

/* Registry areas used for filing rather than for location. An event that
 * happens in "System" has no useful where. */
const NON_AREAS = new Set(["other", "system"]);

/* Timers that exist to debounce an automation rather than to time something a
 * person started. */
const TIMER_EXCLUDE = ["_off_delay"];

/* `sensor.*_state` is the house convention for appliance state machines (see
 * configurations/template/sensor/*.yaml). These suffixes use the same shape for
 * something that is not an appliance. */
const STATE_SENSOR_EXCLUDE = ["_battery_state", "system_", "_backup_manager_state"];

/* The vocabulary those template sensors emit. Anything not listed is still
 * shown - a new appliance with its own words should appear rather than be
 * silently dropped - but these get the right severity and phrasing. */
const APPLIANCE_STATES = {
  active: { severity: "active", label: "Active" },
  running: { severity: "active", label: "Running" },
  standby: { severity: "info", label: "Standby" },
  done: { severity: "attention", label: "Finished" },
  finished: { severity: "attention", label: "Finished" },
  "door open": { severity: "alert", label: "Door open" },
  error: { severity: "alert", label: "Error" },
  paused: { severity: "info", label: "Paused" },
  /* The irrigation valves speak snake_case rather than the template sensors'
   * title case. water_shortage is a real alert; normal_state is this house's
   * spelling of "nothing to report" and is in APPLIANCE_IDLE below. */
  water_shortage: { severity: "alert", label: "Water shortage" },
  low_water: { severity: "alert", label: "Low water" },
};

/* States that mean "nothing to report" and keep the appliance off the list.
 *
 * `standby` is here rather than in the vocabulary above, and that is the whole
 * difference between a useful card and a permanently noisy one: the fridge, the
 * water heater and a TV on standby all sit at "powered but doing nothing"
 * forever. The old dashboard never hit this because it named five appliances by
 * hand; discovery finds every one of them. Set
 * `sources.appliances.include_standby: true` to see them anyway. */
const APPLIANCE_IDLE = new Set([
  "off",
  "inactive",
  "idle",
  "standby",
  "normal_state",
  "normal",
  "unknown",
  "unavailable",
  "",
]);

const DEFAULTS = {
  /* category | area | severity | none */
  group_by: "category",
  /* recent | duration | name — see _sortEvents */
  sort: "recent",
  /* Hard cap on rows. The overflow line is more honest than a scrollbar on a
   * wall tablet, where nobody scrolls a glance panel. */
  max: 14,
  /* One line per event instead of two: true, false, or "auto".
   *
   * "auto" is the useful one. Density is not a taste to be set once - it is a
   * response to how much is happening. A quiet house has room to breathe; a
   * busy one would rather fit. Above compact_threshold rows the card tightens
   * itself and keeps roughly twice as much on screen, at the cost of the area
   * label moving to a suffix. */
  compact: false,
  compact_threshold: 8,
  /* Rows a section shows before it starts scrolling. 0 leaves sections
   * uncapped and lets `max` do the work.
   *
   * A global cap alone starves: fifteen appliance rows push the other sections
   * off the card entirely, and the sections that vanish are the ones you were
   * not thinking about - which is the reason to have a card like this at all.
   * Per-section limits keep every category represented. */
  max_per_section: 0,
  /* What happens to the rows past that limit.
   *
   *   scroll  the section keeps its height and the rest are reachable
   *   hide    the rest are dropped, reported as a "+n more" line
   *
   * Scrolling wins here because the truncated rows are not noise - they are
   * the same kind of thing as the ones above them, and a glance panel that
   * says "4 more" without a way to see them is asking you to go elsewhere. */
  overflow: "scroll",
  /* A card that vanishes leaves a hole in a sections layout, and a hole reads
   * as a broken card rather than as a quiet house. Off by default. */
  hide_when_empty: false,
  /* Alert-severity events are filed under "Needs attention" instead of their
   * own category. Only applies to group_by: category - severity grouping
   * already collects them, and area grouping would be defeated by it. */
  promote_alerts: true,
  /* One card per section, separated by a gap, rather than one card with rules
   * in it. True suits `group_by: category`, where four or five sections read
   * as a deliberate structure. Set it false for `group_by: area`, which can
   * produce eight rooms and therefore eight small surfaces. */
  split_sections: true,
  empty_text: "Nothing going on",
  /* Entity ids or substrings hidden from every source. */
  exclude: [],
  /* Areas hidden from every source, by display name or area id. */
  exclude_areas: [],
  animate: true,

  sources: {
    lights: {
      enabled: true,
      /* area | entity — one row per room, or one row per lamp. Per-room is the
       * default because "3 lights on in Bed Room Lynn" is the sentence someone
       * actually wants; five lamp names is data, not information. */
      aggregate: "area",
      /* Rooms whose lights are never worth reporting. Outdoor lighting runs on
       * schedule and would sit in the list all evening as noise. */
      exclude_areas: [],
      exclude: [],
      /* Below this many minutes a light is assumed to be in active use rather
       * than forgotten. 0 shows every light the moment it comes on. */
      min_minutes: 0,
    },
    appliances: {
      enabled: true,
      /* See APPLIANCE_IDLE: standby is a permanent state for half the plugs in
       * this house, not an event. */
      include_standby: false,
      exclude: [],
      exclude_areas: [],
    },
    climate: {
      enabled: true,
      /* The connector between current and target temperature. Swappable
       * because legibility here depends on the screen it lands on, not on the
       * card: "→" is thin in some faces at 12px, and a wall tablet is read
       * from across a room. "»", "▸" or plain "to" all work. */
      arrow: "→",
      /* A thermostat that is on but has reached its setpoint. Worth seeing that
       * the system is engaged, but it is not an event in the same sense. */
      show_idle: true,
      exclude: [],
      exclude_areas: [],
    },
    timers: { enabled: true, exclude: [], exclude_areas: [] },
    media: {
      enabled: true,
      /* A paused speaker is not something happening. It was on the list at
       * first because it is technically "not idle", which is a state machine's
       * answer to a question nobody asked. */
      include_paused: false,
      exclude: [],
      exclude_areas: [],
    },
    house: {
      enabled: true,
      /* Covers, vacuums and locks that are not in their resting state. */
      exclude: [],
      exclude_areas: [],
    },
  },

  /* The escape hatch for everything conventions cannot reach: weather
   * warnings, the alarm panel, a forced ventilation shutdown. No Jinja - just
   * {state} and {attr.name} interpolation, optionally against another entity
   * with {attr.name@entity_id}. Anything needing real templating belongs in a
   * template sensor, where it can be tested. */
  custom: [],
};

/* ------------------------------------------------------------------- utils */

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function mergeConfig(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k in over) {
    const b = base ? base[k] : undefined;
    const o = over[k];
    /* An emptied-out key.
     *
     *     sources:
     *       lights:
     *
     * is `lights: null` once YAML is done with it, and it means "I deleted
     * what was in here", not "delete the section". Letting the null through
     * replaced a whole source config with nothing and the next read of
     * `cfg.enabled` took the card down with a TypeError - one blank line in
     * the editor for a blank card on the wall. The defaults stand instead. */
    if (o == null && isPlainObject(b)) {
      out[k] = b;
    } else if (typeof o === "boolean" && isPlainObject(b) && "enabled" in b) {
      /* `lights: false` is shorthand for `lights: { enabled: false }`. Writing
       * the long form for the common case is exactly the kind of ceremony this
       * card exists to remove. */
      out[k] = { ...b, enabled: o };
    } else if (isPlainObject(b) && isPlainObject(o)) {
      out[k] = mergeConfig(b, o);
    } else {
      out[k] = o;
    }
  }
  return out;
}

const CUSTOM_KEYS = [
  "entity", "when", "when_not", "conditions", "title", "detail", "status",
  "icon", "severity", "group", "time_mode", "show_time",
];

const CONDITION_KEYS = ["entity", "state", "state_not", "after", "before", "weekday"];

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/* "22:30" | "22:30:00" -> minutes since midnight. */
function parseClock(value) {
  const m = String(value == null ? "" : value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/* Is `now` inside [after, before)?
 *
 * The interesting case is the one every bedtime rule needs: 20:00 -> 06:00,
 * where `after` is greater than `before` because the window crosses midnight.
 * Treating that as an empty range is the classic bug - the card would simply
 * never fire between 20:00 and midnight - so a wrapping window is detected and
 * the test inverts to an OR.
 *
 * `before` is exclusive, which is what makes 18:00 -> 00:00 mean "until
 * midnight" rather than "a zero-length window at midnight". */
function withinWindow(after, before, now) {
  const a = after == null ? 0 : parseClock(after);
  const b = before == null ? 24 * 60 : parseClock(before);
  if (a === null || b === null) return null; // unparseable: caller reports it
  const t = now.getHours() * 60 + now.getMinutes();
  if (a === b) return true; // a full day
  if (a < b) return t >= a && t < b;
  return t >= a || t < b; // wraps midnight
}

/* Levenshtein distance, capped at the only use it has here: telling someone
 * that `exclude_area` was probably meant to be `exclude_areas`. A config error
 * that names the likely fix costs one function and saves a round trip. */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

function checkKeys(allowed, obj, where) {
  if (!isPlainObject(obj)) return;
  for (const key of Object.keys(obj)) {
    if (allowed.indexOf(key) !== -1) continue;
    const near = allowed
      .map((a) => [a, editDistance(key, a)])
      .filter(([, d]) => d <= 3)
      .sort((x, y) => x[1] - y[1])[0];
    throw new Error(
      `home-event-card: unknown option "${key}" in ${where}.` +
        (near ? ` Did you mean "${near[0]}"?` : "") +
        ` Valid options: ${allowed.join(", ")}.`
    );
  }
}

function stateOf(hass, id) {
  const st = hass && id ? hass.states[id] : null;
  if (!st || st.state === "unavailable" || st.state === "unknown") return null;
  return st;
}

/* Excludes are matched as substrings of the entity id so one entry can name a
 * single entity (light.garden_border), a device family (_nightstands) or a
 * whole room (garden_). A regex would be more precise and far less usable. */
/* Areas are named, not matched: "Bed Room Lynn" must not be excluded by an
 * entry meaning "Bed Room Noud". Compared on a slug so "Bed Room Sander &
 * Renate" and bed_room_sander_renate are the same answer. */
function areaSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function matchesArea(areaName, list) {
  if (!list || !list.length) return false;
  const slug = areaSlug(areaName);
  return list.some((a) => areaSlug(a) === slug);
}

function matchesAny(entityId, patterns) {
  if (!patterns || !patterns.length) return false;
  for (const p of patterns) {
    if (p && entityId.indexOf(String(p)) !== -1) return true;
  }
  return false;
}

/* Friendly names here read "Kitchen | Dishwasher | State". The area is the
 * first segment and the trailing domain word is noise once the row sits under
 * a group heading, so both are stripped and what remains is the device. */
function splitName(friendly, entityId) {
  const raw = String(friendly || entityId || "");
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { area: null, name: entityId };
  if (parts.length === 1) return { area: null, name: parts[0] };
  return { area: parts[0], name: parts.slice(1).join(" · ") };
}

/* Names here stack qualifiers - "Heating | Thermostat | Room" - so a single
 * pass would only ever peel one layer. Repeats until nothing more comes off,
 * and returns "" when the whole name was boilerplate, which is the signal the
 * caller needs to fall back to the room. */
function stripSuffix(name, words) {
  let out = String(name || "");
  for (let guard = 0; guard < 6; guard++) {
    let before = out;
    for (const w of words) {
      out = out.replace(new RegExp("\\s*·?\\s*" + w + "\\s*$", "i"), "");
    }
    out = out.trim();
    if (out === before.trim()) break;
  }
  return out;
}

/* Durations are read at a glance from across a room, so precision is spent
 * where it changes a decision: minutes below an hour, hours and minutes below a
 * day, days above that. Seconds never appear - they only add flicker. */
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

/* mode: since (elapsed) | until (countdown) | ago (elapsed, past-tense)
 *
 * Each mode carries its own preposition, because a bare "1h 12m" does not say
 * which way it points. "For 1h 12m" is a thing still running, "12m ago" is a
 * thing that finished, "in 6m" is a thing that has not started. The word is
 * doing real work - without it the washer and the dishwasher read identically
 * and mean opposite things. */
function fmtRelative(at, mode, now) {
  if (!at) return "";
  const delta = mode === "until" ? at - now : now - at;
  if (mode === "until") {
    /* "in just now" is nonsense, and a countdown that has run out but whose
     * entity has not caught up yet should not go negative. */
    return delta < 60000 ? "any moment" : "in " + fmtDur(delta);
  }
  const d = fmtDur(delta);
  if (mode === "ago") return d === "just now" ? d : d + " ago";
  /* "For just now" does not parse; something under a minute old has just
   * started, which is what the row should say. */
  return d === "just now" ? "Just started" : "For " + d;
}

/* Home Assistant hands out three different time formats and getting them
 * wrong is silent - the number still renders, it is just hours off.
 *
 *   "2026-08-06T10:15:00+00:00"  timer.finishes_at, zoned      -> Date.parse
 *   "2026-08-06 14:30:00"        calendar start, local, no zone -> local parts
 *   "2026-08-06"                 all-day calendar entry         -> local midnight
 *
 * Date.parse reads the bare date as UTC, which drags an all-day event back
 * into the previous evening in this timezone, so the unzoned forms are
 * assembled by hand and only the zoned form is handed to the parser. */
function parseHassTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s);
    return isFinite(t) ? t : null;
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime();
  const t = Date.parse(s);
  return isFinite(t) ? t : null;
}

/* "water_shortage" -> "Water shortage". Integration states are written for
 * state machines; the status column is read by a person. */
function humanise(raw) {
  const s = String(raw || "").replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* Setpoints read 19 and currents read 19.4; rounding both to one decimal makes
 * the pair comparable instead of implying different precision. */
function temp(v) {
  const n = num(v);
  return n === null ? null : (Math.round(n * 10) / 10).toFixed(1);
}

/* ------------------------------------------------------------------ events */

/* Every source produces this shape and nothing else:
 *
 *   key       stable identity, so a row keeps its place across renders
 *   group     which section it lands in
 *   severity  alert | attention | active | info
 *   icon      mdi name
 *   title     the thing            ("Dishwasher", "3 lights on")
 *   sub       where or what about  ("Kitchen", "25.5° → 18.0°")
 *   status    the state word       ("Active", "Cooling")
 *   at        epoch ms for the time column
 *   mode      since | until | ago
 *   entity    what a tap opens
 *   tone      optional colour override for climate's cool blue
 */
function ev(o) {
  return {
    key: o.key,
    group: o.group,
    severity: o.severity || "info",
    icon: o.icon || "mdi:information-outline",
    title: o.title || "",
    sub: o.sub || "",
    status: o.status || "",
    at: o.at || null,
    mode: o.mode || "since",
    entity: o.entity || "",
    tone: o.tone || null,
    area: o.area || null,
  };
}

class HomeEventCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._sig = null;
    this._idx = null;
    this._idxKey = null;
    this._timer = null;
    this._prevKeys = null;
    this._onClick = (e) => this._handleClick(e);
    this._onKey = (e) => this._handleKey(e);
    this._onVisibility = () => this._applyVisibility();
  }

  setConfig(config) {
    const cfg = mergeConfig(DEFAULTS, config || {});

    const valid = ["category", "area", "severity", "none"];
    if (valid.indexOf(cfg.group_by) === -1) {
      throw new Error(
        `home-event-card: unknown group_by "${cfg.group_by}". ` +
          `Valid values are ${valid.join(", ")}.`
      );
    }
    if (cfg.compact !== "auto" && typeof cfg.compact !== "boolean") {
      throw new Error(
        `home-event-card: \`compact\` must be true, false or "auto", got ${JSON.stringify(cfg.compact)}.`
      );
    }
    if (["recent", "duration", "name"].indexOf(cfg.sort) === -1) {
      throw new Error(
        `home-event-card: unknown sort "${cfg.sort}". Valid values are recent, duration, name.`
      );
    }
    cfg.custom = Array.isArray(cfg.custom) ? cfg.custom : [];
    for (const c of cfg.custom) {
      if (!c || !c.entity) {
        throw new Error("home-event-card: every entry under `custom` needs an `entity`.");
      }
      checkKeys(CUSTOM_KEYS, c, `custom entry for ${c.entity}`);
      if (c.conditions && !Array.isArray(c.conditions)) {
        throw new Error(
          `home-event-card: \`conditions\` on ${c.entity} must be a list.`
        );
      }
      for (const cond of c.conditions || []) {
        if (!cond || (!cond.entity && cond.after == null && cond.before == null &&
                      cond.weekday == null)) {
          throw new Error(
            `home-event-card: every condition on ${c.entity} needs an \`entity\`, ` +
              `or a time window (\`after\` / \`before\`), or a \`weekday\`.`
          );
        }
        checkKeys(CONDITION_KEYS, cond, `condition on ${c.entity}`);
        for (const k of ["after", "before"]) {
          if (cond[k] != null && parseClock(cond[k]) === null) {
            throw new Error(
              `home-event-card: \`${k}: ${cond[k]}\` on ${c.entity} is not a time. ` +
                `Use HH:MM or HH:MM:SS, e.g. "20:00".`
            );
          }
        }
        for (const d of cond.weekday == null
          ? []
          : Array.isArray(cond.weekday)
          ? cond.weekday
          : [cond.weekday]) {
          if (WEEKDAYS.indexOf(String(d).slice(0, 3).toLowerCase()) === -1) {
            throw new Error(
              `home-event-card: \`weekday: ${d}\` on ${c.entity} is not a day. ` +
                `Use ${WEEKDAYS.join(", ")}.`
            );
          }
        }
      }
    }

    /* Unknown keys throw rather than being ignored.
     *
     * This exists because `appliances: { exclude_areas: [...] }` was a
     * perfectly reasonable guess that silently did nothing, and a filter that
     * silently does nothing is worse than one that does not exist - you go
     * looking for the bug in the wrong place. Strictness is limited to the
     * `sources` and `custom` blocks, which are entirely this card's namespace;
     * the top level is shared with Lovelace and stays lenient. */
    checkKeys(Object.keys(DEFAULTS.sources), cfg.sources, "sources");
    for (const name of Object.keys(DEFAULTS.sources)) {
      /* Belt and braces behind mergeConfig's null handling: every source must
       * be an object by the time a source function reads it, whatever shape
       * the YAML arrived in. A broken config should raise a config error, never
       * a TypeError from inside a render. */
      if (!isPlainObject(cfg.sources[name])) cfg.sources[name] = DEFAULTS.sources[name];
      checkKeys(Object.keys(DEFAULTS.sources[name]), cfg.sources[name], `sources.${name}`);
    }

    this._config = cfg;
    this._sig = null; // force a redraw on the next hass tick
    this._idx = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    this._render();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_columns: 6 };
  }

  connectedCallback() {
    /* Durations are only ever shown to the minute, so a 30s tick is the
     * coarsest interval that never shows a stale minute. */
    this._timer = window.setInterval(() => this._tick(), 30000);
    document.addEventListener("visibilitychange", this._onVisibility);
    this._applyVisibility();
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
    this._timer = null;
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  /* A tablet with its screen off should not be recomputing relative times. */
  _applyVisibility() {
    if (document.hidden) {
      if (this._timer) window.clearInterval(this._timer);
      this._timer = null;
      if (this._calTimer) window.clearInterval(this._calTimer);
      this._calTimer = null;
      return;
    }
    if (!this._timer && this.isConnected) {
      this._timer = window.setInterval(() => this._tick(), 30000);
    }
    this._tick();
  }

  /* ------------------------------------------------------------ scaffold */

  /* No <ha-card> wrapper: the sections are the cards. Same construction as
   * home-utility-card, which also emits several blocks from one element. */
  _build() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="root"></div>`;
    this._root = this.shadowRoot.querySelector(".root");
    if (!this._config.animate) this._root.classList.add("no-anim");
    this._root.addEventListener("click", this._onClick);
    this._root.addEventListener("keydown", this._onKey);
    this._built = true;
  }

  _handleClick(e) {
    const el = this._targetOf(e);
    if (el && el.dataset.entity) this._fireMoreInfo(el.dataset.entity);
  }

  /* Rows carry tabindex and role="button", which would be a lie without a
   * keyboard path to the same action. */
  _handleKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = this._targetOf(e);
    if (!el || !el.dataset.entity) return;
    e.preventDefault();
    this._fireMoreInfo(el.dataset.entity);
  }

  _targetOf(e) {
    return e.composedPath().find((n) => n && n.dataset && n.dataset.entity);
  }

  _fireMoreInfo(entityId) {
    const e = new Event("hass-more-info", { bubbles: true, composed: true });
    e.detail = { entityId };
    this.dispatchEvent(e);
  }

  /* ------------------------------------------------------------- registry */

  /* Area resolution prefers the registry, because that is the answer Home
   * Assistant itself would give. The friendly-name prefix is a fallback for
   * entities with no device and no area assignment - which in this house still
   * carry their room in the name. */
  _areaName(entityId, stateObj) {
    const hass = this._hass;
    const entReg = hass.entities && hass.entities[entityId];
    let areaId = entReg && entReg.area_id;
    if (!areaId && entReg && entReg.device_id && hass.devices) {
      const dev = hass.devices[entReg.device_id];
      areaId = dev && dev.area_id;
    }
    /* "Other" and "System" are filing cabinets, not rooms. Printing them as a
     * location would be worse than printing nothing. */
    if (areaId && NON_AREAS.has(areaId)) areaId = null;
    if (areaId && hass.areas && hass.areas[areaId]) return hass.areas[areaId].name;
    const attrs = (stateObj && stateObj.attributes) || {};
    return splitName(attrs.friendly_name, entityId).area;
  }

  /* Walking 1700 states on every hass tick to find six timers would be
   * wasteful on an always-on tablet. The candidate index is the set of entity
   * ids any source could possibly care about; it only changes when entities
   * are added or removed, which the entity count detects well enough. */
  _index() {
    const hass = this._hass;
    const key = Object.keys(hass.states).length;
    if (this._idx && this._idxKey === key) return this._idx;

    const idx = {
      lights: [],
      appliances: [],
      climate: [],
      timers: [],
      media: [],
      covers: [],
      vacuums: [],
    };

    for (const id in hass.states) {
      const dot = id.indexOf(".");
      const domain = id.slice(0, dot);
      switch (domain) {
        case "light":
          if (!matchesAny(id, LIGHT_EXCLUDE)) idx.lights.push(id);
          break;
        case "climate":
          idx.climate.push(id);
          break;
        case "timer":
          if (!matchesAny(id, TIMER_EXCLUDE)) idx.timers.push(id);
          break;
        case "media_player":
          idx.media.push(id);
          break;
        case "cover":
          idx.covers.push(id);
          break;
        case "vacuum":
          idx.vacuums.push(id);
          break;
        case "sensor":
          if (id.endsWith("_state") && !matchesAny(id, STATE_SENSOR_EXCLUDE)) {
            idx.appliances.push(id);
          }
          break;
        default:
          break;
      }
    }

    /* A `_trv` entity is the valve underneath a room thermostat and reports its
     * own setpoint; showing both puts the same radiator on the list twice with
     * different numbers. The sibling is not always an exact stem match -
     * climate.ground_floor_heating_thermostat_trv pairs with
     * ...thermostat_room, not ...thermostat - so the test is whether any other
     * climate entity shares the stem, not whether the bare stem exists. */
    idx.climate = idx.climate.filter((id) => {
      if (!id.endsWith("_trv")) return true;
      const stem = id.slice(0, -4);
      return !idx.climate.some((other) => other !== id && other.startsWith(stem));
    });

    /* Light group helpers expose their members in `attributes.entity_id`.
     * Detecting them from state is more reliable than the `_group` naming
     * convention alone, and it catches groups added by the UI helper editor. */
    idx.lights = idx.lights.filter((id) => {
      const st = hass.states[id];
      return !(st && st.attributes && Array.isArray(st.attributes.entity_id));
    });

    this._idx = idx;
    this._idxKey = key;
    return idx;
  }

  /* --------------------------------------------------------------- sources */

  /* The one gate every source runs an entity through, so "how do I hide this?"
   * has the same answer everywhere instead of depending on which source found
   * it. Four filters, applied in this order:
   *
   *   1. exclude            (global)  entity id substring
   *   2. sources.X.exclude            entity id substring
   *   3. exclude_areas      (global)  area name or id, exact
   *   4. sources.X.exclude_areas      area name or id, exact
   *
   * Entity ids match on substring because one entry should be able to name a
   * device (kitchen_fridge), a family (_nightstands) or a room (kitchen_).
   * Areas match exactly, because a substring rule would let "Bed Room Noud"
   * silently take out "Bed Room Noud" and nothing else while an entry meaning
   * "Bed Room" took out three rooms nobody intended. */
  _excluded(entityId, sourceCfg, stateObj) {
    const cfg = this._config;
    if (matchesAny(entityId, cfg.exclude)) return true;
    if (matchesAny(entityId, (sourceCfg && sourceCfg.exclude) || [])) return true;

    const globalAreas = cfg.exclude_areas || [];
    const sourceAreas = (sourceCfg && sourceCfg.exclude_areas) || [];
    if (!globalAreas.length && !sourceAreas.length) return false;

    const area = this._areaName(entityId, stateObj || this._hass.states[entityId]);
    if (!area) return false;
    return matchesArea(area, globalAreas) || matchesArea(area, sourceAreas);
  }

  _lights(out) {
    const cfg = this._config.sources.lights;
    if (!cfg.enabled) return;
    const hass = this._hass;
    const now = Date.now();
    const floor = (cfg.min_minutes || 0) * 60000;
    const byArea = new Map();

    for (const id of this._index().lights) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || st.state !== "on") continue;
      const at = Date.parse(st.last_changed);
      if (floor && now - at < floor) continue;

      const area = this._areaName(id, st) || "Elsewhere";

      if (cfg.aggregate === "entity") {
        const { name } = splitName(st.attributes.friendly_name, id);
        out.push(
          ev({
            key: id,
            group: "lights",
            severity: "info",
            icon: st.attributes.icon || "mdi:lightbulb",
            title: name,
            sub: area,
            area,
            at: isFinite(at) ? at : null,
            mode: "since",
            entity: id,
          })
        );
        continue;
      }

      let bucket = byArea.get(area);
      if (!bucket) {
        bucket = { area, ids: [], at: Infinity };
        byArea.set(area, bucket);
      }
      bucket.ids.push(id);
      if (isFinite(at) && at < bucket.at) bucket.at = at;
    }

    for (const b of byArea.values()) {
      const n = b.ids.length;
      out.push(
        ev({
          /* Lights are a state, not an event: nothing is being asked of
           * anyone, so they take the informational grey and sit below the
           * things that are actually running. Green here would put "the couch
           * lamp is on" at the same weight as "the dryer is mid-cycle". */
          key: "lights:" + b.area,
          group: "lights",
          severity: "info",
          icon: n > 1 ? "mdi:lightbulb-group" : "mdi:lightbulb",
          /* The count is the headline because it is the part that varies; the
           * room is the qualifier. "3 lights on" then "Bed Room Lynn" reads as
           * a sentence in the two-line row. */
          title: n === 1 ? "1 light on" : `${n} lights on`,
          sub: b.area,
          area: b.area,
          /* The oldest of the group: how long the room has been lit, not how
           * long ago the last lamp joined in. */
          at: isFinite(b.at) ? b.at : null,
          mode: "since",
          entity: b.ids[0],
        })
      );
    }
  }

  _appliances(out) {
    const cfg = this._config.sources.appliances;
    if (!cfg.enabled) return;
    const hass = this._hass;

    for (const id of this._index().appliances) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st) continue;
      const raw = String(st.state || "").trim();
      const low = raw.toLowerCase();
      if (APPLIANCE_IDLE.has(low) && !(cfg.include_standby && low === "standby")) continue;

      const known = APPLIANCE_STATES[low];
      const attrs = st.attributes || {};
      const { area, name } = splitName(attrs.friendly_name, id);
      out.push(
        ev({
          key: id,
          group: "appliances",
          severity: known ? known.severity : "active",
          icon: attrs.icon || "mdi:power-plug",
          title: stripSuffix(name, ["State"]),
          sub: this._areaName(id, st) || area || "",
          area: this._areaName(id, st) || area,
          /* An unrecognised state still gets shown - a new appliance with its
           * own words should appear rather than be silently dropped - but
           * snake_case is the integration's spelling, not a person's. */
          status: known ? known.label : humanise(raw),
          at: Date.parse(st.last_changed) || null,
          /* A finished appliance is measured from when it finished; a running
           * one from when it started. Same number, opposite tense, and the
           * tense is what tells you whether to go and do something. */
          mode: known && known.severity === "attention" ? "ago" : "since",
          entity: id,
        })
      );
    }
  }

  _climate(out) {
    const cfg = this._config.sources.climate;
    if (!cfg.enabled) return;
    const hass = this._hass;

    for (const id of this._index().climate) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || st.state === "off" || st.state === "unavailable") continue;

      const a = st.attributes || {};
      /* hvac_action is the truth when the integration reports it - a
       * thermostat can be in `heat` while sitting idle at setpoint. SmartIR
       * and similar integrations omit it, so the mode stands in. */
      const action = a.hvac_action || null;
      const idle = action === "idle" || action === "off";
      if (idle && !cfg.show_idle) continue;

      const mode = action || st.state;
      const isCool = mode === "cooling" || mode === "cool" || mode === "dry" || mode === "drying";
      const label =
        {
          heating: "Heating",
          cooling: "Cooling",
          drying: "Drying",
          fan: "Fan",
          idle: "Idle",
          heat: "Heating",
          cool: "Cooling",
          dry: "Drying",
          fan_only: "Fan",
          heat_cool: "Auto",
          auto: "Auto",
        }[mode] || String(mode).replace(/^./, (c) => c.toUpperCase());

      const cur = temp(a.current_temperature);
      const set = temp(a.temperature);
      /* An arrow, not the ">" the old templates used: it reads as "moving
       * toward" rather than "greater than", which was actively wrong when
       * cooling from 25.5 to 18. _row gives it its own span so it can carry
       * enough weight to survive the viewing distance. */
      const arrow = cfg.arrow || "→";
      const range =
        cur !== null && set !== null
          ? `${cur}° ${arrow} ${set}°`
          : cur !== null
          ? `${cur}°`
          : "";

      const { area, name } = splitName(a.friendly_name, id);
      const areaName = this._areaName(id, st) || area || "";
      /* Climate entities are named after their function, not their identity:
       * "Bed Room Noud | Heating" leaves nothing but the word "Heating" once
       * the room is split off, and "Heating / Heating" is not a row. When the
       * name is entirely boilerplate the room becomes the subject - which is
       * true anyway, since what is heating is the room. Devices with a name of
       * their own (Air Conditioner) keep it and take the room as detail. */
      const device = stripSuffix(name, ["Heating", "Thermostat", "Climate", "Room", "TRV"]);
      const title = device || areaName || name;
      const where = device ? areaName : "";
      const detail = [where, range].filter(Boolean).join(" · ");
      out.push(
        ev({
          key: id,
          group: "climate",
          severity: idle ? "info" : "active",
          tone: idle ? null : isCool ? "cool" : "heat",
          icon: a.icon || (isCool ? "mdi:snowflake" : "mdi:radiator"),
          title,
          /* The temperatures are the detail. Where they sit against the room
           * depends on whether the room already carried the title. */
          sub: detail || areaName,
          area: areaName,
          status: label,
          at: Date.parse(st.last_changed) || null,
          mode: "since",
          entity: id,
        })
      );
    }
  }

  _timers(out) {
    const cfg = this._config.sources.timers;
    if (!cfg.enabled) return;
    const hass = this._hass;

    for (const id of this._index().timers) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || st.state !== "active") continue;
      const a = st.attributes || {};
      const { area, name } = splitName(a.friendly_name, id);
      /* `finishes_at` is on the timer entity itself. The old cards read
       * `sensor.<timer>_remaining` helpers that do not exist in this config, so
       * every ventilation row rendered "Active for " with nothing after it. */
      const at = parseHassTime(a.finishes_at) || Date.parse(a.finishes_at) || null;
      out.push(
        ev({
          key: id,
          group: "climate",
          severity: "active",
          icon: a.icon || "mdi:fan",
          title: stripSuffix(name, ["Timer"]),
          sub: this._areaName(id, st) || area || "",
          area: this._areaName(id, st) || area,
          status: "Running",
          at,
          mode: "until",
          entity: id,
        })
      );
    }
  }

  _media(out) {
    const cfg = this._config.sources.media;
    if (!cfg.enabled) return;
    const hass = this._hass;
    const live = new Set(["playing"]);
    if (cfg.include_paused) live.add("paused");

    for (const id of this._index().media) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || !live.has(st.state)) continue;
      const a = st.attributes || {};
      const { area, name } = splitName(a.friendly_name, id);
      const track = [a.media_title, a.media_artist].filter(Boolean).join(" · ");
      out.push(
        ev({
          /* Informational for the same reason as lights. A speaker playing is
           * worth knowing about - it is how you catch a TV left on in an empty
           * room - but it is not asking anything of you, and this house plays
           * TV audio through Sonos, so an "active" green would sit on the card
           * every evening and teach the eye to skip that colour. */
          key: id,
          group: "media",
          severity: "info",
          icon: a.icon || (st.state === "playing" ? "mdi:play-circle" : "mdi:pause-circle"),
          title: stripSuffix(name, ["Media Player"]) || area || name,
          sub: track || this._areaName(id, st) || "",
          area: this._areaName(id, st) || area,
          status: st.state === "playing" ? "Playing" : "Paused",
          at: Date.parse(st.last_changed) || null,
          mode: "since",
          entity: id,
        })
      );
    }
  }

  _house(out) {
    const cfg = this._config.sources.house;
    if (!cfg.enabled) return;
    const hass = this._hass;
    const idx = this._index();

    for (const id of idx.covers) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || st.state === "closed" || st.state === "unavailable") continue;
      const a = st.attributes || {};
      const { area, name } = splitName(a.friendly_name, id);
      const pos = num(a.current_position);
      out.push(
        ev({
          key: id,
          group: "house",
          severity: "info",
          icon: a.icon || "mdi:window-shutter-open",
          title: name,
          sub: this._areaName(id, st) || area || "",
          area: this._areaName(id, st) || area,
          status: pos !== null && pos > 0 && pos < 100 ? `${pos}% open` : "Open",
          at: Date.parse(st.last_changed) || null,
          mode: "since",
          entity: id,
        })
      );
    }

    for (const id of idx.vacuums) {
      const st = hass.states[id];
      if (this._excluded(id, cfg, st)) continue;
      if (!st || ["docked", "off", "idle", "unavailable"].indexOf(st.state) !== -1) continue;
      const a = st.attributes || {};
      const { area, name } = splitName(a.friendly_name, id);
      out.push(
        ev({
          key: id,
          group: "house",
          severity: st.state === "error" ? "alert" : "active",
          icon: a.icon || "mdi:robot-vacuum",
          title: name,
          sub: this._areaName(id, st) || area || "",
          area: this._areaName(id, st) || area,
          status: String(st.state).replace(/^./, (c) => c.toUpperCase()),
          at: Date.parse(st.last_changed) || null,
          mode: "since",
          entity: id,
        })
      );
    }
  }

  /* Interpolation for `custom` entries. {state} and {attr.foo} read from the
   * entry's own entity; {state@other.entity} reads from another. Deliberately
   * not Jinja: a template that needs branching is a template sensor, which can
   * be tested in the template editor and reused elsewhere. */
  _interp(text, entityId) {
    const hass = this._hass;
    return String(text).replace(/\{([^}]+)\}/g, (_, expr) => {
      const [path, target] = expr.split("@");
      const st = hass.states[(target || entityId).trim()];
      if (!st) return "";
      const p = path.trim();
      /* {state} is humanised, {state.raw} is not. Integration states are
       * written for state machines - armed_away, water_shortage - and this
       * lands in a row a person reads, so the same treatment the appliance
       * source gives them applies here. Attributes are left alone: they are
       * already prose more often than not. */
      if (p === "state") return humanise(st.state);
      if (p === "state.raw") return st.state;
      if (p.startsWith("attr.")) {
        const v = st.attributes[p.slice(5)];
        return v == null ? "" : String(v);
      }
      return "";
    });
  }

  _conditionsMet(conditions) {
    if (!conditions || !conditions.length) return true;
    const now = new Date();
    for (const cond of conditions) {
      /* Time and weekday need no entity. That is the whole point: a window is
       * a property of the clock, not of something in the house, and routing it
       * through a `tod` helper entity only to read that entity back is a
       * round trip with no destination. */
      if (cond.after != null || cond.before != null) {
        const inside = withinWindow(cond.after, cond.before, now);
        if (inside === null) return false; // unparseable window: never matches
        if (!inside) return false;
      }
      if (cond.weekday != null) {
        const want = (Array.isArray(cond.weekday) ? cond.weekday : [cond.weekday])
          .map((d) => String(d).slice(0, 3).toLowerCase());
        if (want.indexOf(WEEKDAYS[now.getDay()]) === -1) return false;
      }

      if (cond.entity == null) continue;
      const st = this._hass.states[cond.entity];
      if (!st) return false;
      if (cond.state != null) {
        const want = Array.isArray(cond.state) ? cond.state : [cond.state];
        if (want.map(String).indexOf(st.state) === -1) return false;
      }
      if (cond.state_not != null) {
        const no = Array.isArray(cond.state_not) ? cond.state_not : [cond.state_not];
        if (no.map(String).indexOf(st.state) !== -1) return false;
      }
    }
    return true;
  }

  _custom(out) {
    const hass = this._hass;
    for (let i = 0; i < this._config.custom.length; i++) {
      const c = this._config.custom[i];
      const st = hass.states[c.entity];
      if (!st) continue;

      const when = c.when == null ? null : Array.isArray(c.when) ? c.when : [c.when];
      const notWhen = c.when_not == null ? null : Array.isArray(c.when_not) ? c.when_not : [c.when_not];
      if (when && when.map(String).indexOf(st.state) === -1) continue;
      if (notWhen && notWhen.map(String).indexOf(st.state) !== -1) continue;
      /* No `when` at all means "show whenever the entity is not off/idle",
       * which covers the common case without asking for a state list. */
      if (!when && !notWhen && APPLIANCE_IDLE.has(String(st.state).toLowerCase())) continue;

      /* Extra entities that must also agree, AND-ed. This is what lets one
       * entry mean "the alarm is disarmed *and* it is bedtime" - the shape the
       * old dashboard expressed with a nested visibility block. Deliberately
       * the same vocabulary Lovelace uses (`state` / `state_not`) rather than a
       * private one. */
      if (!this._conditionsMet(c.conditions)) continue;

      const a = st.attributes || {};
      const { area, name } = splitName(a.friendly_name, c.entity);
      out.push(
        ev({
          key: "custom:" + i + ":" + c.entity,
          group: c.group || "alerts",
          severity: c.severity || "alert",
          icon: c.icon || a.icon || "mdi:alert",
          title: c.title ? this._interp(c.title, c.entity) : name,
          sub: c.detail ? this._interp(c.detail, c.entity) : this._areaName(c.entity, st) || area || "",
          area: this._areaName(c.entity, st) || area,
          status: c.status ? this._interp(c.status, c.entity) : "",
          at: c.show_time === false ? null : Date.parse(st.last_changed) || null,
          mode: c.time_mode || "since",
          entity: c.entity,
        })
      );
    }
  }

  /* ---------------------------------------------------------------- model */

  _collect() {
    const out = [];
    this._custom(out); // first, so an explicit entry wins a key collision
    this._climate(out);
    this._timers(out);
    this._appliances(out);
    this._media(out);
    this._house(out);
    this._lights(out);

    const seen = new Set();
    return out.filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });
  }

  _sortEvents(list) {
    const mode = this._config.sort;
    const now = Date.now();
    return list.sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (s) return s;
      /* Countdowns run the other way round from durations: a timer with four
       * minutes left and the next calendar entry are both "the next thing to
       * happen", so soonest wins regardless of the configured sort. */
      if (a.mode === "until" && b.mode === "until") {
        return (a.at || Infinity) - (b.at || Infinity);
      }
      if (mode === "name") return a.title.localeCompare(b.title);
      if (mode === "duration") {
        /* Longest-running first: the light that has been on for three hours is
         * the one worth noticing, not the one switched on a minute ago. */
        return (a.at || now) - (b.at || now);
      }
      return (b.at || 0) - (a.at || 0); // recent: newest first
    });
  }

  /* Applied after grouping, so a section that would run long is bounded rather
   * than allowed to swallow its neighbours. Alerts are never limited: a
   * section called "Needs attention" that hides some of what needs attention is
   * worse than no section at all.
   *
   * In scroll mode the rows are all still rendered and the height is what gets
   * capped, so nothing is unreachable. In hide mode they are dropped. */
  _capSections(sections) {
    const cap = this._config.max_per_section;
    if (!cap) return sections;
    const scroll = this._config.overflow === "scroll";
    for (const s of sections) {
      if (s.id === "alerts") continue;
      if (s.events.length <= cap) continue;
      s.over = s.events.length - cap;
      if (scroll) s.scrollTo = cap;
      else s.events = s.events.slice(0, cap);
    }
    return sections;
  }

  _sections(events) {
    const by = this._config.group_by;
    if (by === "none") return [{ id: "all", label: null, events }];

    const buckets = new Map();
    const push = (id, label, e) => {
      let b = buckets.get(id);
      if (!b) {
        b = { id, label, events: [] };
        buckets.set(id, b);
      }
      b.events.push(e);
    };

    if (by === "area") {
      for (const e of events) push(e.area || "Elsewhere", e.area || "Elsewhere", e);
      /* Alphabetical by room. Floor order would be better, but it would need a
       * floor registry lookup per row for a list this short. */
      return this._capSections(
        [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label))
      );
    }

    if (by === "severity") {
      const labels = {
        alert: "Needs attention",
        attention: "Finished",
        active: "Running",
        info: "Also happening",
      };
      for (const e of events) push(e.severity, labels[e.severity] || e.severity, e);
      return this._capSections(
        [...buckets.values()].sort((a, b) => SEVERITY_RANK[a.id] - SEVERITY_RANK[b.id])
      );
    }

    for (const e of events) {
      /* Anything wrong is filed under "Needs attention", whichever source
       * found it. A water shortage is not an appliance fact that happens to be
       * red - it is the thing to deal with, and burying it three sections down
       * under Appliances means the one row that earned its colour is the one
       * you have to go looking for. Severity outranks category here; the
       * category still decides where everything else lands. */
      const id = this._config.promote_alerts && e.severity === "alert" ? "alerts" : e.group;
      const g = GROUPS.find((x) => x.id === id) || { id, label: id };
      push(g.id, g.label, e);
    }
    const order = GROUPS.map((g) => g.id);
    return this._capSections(
      [...buckets.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    );
  }

  _locale() {
    return (this._hass && this._hass.locale && this._hass.locale.language) || "en-GB";
  }

  _use24h() {
    const fmt = this._hass && this._hass.locale && this._hass.locale.time_format;
    return fmt !== "12";
  }

  /* --------------------------------------------------------------- render */

  _render() {
    /* _fetchCalendars resolves on its own schedule and can land before the
     * scaffold exists on some ordering of setConfig / hass / connect. */
    if (!this._root || !this._hass || !this._config) return;
    let events = this._sortEvents(this._collect());
    const total = events.length;
    const max = this._config.max;
    let overflow = 0;
    if (max && total > max) {
      overflow = total - max;
      events = events.slice(0, max);
    }

    /* hass fires on every state change in the house. Redrawing unconditionally
     * would rebuild this list many times a second for nothing, so the DOM is
     * only touched when the rendered content would actually differ. Timestamps
     * are in the signature because a row that changed *when* it started is a
     * different row; the per-minute text refresh happens in _tick. */
    const sig = JSON.stringify([
      this._config.group_by,
      this._config.compact === "auto"
        ? total > this._config.compact_threshold
        : !!this._config.compact,
      events.map((e) => [e.key, e.severity, e.title, e.sub, e.status, e.at, e.tone]),
      overflow,
    ]);
    if (sig === this._sig) return;
    this._sig = sig;

    if (this._config.hide_when_empty) {
      this.style.display = total ? "" : "none";
    }

    if (!total) {
      this._root.innerHTML =
        `<div class="card"><div class="empty">${esc(this._config.empty_text)}</div></div>`;
      this._prevKeys = new Set();
      return;
    }

    /* Which rows are genuinely new since the last paint, so only those animate
     * in. `null` on the very first paint is deliberate: a card that plays an
     * entrance every time the dashboard opens is a card you learn to wait for,
     * and this one is looked at fifty times a day. */
    const seen = this._prevKeys;
    const keys = new Set(events.map((e) => e.key));

    /* One card per section rather than one card with rules in it.
     *
     * A hairline between groups asks the eye to notice a 1px change in
     * brightness; a real gap between surfaces does the same job pre-attentively
     * and survives being glanced at from across a room. It also matches
     * home-utility-card, which renders its blocks the same way, so a column
     * holding both reads as one system rather than two conventions. */
    const sections = this._sections(events);
    const now = Date.now();
    const last = sections.length - 1;
    const split = this._config.split_sections;
    /* Density answers to load, not to taste. */
    const compact =
      this._config.compact === "auto"
        ? total > this._config.compact_threshold
        : !!this._config.compact;
    const more = overflow
      ? `<div class="more">+${overflow} more ${overflow === 1 ? "event" : "events"}</div>`
      : "";

    const blocks = sections.map((s, i) => {
      const head = s.label
        ? `<div class="sec"><span class="lab">${esc(s.label)}</span>` +
          `<span class="cnt">${s.events.length}</span></div>`
        : "";
      /* A scrolling section is bounded by row count, not by pixels: --max
       * carries the limit and the stylesheet turns it into a height using the
       * row metrics for the density actually in use. The extra .45 leaves the
       * next row half-visible, which says "there is more here" better than any
       * label and survives being seen from across a room. */
      const bounded = s.scrollTo
        ? ` scroll" style="--max:${s.scrollTo}`
        : "";
      const rows =
        `<div class="rows${compact ? " compact" : ""}${bounded}" data-sec="${esc(s.id)}">` +
        s.events.map((e) => this._row(e, now, seen ? !seen.has(e.key) : false, compact)).join("") +
        `</div>`;
      /* Two different overflows, reported where each happened: the section's
       * own under the section, the global one at the end of the card. */
      const capped = s.over
        ? `<div class="more">+${s.over} more${s.scrollTo ? "" : ""}</div>`
        : "";
      const tail = capped + (overflow && i === last ? more : "");
      return split ? `<div class="card">${head}${rows}${tail}</div>` : head + rows;
    });

    /* Scroll offsets survive the repaint.
     *
     * The card rebuilds its markup whenever the model changes, and in a house
     * this size something changes every few seconds. Without this, scrolling a
     * section to read the rest of it would last until the next unrelated state
     * change and then snap back - which is worse than not scrolling at all. */
    const offsets = new Map();
    for (const el of this._root.querySelectorAll(".rows[data-sec]")) {
      if (el.scrollTop) offsets.set(el.dataset.sec, el.scrollTop);
    }

    this._root.innerHTML = split
      ? blocks.join("")
      : `<div class="card joined">${blocks.join("")}${more}</div>`;

    for (const el of this._root.querySelectorAll(".rows[data-sec]")) {
      const y = offsets.get(el.dataset.sec);
      if (y) el.scrollTop = y;
    }
    this._prevKeys = keys;
  }

  /* Escapes the detail line, then re-promotes the one glyph in it that is doing
   * semantic work. Wrapping happens after escaping, never before, so the span
   * is the only markup that can reach the DOM from a value the house supplied.
   * The arrow survives escaping unchanged and escaping cannot produce one, so
   * there is no way for a device name to smuggle a tag in here. */
  _detailHtml(text) {
    const out = esc(text);
    const arrow = esc(this._config.sources.climate.arrow || "→");
    if (!arrow || out.indexOf(arrow) === -1) return out;
    return out.split(arrow).join(`<span class="arw">${arrow}</span>`);
  }

  _row(e, now, isNew, compact) {
    const time = e.at ? fmtRelative(e.at, e.mode, now) : "";
    const tone = e.tone ? ` tone-${e.tone}` : "";
    const fresh = isNew ? " is-new" : "";
    const tabbable = e.entity ? ` tabindex="0" role="button"` : "";
    /* In compact mode the second line folds into the first as a dim suffix.
     * The right column keeps both slots so the times stay in one column
     * whichever density is in use. */
    const left = compact
      ? `<div class="tx"><div class="t">${esc(e.title)}` +
        (e.sub ? `<span class="sfx">${this._detailHtml(e.sub)}</span>` : "") +
        `</div></div>`
      : `<div class="tx"><div class="t">${esc(e.title)}</div>` +
        (e.sub ? `<div class="s">${this._detailHtml(e.sub)}</div>` : "") +
        `</div>`;

    return (
      `<div class="ev sev-${e.severity}${tone}${fresh}" data-entity="${esc(e.entity)}"${tabbable}>` +
      `<ha-icon class="ic" icon="${esc(e.icon)}"></ha-icon>` +
      left +
      `<div class="rt">` +
      (e.status ? `<div class="st">${esc(e.status)}</div>` : "") +
      (e.at
        ? `<div class="tm" data-at="${e.at}" data-mode="${e.mode}">${esc(time)}</div>`
        : "") +
      `</div></div>`
    );
  }

  /* Relative times go stale on their own schedule, with no state change to
   * trigger a render. Rewriting the handful of time cells is far cheaper than
   * rebuilding the list, and it leaves focus and hover state alone.
   *
   * The model is rebuilt first, because several rules are answers to the clock
   * rather than to any entity: a `after`/`before` window opening, a calendar
   * entry crossing `within_hours`, a light passing `min_minutes`. Without this
   * they would only take effect the next time some unrelated entity in the
   * house happened to change. _render's signature check makes the common case
   * - nothing moved - cost one model build and no DOM work. */
  _tick() {
    if (!this._root) return;
    if (this._hass && this._config) this._render();
    const now = Date.now();
    const cells = this._root.querySelectorAll(".tm");
    for (const cell of cells) {
      const at = Number(cell.dataset.at);
      if (!isFinite(at)) continue;
      const next = fmtRelative(at, cell.dataset.mode, now);
      if (cell.textContent !== next) cell.textContent = next;
    }
  }

  static getStubConfig() {
    return { type: "custom:home-event-card" };
  }
}

/* --------------------------------------------------------------- styles */

const STYLES = `
:host { display: block; }

/* One surface per section. The 8px gap is the format break: it separates
   groups more reliably than a hairline, and it is the same rhythm
   home-utility-card uses between its blocks. */
.root { display: flex; flex-direction: column; gap: 8px; }
.card {
  background: var(--ha-card-background, var(--card-background-color));
  border-radius: var(--ha-card-border-radius, 16px);
  padding: 12px 14px;
  display: flex; flex-direction: column;
  box-sizing: border-box;
}

/* Section eyebrow. Same treatment as home-utility-card's band label, so the
   two cards read as one family: uppercase, letter-spaced, secondary. The count
   sits right so the label edge stays flush down the card. */
.sec {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
  padding: 0 0 7px;
}

/* split_sections: false — every section shares one surface, so the break has
   to be drawn rather than left as a gap. This is the layout group_by: area
   wants, where eight rooms would otherwise mean eight small cards. */
.card.joined .rows + .sec {
  border-top: 1px solid var(--divider-color, rgba(255,255,255,.06));
  margin-top: 9px;
  padding-top: 11px;
}
.sec .lab {
  font-size: var(--ha-font-size-xs, 10px);
  line-height: var(--ha-line-height-condensed, 1.2);
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--secondary-text-color);
  font-weight: var(--ha-font-weight-medium, 500);
}
.sec .cnt {
  font-size: var(--ha-font-size-xs, 10px);
  color: var(--disabled-text-color);
  font-variant-numeric: tabular-nums;
}

/* 3px, not 1px. At one pixel the two-line rows read as a single block of text
   and the eye had to use the icons to find the row boundaries. */
.rows { display: flex; flex-direction: column; gap: 3px; }

/* A bounded section.
   Height comes from a row count rather than a pixel value, so the limit means
   the same thing at either density: --max rows, plus .45 of one more so the
   next row is half-visible. That sliver is the scroll affordance - it says
   "there is more here" without a label, and it reads from across a room where
   a scrollbar does not.
   The row metrics below have to track .ev: 6px padding either side, plus the
   line boxes of the title and the detail line. */
.rows.scroll {
  --row-h: 45px;
  --row-gap: 3px;
  max-height: calc((var(--max) + .45) * (var(--row-h) + var(--row-gap)));
  overflow-y: auto;
  /* A glance panel must not steal the page scroll when a section runs out. */
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--divider-color, rgba(255,255,255,.14)) transparent;
}
.rows.compact.scroll { --row-h: 29px; }
.rows.scroll::-webkit-scrollbar { width: 4px; }
.rows.scroll::-webkit-scrollbar-track { background: transparent; }
.rows.scroll::-webkit-scrollbar-thumb {
  background: var(--divider-color, rgba(255,255,255,.14));
  border-radius: 2px;
}

/* The four-quadrant row: icon | title over detail | status over time. */
.ev {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 6px 6px;
  margin-inline: -6px;
  border-radius: 9px;
  transition: background-color .15s ease;
}
.ev .ic {
  --mdc-icon-size: 22px;
  width: 22px; height: 22px;
  color: var(--secondary-text-color);
}
/* Every text cell states its own line-height.
 *
 * Without this they inherit --ha-line-height-normal, which is 1.6 - correct for
 * prose, and wrong for a two-line data row: it added ~11px of leading per row
 * and pushed the row box from 44px to about 55px, so the list ran a third
 * longer than it needed to for no extra information. --ha-line-height-condensed
 * (1.2) is the token HA provides for exactly this, and using it rather than a
 * bare number keeps the row on the scale if the theme ever retunes it. */
.tx { min-width: 0; }
.tx .t {
  font-size: var(--ha-font-size-m, 14px);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--primary-text-color);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tx .s {
  font-size: var(--ha-font-size-s, 12px);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--secondary-text-color);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
}
/* Compact rows carry the detail as a dim suffix rather than a second line. */
.tx .sfx {
  font-size: var(--ha-font-size-s, 12px);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--secondary-text-color);
  margin-left: 7px;
}

/* The arrow is the only glyph on this card doing semantic work - it says
   "moving toward" - and at 12px in secondary grey it read as a hyphen from
   across a room.
   
   Contrast and size carry it; weight does not. Bumping the weight made the
   glyph read as bolder *text* sitting inside a line that is not bold, which is
   a different defect from the one it fixed. The colour lift alone is a big
   step against the secondary grey around it, and the size bump restores the
   arrowhead without touching the stroke of the surrounding numbers. */
.arw {
  color: var(--primary-text-color);
  font-size: 1.2em;
  line-height: 1;
  padding: 0 3px;
}

.rt {
  text-align: right;
  flex: none;
  font-variant-numeric: tabular-nums;
}
.rt .st {
  font-size: var(--ha-font-size-s, 12px);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--primary-text-color);
  white-space: nowrap;
}
.rt .tm {
  font-size: var(--ha-font-size-s, 12px);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--secondary-text-color);
  white-space: nowrap;
  margin-top: 1px;
}

/* ---- severity ----
   Colour carries urgency and nothing else. The icon takes the hue; only alert
   tints its whole row, because that is the one state that should break the
   scan rather than reward it. */
.sev-active .ic    { color: var(--success-color, var(--green-color, #5cb87f)); }
.sev-attention .ic { color: var(--warning-color, var(--amber-color, #d8a24e)); }
.sev-attention .st { color: var(--warning-color, var(--amber-color, #d8a24e)); }
.sev-alert .ic     { color: var(--error-color, var(--red-color, #d8574a)); }
.sev-alert .st     { color: var(--error-color, var(--red-color, #d8574a)); }
.sev-alert {
  background: color-mix(in srgb, var(--error-color, var(--red-color, #d8574a)) 9%, transparent);
}
.sev-info .ic      { color: var(--secondary-text-color); }

/* Climate is the single domain that keeps a colour of its own: heat and cold
   are not degrees of urgency, and reading "Cooling" to find out which way the
   house is going defeats the point of a glance panel. */
.tone-heat .ic { color: var(--state-climate-heat-color, var(--amber-color, #d8a24e)); }
.tone-cool .ic { color: var(--state-climate-cool-color, var(--blue-color, #5f9ede)); }

.empty {
  font-size: var(--ha-font-size-s, 12px);
  color: var(--secondary-text-color);
  padding: 6px 0;
}
.more {
  font-size: var(--ha-font-size-s, 12px);
  color: var(--disabled-text-color);
  padding: 8px 0 0;
}

[data-entity]:not([data-entity=""]) { cursor: pointer; }
[data-entity]:not([data-entity=""]):hover {
  background-color: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
}
[data-entity]:not([data-entity=""]):active {
  background-color: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
}
[data-entity]:not([data-entity=""]):focus { outline: none; }
[data-entity]:not([data-entity=""]):focus-visible {
  outline: 2px solid var(--accent-color, var(--amber-color, #d8a24e));
  outline-offset: 1px;
}

/* ---- motion ----
   The house rule from the sibling cards holds: motion is functional only, and
   nothing animates on its own. A glance panel that is never still teaches the
   eye to stop reading it.

   That leaves exactly one thing worth animating - arrival. On a card whose
   whole job is "what changed", a row appearing is the event, and a list that
   silently reflows makes you re-read it to find out what moved. 180ms of fade
   and a 5px rise is enough to catch the eye without asking it to wait.

   Departure is deliberately not animated: it needs keyed DOM reconciliation to
   hold a row alive past its own removal, and the payoff is far smaller - the
   row is gone, which is itself the message. */
.ev.is-new { animation: ev-in 180ms cubic-bezier(.2, 0, .2, 1) both; }
@keyframes ev-in {
  from { opacity: 0; transform: translate3d(0, -5px, 0); }
  to   { opacity: 1; transform: none; }
}

.root.no-anim .ev { transition: none; }
.root.no-anim .ev.is-new { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .ev { transition: none; }
  .ev.is-new { animation: none; }
}
`;

if (!customElements.get("home-event-card")) {
  customElements.define("home-event-card", HomeEventCard);

  /* Deliberate load marker, same reasoning as the sibling cards: HA hides the
   * "custom element doesn't exist" error for 2s while waiting for
   * registration, so a module that never ran looks identical to one that
   * failed at runtime. No line here means the module never executed. */
  console.info(
    `%c home-event-card %c loaded (build ${CARD_BUILD}) `,
    "background:#d8a24e;color:#0f0f10;font-weight:600",
    "background:#161618;color:#f0f0f1"
  );
  window.__homeEventCard = { build: CARD_BUILD, loadedAt: new Date().toISOString() };

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "home-event-card",
    name: "Home Event Card",
    description: "What the house is doing right now, grouped and self-discovering.",
    preview: false,
  });
}
