"""Registering the sidebar panel.

The module URL carries the file's mtime as well as the integration version.
/local/ and every static path Home Assistant serves are cached hard by the
browser, and a panel that has been updated but not reloaded looks exactly like
a panel that is broken - which has cost this project a day already, on the
cards.
"""

from __future__ import annotations

import logging
import os

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

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


async def async_register_panel(hass: HomeAssistant) -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    module = os.path.join(here, PANEL_FOLDER, PANEL_FILENAME)

    try:
        stamp = int(os.path.getmtime(module))
    except OSError:
        stamp = 0

    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_URL, module, cache_headers=False)]
    )

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
    _LOGGER.debug("%s: panel registered at /%s", DOMAIN, DOMAIN)


def async_unregister_panel(hass: HomeAssistant) -> None:
    frontend.async_remove_panel(hass, DOMAIN)
