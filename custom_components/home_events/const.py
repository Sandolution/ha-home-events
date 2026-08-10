"""Constants for the Home Events panel."""

DOMAIN = "home_events"
VERSION = "0.1.0"

# The store holds one library of events, split into presets so a wall tablet
# can show a different set from the phone without a second copy of the rules.
STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1
DEFAULT_PRESET = "default"

# What a card is told to expect. The card carries the same number and says so
# in the panel when the two disagree, because a preset written against a newer
# schema silently losing keys is the failure mode with no symptom.
SCHEMA_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

PANEL_NAME = "home-events-panel"
PANEL_TITLE = "Events"
PANEL_ICON = "mdi:bell-badge-outline"
PANEL_FOLDER = "panel"
PANEL_FILENAME = "home-events-panel.js"
PANEL_URL = f"/{DOMAIN}_panel/{PANEL_FILENAME}"
