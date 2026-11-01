"""Home Events - an editor for what a dashboard should be telling you.

The card does the work. This integration keeps the library of event
definitions, hands it to any card that asks for it by name, and puts an editor
in the sidebar so a config that has grown past twenty events is not being
maintained through a text box in a dialog.

Deliberately no background worker. Everything a card needs is already in the
browser - hass.states is pushed to every client and the registries are one
call each - so evaluating events here would buy nothing and would cost the
filter and condition engine existing twice, once in Python and once in
JavaScript. If a day comes when events have to outlive the browser looking at
them (a notification when the washer has been done for twenty minutes, a
sensor for automations to read), the right move is to evaluate here and let
the card become a renderer - not to have two engines.
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .card import async_register_card
from .const import DOMAIN
from .panel import async_register_panel, async_unregister_panel
from .store import HomeEventsStore
from .websocket import async_register

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = HomeEventsStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = store

    async_register(hass)
    entry.async_on_unload(await async_register_panel(hass))
    entry.async_on_unload(await async_register_card(hass))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async_unregister_panel(hass)
    hass.data.pop(DOMAIN, None)
    # The websocket commands stay registered: unregistering them is not part
    # of the API, and a command whose handler finds no store answers with a
    # clean error rather than a traceback.
    return True
