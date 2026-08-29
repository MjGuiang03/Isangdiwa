// ─── Coordinate lookups ──────────────────────────────────────────────────────
const PROVINCE_COORDS = {
  'Kalinga':           { lat: 17.4766, lng: 121.3554 },
  'Abra':              { lat: 17.5967, lng: 120.7982 },
  'Benguet':           { lat: 16.4023, lng: 120.5960 },
  'Apayao':            { lat: 18.1186, lng: 121.1685 },
  'Ifugao':            { lat: 16.8200, lng: 121.1500 },
  'Mountain Province': { lat: 17.0833, lng: 121.0000 },
  'CAR':               { lat: 17.0000, lng: 121.0000 },

  'Ilocos Norte':      { lat: 18.1960, lng: 120.5927 },
  'Ilocos Sur':        { lat: 17.5747, lng: 120.3869 },
  'La Union':          { lat: 16.6159, lng: 120.3209 },
  'Pangasinan':        { lat: 15.8949, lng: 120.2863 },
  'Region I':          { lat: 16.8000, lng: 120.4000 },

  'Batanes':           { lat: 20.4487, lng: 121.9702 },
  'Cagayan':           { lat: 17.6132, lng: 121.7269 },
  'Isabela':           { lat: 16.9754, lng: 121.8107 },
  'Nueva Vizcaya':     { lat: 16.3200, lng: 121.1000 },
  'Quirino':           { lat: 16.2700, lng: 121.5300 },
  'Region II':         { lat: 17.0000, lng: 121.7000 },

  'Aurora':            { lat: 15.7500, lng: 121.5500 },
  'Bataan':            { lat: 14.6800, lng: 120.4700 },
  'Bulacan':           { lat: 14.7942, lng: 120.8767 },
  'Nueva Ecija':       { lat: 15.5784, lng: 121.0687 },
  'Pampanga':          { lat: 15.0794, lng: 120.6200 },
  'Tarlac':            { lat: 15.4755, lng: 120.5963 },
  'Zambales':          { lat: 15.3300, lng: 120.1200 },
  'Region III':        { lat: 15.2000, lng: 120.7000 },

  'NCR':               { lat: 14.5995, lng: 120.9842 },
  'Metro Manila':      { lat: 14.5995, lng: 120.9842 },
  'Manila':            { lat: 14.5995, lng: 120.9842 },
  'Quezon City':       { lat: 14.6760, lng: 121.0437 },
  'Caloocan':          { lat: 14.6500, lng: 120.9833 },
  'Las Piñas':         { lat: 14.4445, lng: 120.9939 },
  'Makati':            { lat: 14.5547, lng: 121.0244 },
  'Malabon':           { lat: 14.6625, lng: 120.9566 },
  'Mandaluyong':       { lat: 14.5794, lng: 121.0359 },
  'Marikina':          { lat: 14.6507, lng: 121.1029 },
  'Muntinlupa':        { lat: 14.4081, lng: 121.0415 },
  'Navotas':           { lat: 14.6667, lng: 120.9417 },
  'Parañaque':         { lat: 14.4793, lng: 121.0198 },
  'Pasay':             { lat: 14.5378, lng: 120.9996 },
  'Pasig':             { lat: 14.5764, lng: 121.0851 },
  'Pateros':           { lat: 14.5453, lng: 121.0687 },
  'San Juan':          { lat: 14.6019, lng: 121.0355 },
  'Taguig':            { lat: 14.5176, lng: 121.0509 },
  'Valenzuela':        { lat: 14.6942, lng: 120.9842 },

  'Batangas':          { lat: 13.7565, lng: 121.0583 },
  'Cavite':            { lat: 14.2829, lng: 120.8999 },
  'Laguna':            { lat: 14.2700, lng: 121.3500 },
  'Quezon':            { lat: 13.9300, lng: 121.6100 },
  'Rizal':             { lat: 14.5243, lng: 121.3579 },
  'Region IV-A':       { lat: 14.1000, lng: 121.2000 },

  'Bohol':             { lat: 9.8500,  lng: 124.1433 },
  'Cebu':              { lat: 10.3157, lng: 123.8854 },
  'Negros Oriental':   { lat: 9.5870,  lng: 122.9274 },
  'Siquijor':          { lat: 9.1997,  lng: 123.5952 },
  'Region VII':        { lat: 9.8000,  lng: 123.6000 },

  'Agusan Del Norte':  { lat: 8.9481,  lng: 125.5436 },
  'Agusan Del Sur':    { lat: 8.5000,  lng: 125.7000 },
  'Dinagat Islands':   { lat: 10.0500, lng: 125.6000 },
  'Surigao Del Norte': { lat: 9.7832,  lng: 125.4943 },
  'Surigao Del Sur':   { lat: 8.7512,  lng: 126.0652 },
  'Region XIII':       { lat: 9.0000,  lng: 125.8000 },
};

const EXACT_COORDS = {
  'Tabuk':             { lat: 17.4113, lng: 121.4438 },
  'Baguio':            { lat: 16.4023, lng: 120.5960 },
  'Santiago City':     { lat: 16.6892, lng: 121.5486 },
  'Dagupan':           { lat: 16.0433, lng: 120.3274 },
  'San Carlos':        { lat: 15.9267, lng: 120.3471 },
  'Meycauayan City':   { lat: 14.7370, lng: 120.9610 },
  'San Jose Del Monte':{ lat: 14.8137, lng: 121.0453 },
  'Valenzuela City':   { lat: 14.6942, lng: 120.9842 },
  'Mandaue':           { lat: 10.3236, lng: 123.9223 },
  'Butuan City':       { lat: 8.9492,  lng: 125.5438 },
  'Bayugan':           { lat: 8.7135,  lng: 125.7680 },
  'Montalban':         { lat: 14.7320, lng: 121.1515 },
  'Manaoag':           { lat: 16.0439, lng: 120.4856 },
};

const jitter = () => (Math.random() - 0.5) * 0.08;
export const getCoords = (name, province) => {
  if (EXACT_COORDS[name]) return { lat: EXACT_COORDS[name].lat, lng: EXACT_COORDS[name].lng };
  const p = PROVINCE_COORDS[province];
  return p ? { lat: p.lat + jitter(), lng: p.lng + jitter() } : { lat: 14.5, lng: 121.0 };
};

// ─── Branch data ordered North → South ───────────────────────────────────────
export const branchData = [
  // ── CAR: Kalinga ──
  { region: 'CAR', province: 'Kalinga', name: 'Tabuk', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Zapote', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Bliss', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Libanon', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Batong Buhay', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Balatoc', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Kalinga', name: 'Lat-nog', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── CAR: Abra ──
  { region: 'CAR', province: 'Abra', name: 'Lamao', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Lingey', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Cabaruyan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Ducligan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Gangal', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Bila-Bila', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Naguillian', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Ud-udiao', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Villa Conchita', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Ay-yeng Manabo', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Dao-angan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Kilong-olao', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Bao-yan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Amti', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Danac', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Bengued', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  { region: 'CAR', province: 'Abra', name: 'Sappaac', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'CAR', province: 'Abra', name: 'Saccaang', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── CAR: Benguet ──
  { region: 'CAR', province: 'Benguet', name: 'Baguio', serviceTimes: [{ day: 'Sunday', time: '8:00 AM & 10:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  // ── Region II: Isabela ──
  { region: 'Region II', province: 'Isabela', name: 'Santiago City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Friday', time: '7:00 PM' }] },
  // ── Region I: Pangasinan ──
  { region: 'Region I', province: 'Pangasinan', name: 'Dagupan', serviceTimes: [{ day: 'Sunday', time: '10:00 AM' }, { day: 'Wednesday', time: '7:30 PM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Mangatarem', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Laoak Langka', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Orbiztondo', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Malasique, Bolaoit', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Taloyan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Binmaley', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'San Carlos', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Friday', time: '7:00 PM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Manaoag', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Pozorrobio', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region I', province: 'Pangasinan', name: 'Alcala', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region III: Bulacan ──
  { region: 'Region III', province: 'Bulacan', name: 'Meycauayan City', serviceTimes: [{ day: 'Sunday', time: '8:00 AM & 10:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }, { day: 'Friday', time: '6:00 PM' }] },
  { region: 'Region III', province: 'Bulacan', name: 'Camalig', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region III', province: 'Bulacan', name: 'San Jose Del Monte', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Wednesday', time: '7:30 PM' }] },
  // ── Region III: Tarlac ──
  { region: 'Region III', province: 'Tarlac', name: 'Pacpaco, San Manuel', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region III', province: 'Tarlac', name: 'Victoria', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region III: Nueva Ecija ──
  { region: 'Region III', province: 'Nueva Ecija', name: 'Bambanaba, Cuyapo', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── NCR ──
  { region: 'NCR', province: 'NCR', name: 'Valenzuela City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM & 11:00 AM' }, { day: 'Tuesday', time: '7:00 PM' }] },
  { region: 'NCR', province: 'NCR', name: 'Tandang Sora, Quezon City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  { region: 'NCR', province: 'NCR', name: 'COA, Quezon City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'NCR', province: 'NCR', name: 'Payatas, Quezon City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'NCR', province: 'NCR', name: 'Malaria, Caloocan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region IV-A: Rizal ──
  { region: 'Region IV-A', province: 'Rizal', name: 'Montalban', serviceTimes: [{ day: 'Sunday', time: '9:30 AM' }, { day: 'Friday', time: '7:00 PM' }] },
  // ── Region VII: Cebu ──
  { region: 'Region VII', province: 'Cebu', name: 'Mandaue', serviceTimes: [{ day: 'Sunday', time: '9:00 AM & 11:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  { region: 'Region VII', province: 'Cebu', name: 'Li-loan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region VII', province: 'Cebu', name: 'Calero', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region VII', province: 'Cebu', name: 'Compostela', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region XIII: Agusan Del Norte ──
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Butuan City', serviceTimes: [{ day: 'Sunday', time: '9:00 AM & 11:00 AM' }, { day: 'Wednesday', time: '7:00 PM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'RTR', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Jabonga, Bangonay', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Kasiklan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'San Mateo', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Fatima Kim.13', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Bayugan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Ibuan', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Agusan Del Norte', name: 'Balubo', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region XIII: Surigao Del Norte ──
  { region: 'Region XIII', province: 'Surigao Del Norte', name: 'Alegria', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Surigao Del Norte', name: 'Bonifacio', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Surigao Del Norte', name: 'Matin-ao', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  { region: 'Region XIII', province: 'Surigao Del Norte', name: 'Ipil', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
  // ── Region XIII: Surigao Del Sur ──
  { region: 'Region XIII', province: 'Surigao Del Sur', name: 'Kinabigtasan Tago', serviceTimes: [{ day: 'Sunday', time: '9:00 AM' }] },
].map(b => ({ ...b, ...getCoords(b.name, b.province) }));

export const REGION_ORDER = ['CAR', 'Region II', 'Region I', 'Region III', 'NCR', 'Region IV-A', 'Region VII', 'Region XIII'];

export const REGION_LABELS = {
  'CAR': 'Cordillera Administrative Region',
  'Region II': 'Cagayan Valley',
  'Region I': 'Ilocos Region',
  'Region III': 'Central Luzon',
  'NCR': 'National Capital Region',
  'Region IV-A': 'CALABARZON',
  'Region VII': 'Central Visayas',
  'Region XIII': 'Caraga Region',
};

export const DAY_COLORS = {
  Sunday: { background: '#eff4ff', color: '#155dfc' },
  Tuesday: { background: '#fdf4ff', color: '#9333ea' },
  Wednesday: { background: '#fff7ed', color: '#c2410c' },
  Friday: { background: '#fefce8', color: '#a16207' },
};

export const COMMUNITY_MAP = {
  'Tabuk': 'Tabuk', 'Zapote': 'Zapote', 'Bliss': 'Bliss', 'Libanon': 'Libanon',
  'Batong Buhay': 'Batong Buhay', 'Balatoc': 'Balatoc', 'Lat-nog': 'Lat-nog',
  'Santiago City': 'Santiago City',
  'Lamao': 'Lamao', 'Lingey': 'Lingey', 'Cabaruyan': 'Cabaruyan', 'Ducligan': 'Ducligan',
  'Gangal': 'Gangal', 'Bila-Bila': 'Bila-Bila', 'Naguillian': 'Naguillian', 'Ud-udiao': 'Ud-udiao',
  'Villa Conchita': 'Villa Conchita', 'Ay-yeng Manabo': 'Ay-yeng Manabo', 'Dao-angan': 'Dao-angan',
  'Kilong-olao': 'Kilong-olao', 'Bao-yan': 'Bao-yan', 'Amti': 'Amti', 'Danac': 'Danac',
  'Bengued': 'Bengued', 'Sappaac': 'Sappaac', 'Saccaang': 'Saccaang',
  'Baguio': 'Baguio', 'Montalban': 'Montalban',
  'Valenzuela City': 'Valenzuela City',
  'Tandang Sora, Quezon City': 'Tandang Sora, Quezon City',
  'COA, Quezon City': 'COA, Quezon City',
  'Payatas, Quezon City': 'Payatas, Quezon City',
  'Malaria, Caloocan': 'Malaria, Caloocan',
  'Meycauayan City': 'Meycauayan City', 'Camalig': 'Camalig', 'San Jose Del Monte': 'San Jose Del Monte',
  'Pacpaco, San Manuel': 'Pacpaco, San Manuel', 'Victoria': 'Victoria',
  'Bambanaba, Cuyapo': 'Bambanaba, Cuyapo',
  'Dagupan': 'Dagupan', 'Mangatarem': 'Mangatarem', 'Laoak Langka': 'Laoak Langka',
  'Orbiztondo': 'Orbiztondo', 'Malasiqui, Bolaoit': 'Malasique, Bolaoit', 'Taloyan': 'Taloyan',
  'Binmaley': 'Binmaley', 'San Carlos': 'San Carlos', 'Manaoag': 'Manaoag',
  'Pozorrubio': 'Pozorrobio', 'Alcala': 'Alcala',
  'Butuan City': 'Butuan City', 'RTR': 'RTR', 'Jabonga, Bangonay': 'Jabonga, Bangonay',
  'Kasiklan': 'Kasiklan', 'San Mateo': 'San Mateo', 'Fatima Kim.13': 'Fatima Kim.13',
  'Bayugan': 'Bayugan', 'Ibuan': 'Ibuan', 'Balubo': 'Balubo',
  'Alegria': 'Alegria', 'Bonifacio': 'Bonifacio', 'Matin-ao': 'Matin-ao', 'Ipil': 'Ipil',
  'Kinabigtasan Tago': 'Kinabigtasan Tago',
  'Mandaue': 'Mandaue', 'Li-loan': 'Li-loan', 'Calero': 'Calero', 'Compostela': 'Compostela'
};
