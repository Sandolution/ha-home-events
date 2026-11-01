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
* One idea: an event
 *
 * An event is a name, what it covers, when it applies, and how the row reads.
 * There is nothing else - no second block for the entities a filter cannot
 * find, no third for the ones that need their own wording.
 *
 *     events:
 *       lights:
 *         category: lights
 *         group: area                 # one row per room, with a count
 *         include:
 *           domains: [light]
 *         conditions:
 *           - condition: state
 *             state: "on"
 *             for: "00:01:00"
 *         status:
 *           one: 1 light on
 *           many: "{n} lights on"
 *
 *       dryer_done:
 *         category: appliances
 *         include: {entities: [sensor.laundry_room_dryer_state]}
 *         conditions: [{condition: state, state: Done}]
 *         title: Dryer
 *         status: "{state}"
 *         severity: attention
 *         time_mode: ago
 *
 * This replaced `sources` and `custom`, which were the same idea written twice
 * - one filtered and let the domain render, the other named an entity and
 * spelled the row out - with 29 options between them and no rule for which to
 * reach for. Six of those options existed only because a source could not
 * express a state test: `resting`, `min_minutes`, `show_idle`,
 * `include_paused`, `show_armed`, `show_disarmed`. They are conditions now, in
 * core's vocabulary rather than this card's, and `min_minutes` in particular is
 * just `for:`.
 *
 * `severity` and `time_mode` take one of a fixed set of words rather than a
 * mapping from state. A dryer that is amber when finished and red with its
 * door open is two events with different conditions, because that is what it
 * is: two different things happening to the same appliance. The mapping hid
 * the line between them. `time_mode` does take one word per kind of row, like
 * the wordings do - a group of timers counting down to its last end can want
 * saying differently from the timers inside it.
 *
 * ---------------------------------------------------------------------------
 * What the card still knows, and what it does not
 *
 * It knows how to *render* seven Home Assistant domains - light, climate,
 * timer, media_player, cover, vacuum, alarm_control_panel. A thermostat gets
 * its two temperatures, a cover stopped part-way gets a percentage, a timer
 * counts down, and every state that core translates arrives in your language.
 * That is knowledge about Home Assistant and true in any installation, so it
 * costs nothing and is there whether you ask or not. Any other domain renders
 * plainly: name, area, state, how long.
 *
 * It does not know which of them you want, in what state, or under what
 * heading. An empty config draws an empty card, on purpose - and an event with
 * no `conditions` shows everything its `include` matches, in every state,
 * because deciding otherwise would be the card guessing again.
 *
 * The one exception is `unavailable` and `unknown`, which stay hidden unless a
 * condition names one. Anything else would put the same two lines of
 * boilerplate on every event anybody ever writes.
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
 * An event may say otherwise with `icon_color`, which colours its icon and
 * nothing else - the status word and an alert's tinted row still answer to
 * severity, because those are the scan this list is for. It is a way of
 * telling two quiet events apart, not a second severity scale.
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
 * Full reference: home-event-card.md, beside this file.
 *
 * Two places, and the line between them is the point: the library says what
 * the house is watching, and the card says how that library reads on this
 * dashboard. Everything about events - what they cover, when they apply, how
 * their rows word themselves - lives in the Home Events integration and is
 * edited in its panel. What is left here is a view.
 *
 *   type: custom:home-event-card       (required, and sufficient)
 *
 *   group_by:        category | area | severity | none   default category
 *   sort:            recent | duration | name. Overrides whatever the library
 *                    says; leave it out to follow the library
 *   max:             integer, default 14 — how many rows the card draws in
 *                    total. Shared out rather than sliced: every section keeps
 *                    at least one row and the biggest give theirs up first, so
 *                    a long list cannot push the others off the card. What a
 *                    section left out is counted under it
 *   max_per_section: a hard limit for one section, applied before the budget
 *                    is shared. 0 leaves it to `max`
 *   hide_when_empty: bool, default false
 *
 * There is no pixel ceiling and nothing here scrolls. A scroll container
 * inside a page is where a touch gesture gets stuck, and the card was one.
 *   collapsible:     bool, default false — section headings fold their rows.
 *                    What is folded is a reading position, not a preference,
 *                    so it is not remembered across a reload
 *   promote_alerts:  a section id, or false, default "alerts" — anything red
 *                    is filed there rather than under its own section
 *   split_sections:  bool, default true — a card per section. Turn off for
 *                    `group_by: area`, which otherwise makes a card per room
 *   tidy_names:      bool, default false — a friendly name is drawn as Home
 *                    Assistant has it, and a row's location comes from the
 *                    area assigned in the registry. True restores the old
 *                    behaviour, where the first `|` segment was taken as the
 *                    room and the words in `text.strip` came off the end -
 *                    which is one house's filing scheme, not a fact, and is
 *                    why it is off. To shorten a name, say so per event:
 *                    `title: "{name|s/^[^|]+[|] //}"`
 *   text:            every string the card writes itself, for translating or
 *                    rewording. Any subset; the rest keep their defaults:
 *
 *                      text:
 *                        empty:     Nothing going on
 *                        elsewhere: Elsewhere
 *                        severities: {alert: …, attention: …, active: …}
 *                        climate:    {heating: Heating, idle: Idle, …}
 *                        status:     {running: …, open_pct: "{n}% open"}
 *                        time:       {minute: "{n}m", remaining: "{n} left"}
 *                        strip:      {timer: [Timer], climate: [Heating, …]}
 *
 *                    Entity names, area names and media/cover/vacuum states
 *                    are not in here - Home Assistant already knows those in
 *                    the user's language.
 *
 * `events`, `categories`, `include`, `exclude`, `conditions` and `non_areas`
 * were card options once. They are the library's now. `preset` named which
 * library to draw, and there is one. A card that still carries any of them
 * says so rather than ignoring it.
 *
 * ---------------------------------------------------------------------------
 * The library
 *
 * One library in .storage, written by the Home Events integration and read by
 * every card that draws from it:
 *
 *     sort:        the default order for rows in a section
 *     non_areas:   registry areas that are filing cabinets rather than places,
 *                  by id or name. An entity in one is shown without a location
 *                  rather than claiming to be somewhere called "System"
 *     categories:  the sections, in order, and their headings. An id an event
 *                  names that is not in here is created and appended, so this
 *                  arranges sections rather than registering them. A section
 *                  may say how its own rows are ordered:
 *
 *                    categories:
 *                      - id: alerts
 *                        label: Needs attention
 *                      - id: appliances
 *                        label: Appliances
 *                        sort: recent
 *
 *     events:      the whole of what the card shows. A name of your choosing,
 *                  an `include` saying what it covers, and how its rows read:
 *
 *                    events:
 *                      pumps:
 *                        category: pumps
 *                        include:
 *                          entity_globs: ["switch.*_pump"]
 *
 * Every event takes:
 *
 *     enabled       false to switch it off without deleting it
 *     category      the section it feeds; created if undeclared
 *     group         area collapses its rows into one per room, with a count;
 *                   all collapses them into a single row. `true` means area
 *     include       required - see the filters below
 *     exclude
 *     conditions    when it applies - see below. Nothing is implicit: without
 *                   any, every entity the include matches shows, in any state
 *     severity      alert | attention | active | info. One word. Two meanings
 *                   is two events
 *     time_mode     since | until | ago | remaining. One word, or one per kind
 *                   of row when the event groups
 *     show_time     false drops the time column
 *     title         template; defaults to what the domain decided
 *     detail        template for the bottom-left slot, usually the location
 *     status        template for the state word, top right
 *     icon          overrides the entity's own, and the one Home Assistant
 *                   would have resolved for it - see _stateIcon
 *     icon_color    what the icon is coloured, instead of what its severity
 *                   would have coloured it. One of the card's own six -
 *                   alert, attention, active, info, heat, cool - a Home
 *                   Assistant palette name, or CSS. See ICON_COLORS
 *
 * ---------------------------------------------------------------------------
 * Filters
 *
 * Recorder's two keys plus the four a service call targets, which between
 * them is every way core lets you name a set of things:
 *
 *     exclude:
 *       domains:      [automation, update]
 *       entity_globs: ["sensor.sun*", "weather.*"]
 *       entities:     [sensor.date]
 *       devices:      ["Kitchen | Dishwasher"]
 *       areas:        [Garden]
 *       floors:       [Second Floor]
 *       labels:       [Battery]
 *
 * Name more than one dimension and the block must say how they combine -
 * there is no honest default:
 *
 *     include:
 *       match: all        # every one of them must hold
 *       domains: [light]
 *       floors: [first_floor, second_floor]
 *
 * `match: all` is the intersection - lights upstairs. `match: any` is the
 * union, which is what recorder does: every light in the house *and*
 * everything upstairs. On this install those are 19 entities and 387. A block
 * naming one dimension does not need it.
 *
 * A bare list is shorthand for `entity_globs`. Globs are anchored:
 * `sensor.sun*` does not match binary_sensor.sunroom. Everything else is
 * matched on a slug of the id and of the display name both, which stop being
 * the same string the first time somebody renames one. Labels and areas count
 * whether they sit on the entity, its device or its area - the same expansion
 * a service target does.
 *
 * Precedence is a specificity ladder - entities (7), entity_globs (6),
 * devices (5), labels (4), areas (3), floors (2), domains (1). Narrower beats
 * broader and exclude wins a tie, so `exclude: {domains: [switch]}` with
 * `include: {entities: [switch.pond_pump]}` keeps the pump and drops the other
 * 139, and an area exclude carves a room out of a floor include. If an
 * `include` is given and nothing in it matches, the entity is out - which
 * means an area- or floor-based include drops everything with no area, timers
 * among them.
 *
 * ---------------------------------------------------------------------------
 * Wording
 *
 * `title`, `detail` and `status` are templates, not fixed strings:
 *
 *     {state}       humanised; {state.raw} is not
 *     {attr.foo}    an attribute, and {attr.foo@other.entity} another entity's
 *     {name}        the friendly name, tidied - see `tidy_names`. The whole
 *                   name when that is off
 *     {area}        where it is
 *     {n}           how many landed in this row - grouped events only
 *
 * Any of them takes a replace, for names written for the state machine rather
 * than for a person - "Laundry Room | Dryer | State" and its kind:
 *
 *     title: "{name|s/ [|] State$//}"
 *     status: "{attr.program|s/^p_//}"
 *
 * A literal pipe is written [|], not \| . Bare it means alternation, and
 * escaped it is one stray backslash away from "a backslash, or nothing" -
 * which matches the empty side and eats the next character with no error.
 * In a character class it can only be a pipe.
 *
 * One replace per placeholder, JavaScript's own regular expressions and its
 * own flags, $1 in the replacement. Deliberately no branching: a row that
 * needs an `if` is a template sensor, which can be tested in the template
 * editor and reused somewhere else.
 *
 * Grouping makes three kinds of row, and they are read in three places, so
 * `title`, `detail`, `status`, `icon`, `icon_color` and `time_mode` take a
 * mapping - and only when the event groups, since ungrouped every row it draws
 * is a single thing:
 *
 *     one    a row standing for a single entity, on its own: an event that is
 *            not grouping, or a group that turned out to hold one thing
 *     each   a row inside a group that has been opened, read underneath the
 *            group's own row. Falls back to `one` when it is not written
 *     many   the group's own row, which counts rather than names
 *
 *     lights:
 *       group: area
 *       include: {domains: [light]}
 *       conditions: [{condition: state, state: "on"}]
 *       status:
 *         one: 1 light on
 *         many: "{n} lights on"
 *
 * A room group says the room on its title line, which is why its detail line
 * is empty unless something is written there: repeating the room underneath
 * itself is not a second fact. Give the group a `title` of its own and the
 * room moves down to the detail line rather than disappearing.
 *
 * The three are what lets a name suit where it is read. `title: {one:
 * Ventilation, each: "{area}", many: Ventilation}` puts Ventilation on a lone
 * row and on the group, and Bath Room, Kitchen, Toilet inside it - where the
 * row above has already said what they are. An empty half is not a wording -
 * a text box nobody filled in means nothing was written, not write nothing -
 * and a detail line equal to the title above it is dropped.
 *
 * ---------------------------------------------------------------------------
 * Conditions
 *
 * Home Assistant's condition vocabulary, AND-ed. Where include/exclude choose
 * *which* entities, these choose *when* - and a condition with no `entity:` of
 * its own is about the entity in hand, which is what makes a threshold work
 * across a whole event:
 *
 *     batteries:
 *       category: alerts
 *       severity: attention
 *       include:
 *         labels: [Battery]
 *       conditions:
 *         - condition: numeric_state
 *           below: 20         # every battery under 20%, one block
 *
 * The kinds, spelled as core spells them:
 *
 *     numeric_state   entity / attribute / above / below. Strictly above and
 *                     strictly below, so both together means *between*. A
 *                     bound may be a number or the id of an entity holding
 *                     one, so a limit can live in an input_number. A value
 *                     that is not a number - unavailable, a word, a missing
 *                     attribute - satisfies neither bound.
 *     state           entity / state / state_not, as Lovelace card visibility
 *     time            after / before / weekday; the window wraps midnight
 *     and / or / not  nested `conditions:`. `not` passes when none of them do,
 *                     which is how core defines it. This is what a two-sided
 *                     check needs: pressure below 0.8 *or* above 2.5 is not an
 *                     AND list, and numeric_state with both bounds means the
 *                     band rather than outside it:
 *
 *                       - condition: or
 *                         conditions:
 *                           - {condition: numeric_state, below: 0.8}
 *                           - {condition: numeric_state, above: 2.5}
 *
 * A row that groups opens rather than firing more-info: it shows what it
 * counted, underneath itself, indented under the title.
 */

const CARD_BUILD = "2026-10-30a";

/* ------------------------------------------------------------------ config */

const SEVERITY_RANK = { alert: 0, attention: 1, active: 2, info: 3 };

/* Alarm panels. Every other state - the armed_* family - is informational.
 * The words come from core, which translates all of them; only the weight is
 * ours to decide. */
/* Only a panel that has gone off is asking anything of anyone. Arming and
 * pending are transient and worth noticing; disarmed and armed are states the
 * house is simply in, and colouring "disarmed" amber all day is how a palette
 * stops meaning anything. */
const ALARM_SEVERITY = {
  triggered: "alert",
  pending: "attention",
  arming: "attention",
};

/* Where a row goes when nothing said where it should go. Auto-created like
 * any other undeclared category, so it costs nothing until something lands in
 * it. */
const GENERIC_CATEGORY = "generic";

/* An event: a name, what it covers, when it applies, and how the row reads.
 * See the doc block at the top for why this is the only such list. */
const EVENT_KEYS = [
  "enabled", "category", "group", "include", "exclude", "conditions",
  "severity", "time_mode", "show_time", "title", "detail", "status", "icon",
  "icon_color", "color", "tint",
];

/* Slots a grouped event may word two ways, because a row that counts has to
 * say "1 light on" and "3 lights on". The only mapping left in the schema, and
 * only here: everything else that used to take one - severity, time_mode -
 * means writing a second event with its own conditions, which is what those
 * mappings were always describing. */
/* The options that take a wording per kind of row, rather than one value for
 * every row the event draws. See `wording()`. */
const PLURAL_KEYS = ["title", "detail", "status", "icon", "icon_color",
                     "color", "time_mode"];
/* The two options that take a colour. `icon_color` paints the icon and
 * nothing else; `color` is the row's accent - icon, status word and tint -
 * standing in for what its severity would have painted. Same values, same
 * table, same check. */
const COLOUR_KEYS = ["icon_color", "color"];
const WORDING_KEYS = ["one", "each", "many"];

/* How a grouping event collapses its rows.
 *
 *   area   one row per room - "3 lights on" under "Kitchen"
 *   all    one row for the lot - "2 playing" under whatever you title it
 *   false  no grouping
 *
 * `area` was the only behaviour and was never written down anywhere, which is
 * the sort of thing this card keeps finding in itself. It suits lights, where
 * the room is the subject of the sentence. It suits media much less: speakers
 * playing in three rooms is one fact about the house, and three rows saying
 * "1 playing" is the aggregation not aggregating. */
const GROUP_MODES = [false, true, "area", "all"];

function groupMode(cfg) {
  if (cfg.group === true) return "area"; // the old spelling
  return cfg.group === "area" || cfg.group === "all" ? cfg.group : null;
}

/* Which renderer an entity gets. Domain knowledge, not configuration: a cover
 * at 40% and a thermostat at 19 -> 21 need different sentences, and that is
 * true in every installation. Anything not named here renders plainly. */
const RENDERERS = {
  light: "_renderLight",
  climate: "_renderClimate",
  timer: "_renderTimer",
  media_player: "_renderMedia",
  cover: "_renderCover",
  vacuum: "_renderVacuum",
  alarm_control_panel: "_renderAlarm",
};

/* How long a press has to last to be a hold, and how far a finger may travel
 * while it does. Home Assistant's own tap/hold split is half a second, so a
 * row here answers to the same press as a row anywhere else. */
const HOLD_MS = 500;
const HOLD_SLOP = 10;

const SEVERITIES = ["alert", "attention", "active", "info"];
const TIME_MODES = ["since", "until", "ago", "remaining"];

/* ---- icon colour ----
 *
 * What an icon is coloured is decided for it: by severity, and for climate by
 * which way the house is going (see the severity block in the header, and the
 * `.sev-*` and `.tone-*` rules in STYLES). Those six are the colours the card
 * hands out by itself, and they are the six named first here - `icon_color:
 * active` is the green a running washer already wears, said out loud, so an
 * event that wants that green without claiming that urgency can ask for it.
 *
 * After them Home Assistant's own palette, spelled the way the tile card
 * spells it - deep-purple, blue-grey - so a colour chosen here is the colour
 * chosen anywhere else on the dashboard, and follows the theme rather than
 * being frozen at whatever it looked like the day it was written.
 *
 * A theme that defines none of these leaves the icon the colour it already
 * was: an undefined var() invalidates the declaration and the row's own
 * colour stands, which is the way for this to fail.
 */
const ICON_COLORS = {
  alert: "var(--error-color, var(--red-color, #d8574a))",
  attention: "var(--warning-color, var(--amber-color, #d8a24e))",
  active: "var(--success-color, var(--green-color, #5cb87f))",
  info: "var(--secondary-text-color)",
  heat: "var(--state-climate-heat-color, var(--amber-color, #d8a24e))",
  cool: "var(--state-climate-cool-color, var(--blue-color, #5f9ede))",
};
/* home-events-panel.js: PALETTE, and schema.py: PALETTE. */
const PALETTE = [
  "primary", "accent", "disabled",
  "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue",
  "cyan", "teal", "green", "light-green", "lime", "yellow", "amber", "orange",
  "deep-orange", "brown", "light-grey", "grey", "dark-grey", "blue-grey",
  "black", "white",
];
for (const hue of PALETTE) ICON_COLORS[hue] = `var(--${hue}-color)`;

/* Anything that is not one of those names has to look like a colour before it
 * is written into a style attribute - not politeness, arithmetic: the value
 * lands inside `style="..."`, where a semicolon starts a second declaration
 * nobody asked for. Hex, the colour functions, and var(). A bare word is not
 * accepted: CSS has 148 of them, and a typo among them is a colour that
 * silently does nothing, which is the one outcome worth refusing outright. */
const CSS_COLOR =
  /^(#[0-9a-f]{3,8}|(?:rgba?|hsla?|color-mix|var)\([^;{}<>"'\\]*\))$/i;

/* One written colour as CSS, or null when it is not one. Names are matched
 * loosely - case, spaces and underscores are how a person writes deep_purple
 * for deep-purple, and refusing that would be refusing a spelling rather than
 * a mistake. */
function iconColorCss(value) {
  if (typeof value !== "string") return null;
  const written = value.trim();
  if (!written) return null;
  const named = ICON_COLORS[written.toLowerCase().replace(/[\s_]+/g, "-")];
  return named || (CSS_COLOR.test(written) ? written : null);
}

/* Every string the card writes itself, so the card can be translated or
 * reworded without touching the code.
 *
 * What is deliberately *not* in here is anything Home Assistant can already
 * say: entity names, area names, zone names, and the states of media players,
 * covers and vacuums, which core translates into the user's language. Those go
 * through hass.formatEntityState (see stateLabel) and shipping an English word
 * for them would be a downgrade, not a feature. What remains is the vocabulary
 * this card invented - its headings, its counts, and its sense of time.
 *
 * `{n}` is the only placeholder, and only where noted. */
const DEFAULT_TEXT = {
  /* Section headings for group_by: severity. */
  severities: {
    alert: "Needs attention",
    attention: "Finished",
    active: "Running",
    info: "Also happening",
  },
  /* Climate, keyed by hvac_action first and hvac mode second. `null` asks Home
   * Assistant, which has both vocabularies and words hvac_action exactly as
   * this card used to - plus defrosting, preheating and off, which it did not.
   * Set a key to override. */
  climate: {
    heating: null,
    cooling: null,
    drying: null,
    fan: null,
    idle: null,
    defrosting: null,
    preheating: null,
    off: null,
    heat: null,
    cool: null,
    dry: null,
    fan_only: null,
    heat_cool: null,
    auto: null,
  },
  /* The right-hand state word, where the card supplies it rather than core. */
  status: {
    running: "Running",
    open: "Open",
    open_pct: "{n}% open", // a cover stopped part-way
    brightness: "{n}%",    // a lamp that can be dimmed
  },
  /* Words that carry the direction of a duration. Without them a bare
   * "1h 12m" does not say which way it points, and the washer and the
   * dishwasher read identically while meaning opposite things. */
  time: {
    just_now: "just now",
    just_started: "Just started",
    any_moment: "any moment",
    minute: "{n}m",
    hour: "{n}h",
    day: "{n}d",
    for: "For {n}", // since: something still running
    ago: "{n} ago", // ago: something that finished
    in: "in {n}", // until: something not started yet
    remaining: "{n} remaining", // remaining: a countdown in progress
  },
  /* Boilerplate stripped off a friendly name so the row shows the thing rather
   * than its category. English because the entity names are; a Dutch install
   * would put its own words here. */
  strip: {
    timer: ["Timer"],
    climate: ["Heating", "Thermostat", "Climate", "Room", "TRV"],
    media: ["Media Player"],
  },
  degree: "°",
  /* Between a thermostat's current and target temperature. It reads as "moving
   * toward" rather than the ">" the old templates used, which was actively
   * wrong when cooling from 25.5 to 18. Swappable because legibility depends on
   * the screen it lands on: "\u2192" is thin in some faces at 12px, and a wall
   * tablet is read from across a room. "\u00bb", "\u25b8" or plain "to" all work. */
  arrow: "\u2192",
  elsewhere: "Elsewhere", // an event with no area
  empty: "Nothing going on",
  /* On a group row that has an entity behind it: the one place a second
     gesture can announce itself, since a hold leaves no mark on a screen. */
  hold: "Hold for this group's own controls",
  more: "+{n} more", // what a section had to leave out, and the way to see it
  less: "Show fewer", // and the way back
};

const DEFAULTS = {
  /* category | area | severity | none */
  group_by: "category",
  /* recent | duration | name — see _sortEvents */
  sort: "recent",
  /* How many rows the card draws, altogether.
   *
   * Spent rather than sliced: the sections share it, every one keeps at least
   * a row, and the biggest give up first - so the number is a size for the
   * card without being a way for one long section to push every other one off
   * it. What each section had to leave out is reported under it.
   *
   * This is the only ceiling there is. A pixel one would have to scroll to be
   * any use, and a scroll container inside a page is where a finger gets
   * stuck - see the stylesheet. */
  max: 14,
  /* A hard limit per section, applied before the budget is shared. 0 leaves
   * that to `max` alone, which is usually the better answer: this is for when
   * one particular list is worth exactly three rows to you and no more,
   * however quiet the rest of the house is. */
  max_per_section: 0,
  /* A card that vanishes leaves a hole in a sections layout, and a hole reads
   * as a broken card rather than as a quiet house. Off by default. */
  hide_when_empty: false,
  /* Section headings toggle their rows. Off by default: a heading that
   * swallows the list when a sleeve brushes the tablet is a worse card than
   * one that does not fold. */
  collapsible: false,
  /* Where alert-severity rows go instead of their own category: a group id,
   * or false to leave them where they landed. The section is created if you
   * have not declared it, like any other. `true` means "alerts" and is kept
   * for configs written before this took an id.
   *
   * Only applies to group_by: category - severity grouping already collects
   * them, and area grouping would be defeated by it. */
  promote_alerts: "alerts",
  /* One card per section, separated by a gap, rather than one card with rules
   * in it. True suits `group_by: category`, where four or five sections read
   * as a deliberate structure. Set it false for `group_by: area`, which can
   * produce eight rooms and therefore eight small surfaces. */
  split_sections: true,
  /* Whether the card may rewrite a friendly name before drawing it.
   *
   * Off, and it took an argument to get there. On, two things happen: the
   * first `|` segment is taken off the front, and the category words in
   * text.strip come off the end. Both were on by default for most of this
   * card's life, and both were wrong to be.
   *
   * "Bath Room | Ventilation | Timer" is one house's filing scheme. It is a
   * good one and the card was built against it, which is exactly how it came
   * to be assumed: a convention you can see out of your own window looks like
   * a fact. Somewhere else the first segment is a floor, or a manufacturer,
   * or the person the device belongs to, and the card would silently file
   * "Sonos" as a room. A card that guesses at somebody's naming and is wrong
   * has damaged the one string they wrote themselves.
   *
   * So the name is drawn as Home Assistant has it, and the row's location
   * comes from the area assigned in the registry - which is where a location
   * belongs, is the same answer for everyone, and is what core itself uses.
   *
   * Turning it on restores the old behaviour for a card that wants it. It is
   * kept because the convention is real where it is real; it is off because
   * the card cannot tell whether that is here. */
  tidy_names: false,
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

/* Keys a card used to take, and where each of them lives now. Kept as a map
 * rather than deleted outright: the answer to "where did my events go" has to
 * come from the card that stopped accepting them. */
const MOVED = {
  events: "every event lives in the Event Manager's library",
  categories: "sections are arranged in the Event Manager, under Sections",
  include: "each event has its own Include",
  exclude: "each event has its own Except",
  conditions: "each event has its own When",
  non_areas: "`non_areas` is a fact about the house, so it lives in the library",
  empty_text: "write `text: {empty: ...}`",
  preset: "there is one library and every card reads it, so there is nothing " +
    "to name",
  max_height: "a card that scrolls inside a page is a card a finger cannot " +
    "scroll past - use `max` to say how many rows you have room for",
  overflow: "there is one behaviour now: what does not fit is left out and " +
    "counted under its own section",
};

function mergeConfig(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k in over) {
    const b = base ? base[k] : undefined;
    const o = over[k];
    /* An emptied-out key.
     *
     *     events:
     *       lights:
     *
     * is `lights: null` once YAML is done with it, and it means "I deleted
     * what was in here", not "delete the section". Letting the null through
     * replaced a whole event config with nothing and the next read of
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

/* Home Assistant's own condition vocabulary, not a private one. `state` is the
 * shape Lovelace card visibility uses; `numeric_state`, `time` and the three
 * boolean ones are the shapes automations use. Naming them after what core
 * already calls them means a config read here transfers, and one written here
 * reads like the rest of the install.
 *
 * Keyed by type rather than pooled, so `condition: state` carrying an `above`
 * is caught as the mistake it is instead of being quietly ignored. */
const CONDITION_KEYS = {
  state: ["condition", "entity", "state", "state_not", "for"],
  numeric_state: ["condition", "entity", "attribute", "above", "below", "for"],
  time: ["condition", "after", "before", "weekday"],
  and: ["condition", "conditions"],
  or: ["condition", "conditions"],
  not: ["condition", "conditions"],
};
const CONDITION_TYPES = Object.keys(CONDITION_KEYS);

/* A state is a string and an attribute can be anything, so this is deliberately
 * narrow: Number("") is 0, Number(null) is 0, Number([]) is 0 and Number(true)
 * is 1, and every one of those would make a threshold silently true. Only a
 * real number or a string that is one counts. */
function toNumber(raw) {
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = Number(raw);
  return isFinite(n) ? n : null;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/* A duration -> milliseconds, in the three spellings core accepts:
 * "00:05:00", a mapping of hours/minutes/seconds, or a bare number of seconds.
 * parseClock below looks similar and is not reusable - it answers "which
 * minute of the day is this" and drops the seconds, which is right for a
 * window and wrong for a length. */
function parseDuration(value) {
  if (value == null) return null;
  if (typeof value === "number") return isFinite(value) ? value * 1000 : null;
  if (isPlainObject(value)) {
    let ms = 0;
    for (const [k, mult] of [["hours", 3600], ["minutes", 60], ["seconds", 1]]) {
      if (value[k] == null) continue;
      const n = toNumber(value[k]);
      if (n === null) return null;
      ms += n * mult * 1000;
    }
    return ms;
  }
  const m = String(value).trim().match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!m) {
    const n = toNumber(value);
    return n === null ? null : n * 1000;
  }
  return ((+m[1] * 60 + +m[2]) * 60 + (+m[3] || 0)) * 1000;
}

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

/* Which Home Assistant condition an untyped block is. The time keys are
 * unambiguous; anything else is a state test. */
function conditionKind(cond) {
  if (cond.conditions != null) return "and";
  if (cond.above != null || cond.below != null) return "numeric_state";
  if (cond.after != null || cond.before != null || cond.weekday != null) return "time";
  return "state";
}

/* Validation is recursive because and/or/not nest. `where` is carried down so
 * a bad key three levels in still says which entry it came from. */
function checkCondition(cond, where) {
  if (!isPlainObject(cond)) {
    throw new Error(`home-event-card: every condition in ${where} must be a mapping.`);
  }
  const kind = cond.condition || conditionKind(cond);
  if (CONDITION_TYPES.indexOf(kind) === -1) {
    throw new Error(
      `home-event-card: \`condition: ${kind}\` in ${where} is not supported. ` +
        `Use ${CONDITION_TYPES.join(", ")}.`
    );
  }
  checkKeys(CONDITION_KEYS[kind], cond, `${kind} condition in ${where}`);

  if (kind === "and" || kind === "or" || kind === "not") {
    if (!Array.isArray(cond.conditions) || !cond.conditions.length) {
      throw new Error(
        `home-event-card: \`condition: ${kind}\` in ${where} needs a non-empty ` +
          "`conditions:` list."
      );
    }
    for (const sub of cond.conditions) checkCondition(sub, where);
    return;
  }

  if (kind === "numeric_state" && cond.above == null && cond.below == null) {
    throw new Error(
      `home-event-card: a numeric_state condition in ${where} needs \`above\`, ` +
        "`below`, or both."
    );
  }
  if (kind === "state" && cond.state == null && cond.state_not == null) {
    throw new Error(
      `home-event-card: a state condition in ${where} needs \`state\` or ` +
        "`state_not`."
    );
  }
  if (cond["for"] != null && parseDuration(cond["for"]) === null) {
    throw new Error(
      `home-event-card: \`for: ${JSON.stringify(cond["for"])}\` in ${where} is ` +
        'not a duration. Use "HH:MM:SS", a number of seconds, or ' +
        "{hours, minutes, seconds}."
    );
  }
  if (kind === "time" && cond.after == null && cond.before == null &&
      cond.weekday == null) {
    throw new Error(
      `home-event-card: a time condition in ${where} needs \`after\`, ` +
        "`before` or `weekday`."
    );
  }
  for (const k of ["after", "before"]) {
    if (cond[k] != null && parseClock(cond[k]) === null) {
      throw new Error(
        `home-event-card: \`${k}: ${cond[k]}\` in ${where} is not a time. ` +
          'Use HH:MM or HH:MM:SS, e.g. "20:00".'
      );
    }
  }
  const days = cond.weekday == null
    ? []
    : Array.isArray(cond.weekday) ? cond.weekday : [cond.weekday];
  for (const d of days) {
    if (WEEKDAYS.indexOf(String(d).slice(0, 3).toLowerCase()) === -1) {
      throw new Error(
        `home-event-card: \`weekday: ${d}\` in ${where} is not a day. ` +
          `Use ${WEEKDAYS.join(", ")}.`
      );
    }
  }
}

function checkConditions(list, where) {
  if (list == null) return;
  if (!Array.isArray(list)) {
    throw new Error(`home-event-card: \`conditions\` in ${where} must be a list.`);
  }
  for (const cond of list) checkCondition(cond, where);
}

/* Levenshtein distance, capped at the only use it has here: telling someone
 * that `entity_glob` was probably meant to be `entity_globs`. A config error
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

/* Merge the user's subset of `text` over the defaults, one level of nesting
 * deep, reusing checkKeys so a typo is reported with the likely fix rather than
 * silently rendering the English default. */
function mergeText(base, given, where) {
  if (given == null) return { ...base };
  if (!isPlainObject(given)) {
    throw new Error(`home-event-card: ${where} must be a mapping.`);
  }
  checkKeys(Object.keys(base), given, where);
  const out = { ...base };
  for (const key of Object.keys(given)) {
    const b = base[key];
    const o = given[key];
    if (Array.isArray(b)) {
      out[key] = asList(o);
    } else if (isPlainObject(b)) {
      /* A block with nothing under it is emptied out in YAML, not a request
       * to erase what the card ships. */
      if (o != null) out[key] = mergeText(b, o, `${where}.${key}`);
    } else {
      out[key] = o;
    }
  }
  return out;
}

/* YAML makes a single value and a list of one look different; the card should
 * not. Used for the `strip` word lists. */
function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter((v) => v != null) : [value];
}

/* The one placeholder the text block supports. Kept to `{n}` deliberately: a
 * template language here would want escaping, and every string that needs a
 * value needs exactly one. */
function fill(template, n) {
  return String(template == null ? "" : template).replace(/\{n\}/g, n);
}

/* Turns a config block's include/exclude (and the *_areas shorthands) into the
 * compiled form the render path uses, in place. */
function compileFilters(block, where) {
  if (!isPlainObject(block)) return;
  block._include = normaliseFilter(block.include, `${where}include`);
  block._exclude = normaliseFilter(block.exclude, `${where}exclude`);
  block._needs = needsOf(block._include, block._exclude);
}

/* Ask Home Assistant for a state's wording before falling back to our own.
 *
 * media_player, cover and vacuum states are translated by core into the user's
 * language, including the ones this card never anticipated. Shipping "Playing"
 * as a literal would make the card English-only for no gain, so the literal is
 * only the fallback for a core too old to have the helper. */
/* An override, else Home Assistant's translation, else the fallback.
 *
 * hass.localize returns "" for a key it does not have rather than throwing, so
 * the truthiness check is the miss path and not an error path. */
function localized(hass, key, override, fallback) {
  if (override != null) return override;
  if (hass && typeof hass.localize === "function") {
    const s = hass.localize(key);
    if (s) return s;
  }
  return fallback;
}

/* hvac_action is an attribute and hvac mode is a state, and they live under
 * different translation keys. The card asks for whichever it is looking at. */
const CLIMATE_ACTION_KEY =
  "component.climate.entity_component._.state_attributes.hvac_action.state.";
const CLIMATE_MODE_KEY = "component.climate.entity_component._.state.";

/* The buzz a phone gives when a press turns into a hold. Home Assistant
 * listens for this on the window and decides whether the device does anything
 * with it - which is where that decision belongs, since it is a setting and a
 * platform question rather than this card's business. */
function haptic(kind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
}

function stateLabel(hass, stateObj, fallback) {
  if (hass && typeof hass.formatEntityState === "function") {
    try {
      const s = hass.formatEntityState(stateObj);
      if (s) return s;
    } catch (err) {
      /* fall through */
    }
  }
  return fallback != null ? fallback : humanise(stateObj && stateObj.state);
}

/* Excludes are matched as substrings of the entity id so one entry can name a
 * single entity (light.garden_border), a device family (_nightstands) or a
 * whole room (garden_). A regex would be more precise and far less usable. */
/* Areas are named, not matched: "Front Bedroom" must not be excluded by an
 * entry meaning "Back Bedroom". Compared on a slug so "Kitchen & Utility"
 * and kitchen_utility are the same answer. */
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

/* ------------------------------------------------------------------ filters
 *
 * recorder's two keys, plus the four registry ones a service call targets:
 *
 *     exclude:
 *       domains:      [automation, update]     # recorder
 *       entity_globs: ["sensor.sun*"]          # recorder
 *       entities:     [sensor.date]            # target
 *       devices:      ["Kitchen | Dishwasher"] # target
 *       areas:        [Garden]                 # target
 *       floors:       [Second Floor]           # target
 *       labels:       [Battery]                # target
 *
 * Between them that is every way core lets you name a set of things, so
 * anything selectable in an automation is selectable here. This is also the
 * only way anything selects entities - the top level and every source read the
 * same block, so "how do I choose what shows up" has one answer.
 *
 * ---------------------------------------------------------------------------
 * `match: any | all`, and why it is not optional
 *
 * Recorder ORs the keys of a filter block, and that is right when they are all
 * ways of naming an entity directly: "these domains, plus these globs, plus
 * this one id" is a union and reads as one. Areas, floors, labels and devices
 * put a second axis in the same block, and
 *
 *     include:
 *       domains: [light]
 *       floors: [first_floor]
 *
 * reads as an intersection to anyone who has ever written a sentence. As a
 * union it is every light in the house plus everything on that floor - 387
 * entities here, where 19 were wanted.
 *
 * Neither reading is wrong and core uses both: recorder unions its filter
 * block, while the entity selector intersects the options within one filter
 * entry and unions the entries. So the block says which it means, and has to
 * whenever more than one dimension is in play. Defaulting it would be the same
 * quiet assumption this card has spent its life removing.
 *
 * A bare list is shorthand for `entity_globs`, so `exclude: ["light.garden_*"]`
 * means what it looks like. There is no other shorthand: `exclude_areas` was
 * one before `areas` existed as a key, and two spellings of one idea is how a
 * configuration stops being readable.
 *
 * Everything but the two recorder keys is matched on a slug of what you wrote
 * against a slug of both the registry id and the display name, so `floors:
 * [Second Floor]` and `floors: [second_floor]` are the same instruction, and
 * a renamed floor keeps working under either spelling. Areas and floors are
 * separate keys for a reason: this house has an *area* called Ground Floor
 * sitting on a *floor* called Ground Floor, and they are not the same set.
 *
 * Absent on purpose: recorder's `event_types` filters the event bus and this
 * card only ever looks at states. Categories are not here either - the
 * frontend's entity collection carries labels but not categories
 * (config/entity_registry/list_for_display returns `lb` and no counterpart),
 * and core scopes categories to the automation, script and helper pages rather
 * than to entities at large, so filtering a dashboard by one would mean
 * pulling the whole registry down per card to sort things by which folder they
 * sit in on a config screen. Labels are the entity-level tag, and they are.
 *
 * ---------------------------------------------------------------------------
 * Precedence: exclude removes, and only an exact id survives it.
 *
 *     2  entities        an exact id, which is somebody naming this one thing
 *     1  everything else a pattern, a room, a floor, a label, a domain
 *
 * Exclude wins at the same level and below, so "every switch except the pond
 * pump" works - and so does everything else anybody writes an exclude for.
 *
 * This was a seven-rung ladder, one per dimension, on the reasoning that
 * narrower should beat broader: a room is more specific than a floor, a glob
 * more specific than a room. It reads well and it silently threw away whole
 * exclude blocks. An event including `entity_globs: ["*_group"]` and excluding
 * ten areas kept every one of them, because a glob sat two rungs above a room
 * and nothing said so - not the card, not the panel, not the count that
 * cheerfully reported twenty matches. An exclude that does nothing is worse
 * than an exclude that is refused.
 *
 * The one case worth keeping is the opposite of the pond pump: "not this room,
 * but that lamp in it". Naming an id is unambiguous in a way no pattern is -
 * the same reason a named group beats a swept-up one - so an id in `entities`
 * outranks an exclude that did not name it. `exclude: {entities: [x]}` against
 * `include: {entities: [x]}` is a tie, and ties go to exclude.
 *
 * If `include` is given at all and nothing in it matched, the entity is out. */
/* How the rows inside a section are ordered. Severity always comes first -
 * an alert is the row worth seeing, whatever the section says - and a
 * countdown always runs soonest-first, because "four minutes left" and "the
 * next calendar entry" are the same kind of fact. This decides the rest. */
const SORT_MODES = ["recent", "duration", "name"];

const FILTER_KEYS = [
  "domains", "floors", "areas", "labels", "devices", "entities", "entity_globs",
];

/* Two rungs, most specific first so the walk can stop at the first hit when
 * the block is a union. Only an exact id is above the line: everything else
 * describes a set somebody might not have had in mind entity by entity, which
 * is exactly when an exclude has to be able to take one out. */
const FILTER_RUNGS = [
  [2, "entities"],
  [1, "entity_globs"],
  [1, "devices"],
  [1, "labels"],
  [1, "areas"],
  [1, "floors"],
  [1, "domains"],
];

/* Keys of a filter block that are not dimensions. */
const FILTER_OPTS = ["match"];

/* The keys that need something looked up per entity rather than read off its
 * id, and therefore have to be paid for only when a config mentions them. */
const LOOKUP_KEYS = ["floors", "areas", "labels", "devices"];

/* hass carries the entity, device and area registries as collections. These
 * two it does not, so they are fetched - see _loadRegistry. `devices` needs no
 * entry here precisely because hass.devices already has the names. */
const REGISTRY_KINDS = [
  { key: "labels", ws: "config/label_registry/list", id: "label_id" },
  { key: "floors", ws: "config/floor_registry/list", id: "floor_id" },
];

/* One level of an icon dictionary: the state's own icon if the dictionary
 * names that state, the default otherwise. Deliberately the same two lines as
 * Home Assistant's own getIcon - this exists to agree with what the frontend
 * draws, and a second opinion about the same entity is worse than none. */
function iconFromEntry(entry, state) {
  if (!isPlainObject(entry)) return null;
  if (state && isPlainObject(entry.state) && entry.state[state]) {
    return entry.state[state];
  }
  return entry.default || null;
}

/* Globs, as recorder spells them: * is any run, ? is one character. Anchored,
 * so `sensor.sun*` does not match `binary_sensor.sunroom`. Compiled once at
 * setConfig rather than per entity per render - this runs against every state
 * in the house on every source. */
function globToRegExp(pattern) {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
}

function normaliseFilter(spec, where) {
  let out = null;
  if (Array.isArray(spec)) {
    out = { entity_globs: spec.slice() };
  } else if (isPlainObject(spec)) {
    checkKeys(FILTER_KEYS.concat(FILTER_OPTS), spec, where);
    out = {};
    for (const k of FILTER_KEYS) if (spec[k] != null) out[k] = asList(spec[k]);
    if (spec.match != null) {
      if (spec.match !== "any" && spec.match !== "all") {
        throw new Error(
          `home-event-card: \`match: ${spec.match}\` in ${where} must be any or all.`
        );
      }
      out._all = spec.match === "all";
    }
  } else if (spec != null) {
    throw new Error(
      `home-event-card: ${where} must be a list of entity globs, or a mapping ` +
        `with ${FILTER_KEYS.join(" / ")}.`
    );
  }
  /* An empty list is not a filter. `exclude: []` is what the generated
   * reference config writes for "nothing excluded here", and left as a live
   * filter an empty `include: []` would match nothing and therefore hide
   * every entity in the house. */
  if (out) {
    for (const k of FILTER_KEYS) {
      if (out[k] && !out[k].length) delete out[k];
    }
  }
  if (!out) return null;
  const dims = FILTER_KEYS.filter((k) => out[k]);
  if (!dims.length) return null;
  /* One dimension is one dimension however you combine it, so `match` is only
   * demanded where it changes the answer. Two of them and there is no honest
   * default: `domains: [light]` with `floors: [first_floor]` is "lights
   * upstairs" to one reader and "lights, and also everything upstairs" to
   * another, and the card cannot tell which of you wrote it. */
  if (dims.length > 1 && out._all === undefined) {
    throw new Error(
      `home-event-card: ${where} names ${dims.join(" and ")}, so it needs ` +
        "`match: all` (an entity must match every one of them) or " +
        "`match: any` (any one is enough, as Home Assistant's recorder does)."
    );
  }
  out._all = out._all === true;
  if (out.entity_globs) out._globs = out.entity_globs.map(globToRegExp);
  /* Registry ids are slugged names - core slugs "Low battery" into
   * `low_battery` once at creation and never revisits it - so slugging what
   * was written makes the id and the name the same answer, which is what
   * `areas` has always done. The per-entity side is slugged at lookup and
   * cached; both spellings go in there, so this stays a plain compare. */
  for (const k of ["labels", "devices", "floors"]) {
    if (out[k]) out["_" + k] = out[k].map(areaSlug);
  }
  return out;
}

/* Does `list` name anything in this entity's `have` set? Both sides are
 * already slugs. */
function hitsAny(list, have) {
  if (!list || !have || !have.length) return false;
  return list.some((v) => have.indexOf(v) !== -1);
}

/* Does this one dimension name this entity? The registry answers are passed in
 * rather than looked up here, so the walk happens once per entity instead of
 * once per filter. */
function matchesDimension(filter, key, entityId, ctx) {
  switch (key) {
    case "entities":
      return filter.entities.indexOf(entityId) !== -1;
    case "entity_globs":
      return filter._globs.some((re) => re.test(entityId));
    case "devices":
      return hitsAny(filter._devices, ctx.devices);
    case "labels":
      return hitsAny(filter._labels, ctx.labels);
    case "areas":
      return !!ctx.area && matchesArea(ctx.area, filter.areas);
    case "floors":
      return hitsAny(filter._floors, ctx.floors);
    case "domains":
      return filter.domains.indexOf(entityId.slice(0, entityId.indexOf("."))) !== -1;
    default:
      return false;
  }
}

/* A grouped event's wording, resolved for the kind of row being drawn. This
 * is where the mapping collapses, so the render path downstream never has to
 * know it existed.
 *
 * Grouping makes three kinds of row and they are read in three different
 * places, so there are three wordings:
 *
 *   one    a row standing for a single entity, on its own - either an event
 *          that is not grouping, or a group that turned out to hold one thing
 *   each   a row inside a group that has been opened. Read underneath the
 *          group's own row, so it is answering "which ones", where the group
 *          has already said what they are
 *   many   the group's own row, which is a count of things rather than a thing
 *
 * `each` falls back to `one` when it is not written: for two years there were
 * two wordings and a member row took `one`, and a config that says nothing new
 * should keep reading the way it read.
 *
 * An empty half is not a wording. A text box that was never filled in saves
 * as "", and taking that literally is an instruction to draw an empty line -
 * which is how a group of one came to show a name and no room, its author
 * having left `detail.one` blank meaning "I did not write one". Absent and
 * empty say the same thing here, and the key is dropped so whatever the
 * domain decided stands. */
function wording(cfg, role) {
  let out = cfg;
  for (const k of PLURAL_KEYS) {
    if (!isPlainObject(cfg[k])) continue;
    if (out === cfg) out = { ...cfg };
    const m = cfg[k];
    const half = role === "many" ? m.many
      : role === "each" ? (m.each || m.one)
        : m.one;
    if (half) out[k] = half;
    else delete out[k];
  }
  return out;
}

/* Does any condition here name this state outright? Only a positive `state:`
 * counts - `state_not: [unavailable]` mentions it in order to reject it.
 *
 * This exists for exactly one rule: unavailable and unknown are hidden unless
 * you asked for them. Making that a condition everyone writes would be two
 * lines of boilerplate on every event in every config. */
function namesState(conditions, value) {
  if (!conditions) return false;
  for (const c of conditions) {
    if (!isPlainObject(c)) continue;
    if (Array.isArray(c.conditions) && namesState(c.conditions, value)) return true;
    if (c.state == null) continue;
    if (asList(c.state).map(String).indexOf(value) !== -1) return true;
  }
  return false;
}

/* How specifically this filter matches, 0 for not at all.
 *
 * `match: all` has to check every dimension before it can answer, and then
 * takes the most specific one that hit - an intersection is at least as
 * precise as its sharpest term, which is what keeps `domains + entities`
 * outranking a bare domain exclude. `match: any` stops at the first hit,
 * because the walk runs most-specific-first and nothing below can beat it. */
function filterLevel(filter, entityId, ctx) {
  if (!filter) return 0;
  let best = 0;
  for (const [rung, key] of FILTER_RUNGS) {
    if (!filter[key]) continue;
    if (matchesDimension(filter, key, entityId, ctx)) {
      if (!filter._all) return rung;
      if (rung > best) best = rung;
    } else if (filter._all) {
      return 0;
    }
  }
  return best;
}

function passesFilter(include, exclude, entityId, ctx) {
  const inc = filterLevel(include, entityId, ctx);
  const exc = filterLevel(exclude, entityId, ctx);
  if (exc && exc >= inc) return false; // exclude wins ties
  if (include && !inc) return false; // an include was given and missed
  return true;
}

/* Which per-entity lookups this block's filters actually ask for. None of them
 * is free and most configs never mention any, so each one is paid for only
 * where it was written. */
function needsOf(include, exclude) {
  const out = {};
  for (const k of LOOKUP_KEYS) {
    out[k] = !!((include && include[k] && include[k].length) ||
                (exclude && exclude[k] && exclude[k].length));
  }
  return out;
}

const NO_NEEDS = needsOf(null, null);

/* Which domains a source could possibly reach, or null for "cannot tell, walk
 * the house". The candidate index buckets by domain because walking every
 * state per source per render is the thing it exists to avoid, and an include
 * that names domains, entity ids, or globs with a literal domain pins that
 * bucket. Areas, floors, devices and labels all cut across domains and cannot
 * pin anything, so they fall back to everything - correct, just not free. */
function candidateDomains(filter) {
  if (!filter) return null;
  /* An intersection can never reach outside its narrowest term, so a `match:
   * all` block that names domains pins the bucket whatever else it says. */
  if (filter._all && filter.domains) return filter.domains.slice();
  for (const k of LOOKUP_KEYS) if (filter[k]) return null;
  const out = [];
  const add = (d) => {
    if (out.indexOf(d) === -1) out.push(d);
  };
  if (filter.domains) for (const d of filter.domains) add(String(d));
  if (filter.entities) {
    for (const id of filter.entities) {
      const dot = String(id).indexOf(".");
      if (dot < 1) return null;
      add(String(id).slice(0, dot));
    }
  }
  if (filter.entity_globs) {
    for (const g of filter.entity_globs) {
      const dot = String(g).indexOf(".");
      const head = dot < 1 ? "" : String(g).slice(0, dot);
      if (!head || /[*?]/.test(head)) return null;
      add(head);
    }
  }
  return out.length ? out : null;
}

/* What is left of a `|`-piped name once tidy_names has taken a segment off the
 * front: "Kitchen | Dishwasher | State" joins back up as "Dishwasher \u00b7 State".
 * Only reachable with tidy_names on - by default a name is drawn whole, pipes
 * and all, because how somebody files their entities is not this card's to
 * decide. Also the join between a thermostat's room and its temperatures. */
const SEPARATOR = " \u00b7 ";

/* A replace, on whatever a placeholder produced.
 *
 * Friendly names are written for the state machine and end in the word the
 * integration needed - "Dryer | State", "Air Purifier | Error" - so a row can
 * be saying one word too many. The card no longer takes those words off by
 * itself, which was a guess about somebody's naming; this is the smallest
 * thing that lets an author take them off exactly:
 *
 *     title:  "{name|s/ [|] State$//}"
 *     status: "{attr.program|s/^p_//}"
 *
 * The pipe goes in a character class on purpose. `\|` is correct and fragile:
 * one more layer of escaping makes it `\\|`, which is a literal backslash
 * OR the empty alternative, and the empty one matches immediately. The
 * symptom is a pattern that appears to do almost nothing - one character
 * missing somewhere unexpected - rather than an error.
 *
 * One replace per placeholder, JavaScript's own regular expressions and its
 * own flags, $1 in the replacement. Deliberately no branching: a row that
 * needs an `if` is a template sensor, which can be tested in the template
 * editor and reused somewhere else.
 */
const FILTER_RE = /^s\/((?:\\.|[^/])*)\/((?:\\.|[^/])*)\/([gimsuy]*)$/;
const filterWarned = new Set();

function applyFilter(value, spec) {
  if (!spec) return value;
  const m = FILTER_RE.exec(spec);
  if (m) {
    try {
      return value.replace(new RegExp(m[1], m[3]), m[2]);
    } catch (err) {
      warnFilter(spec, (err && err.message) || err);
      return value;
    }
  }
  warnFilter(spec, "it is not s/pattern/replacement/flags");
  return value;
}

function warnFilter(spec, why) {
  if (filterWarned.has(spec)) return;
  filterWarned.add(spec);
  console.warn(`home-event-card: cannot apply "|${spec}" - ${why}.`);
}

/* Whether this card would put a row on an entity at all.
 *
 * A light group publishes its members in `attributes.entity_id`; drawing the
 * group as well as its members puts the same lamps on the card twice, so the
 * group is dropped. Dropped here rather than by a naming convention - the
 * attribute is a fact about what the entity is, where the id is one house's
 * habit.
 *
 * One predicate, used by the render path and exported beside the filter
 * engine, because anything asking "what would a row look like" has to ask the
 * same question: the Event Manager samples an entity to preview and would
 * otherwise pick one the card never draws and show an empty card. */
function drawable(st) {
  return !!st && !Array.isArray((st.attributes || {}).entity_id);
}

function splitName(friendly, entityId) {
  const raw = String(friendly || entityId || "");
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { area: null, name: entityId };
  if (parts.length === 1) return { area: null, name: parts[0] };
  return { area: parts[0], name: parts.slice(1).join(SEPARATOR) };
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
 * day, days above that. Seconds never appear - they only add flicker.
 *
 * `t` is the resolved text.time block. Both units of a compound are filled
 * separately so a translation can put them in its own order. */
function fmtDur(ms, t) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t.just_now;
  const m = Math.floor(s / 60);
  if (m < 60) return fill(t.minute, m);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${fill(t.hour, h)} ${fill(t.minute, rm)}` : fill(t.hour, h);
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${fill(t.day, d)} ${fill(t.hour, rh)}` : fill(t.day, d);
}

/* mode: since (elapsed) | until (countdown) | ago (elapsed, past-tense)
 *     | remaining (countdown, stated as what is left)
 *
 * Each mode carries its own wording, because a bare "1h 12m" does not say which
 * way it points. "For 1h 12m" is a thing still running, "12m ago" is a thing
 * that finished, "in 6m" is a thing that has not started, "28m remaining" is a
 * timer running down. The word is doing real work - without it the washer and
 * the dishwasher read identically and mean opposite things.
 *
 * `until` and `remaining` measure the same interval and differ only in how they
 * say it. A timer someone set is better read as what is left of it than as when
 * it will end. */
function fmtRelative(at, mode, now, t) {
  if (!at) return "";
  const counting = mode === "until" || mode === "remaining";
  const delta = counting ? at - now : now - at;
  if (counting) {
    /* "in just now" is nonsense, and a countdown that has run out but whose
     * entity has not caught up yet should not go negative. */
    if (delta < 60000) return t.any_moment;
    return fill(mode === "remaining" ? t.remaining : t.in, fmtDur(delta, t));
  }
  const d = fmtDur(delta, t);
  if (mode === "ago") return d === t.just_now ? d : fill(t.ago, d);
  /* "For just now" does not parse; something under a minute old has just
   * started, which is what the row should say. */
  return d === t.just_now ? t.just_started : fill(t.for, d);
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
 *   mode      since | until | ago | remaining
 *   entity    what a tap opens
 *   tone      optional colour override for climate's cool blue
 *   iconColor optional CSS colour for the icon, from the event's icon_color
 *   color     optional CSS colour for the row's accent, from the event's color
 *   tint      true/false to tint the row's background, null for "alerts only"
 */
function ev(o) {
  return {
    key: o.key,
    category: o.category,
    severity: o.severity || "info",
    icon: o.icon || "mdi:information-outline",
    title: o.title || "",
    sub: o.sub || "",
    status: o.status || "",
    at: o.at || null,
    mode: o.mode || "since",
    entity: o.entity || "",
    tone: o.tone || null,
    iconColor: o.iconColor || null,
    color: o.color || null,
    tint: typeof o.tint === "boolean" ? o.tint : null,
    area: o.area || null,
    members: o.members || null,
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
    this._covered = null;
    this._timer = null;
    /* Which grouped rows are open and which sections are folded. Deliberately
     * not persisted: it is a reading position, not a preference, and a wall
     * tablet that came back from a reload still folded would be a card that
     * had quietly hidden something. */
    this._open = new Set();
    this._folded = new Set();
    /* Sections the reader has asked to see the whole of. */
    this._expanded = new Set();
    this._onClick = (e) => this._handleClick(e);
    this._onKey = (e) => this._handleKey(e);
    this._onDown = (e) => this._holdStart(e);
    this._onUp = () => this._holdStop();
    this._onMove = (e) => this._holdMoved(e);
    this._onVisibility = () => this._applyVisibility();
  }

  setConfig(config) {
    const given = config || {};
    const cfg = mergeConfig(DEFAULTS, given);

    const valid = ["category", "area", "severity", "none"];
    if (valid.indexOf(cfg.group_by) === -1) {
      throw new Error(
        `home-event-card: unknown group_by "${cfg.group_by}". ` +
          `Valid values are ${valid.join(", ")}.`
      );
    }
    if (SORT_MODES.indexOf(cfg.sort) === -1) {
      throw new Error(
        `home-event-card: unknown sort "${cfg.sort}". Valid values are ` +
          `${SORT_MODES.join(", ")}.`
      );
    }
    /* What used to be written here and where it went.
     *
     * A retired key is named rather than ignored: a dashboard whose `events:`
     * block quietly stopped doing anything would be a card that had gone
     * blank for no stated reason, which is the worst way to find out about a
     * change. Unknown keys are still let through - the top level is shared
     * with Lovelace, which writes `grid_options` and friends into it. */
    for (const key of Object.keys(given)) {
      if (MOVED[key]) {
        throw new Error(
          `home-event-card: \`${key}\` is not a card option any more - ` +
            `${MOVED[key]}. The card says how the library reads on this ` +
            "dashboard; the library says what the house is watching."
        );
      }
    }

    /* Everything below is filled in from the library, and empty until it
     * arrives. The card holds no events of its own. */
    cfg.categories = [];
    cfg.events = {};
    cfg._nonAreas = new Set();
    this._compileEvents(cfg, {});

    cfg.text = mergeText(DEFAULT_TEXT, given.text, "text");

    /* A card that says how it wants its rows keeps saying it; one that says
     * nothing follows the library. */
    this._ownSort = given.sort != null;

    this._config = cfg;
    this._sig = null; // force a redraw on the next hass tick
    this._idx = null;
    this._covered = null;
    /* A library handed over before the config was - see `set library`. */
    if (this._given) this.libraryOk = this._applyLibrary(this._given);
  }

  /* Validate, compile, index. Everything the render path needs to answer
   * "which events might this entity belong to" without touching the config.
   *
   * Separate from setConfig because the library arrives later than the config
   * does: the card is built, drawn, and only then hears back from the Event
   * Manager. Running this again with the merged events is what makes that
   * second answer as good as the first. */
  _compileEvents(cfg, rawEvents) {
    /* Copied first, and never touched in place. What arrives here is
     * Lovelace's own configuration object - the one it keeps, shares between
     * renders and hands back to setConfig on the next rebuild. Compiling the
     * filters into it wrote `_include` onto that object, and the second
     * setConfig then found a key the schema has never heard of and threw: a
     * card that rendered a moment ago became a configuration error, and no
     * amount of refreshing helped because the first render caused it. */
    const events = {};
    for (const name of Object.keys(rawEvents)) {
      const raw = rawEvents[name];
      if (!isPlainObject(raw)) {
        throw new Error(
          `home-event-card: events.${name} must be a mapping with at least an ` +
            "`include:` saying what it covers."
        );
      }
      /* Underscore keys are this card's own, left behind by a build that did
       * write in place. Dropped rather than rejected, so a config that has
       * already been scribbled on comes back to life instead of needing to be
       * retyped. */
      const e = {};
      for (const k of Object.keys(raw)) if (k.charAt(0) !== "_") e[k] = raw[k];
      events[name] = e;
      checkKeys(EVENT_KEYS, e, `events.${name}`);

      /* One of a fixed set of words - per kind of row for `time_mode`, which
       * groups like the wordings do, and once and for all for `severity`,
       * which does not: a group is as urgent as what is in it, and a row that
       * changed colour on being opened would be saying something about the
       * chevron rather than about the house.
       *
       * Not a mapping from state, either. A device that reads two ways in two
       * states is two events with different conditions - which is what a state
       * mapping was always describing, only without saying where the line
       * was. */
      for (const [key, allowed] of [["severity", SEVERITIES], ["time_mode", TIME_MODES]]) {
        if (e[key] == null) continue;
        const halves = isPlainObject(e[key]) && PLURAL_KEYS.indexOf(key) !== -1
          ? Object.values(e[key])
          : [e[key]];
        for (const value of halves) {
          if (value === "") continue; // nothing written, not a wrong word
          if (typeof value !== "string" || allowed.indexOf(value) === -1) {
            throw new Error(
              `home-event-card: \`${key}\` on events.${name} must be one of ` +
                `${allowed.join(", ")}. For two values, write two events with ` +
                "`conditions` that tell them apart."
            );
          }
        }
      }
      /* A colour rather than a word from a scale, so it is checked against
       * what CSS will do with it rather than against a list of four. Here and
       * not at paint time: an icon that quietly kept its old colour is the
       * hardest kind of typo to find, and the panel refuses the same value
       * with the same reasoning before it is ever written. */
      for (const key of COLOUR_KEYS) {
        const written = e[key];
        for (const value of isPlainObject(written) ? Object.values(written)
                                                   : [written]) {
          if (value == null || value === "") continue; // nothing written
          if (iconColorCss(value)) continue;
          throw new Error(
            `home-event-card: \`${key}\` on events.${name} is ` +
              `${JSON.stringify(value)}, which is not a colour. Write one of ` +
              `${SEVERITIES.join(", ")}, heat or cool - the colours the card ` +
              "paints by itself - or a Home Assistant palette name " +
              `(${PALETTE.slice(3, 9).join(", ")}, ...), or CSS: #rrggbb, ` +
              "rgb(...), hsl(...), color-mix(...) or var(--your-variable)."
          );
        }
      }
      if (e.group !== undefined && GROUP_MODES.indexOf(e.group) === -1) {
        throw new Error(
          `home-event-card: \`group: ${JSON.stringify(e.group)}\` on events.${name} ` +
            "must be area (one row per room), all (one row for the lot), or " +
            "false. `true` is the old spelling of area."
        );
      }
      for (const [key, want] of [["show_time", "boolean"], ["enabled", "boolean"],
                                 ["tint", "boolean"]]) {
        if (e[key] !== undefined && typeof e[key] !== want) {
          throw new Error(
            `home-event-card: \`${key}\` on events.${name} must be true or false. ` +
              `Got ${JSON.stringify(e[key])}.`
          );
        }
      }
      /* Grouping makes three kinds of row, so it takes three wordings.
       * Ungrouped there is only ever the one, and a mapping is a mistake worth
       * naming rather than two thirds of an answer nobody will see. */
      for (const key of PLURAL_KEYS) {
        if (!isPlainObject(e[key])) continue;
        if (!groupMode(e)) {
          throw new Error(
            `home-event-card: \`${key}\` on events.${name} may only be a ` +
              "`one`/`each`/`many` mapping when the event groups - without " +
              "grouping every row it draws is a single thing."
          );
        }
        checkKeys(WORDING_KEYS, e[key], `${key} on events.${name}`);
      }
      checkConditions(e.conditions, `events.${name}`);
    }
    cfg.events = events;

    for (const name of Object.keys(cfg.events)) {
      compileFilters(cfg.events[name], `events.${name}.`);
    }
    /* Two registries hass does not hand out as collections. Only fetched when
     * a filter mentions them, which most configs never will. */
    cfg._wantRegistries = {};
    for (const k of ["labels", "floors"]) {
      cfg._wantRegistries[k] =
        Object.keys(cfg.events).some((n) => cfg.events[n]._needs[k]);
    }

    /* Events resolved once. _index runs this lookup per entity in the house,
     * so it has to be a map rather than a scan. An event whose include cannot
     * be pinned to domains goes in _eventsAll and is offered every entity; its
     * filter still decides, this only chooses how wide the candidate list
     * starts. */
    cfg._events = [];
    cfg._eventsByDomain = {};
    cfg._eventsAll = [];
    for (const name of Object.keys(cfg.events)) {
      const e = cfg.events[name];
      /* An include that selects nothing would select everything, which is
       * never what anybody wrote - and without one an event is a heading with
       * no way of knowing what belongs under it. */
      if (!e._include) {
        throw new Error(
          `home-event-card: events.${name} needs an \`include:\` saying what it ` +
            "covers - a domain, a glob, an entity, a device, an area, a floor " +
            "or a label."
        );
      }
      cfg._events.push([name, e]);
      const domains = candidateDomains(e._include);
      if (!domains) {
        cfg._eventsAll.push(name);
        continue;
      }
      for (const d of domains) {
        (cfg._eventsByDomain[d] = cfg._eventsByDomain[d] || []).push(name);
      }
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._fetchLibrary();
    this._loadRegistries();
    if (!this._built) this._build();
    this._render();
  }

  /* A library handed straight in, instead of the one in .storage.
   *
   * The Event Manager shows a row the way this card would draw it, and the
   * only honest way to do that is to *be* this card - a second renderer that
   * agreed with the first most of the time would be worse than no preview at
   * all. So it hands over a library of one event as a property rather than as
   * config: a dashboard has no business carrying a library, and this is not
   * a dashboard.
   *
   * Setting it also settles the question of where events come from, so the
   * websocket is never asked and an edit in progress is never overwritten by
   * whatever happens to be saved.
   *
   * `libraryOk` says afterwards whether what was handed over compiled. A
   * preview is drawn from a draft somebody is still typing, and half a filter
   * is the normal case there, so this is a question with a real answer rather
   * than an exception. */
  set library(data) {
    this._libraryAsked = true;
    this._given = data || { events: {} };
    /* Before setConfig there is nothing to compile into; setConfig applies
     * what was stashed, so the two can arrive in either order. */
    this.libraryOk = this._config ? this._applyLibrary(this._given) : null;
  }

  /* The library. There is one, and it is where every event comes from.
   *
   * Asked for once, then followed: `home_events/subscribe` pushes on every
   * save, so an open dashboard changes as the panel is edited rather than at
   * the next reload. A failure is logged once and left there - a card that
   * blanks itself because an integration is missing is the worst of the
   * available failures, so what it already had goes on being drawn. */
  _fetchLibrary() {
    if (this._libraryAsked || !this._hass) return;
    this._libraryAsked = true;
    const conn = this._hass.connection;
    /* The subscribe resolves a round trip later, and by then this card may be
     * off the page. Without the generation check the resolution hands a live
     * subscription to a detached element and nothing is left holding the
     * handle that would cancel it: its callback keeps the card, its shadow
     * root and its stylesheet alive for as long as the page lives, and goes
     * on redrawing them.
     *
     * The generation rather than isConnected, because Lovelace sets hass
     * before putting a card in the document - the first call here legitimately
     * runs on a disconnected element, and refusing that would mean never
     * following the Event Manager at all. */
    const gen = (this._libGen = (this._libGen || 0) + 1);
    this._readLibrary();
    conn
      .subscribeMessage(() => this._readLibrary(), { type: "home_events/subscribe" })
      .then((off) => {
        if (gen !== this._libGen) {
          off();
          return;
        }
        this._libraryOff = off;
      })
      .catch(() => {});
  }

  _readLibrary() {
    this._hass.connection
      .sendMessagePromise({ type: "home_events/library" })
      .then((res) => this._applyLibrary(res))
      .catch((err) => {
        console.warn(
          "home-event-card: could not read the event library - " +
            ((err && err.message) || err) +
            ". Is the Home Events integration set up?",
        );
      });
  }

  /* What the library says, drawn the way this card is configured to draw it.
   * True if it compiled.
   *
   * A library that will not compile is logged and dropped rather than thrown:
   * it arrived from somewhere else, possibly while somebody was mid-edit, and
   * the card was rendering perfectly well a moment ago. */
  _applyLibrary(data) {
    const cfg = this._config;
    const events = data.events || {};
    /* Compiled onto a copy and only then committed. Compiling writes five keys
     * that have to agree with each other, and a throw halfway through left the
     * index describing events the card no longer had. */
    const next = { ...cfg };
    try {
      this._compileEvents(next, events);
    } catch (err) {
      console.warn(
        "home-event-card: the event library was not usable - " +
          ((err && err.message) || err),
      );
      this.libraryError = (err && err.message) || String(err);
      return false;
    }
    this.libraryError = null;
    for (const k of ["events", "_events", "_eventsByDomain", "_eventsAll",
                     "_wantRegistries"]) {
      cfg[k] = next[k];
    }
    if (Array.isArray(data.categories)) {
      /* Only the parts a card draws with, and only from entries that name a
       * section. The library is validated where it is written; this is the
       * card refusing to be taken down by a hand-edited store. */
      cfg.categories = data.categories
        .filter((c) => isPlainObject(c) && c.id)
        .map((c) => ({
          id: c.id,
          label: c.label,
          sort: SORT_MODES.indexOf(c.sort) === -1 ? undefined : c.sort,
        }));
    }
    if (!this._ownSort && SORT_MODES.indexOf(data.sort) !== -1) {
      cfg.sort = data.sort;
    }
    /* Areas that are filing cabinets rather than places - a fact about the
     * registry, so it is written once in the library instead of on every card
     * that reads it. Slugged here so the render path is a lookup. */
    cfg._nonAreas = new Set(asList(data.non_areas).map(areaSlug));
    this._sig = null;
    this._idx = null;
    this._covered = null;
    if (this._hass) {
      this._loadRegistries();
      this._render();
    }
    return true;
  }

  /* id -> entry for the two registries hass does not hand out as collections,
   * so `labels:` and `floors:` can be written the way they read in the UI as
   * well as the way they are stored.
   *
   * The two spellings diverge the moment anyone renames something: core slugs
   * the name into an id at creation and leaves the id alone forever after, so
   * this house has a label displayed as "HVAC" whose id is `heating`, and
   * three more besides. Matching ids only would mean `labels: [HVAC]` quietly
   * returning nothing, which is the failure this card's strictness exists to
   * prevent everywhere else.
   *
   * Asked for once, and only when a filter actually mentions one. The answer
   * arrives after a render or two; dropping the lookup cache and the render
   * signature is what makes the next tick pick it up. */
  _loadRegistries() {
    const want = this._config._wantRegistries;
    for (const kind of REGISTRY_KINDS) {
      if (!want[kind.key]) continue;
      this._loadRegistry(kind);
    }
  }

  _loadRegistry(kind) {
    this._reg = this._reg || {};
    this._regPending = this._regPending || {};
    if (this._reg[kind.key] || this._regPending[kind.key]) return;
    const hass = this._hass;
    /* A newer core may already carry it as a collection, in which case there
     * is nothing to ask for. */
    if (hass[kind.key] && typeof hass[kind.key] === "object") {
      this._reg[kind.key] = hass[kind.key];
      return;
    }
    if (typeof hass.callWS !== "function") {
      this._reg[kind.key] = {}; // nothing to ask; ids still work
      return;
    }
    this._regPending[kind.key] = true;
    hass
      .callWS({ type: kind.ws })
      .then((list) => {
        const map = {};
        for (const row of list || []) map[row[kind.id]] = row;
        this._reg[kind.key] = map;
        this._lookupCache = null;
        /* Areas, labels, devices and floors are three quarters of what the
         * filter ladder decides on, so an arriving registry can change who is
         * covered. */
        this._covered = null;
        this._sig = null;
      })
      .catch(() => {
        this._reg[kind.key] = {}; // a core without it; ids still work
      })
      .then(() => {
        this._regPending[kind.key] = false;
      });
  }

  /* The icon Home Assistant would draw for an entity that carries none.
   *
   * `attributes.icon` is only filled when somebody chose an icon - in the
   * integration's code, or in the entity settings. Everything else is
   * computed in the browser and never appears in the state at all, which is
   * why a card reading only the attribute draws a blank ring for entities
   * Home Assistant itself draws properly. binary_sensor.weather_warning is
   * the case that found this: device_class `safety`, state `on`, no icon
   * attribute, and Home Assistant showing mdi:alert-circle from a dictionary
   * this card had never asked for.
   *
   * The dictionaries are per integration and per domain, served over the
   * websocket, and looked up in core's own order:
   *
   *   the entity's translation_key, in its integration's icons
   *   its device class, in its domain's icons
   *   its domain's plain default
   *
   * Only the first that answers is used, and a domain renderer's own opinion
   * still wins over all of it - see _decorate. This is the "I have no idea
   * what this is" case getting a better answer than a circle. */
  _stateIcon(id, st) {
    const hass = this._hass;
    const domain = id.slice(0, id.indexOf("."));
    const state = st.state;
    const entry = (hass.entities || {})[id];

    if (entry && entry.translation_key && entry.platform) {
      const res = this._iconDict("entity", entry.platform);
      const own = ((res[entry.platform] || {})[domain] || {})[entry.translation_key];
      const icon = iconFromEntry(own, state);
      if (icon) return icon;
    }

    const res = this._iconDict("entity_component", domain);
    const byClass = res[domain] || {};
    const deviceClass = (st.attributes || {}).device_class;
    /* `_` is the domain's own entry: what a sensor with no device class gets.
     * A device class that names no icon falls through to it rather than to
     * nothing, which is what core does. */
    return (
      (deviceClass && iconFromEntry(byClass[deviceClass], state)) ||
      iconFromEntry(byClass._, state)
    );
  }

  /* One icon dictionary, asked for once and only for the integrations and
   * domains actually on screen. Empty until it lands; when it does, the
   * signature is dropped so the next paint uses it. */
  _iconDict(category, integration) {
    const key = category + ":" + integration;
    this._iconDicts = this._iconDicts || {};
    if (this._iconDicts[key]) return this._iconDicts[key];
    const hass = this._hass;
    if (typeof hass.callWS !== "function") return {};
    this._iconPending = this._iconPending || {};
    if (this._iconPending[key]) return {};
    this._iconPending[key] = true;
    hass
      .callWS({ type: "frontend/get_icons", category, integration: [integration] })
      .then((res) => {
        this._iconDicts[key] = (res && res.resources) || {};
      })
      /* A core that does not serve them, or an integration with none: the
       * empty answer is cached too, so this is asked once either way. */
      .catch(() => {
        this._iconDicts[key] = {};
      })
      .then(() => {
        this._iconPending[key] = false;
        this._sig = null;
        this._render();
      });
    return {};
  }

  /* Both spellings of every registry name that reaches this entity, as slugs,
   * so the filter side stays a plain compare and the ladder does not need to
   * know that things have an id and a name.
   *
   *   labels    its own, its device's and its area's - the expansion a service
   *             target does, and not optional: labels are usually applied to
   *             devices, so reading only the entity's own would miss most of
   *             them
   *   devices   the device it belongs to, by id and by name
   *   floors    the floor its area is on. Only ever from the registry: an area
   *             guessed out of a friendly name is not a room core knows about
   *             and cannot be on a storey
   *
   * One walk, three answers, cached per entity id - this runs against every
   * state in the house on every source. Invalidated with the candidate index,
   * and again when a registry lands. */
  _lookups(entityId) {
    if (this._lookupCache && this._lookupCache.has(entityId)) {
      return this._lookupCache.get(entityId);
    }
    if (!this._lookupCache) this._lookupCache = new Map();
    const hass = this._hass;
    const reg = this._reg || {};
    const out = { labels: [], devices: [], floors: [] };
    const push = (list, v) => {
      const slug = areaSlug(v);
      if (slug && list.indexOf(slug) === -1) list.push(slug);
    };
    /* An id and the name it was slugged from, both. */
    const pushBoth = (list, id, entry) => {
      push(list, id);
      if (entry && entry.name) push(list, entry.name);
    };
    const addLabels = (ids) => {
      if (!Array.isArray(ids)) return;
      for (const id of ids) pushBoth(out.labels, id, reg.labels && reg.labels[id]);
    };

    const ent = hass.entities && hass.entities[entityId];
    addLabels(ent && ent.labels);
    let areaId = ent && ent.area_id;
    if (ent && ent.device_id && hass.devices) {
      const dev = hass.devices[ent.device_id];
      push(out.devices, ent.device_id);
      if (dev) {
        addLabels(dev.labels);
        push(out.devices, dev.name_by_user || dev.name);
        if (!areaId) areaId = dev.area_id;
      }
    }
    const area = areaId && hass.areas ? hass.areas[areaId] : null;
    if (area) {
      addLabels(area.labels);
      if (area.floor_id) {
        pushBoth(out.floors, area.floor_id, reg.floors && reg.floors[area.floor_id]);
      }
    }
    this._lookupCache.set(entityId, out);
    return out;
  }

  _labels(entityId) {
    return this._lookups(entityId).labels;
  }

  _deviceKeys(entityId) {
    return this._lookups(entityId).devices;
  }

  _floorKeys(entityId) {
    return this._lookups(entityId).floors;
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
    /* Moved on, so anything still in flight from the last life is not ours. */
    this._libGen = (this._libGen || 0) + 1;
    if (this._libraryOff) {
      this._libraryOff();
      this._libraryOff = null;
      this._libraryAsked = false;
    } else if (!this._given) {
      /* Disconnected while the subscribe was still in flight. _libraryAsked
       * went true the moment it was asked for, so without this the card comes
       * back with no subscription and no intention of asking for one, and
       * quietly stops following the Event Manager for the rest of the page's
       * life. Not when a library was handed in: that one is not ours to
       * re-ask for. */
      this._libraryAsked = false;
    }
    /* A finger still down when the view is torn down leaves a 500ms timeout
     * holding this card, which then fires more-info from a detached element. */
    this._holdStop();
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
    this._root.addEventListener("click", this._onClick);
    this._root.addEventListener("keydown", this._onKey);
    /* Tap and hold, on the rows that have two things to do. */
    this._root.addEventListener("pointerdown", this._onDown);
    this._root.addEventListener("pointerup", this._onUp);
    this._root.addEventListener("pointercancel", this._onUp);
    this._root.addEventListener("pointerleave", this._onUp);
    this._root.addEventListener("pointermove", this._onMove);
    this._built = true;
  }

  _handleClick(e) {
    /* The click that follows a hold is the same gesture reported twice. The
     * hold already did something; doing the tap's thing as well would open the
     * drawer under the dialog that was just asked for. */
    if (this._held) {
      this._held = false;
      return;
    }
    if (this._toggled(e)) return;
    const el = this._targetOf(e);
    if (el && el.dataset.entity) this._fireMoreInfo(el.dataset.entity);
  }

  /* A grouped row opens rather than firing more-info, and a section heading
   * folds. Both return true so the caller stops - the heading and the row are
   * ancestors of things that would otherwise be treated as entities. */
  _toggled(e) {
    const path = e.composedPath();
    const sec = path.find((n) => n && n.dataset && n.dataset.secToggle);
    if (sec) {
      const id = sec.dataset.secToggle;
      if (this._folded.has(id)) this._folded.delete(id);
      else this._folded.add(id);
      this._repaint();
      return true;
    }
    const row = path.find((n) => n && n.dataset && n.dataset.group);
    if (row) {
      const key = row.dataset.group;
      if (this._open.has(key)) this._open.delete(key);
      else this._open.add(key);
      this._repaint();
      return true;
    }
    const more = path.find((n) => n && n.dataset && n.dataset.more);
    if (more) {
      const id = more.dataset.more;
      if (this._expanded.has(id)) this._expanded.delete(id);
      else this._expanded.add(id);
      this._repaint();
      return true;
    }
    return false;
  }

  /* Tap opens the drawer; hold opens the entity behind it.
   *
   * A group row has two things worth doing and one of them has to be second.
   * The chevron was that second thing, and an 18px target beside a scrolling
   * list is not one on a phone - which is where this card is read one-handed.
   * So the row does the common thing, looking at what is inside, and a
   * press-and-hold reaches the group's own controls. That is the same pairing
   * Home Assistant's own cards use for tap_action and hold_action, so the
   * gesture is one somebody already has.
   *
   * Only rows with both. A row that is only an entity opens on tap as it
   * always has, and an area group has nothing behind it to hold for.
   */
  _holdStart(e) {
    if (e.button != null && e.button > 0) return;   // right or middle
    const row = e.composedPath().find((n) => n && n.dataset && n.dataset.group);
    if (!row || !row.dataset.entity) return;
    this._holdStop();
    /* A hold whose finger lifted off the card never produced the click that
     * clears this, and the next tap anywhere was then swallowed. A new press
     * is a new gesture. */
    this._held = false;
    this._holdAt = { x: e.clientX || 0, y: e.clientY || 0 };
    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = null;
      /* Set before the dialog opens: the click that ends this press is still
       * to come, and it must not also toggle the row. */
      this._held = true;
      haptic("long");
      this._fireMoreInfo(row.dataset.entity);
    }, HOLD_MS);
  }

  _holdStop() {
    if (this._holdTimer) window.clearTimeout(this._holdTimer);
    this._holdTimer = null;
  }

  /* A finger that travelled was scrolling the page, not holding a row. */
  _holdMoved(e) {
    if (!this._holdTimer || !this._holdAt) return;
    const dx = (e.clientX || 0) - this._holdAt.x;
    const dy = (e.clientY || 0) - this._holdAt.y;
    if (dx * dx + dy * dy > HOLD_SLOP * HOLD_SLOP) this._holdStop();
  }

  /* The signature exists to stop the DOM being rebuilt for nothing. A fold is
   * the one change that comes from the person rather than from the house, so
   * it has to say "yes, actually" once. */
  _repaint() {
    this._sig = null;
    this._render();
  }

  /* Rows carry tabindex and role="button", which would be a lie without a
   * keyboard path to the same action. */
  _handleKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (this._toggled(e)) {
      e.preventDefault();
      return;
    }
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

  /* A row's location is the area assigned in the registry: the entity's own,
   * or its device's. That is the answer Home Assistant itself would give, and
   * it is the same answer in every installation.
   *
   * With `tidy_names` on there is a second source - the first segment of a
   * `|`-piped name - and _areaName falls back to it. That is a guess, right
   * for `Kitchen | Dishwasher` and wrong for `Alarm | Master`, where the first
   * segment is not a room at all. _registryArea is the unguessed answer, for
   * callers that need to know whether an entity is really *somewhere*. */
  _registryArea(entityId) {
    const hass = this._hass;
    const entReg = hass.entities && hass.entities[entityId];
    let areaId = entReg && entReg.area_id;
    if (!areaId && entReg && entReg.device_id && hass.devices) {
      const dev = hass.devices[entReg.device_id];
      areaId = dev && dev.area_id;
    }
    /* A filing cabinet is not a room, and printing one as a location is worse
     * than printing nothing. Which areas those are is `non_areas`, because it
     * is a fact about your registry - this card used to assume "other" and
     * "system", which is one installation's habit. */
    if (areaId && this._config._nonAreas.has(areaSlug(areaId))) areaId = null;
    if (areaId && hass.areas && hass.areas[areaId]) return hass.areas[areaId].name;
    return null;
  }

  /* A friendly name, taken apart - or not, if `tidy_names: false`.
   *
   * Both of the card's name edits go through here and through _strip, so
   * "leave my names alone" is one flag rather than something to remember at
   * five call sites. Off, the whole friendly name is the title and `area` is
   * null, which puts the room back where it belongs: the registry. */
  _nameParts(friendly, entityId) {
    if (this._config.tidy_names === false) {
      return { area: null, name: String(friendly || entityId || "") };
    }
    return splitName(friendly, entityId);
  }

  _strip(name, words) {
    if (this._config.tidy_names === false) return String(name || "");
    return stripSuffix(name, words);
  }

  _areaName(entityId, stateObj) {
    const known = this._registryArea(entityId);
    if (known) return known;
    const attrs = (stateObj && stateObj.attributes) || {};
    return this._nameParts(attrs.friendly_name, entityId).area;
  }

  /* Walking 1700 states on every hass tick to find six timers would be
   * wasteful on an always-on tablet. The candidate index is the set of entity
   * ids any source could possibly care about; it only changes when entities
   * are added or removed, which the entity count detects well enough. */
  /* How many entities there are, asked at most once a second.
   *
   * Object.keys materialises all 1477 of them to read .length, which measured
   * at 0.8ms on the dining-room tablet - so the cheap path of this cache cost
   * more than the walk it exists to avoid. Entities arrive when an integration
   * loads and leave when one unloads; a second of lag before a new one becomes
   * a candidate is not something anyone can see, and eleven counts a second is
   * not something anyone needed.
   *
   * Not keyed on hass.states identity, which looks stronger and is useless:
   * the frontend builds a new states object on every update, so identity reads
   * as "changed" on every tick and the cache would never hit at all. */
  _entityCount() {
    const now = Date.now();
    if (this._ecAt !== undefined && now - this._ecAt < 1000) return this._ecN;
    this._ecAt = now;
    this._ecN = Object.keys(this._hass.states).length;
    return this._ecN;
  }

  _index() {
    const hass = this._hass;
    const key = this._entityCount();
    if (this._idx && this._idxKey === key) return this._idx;
    const byDomain = this._config._eventsByDomain;
    const all = this._config._eventsAll;

    const idx = {};
    for (const [name] of this._config._events) idx[name] = [];

    for (const id in hass.states) {
      const domain = id.slice(0, id.indexOf("."));
      const wanted = byDomain[domain];
      if (wanted) for (const name of wanted) idx[name].push(id);
      for (const name of all) idx[name].push(id);
    }

    this._idx = idx;
    this._idxKey = key;
    this._lookupCache = null;
    this._covered = null; // different candidates, so a different answer
    return idx;
  }

  /* ---------------------------------------------------------------- events */

  /* The one gate every event runs an entity through, so "why is this not
   * showing?" has the same answer everywhere instead of depending on which
   * event found it. Four things must pass: the top-level include/exclude, the
   * event's own, the top-level conditions and the event's own. Filters are
   * two separate ladders rather than one merged block, so an event can include
   * something the top level is quiet about without also overriding a
   * top-level exclusion. */
  /* Whether this entity is one of the event's, and whether now is one of its
   * moments. Both questions belong to the event: a card-wide filter used to
   * sit in front of this, and an event that says what it covers is a better
   * answer than an event plus a card that quietly disagrees. */
  _excluded(entityId, sourceCfg, stateObj) {
    if (!this._covers(entityId, sourceCfg, stateObj)) return true;
    return !this._conditionsMet((sourceCfg || {}).conditions, entityId);
  }

  /* Named in this event's exclude, by whatever dimension. Only the exclude:
   * this asks "was I told not to", not "was I selected". */
  _shunned(entityId, sourceCfg) {
    const src = sourceCfg || {};
    if (!src._exclude) return false;
    const need = src._needs || NO_NEEDS;
    const ctx = { area: null, labels: null, devices: null, floors: null };
    if (need.areas) ctx.area = this._areaName(entityId, this._hass.states[entityId]);
    if (need.labels) ctx.labels = this._labels(entityId);
    if (need.devices) ctx.devices = this._deviceKeys(entityId);
    if (need.floors) ctx.floors = this._floorKeys(entityId);
    return filterLevel(src._exclude, entityId, ctx) > 0;
  }

  /* The filter half of the same question: what this event is about, before any
   * question of what state it is in.
   *
   * Which groups get a row is decided against this rather than against what is
   * currently on - otherwise a lamp being switched would move a row from
   * inside a group to beside it and back. */
  _covers(entityId, sourceCfg, stateObj) {
    const src = sourceCfg || {};
    const need = src._needs || NO_NEEDS;
    const ctx = { area: null, labels: null, devices: null, floors: null };
    if (need.areas) {
      ctx.area = this._areaName(entityId, stateObj || this._hass.states[entityId]);
    }
    if (need.labels) ctx.labels = this._labels(entityId);
    if (need.devices) ctx.devices = this._deviceKeys(entityId);
    if (need.floors) ctx.floors = this._floorKeys(entityId);
    return passesFilter(src._include, src._exclude, entityId, ctx);
  }

  /* Which entities an event covers - the filter ladder's answer, kept.
   *
   * This is a question about the event and the registry, not about the house:
   * an include/exclude decides it, and a state only enters through the one
   * fallback that reads a room out of a friendly name. The answer therefore
   * holds still while the house moves, and it was being recomputed on every
   * hass tick regardless.
   *
   * It mattered because of how wide the candidate lists are. An event written
   * without a domain is handed every entity there is, and one here is: between
   * the four widest, 4141 entities were going through the ladder on each tick,
   * which measured as 43,919 filter evaluations a second on the dining-room
   * tablet - arriving at the same seventy-odd entities every time, 29% of that
   * tablet's main thread.
   *
   * Dropped whenever any of its inputs can have changed: the candidate lists
   * being rebuilt (an entity came or went), a registry arriving, the library
   * being saved, a new config. A friendly_name changing under the area
   * fallback arrives as an entity registry update, which is the same path. */
  _coveredFor(name, cfg, idx) {
    if (!this._covered) this._covered = new Map();
    const known = this._covered.get(name);
    if (known) return known;
    const hass = this._hass;
    const ids = [];
    for (const id of idx[name] || []) {
      const st = hass.states[id];
      if (st && this._covers(id, cfg, st)) ids.push(id);
    }
    this._covered.set(name, ids);
    return ids;
  }

  /* One event: walk its candidates, drop what its filters and conditions
   * reject, and hand each survivor to the renderer for its domain.
   *
   * A grouped event collects instead of rendering one at a time - it cannot say
   * "3 lights on" until it has seen all three. */
  _event(out, name, cfg, idx) {
    if (cfg.enabled === false) return;
    const hass = this._hass;
    const grouped = [];

    /* What the event covers, filters only. Groups are decided against this
     * rather than against the loop below, because which rows are groups is a
     * fact about the event and should not change every time a lamp does.
     *
     * The list is remembered; the states are checked each time. An entity can
     * be gone while the count that invalidates the cache has not moved - one
     * arrived as another left - and everything downstream reads st.state
     * without asking. */
    const covered = [];
    for (const id of this._coveredFor(name, cfg, idx)) {
      if (hass.states[id]) covered.push(id);
    }
    const groups = new Set(
      groupRowEntities(hass, covered, (cfg.include || {}).entities)
    );
    /* Everything inside a group that is getting a row of its own. Whether
     * those are covered too does not matter: they are drawn in there. */
    const inside = new Set();
    for (const id of groups) {
      for (const mid of (hass.states[id].attributes || {}).entity_id || []) {
        inside.add(mid);
      }
    }

    for (const id of covered) {
      const st = hass.states[id];
      /* unavailable and unknown are not states anyone means. They are hidden
       * unless a condition names one outright, because the alternative is the
       * same two lines of boilerplate on every event anybody ever writes. */
      if (st.state === "unavailable" || st.state === "unknown") {
        if (!namesState(cfg.conditions, st.state)) continue;
      }
      if (!this._conditionsMet(cfg.conditions, id)) continue;
      if (groups.has(id)) continue;  // drawn below, with what is in it
      if (inside.has(id)) continue;  // drawn inside the group that holds it
      /* A group whose members this event covers as well: drawing both puts the
       * same lamps on the card twice, and the members are the more useful
       * half. groupRowEntities has already kept the ones where that is not
       * the case. */
      if (!drawable(st)) continue;
      if (groupMode(cfg)) {
        grouped.push(id);
        continue;
      }
      const row = this._decorate(name, cfg, id, st);
      if (row) out.push(ev(row));
    }

    if (groups.size) this._entityGroups(out, name, cfg, groups);
    if (grouped.length) this._grouped(out, name, cfg, grouped);
  }

  /* A group with a row of its own, and the members that are in the state the
   * event is about underneath it.
   *
   * Unlike an area group this row is a real entity, so it is drawn like any
   * other row - its name, its icon, its state, its clock - rather than being
   * invented from the event's name. That is the point of it: the row carries
   * the group's own switch, and one click through it turns off everything in
   * the list below.
   *
   * It stays a group at one member. An area group of one collapses, because
   * nobody asked for that grouping and a chevron hiding a single lamp is
   * furniture; a group is the thing that was selected.
   */
  _entityGroups(out, name, cfg, ids) {
    const hass = this._hass;
    const asEach = wording(cfg, "each");
    for (const id of ids) {
      const st = hass.states[id];
      /* The group answers the event's conditions like anything else: a group
       * that is off is not a row, whatever is inside it. */
      if (st.state === "unavailable" || st.state === "unknown") {
        if (!namesState(cfg.conditions, st.state)) continue;
      }
      if (!this._conditionsMet(cfg.conditions, id)) continue;
      const kept = [];
      /* Members that would have been rows and were excluded. The count is the
       * difference between "nothing in here is happening" and "everything
       * happening in here is something you said not to show" - see below. */
      let shunned = 0;
      for (const mid of (st.attributes || {}).entity_id || []) {
        const mst = hass.states[mid];
        if (!mst) continue;
        if (mst.state === "unavailable" || mst.state === "unknown") {
          if (!namesState(cfg.conditions, mst.state)) continue;
        }
        /* The event's own conditions, asked of each member - "all members that
         * have the configured state". The include is not asked: it selected
         * the group, and it will not match what is inside one (a lamp is not
         * `*_group`). The exclude is, in full: "not that" is not a way of
         * selecting things, it is somebody saying they do not want to see it,
         * and a thing you do not want to see is not one to put in a drawer. */
        if (!this._conditionsMet(cfg.conditions, mid)) continue;
        if (this._shunned(mid, cfg)) { shunned++; continue; }
        const row = this._decorate(name, asEach, mid, mst);
        if (row) kept.push(row);
      }
      /* A group holding nothing but excluded things is not a row.
       *
       * It would be one that says a room is lit and cannot say by what,
       * because the what is the lamp that was excluded - the row is that lamp
       * wearing the room's name, which is the thing the exclude was written to
       * be rid of. Only when something was excluded: a group whose members are
       * simply not in the state yet - `for: 5 minutes`, and the group's own
       * clock passed first - still gets its row, because nothing was withheld
       * from it. */
      if (!kept.length && shunned) continue;
      const e = this._base(name, cfg, id, st);
      const fn = RENDERERS[id.slice(0, id.indexOf("."))];
      if (fn && this[fn](e, cfg, id, st) === false) continue;
      const row = this._applyConfig(e, wording(cfg, "many"), id, {
        name: e.title, area: e.area, n: kept.length,
      });
      /* No chevron over nothing. A group can pass the event while none of its
       * members do - one lamp on for ten seconds under `for: 5 minutes` - and
       * an empty drawer is worse than no drawer. */
      if (kept.length) row.members = kept;
      out.push(ev(row));
    }
  }

  /* The row for one entity: the common shape, then whatever its domain knows,
   * then whatever the configuration says. Three layers, applied in that order,
   * so config wins in one place instead of being checked inside every
   * renderer. */
  _decorate(name, cfg, id, st) {
    const e = this._base(name, cfg, id, st);
    const fn = RENDERERS[id.slice(0, id.indexOf("."))];
    if (fn && this[fn](e, cfg, id, st) === false) return null;
    return this._applyConfig(e, cfg, id, { name: e.title, area: e.area });
  }

  /* `title`, `detail`, `status` and `icon` from the configuration, replacing
   * whatever the domain decided. Interpolated against the entity, with `name`
   * and `area` carried in from the row so a template can say `{name}` without
   * repeating the friendly-name split. */
  _applyConfig(e, cfg, id, vars) {
    /* An empty box is not an instruction, wherever it is written.
     *
     * `wording()` has always treated an empty half that way, and this did not,
     * so `status: ""` blanked the word a timer had put there while
     * `status: {one: ""}` left it alone - the same empty box meaning two
     * different things depending on whether the event happened to group. It is
     * an easy string to end up with: emptying a text box and collapsing a
     * wording both produce one.
     *
     * A template that *resolves* to nothing is a different matter and still
     * draws nothing: "{attr.program}" on a machine between programs was asked
     * for, and answering it with the domain's own word would be answering a
     * question nobody asked. Only the written value is checked. */
    const said = (v) => v != null && v !== "";
    if (said(cfg.title)) e.title = this._interp(cfg.title, id, vars);
    if (said(cfg.detail)) e.sub = this._interp(cfg.detail, id, vars);
    if (said(cfg.status)) e.status = this._interp(cfg.status, id, vars);
    if (cfg.icon) e.icon = cfg.icon;
    /* Resolved here rather than at paint time, so the row carries a colour
     * and not a word to look up. Compiling refused anything that does not
     * resolve, so the guard is for a row built by hand in a test. */
    if (said(cfg.icon_color)) {
      const css = iconColorCss(cfg.icon_color);
      if (css) e.iconColor = css;
    }
    /* The row's accent, where the severity's colour would have gone. The
     * severity still decides where the row sorts and whether a card promotes
     * it; this only decides what it looks like - an alert about the litter box
     * need not be the same red as a smoke alarm. */
    if (said(cfg.color)) {
      const css = iconColorCss(cfg.color);
      if (css) e.color = css;
    }
    if (typeof cfg.tint === "boolean") e.tint = cfg.tint;
    if (cfg.severity) e.severity = cfg.severity;
    if (cfg.time_mode) e.mode = cfg.time_mode;
    if (cfg.show_time === false) e.at = null;
    /* A row never says the same thing twice. The detail line is for what the
     * title did not already say, so "Bath Room" under "Bath Room" is a line of
     * nothing - which is exactly what `title: {one: "{area}"}` produces, the
     * room being where the detail line falls back to anyway.
     *
     * Here rather than in ev(), because a member row never reaches ev(): it is
     * carried inside its group's `members` and drawn from there. */
    if (e.sub && e.sub === e.title) e.sub = "";
    return e;
  }

  /* The common shape. Every renderer starts from this and overrides the two or
   * three fields its domain actually has an opinion about. */
  _base(name, cfg, id, st) {
    const a = st.attributes || {};
    const parts = this._nameParts(a.friendly_name, id);
    const area = this._areaName(id, st) || parts.area || "";
    return {
      key: id,
      category: cfg.category || GENERIC_CATEGORY,
      severity: "info",
      /* The entity's own icon, then the one Home Assistant would have drawn
       * for it, then a ring. A domain renderer overwrites this with its own
       * choice a moment later; this is what the domains nobody wrote a
       * renderer for get, which is most of the house. */
      icon: a.icon || this._stateIcon(id, st) || "mdi:circle-outline",
      title: parts.name,
      sub: area,
      area: area || null,
      status: stateLabel(this._hass, st),
      at: Date.parse(st.last_changed) || null,
      mode: "since",
      entity: id,
    };
  }

  /* One row per area, counting what landed in it.
   *
   * The area is the subject and the count is its state, which is the same
   * grammar every other row uses: title and location on the left, what it is
   * doing and for how long on the right. It read the other way round for a
   * while - "3 lights on" as the title with the room beneath it - which is a
   * fine sentence and the wrong column. A row that puts its state on the left
   * breaks the one thing this card is for, which is that a dishwasher, a
   * radiator and a lit room line up and can be read straight down.
   *
   * An area has no subtitle: it is already the whole of what the row is about.
   *
   * Light group helpers are dropped here rather than by a naming convention: a
   * light group publishes its members in `attributes.entity_id`, which is a
   * fact about the domain and true in every installation, where `_group` in
   * the id is one house's habit. Without it every member room counts twice. */
  _grouped(out, name, cfg, ids) {
    const hass = this._hass;
    const text = this._config.text;
    const mode = groupMode(cfg);
    /* One question, and it has had three answers.
     *
     * First the mapping was dropped on a member row, on the reasoning that
     * `{one, many}` is about a count. That took the author's control away:
     * an event whose members should read "{area}" had no slot to say it in.
     *
     * Then a member took `one`, on the reasoning that a member and a group of
     * one are the same row drawn twice. They are not, and this is where that
     * showed: a member is read underneath the group's own row, which has
     * already said what these things are, while a solo row is read on its own
     * among strangers. Wording both from one slot means a name that suits the
     * group's inside is the name a lone row wears out on the card.
     *
     * So there are three, and `each` falls back to `one` where it is not
     * written - which is every config from before there was a third. */
    const asEach = wording(cfg, "each");
    const buckets = new Map();

    for (const id of ids) {
      const st = hass.states[id];
      const a = st.attributes || {};
      if (Array.isArray(a.entity_id)) continue;
      /* `all` is one bucket with no room of its own, so its title falls back to
       * the event's name rather than to a place. */
      const area = mode === "all" ? null : this._areaName(id, st) || text.elsewhere;
      let bucket = buckets.get(area);
      if (!bucket) {
        bucket = { area, ids: [], at: Infinity };
        buckets.set(area, bucket);
      }
      bucket.ids.push(id);
      const at = Date.parse(st.last_changed);
      if (isFinite(at) && at < bucket.at) bucket.at = at;
    }

    for (const b of buckets.values()) {
      const kept = [];
      for (const id of b.ids) {
        const row = this._decorate(name, asEach, id, hass.states[id]);
        if (row) kept.push(row);
      }
      if (!kept.length) continue;

      /* A group of one is a device with a room written on it twice. One lamp
       * on in the study is "Ceiling, Study Room", not "Study Room" with a
       * chevron hiding the word Ceiling.
       *
       * It is drawn again rather than kept, because it is no longer the row it
       * was built as. Nothing is grouping it, nothing is above it saying what
       * it is, and it will be read among rows from every other event on the
       * card - which is the row `one` is the wording for. */
      if (kept.length === 1) {
        const id = kept[0].key;
        const solo = this._decorate(name, wording(cfg, "one"), id, hass.states[id]);
        out.push(ev(solo || kept[0]));
        continue;
      }

      const members = kept;
      const n = members.length;
      const label = b.area || humanise(name);
      /* The group's clock, taken from the rows inside it rather than from the
       * entities' last_changed.
       *
       * A member's `at` is not always a start: a timer's is `finishes_at`, and
       * reading that instant as "how long has this been so" is off by the
       * whole length of the timer. Worse, the two point opposite ways, so a
       * group of timers with `time_mode: remaining` was counting down to a
       * moment that had already passed and saying "any moment" under two rows
       * that plainly had minutes left.
       *
       * So the direction is settled first - the author's word if there is one,
       * otherwise what the members agree on - and the instant is chosen to
       * match it. Counting down, the group is this way until its *last* member
       * finishes; elapsing, since its first began. Both are the same question
       * asked of the group rather than of any one row in it. */
      const modes = new Set(members.map((m) => m.mode));
      const gmode = cfg.time_mode ||
        (modes.size === 1 ? [...modes][0] : "since");
      /* And the same question asked of the status. Three fans all reading
       * Running make a group that is running, and blanking the word left the
       * row saying less than every row inside it. Only when they agree:
       * Done, Active and Playing have no one word between them, and taking
       * the first would be taking whichever the index reached first. */
      const said = new Set(members.map((m) => m.status));
      const status = said.size === 1 ? [...said][0] : "";
      const counting = gmode === "until" || gmode === "remaining";
      const stamps = members.map((m) => m.at).filter((v) => isFinite(v));
      const at = stamps.length
        ? (counting ? Math.max(...stamps) : Math.min(...stamps))
        : (isFinite(b.at) ? b.at : null);
      const vars = { n: n, name: label, area: b.area || "" };
      const e = {
        key: name + ":" + (b.area || "all"),
        category: cfg.category || GENERIC_CATEGORY,
        severity: "info",
        icon: "mdi:circle-outline",
        title: label,
        sub: "",
        area: b.area,
        status,
        at,
        mode: gmode,
        /* Not b.ids[0]. A grouped row is about the group; opening the first
         * lamp the index happened to reach is answering a question nobody
         * asked. `members` is what a click gets instead - see _handleClick. */
        entity: "",
        /* The room is dropped from a child that would only repeat the row
         * above it - the detail line is for what this row adds, and under
         * Kitchen a second Kitchen adds nothing. An `all` group has no
         * room to repeat, a solo row above kept its own, and a `detail:`
         * template that says something else survives. */
        members: members.map((m) =>
          m.sub && m.sub === b.area ? { ...m, sub: "" } : m
        ),
      };
      const row = this._applyConfig(e, wording(cfg, "many"), b.ids[0], vars);
      /* A room group says the room on its title line. A `title:` template
       * takes that line - "Lights", say - and the room then has nowhere left
       * to be said, which is how a card ended up with two rows called Lights
       * and no way to tell which room either was about. So it moves to the
       * detail line, unless a `detail:` template has claimed that too. */
      if (b.area && row.title !== label && !row.sub) row.sub = b.area;
      out.push(ev(row));
    }
  }

  /* Every renderer below takes the row and fills in what its domain knows.
   * None of them reads the configuration - `_applyConfig` runs afterwards and
   * overrides whatever they decided, which is why the `if (cfg.severity ==
   * null)` guard that used to be repeated in four of them is gone.
   *
   * Returning false suppresses the row outright. Only lights need it.
   *
   * The `_render` prefix is not decoration. These are reached by name through
   * RENDERERS, so a renderer called `_timer` resolved to `this._timer` - which
   * is the tick interval's handle, a number, and calling it threw on every
   * timer row. A namespace that a state field can wander into is not one to
   * look things up in. */
  _renderLight(e, cfg, id, st) {
    const a = st.attributes || {};
    e.icon = a.icon || "mdi:lightbulb";
    /* What a lamp that is on is doing is how bright it is.
     *
     * This was blank, on the reasoning that "On" is the one thing a row in an
     * event about lights that are on does not need to say. True of the word,
     * and it threw away the number with it - so lights were the only domain on
     * the card with nothing on the right, which reads as something missing
     * rather than as something withheld. A dimmable lamp says its brightness;
     * one that only switches says the domain's own word.
     *
     * Rounded up rather than to nearest at the bottom of the scale: a lamp at
     * brightness 1 is on, and "0%" says it is not. */
    const pct = typeof a.brightness === "number"
      ? Math.max(1, Math.round((a.brightness / 255) * 100))
      : null;
    e.status = pct === null
      ? stateLabel(this._hass, st)
      : fill(this._config.text.status.brightness, pct);
  }

  _renderAlarm(e, cfg, id, st) {
    const a = st.attributes || {};
    const state = String(st.state);
    /* A panel is not a room device. Only a registry area counts as a location
     * here; without one the whole friendly name is the title, because
     * `Alarm | Master` split into "Master" under "Alarm" reads as a room
     * called Alarm containing a thing called Master. */
    const where = this._registryArea(id);
    const parts = this._nameParts(a.friendly_name, id);
    e.title = where ? parts.name : [parts.area, parts.name].filter(Boolean).join(SEPARATOR);
    e.sub = where || "";
    e.area = where;
    /* Only a panel that has gone off is asking anything of anyone; arming and
     * pending are transient and worth noticing. */
    e.severity = ALARM_SEVERITY[state] || "info";
    e.icon =
      a.icon ||
      (state === "triggered"
        ? "mdi:shield-alert"
        : state === "disarmed"
        ? "mdi:shield-off-outline"
        : "mdi:shield-home");
  }

  _renderClimate(e, cfg, id, st) {
    const hass = this._hass;
    const text = this._config.text;
    const a = st.attributes || {};
    /* hvac_action is the truth when the integration reports it - a thermostat
     * can be in `heat` while sitting idle at setpoint. SmartIR and similar
     * integrations omit it, so the mode stands in. */
    const action = a.hvac_action || null;
    const idle = action === "idle" || action === "off";

    const mode = action || st.state;
    const isCool = mode === "cooling" || mode === "cool" || mode === "dry" || mode === "drying";
    /* Whichever of the two vocabularies this value came from. `action` is set
     * only when the integration reports hvac_action; otherwise `mode` is the
     * entity's own state and takes the mode key. */
    const label = localized(
      hass,
      (action ? CLIMATE_ACTION_KEY : CLIMATE_MODE_KEY) + mode,
      text.climate[mode],
      humanise(mode)
    );

    const cur = temp(a.current_temperature);
    const set = temp(a.temperature);
    const deg = text.degree;
    const range =
      cur !== null && set !== null
        ? `${cur}${deg} ${text.arrow} ${set}${deg}`
        : cur !== null
        ? `${cur}${deg}`
        : "";

    const parts = this._nameParts(a.friendly_name, id);
    const areaName = this._areaName(id, st) || parts.area || "";
    /* Climate entities are named after their function, not their identity:
     * "Front Bedroom | Heating" leaves nothing but the word "Heating" once the
     * room is split off, and "Heating / Heating" is not a row. When the name is
     * entirely boilerplate the room becomes the subject - which is true anyway,
     * since what is heating is the room. Devices with a name of their own (Air
     * Conditioner) keep it and take the room as detail. */
    const device = this._strip(parts.name, text.strip.climate);
    const where = device ? areaName : "";

    e.title = device || areaName || parts.name;
    e.severity = idle ? "info" : "active";
    e.tone = idle ? null : isCool ? "cool" : "heat";
    e.icon = a.icon || (isCool ? "mdi:snowflake" : "mdi:radiator");
    /* The temperatures are the detail. Where they sit against the room depends
     * on whether the room already carried the title. */
    e.sub = [where, range].filter(Boolean).join(" \u00b7 ") || areaName;
    e.area = areaName;
    e.status = label;
  }

  _renderTimer(e, cfg, id, st) {
    const text = this._config.text;
    const a = st.attributes || {};
    e.title = this._strip(e.title, text.strip.timer);
    /* Running is what an active timer is doing, and it was what every timer
     * row said - so an event written for `state: paused` drew a paused timer
     * reading Running, in green. A timer has three states and only one of them
     * is this one; the other two say what they are. */
    const active = st.state === "active";
    e.severity = active ? "active" : "info";
    e.icon = a.icon || "mdi:fan";
    e.status = active ? text.status.running : stateLabel(this._hass, st);
    /* `finishes_at` is on the timer entity itself. The old cards read
     * `sensor.<timer>_remaining` helpers that do not exist in this config, so
     * every ventilation row rendered "Active for " with nothing after it. */
    e.at = parseHassTime(a.finishes_at) || Date.parse(a.finishes_at) || null;
    /* What is left of it, not when it ends. A timer is something someone set
     * for a length of time, and "28m remaining" is the number they were
     * thinking in; "in 28m" makes them do the subtraction back. */
    e.mode = "remaining";
  }

  _renderMedia(e, cfg, id, st) {
    const text = this._config.text;
    const a = st.attributes || {};
    const track = [a.media_title, a.media_artist].filter(Boolean).join(" \u00b7 ");
    const parts = this._nameParts(a.friendly_name, id);
    e.title = this._strip(parts.name, text.strip.media) || parts.area || parts.name;
    e.icon = a.icon || (st.state === "playing" ? "mdi:play-circle" : "mdi:pause-circle");
    e.sub = track || e.area || "";
  }

  _renderCover(e, cfg, id, st) {
    const text = this._config.text;
    const a = st.attributes || {};
    const pos = num(a.current_position);
    e.icon = a.icon || "mdi:window-shutter-open";
    /* A cover stopped part-way is the interesting case, and core has no state
     * for it - the state is just "open". The percentage is ours; fully open is
     * core's word for it. */
    e.status =
      pos !== null && pos > 0 && pos < 100
        ? fill(text.status.open_pct, pos)
        : stateLabel(this._hass, st, text.status.open);
  }

  _renderVacuum(e, cfg, id, st) {
    const a = st.attributes || {};
    e.icon = a.icon || "mdi:robot-vacuum";
    e.severity = st.state === "error" ? "alert" : "active";
  }

  /* Row templates. `{state}` and `{attr.foo}` read the event's own entity,
   * `{state@other.entity}` reads another, and `{name}`, `{area}` and `{n}` are
   * handed in by the caller - the friendly-name split has already happened by
   * then and doing it twice would be the only expensive part of this.
   *
   * Deliberately not Jinja: a template that needs branching is a template
   * sensor, which can be tested in the template editor and reused elsewhere. */
  _interp(text, entityId, vars) {
    const hass = this._hass;
    const v = vars || {};
    return String(text).replace(/\{([^}]+)\}/g, (_, expr) => {
      /* The first pipe separates what to read from what to do with it. Only
       * the first: a pattern may have alternation in it, and `s/a|b//` is one
       * filter rather than two. */
      const cut = expr.indexOf("|");
      const filter = cut === -1 ? "" : expr.slice(cut + 1).trim();
      const [path, target] = (cut === -1 ? expr : expr.slice(0, cut)).split("@");
      const p = path.trim();
      const out = (value) => applyFilter(String(value == null ? "" : value), filter);
      if (!target && v[p] != null) return out(v[p]);
      const st = hass.states[(target || entityId).trim()];
      if (!st) return out("");
      /* {state} is humanised, {state.raw} is not. Integration states are
       * written for state machines - armed_away, water_shortage - and this
       * lands in a row a person reads. Attributes are left alone: they are
       * already prose more often than not. */
      if (p === "state") return out(humanise(st.state));
      if (p === "state.raw") return out(st.state);
      if (p.startsWith("attr.")) {
        return out(st.attributes[p.slice(5)]);
      }
      return out("");
    });
  }

  _conditionsMet(conditions, self) {
    if (!conditions || !conditions.length) return true;
    const now = new Date();
    for (const cond of conditions) {
      if (!this._condition(cond, self, now)) return false;
    }
    return true;
  }

  _condition(cond, self, now) {
    const kind = cond.condition || conditionKind(cond);

    if (kind === "and") {
      return cond.conditions.every((c) => this._condition(c, self, now));
    }
    if (kind === "or") {
      return cond.conditions.some((c) => this._condition(c, self, now));
    }
    /* Core's `not` passes when *none* of the embedded conditions do, which is
     * NOR rather than the negation of an AND. Written as core words it. */
    if (kind === "not") {
      return !cond.conditions.some((c) => this._condition(c, self, now));
    }

    if (kind === "time") {
      /* A window is a property of the clock, not of something in the house,
       * so this needs no entity. Routing it through a `tod` helper only to
       * read that helper back is a round trip with no destination. */
      if (cond.after != null || cond.before != null) {
        const inside = withinWindow(cond.after, cond.before, now);
        if (inside !== true) return false; // null: unparseable, never matches
      }
      if (cond.weekday != null) {
        const want = (Array.isArray(cond.weekday) ? cond.weekday : [cond.weekday])
          .map((d) => String(d).slice(0, 3).toLowerCase());
        if (want.indexOf(WEEKDAYS[now.getDay()]) === -1) return false;
      }
      return true;
    }

    const st = this._hass.states[cond.entity || self];
    if (!st) return false;

    /* How long it has been this way, core's spelling. Measured from
     * last_changed rather than last_updated: an attribute moving is not the
     * state changing, and "on for five minutes" should not be reset by a
     * brightness tweak. */
    if (cond["for"] != null) {
      const held = parseDuration(cond["for"]);
      const since = Date.parse(st.last_changed);
      if (held === null || !isFinite(since) || now - since < held) return false;
    }

    if (kind === "numeric_state") {
      const raw = cond.attribute != null
        ? (st.attributes || {})[cond.attribute]
        : st.state;
      const value = toNumber(raw);
      /* unavailable, unknown, a word, a missing attribute: not a number, so
       * not above and not below either. A threshold that quietly held for
       * every unavailable sensor would fill the card at exactly the moment
       * something had gone wrong. */
      if (value === null) return false;
      if (cond.above != null) {
        const above = this._threshold(cond.above);
        if (above === null || !(value > above)) return false;
      }
      if (cond.below != null) {
        const below = this._threshold(cond.below);
        if (below === null || !(value < below)) return false;
      }
      return true;
    }

    if (cond.state != null) {
      const want = Array.isArray(cond.state) ? cond.state : [cond.state];
      if (want.map(String).indexOf(st.state) === -1) return false;
    }
    if (cond.state_not != null) {
      const no = Array.isArray(cond.state_not) ? cond.state_not : [cond.state_not];
      if (no.map(String).indexOf(st.state) !== -1) return false;
    }
    return true;
  }

  /* A bound is a number, or the id of an entity holding one - the same
   * latitude an automation gives it. That is what lets a limit live in an
   * input_number and be moved from a dashboard slider instead of by editing
   * this configuration. Checked against the state machine first, so "20.5"
   * stays the number it obviously is. */
  _threshold(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (v == null) return null;
    const key = String(v);
    const st = this._hass.states[key];
    return st ? toNumber(st.state) : toNumber(key);
  }

  _collect() {
    const out = [];
    /* Asked once a frame, not once an event.
     *
     * The index is also the thing that notices entities arriving or leaving,
     * and it notices by counting the keys of hass.states - so sixteen events
     * asking it separately meant counting 1477 keys sixteen times to answer
     * the same question sixteen times over. On the dining-room tablet that
     * alone was 7.7% of the main thread. */
    const idx = this._index();
    for (const [name, cfg] of this._config._events) {
      this._event(out, name, cfg, idx);
    }

    const seen = new Set();
    return out.filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });
  }

  _sortEvents(list, sort) {
    const mode = sort || this._config.sort;
    const now = Date.now();
    return list.sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (s) return s;
      /* Countdowns run the other way round from durations: a timer with four
       * minutes left and the next calendar entry are both "the next thing to
       * happen", so soonest wins regardless of the configured sort. */
      const down = (m) => m === "until" || m === "remaining";
      if (down(a.mode) && down(b.mode)) {
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

  /* The row budget, spent so that no section starves.
   *
   * `max` used to be a slice of the sorted list, which is the same thing as
   * "whatever sorts last is not on the card": fifteen appliance rows pushed
   * every other section off, and the ones that vanished were the ones nobody
   * was thinking about - which is the reason to have a card like this at all.
   * `max_per_section` existed to work around exactly that.
   *
   * So the budget is shared instead. Every section keeps one row, and the rest
   * of the budget goes a row at a time to whichever section is furthest from
   * being whole - which means the biggest sections are the ones that give rows
   * up, and they give them up evenly. What is left over is reported under the
   * section it was taken from, where the number means something, rather than
   * as one figure at the end of the card standing for four different lists.
   *
   * Alerts are never trimmed: a section called "Needs attention" that hides
   * some of what needs attention is worse than no section at all. They come
   * off the top of the budget, and the rest share what is left.
   *
   * Nothing here scrolls. A cap that hides is a cap you can read across a
   * room; a cap that scrolls is a region of a page that a finger cannot get
   * past, which is what this card was doing to a phone. */
  _capSections(sections) {
    /* Kept whole beside the trimmed copy, because a count that cannot be
     * opened is a count nobody asked for: "+4 more" is only worth printing if
     * the four are somewhere. The budget is worked out the same way either
     * way, so opening one section takes nothing from any other - it only draws
     * what this one was already known to be holding back. */
    for (const s of sections) s.all = s.events;
    /* Which section is never trimmed: the one alerts are promoted into, or
     * the alert bucket itself under group_by: severity. By id, not by the
     * word "alerts" - a card that promotes into "urgent" was trimming it. */
    const by = this._config.group_by;
    const promoteTo = this._config.promote_alerts === true
      ? "alerts" : this._config.promote_alerts;
    const fixedId = (s) =>
      s.id === "alerts" || (by === "severity" && s.id === "alert") ||
      (by === "category" && !!promoteTo && s.id === promoteTo);
    const perSection = this._config.max_per_section;
    if (perSection) {
      for (const s of sections) {
        if (fixedId(s)) continue;
        if (s.events.length <= perSection) continue;
        s.over = (s.over || 0) + s.events.length - perSection;
        s.events = s.events.slice(0, perSection);
      }
    }

    const max = this._config.max;
    if (!max) return sections;
    let total = 0;
    for (const s of sections) total += s.events.length;
    if (total <= max) return sections;

    const fixed = sections.filter(fixedId);
    const share = sections.filter((s) => !fixedId(s) && s.events.length);
    let left = max;
    for (const s of fixed) left -= s.events.length;

    /* One row each first: a section reduced to a heading and a count has not
     * been trimmed, it has been deleted with a receipt. */
    const allow = share.map(() => 0);
    for (let i = 0; i < share.length && left > 0; i++) {
      allow[i] = 1;
      left--;
    }
    /* Then a row at a time to whichever section has the fewest so far.
     *
     * The water rises evenly and the tall sections are the ones still sticking
     * out of it: a section that fits under the line is never touched, and what
     * is over the line is cut back to it. Handing rows to whoever was *furthest
     * from whole* instead - the first thing this did - reads like the same idea
     * and is not: it takes one row off every section, so a section of two loses
     * half of itself to spare a section of seven its seventh row.
     *
     * Ties go to the section that can be finished cheapest, so a small one
     * stops asking rather than staying one row short of whole. */
    while (left > 0) {
      let pick = -1;
      for (let i = 0; i < share.length; i++) {
        if (allow[i] >= share[i].events.length) continue;
        if (pick === -1 ||
            allow[i] < allow[pick] ||
            (allow[i] === allow[pick] &&
             share[i].events.length < share[pick].events.length)) {
          pick = i;
        }
      }
      if (pick === -1) break;
      allow[pick]++;
      left--;
    }

    for (let i = 0; i < share.length; i++) {
      const s = share[i];
      if (s.events.length <= allow[i]) continue;
      s.over = (s.over || 0) + s.events.length - allow[i];
      s.events = s.events.slice(0, allow[i]);
    }
    /* A section the budget could not reach at all: no heading, no count, no
     * row. There is nothing honest to draw for it. */
    return sections.filter((s) => s.events.length || fixedId(s));
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
      const other = this._config.text.elsewhere;
      for (const e of events) push(e.area || other, e.area || other, e);
      /* Alphabetical by room. Floor order would be better, but it would need a
       * floor registry lookup per row for a list this short. */
      return this._capSections(
        [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label))
      );
    }

    if (by === "severity") {
      const labels = this._config.text.severities;
      for (const e of events) push(e.severity, labels[e.severity] || e.severity, e);
      return this._capSections(
        [...buckets.values()].sort((a, b) => SEVERITY_RANK[a.id] - SEVERITY_RANK[b.id])
      );
    }

    /* `groups` sets order and headings for the sections you care about. An id
     * that is not in it is not an error - it is a section you have not got
     * round to naming, so it is created, titled from its id and appended after
     * the declared ones. Declaring nothing at all still produces a working
     * card, which is the point: the list is for arranging sections, not for
     * registering them. */
    const cats = this._config.categories;
    const order = cats.map((c) => c.id);
    const labels = {};
    for (const c of cats) labels[c.id] = c.label || humanise(c.id);
    for (const e of events) {
      const id = e.category || GENERIC_CATEGORY;
      if (order.indexOf(id) === -1) {
        order.push(id);
        labels[id] = humanise(id);
      }
    }
    /* A group id, or false. `true` is the old spelling and still means
     * "alerts". The section is created like any other rather than having to be
     * declared, since promoting into a heading that does not exist yet is the
     * normal case now that nothing is declared by default. */
    const promoteTo =
      this._config.promote_alerts === true ? "alerts" : this._config.promote_alerts;
    const promote = !!promoteTo && events.some((e) => e.severity === "alert");
    if (promote && order.indexOf(promoteTo) === -1) {
      order.unshift(promoteTo);
      labels[promoteTo] = humanise(promoteTo);
    }

    for (const e of events) {
      /* Anything wrong is filed under "Needs attention", whichever source
       * found it. A water shortage is not a fact about an appliance that
       * happens to be red - it is the thing to deal with, and burying it three
       * sections down means the one row that earned its colour is the one you
       * have to go looking for. Severity outranks category here; the category
       * still decides where everything else lands. */
      const id = promote && e.severity === "alert" ? promoteTo : e.category;
      push(id, labels[id] || id, e);
    }
    /* A section may order its own rows: appliances read best newest-first,
     * lights by how long they have been on. The card-wide `sort` decided which
     * rows survived `max`; this decides how the survivors read, section by
     * section. */
    const sorts = {};
    for (const c of cats) if (c.sort) sorts[c.id] = c.sort;
    for (const b of buckets.values()) {
      if (sorts[b.id]) this._sortEvents(b.events, sorts[b.id]);
    }
    return this._capSections(
      [...buckets.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    );
  }

  /* --------------------------------------------------------------- render */

  _render() {
    if (!this._root || !this._hass || !this._config) return;
    const events = this._sortEvents(this._collect());

    /* hass fires on every state change in the house. Redrawing unconditionally
     * would rebuild this list many times a second for nothing, so the DOM is
     * only touched when the rendered content would actually differ. Timestamps
     * are in the signature because a row that changed *when* it started is a
     * different row; the per-minute text refresh happens in _tick. */
    /* Everything a row paints, and nothing else.
     *
     * Three fields were missing, and every one of them is state-dependent: a
     * media player's icon turns from play to pause, a thermostat's from
     * radiator to snowflake, an alarm's between three shields, and `mode`
     * decides whether a time reads as elapsed or remaining. A row whose icon
     * changed while its words did not kept the old icon until something else
     * on the card happened to move. Members are signed the same way because
     * _membersHtml draws them through the same _row. */
    const sign = (e) => [e.key, e.severity, e.title, e.sub, e.status, e.at,
                         e.tone, e.icon, e.iconColor, e.color, e.tint, e.mode];
    const sig = JSON.stringify([
      this._config.group_by,
      events.map((e) => [sign(e), e.members ? e.members.map(sign) : 0]),
      /* What is open is part of what is drawn. Without this a toggle changes
       * nothing until some unrelated entity in the house happens to move. */
      [...this._open].sort(),
      [...this._folded].sort(),
      [...this._expanded].sort(),
    ]);
    if (sig === this._sig) return;
    this._sig = sig;

    if (this._config.hide_when_empty) {
      this.style.display = events.length ? "" : "none";
    }

    if (!events.length) {
      this._root.innerHTML =
        `<div class="card"><div class="empty">${esc(this._config.text.empty)}</div></div>`;
      return;
    }

    /* One card per section rather than one card with rules in it.
     *
     * A hairline between groups asks the eye to notice a 1px change in
     * brightness; a real gap between surfaces does the same job pre-attentively
     * and survives being glanced at from across a room. It also matches
     * home-utility-card, which renders its blocks the same way, so a column
     * holding both reads as one system rather than two conventions. */
    const sections = this._sections(events);
    const now = Date.now();
    const split = this._config.split_sections;
    const text = this._config.text;

    const fold = this._config.collapsible;
    const blocks = sections.map((s, i) => {
      const shut = fold && this._folded.has(s.id);
      /* The number beside the heading is how many are happening, not how many
       * are drawn. In hide mode the rows past the cap have already been taken
       * out of s.events, and a heading reading 4 above a "+1 more" line would
       * be answering a question nobody asked. */
      const n = s.events.length + (s.over || 0);
      const head = s.label
        ? `<div class="sec${fold ? " fold" : ""}${shut ? " shut" : ""}"` +
          (fold
            ? ` data-sec-toggle="${esc(s.id)}" role="button" tabindex="0"` +
              ` aria-expanded="${shut ? "false" : "true"}"`
            : "") +
          `>` +
          (fold ? `<ha-icon class="chv" icon="mdi:chevron-down"></ha-icon>` : "") +
          `<span class="lab">${esc(s.label)}</span>` +
          `<span class="cnt">${n}</span></div>`
        : "";
      if (shut) return split ? `<div class="card shut">${head}</div>` : head;
      /* Open, this section draws everything it had; shut, the budget's share
       * of it. Which is a decision the person reading has made, so it survives
       * a house that keeps moving underneath them but not a reload - the same
       * rule the folds and the open groups follow. */
      const open = this._expanded.has(s.id);
      const rows =
        `<div class="rows" data-sec="${esc(s.id)}">` +
        (open ? s.all : s.events)
          .map((e) => this._row(e, now) + this._membersHtml(e, now)).join("") +
        `</div>`;
      /* Reported under the section it was taken from, where the number says
       * something about a list you can see - and now says it to something you
       * can press, since the alternative was telling somebody there are four
       * more of these and no way to find out which. */
      const capped = s.over
        ? `<div class="more" data-more="${esc(s.id)}" role="button" tabindex="0"` +
          ` aria-expanded="${open ? "true" : "false"}">` +
          `${esc(open ? text.less : fill(text.more, s.over))}</div>`
        : "";
      return split ? `<div class="card">${head}${rows}${capped}</div>` : head + rows + capped;
    });

    this._root.innerHTML = split
      ? blocks.join("")
      : `<div class="card joined">${blocks.join("")}</div>`;
  }

  /* Escapes the detail line, then re-promotes the one glyph in it that is doing
   * semantic work. Wrapping happens after escaping, never before, so the span
   * is the only markup that can reach the DOM from a value the house supplied.
   * The arrow survives escaping unchanged and escaping cannot produce one, so
   * there is no way for a device name to smuggle a tag in here. */
  _detailHtml(text) {
    const out = esc(text);
    const arrow = esc(this._config.text.arrow);
    if (!arrow || out.indexOf(arrow) === -1) return out;
    return out.split(arrow).join(`<span class="arw">${arrow}</span>`);
  }

  /* What a grouped row counted, drawn underneath it while it is open. The
   * rows are the ordinary ones, indented and marked so the eye reads them as
   * belonging to the line above rather than as siblings of it. */
  _membersHtml(e, now) {
    if (!e.members || !this._open.has(e.key)) return "";
    return (
      `<div class="kids">` +
      e.members.map((m) => this._row(m, now)).join("") +
      `</div>`
    );
  }

  _row(e, now) {
    const text = this._config.text;
    const time = e.at ? fmtRelative(e.at, e.mode, now, text.time) : "";
    const tone = e.tone ? ` tone-${e.tone}` : "";
    const open = e.members ? this._open.has(e.key) : false;
    const grouped = e.members
      ? ` data-group="${esc(e.key)}" aria-expanded="${open ? "true" : "false"}"`
      : "";
    const tabbable = e.entity || e.members ? ` tabindex="0" role="button"` : "";
    /* The one place a second gesture can announce itself. A row that opens on
     * tap and has an entity behind it says so on hover and to a screen
     * reader; nothing else on the card needs telling. */
    const hint = e.members && e.entity ? ` title="${esc(text.hold)}"` : "";
    /* The accent as a custom property on the row, so one declaration reaches
     * the icon, the status word and the tint through the .sev-* rules below -
     * which read --ev-color first and fall back to the severity's own. */
    const accent = e.color ? ` style="--ev-color:${esc(e.color)}"` : "";
    /* Alerts are tinted unless told otherwise; anything else only when asked. */
    const tinted = e.tint === true || (e.tint !== false && e.severity === "alert");
    /* The caret belongs to the name, not to the edge of the card. It sits
     * right after the title, inside the column the title already has, so a
     * long name gives way to it rather than the other way round. */
    const left =
      `<div class="tx">` +
      `<div class="tline"><div class="t">${esc(e.title)}</div>` +
      (e.members ? `<ha-icon class="exp" icon="mdi:chevron-down"></ha-icon>` : "") +
      `</div>` +
      (e.sub ? `<div class="s">${this._detailHtml(e.sub)}</div>` : "") +
      `</div>`;

    return (
      `<div class="ev sev-${e.severity}${tone}${tinted ? " tint" : ""}` +
      `${open ? " open" : ""}"${accent}` +
      ` data-entity="${esc(e.entity)}"${grouped}${tabbable}${hint}>` +
      /* Inline, because it is this row's colour rather than this card's:
         it has to beat the .sev-* and .tone-* rules, and an inline
         declaration is the one thing that does without !important. */
      `<ha-icon class="ic"${e.iconColor ? ` style="color:${esc(e.iconColor)}"` : ""}` +
      ` icon="${esc(e.icon)}"></ha-icon>` +
      left +
      `<div class="rt">` +
      (e.status ? `<div class="st">${esc(e.status)}</div>` : "") +
      (e.at
        ? `<div class="tm" data-at="${e.at}" data-mode="${e.mode}">${esc(time)}</div>`
        : "") +
      `</div>` +
      `</div>`
    );
  }

  /* Relative times go stale on their own schedule, with no state change to
   * trigger a render. Rewriting the handful of time cells is far cheaper than
   * rebuilding the list, and it leaves focus and hover state alone.
   *
   * The model is rebuilt first, because several rules are answers to the clock
   * rather than to any entity: an `after`/`before` window opening, or a
   * condition's `for:` elapsing on an entity that has not moved. Without this
   * they would only take effect the next time some unrelated entity in the
   * house happened to change. _render's signature check makes the common case
   * - nothing moved - cost one model build and no DOM work. */
  _tick() {
    if (!this._root || !this._config) return;
    if (this._hass) this._render();
    const now = Date.now();
    const t = this._config.text.time;
    const cells = this._root.querySelectorAll(".tm");
    for (const cell of cells) {
      const at = Number(cell.dataset.at);
      if (!isFinite(at)) continue;
      const next = fmtRelative(at, cell.dataset.mode, now, t);
      if (cell.textContent !== next) cell.textContent = next;
    }
  }

  static getStubConfig() {
    return { type: "custom:home-event-card" };
  }
}

/* --------------------------------------------------------------- styles */

const STYLES = `
/* Line height is stated rather than inherited.
 *
 * On a Lovelace view the card picks 1.6 up from the page and every row is
 * spaced by it; mounted anywhere else - the Event Manager draws a real one to
 * preview a row - it fell back to normal and the same card set differently.
 * A card whose spacing depends on what is above it in the DOM is a card that
 * looks wrong somewhere. */
:host { display: block; line-height: var(--ha-line-height-normal, 1.6); }

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
/* A heading that folds says so before it is touched: the chevron is the
   affordance, and it is the only thing that moves. The label keeps its baseline
   alignment, so a folding card and a fixed one line up in the same column. */
.sec.fold { cursor: pointer; user-select: none; }
.sec.fold .chv {
  --mdc-icon-size: 16px;
  width: 16px; height: 16px;
  margin-inline-start: -3px;
  align-self: center;
  color: var(--disabled-text-color);
  transition: transform .15s ease;
}
@media (prefers-reduced-motion: reduce) { .sec.fold .chv { transition: none; } }
.sec.fold.shut .chv { transform: rotate(-90deg); }
/* Folded, the heading is the whole card, so it should not sit on 7px of
   padding meant to separate it from rows that are not there - nor on the 12px
   block padding of a card with something in it. A folded section is a chip. */
.sec.shut { padding-bottom: 0; }
.card.shut { padding-block: 8px; }
.sec.fold:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 6px;
}
/* The label leads once there is a chevron before it. */
.sec.fold .lab { margin-inline-end: auto; }

/* split_sections: false — every section shares one surface, so the break has
   to be drawn rather than left as a gap. This is the layout group_by: area
   wants, where eight rooms would otherwise mean eight small cards. */
.card.joined .rows + .sec {
  border-top: 1px solid var(--divider-color, rgba(255,255,255,.06));
  margin-top: 9px;
  padding-top: 11px;
}
/* Folded, a heading is the whole of its section, so the break that normally
   follows a run of rows has to follow the heading instead. Without this two
   folded sections sit flush against each other with nothing between them. */
.card.joined .sec.shut + .sec {
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

/* Nothing on this card is a scroll container, and that is the rule rather
   than an omission.

   It had two: a pixel ceiling on the whole card, and a per-section window that
   showed n rows and scrolled for the rest. Both are fine with a mouse and both
   are a trap under a finger - a touch gesture latches to whatever scrollable
   thing is beneath it, so a card that covered most of a phone screen was a
   region of the page that could not be scrolled past. A media query withdrew
   them under 600px, which fixed a phone and left every tablet - and a tablet
   held in the hand is the same finger.

   So the card is exactly as tall as the rows it draws, and the max option
   decides how many those are. Cutting by row count is the honest unit anyway: it is the
   one thing the card knows about itself from across a room. */

/* The four-quadrant row: icon | title over detail | status over time. */
.ev {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 6px 6px;
  margin-inline: -6px;
  border-radius: 9px;
  position: relative;
}
/* The caret goes with the name.

   It had a column once: a fourth one pushed a grouped row's status and time
   29px left of every other row on the card, which is the one thing a list
   whose argument is "these line up and can be read straight down" cannot
   afford. So it moved out of the grid and into the card's own padding, hard
   against the right edge - aligned, and crammed into the corner furthest from
   anything it was about, with the row's time ending under it.

   Here instead: immediately after the title, in the column the title already
   has. It reads as a disclosure on the thing it discloses, it costs the grid
   nothing, and a long name gives way to it rather than the other way round -
   the title truncates, the caret stays. Tapping is the row's job either way,
   so this is a sign rather than a target. */
.tline { display: flex; align-items: center; gap: 5px; min-width: 0; }
.tline .t { min-width: 0; }
.ev .exp {
  flex: none;
  --mdc-icon-size: 16px;
  width: 16px; height: 16px;
  color: var(--secondary-text-color);
  opacity: .8;
  transition: transform .15s ease;
}
@media (prefers-reduced-motion: reduce) { .ev .exp { transition: none; } }
.ev.open .exp { transform: rotate(180deg); }

/* What an open row counted.

   The rows are the ordinary rows - same grid, same icon size, same type -
   because that is what they are. Everything here is position, and every
   number is taken from the parent's own metrics rather than picked:

     37px  one indent step: the 26px icon column plus its 11px gap, so a
           child's icon sits under the parent's title
     12px  the centre of that icon column, where the rail hangs from

   Nothing else. A child is an ordinary row that has been moved sideways: its
   status and time share the right edge of every other row on the card, which
   is what the indent is measured against.

   No vertical margin either: .rows already puts 3px between siblings, and
   adding to it made the gap around an open group twice what it is anywhere
   else. */
.kids {
  display: flex; flex-direction: column; gap: 3px;
  padding-left: 37px;
  position: relative;
}
.kids::before {
  content: "";
  position: absolute;
  left: 12px; top: 0; bottom: 0;
  width: 2px; border-radius: 1px;
  background: var(--divider-color, rgba(255,255,255,.10));
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
/* The status word carries weight as well as colour. In a list this dense the
   two say the same thing at different strengths, and weight is what survives
   being read from across a room where a warm grey and a warm amber are not
   reliably distinguishable. */
.rt .st {
  font-size: var(--ha-font-size-s, 12px);
  line-height: var(--ha-line-height-condensed, 1.2);
  font-weight: var(--ha-font-weight-medium, 500);
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
/* Each severity sets the row's colour as a variable, and the icon, the status
   word and the tint read it through --ev-color - which an event's color:
   sets inline on the row and nothing else does. So "an alert, but amber" is
   one declaration rather than three overrides, and a row that says nothing
   about its colour reads exactly as it always has. */
.ev.sev-alert     { --sev-color: var(--error-color, var(--red-color, #d8574a)); }
.ev.sev-attention { --sev-color: var(--warning-color, var(--amber-color, #d8a24e)); }
.ev.sev-active    { --sev-color: var(--success-color, var(--green-color, #5cb87f)); }
.ev.sev-info      { --sev-color: var(--secondary-text-color); }
/* Climate is the single domain that keeps a colour of its own: heat and cold
   are not degrees of urgency, and reading "Cooling" to find out which way the
   house is going defeats the point of a glance panel. */
.ev.tone-heat { --sev-color: var(--state-climate-heat-color, var(--amber-color, #d8a24e)); }
.ev.tone-cool { --sev-color: var(--state-climate-cool-color, var(--blue-color, #5f9ede)); }
.ev .ic { color: var(--ev-color, var(--sev-color)); }
/* The status word carries the colour only where the colour is a warning;
   active and info keep it in the text colour, as they always did. */
.sev-attention .st, .sev-alert .st { color: var(--ev-color, var(--sev-color)); }
/* Alerts are tinted by default and nothing else is; tint: on the event
   turns it on or off for that event - see _row. */
.ev.tint { background: color-mix(in srgb, var(--ev-color, var(--sev-color)) 9%, transparent); }

.empty {
  font-size: var(--ha-font-size-s, 12px);
  color: var(--secondary-text-color);
  padding: 6px 0;
}
/* It says a number and it opens a list, so it has to look like neither a
   sentence nor a button on a form: the same quiet size as the times beside it,
   and the underline a link has, which is the one convention that reads as
   "there is more of this" without taking the eye off the rows. */
.more {
  font-size: var(--ha-font-size-s, 12px);
  color: var(--secondary-text-color);
  padding: 8px 0 0;
  cursor: pointer;
  width: fit-content;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--divider-color, rgba(127,127,127,.4));
  -webkit-tap-highlight-color: transparent;
}
.more:hover { color: var(--primary-text-color); }
.more:focus { outline: none; }
.more:focus-visible {
  outline: 2px solid var(--accent-color, var(--amber-color, #d8a24e));
  outline-offset: 2px;
  border-radius: 4px;
}

/* A row you can hold has to survive being held: half a second of finger on a
   phone otherwise selects the text under it, or raises the browser's own
   callout menu, and the gesture is gone before it lands. Only these rows -
   everything else on the card stays selectable and copyable. */
.ev[data-group][data-entity]:not([data-entity=""]) {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: pan-y;
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
   There is none. The hover and press tints above are state, not motion: they
   apply on the frame the pointer arrives rather than fading in, which is why
   removing the transition left them working.

   The card used to fade new rows in over 180ms, on the argument that a list
   whose job is "what changed" should show what arrived. In practice a row
   appears while you are looking somewhere else, and 180ms is under the
   threshold where it registers at all - so it cost a class, a keyframe, and a
   set of previous keys carried between paints to buy nothing. */
`;

/* The filter engine, for anything that has to answer "which entities does this
 * select" before a card is drawn - the Event Manager's panel counts matches
 * with it while a filter is being typed.
 *
 * Exported rather than reimplemented. A second engine written to agree with
 * this one would be a worse bug than any it could catch: it would be
 * confidently right about a card that is wrong. So this hands out the card's
 * own gate, `_excluded`, on an element that is never attached to a document.
 *
 * `registries` is the {labels, floors} map of id -> entry that the card
 * normally fetches for itself. The panel already has them for its pickers, so
 * it passes them in rather than making every keystroke wait on a round trip.
 */
export function matchEntities(hass, spec) {
  const { include, exclude, registries } = spec || {};
  if (!include) return [];
  /* createElement, not `new HomeEventCard()`: if some other build of this file
   * registered the tag first, this module's class is unregistered and `new`
   * throws Illegal constructor. The registered one is also the more honest
   * answer - it is the build the dashboard is actually drawing with. */
  const probe = document.createElement("home-event-card");
  probe.setConfig({ type: "custom:home-event-card" });
  probe._hass = hass;
  probe._reg = registries || {};
  /* Compiled straight into a holder of its own. `events:` is not something a
   * card config says any more - the library says it - and what this needs is
   * one compiled event rather than a card that has been talked into holding
   * one. */
  const holder = {};
  probe._compileEvents(holder, {
    probe: exclude ? { include, exclude } : { include },
  });
  const cfg = holder.events.probe;
  const out = [];
  for (const id of Object.keys(hass.states || {})) {
    if (!probe._excluded(id, cfg, hass.states[id])) out.push(id);
  }
  return out;
}

/* Of the entities a filter selected, the ones drawn as a group with what is
 * inside them underneath.
 *
 * A group helper publishes its members, so an event that covers both would put
 * the same lamps on the card twice. The rule is not "drop every group" - it is
 * **draw the group unless this event is already drawing what is in it**:
 *
 *   domains: [light]                every lamp is covered too, so every group
 *                                   steps aside and the lamps stand
 *   domains: [light] +
 *   entity_globs: ["*_group"]       nothing inside them is covered, so each is
 *                                   a row with its members inside
 *   entities: [light.kitchen_group] named outright, which is the same choice
 *                                   said a different way - and it holds even
 *                                   where a member was named beside it
 *
 * Nesting falls out of it rather than needing a rule of its own: where groups
 * contain groups, the outer ones are covering their own contents and step
 * aside, and the innermost - the ones whose members are actual lamps - are the
 * rows. A house with floor groups over room groups draws its rooms.
 *
 * Exported because the Event Manager has to agree: it samples an entity to
 * preview and would otherwise pick a group the card never draws.
 */
export function groupRowEntities(hass, ids, listed) {
  const states = (hass && hass.states) || {};
  const covered = new Set(ids || []);
  const named = new Set(listed || []);
  const out = [];
  for (const id of ids || []) {
    const members = ((states[id] || {}).attributes || {}).entity_id;
    if (!Array.isArray(members)) continue;
    if (named.has(id) || !members.some((m) => covered.has(m))) out.push(id);
  }
  return out;
}

/* Of the entities a filter selected, the ones this card would actually draw.
 *
 * The gap between the two is small and entirely real: a light group and its
 * members are all selected by `domains: [light]`, and the card draws the
 * members only. Anything picking one entity out of a filter's result to show
 * it - the Event Manager's preview does exactly that - has to ask this or it
 * will sometimes pick the one thing that is never drawn. */
export function drawableEntities(hass, ids) {
  const states = (hass && hass.states) || {};
  return (ids || []).filter((id) => drawable(states[id]));
}

/* And the other half of the same question: of the entities a filter selects,
 * which ones are in the state the event is about, right now.
 *
 * Same reasoning as above, and the same probe: the card's own `_conditionsMet`
 * answers, so what the panel shows while conditions are being written is what
 * the card will do with them. Conditions read the clock and the state machine,
 * so this is a snapshot - ask again and the answer may differ, which is the
 * point of showing it.
 */
export function passingEntities(hass, ids, conditions) {
  if (!conditions || !conditions.length) return (ids || []).slice();
  const probe = document.createElement("home-event-card");
  probe.setConfig({ type: "custom:home-event-card" });
  probe._hass = hass;
  const holder = {};
  probe._compileEvents(holder, {
    probe: { include: { entity_globs: ["*"] }, conditions },
  });
  const compiled = holder.events.probe.conditions;
  return (ids || []).filter((id) => probe._conditionsMet(compiled, id));
}

/* `iconColorCss` for the Event Manager's colour swatches: the table that
 * paints the rows is the table the form should be showing, and a second
 * copy of it in the panel would be a copy that drifts. */
export { HomeEventCard, CARD_BUILD, iconColorCss };

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
