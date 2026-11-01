"""Constants for the Home Events panel."""

DOMAIN = "home_events"
VERSION = "0.2.0"

# The store holds one library of events, and one is all it holds. Version 1
# nested it under a "presets" mapping so a wall tablet could draw a different
# set from the phone; nothing was ever able to create a second one, so version
# 2 lifts the single library to the top and store.py migrates on load.
STORAGE_KEY = DOMAIN
STORAGE_VERSION = 2

# What a card is told to expect. The card carries the same number and says so
# in the panel when the two disagree, because a library written against a newer
# schema silently losing keys is the failure mode with no symptom.
SCHEMA_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

PANEL_NAME = "home-events-panel"
PANEL_TITLE = "Events"
PANEL_ICON = "mdi:bell-badge-outline"
PANEL_FOLDER = "panel"
PANEL_FILENAME = "home-events-panel.js"
PANEL_URL = f"/{DOMAIN}_panel/{PANEL_FILENAME}"

# The card ships with the integration and is loaded on every frontend page,
# the way a dashboard resource would be (see card.py).
CARD_FOLDER = "frontend"
CARD_FILENAME = "home-event-card.js"
CARD_URL = f"/{DOMAIN}_card/{CARD_FILENAME}"
# hass.data key for the card's current, versioned URL.
CARD_KEY = f"{DOMAIN}_card_url"
