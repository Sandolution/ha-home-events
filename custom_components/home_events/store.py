"""Where the event library lives.

`Store` rather than a YAML file in config/: it writes atomically, it carries a
version so the shape can change without a migration script of its own, and it
is what every other UI-managed thing in Home Assistant does. YAML is an export
format here, not the record - see websocket.py's export/import commands - so
there is never a question of which of two files is the live one.

There is one library. Version 1 of this store kept a mapping of them under
`presets` on the theory that a wall tablet might draw a different set from the
phone; nothing was ever built that could make a second one, so the key was a
level of nesting, a parameter on nine websocket commands and an option on the
card, all in aid of a case that never arrived. Version 2 is the library.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (DOMAIN, SCHEMA_VERSION, SIGNAL_UPDATED, STORAGE_KEY,
                    STORAGE_VERSION)
from .schema import InvalidLibrary, validate_library

_LOGGER = logging.getLogger(__name__)

# A library that exists but holds nothing is the right empty state: the panel
# has something to open, and a card reading it draws an empty card rather than
# an error about a missing library.
EMPTY_LIBRARY: dict[str, Any] = {"categories": [], "events": {}}


class HomeEventsMigratingStore(Store):
    """The store, and how each older shape becomes the current one."""

    async def _async_migrate_func(
        self, old_major_version: int, old_minor_version: int, old_data: dict
    ) -> dict:
        if old_major_version < 2:
            presets = old_data.get("presets") or {}
            # `default` is the one every card and the panel ever named; if it
            # is somehow gone, the first one is still a library and losing it
            # would be worse than guessing.
            chosen = "default" if "default" in presets else next(iter(presets), None)
            library = dict(presets.get(chosen) or EMPTY_LIBRARY)
            # A library had a name so a selector could label it. There is no
            # selector.
            library.pop("name", None)
            if len(presets) > 1:
                _LOGGER.warning(
                    "%s: storage held %d presets (%s) and only one library is "
                    "kept - %r. The others are in the pre-migration copy of "
                    ".storage/%s.",
                    DOMAIN, len(presets), ", ".join(sorted(presets)), chosen,
                    STORAGE_KEY,
                )
            old_data = {"library": library}
        return old_data


class HomeEventsStore:
    """The event library, and the only thing that writes it."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = HomeEventsMigratingStore(
            hass, STORAGE_VERSION, STORAGE_KEY
        )
        self._data: dict[str, Any] = {"library": dict(EMPTY_LIBRARY)}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if not data or not isinstance(data.get("library"), dict):
            data = {"library": dict(EMPTY_LIBRARY)}
            await self._store.async_save(data)
        self._data = data

    @property
    def library(self) -> dict[str, Any]:
        return self._data["library"]

    async def async_save(self, data: dict) -> dict:
        """Validate, write, and tell everyone looking. Raises InvalidLibrary.

        A library may arrive carrying the schema version it was written
        against - everything this integration hands out is stamped with one,
        so anything read and saved again brings it back. The schema takes it
        and drops it; the only thing worth refusing is a number from the
        future, which would mean keeping the keys this version knows and
        losing the rest without a word.
        """
        stamp = data.get("schema_version")
        if isinstance(stamp, int) and not isinstance(stamp, bool) \
                and stamp > SCHEMA_VERSION:
            raise InvalidLibrary(
                f"This library was written against schema version {stamp}, and "
                f"this version of the Events integration understands version "
                f"{SCHEMA_VERSION}. Update the integration before importing it "
                "- anything newer in it would be dropped without a word.")
        clean = validate_library(data)
        self._data["library"] = clean
        await self._store.async_save(self._data)
        self._notify()
        return clean

    def _notify(self) -> None:
        """Push to every card and panel on the connection.

        This is the point of the integration being a backend at all: a card
        picks the change up as it is saved, where editing a dashboard's YAML
        needs a save and a reload before anything moves.
        """
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)
        _LOGGER.debug("%s: library updated", DOMAIN)
