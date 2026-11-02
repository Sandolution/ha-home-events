# home-event-card

What the house is doing that you would want to know about, in one list.

Not a dashboard of everything: a card that is empty when nothing is happening
and says something when it is. A light left on, a washing machine finished, a
window open, an alarm not set: each is one row, and rows are filed into
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
than ignoring it. Those were card options once.

---

## The card

```yaml
type: custom:home-event-card
```

That is a complete, working card. Everything below is optional.

| Option | Values | Default | What it is |
|---|---|---|---|
| `group_by` | `category`, `area`, `severity` or `none` | `category` | What the sections are. Anything else is a configuration error. |
| `sort` | `recent`, `duration` or `name` | the library's `sort` | How rows are ordered within a section. Set here, it overrides the library; leave it out to follow the library. Anything else is a configuration error. |
| `max` | a whole number, 1 or more | `14` | How many rows the card draws in total, shared out between the sections rather than sliced off the end. See below. |
| `max_per_section` | a whole number, 0 or more | `0` | A hard limit for one section, applied before the budget is shared. `0` leaves it to `max`. |
| `hide_when_empty` | `true` or `false` | `false` | Whether the card disappears when nothing is happening. A card that vanishes leaves a hole in a sections layout, and a hole reads as a broken card rather than as a quiet house. |
| `collapsible` | `true` or `false` | `false` | Section headings fold their rows. What is folded is a reading position, not a preference, so it is not remembered across a reload. |
| `promote_alerts` | a section id, or `false` | `alerts` | Anything red is filed in this section rather than under its own; `false` leaves it where it is. `true` is the old spelling of `alerts`. Only applies to `group_by: category`. |
| `split_sections` | `true` or `false` | `true` | One card per section, separated by a gap. Turn it off for `group_by: area`, which otherwise makes a card per room. |
| `tidy_names` | `true` or `false` | `false` | Let the card rewrite friendly names. See below. |
| `text` | a mapping, see [text](#text) | | Every string the card writes itself. |

### The row budget

`max` is the size of the card, in the only unit it has: rows.

It is **shared out, not sliced off the end**. Every section keeps at least one
row; the rest of the budget goes a row at a time to whichever section has the
fewest so far, so the line rises evenly and only the sections sticking out of
it get cut. What a section had to leave out is counted underneath it, where the
number is about a list you can see.

**And that count opens it.** Press *+4 more* (or focus it and press Enter, it
is a control like any other row) and the section draws everything it has, with
*Show fewer* in its place to put it back. Nothing else on the card moves: the
budget is worked out the same way whether a section is open or not, so opening
one takes no rows from any other. Like a fold or an opened group, it is a
reading position rather than a preference and does not survive a reload.

With sixteen rows going and `max: 12`:

| section | has | shows | |
|---|---|---|---|
| Needs attention | 1 | 1 | never trimmed |
| Generic | 2 | 2 | under the line |
| Appliances | 3 | 3 | under the line |
| HVAC | 3 | 3 | under the line |
| Lighting | 7 | 3 | **+4 more** |

Slicing the sorted list instead, which is what this used to do, puts whatever
sorts last off the card entirely, and the sections that vanish are the ones you
were not thinking about. That is the reason to have a card like this at all, so
it is the one thing the cap must not do.

**Alerts are never trimmed.** A section called *Needs attention* that hides some
of what needs attention is worse than no section. Those rows come off the top of
the budget and the rest share what is left.

`max_per_section` is a hard limit for one particular list, applied before the
budget is shared. It is for when a section is worth exactly three rows to you however
quiet the rest of the house is. Most configs do not need it. Alerts ignore it,
for the same reason they ignore the budget.

If the budget is too small to give every section even one row, the later
sections go. The order is the one you arranged in the Event Manager, so the
sections you put first are the ones that survive a squeeze.

### Nothing here scrolls

There is no pixel ceiling and no scrolling region, and that is a rule rather
than an omission.

The card had both: `max_height` bounded the whole card, and a capped section
showed *n* rows and scrolled for the rest. Both are fine with a mouse and both
are a trap under a finger: a touch gesture latches onto whatever scrollable
thing is beneath it, so a card covering most of a screen is a part of the page
you cannot scroll past. Withdrawing them under 600px fixed a phone and left
every tablet, and a tablet held in the hand is the same finger.

So the card is exactly as tall as the rows it draws, and `max` decides how many
that is. Naming `max_height` or `overflow` now says so rather than being
ignored.

### Names and locations

**The name is drawn as Home Assistant has it.** The card does not split it,
shorten it, or take words off the end. `Bath Room | Ventilation | Timer` is
the title, all of it.

**The location comes from the area assigned in the registry**: the entity's
own, or its device's. Not from the name.

That is the whole rule, and it is the same rule for everyone. An earlier
version of this card guessed: it took the first `|` segment as the room, on
the convention that names read *Room | Thing | Category*. That convention is
real in the house this was built in, which is exactly how it came to be
assumed. A convention you can see out of your own window looks like a fact.
Somewhere else the first segment is a floor, or a manufacturer, or whose
device it is, and the card would file *Sonos* as a room. Guessing wrong about
the one string somebody wrote themselves is worse than not guessing.

To shorten a name, say so. The template filter is per event and exact:

```yaml
# Ground Floor | Air Purifier -> Air Purifier
title: "{name|s/^[^|]+[|] //}"

# ... | Ventilation | Timer -> ... | Ventilation
title: "{name|s/ [|] Timer$//}"

# both at once: Ground Floor | Air Purifier | Error -> Air Purifier
title: "{name|s/^[^|]+[|] | [|] (State|Error|Status)$//g}"
```

A slot gets **one** replace, so "drop the front and the back" is one pattern
with two alternatives and the `g` flag, not two patterns.

Note what the third one deliberately does *not* do. It drops a listed word,
not "whatever the third segment is", because a third segment is often the only
thing telling two rows apart: `Garden | Irrigation | Border | State` and
`Garden | Irrigation | Grass | State` become **Irrigation · Border** and
**Irrigation · Grass**, where a keep-the-second-segment pattern would make
both of them *Irrigation* and leave you with two identical rows.

**Write a literal pipe as `[|]`, not `\|`.** A bare `|` means alternation. An
escaped one is correct right up until something escapes it a second time, and
`\\|` reads as *a backslash, or nothing*, which matches the empty side and
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
here, because every one of those entities has an area assigned. That is the
usual case, and the reason the registry is the better source. Across this
card's whole library, in a quiet house and with everything running, **no row
lost its location.** Only a room that lives *only* in a name would.

### text

Every string the card writes itself, for translating or rewording. Any subset;
the rest keep their defaults. An unknown key throws rather than being ignored:
a silently accepted typo is a card in two languages.

`{n}` is the only placeholder, and only where noted below.

| Key | Default | |
|---|---|---|
| `empty` | `Nothing going on` | when nothing is happening |
| `elsewhere` | `Elsewhere` | a row with no room to name |
| `degree` | `°` | |
| `arrow` | `→` | between a thermostat's current and target |
| `hold` | `Hold for this group's own controls` | on a group row that has an entity behind it |
| `more` | `+{n} more` | what a section had to leave out, and the way to see it |
| `less` | `Show fewer` | and the way back |

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
| `status.brightness` | `{n}%` |

Times, in the two directions a row can run:

| Key | Default | |
|---|---|---|
| `time.just_now` | `just now` | |
| `time.just_started` | `Just started` | |
| `time.any_moment` | `any moment` | |
| `time.minute` | `{n}m` | the unit, below an hour |
| `time.hour` | `{n}h` | |
| `time.day` | `{n}d` | |
| `time.for` | `For {n}` | `since`: something still running |
| `time.ago` | `{n} ago` | `ago`: something that finished |
| `time.in` | `in {n}` | `until`: something not started yet |
| `time.remaining` | `{n} remaining` | `remaining`: a countdown in progress |

Climate actions and modes. **Every one of these is `null` by default**, which
means "ask Home Assistant": it translates them already, so shipping English
words would make the card English-only for no gain. They are listed because
they are the vocabulary that *can* be overridden, and the merge validates
against this list: `heating`, `cooling`, `drying`, `fan`, `idle`,
`defrosting`, `preheating`, `off`, `heat`, `cool`, `dry`, `fan_only`,
`heat_cool`, `auto`, each written as `climate.<name>`.

Words to take off the end of an entity name, per domain, so a row reads as the
thing rather than as the integration that publishes it:

| Key | Default |
|---|---|
| `strip.timer` | `["Timer"]` |
| `strip.climate` | `["Heating", "Thermostat", "Climate", "Room", "TRV"]` |
| `strip.media` | `["Media Player"]` |

Entity names, area names and media, cover and vacuum states are not in this
block at all. Home Assistant already knows those in the viewer's language.

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
    include: {domains: [switch], areas: [garden], match: all}
    conditions: [{condition: state, state: "on"}]
    category: alerts
    severity: attention
```

| Key | Values | Default | What it is |
|---|---|---|---|
| `sort` | `recent`, `duration` or `name` | `recent` | The default order of rows in a section, for every card that doesn't set its own. |
| `non_areas` | a list of area ids or names | none | Areas that are filing cabinets rather than places. |
| `categories` | a list of sections | none | The sections, in the order they read. Each has an `id` (required), a `label` (the heading; the id when left out) and optionally its own `sort` (`recent`, `duration` or `name`). |
| `events` | a mapping of event name to event | **required**, may be empty | What the house is watching. See [An event](#an-event). |

`non_areas` is a fact about the house: an entity filed under an area called
"System" is shown without a location rather than claiming to be somewhere.

A category id an event names that is not in `categories` is created and
appended, so that list arranges sections rather than registering them.

### An event

| Key | Values | Default | What it is |
|---|---|---|---|
| `include` | a filter, see [include and exclude](#include-and-exclude) | | **Required.** Which entities this covers. |
| `exclude` | a filter | none | Which of those to leave out. |
| `conditions` | a list of conditions, see [conditions](#conditions) | none | And in which state. No conditions means every entity it covers, whatever it is doing. |
| `category` | a section id | the generic section | Which section the rows go in. An id that isn't in `categories` yet is added as a section. |
| `group` | `false`, `area`, `all` or `entries` | `false` | `area` makes one row per room, `all` one row for the lot, `entries` a group per entity with a row for each entry in one of its list attributes (see [A row per entry](#a-row-per-entry)). `true` is the old spelling of `area`. |
| `entries` | `attribute` and optionally `time` | | **Required** with `group: entries`, refused without it. `attribute` is the attribute holding the list; `time` is the field of an entry that is that row's clock. |
| `always_group` | `true` or `false` | `false` | Keep the group row when a group holds one thing, instead of drawing that thing on its own. Only on an event that groups. |
| `severity` | `alert`, `attention`, `active` or `info` | what the card gives that kind of entity, `info` otherwise | The colour of the dot, and where it sorts. |
| `time_mode` | `since`, `until`, `ago` or `remaining`, or one per kind of row | what the card gives that kind of entity, `since` otherwise | How the row's time reads. On a grouped row it also decides *which* of the group's instants is shown; see below. |
| `show_time` | `true` or `false` | `true` | Whether the row carries a time at all. |
| `title` `detail` `status` `icon` | text with placeholders, or one per kind of row | the card's own wording | How the row reads. See below. |
| `icon_color` | a colour, or one per kind of row | the severity's colour | What the icon is coloured. See below. |
| `color` | a colour, or one per kind of row | the severity's colour | The row's colour - icon, status word and tint. See below. |
| `tint` | `true` or `false` | alerts only | Whether the row's background is tinted. |
| `enabled` | `true` or `false` | `true` | `false` keeps the event in the library and draws it on no card. |

"One per kind of row" is a mapping of `one`, `each` and `many`. See [Three
kinds of row, three wordings](#three-kinds-of-row-three-wordings).

### include and exclude

A filter is a mapping of dimension to values. The dimensions are `domains`,
`floors`, `areas`, `labels`, `devices`, `entities` and `entity_globs`.

```yaml
include:
  domains: [light]
  floors: [first_floor, second_floor]
  match: all
```

| Key | Values |
|---|---|
| `domains` | a list of domains, e.g. `[light, switch]` |
| `floors` | a list of floor ids or names |
| `areas` | a list of area ids or names; an entity without its own area counts in its device's |
| `labels` | a list of label ids or names, on the entity, its device or its area |
| `devices` | a list of device ids or names |
| `entities` | a list of entity ids |
| `entity_globs` | a list of patterns with `*` and `?`, e.g. `["*_group", "light.garden_*"]` |
| `match` | `any` or `all`; required when more than one of the above is named, not used otherwise |

A single value may be written without the list. Naming two dimensions is
ambiguous, so a filter that does has to say which it means: `match: any` for entities in either, `match: all` for entities in both.
Guessing wrong selects hundreds of entities where two dozen were meant, so the
schema refuses to guess. Two values of *one* dimension are always "either":
an entity is in one room, and asking for two rooms at once would select
nothing.

**An exclude removes.** The only thing that survives one is an id written into
`include: {entities: [...]}`. Naming one thing is unambiguous in a way a pattern
or a room is not, so "not this room, but that lamp in it" is sayable. Naming
the same id on both sides is a tie, and ties go to the exclude.

| include | exclude | |
|---|---|---|
| `domains: [switch]` | `entities: [switch.pond_pump]` | every switch except the pond pump |
| `entity_globs: ["*_group"]` | `areas: [kitchen]`, `floors: [ground_floor]` | every group except those |
| `entities: [light.hall_lamp]` | `areas: [hallway]` | the hallway is out, that lamp is not |
| `entities: [light.hall_lamp]` | `entities: [light.hall_lamp]` | nothing: a tie goes to the exclude |

This used to be a seven-rung ladder, one rung per dimension, on the reasoning
that narrower should beat broader. It reads well and it silently discarded
whole exclude blocks: a glob outranked a room by two rungs, so an event
including `*_group` and excluding ten areas kept all ten. An exclude that does
nothing is worse than one that is refused.

**An exclude reaches inside a group's drawer too**, however it was written:
by id, by pattern, by room, by floor. The include is not asked there (a lamp is
not `*_group` and never would be), but "not that" is not a way of selecting
things: it is you saying you do not want to see it, and a thing you do not want
to see is not one to put in a drawer.

**And a group left holding nothing but excluded things is not a row.** It would
say a room is lit and be unable to say by what (the what being the lamp you
excluded), so the row is that lamp wearing the room's name, which is the thing
the exclude was written to be rid of.

That last rule fires only when something really was excluded. A group whose
members are simply not in the state yet (`for: 5 minutes`, and the group's own
clock passed first) still gets its row, because nothing was withheld from it.
It just has nothing to open.

The Event Manager fills this in for you and shows the count as you type.

### conditions

Home Assistant's own condition vocabulary, deliberately: `state`,
`numeric_state`, `time`, and the three that hold others: `and`, `or`, `not`.
A condition with no `entity` tests the entity the event matched, which is the
point of the filter above it.

```yaml
conditions:
  - condition: or
    conditions:
      - {condition: state, state: "on"}
      - {condition: numeric_state, attribute: brightness, above: 10}
```

All conditions in the list have to hold.

| Condition | Keys | Values |
|---|---|---|
| `state` | `entity` | an entity id; left out, the entity the event matched |
| | `state` | a state, or a list of states (any of them) |
| | `state_not` | a state, or a list of states (none of them) |
| | `for` | how long it has been so: `"HH:MM:SS"` or `"HH:MM"`, a number of seconds, or a mapping of `hours`, `minutes` and `seconds` |
| `numeric_state` | `entity` | as above |
| | `attribute` | an attribute to test instead of the state |
| | `above` | a number |
| | `below` | a number |
| | `for` | as above |
| `time` | `after` | a time of day, `"HH:MM"` or `"HH:MM:SS"` |
| | `before` | a time of day; a window from 22:00 to 06:00 wraps midnight |
| | `weekday` | a day or a list of days: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` |
| `and`, `or`, `not` | `conditions` | a list of conditions: all of them, any of them, or none of them |

`state` needs `state` or `state_not`, `numeric_state` needs `above` or `below`,
and `time` needs at least one of its three keys.

### How a row reads

`title`, `detail`, `status` and `icon` are templates. Left empty, the domain
decides: a light says its name on the left and how bright it is on the right,
a climate entity says what it is doing and where it is heading. `{name}` is the
friendly name; `{area}` is the room from the registry.

| Placeholder | Reads |
|---|---|
| `{name}` | The friendly name, exactly as Home Assistant has it. |
| `{area}` | The room it is in. |
| `{state}` | What it is doing, in words. |
| `{state.raw}` | The same, spelled the way a condition spells it. |
| `{attr.x}` | Any attribute, by name. |
| `{state@sensor.other}` | Some other entity's state, not this one's. |
| `{n}` | How many rows this one stands for, on a grouped event. |
| `{areas}` | On a group's own row: the rooms of its rows, the room with the most rows first and counted when it has more than one, e.g. `Living Room (2), Garden`. |
| `{entry.x}` | A field of the entry a row stands for, with `group: entries`. `{entry}` for a list of plain values. |

A `|` inside the braces runs a replacement on what was read, written as
`s/pattern/replacement/flags`:

```yaml
title: "{name|s/ [|] (State|Error|Status)$//}"
```

`{name}` is the friendly name exactly as Home Assistant has it, pipes and all,
which is why these patterns look for them, and why a literal pipe wants to be
`[|]` rather than `\|`, as above. Only the *first* `|` separates the name from
the pattern, so a pattern may still contain alternation. After the last slash,
`i` ignores case and `g` replaces every match instead of the first. There is no
case conversion. A pattern that will not compile leaves the text alone and says
so once in the browser console.

The examples on the Event Manager's How tab are checked against this card, so
copying one gives what the page shows it giving. The `{…}` button beside Title,
Detail and Status lists the placeholders this event can use, each with what it
reads right now, and puts the one you click where the cursor was. A placeholder
that will read nothing (an attribute none of the covered entities has, an entry
field no entry has, a name that is not a placeholder) is pointed out under the
field as you type.

Deliberately not Jinja: a template that needs branching is a template sensor,
which can be tested in the template editor and reused elsewhere.

### Where a row's icon comes from

Four answers, first one wins:

| | |
|---|---|
| 1 | the event's own `icon:`, if it sets one |
| 2 | the domain's renderer, for the seven domains that have one (a cooling heat pump is a snowflake, not a thermostat) |
| 3 | the entity's `icon` attribute, if somebody chose one |
| 4 | **whatever Home Assistant would have drawn**, resolved the way core resolves it |

(4) is worth knowing about, because it is not in the entity's state.
`attributes.icon` is filled only when an icon was *chosen*, by the
integration's code or in the entity settings. Everything else Home Assistant
shows is computed in the browser from dictionaries fetched over the websocket,
so a card reading only the attribute draws a blank ring for entities Home
Assistant itself draws properly.

The case that found this: `binary_sensor.weather_warning`, with `device_class:
safety`, state `on`, no icon attribute, and core drawing `mdi:alert-circle`
from a table this card had never asked for.

The card now asks, in core's own order: the entity's `translation_key` in its
integration's icons, then its device class in its domain's icons, then the
domain's plain default. Asked once per integration and per domain, and only
for the ones actually on screen; the answer arrives a moment after the first
paint and the row redraws.

A domain with its own renderer keeps its icon ((2) beats (4)), because those
seven were written to say something core does not. Everything else, which is
most of a house, now matches the rest of the frontend.

### What colour the icon is

Colour on this card means urgency: `severity` decides it, an alert tints its
whole row, and climate keeps its own heat and cold because which way the house
is going is not a degree of urgency. `icon_color` overrides that for one
event's icon, and only the icon. The status word and the alert tint still
answer to `severity`, because those are the scan the list exists for.

Three kinds of value:

| | |
|---|---|
| `alert` `attention` `active` `info` `heat` `cool` | the six the card paints by itself, said out loud; `active` is the green a running washer already wears |
| a Home Assistant palette name | `red`, `amber`, `deep-purple`, `blue-grey`, and the rest, spelled the way the tile card spells them, and `primary`, `accent` and `disabled` too |
| CSS | `#ff8800`, `rgb(...)`, `hsl(...)`, `color-mix(...)`, `var(--my-own-colour)` |

```yaml
plants:
  include: {labels: [Plant]}
  conditions: [{condition: numeric_state, below: 30}]
  icon_color: light-green
```

A palette name resolves to the theme's variable rather than to a hex, so it
follows the theme instead of being frozen at whatever it looked like the day it
was written. A theme that defines none of them leaves the icon the colour it
already had: an undefined `var()` invalidates the declaration and the row's
own colour stands.

A bare word that is not one of the names is refused rather than accepted:
CSS has 148 colour keywords, and a typo among them is an icon that quietly
keeps the colour it had, which is the hardest kind of mistake to find.

### What colour the row is

Severity decides two different things: how loud a row is - where it sorts,
whether a card promotes it into *Needs attention* - and what it looks like.
`color` separates the two. It takes the same values as `icon_color` and paints
the row's accent with them: the icon, the status word where the severity would
have coloured it, and the tint on a tinted row.

```yaml
litter_box:
  include: {entities: [binary_sensor.dining_room_litter_box_stuck]}
  conditions: [{condition: state, state: "on"}]
  severity: alert       # still first, still promoted
  color: deep-purple    # but not the same red as the smoke alarm
```

`icon_color` still wins for the icon alone, so an event may have a purple row
with an amber icon in it. Like `icon_color`, `color` may be worded per kind of
row on a grouping event (`{one, each, many}`).

`tint` is the row's background. Alerts are tinted and nothing else is; that is
the default and it is deliberate - a tint is the one thing that breaks the scan
rather than rewarding it. `tint: true` tints an event's rows whatever their
severity, in the row's colour; `tint: false` leaves an alert untinted.

### Three kinds of row, three wordings

Grouping draws three different rows, and they are read in three different
places. So `title`, `detail`, `status`, `icon`, `icon_color`, `color` and
`time_mode` may each be set once per kind:

| key | the row it words |
|---|---|
| `one` | a row standing for **one entity, on its own**: an event that is not grouping, or a group that turned out to hold a single thing |
| `each` | a row **inside a group that has been opened**, read underneath the group's own row |
| `many` | **the group's own row**, which counts rather than names |

```yaml
title:      {one: Ventilation, each: "{area}", many: Ventilation}
detail:     {one: "{area}",    each: "",       many: Multiple rooms}
icon:       {one: "mdi:fan",   many: "mdi:fan-speed-3"}
icon_color: {one: active,      many: cyan}
time_mode:  {one: remaining,   many: remaining}
```

That reads *Ventilation · Bath Room* when one fan is running, and *Ventilation
· Multiple rooms* with *Bath Room*, *Kitchen*, *Toilet* underneath when three
are.

A group that turns out to hold one thing is drawn as that thing, worded
`one`. With `always_group: true` it keeps its group row, worded `many`, so the
title reads the same for one as for five: *Devices offline*, with the device
underneath.

**`each` falls back to `one` when it is not written.** For two years there were
two wordings and a member row took `one`, so every library written before this
keeps reading exactly as it did.

Only on an event that groups. Without grouping every row it draws is a single
thing, so the schema refuses the mapping rather than quietly picking one third
of it.

Left unset, a wording falls back to whatever the domain decided, usually the
entity's own name. Which is worth knowing when entities are named after the
thing that groups them: with `Bath Room | Ventilation | Timer` unstripped, an
unset `one` gives members reading their whole name under a group reading
*Ventilation*. Nothing is leaking; they are called that.

**The one place to be careful** is `status`, whose wordings are often a count:
`status: {one: "1 light on", many: "{n} lights on"}` used to put *1 light on*
against each of three lamps in an open group. That is what `each` is for: give
it its own wording, or an empty one to let the domain speak.

### An empty wording is not a wording

A text box that was never filled in saves as `""`. That means *nothing was
written*, not *write nothing*, so it is dropped and the card falls back,
rather than drawing an empty line over the top of what it would have said.

This holds wherever the empty string is: a half of a mapping, or the whole
option. `detail: {one: "", many: "Multiple rooms"}` shows the room on a group
of one, and `status: ""` leaves a timer saying *Running*. The two used to
disagree, so whether an empty box was an instruction depended on whether the
event happened to group.

A template that **resolves** to nothing is different, and still draws nothing:
`status: "{attr.program}"` on a machine between programs was asked for, and
answering it with the domain's own word would be answering a question nobody
asked. Only the written value counts.

### A row never says the same thing twice

The detail line is for what the title did not already say, so it is dropped
when the two are equal. `title: {one: "{area}"}` gives *Bath Room* and not
*Bath Room* over *Bath Room*, the room being where the detail line falls back
to anyway. A row inside a group keeps its room, also when the group is named
after it.

### Naming a Home Assistant group

A group helper (a light group, a switch group, anything publishing its members
in `entity_id`) is normally **dropped**, because a filter that selects it
selects its members too and drawing both puts the same lamps on the card twice.
The members win.

**Unless the event does not cover them.** Then there is nothing to draw twice,
so the group becomes the row and the members that are in the state the event is
about are drawn inside it. Either of these does it:

```yaml
# by name
include: {entities: [light.kitchen_group, light.living_room_group]}
conditions: [{condition: state, state: "on"}]

# or by pattern - the same choice, said for every room at once
include:
  domains: [light]
  entity_globs: ["*_group"]
  match: all
conditions: [{condition: state, state: "on"}]
```

There is no `group:` to set. The filter already says it: an event that selects
groups and not their contents is an event about groups.

**Nesting needs no rule of its own.** Where groups contain groups (floor
groups over room groups), the outer ones are covering their own contents and
step aside; the innermost, whose members are actual lamps, are the rows. So a
glob over every group in the house draws its rooms, not one row for the
building.

A group listed by id is always the row, even where a member of it is listed
beside it. Naming it is unambiguous in a way a pattern is not.

What that gets you:

- **The row is the group's own entity**: its name, its icon, its state, its
  clock. Not a label invented from the event's name, the way an area group is.
- **Tap opens it; hold reaches the group itself.** A tap anywhere on the row
  shows what is inside. The whole row, not an 18px chevron, because this card
  gets read one-handed. Press and hold for half a second and Home Assistant's
  own dialog for the group opens, which is where the one switch for the lot
  is. Same pairing as `tap_action` / `hold_action` on core's cards, and the
  row says so on hover. A press that turns into a scroll is a scroll.
- **It stays a group at one member.** An area group of one collapses into that
  one thing, because nobody asked for the grouping. Here somebody did.
- **A member is never also a row beside its group.** Name a group and one of
  its lamps and the lamp appears once, inside.
- `{n}` is how many members are showing, and `one`/`each`/`many` word the row
  and its members as usual.

### A row per entry

Some entities keep a list in an attribute. Device Watch's offline sensor
counts devices and carries them in `devices`, each with a name, an area and
when it went offline. `group: entries` opens such a list: the entity is the
group row, and every entry is a row inside it.

```yaml
devices_offline:
  include: {entities: [sensor.system_device_watch_offline]}
  conditions: [{condition: numeric_state, above: 0}]
  group: entries
  entries: {attribute: devices, time: since}
  always_group: true
  title: {many: Devices offline}
  status: {each: Offline, many: "{n}"}
```

| | |
|---|---|
| the group row | the entity itself: its icon and state, and holding it opens the entity; its detail line says the rooms of the entries (`{areas}`) |
| a row inside | titled with the entry's `name` and with its `area` beside it, unless worded otherwise; `{entry.x}` reads any field of it |
| a tap on a row inside | opens the entry's `entity_id`, or failing that its device's page from `device_id` |
| `{n}` | how many entries the list holds |
| time | with `entries.time`, each row's own clock (`since` above), and the group's follows the same rule as a room's: the earliest counting up, the latest counting down |

One entry is drawn as that entry, worded `one`, unless `always_group` keeps
the group. An empty list is the entity's own row, or with `always_group` a
group of none. The conditions are asked of the entity, not of the entries:
they are not entities and have no state.

### Where a grouped row says its room

A room group says its room on the title line, so its detail line is empty:
"Kitchen" over "Kitchen" is not a second fact. Give the group a `title` of its
own ("Lights") and the room **moves down** to the detail line, because the
title no longer says it.

A group with no room of its own (`group: all`, `group: entries`) says the
rooms of its rows on the detail line: `Garden` when they share one,
`Living Room (2), Garden, Dining Room` when they don't. Rows without a room
are left out of it, and with none at all the line stays empty.

Either way the rows inside keep their own room, so a folded group and an open
one both say where to go. A `detail` template replaces all of this, grouped or
not; `{areas}` puts the list in one of your own.

### What time a grouped row is telling

A group has as many instants as it has members, and it shows one of them. Which
one follows the direction the row is reading in:

| direction | the group shows |
|---|---|
| `since`, `ago` (counting up) | the **earliest**: when the first member started, so the number is how long the group has been this way |
| `until`, `remaining` (counting down) | the **latest**: when the last member finishes, so the number is how long the group will go on |

The direction is `time_mode` if the event names one, and `time_mode` takes a
wording per kind of row like the rest, so the group can read `remaining` while
the rows inside it read `since`. Otherwise it is whatever the members agree on:
a group of timers counts down without being told to, because timers do. Members
that disagree leave the group counting up from the first.

The instant comes from the member rows, not from `last_changed`: a timer's is
its `finishes_at`, and reading that as an elapsed time is wrong by the whole
length of the timer.

### And what status it carries

The same rule, one column to the left: **when every member says the same thing,
the group says it too.** Three fans all reading *Running* make a group that is
running, and a row saying less than every row inside it reads as a row that
lost something.

They have to agree. A washer reading *Done*, a dryer reading *Active* and a
television reading *Playing* have no one word between them, so the group's
status is left empty: taking the first would be taking whichever entity the
index happened to reach first. A `status` of your own overrides either way.

---

## Interaction

A row opens the entity behind it: click, or Enter and Space, since rows carry
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

- `matchEntities(hass, {include, exclude, registries})`: which entities a
  filter selects.
- `drawableEntities(hass, ids)`: of those, the ones this card would put a row
  on. The two differ: a light group and its members are all selected by
  `domains: [light]`, and the card draws the members only.
- `passingEntities(hass, ids, conditions)`: of those, the ones in the state
  the event is about, right now.

A card element also accepts a whole library as a property (`card.library =
{...}`) instead of reading the stored one. That is how the Event Manager
previews a row from a draft that is still being typed. `libraryOk` and
`libraryError` say afterwards whether what was handed over compiled.
