# Release Notes & Versioning Rule

Whenever committing or pushing user-facing changes (`feat` or `fix`) to `flow-fit-client` or `flow-fit-api`:

1. **Bump SemVer Version:**
   - `feat`: increment **MINOR** (e.g. `0.4.0` -> `0.5.0`)
   - `fix`: increment **PATCH** (e.g. `0.4.1` -> `0.4.2`)
   - Breaking change: increment **MAJOR**
2. **Update "What's New" Changelog (`flow-fit-api`):**
   - Prepend the new release entry in Ukrainian to `APP_UPDATES_DATA` in `flow-fit-api/src/modules/app-updates/data/app-updates.data.ts`, and change the previous latest item's `badge` from `'Новинка'` to `'Попереднє'`.
   - Update the expected latest version in `flow-fit-api/src/modules/app-updates/app-updates.service.spec.ts`.
3. **Sync Version Across Both Repositories:**
   - `flow-fit-client/package.json` -> `"version": "<new-version>"`
   - `flow-fit-client/src/environments/environment.ts` -> `appVersion: '<new-version>'`
   - `flow-fit-client/src/environments/environment.prod.ts` -> `appVersion: '<new-version>'`
   - `flow-fit-api/package.json` -> `"version": "<new-version>"` (if accessible)
4. **Verify Before Push:**
   - Re-run `npm run build` and relevant tests after bumping versions so the "What's New" popup and `/tabs/settings/last-updates` stay synchronized.
