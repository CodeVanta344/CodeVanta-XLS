# CodeVanta License Server

Serveur de gestion de licences pour CodeVanta-XLS

## 🚀 Installation

1. **Installez les dépendances :**
```bash
cd license-server
npm install
```

2. **Configurez l'environnement :**
```bash
cp .env.example .env
```

Éditez `.env` et configurez :
- Base de données MySQL
- Email (Gmail, SMTP, etc.)
- Clé secrète

3. **Créez la base de données MySQL :**
```sql
CREATE DATABASE codevanta_licenses;
```

4. **Démarrez le serveur :**
```bash
npm start
```

Le serveur démarre sur http://localhost:3001

## 📋 Utilisation

### Interface Admin
Ouvrez http://localhost:3001 dans votre navigateur

### API Endpoints

**Vérifier une licence (depuis l'app) :**
```
POST /api/verify-license
Body: { "licenseKey": "XXXX-XXXX-XXXX-XXXX", "appVersion": "1.0.0", "platform": "win32" }
```

**Générer une licence :**
```
POST /api/generate-license
Body: { "email": "client@example.com", "plan": "standard", "duration": 365 }
```

**Récupérer infos licence :**
```
GET /api/license/:key
```

**Statistiques :**
```
GET /api/stats
```

## 🔒 Sécurité

- Changez `SECRET_KEY` en production
- Utilisez HTTPS
- Configurez un pare-feu
- Limitez l'accès à l'interface admin

## 📧 Configuration Email

Pour Gmail :
1. Activez l'authentification à 2 facteurs
2. Créez un mot de passe d'application
3. Utilisez-le dans `.env`

## 🌐 Déploiement

### Heroku
```bash
heroku create codevanta-licenses
heroku addons:create cleardb:ignite
git push heroku main
```

### VPS (Ubuntu)
```bash
# Installer Node.js et MySQL
# Cloner le repo
# Configurer .env
# Installer PM2
npm install -g pm2
pm2 start server.js --name license-server
pm2 save
pm2 startup
```

## 📝 License
MIT
