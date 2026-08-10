"""Adding Home Events.

There is nothing to configure - the library is edited in the panel, not in a
dialog - so the flow exists only to give the integration an entry to be
loaded and unloaded with.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigFlow

from .const import DOMAIN, PANEL_TITLE


class HomeEventsConfigFlow(ConfigFlow, domain=DOMAIN):
    """One entry, no options."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title=PANEL_TITLE, data={})
