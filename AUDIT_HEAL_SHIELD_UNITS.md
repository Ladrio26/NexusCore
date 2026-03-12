# Audit unités Heal / Shield

Unités dont la description de compétence mentionne : soin, soigne, soins, bouclier, shield.

**Généré par** : `backend/scripts/audit-heal-shield-units.mjs`  
**Commande** : `cd backend && node scripts/audit-heal-shield-units.mjs`

---

## Rapport

| Nom unité | Type skill | Effects présents ? | Compatible moteur ? | Problème ? |
|-----------|------------|--------------------|----------------------|------------|
| Atlas des Profondeurs | GENERIC | Oui | Oui | — |
| Bastion des Racines | GENERIC | Oui | Oui | — |
| Colosse Ancestral | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Colosse des Abysses | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Colosse du Cratère | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Flammesœur | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Gardien Ancestral | GENERIC | Oui | Oui | — |
| Gardien des Racines | GENERIC | Oui | Oui | — |
| Gardien des Récifs | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Gardien Magmatique | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Gardien Primordial | GENERIC | Oui | Oui | — |
| Héraut des Cendres | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| L'Éveil Primordial | PASSIVE | Oui | Oui | — |
| Leviathan Éternel | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Magmor le Rouge | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Mur de Cendres | GENERIC | Oui | Oui | — |
| Mur de Ronce | GENERIC | Oui | Oui | — |
| Murmure des Abysses | GENERIC | Oui | Oui | — |
| Pyromancienne | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Rempart des Marées | GENERIC | Oui | Oui | — |
| Rempart Primordial | GENERIC | Oui | Oui | — |
| Sentinelle Calcinée | GENERIC | Oui | Oui | — |
| Sentinelle de Corail | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Tharos le Submergé | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Titan des Récifs | GENERIC | Oui | Non | Type non reconnu par ensureSkillEffects / moteur |
| Titan Sylvestre | GENERIC | Oui | Oui | — |

**Total unités auditées :** 26  
**Unités avec problème :** 13

---

## Interprétation

- **Compatible moteur Oui** : le skill a soit un `type` commençant par HEAL/SHIELD, soit un tableau `effects` contenant au moins un effet de type HEAL ou SHIELD → le moteur appliquera bien soins/boucliers.
- **Compatible moteur Non** : `skill.type` est GENERIC (ou autre) et aucun effet dans `effects` n’a un `type` commençant par HEAL ou SHIELD → risque que le soin/bouclier décrit ne soit pas exécuté par le moteur (à corriger en base : typer la compétence ou les effets en HEAL/SHIELD).
