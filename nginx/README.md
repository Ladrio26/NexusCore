# Nginx — `nexuscore.goodloss.conf`

- **Fichier de référence** : copie vers `/etc/nginx/sites-enabled/nexuscore.goodloss.conf` sur le serveur.
- **Certificats** : chemins Let’s Encrypt habituels ; adapte si besoin. Si `nginx -t` échoue sur `include /etc/letsencrypt/options-ssl-nginx.conf` ou `ssl_dhparam`, ajuste selon ton installation Certbot.
- **HTTP/2** : volontairement **désactivé** sur `443` (`listen 443 ssl` sans `http2`) pour réduire les erreurs `ERR_HTTP2_PROTOCOL_ERROR` sur les assets. Pour réactiver : `listen 443 ssl http2;`.
