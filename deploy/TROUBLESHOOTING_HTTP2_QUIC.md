# Dépannage : `ERR_HTTP2_PROTOCOL_ERROR` / `ERR_QUIC_PROTOCOL_ERROR` sur les assets

Ces erreurs apparaissent dans Chrome sur `GET …/assets/index-XXXX.js` alors qu’on voit parfois `200 (OK)` : la connexion **HTTP/2** ou **QUIC** est **cassée en cours de route** (réponse tronquée, flux multiplexé, proxy, etc.). Ce n’est **pas** un bug du bundle Vite en soi.

## 1. Côté navigateur (test rapide)

- Vider le cache pour le site : **F12 → Application → Stockage → Supprimer les données du site** (ou Ctrl+Shift+R ne suffit pas toujours).
- Tester **Firefox** ou **Edge** : si ça marche, le souci est souvent **Chrome + HTTP/2/QUIC** ou une extension.
- Désactiver **QUIC** : `chrome://flags/#enable-quic` → **Disabled**, redémarrer Chrome.
- Tester **sans extensions** (navigation privée ou autre profil).

## 2. Cloudflare (si le domaine est derrière l’orange cloud)

- **SSL/TLS** : mode **Full** ou **Full (strict)** selon ton certificat origine.
- Essayer de désactiver temporairement **HTTP/3 (avec QUIC)** pour le domaine.
- Vérifier les règles **Cache** / **Workers** qui toucheraient `/assets/*`.

## 3. Nginx sur le serveur (le plus efficace si tu gères le vhost HTTPS)

Le fichier réel du site est souvent **en dehors** du dépôt (bloc `listen 443 ssl http2;` dans un autre fichier).

### Option A — Désactiver HTTP/2 (test diagnostic)

Dans le `server { … }` HTTPS concerné, remplacer :

```nginx
listen 443 ssl http2;
listen [::]:443 ssl http2;
```

par :

```nginx
listen 443 ssl;
listen [::]:443 ssl;
```

Puis : `sudo nginx -t && sudo systemctl reload nginx`

Les clients passeront en **HTTP/1.1** sur TLS ; beaucoup d’erreurs `ERR_HTTP2_PROTOCOL_ERROR` disparaissent. Tu peux laisser ainsi ou investiguer plus tard (buffers, version Nginx, modules).

### Option B — Augmenter les limites HTTP/2 (dans le bloc `http { }` de `nginx.conf`)

```nginx
http2_max_field_size 64k;
http2_max_header_size 64k;
```

Puis `nginx -t` et reload.

### Option C — Fichiers sur disque réseau / NFS

Si `root` pointe vers un montage réseau, essayer `sendfile off;` dans le `location` des assets (cas rare).

## 4. Vérifications en ligne de commande (sur le serveur ou ton PC)

```bash
curl -sI --http2 https://nexuscore.goodloss.fr/assets/index-DLYpuh3N.js
curl -sI https://nexuscore.goodloss.fr/assets/index-DLYpuh3N.js
```

Taille attendue cohérente avec le fichier dans `frontend/dist/assets/`.

## 5. Antivirus / proxy d’entreprise

Certains inspectent le TLS et cassent HTTP/2 : tester depuis un autre réseau (4G).

---

**Résumé :** commence par **désactiver HTTP/2** sur le `listen` Nginx (option A) ou **QUIC** côté Cloudflare/Chrome ; ce sont les correctifs les plus courants pour ce symptôme.
