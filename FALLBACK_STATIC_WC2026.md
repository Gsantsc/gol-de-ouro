# Fallback static-wc2026

`MATCHES_FALLBACK_PROVIDER=static-wc2026` e um fallback backend de emergencia.

Ele existe para evitar app vazio quando:

- API-Football falha.
- API-Football retorna erros.
- API-Football retorna zero fixtures.

O fallback nao substitui o sync real. A fonte principal deve ser:

```txt
MATCHES_PROVIDER=api-football
```

O app do usuario continua lendo do Supabase.

