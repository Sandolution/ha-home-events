# Home Events

What the house is doing that you would want to know about, in one list.

Home Events is a Home Assistant integration plus a dashboard card. The card is
empty when nothing is happening and says something when it is: a light left on,
a washing machine finished, a window open, an alarm not set. Each is one row,
and rows are filed into sections you name.

**What it consists of:**

- **The library:** every event, saying what it covers, when it applies, and how
  its rows word themselves. It is stored by the integration and edited in its
  sidebar panel, **Events**.
- **The card:** `custom:home-event-card` shows the library on a dashboard. It
  ships with the integration and is loaded on every dashboard automatically, so
  there is no resource to add.

## Installation

1. In HACS, open the menu → **Custom repositories**, and add
   `https://github.com/Sandolution/ha-home-events` with the type **Integration**.
2. Install **Home Events** and restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration** and pick
   **Home Events**.
4. Open **Events** in the sidebar to write the library, and add the card to a
   dashboard:

   ```yaml
   type: custom:home-event-card
   ```

**Coming from a manual install?** Remove the old dashboard resource that pointed
at `/local/custom/home-event-card.js` (Settings → Dashboards → ⋮ → Resources),
and the file itself. The card guards against being defined twice, so nothing
breaks while both are still there.

## Documentation

[docs/home-event-card.md](docs/home-event-card.md) covers the card's options,
the library's event format (include and exclude, conditions, wording per kind
of row, colours), and what the card exports for other code.

## License

[MIT](LICENSE)
