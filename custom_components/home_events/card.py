"""Serving the card, and loading it on every dashboard.

The card used to be a Lovelace resource pointing into www/: a second thing to
install, a `?v=` to bump by hand after every edit, and a file this integration
depended on - schema.py mirrors it, the panel imports its filter engine - but
did not ship. Now it ships here and is loaded the way the panel is: served from
a view saying `no-cache`, under a URL that carries the file's mtime, and added
to every frontend page with `add_extra_js_url`, which is what a dashboard
resource did. panel.py has the long version of why the URL has to change when
the file does; the same follower keeps it current here.

Anything else that needs the card's module - the panel, for the filter engine -
asks `home_events/card` for the URL instead of guessing it, because the mtime
in it moves.
"""

from __future__ import annotations

import logging
import os

from aiohttp import hdrs, web

from homeassistant.components.frontend import (add_extra_js_url,
                                               remove_extra_js_url)
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval

from .const import CARD_FILENAME, CARD_FOLDER, CARD_KEY, CARD_URL, DOMAIN, VERSION
from .panel import FOLLOW_INTERVAL, _stamp

_LOGGER = logging.getLogger(__name__)


class HomeEventsCardView(HomeAssistantView):
    """The card module. Unauthenticated for the panel view's reason."""

    url = CARD_URL
    name = f"{DOMAIN}:card"
    requires_auth = False

    def __init__(self, path: str) -> None:
        self._path = path

    async def get(self, request: web.Request) -> web.FileResponse:
        return web.FileResponse(
            self._path, headers={hdrs.CACHE_CONTROL: "no-cache"}
        )


def _url(stamp: int) -> str:
    return f"{CARD_URL}?v={VERSION}&m={stamp}"


async def async_register_card(hass: HomeAssistant) -> CALLBACK_TYPE:
    """Serve the card and load it everywhere. Returns what undoes both."""
    here = os.path.dirname(os.path.abspath(__file__))
    module = os.path.join(here, CARD_FOLDER, CARD_FILENAME)

    hass.http.register_view(HomeEventsCardView(module))
    known = _stamp(module)
    hass.data[CARD_KEY] = _url(known)
    add_extra_js_url(hass, hass.data[CARD_KEY])

    async def _follow(_now) -> None:
        nonlocal known
        current = _stamp(module)
        if current == known:
            return
        known = current
        # A page already open keeps the build it loaded; the next one gets
        # this URL, which no service worker has seen.
        remove_extra_js_url(hass, hass.data[CARD_KEY])
        hass.data[CARD_KEY] = _url(current)
        add_extra_js_url(hass, hass.data[CARD_KEY])
        _LOGGER.info(
            "%s: the card changed on disk, now served as m=%s", DOMAIN, current
        )

    unsub = async_track_time_interval(hass, _follow, FOLLOW_INTERVAL)

    @callback
    def _unregister() -> None:
        unsub()
        if url := hass.data.pop(CARD_KEY, None):
            remove_extra_js_url(hass, url)

    return _unregister
