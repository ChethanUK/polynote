# Polynote

```bash
kubectl create secret generic gcp-sa-account --from-file gcp_service_account_key.json=production-sa.json -n polynote
```

# Installing

```bash
 helm install -n spark poly . -f values-production.yaml  
```