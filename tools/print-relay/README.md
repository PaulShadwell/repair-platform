## Print Relay (Mac Host)

Use this relay when the API runs in Kubernetes but the thermal printer is attached to your Mac.

### Start relay

```bash
cd tools/print-relay
PRINT_RELAY_PORT=9321 \
PRINT_RELAY_TCP_PORT=9100 \
PRINT_RELAY_TOKEN="change-this-token" \
SYSTEM_PRINTER_NAME="Label_TD80" \
node print-relay.mjs
```

### Health check

```bash
curl http://localhost:9321/health
```

### API configuration

Set these in API env (k8s deployment/secrets):

- `DEFAULT_PRINTER_MODE=relay`
- `PRINT_RELAY_URL=http://<mac-reachable-host>:9321/print`
- `PRINT_RELAY_TOKEN=<same-token-as-relay>`
- optional: `PRINT_RELAY_TIMEOUT_MS=10000`

If your cluster cannot directly reach your Mac IP, expose the relay securely (VPN/tunnel/private ingress), then use that URL in `PRINT_RELAY_URL`.

## Multi-laptop repair cafe setup (recommended)

Use one relay per laptop and one printer profile per laptop in the API:

- Laptop A relay on `10.10.10.21:9100`
- Laptop B relay on `10.10.10.22:9100`

Create printer profiles with `connectionType=TCP`, host/laptop IP, and `port=9100`.
Then each browser selects its own profile in the app Printer dropdown (selection is saved in local storage on that laptop).
