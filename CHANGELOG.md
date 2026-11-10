# Changelog

## 2026-10-26

- Let kids choose from a grid of character avatars and display their choice on their account and family cards.

- Remove the demo banner and footer credits from the interface.

- Collapse transaction history by default; keep it expanded while paging through older transactions.

- Fix browser form sign-in rejecting legitimate submissions by preserving same-origin form headers while withholding referrers from external sites.

- Replace Google sign-in and kid access codes with reusable salted-scrypt passwords, protected initial parent setup, additional parent accounts, and password resets that invalidate sessions.

- Move hosting and storage to Firebase, restrict parent access to approved Google accounts, and replace shared passwords with revocable kid-specific access codes.
- Add server-side role checks, default-deny Firestore rules, same-origin writes, login attempt limits, and emulator security tests.

- Add parent-set monthly spending amounts, kids’ monthly progress, and confirmation before recording an over-budget purchase.

- Let kids record purchases from their family page, updating balances and transaction history immediately.

- Add a development-only frontend demo with sample kids, editable balances, transaction history, and a password-protected kids’ view.

## 2026-08-31

- Add Privacy Policy and Terms of Use pages, linked from the home page footer.

## 2026-08-25

- Move the admin family URL and password panel below the kids sections.
- Move the admin “Add a kid” panel below the kids list.
- Add footer credit linking to Raymond Camden’s site and the GitHub source.
- Replace the family page “Lock” text with a lock icon, and show a “Logout” tooltip on hover.
- Make the family page URL clickable on admin, with a clipboard copy control.
