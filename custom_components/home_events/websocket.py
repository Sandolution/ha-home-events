"""The API the panel and the cards talk to.

Eight commands. Six of them are admin-only because they write; `library` and
`subscribe` are not, because a card runs as whoever is looking at the dashboard
and a wall tablet is rarely an administrator. Reading the library needs no
privilege that reading the dashboard drawn from it does not.

YAML lives here rather than in the panel. Parsing it in the browser would mean
shipping a parser and trusting it, and the panel would then have two ideas of
what the library says. The panel sends and receives text; this end is the only
thing that turns text into a library, and it validates before anything is
written.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import voluptuous as vol
import yaml

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SCHEMA_VERSION, SIGNAL_UPDATED
from .schema import InvalidLibrary
from .store import HomeEventsStore

_LOGGER = logging.getLogger(__name__)

ERR_INVALID = "invalid_library"
ERR_NOT_FOUND = "not_found"
ERR_NOT_LOADED = "not_loaded"


def _store(hass: HomeAssistant, connection, msg: dict) -> HomeEventsStore | None:
    """The library, or an answer saying why there isn't one.

    The config entry can be unloaded while a dashboard is still open and still
    subscribed. That is a sentence the panel can print, not a traceback in the
    log with a websocket left waiting.
    """
    store = hass.data.get(DOMAIN)
    if store is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED,
                              "Home Events is not set up.")
    return store


def _dump(data: Any) -> str:
    """The library as YAML, in the order it was written.

    sort_keys=False on purpose: an event reads as a sentence - what it covers,
    when it applies, how the row reads - and alphabetising that is a worse
    document than the one somebody wrote.
    """
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True,
                          default_flow_style=False, width=100)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/library"})
@callback
def ws_library(hass: HomeAssistant, connection, msg: dict) -> None:
    """The library: everything a card draws and everything the panel edits."""
    if (store := _store(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], {
        "schema_version": SCHEMA_VERSION,
        **store.library,
    })


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save",
    vol.Required("data"): dict,
})
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection, msg: dict) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    try:
        saved = await store.async_save(msg["data"])
    except InvalidLibrary as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    connection.send_result(msg["id"], saved)


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/export",
    vol.Optional("event"): str,
})
@callback
def ws_export(hass: HomeAssistant, connection, msg: dict) -> None:
    """The whole library as YAML, or one event of it.

    One event is what the panel edits: a dozen lines is a thing a person can
    read in one go, where the whole library is a thing they scroll.
    """
    if (store := _store(hass, connection, msg)) is None:
        return
    library = store.library
    if "event" in msg:
        event = library["events"].get(msg["event"])
        if event is None:
            connection.send_error(msg["id"], ERR_NOT_FOUND,
                                  f"No event named {msg['event']!r}.")
            return
        connection.send_result(msg["id"], {"yaml": _dump(event)})
        return
    connection.send_result(msg["id"], {"yaml": _dump(library)})


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_event",
    vol.Required("name"): str,
    vol.Required("yaml"): str,
    vol.Optional("rename_from"): str,
    vol.Optional("replace"): bool,
})
@websocket_api.async_response
async def ws_save_event(hass: HomeAssistant, connection, msg: dict) -> None:
    """One event, written as text and merged into the library.

    The whole library is validated afterwards, not just the event: a rename
    that orphans a category, or an event that now collides with another name,
    is a fact about the library rather than about the lines just typed.

    `rename_from` is the event this write is about - the same name when
    nothing was renamed, and absent when the event is new. Anything else
    already carrying this name is therefore a *different* event, and writing
    over it needs `replace`, which is the panel saying somebody was asked.
    """
    if (store := _store(hass, connection, msg)) is None:
        return
    library = store.library

    name = msg["name"].strip()
    if not name:
        connection.send_error(
            msg["id"], ERR_INVALID,
            "An event needs a name - it is what a card refers to.")
        return
    try:
        event = yaml.safe_load(msg["yaml"]) or {}
    except yaml.YAMLError as err:
        connection.send_error(msg["id"], ERR_INVALID,
                              f"That is not valid YAML. {err}")
        return
    if not isinstance(event, dict):
        connection.send_error(msg["id"], ERR_INVALID,
                              "An event is a mapping of options, but this is "
                              f"{type(event).__name__}.")
        return

    # Losing an event is a thing to be asked about, not a thing to find out
    # about later. Renaming one onto the name of another used to remove the
    # other silently, and so did saving a new event under a name already in
    # use; there is no undo, no history in the store, and `.storage` is not in
    # anybody's git - so the copy that was overwritten was simply gone.
    old = msg.get("rename_from")
    if name in library["events"] and name != old and not msg.get("replace"):
        connection.send_error(
            msg["id"], ERR_INVALID,
            f'There is already an event called "{name}". Saving this one '
            "under that name would replace it, and a replaced event is gone "
            "for good - rename this one, or export the library first if the "
            "other is worth keeping.")
        return

    # Rebuilt rather than mutated, so a rename keeps its place in the list
    # instead of moving to the end: the order is the author's.
    events: dict[str, Any] = {}
    replaced = False
    for key, value in library["events"].items():
        if key == (old or name):
            events[name] = event
            replaced = True
        elif key == name and old:
            continue  # the rename target existed; the new one wins
        else:
            events[key] = value
    if not replaced:
        events[name] = event

    try:
        saved = await store.async_save({**library, "events": events})
    except InvalidLibrary as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    connection.send_result(msg["id"], saved)


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/delete_event",
    vol.Required("name"): str,
})
@websocket_api.async_response
async def ws_delete_event(hass: HomeAssistant, connection, msg: dict) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    library = store.library
    events = {k: v for k, v in library["events"].items() if k != msg["name"]}
    saved = await store.async_save({**library, "events": events})
    connection.send_result(msg["id"], saved)


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/import",
    vol.Required("yaml"): str,
})
@websocket_api.async_response
async def ws_import(hass: HomeAssistant, connection, msg: dict) -> None:
    """Text in, library out - the panel's raw editor and its paste box.

    Both failures are the author's to fix and both get said in words: YAML
    that does not parse, and YAML that parses into something the card would
    reject.
    """
    if (store := _store(hass, connection, msg)) is None:
        return
    try:
        data = yaml.safe_load(msg["yaml"]) or {}
    except yaml.YAMLError as err:
        connection.send_error(msg["id"], ERR_INVALID,
                              f"That is not valid YAML. {err}")
        return
    try:
        saved = await store.async_save(data)
    except InvalidLibrary as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    connection.send_result(msg["id"], saved)


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/parse",
    vol.Required("yaml"): str,
})
@callback
def ws_parse(hass: HomeAssistant, connection, msg: dict) -> None:
    """Text in, structure out.

    The form editor draws what it can and leaves the rest as YAML in place - a
    nested and/or group, say. Those islands still have to become structure
    before the library can be saved, and there is one parser in this system, so
    they become structure here rather than in a second one written in
    JavaScript.
    """
    try:
        data = yaml.safe_load(msg["yaml"])
    except yaml.YAMLError as err:
        connection.send_error(msg["id"], ERR_INVALID,
                              f"That is not valid YAML. {err}")
        return
    # YAML has dates and timestamps; the websocket has JSON. Anything that
    # cannot survive the trip becomes the text it was written as, which is what
    # the schema wanted from it in the first place.
    connection.send_result(msg["id"],
                           {"data": json.loads(json.dumps(data, default=str))})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection, msg: dict) -> None:
    """Push on every save, so an open dashboard follows the panel."""

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {}))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_UPDATED, forward
    )
    connection.send_result(msg["id"])


@callback
def async_register(hass: HomeAssistant) -> None:
    for handler in (ws_library, ws_save, ws_export, ws_import, ws_save_event,
                    ws_delete_event, ws_parse, ws_subscribe):
        websocket_api.async_register_command(hass, handler)
