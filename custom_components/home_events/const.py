"""Constants for the Home Events panel."""

DOMAIN = "home_events"
VERSION = "0.1.0"

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
