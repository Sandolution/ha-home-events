# home-event-card

What the house is doing that you would want to know about, in one list.

Not a dashboard of everything: a card that is empty when nothing is happening
and says something when it is. A light left on, a washing machine finished, a
window open, an alarm not set — each is one row, and rows are filed into
sections you name.

**Configuration lives in two places, and the line between them is the point.**

- **The library** says what the house is watching: every event, what it
  covers, when it applies, how its rows word themselves. It lives in the
  `home_events` integration and is edited in its sidebar panel, the Event
  Manager. One library; every card reads it.
- **The card** says how that library reads on this dashboard: grouping,
  ordering, caps, heights. Nothing else.

A card that still carries `events`, `categories`, `include`, `exclude`,
`conditions`, `non_areas`, `empty_text` or `preset` says so by name rather
than ignoring it — those were card options once.

---

## The card

```yaml
type: custom:home-event-card
```

That is a complete, working card. Everything below is optional.

| Option | Default | What it is |
|---|---|---|
| `group_by` | `"category"` | `category`, `area`, `severity` or `none` — what the sections are. |
| `sort` | `"recent"` | `recent`, `duration` or `name`. Overrides whatever the library says; leave it out to follow the library. |
| `max` | `14` | Hard cap on rows. The rest become a "+n more" line, which is more honest than a scrollbar on a wall tablet where nobody scrolls. |
| `max_per_section` | `0` | Rows a section shows before it overflows. `0` leaves sections uncapped. A global cap alone starves: fifteen appliance rows push every other section off the card, and the ones that vanish are the ones you were not thinking about. |
| `overflow` | `"scroll"` | What happens past that limit — `scroll` keeps them reachable, `hide` drops them and reports a count. Only `hide` writes a "+n more" line: a scrolling section still has every row it had. |
| `hide_when_empty` | `false` | A card that vanishes leaves a hole in a sections layout, and a hole reads as a broken card rather than as a quiet house. |
| `max_height` | `null` | A ceiling for the whole card, past which it scrolls. A bare number is pixels. `max` caps by row count, which is the unit to use when you know what a row is worth; this is the one for when what you know is how much wall you have. |

| `collapsible` | `false` | Section headings fold their rows. What is folded is a reading position, not a preference, so it is not remembered across a reload. |
| `promote_alerts` | `"alerts"` | A section id, or `false` — anything red is filed there rather than under its own section. Only applies to `group_by: category`. |
| `split_sections` | `true` | One card per section, separated by a gap. Turn it off for `group_by: area`, which otherwise makes a card per room. |
| `tidy_names` | `false` | Let the card rewrite friendly names. Off. See below. |
| `text` | see below | Every string the card writes itself. |

### A capped section, and what it looks like

A section held to `max_per_section` in `scroll` mode keeps every row it had —
the height is what was capped, not the list. The last row on show is deliberately
half-visible and fades out at the bottom edge: that sliver is what says "there is
more here", and it reads from across a room where a scrollbar does not. Scroll to
the last row and the fade goes, because at that point nothing is being withheld.

There is no "+n more" under a scrolling section. The number would be naming a row
the card is already showing. `overflow: hide` is the mode that reports a count,
because that is the mode where rows are actually missing.

**Neither height ceiling applies under 600px wide.** `max_height` and a capped
section both turn part of the page into a scroll container, and on a touch screen
a scroll container is where the page stops scrolling — the gesture latches to
whatever is under the finger, and with a capped section under most of the card
there is nowhere left to start a swipe. On a tablet on a wall that trade is the
whole point: the card holds still, and a wheel or a scrollbar reaches the rest.
On a handset the page scrolls perfectly well by itself, so the card is simply as
tall as it is. `max` still caps the total rows either way.

### Names and locations

**The name is drawn as Home Assistant has it.** The card does not split it,
shorten it, or take words off the end. `Bath Room | Ventilation | Timer` is
the title, all of it.

**The location comes from the area assigned in the registry** — the entity's
own, or its device's. Not from the name.

That is the whole rule, and it is the same rule for everyone. An earlier
version of this card guessed: it took the first `|` segment as the room, on
the convention that names read *Room | Thing | Category*. That convention is
real in the house this was built in, which is exactly how it came to be
assumed — a convention you can see out of your own window looks like a fact.
Somewhere else the first segment is a floor, or a manufacturer, or whose
device it is, and the card would file *Sonos* as a room. Guessing wrong about
the one string somebody wrote themselves is worse than not guessing.

To shorten a name, say so — the template filter is per event and exact:

```yaml
# Ground Floor | Air Purifier → Air Purifier
title: "{name|s/^[^|]+[|] //}"

# … | Ventilation | Timer → … | Ventilation
title: "{name|s/ [|] Timer$//}"

# both at once: Ground Floor | Air Purifier | Error → Air Purifier
title: "{name|s/^[^|]+[|] | [|] (State|Error|Status)$//g}"
```

A slot gets **one** replace, so "drop the front and the back" is one pattern
with two alternatives and the `g` flag — not two patterns.

Note what the third one deliberately does *not* do. It drops a listed word,
not "whatever the third segment is", because a third segment is often the only
thing telling two rows apart: `Garden | Irrigation | Border | State` and
`Garden | Irrigation | Grass | State` become **Irrigation · Border** and
**Irrigation · Grass**, where a keep-the-second-segment pattern would make
both of them *Irrigation* and leave you with two identical rows.

**Write a literal pipe as `[|]`, not `\|`.** A bare `|` means alternation. An
escaped one is correct right up until something escapes it a second time, and
`\\|` reads as *a backslash, or nothing* — which matches the empty side and
eats whatever came next, with no error:

| written | on `Ground Floor \| Air Purifier \| Error` |
|---|---|
| `s/^[^\|]+[\|] //` | `Air Purifier \| Error` |
| `s/^[^\|]+\\| //` | `Air Purifier \| Error` |
| `s/^[^\|]+\\\\| //` | `GroundFloor \| Air Purifier \| Error` ← one space gone |

In a character class it can only ever be a pipe, so it survives being typed
into a form, pasted into single-quoted YAML, or copied through anything else
that has opinions about backslashes.

#### tidy_names

`tidy_names: true` restores the old behaviour for a card that wants it: the
first `|` segment becomes the location, and the words in `text.strip` come off
the end. Kept because the convention is real where it is real; off because the
card cannot tell whether that is here.

Measured on `Bath Room | Ventilation | Timer`:

| | title | location |
|---|---|---|
| default | `Bath Room \| Ventilation \| Timer` | Bath Room |
| `tidy_names: true` | `Ventilation` | Bath Room |
| `tidy_names: true` + `text: {strip: {timer: []}}` | `Ventilation · Timer` | Bath Room |

The location is the same in all three. Turning the splitting off cost nothing
here, because every one of those entities has an area assigned — which is the
usual case, and the reason the registry is the better source. Across this
card's whole library, in a quiet house and with everything running, **no row
lost its location.** Only a room that lives *only* in a name would.

### text

Every string the card writes itself, for translating or rewording. Any subset;
the rest keep their defaults. An unknown key throws rather than being ignored —
a silently accepted typo is a card in two languages.

`{n}` is the only placeholder, and only where noted below.

| Key | Default | |
|---|---|---|
| `empty` | `Nothing going on` | when nothing is happening |
| `elsewhere` | `Elsewhere` | a row with no room to name |
| `degree` | `°` | |
| `arrow` | `→` | between a thermostat's current and target |
| `more` | `+{n} more` | a section's own overflow line |
| `more_events` | `+{n} more events` | the whole card's overflow line |
| `more_event` | `+{n} more event` | the same, when there is one |

Section headings for the four severities, used when `group_by: severity`:

| Key | Default |
|---|---|
| `severities.alert` | `Needs attention` |
| `severities.attention` | `Finished` |
| `severities.active` | `Running` |
| `severities.info` | `Also happening` |

What a row says on the right, for the states the card words itself:

| Key | Default |
|---|---|
| `status.running` | `Running` |
| `status.open` | `Open` |
| `status.open_pct` | `{n}% open` |

Times, in the two directions a row can run:

| Key | Default | |
|---|---|---|
| `time.just_now` | `just now` | |
| `time.just_started` | `Just started` | |
| `time.any_moment` | `any moment` | |
| `time.minute` | `{n}m` | the unit, below an hour |
| `time.hour` | `{n}h` | |
| `time.day` | `{n}d` | |
| `time.for` | `For {n}` | `since` — something still running |
| `time.ago` | `{n} ago` | `ago` — something that finished |
| `time.in` | `in {n}` | `until` — something not started yet |
| `time.remaining` | `{n} remaining` | `remaining` — a countdown in progress |

Climate actions and modes. **Every one of these is `null` by default**, which
means "ask Home Assistant" — it translates them already, so shipping English
words would make the card English-only for no gain. They are listed because
they are the vocabulary that *can* be overridden, and the merge validates
against this list: `heating`, `cooling`, `drying`, `fan`, `idle`,
`defrosting`, `preheating`, `off`, `heat`, `cool`, `dry`, `fan_only`,
`heat_cool`, `auto` — each written as `climate.<name>`.

Words to take off the end of an entity name, per domain, so a row reads as the
thing rather than as the integration that publishes it:

| Key | Default |
|---|---|
| `strip.timer` | `["Timer"]` |
| `strip.climate` | `["Heating", "Thermostat", "Climate", "Room", "TRV"]` |
| `strip.media` | `["Media Player"]` |

Entity names, area names and media, cover and vacuum states are not in this
block at all — Home Assistant already knows those in the viewer's language.

---

## The library

One library in `.storage`, written by the Event Manager and read by every card
that draws from it. Edit it in the panel; this is what the YAML it exports
and imports looks like.

```yaml
sort: recent          # the default order for rows in a section
non_areas:            # registry areas that are filing cabinets, not places
  - system
categories:           # the sections, in order, and their headings
  - id: alerts
    label: Needs attention
  - id: appliances
    sort: recent      # a section may order its own rows
events:
  pumps:
    include: {domains: [switch], areas: [garden]}
    match: all
    conditions: [{condition: state, state: "on"}]
    category: alerts
    severity: attention
```

`non_areas` is a fact about the house — an entity filed under an area called
"System" is shown without a location rather than claiming to be somewhere.

A category id an event names that is not in `categories` is created and
appended, so that list arranges sections rather than registering them.

### An event

| Key | What it is |
|---|---|
| `include` | Which entities this covers. **Required.** |
| `exclude` | Which of those to leave out. |
| `conditions` | And in which state. No conditions means every entity it covers, whatever it is doing. |
| `category` | Which section the rows go in. Omit it for the generic section. |
| `group` | `false`, `"area"` (one row per room) or `"all"` (one row for the lot). `true` is the old spelling of `area`. |
| `severity` | `alert`, `attention`, `active` or `info` — the colour of the dot, and where it sorts. |
| `time_mode` | `since`, `until`, `ago` or `remaining`. |
| `show_time` | Whether the row carries a time at all. |
| `title` `detail` `status` `icon` | How the row reads. See below. |
| `enabled` | `false` keeps the event in the library and draws it on no card. |

### include and exclude

A filter is a mapping of dimension to values. The dimensions are `domains`,
`floors`, `areas`, `labels`, `devices`, `entities` and `entity_globs`.

```yaml
include:
  domains: [light]
  floors: [first_floor, second_floor]
  match: all
```

Naming two dimensions is ambiguous, so a filter that does has to say which it
means: `match: any` for entities in either, `match: all` for entities in both.
Guessing wrong selects hundreds of entities where two dozen were meant, so the
schema refuses to guess. Two values of *one* dimension are always "either" —
an entity is in one room, and asking for two rooms at once would select
nothing.

The Event Manager fills this in for you and shows the count as you type.

### conditions

Home Assistant's own condition vocabulary, deliberately: `state`,
`numeric_state`, `time`, and the three that hold others — `and`, `or`, `not`.
A condition with no `entity` tests the entity the event matched, which is the
point of the filter above it.

```yaml
conditions:
  - condition: or
    conditions:
      - {condition: state, state: "on"}
      - {condition: numeric_state, attribute: brightness, above: 10}
```

### How a row reads

`title`, `detail`, `status` and `icon` are templates. Left empty, the domain
decides — a light says its name, a climate entity says what it is doing.

| Placeholder | Reads |
|---|---|
| `{name}` | The entity, without the room. |
| `{area}` | The room it is in. |
| `{state}` | What it is doing, in words. |
| `{state.raw}` | The same, spelled the way a condition spells it. |
| `{attr.x}` | Any attribute, by name. |
| `{state@sensor.other}` | Some other entity's state, not this one's. |
| `{n}` | How many rows this one stands for, on a grouped event. |

A `|` inside the braces runs a replacement on what was read, written as
`s/pattern/replacement/flags`:

```yaml
title: "{name|s/ [|] (State|Error|Status)$//}"
```

`{name}` is the friendly name exactly as Home Assistant has it, pipes and all,
which is why these patterns look for them — and why a literal pipe wants to be
`[|]` rather than `\|`, as above. Only the *first* `|` separates the name from
the pattern, so a pattern may still contain alternation. After the last slash,
`i` ignores case and `g` replaces every match instead of the first. There is no
case conversion. A pattern that will not compile leaves the text alone and says
so once in the browser console.

The examples on the Event Manager's How tab are checked against this card, so
copying one gives what the page shows it giving.

Deliberately not Jinja: a template that needs branching is a template sensor,
which can be tested in the template editor and reused elsewhere.

### Where a row's icon comes from

Four answers, first one wins:

| | |
|---|---|
| 1 | the event's own `icon:`, if it sets one |
| 2 | the domain's renderer, for the seven domains that have one — a cooling heat pump is a snowflake, not a thermostat |
| 3 | the entity's `icon` attribute, if somebody chose one |
| 4 | **whatever Home Assistant would have drawn**, resolved the way core resolves it |

(4) is worth knowing about, because it is not in the entity's state.
`attributes.icon` is filled only when an icon was *chosen* — by the
integration's code, or in the entity settings. Everything else Home Assistant
shows is computed in the browser from dictionaries fetched over the websocket,
so a card reading only the attribute draws a blank ring for entities Home
Assistant itself draws properly.

The case that found this: `binary_sensor.weather_warning` — `device_class:
safety`, state `on`, no icon attribute, and core drawing `mdi:alert-circle`
from a table this card had never asked for.

The card now asks, in core's own order: the entity's `translation_key` in its
integration's icons, then its device class in its domain's icons, then the
domain's plain default. Asked once per integration and per domain, and only
for the ones actually on screen; the answer arrives a moment after the first
paint and the row redraws.

A domain with its own renderer keeps its icon — (2) beats (4) — because those
seven were written to say something core does not. Everything else, which is
most of a house, now matches the rest of the frontend.

### One wording or two

An event that groups may word `title`, `detail`, `status` and `icon` twice —
once for a row standing for one thing, once for a row that is counting:

```yaml
title:  {one: Light, many: Lights}
detail: {one: "{area}", many: "{n} rooms"}
icon:   {one: "mdi:lightbulb", many: "mdi:lightbulb-multiple"}
```

Only on an event that groups. Without grouping there is nothing to count, so
the schema refuses the mapping rather than quietly picking one of the two.

`one` is the wording for a row that **stands for a single entity**, and there
are two such rows:

- a group that turned out to hold exactly one thing
- **every member inside a group that is open**

They are the same row drawn in two places, so they read the same way. That is
what makes the members controllable: `title: {one: "{area}", many:
"Ventilation"}` gives a group row that says *Ventilation* over members that
say *Bath Room*, *Kitchen*, *Toilet*.

Left unset, `one` falls back to whatever the domain decided — usually the
entity's own name. Which is worth knowing when entities are named after the
thing that groups them: `Bath Room | Ventilation | Timer` becomes "Ventilation"
once the room and the machine word come off, so an unset `one` gives three
members all reading *Ventilation* under a group reading *Ventilation*. Nothing
is leaking; they are called that. Set `one` to say something else.

**The one place to be careful** is `status`, whose two wordings are usually a
count: `status: {one: "1 light on", many: "{n} lights on"}` puts *1 light on*
against each of three lamps in an open group. A `one` that would read badly on
a member is a `one` not to write.

### An empty wording is not a wording

A text box that was never filled in saves as `""`. That means *nothing was
written*, not *write nothing* — so an empty half is dropped and the card falls
back, rather than drawing an empty line over the top of what it would have
said.

This is why `detail: {one: "", many: "Multiple rooms"}` shows the room on a
group of one instead of a blank second line.

### A row never says the same thing twice

The detail line is for what the title did not already say, so it is dropped
when the two are equal. `title: {one: "{area}"}` gives *Bath Room* and not
*Bath Room* over *Bath Room* — the room being where the detail line falls back
to anyway. Same reason a member's detail drops the room its group already
names.

### Why a grouped row's detail line is usually empty

Because the room is already on its title line. "Kitchen" over "Kitchen" is not
a second fact, so the line is left empty rather than filled with a repeat.

Two things change it, and both are deliberate:

- give the group a `title` of its own — "Lights" — and the room **moves down**
  to the detail line, because the title no longer says it
- write a `detail` template and it is drawn, grouped or not

So an empty detail line on a grouped row means nothing was asked for. It is
not the card declining to draw one.

---

## Interaction

A row opens the entity behind it — click, or Enter and Space, since rows carry
`tabindex` and `role="button"` and that would be a lie without a keyboard
path. A grouped row expands to its members instead; a member row opens its own
entity.

Durations are shown to the minute, so the card re-renders on a 30-second tick.
A tablet with its screen off recomputes nothing: the tick is suspended while
the page is hidden.

## For other code

The card exports its own engine rather than having it reimplemented, because a
second one written to agree with this one would be confidently right about a
card that is wrong. The Event Manager's panel uses all three.

- `matchEntities(hass, {include, exclude, registries})` — which entities a
  filter selects.
- `drawableEntities(hass, ids)` — of those, the ones this card would put a row
  on. The two differ: a light group and its members are all selected by
  `domains: [light]`, and the card draws the members only.
- `passingEntities(hass, ids, conditions)` — of those, the ones in the state
  the event is about, right now.

A card element also accepts a whole library as a property — `card.library =
{…}` — instead of reading the stored one. That is how the Event Manager
previews a row from a draft that is still being typed. `libraryOk` and
`libraryError` say afterwards whether what was handed over compiled.
