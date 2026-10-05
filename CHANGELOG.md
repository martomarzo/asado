# Changelog

What changed for people using the Asado calculator, newest first.

## 2026-10-05

- The app now follows the order of a real asado: **1 · Gente → 2 · Gastos → 3 · Cobrar**.
  The steps are numbered, show a live status ("4 personas", "$68.000", "falta $20.750"),
  and sit in a bottom bar on phones so they're always within thumb reach.
- Creating a new asado takes you straight to adding people, with the roster list open.
- Each step shows its own summary: how many people and how many kilos of meat to buy;
  the total spent and what each person's share is; and what's left to collect.
- "Siguiente →" buttons under Gente and Gastos take you to the next step.
- Cobrar now tells apart people who owe you ("Cobrar") from people who put in more
  than their share and need money back ("Devolver"). The summary no longer shows a
  negative "Falta" or "¡todo cobrado!" while someone still owes.
- On phones, tap anywhere on a gasto or person to edit it. When adding gastos,
  "+ Otro" saves and opens a blank form for the next one, and Enter moves you along.
- The toolbar fits on phones again (it used to run off the edge), and asado dates
  show as "4/10".
- The asado date is picked from a calendar in dd/mm/aaaa format, with weeks starting
  on Monday, on every device (it used to follow the browser's US mm/dd/yyyy).
- Fixed: renaming an asado no longer erases its date.
- Deleting an asado moved into its ✎ edit dialog, and "Borrar todo" became
  "Vaciar este asado" in ⚙️ Ajustes, so they're harder to hit by accident.
- "¿Borrar…?" confirmations now appear as dialogs inside the app, matching its look,
  instead of the browser's plain pop-up.
- ⚙️ Ajustes leads with everyday settings (grams of meat per person, roster). The
  server connection settings are folded away since the shared link connects on its own.

## 2026-06-18

- First release: split an asado's costs, with meat split only among meat-eaters and
  amounts rounded up to whole pesos.
- Data saved on the home server, so it's the same on any device on the LAN/VPN.
  Several asados can be kept, and a roster of people is reused between them.
- The shared app link connects automatically, with no setup.
- Roster people have a last name. You can save someone to the roster from the list,
  add people from the roster, and search it.
- See how many kilos of meat to buy, and assign a gasto to whoever paid it so it's
  taken off what they owe.
- Phone-friendly layout with cards and big buttons. Cobrar shows only each person's total.
