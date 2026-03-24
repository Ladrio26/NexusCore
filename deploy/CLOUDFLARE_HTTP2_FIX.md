# Correctif ERR_HTTP2_PROTOCOL_ERROR (Nexus Core)

## Diagnostic (serveur d’origine)

- Nginx **n’écoute que le port 80** (pas de TLS local, pas de `/etc/letsencrypt`).
- Le HTTPS est entièrement géré par **Cloudflare** (`server: cloudflare`, HTTP/2 / HTTP/3 côté client).
- L’origine sert le fichier JS **complet** (ex. `curl` vers `127.0.0.1` avec `Host: nexuscore.goodloss.fr` → taille OK).
- Un `curl` vers `https://nexuscore.goodloss.fr/...` peut reproduire une **erreur HTTP/2** côté Cloudflare : le problème est **au bord CF**, pas dans le build Vite.

## Ce qu’il faut faire (Cloudflare)

1. **Dashboard** → domaine **goodloss.fr** → **Réseau** (Network) → désactiver **HTTP/3 (avec QUIC)**.
2. Optionnel : **Mise en cache** → **Purge tout** (ou purge des URL `/assets/*`).

Sans accès API, c’est la méthode la plus simple.

## Automatisation (script)

Si tu as un **jeton API** Cloudflare avec les droits *Zone Settings* et *Cache Purge* :

```bash
cd /root/web/src/nexuscore.goodloss.fr   # ou chemin du clone
export CF_API_TOKEN='...'
chmod +x deploy/cloudflare-disable-http3.sh
./deploy/cloudflare-disable-http3.sh
```

Variable optionnelle : `CF_ZONE_NAME=goodloss.fr` (défaut : `goodloss.fr`).

## Pourquoi modifier seulement Nginx ne suffit pas

Tant que le domaine est en **proxy orange** Cloudflare, le navigateur négocie **HTTP/2 / HTTP/3 avec Cloudflare**, pas avec Nginx. Changer `listen 443 ssl` sur l’origine n’a d’effet qu’après **SSL sur l’origine** + **DNS only** ou mode **Full** avec certificat installé — ce n’est pas le cas actuel sur ce serveur.
