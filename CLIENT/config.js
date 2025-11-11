// Configuración de API
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://winecounter.onrender.com'; // Cambia esto por tu URL de Render cuando lo tengas

window.API_CONFIG = {
  BASE_URL: API_URL
};
