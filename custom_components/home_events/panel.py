"""Registering the sidebar panel, and keeping it from going stale.

A panel that has been updated and not reloaded looks exactly like a panel that
is broken. This file exists mostly to stop that, because it happened four
times in a row and each time the answer looked like "refresh again".

Two things were wrong and both had to be fixed.

`Cache-Control`. The static path was registered with `cache_headers=False`,
which only stops Home Assistant adding a year-long max-age - it adds no
Cache-Control at all, and with nothing but a Last-Modified to go on a browser
invents a freshness lifetime of its own. The module is served from a view here
instead, saying `no-cache`: not "do not cache" but "ask me first", which with
the ETag aiohttp already sends costs a 304 and no body when nothing changed.

The URL. That alone was not enough, and the reason is worth writing down: Home
Assistant registers a service worker, and the service worker answers from its
own cache before any header of ours is consulted. Playwright reports the
response with `fromServiceWorker: true` and the body is whatever was there
first. A service worker caches by URL, so the only thing that reliably busts
it is a different URL - and the mtime baked into `module_url` was read once,
at setup, so every edit after Home Assistant started kept the same one.

So the stamp is followed. One `os.stat` on a slow interval, and when it moves
the panel is registered again under a URL nobody has cached. That is a
developer's convenience being paid for in production, and it is worth it: the
alternative is a restart after every edit, and four rounds of not knowing.
"""

from __future__ import annotations

import logging
import os
from datetime import timedelta

from aiohttp import hdrs, web

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.event import async_track_time_interval

from .const import (
    DOMAIN,
    PANEL_FILENAME,
    PANEL_FOLDER,
    PANEL_ICON,
    PANEL_NAME,
    PANEL_TITLE,
    PANEL_URL,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

# How often the module is checked for having changed underneath us. Long
# enough to be free, short enough that an edit is on screen by the time
# somebody has switched to the browser and pressed reload.
FOLLOW_INTERVAL = timedelta(seconds=10)


class HomeEventsPanelView(HomeAssistantView):
    """The panel module.

    `requires_auth = False` because this URL is fetched by the browser's module
    loader, which sends no Authorization header - the same reason every other
    frontend asset is served unauthenticated. There is nothing in the file that
    is not already in the page importing it.
    """

    url = PANEL_URL
    name = f"{DOMAIN}:panel"
    requires_auth = False

    def __init__(self, path: str) -> None:
        self._path = path

    async def get(self, request: web.Request) -> web.FileResponse:
        # FileResponse sets the ETag and handles the conditional request, so
        # `no-cache` costs a round trip and a 304 rather than a re-download.
        return web.FileResponse(
            self._path, headers={hdrs.CACHE_CONTROL: "no-cache"}
        )


def _stamp(module: str) -> int:
    try:
        return int(os.path.getmtime(module))
    except OSError:
        return 0


async def _register(hass: HomeAssistant, stamp: int) -> None:
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_NAME,
        frontend_url_path=DOMAIN,
        module_url=f"{PANEL_URL}?v={VERSION}&m={stamp}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        # Writing the library is an administrator's job; reading it is not,
        # which is why the websocket API scopes them separately.
        require_admin=True,
        config={},
        config_panel_domain=DOMAIN,
    )


async def async_register_panel(hass: HomeAssistant) -> CALLBACK_TYPE:
    """Register the panel, and follow the file. Returns the unsubscribe."""
    here = os.path.dirname(os.path.abspath(__file__))
    module = os.path.join(here, PANEL_FOLDER, PANEL_FILENAME)

    hass.http.register_view(HomeEventsPanelView(module))
    known = _stamp(module)
    await _register(hass, known)

    async def _follow(_now) -> None:
        nonlocal known
        current = _stamp(module)
        if current == known:
            return
        known = current
        # Removed and registered again, because the URL is the whole point:
        # a service worker holding the old module has never heard of this one.
        frontend.async_remove_panel(hass, DOMAIN)
        await _register(hass, current)
        _LOGGER.info(
            "%s: the panel changed on disk, now served as m=%s", DOMAIN, current
        )

    unsub = async_track_time_interval(hass, _follow, FOLLOW_INTERVAL)
    _LOGGER.debug("%s: panel registered at /%s", DOMAIN, DOMAIN)
    return unsub


def async_unregister_panel(hass: HomeAssistant) -> None:
    frontend.async_remove_panel(hass, DOMAIN)
