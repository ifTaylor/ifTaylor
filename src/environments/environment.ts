const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export const environment = {
    production: !isLocalhost,
    apiUrl: isLocalhost
        ? 'http://localhost:8000'
        : 'https://iftaylor-api.onrender.com',
};
