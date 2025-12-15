// Premium Feedback & User-Friendly Features

// Toast Notification System
class ToastManager {
    constructor() {
        this.container = this.createContainer();
    }

    createContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const titles = {
            success: 'Succès',
            error: 'Erreur',
            warning: 'Attention',
            info: 'Information'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;

        this.container.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    }

    remove(toast) {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

const toast = new ToastManager();

// Tooltip System
class TooltipManager {
    constructor() {
        this.tooltip = this.createTooltip();
        this.initListeners();
    }

    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
        return tooltip;
    }

    initListeners() {
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.show(target);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.hide();
            }
        });
    }

    show(element) {
        const text = element.getAttribute('data-tooltip');
        this.tooltip.textContent = text;
        this.tooltip.classList.add('show');

        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        this.tooltip.style.left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + 'px';
        this.tooltip.style.top = rect.top - tooltipRect.height - 10 + 'px';
    }

    hide() {
        this.tooltip.classList.remove('show');
    }
}

const tooltipManager = new TooltipManager();

// Loading Overlay
class LoadingManager {
    constructor() {
        this.overlay = null;
    }

    show(message = 'Chargement...') {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'loading-overlay';
        this.overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
    }

    hide() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}

const loading = new LoadingManager();

// Add tooltips to all buttons
document.addEventListener('DOMContentLoaded', () => {
    // Add tooltips
    const tooltips = {
        'sort-btn': 'Trier les données par colonne',
        'filter-btn': 'Filtrer les lignes selon des critères',
        'calculate-btn': 'Calculer les statistiques d\'une colonne',
        'chart-btn': 'Créer un graphique personnalisé',
        'new-file-btn': 'Créer un nouveau fichier vide',
        'theme-toggle': 'Basculer entre mode clair et sombre',
        'zoom-in': 'Agrandir l\'affichage',
        'zoom-out': 'Réduire l\'affichage',
        'zoom-reset': 'Réinitialiser le zoom'
    };

    Object.entries(tooltips).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
            element.setAttribute('data-tooltip', text);
        }
    });

    // Button feedback removed as per user request

    // Add interactive class to cards (excluding the main data table container)
    document.querySelectorAll('.glass-card, .stat-card, .chart-card').forEach(card => {
        if (!card.classList.contains('table-container')) {
            card.classList.add('interactive');
        }
    });
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.toast = toast;
    window.loading = loading;
}
