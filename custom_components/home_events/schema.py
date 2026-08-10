"""What a valid event library looks like.

This is the card's schema written in Python. It is a deliberate second copy
and the only one there will be: the card validates what it is handed at
runtime, and the panel has to be able to say "no" before writing, or the first
sign of a typo is a dashboard that has stopped rendering.

Because it is a copy, `scripts/check_schema_drift.py` reads the constants back
out of home-event-card.js and fails when the two disagree. Everything below
that has a counterpart in the card names it in a comment.
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

BOOL_KEYS = ["enabled", "show_time"]
TEXT_KEYS = ["category", "title", "detail", "status", "icon", "severity", "time_mode"]


class InvalidPreset(Exception):
    """A preset that would not survive being handed to the card."""


def _fail(where: str, message: str) -> None:
    raise InvalidPreset(f"{where}: {message}")


def _is_map(value: Any) -> bool:
    return isinstance(value, dict)


def _validate_filter(block: Any, where: str) -> None:
    if not _is_map(block):
        _fail(where, "a filter is a mapping of dimensions, not "
                     f"{type(block).__name__}")
    named = []
    for key, value in block.items():
        if key in FILTER_OPTS:
            if key == "match" and value not in MATCH_MODES:
                _fail(f"{where}.match",
                      f"must be {' or '.join(MATCH_MODES)}, not {value!r}")
            continue
        if key not in FILTER_KEYS:
            _fail(f"{where}.{key}",
                  "unknown filter dimension. Known: " + ", ".join(FILTER_KEYS))
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            _fail(f"{where}.{key}", "takes a list of names or ids")
        if value:
            named.append(key)
    # The card's own rule, and the one worth catching early: two dimensions in
    # one block are ambiguous, and guessing wrong selects hundreds of entities
    # where two dozen were meant.
    if len(named) > 1 and "match" not in block:
        _fail(where,
              f"names {len(named)} dimensions ({', '.join(named)}) and must say "
              "`match: any` (in any of them) or `match: all` (in all of them)")


def _validate_conditions(conditions: Any, where: str) -> None:
    if not isinstance(conditions, list):
        _fail(where, "a list of conditions")
    for i, cond in enumerate(conditions):
        at = f"{where}[{i}]"
        if not _is_map(cond):
            _fail(at, "a condition is a mapping")
        kind = cond.get("condition")
        if kind not in CONDITION_KEYS:
            _fail(at, f"unknown condition {kind!r}. Known: "
                      + ", ".join(sorted(CONDITION_KEYS)))
        allowed = CONDITION_KEYS[kind]
        for key in cond:
            if key not in allowed:
                _fail(f"{at}.{key}",
                      f"not an option of a {kind} condition. Known: "
                      + ", ".join(allowed))
        if kind in ("and", "or", "not"):
            _validate_conditions(cond.get("conditions") or [], f"{at}.conditions")


def _validate_event(name: str, event: Any) -> None:
    where = f"events.{name}"
    if not _is_map(event):
        _fail(where, "an event is a mapping of options")
    for key in event:
        if key not in EVENT_KEYS:
            _fail(f"{where}.{key}",
                  "unknown option. Known: " + ", ".join(EVENT_KEYS))

    if not event.get("include"):
        _fail(where, "needs an `include` saying which entities it covers")
    for side in ("include", "exclude"):
        if event.get(side) is not None:
            _validate_filter(event[side], f"{where}.{side}")

    if event.get("conditions") is not None:
        _validate_conditions(event["conditions"], f"{where}.conditions")

    if event.get("group") is not None and event["group"] not in GROUP_MODES:
        _fail(f"{where}.group",
              f"{event['group']!r} is not a grouping. Use `area` (one row per "
              "room), `all` (one row for the lot) or false. `true` is the old "
              "spelling of area")
    grouped = event.get("group") in (True, "area", "all")

    if event.get("severity") is not None and event["severity"] not in SEVERITIES:
        _fail(f"{where}.severity",
              f"{event['severity']!r} is not one of " + ", ".join(SEVERITIES))
    if event.get("time_mode") is not None and event["time_mode"] not in TIME_MODES:
        _fail(f"{where}.time_mode",
              f"{event['time_mode']!r} is not one of " + ", ".join(TIME_MODES))

    for key in BOOL_KEYS:
        if event.get(key) is not None and not isinstance(event[key], bool):
            _fail(f"{where}.{key}", "true or false")

    for key in TEXT_KEYS:
        value = event.get(key)
        if value is None or isinstance(value, str):
            continue
        if key in PLURAL_KEYS and _is_map(value):
            # The one mapping left in the schema, and only for a row that
            # counts something.
            if not grouped:
                _fail(f"{where}.{key}",
                      "may only be a `one`/`many` mapping when the event "
                      "groups - without grouping there is nothing to count")
            unknown = [k for k in value if k not in ("one", "many")]
            if unknown:
                _fail(f"{where}.{key}",
                      "a wording mapping takes `one` and `many`, not "
                      + ", ".join(unknown))
            continue
        _fail(f"{where}.{key}", "text")


def validate_preset(data: Any) -> dict:
    """Return the preset as it will be stored, or raise InvalidPreset."""
    if not _is_map(data):
        _fail("preset", "a mapping with `events` in it")

    unknown = [k for k in data if k not in ("name", "categories", "events")]
    if unknown:
        _fail("preset", "unknown key(s) " + ", ".join(unknown)
              + ". A preset holds `name`, `categories` and `events`")

    events = data.get("events")
    if events is None:
        _fail("preset", "needs an `events` mapping, even an empty one")
    if not _is_map(events):
        _fail("preset.events",
              "a mapping of name -> event, not a list. The name is how a card "
              "refers to one event")

    for name, event in events.items():
        if not isinstance(name, str) or not name.strip():
            _fail("preset.events", "every event needs a name")
        _validate_event(name, event)

    categories = data.get("categories") or []
    if not isinstance(categories, list):
        _fail("preset.categories",
              "a list of {id, label}, in the order the sections should read")
    for i, cat in enumerate(categories):
        if not _is_map(cat) or not cat.get("id"):
            _fail(f"preset.categories[{i}]", "needs an `id`")
        unknown = [k for k in cat if k not in ("id", "label")]
        if unknown:
            _fail(f"preset.categories[{i}]",
                  "unknown key(s) " + ", ".join(unknown))

    return {
        "name": data.get("name") or "",
        "categories": categories,
        "events": events,
    }
