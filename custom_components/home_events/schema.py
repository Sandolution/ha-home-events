"""What a valid event library looks like.

This is the card's schema written in Python. It is a deliberate second copy
and the only one there will be: the card validates what it is handed at
runtime, and the panel has to be able to say "no" before writing, or the first
sign of a typo is a dashboard that has stopped rendering.

Because it is a copy, `scratchpad/check_schema.py` reads the constants back
out of home-event-card.js and fails when the two disagree. Everything below
that has a counterpart in the card names it in a comment.

Every message here is a whole sentence, starting with a capital and ending
with a full stop, because every one of them is read by a person in a panel
with no other context: it has to say what is wrong, where, and what would
have been right, without being read as the tail of some other sentence.
"""

from __future__ import annotations

from typing import Any

# home-event-card.js: EVENT_KEYS
EVENT_KEYS = [
    "enabled", "category", "group", "include", "exclude", "conditions",
    "severity", "time_mode", "show_time", "title", "detail", "status", "icon",
]
# home-event-card.js: FILTER_KEYS and FILTER_OPTS
FILTER_KEYS = [
    "domains", "floors", "areas", "labels", "devices", "entities",
    "entity_globs",
]
FILTER_OPTS = ["match"]
# home-event-card.js: PLURAL_KEYS
PLURAL_KEYS = ["title", "status", "icon"]
# home-event-card.js: SEVERITIES, TIME_MODES, GROUP_MODES
SEVERITIES = ["alert", "attention", "active", "info"]
TIME_MODES = ["since", "until", "ago", "remaining"]
# home-event-card.js: SORT_MODES — how a section orders the rows inside it.
SORT_MODES = ["recent", "duration", "name"]
GROUP_MODES = [False, True, "area", "all"]
MATCH_MODES = ["any", "all"]
# home-event-card.js: CONDITION_KEYS
CONDITION_KEYS = {
    "state": ["condition", "entity", "state", "state_not", "for"],
    "numeric_state": ["condition", "entity", "attribute", "above", "below", "for"],
    "time": ["condition", "after", "before", "weekday"],
    "and": ["condition", "conditions"],
    "or": ["condition", "conditions"],
    "not": ["condition", "conditions"],
}

# The order an event is written down in, which is the order the editor asks
# its questions in: what does this cover, when does it apply, how should the
# row read. Storage keeps insertion order and the YAML dump follows it, so
# putting an event in this order here is what makes every export readable
# without anybody having to tidy one up by hand.
WRITE_ORDER = [
    "include", "exclude", "conditions",
    "category", "group", "severity", "time_mode", "show_time",
    "title", "detail", "status", "icon",
    "enabled",
]

BOOL_KEYS = ["enabled", "show_time"]
TEXT_KEYS = ["category", "title", "detail", "status", "icon", "severity", "time_mode"]


class InvalidPreset(Exception):
    """A preset that would not survive being handed to the card."""


def _fail(message: str) -> None:
    raise InvalidPreset(message)


def _kind(value: Any) -> str:
    """What something is, in the words the author used to write it."""
    return {
        dict: "a mapping", list: "a list", str: "text", bool: "true or false",
        int: "a number", float: "a number", type(None): "empty",
    }.get(type(value), type(value).__name__)


def _is_map(value: Any) -> bool:
    return isinstance(value, dict)


def _validate_filter(block: Any, where: str) -> None:
    if not _is_map(block):
        _fail(f"A filter is a mapping of dimensions, but {where} is "
              f"{_kind(block)}.")
    named = []
    for key, value in block.items():
        if key in FILTER_OPTS:
            if key == "match" and value not in MATCH_MODES:
                _fail(f'Match must be "any" or "all" in {where}, not '
                      f"{value!r}.")
            continue
        if key not in FILTER_KEYS:
            _fail(f'Unknown filter dimension "{key}" in {where}. The '
                  "dimensions are: " + ", ".join(FILTER_KEYS) + ".")
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            _fail(f'Dimension "{key}" in {where} takes a list of names or ids, '
                  f"but it is {_kind(value)}.")
        if value:
            named.append(key)
    # The card's own rule, and the one worth catching early: two dimensions in
    # one block are ambiguous, and guessing wrong selects hundreds of entities
    # where two dozen were meant.
    if len(named) > 1 and "match" not in block:
        _fail(f"The filter in {where} names {len(named)} dimensions "
              f"({', '.join(named)}), so it has to say which it means: "
              '"match: any" for entities in any of them, "match: all" for '
              "entities in all of them.")


def _validate_conditions(conditions: Any, where: str) -> None:
    if not isinstance(conditions, list):
        _fail(f"Conditions are a list, but {where} is {_kind(conditions)}.")
    for i, cond in enumerate(conditions):
        at = f"{where}[{i}]"
        if not _is_map(cond):
            _fail(f"A condition is a mapping, but {at} is {_kind(cond)}.")
        kind = cond.get("condition")
        if kind not in CONDITION_KEYS:
            _fail(f"Unknown condition {kind!r} in {at}. The conditions are: "
                  + ", ".join(sorted(CONDITION_KEYS)) + ".")
        allowed = CONDITION_KEYS[kind]
        for key in cond:
            if key not in allowed:
                _fail(f'Option "{key}" does not belong to a {kind} condition, '
                      f"in {at}. A {kind} condition takes: "
                      + ", ".join(allowed) + ".")
        if kind in ("and", "or", "not"):
            _validate_conditions(cond.get("conditions") or [], f"{at}.conditions")


def _validate_event(name: str, event: Any) -> None:
    where = f"events.{name}"
    if not _is_map(event):
        _fail(f"An event is a mapping of options, but {where} is "
              f"{_kind(event)}.")
    for key in event:
        if key not in EVENT_KEYS:
            _fail(f'Unknown option "{key}" on {where}. The options are: '
                  + ", ".join(EVENT_KEYS) + ".")

    if not event.get("include"):
        _fail(f'Event "{name}" needs an "include" saying which entities it '
              "covers - a domain, a glob, an entity, a device, an area, a "
              "floor or a label.")
    for side in ("include", "exclude"):
        if event.get(side) is not None:
            _validate_filter(event[side], f"{where}.{side}")

    if event.get("conditions") is not None:
        _validate_conditions(event["conditions"], f"{where}.conditions")

    if event.get("group") is not None and event["group"] not in GROUP_MODES:
        _fail(f"Group on {where} must be \"area\" (one row per room), \"all\" "
              f"(one row for the lot) or false, not {event['group']!r}. "
              '"true" is the old spelling of "area".')
    grouped = event.get("group") in (True, "area", "all")

    if event.get("severity") is not None and event["severity"] not in SEVERITIES:
        _fail(f"Severity {event['severity']!r} on {where} is not on the scale. "
              "Use one of: " + ", ".join(SEVERITIES) + ".")
    if event.get("time_mode") is not None and event["time_mode"] not in TIME_MODES:
        _fail(f"Time mode {event['time_mode']!r} on {where} is not one of: "
              + ", ".join(TIME_MODES) + ".")

    for key in BOOL_KEYS:
        if event.get(key) is not None and not isinstance(event[key], bool):
            _fail(f'Option "{key}" on {where} is true or false, but it is '
                  f"{_kind(event[key])}.")

    for key in TEXT_KEYS:
        value = event.get(key)
        if value is None or isinstance(value, str):
            continue
        if key in PLURAL_KEYS and _is_map(value):
            # The one mapping left in the schema, and only for a row that
            # counts something.
            if not grouped:
                _fail(f'A "one"/"many" wording is only allowed on an event '
                      f'that groups, and {where} does not. Without grouping '
                      f'there is nothing to count, so "{key}" is one piece of '
                      "text.")
            unknown = [k for k in value if k not in ("one", "many")]
            if unknown:
                _fail(f'A wording mapping takes "one" and "many". '
                      f'On {where}.{key} there is also: '
                      + ", ".join(unknown) + ".")
            continue
        _fail(f'Option "{key}" on {where} is text, but it is {_kind(value)}.')


def _ordered(event: dict) -> dict:
    """The same event, written in the order it reads in."""
    out = {key: event[key] for key in WRITE_ORDER if key in event}
    # Anything the schema knows and this list forgot still gets written; a key
    # silently dropped on save is the worst failure this file could have.
    out.update({k: v for k, v in event.items() if k not in out})
    return out


def validate_preset(data: Any) -> dict:
    """Return the preset as it will be stored, or raise InvalidPreset."""
    if not _is_map(data):
        _fail(f"A preset is a mapping with \"events\" in it, but this is "
              f"{_kind(data)}.")

    unknown = [k for k in data
               if k not in ("name", "sort", "non_areas", "categories", "events")]
    if unknown:
        _fail("Unknown key(s) in the preset: " + ", ".join(unknown)
              + '. A preset holds "name", "sort", "non_areas", "categories" '
              'and "events".')

    # How the rows in a section read, for every section that does not say
    # otherwise. A card that states its own `sort` keeps it; this is what a
    # card that says nothing follows.
    if data.get("sort") is not None and data["sort"] not in SORT_MODES:
        _fail(f"Sort {data['sort']!r} is not one of: " + ", ".join(SORT_MODES)
              + ".")

    # Registry areas that are filing cabinets rather than places. A fact about
    # the house, so it is written once here instead of on every card.
    non_areas = data.get("non_areas")
    if non_areas is not None and not isinstance(non_areas, list):
        _fail('"non_areas" is a list of area ids or names, but this is '
              f"{_kind(non_areas)}.")

    events = data.get("events")
    if events is None:
        _fail('The preset needs an "events" mapping, even an empty one.')
    if not _is_map(events):
        _fail("Events are a mapping of name to event, not "
              f"{_kind(events)}. The name is how a card refers to one event.")

    for name, event in events.items():
        if not isinstance(name, str) or not name.strip():
            _fail("Every event needs a name.")
        _validate_event(name, event)

    categories = data.get("categories") or []
    if not isinstance(categories, list):
        _fail("Categories are a list of {id, label}, in the order the sections "
              f"should read, but this is {_kind(categories)}.")
    for i, cat in enumerate(categories):
        if not _is_map(cat) or not cat.get("id"):
            _fail(f'Every entry under "categories" needs an "id", and '
                  f"categories[{i}] has none.")
        unknown = [k for k in cat if k not in ("id", "label", "sort")]
        if unknown:
            _fail(f"Unknown key(s) in categories[{i}]: " + ", ".join(unknown)
                  + '. A category holds "id", "label" and "sort".')
        if cat.get("sort") is not None and cat["sort"] not in SORT_MODES:
            _fail(f"Sort {cat['sort']!r} on section \"{cat['id']}\" is not one "
                  "of: " + ", ".join(SORT_MODES) + ".")

    out = {
        "name": data.get("name") or "",
        "categories": categories,
        "events": {name: _ordered(event) for name, event in events.items()},
    }
    # Only when it says something: a preset that has never been given a
    # default should not grow a key saying it has none.
    if data.get("sort"):
        out["sort"] = data["sort"]
    if data.get("non_areas"):
        out["non_areas"] = list(data["non_areas"])
    return out
