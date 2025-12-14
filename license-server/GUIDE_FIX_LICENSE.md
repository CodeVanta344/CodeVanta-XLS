# 🔧 Guide de correction - Licence Lifetime expirée

## Problème identifié
La licence `3222-FD59-8AF5-623E` est marquée comme **expirée** alors qu'elle devrait être **lifetime** (à vie).

## Cause
1. La fonction RPC `verify_license_key` n'existe pas dans Supabase
2. Les licences lifetime doivent avoir `expires_at = NULL`, mais celle-ci a probablement une date
3. La fonction `update_expired_licenses()` marque automatiquement comme expirées les licences où `expires_at < NOW()`

## Solution en 3 étapes

### Étape 1 : Créer la fonction RPC de vérification
1. Ouvrez votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête
4. Copiez-collez le contenu du fichier `verify_license_rpc.sql`
5. Cliquez sur **Run** pour exécuter

✅ Cela créera la fonction `verify_license_key()` qui gère correctement les licences lifetime

### Étape 2 : Corriger la licence expirée
1. Dans le **SQL Editor** de Supabase
2. Créez une nouvelle requête
3. Copiez-collez le contenu du fichier `fix_lifetime_license.sql`
4. Cliquez sur **Run** pour exécuter

✅ Cela réactivera votre licence et la marquera comme lifetime (expires_at = NULL)

### Étape 3 : Tester dans l'application
1. Fermez l'application CodeVanta-XLS
2. Relancez-la avec `npm start`
3. La licence devrait maintenant être reconnue comme valide

## Vérification manuelle dans Supabase

Vous pouvez vérifier l'état de votre licence avec cette requête :

```sql
SELECT 
    license_key,
    email,
    plan,
    status,
    expires_at,
    app_name,
    CASE 
        WHEN expires_at IS NULL THEN '✅ Lifetime (À vie)'
        WHEN expires_at > NOW() THEN '✅ Active jusqu''au ' || to_char(expires_at, 'DD/MM/YYYY')
        ELSE '❌ Expirée'
    END as validity_status
FROM licenses
WHERE license_key = '3222-FD59-8AF5-623E';
```

## Fichiers créés
- `verify_license_rpc.sql` - Fonction RPC pour vérifier les licences
- `fix_lifetime_license.sql` - Script pour corriger les licences expirées
- `GUIDE_FIX_LICENSE.md` - Ce guide

## Besoin d'aide ?
Si vous rencontrez des problèmes, vérifiez :
1. Que vous êtes bien connecté à Supabase
2. Que vous avez les permissions nécessaires
3. Que la table `licenses` existe bien
