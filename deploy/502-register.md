# 502 Bad Gateway sur POST /api/auth/register

Une **502** signifie que le reverse proxy (nginx, Caddy, etc.) n’a pas reçu de réponse valide du backend.

## À vérifier sur le serveur (nexuscore.goodloss.fr)

1. **Le backend tourne-t-il ?**
   ```bash
   curl -s http://127.0.0.1:3000/health
   ```
   Vous devez voir `{"status":"ok"}`.

2. **Le proxy envoie-t-il bien `/api` vers le backend ?**
   - Nginx : la directive `proxy_pass` pour `location /api/` doit pointer vers `http://127.0.0.1:3000/` (ou le port où écoute le backend).
   - Voir `deploy/nginx.conf.example`.

3. **Même machine / bon port**
   - Vérifiez que le reverse proxy pointe bien vers le port réel du backend local.

4. **Logs backend en cas d’erreur**
   ```bash
   cd /root/web/src/nexuscore.goodloss.fr/backend
   npm run dev
   ```
   En cas de crash ou d’exception sur `/auth/register`, elle apparaîtra dans la console du backend.

## Exemple Nginx

Voir `deploy/nginx.conf.example`. Après modification de la config nginx :
```bash
sudo nginx -t && sudo systemctl reload nginx
```
