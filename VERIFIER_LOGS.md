# Vérifier que les logs utilisent la bonne version

## Si tu vois encore « ? — undefined → ? »

Ce texte vient **toujours** de l’**ancien** bundle JavaScript. Le code actuel du repo ne peut plus afficher la chaîne `"undefined"`.

Donc soit :
1. Le **site que tu ouvres** n’est pas celui servi par **ce** projet local (autre hébergement, autre URL),
2. Soit le **navigateur** charge encore un ancien JS (cache, ancien onglet).

## Comment vérifier quelle version est chargée

### 1. Voir si c’est la nouvelle version (v2)

- Ouvre les logs de combat (« Voir les logs »).
- **Nouvelle version** : en haut de la zone des logs tu vois le texte **« Logs v2 »** (en gris).
- **Ancienne version** : pas de « Logs v2 », et les lignes du type « Tour X — ? — undefined → ? ».

### 2. Vérifier l’URL que tu utilises

- En local, le projet sert généralement :
  - **Frontend** : port **5173** (ex. `http://127.0.0.1:5173`).
  - **Backend** : port **3000**.
- Si tu utilises une autre URL (autre domaine, autre hébergeur), c’est **un autre déploiement** : il peut avoir un ancien build et ne pas être mis à jour par le build local.

### 3. Vérifier le fichier JS chargé (DevTools)

1. F12 → onglet **Réseau**.
2. Recharge la page (idéalement avec « Désactiver le cache » coché).
3. Filtre par « JS » et regarde le nom du bundle principal.
   - Build récent : nom du type `index-XXXXXX.js` (hash différent à chaque build).
   - Si le nom ne change jamais après un rebuild, tu charges peut‑être un autre site ou un cache tenace.

### 4. Vérifier l’élément des logs (DevTools)

1. F12 → onglet **Éléments**.
2. Ouvre la zone des logs de combat.
3. Sélectionne la `<div class="battle-log">`.
   - **Nouvelle version** : elle a l’attribut **`data-log-version="2"`** et contient un paragraphe « Logs v2 ».
   - **Ancienne version** : pas de `data-log-version="2"`, pas de « Logs v2 ».

## Résumé

- **Tu vois « Logs v2 »** → bonne version ; si les noms sont encore « ? », le souci vient des données (backend / API).
- **Tu ne vois pas « Logs v2 »** → l’app chargée n’est pas le frontend qu’on build ici : soit autre URL/hébergement, soit cache à vider (rafraîchissement forcé, ou navigation privée).
