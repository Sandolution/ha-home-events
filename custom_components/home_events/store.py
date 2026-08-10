"""Where the event library lives.

`Store` rather than a YAML file in config/: it writes atomically, it carries a
version so the shape can change without a migration script of its own, and it
is what every other UI-managed thing in Home Assistant does. YAML is an export
format here, not the record - see websocket.py's export/import commands - so
there is never a question of which of two files is the live one.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import DEFAULT_PRESET, DOMAIN, SIGNAL_UPDATED, STORAGE_KEY, STORAGE_VERSION
from .schema import validate_preset

_LOGGER = logging.getLogger(__name__)

# A preset that exists but holds nothing is the right empty state: the panel
# has something to open, and a card pointed at it renders an empty card rather
# than an error about a missing preset.
EMPTY_PRESET: dict[str, Any] = {"name": "Default", "categories": [], "events": {}}


class HomeEventsStore:
    """The event library, and the only thing that writes it."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"presets": {}}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if not data or not isinstance(data.get("presets"), dict):
            data = {"presets": {DEFAULT_PRESET: dict(EMPTY_PRESET)}}
            await self._store.async_save(data)
        self._data = data

    @property
    def presets(self) -> dict[str, Any]:
        return self._data["presets"]

    def preset(self, preset_id: str) -> dict[str, Any] | None:
        return self._data["presets"].get(preset_id)

    async def async_save_preset(self, preset_id: str, data: dict) -> dict:
        """Validate, write, and tell everyone looking. Raises InvalidPreset."""
        clean = validate_preset(data)
        self._data["presets"][preset_id] = clean
        await self._store.async_save(self._data)
        self._notify(preset_id)
        return clean

    async def async_delete_preset(self, preset_id: str) -> None:
        if preset_id not in self._data["presets"]:
            return
        del self._data["presets"][preset_id]
        # Never leave the panel with nothing to open.
        if not self._data["presets"]:
            self._data["presets"][DEFAULT_PRESET] = dict(EMPTY_PRESET)
        await self._store.async_save(self._data)
        self._notify(preset_id)

    def _notify(self, preset_id: str) -> None:
        """Push to every card and panel on the connection.

        This is the point of the integration being a backend at all: a card
        picks the change up as it is saved, where editing a dashboard's YAML
        needs a save and a reload before anything moves.
        """
        async_dispatcher_send(self.hass, SIGNAL_UPDATED, preset_id)
        _LOGGER.debug("%s: preset %s updated", DOMAIN, preset_id)
