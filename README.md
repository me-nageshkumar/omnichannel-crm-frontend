# Omnichannel CRM — console

Browser console for the Omnichannel CRM backend (`omnichannel-crm-backend`, Spring Boot). React 18,
TypeScript, PatternFly 6, React Router, Webpack, Vitest. Started from
[patternfly-react-seed](https://github.com/patternfly/patternfly-react-seed) (MIT).

Everyone with a login can use it: log in (with a 6-digit code when two-factor is on, and a new
password on first login), dashboard, profile with two-factor setup, log out. What else a person sees
comes from the authorities the server returns in `/api/users/me`; on screen a workspace is a
**brand**, and the masthead switcher picks the current one (remembered in `localStorage` under
`omnichannel.workspace`).

| Page | Shown when | What it does |
|---|---|---|
| Platform users | `platform-user:manage` | Account Managers and other staff: add, edit, reset password, disable/enable |
| Roles | Super Admin | Which authorities each role holds; custom roles; warns before an edit changes who can assign what; history |
| Authorities | Super Admin | Every authority with its group, level and status; create one (picking from codes the server found in `@PreAuthorize` checks, or typing one), edit group/level/description, delete unused ones; history |
| Customers | `customer:view` | Search and page customers; add one with its first brand and owner; on a customer: its brands, owners and every user, with rename and disable/enable of the customer, its brands and its users (`customer:manage`) |
| All phone numbers | `phone-number:view-all` | Every WhatsApp number on the platform with company, brand and status; search, filter by status, page; disable/enable and delete (`phone-number:manage-all`) |
| Brands | `workspace:create` | The company's brands: add, rename, disable/enable (`workspace:enable`) |
| Users | `user:view` in the current brand | People with access to the brand; add (new or from another brand), edit role, reset password, remove (`user:manage`); disable in this brand only (`user:enable`); disable the whole login (`company-user:manage`) |
| Teams | `user:view` in the current brand | Teams and members; add, rename, choose members (`team:manage`) |
| Phone numbers | `phone-number:view` in the current brand | The brand's WhatsApp numbers and their connection status (refreshed every 10 s); add, edit label, get a connect code for the extension, revoke the device, disable/enable, delete (`phone-number:manage`) |

**Enable / disable:** everywhere a thing can be switched off, the label reads Enabled or Disabled,
and hovering Disabled says who did it and at which level (platform staff, Customer Admin or brand
manager). Enable is always offered; when the thing was disabled at a higher level than yours the
server refuses and the dialog shows why. A disabled brand drops out of the brand switcher.

On the Authorities page, **Not checked** means no server check uses the code yet, so it has no
effect until one does; **Wrong level** means the server checks it at a different level from the one
it was created with (a brand authority checked globally, or a platform one checked per brand), so the
check can never pass. Codes the server checks but nobody has created yet are listed at the top with a
**Create** button. Built-in authorities keep their level and cannot be deleted. The role editor
groups authorities by their group and has one search box over code, group and description.

Temporary passwords are typed by whoever creates the person, shown once with a copy button, and must
be changed at first login. Hiding a menu is only convenience: the server checks every request.

## Develop

```bash
npm install
# backend running on 8080 (or point BACKEND_URL elsewhere)
BACKEND_URL=http://localhost:8080 npm run start:dev   # http://localhost:9000, proxies /api and /ws
```

## Check

```bash
npm run ci-checks   # type-check + lint + tests with coverage
```

## Ship

The backend serves the built console from its jar, on one port:

```bash
npm run build                                   # -> dist/
cd ../omnichannel-crm-backend && ./mvnw clean -Pwith-frontend package
```
