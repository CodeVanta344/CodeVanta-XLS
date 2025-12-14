const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendLicenseEmail(email, licenseKey, plan, expiresAt) {
        const expiryText = expiresAt
            ? `Expire le: ${new Date(expiresAt).toLocaleDateString('fr-FR')}`
            : 'Licence à vie';

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: '🔑 Votre clé de licence CodeVanta-XLS',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .license-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #667eea; }
                        .license-key { font-size: 28px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 3px; font-family: 'Courier New', monospace; margin: 20px 0; }
                        .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
                        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 Bienvenue sur CodeVanta-XLS !</h1>
                        </div>
                        <div class="content">
                            <p>Bonjour,</p>
                            <p>Merci pour votre achat ! Voici votre clé de licence pour CodeVanta-XLS :</p>
                            
                            <div class="license-box">
                                <div class="license-key">${licenseKey}</div>
                            </div>

                            <div class="info">
                                <strong>📋 Informations de votre licence :</strong><br>
                                • Plan : <strong>${plan.toUpperCase()}</strong><br>
                                • ${expiryText}<br>
                                • Email : ${email}
                            </div>

                            <h3>🚀 Comment activer votre licence ?</h3>
                            <ol>
                                <li>Téléchargez et installez CodeVanta-XLS</li>
                                <li>Au premier lancement, entrez votre clé de licence</li>
                                <li>Cliquez sur "Activer"</li>
                                <li>Profitez de toutes les fonctionnalités !</li>
                            </ol>

                            <div style="text-align: center;">
                                <a href="${process.env.SITE_URL}/download" class="button">Télécharger CodeVanta-XLS</a>
                            </div>

                            <div class="info">
                                <strong>💡 Besoin d'aide ?</strong><br>
                                Consultez notre <a href="${process.env.SITE_URL}/support">centre d'aide</a> ou contactez-nous à support@codevanta.com
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2025 CodeVanta. Tous droits réservés.</p>
                            <p>Cet email a été envoyé à ${email}</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
            return false;
        }
    }
}

module.exports = new EmailService();
