# 🚀 Guide de Configuration de la Base de Données Supabase

## Étape 1️⃣ : Accéder à votre projet Supabase

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Connectez-vous à votre compte
3. Sélectionnez votre projet (ou créez-en un nouveau si nécessaire)

---

## Étape 2️⃣ : Créer les tables

1. Dans le menu de gauche, cliquez sur **SQL Editor**
2. Cliquez sur **New query**
3. Copiez-collez le contenu du fichier `supabase-schema.sql`
4. Cliquez sur **Run** (ou appuyez sur Ctrl+Enter)

✅ **Résultat attendu** : Vous devriez voir un message de succès indiquant que les tables ont été créées.

### Tables créées :
- `licenses` - Table principale des licences
- `license_activations` - Historique des activations
- `license_logs` - Logs de traçabilité

---

## Étape 3️⃣ : Créer la fonction de vérification des licences

1. Toujours dans le **SQL Editor**, créez une nouvelle requête
2. Copiez-collez le contenu du fichier `verify_license_rpc.sql`
3. Cliquez sur **Run**

✅ **Résultat attendu** : La fonction `verify_license_key()` est créée

---

## Étape 4️⃣ : Créer la fonction de génération de licences (optionnel)

1. Créez une nouvelle requête dans le **SQL Editor**
2. Copiez-collez le contenu du fichier `generate_license_func.sql`
3. Cliquez sur **Run**

✅ **Résultat attendu** : La fonction `generate_license()` est créée

---

## Étape 5️⃣ : Vérifier que tout fonctionne

### Test 1 : Vérifier les tables
```sql
-- Exécutez cette requête dans le SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('licenses', 'license_activations', 'license_logs');
```

✅ **Résultat attendu** : Vous devriez voir les 3 tables listées

### Test 2 : Vérifier les fonctions
```sql
-- Exécutez cette requête dans le SQL Editor
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('verify_license_key', 'generate_license', 'update_expired_licenses');
```

✅ **Résultat attendu** : Vous devriez voir au minimum `verify_license_key` et `update_expired_licenses`

---

## Étape 6️⃣ : Récupérer vos clés API Supabase

1. Dans le menu de gauche, cliquez sur **Project Settings** (icône d'engrenage)
2. Cliquez sur **API** dans le sous-menu
3. Notez les informations suivantes :

### Informations à copier :
- **Project URL** : `https://xxxxx.supabase.co`
- **anon public** (clé publique) : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role** (clé secrète) : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

⚠️ **IMPORTANT** : Ne partagez JAMAIS votre clé `service_role` publiquement !

---

## Étape 7️⃣ : Configurer votre application

### Option A : Si vous utilisez le serveur Node.js local

1. Créez un fichier `.env` à la racine de `license-server/`
2. Copiez le contenu de `.env.example`
3. Ajoutez vos clés Supabase :

```env
# Configuration Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Autres configurations
PORT=3001
NODE_ENV=development
SECRET_KEY=CHANGE-THIS-SECRET-KEY-IN-PRODUCTION-12345

# Email (optionnel pour l'instant)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=votre-email@gmail.com
EMAIL_PASSWORD=votre-mot-de-passe-app
```

### Option B : Si vous utilisez Edge Functions Supabase

1. Dans votre projet Supabase, allez dans **Edge Functions**
2. Créez une nouvelle fonction appelée `verify-license`
3. Copiez le contenu de `supabase-edge-function.ts`
4. Déployez la fonction

---

## Étape 8️⃣ : Tester la configuration

### Test avec une requête SQL directe

Dans le SQL Editor de Supabase, exécutez :

```sql
-- Insérer une licence de test
INSERT INTO licenses (license_key, license_hash, email, plan, status, expires_at)
VALUES (
    'TEST-1234-5678-9ABC',
    encode(sha256('TEST-1234-5678-9ABC'::bytea), 'hex'),
    'test@example.com',
    'standard',
    'active',
    NOW() + INTERVAL '365 days'
);

-- Vérifier que la licence a été créée
SELECT * FROM licenses WHERE license_key = 'TEST-1234-5678-9ABC';

-- Tester la fonction de vérification
SELECT * FROM verify_license_key('TEST-1234-5678-9ABC');
```

✅ **Résultat attendu** : 
- La licence est insérée avec succès
- La fonction `verify_license_key()` retourne `valid: true`

---

## 🎯 Prochaines étapes

Une fois la base de données configurée :

1. **Générer des licences** : Utilisez l'interface admin (`admin-generate.html`) ou l'API
2. **Intégrer dans votre application** : Utilisez `website-integration.js` comme exemple
3. **Configurer les emails** : Pour envoyer automatiquement les licences aux clients

---

## ❓ Problèmes courants

### Erreur : "relation 'licenses' does not exist"
➡️ Vous n'avez pas exécuté le script `supabase-schema.sql`

### Erreur : "function verify_license_key does not exist"
➡️ Vous n'avez pas exécuté le script `verify_license_rpc.sql`

### Erreur : "permission denied"
➡️ Vérifiez que vous utilisez la bonne clé API (service_role pour les opérations admin)

### Les licences expirent alors qu'elles sont "lifetime"
➡️ Exécutez le script `fix_lifetime_CORRECT.sql` pour corriger

---

## 📞 Besoin d'aide ?

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans Supabase (Database > Logs)
2. Testez les requêtes SQL directement dans le SQL Editor
3. Vérifiez que vos clés API sont correctes
4. Assurez-vous que RLS (Row Level Security) est bien configuré

---

## 📝 Fichiers de référence

- `supabase-schema.sql` - Schéma complet de la base de données
- `verify_license_rpc.sql` - Fonction de vérification des licences
- `generate_license_func.sql` - Fonction de génération de licences
- `fix_lifetime_CORRECT.sql` - Correction des licences lifetime
- `check_table_structure.sql` - Vérification de la structure
