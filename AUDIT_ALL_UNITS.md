# Audit complet – Toutes les unités

Cohérence skill_data / moteur / buildBattleLog / applySkillEffect / ensureSkillEffects.

**Généré par** : `backend/scripts/audit-all-units.mjs`  
**Commande** : `cd backend && node scripts/audit-all-units.mjs`

**Total :** 105 unités | **Avec problème :** 54

---

## Note sur « Effect types non reconnus »

Les types **DAMAGE**, **DAMAGE_SINGLE**, **DAMAGE_MULTI**, **LIFESTEAL** ne figurent pas dans le `switch` de `applySkillEffect` (ils sont gérés ailleurs : branche dégâts de `performSkillAction` ou event `attack`). Une unité marquée uniquement pour ces types peut donc **quand même** être exécutée correctement par le moteur ; la colonne « Compatible moteur » est stricte (référentiel applySkillEffect/buildBattleLog).

---

| Nom unité | skill.type | effects présents | results générés | Compatible moteur | Problème détecté |
|-----------|------------|------------------|-----------------|-------------------|------------------|
| Aetheria Verdélune | GENERIC | Oui | Oui | Oui | — |
| Aetherion des Marées | PASSIVE | Non | Non | Non | Type non géré par performSkillAction |
| Ancien des Racines | GENERIC | Oui | Oui | Oui | — |
| Arbalétrier Océanique | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Archidruide Verdétoile | GENERIC | Oui | Oui | Oui | — |
| Artilleur Incendiaire | GENERIC | Oui | Non | Non | Effect types non reconnus: DAMAGE |
| Astra Pyrotempête | PASSIVE | Non | Non | Non | Type non géré par performSkillAction |
| Atlas des Profondeurs | GENERIC | Oui | Oui | Oui | — |
| Bastion de Lave | GENERIC | Oui | Oui | Oui | — |
| Bastion des Racines | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Bastion Nautique | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE, LIFESTEAL |
| Briseur d'Écume | (vide) | Non | Non | Non | Type non géré par performSkillAction |
| Canon Ardent | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Chaman des Fougères | GENERIC | Oui | Oui | Oui | — |
| Colosse Ancestral | GENERIC | Oui | Oui | Oui | — |
| Colosse Ardent | GENERIC | Oui | Oui | Oui | — |
| Colosse des Abysses | GENERIC | Oui | Oui | Oui | — |
| Colosse du Cratère | GENERIC | Oui | Oui | Oui | — |
| Colosse Sylvestre | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Coupe Ronce | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Draven l'Incandescent | DAMAGE_SINGLE | Non | Non | Non | Attaque de base (pas de skill) |
| Druide Marin | GENERIC | Oui | Oui | Oui | — |
| Éclaireur des Brumes | GENERIC | Oui | Oui | Oui | — |
| Épine Furieuse | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Faucheur Sylvestre | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Flammesœur | GENERIC | Oui | Oui | Oui | — |
| Frappe Torrent | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Frappe-Volcan | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Gardien Ancestral | GENERIC | Oui | Oui | Oui | — |
| Gardien des Racines | GENERIC | Oui | Oui | Oui | — |
| Gardien des Récifs | GENERIC | Oui | Oui | Oui | — |
| Gardien du Gouffre | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Gardien Magmatique | GENERIC | Oui | Oui | Oui | — |
| Gardien Primordial | GENERIC | Oui | Oui | Oui | — |
| Gardien Volcanique | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Gardienne Florale | GENERIC | Oui | Oui | Oui | — |
| Héraut des Cendres | GENERIC | Oui | Oui | Oui | — |
| Ignivar, Cœur du Volcan | GENERIC | Oui | Oui | Oui | — |
| Invocateur d'Écume | GENERIC | Oui | Oui | Oui | — |
| Kaelith, Flamme Éternelle | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Kaelor des Abysses | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Kaeria Épinevive | GENERIC | Oui | Oui | Oui | — |
| L'Apogée Incandescente | DAMAGE_SINGLE | Non | Non | Non | Attaque de base (pas de skill) |
| L'Éveil Primordial | PASSIVE | Oui | Oui | Oui | — |
| Lame des Marées | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Lame Verdoyante | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Lance-Flammes | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_MULTI |
| Lance-Graines | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Lanceur de Vagues | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Le Gardien Millénaire | GENERIC | Oui | Oui | Oui | — |
| Leviathan Éternel | GENERIC | Oui | Oui | Oui | — |
| Lysandra, Reine Sylvestre | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Lysandre Torrentiel | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Magmor le Rouge | GENERIC | Oui | Oui | Oui | — |
| Mur de Cendres | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Mur de Ronce | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Murmure des Abysses | GENERIC | Oui | Oui | Oui | — |
| Myrrh l'Herboriste | GENERIC | Oui | Oui | Oui | — |
| Myrrha des Marées | GENERIC | Oui | Oui | Oui | — |
| Néris, Flèche Marine | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Nyxara, Reine des Abysses | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Ondine Astrale | GENERIC | Oui | Oui | Oui | — |
| Oracle du Récif | GENERIC | Oui | Oui | Oui | — |
| Oracle Florale | GENERIC | Oui | Oui | Oui | — |
| Oracle Incendiaire | GENERIC | Oui | Oui | Oui | — |
| Oracle Sylvaine | GENERIC | Oui | Oui | Oui | — |
| Oratrice des Cendres | GENERIC | Oui | Oui | Oui | — |
| Prêtresse du Feu Primordial | GENERIC | Oui | Oui | Oui | — |
| Pyro-Lancier | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Pyromancienne | GENERIC | Oui | Oui | Oui | — |
| Ravageur de Braise | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Ravageur Sylvestre | GENERIC | Oui | Oui | Oui | — |
| Rempart Calciné | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Rempart des Marées | GENERIC | Oui | Oui | Oui | — |
| Rempart Infernal | GENERIC | Oui | Oui | Oui | — |
| Rempart Primordial | GENERIC | Oui | Oui | Oui | — |
| Rempart Verdoyant | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sabreur Ardant | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sabreur Marin | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sabreur Verdoyant | GENERIC | Oui | Oui | Oui | — |
| Sentinelle Calcinée | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sentinelle de Corail | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Soigneur Lagonaire | GENERIC | Oui | Oui | Oui | — |
| Solaris l'Axe Ardent | GENERIC | Oui | Oui | Oui | — |
| Solarys Flammevive | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sylphae Verdéclipse | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Sylven la Perçante | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Thalos Verdacier | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Tharos le Submergé | GENERIC | Oui | Oui | Oui | — |
| Tireur Abyssal | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Tireur de Cendres | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Tireur de Lianes | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Tisse-Liane | GENERIC | Oui | Oui | Oui | — |
| Tisseur de Vagues | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Titan de Lave | GENERIC | Oui | Oui | Oui | — |
| Titan des Récifs | GENERIC | Oui | Oui | Oui | — |
| Titan Sylvestre | GENERIC | Oui | Oui | Oui | — |
| Traqueur des Lianes | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Varok, Lame des Abysses | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Veilleur des Profondeurs | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Veilleuse Incendiaire | GENERIC | Oui | Oui | Oui | — |
| Vornax le Dévastateur | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Xyra Pyroclaste | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE |
| Zéphyr Océanique | GENERIC | Oui | Oui | Non | Effect types non reconnus: DAMAGE_SINGLE |
| Zeryn l'Épine Absolue | DAMAGE_SINGLE | Non | Non | Non | Attaque de base (pas de skill) |
