# Omnichannel CRM — console

Browser console for the Omnichannel CRM backend (`omnichannel-crm-backend`, Spring Boot). React 18,
TypeScript, PatternFly 6, React Router, Webpack, Vitest. Started from
[patternfly-react-seed](https://github.com/patternfly/patternfly-react-seed) (MIT).

This first slice is for the super admin only: log in (with a 6-digit code when two-factor is on),
dashboard, profile with two-factor setup, log out.

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
