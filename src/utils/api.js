const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');
const API_URL = (isLocal ? `http://${window.location.hostname}:5000` : window.location.origin).replace(/\/$/, "");

export default API_URL;
