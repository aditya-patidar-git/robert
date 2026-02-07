# IP Allowlist Emergency Bypass

## When to use

Use the bypass when the IP allowlist would block legitimate access, for example:

- An admin's IP address changed (e.g. new network or ISP).
- You need to perform a critical fix or access the admin console from a new location.
- You are locked out and need to add a new IP to the allowlist.

## Procedure

1. **Enable bypass**  
   Set the environment variable and restart the backend:
   - `ALLOWLIST_BYPASS_EMERGENCY=1` (or `true`)

2. **Restart the backend**  
   Restart the Node process so it picks up the new env value. All API requests will then be allowed regardless of client IP.

3. **Regain access**  
   Log in to the admin console. If needed, add the new IP to the allowlist (Users > Allowlist, type IP).

4. **Disable bypass**  
   Remove or set `ALLOWLIST_BYPASS_EMERGENCY` to `0`/`false` and restart the backend. IP enforcement will apply again.

## Security

- Treat the bypass as **temporary**. Use it only long enough to fix access and re-enable enforcement.
- There is no UI toggle; bypass is controlled only via environment variable and restart.
- When bypass is active, the backend logs a startup warning: `IP allowlist bypass is ENABLED (ALLOWLIST_BYPASS_EMERGENCY). Use for emergency only.`

## Related env vars

- **IP_ALLOWLIST_ENABLED** – When set to a truthy value (e.g. `1`), the backend enforces the IP allowlist for all `/api` requests. When unset or false, no IP check is performed (default: off).
- **ALLOWLIST_BYPASS_EMERGENCY** – When set to a truthy value, the IP check is skipped for all requests (emergency bypass).
