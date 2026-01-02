/**
 * Client-side logger for intercepting errors and forwarding to main process.
 */
(function () {
    if (!window.electronAPI || !window.electronAPI.log) {
        console.warn('Electron API not available for client-logger');
        return;
    }

    const log = window.electronAPI.log;

    // Helper to format error data
    function forwardError(message, error, level = 'error') {
        const errorInfo = {
            level: level,
            message: message,
            stack: error ? error.stack : null,
            time: new Date().toISOString()
        };

        // Ensure message is a string for logging
        if (typeof message === 'object') {
            try {
                errorInfo.message = JSON.stringify(message);
            } catch (e) {
                errorInfo.message = '[Object that could not be stringified]';
            }
        }

        log(errorInfo);
    }

    // Intercept console.error
    const originalConsoleError = console.error;
    console.error = function (...args) {
        originalConsoleError.apply(console, args);

        const message = args.map(arg => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch (e) { return '[Object]'; }
            }
            return String(arg);
        }).join(' ');

        forwardError(message, args.find(arg => arg instanceof Error));
    };

    // Global error handler
    window.addEventListener('error', function (event) {
        forwardError(
            `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
            event.error
        );
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', function (event) {
        forwardError(
            `Unhandled Promise Rejection: ${event.reason}`,
            event.reason instanceof Error ? event.reason : null
        );
    });

    console.log('[CLIENT-LOGGER] Initialized and intercepting "rouge" errors.');
})();
