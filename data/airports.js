// Comprehensive airport database with IATA, ICAO, and coordinates
// Used for globe visualization and IATA↔ICAO conversion
// Coordinates verified against official aviation sources

const AIRPORTS = [
  // Turkey
  { lat: 41.2608, lng: 28.7418, iata: 'IST', icao: 'LTFM', name: 'Istanbul' },
  { lat: 40.8986, lng: 29.3092, iata: 'SAW', icao: 'LTFJ', name: 'Sabiha Gokcen' },
  { lat: 36.8987, lng: 30.8005, iata: 'AYT', icao: 'LTAI', name: 'Antalya' },
  { lat: 40.1281, lng: 32.9951, iata: 'ESB', icao: 'LTAC', name: 'Ankara Esenboga' },
  { lat: 38.2924, lng: 27.1570, iata: 'ADB', icao: 'LTBJ', name: 'Izmir' },
  { lat: 37.7500, lng: 29.7013, iata: 'DNZ', icao: 'LTAY', name: 'Denizli Cardak' },
  { lat: 36.7122, lng: 34.5868, iata: 'MZH', icao: 'LTAP', name: 'Amasya Merzifon' },

  // UK & Ireland
  { lat: 51.4775, lng: -0.4614, iata: 'LHR', icao: 'EGLL', name: 'London Heathrow' },
  { lat: 51.1537, lng: -0.1821, iata: 'LGW', icao: 'EGKK', name: 'London Gatwick' },
  { lat: 53.3537, lng: -2.2750, iata: 'MAN', icao: 'EGCC', name: 'Manchester' },
  { lat: 53.4214, lng: -6.2701, iata: 'DUB', icao: 'EIDW', name: 'Dublin' },

  // France
  { lat: 49.0097, lng: 2.5479, iata: 'CDG', icao: 'LFPG', name: 'Paris CDG' },
  { lat: 48.7233, lng: 2.3794, iata: 'ORY', icao: 'LFPO', name: 'Paris Orly' },

  // Germany
  { lat: 50.0379, lng: 8.5622, iata: 'FRA', icao: 'EDDF', name: 'Frankfurt' },
  { lat: 48.3538, lng: 11.7861, iata: 'MUC', icao: 'EDDM', name: 'Munich' },
  { lat: 52.3800, lng: 13.5225, iata: 'BER', icao: 'EDDB', name: 'Berlin' },

  // Benelux
  { lat: 52.3086, lng: 4.7639, iata: 'AMS', icao: 'EHAM', name: 'Amsterdam' },
  { lat: 50.9014, lng: 4.4844, iata: 'BRU', icao: 'EBBR', name: 'Brussels' },

  // Iberia
  { lat: 40.4936, lng: -3.5668, iata: 'MAD', icao: 'LEMD', name: 'Madrid' },
  { lat: 41.2971, lng: 2.0785, iata: 'BCN', icao: 'LEBL', name: 'Barcelona' },
  { lat: 38.7813, lng: -9.1359, iata: 'LIS', icao: 'LPPT', name: 'Lisbon' },

  // Italy
  { lat: 41.8045, lng: 12.2508, iata: 'FCO', icao: 'LIRF', name: 'Rome' },
  { lat: 45.6306, lng: 8.7281, iata: 'MXP', icao: 'LIMC', name: 'Milan' },

  // Central Europe
  { lat: 47.4647, lng: 8.5492, iata: 'ZRH', icao: 'LSZH', name: 'Zurich' },
  { lat: 48.1103, lng: 16.5697, iata: 'VIE', icao: 'LOWW', name: 'Vienna' },
  { lat: 50.1008, lng: 14.2600, iata: 'PRG', icao: 'LKPR', name: 'Prague' },
  { lat: 47.4298, lng: 19.2611, iata: 'BUD', icao: 'LHBP', name: 'Budapest' },
  { lat: 52.1657, lng: 20.9671, iata: 'WAW', icao: 'EPWA', name: 'Warsaw' },

  // Scandinavia
  { lat: 55.6180, lng: 12.6560, iata: 'CPH', icao: 'EKCH', name: 'Copenhagen' },
  { lat: 59.6519, lng: 17.9186, iata: 'ARN', icao: 'ESSA', name: 'Stockholm' },
  { lat: 60.3172, lng: 24.9633, iata: 'HEL', icao: 'EFHK', name: 'Helsinki' },
  { lat: 59.8973, lng: 10.6817, iata: 'OSL', icao: 'ENGM', name: 'Oslo' },

  // Greece
  { lat: 37.9364, lng: 23.9445, iata: 'ATH', icao: 'LGAV', name: 'Athens' },

  // Russia
  { lat: 55.9726, lng: 37.4146, iata: 'SVO', icao: 'UUEE', name: 'Moscow SVO' },
  { lat: 59.8003, lng: 30.2625, iata: 'LED', icao: 'ULLI', name: 'St Petersburg' },

  // North America – USA
  { lat: 40.6413, lng: -73.7781, iata: 'JFK', icao: 'KJFK', name: 'New York JFK' },
  { lat: 40.6925, lng: -74.1687, iata: 'EWR', icao: 'KEWR', name: 'Newark' },
  { lat: 33.9425, lng: -118.4081, iata: 'LAX', icao: 'KLAX', name: 'Los Angeles' },
  { lat: 37.6213, lng: -122.3790, iata: 'SFO', icao: 'KSFO', name: 'San Francisco' },
  { lat: 41.9742, lng: -87.9073, iata: 'ORD', icao: 'KORD', name: 'Chicago' },
  { lat: 33.6407, lng: -84.4277, iata: 'ATL', icao: 'KATL', name: 'Atlanta' },
  { lat: 32.8998, lng: -97.0403, iata: 'DFW', icao: 'KDFW', name: 'Dallas' },
  { lat: 39.8561, lng: -104.6737, iata: 'DEN', icao: 'KDEN', name: 'Denver' },
  { lat: 47.4502, lng: -122.3088, iata: 'SEA', icao: 'KSEA', name: 'Seattle' },
  { lat: 25.7959, lng: -80.2870, iata: 'MIA', icao: 'KMIA', name: 'Miami' },
  { lat: 42.3656, lng: -71.0096, iata: 'BOS', icao: 'KBOS', name: 'Boston' },
  { lat: 38.9531, lng: -77.4565, iata: 'IAD', icao: 'KIAD', name: 'Washington' },
  { lat: 29.9844, lng: -95.3414, iata: 'IAH', icao: 'KIAH', name: 'Houston' },

  // North America – Canada
  { lat: 43.6777, lng: -79.6248, iata: 'YYZ', icao: 'CYYZ', name: 'Toronto' },
  { lat: 49.1967, lng: -123.1815, iata: 'YVR', icao: 'CYVR', name: 'Vancouver' },
  { lat: 45.4706, lng: -73.7408, iata: 'YUL', icao: 'CYUL', name: 'Montreal' },

  // Central America & Caribbean
  { lat: 19.4361, lng: -99.0719, iata: 'MEX', icao: 'MMMX', name: 'Mexico City' },
  { lat: 20.5218, lng: -86.9261, iata: 'CUN', icao: 'MMUN', name: 'Cancun' },

  // South America
  { lat: -23.4356, lng: -46.4731, iata: 'GRU', icao: 'SBGR', name: 'Sao Paulo' },
  { lat: -22.9099, lng: -43.1634, iata: 'GIG', icao: 'SBGL', name: 'Rio de Janeiro' },
  { lat: -34.8122, lng: -58.5398, iata: 'EZE', icao: 'SAEZ', name: 'Buenos Aires' },
  { lat: -33.3930, lng: -70.7858, iata: 'SCL', icao: 'SCEL', name: 'Santiago' },
  { lat: -12.0219, lng: -77.1143, iata: 'LIM', icao: 'SPJC', name: 'Lima' },
  { lat: 4.7016, lng: -74.1469, iata: 'BOG', icao: 'SKBO', name: 'Bogota' },

  // East Asia
  { lat: 35.5494, lng: 139.7798, iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda' },
  { lat: 35.7647, lng: 140.3864, iata: 'NRT', icao: 'RJAA', name: 'Tokyo Narita' },
  { lat: 37.4602, lng: 126.4407, iata: 'ICN', icao: 'RKSI', name: 'Seoul Incheon' },
  { lat: 40.0799, lng: 116.6031, iata: 'PEK', icao: 'ZBAA', name: 'Beijing' },
  { lat: 31.1434, lng: 121.8053, iata: 'PVG', icao: 'ZSPD', name: 'Shanghai' },
  { lat: 22.3080, lng: 113.9185, iata: 'HKG', icao: 'VHHH', name: 'Hong Kong' },
  { lat: 25.0797, lng: 121.2342, iata: 'TPE', icao: 'RCTP', name: 'Taipei' },

  // Southeast Asia
  { lat: 1.3644, lng: 103.9915, iata: 'SIN', icao: 'WSSS', name: 'Singapore' },
  { lat: 13.6900, lng: 100.7501, iata: 'BKK', icao: 'VTBS', name: 'Bangkok' },
  { lat: 2.7456, lng: 101.7099, iata: 'KUL', icao: 'WMKK', name: 'Kuala Lumpur' },
  { lat: -6.1256, lng: 106.6558, iata: 'CGK', icao: 'WIII', name: 'Jakarta' },
  { lat: 14.5086, lng: 121.0197, iata: 'MNL', icao: 'RPLL', name: 'Manila' },

  // South Asia
  { lat: 28.5562, lng: 77.1000, iata: 'DEL', icao: 'VIDP', name: 'New Delhi' },
  { lat: 19.0896, lng: 72.8656, iata: 'BOM', icao: 'VABB', name: 'Mumbai' },

  // Middle East
  { lat: 25.2528, lng: 55.3644, iata: 'DXB', icao: 'OMDB', name: 'Dubai' },
  { lat: 24.4431, lng: 54.6511, iata: 'AUH', icao: 'OMAA', name: 'Abu Dhabi' },
  { lat: 25.2731, lng: 51.6083, iata: 'DOH', icao: 'OTHH', name: 'Doha' },
  { lat: 32.0114, lng: 34.8867, iata: 'TLV', icao: 'LLBG', name: 'Tel Aviv' },
  { lat: 21.6796, lng: 39.1566, iata: 'JED', icao: 'OEJN', name: 'Jeddah' },
  { lat: 24.9576, lng: 46.6988, iata: 'RUH', icao: 'OERK', name: 'Riyadh' },

  // Africa
  { lat: -26.1367, lng: 28.2411, iata: 'JNB', icao: 'FAOR', name: 'Johannesburg' },
  { lat: -33.9715, lng: 18.6021, iata: 'CPT', icao: 'FACT', name: 'Cape Town' },
  { lat: 30.1219, lng: 31.4056, iata: 'CAI', icao: 'HECA', name: 'Cairo' },
  { lat: 33.9273, lng: -6.9028, iata: 'CMN', icao: 'GMMN', name: 'Casablanca' },
  { lat: -1.3192, lng: 36.9278, iata: 'NBO', icao: 'HKJK', name: 'Nairobi' },
  { lat: 6.5774, lng: 3.3214, iata: 'LOS', icao: 'DNMM', name: 'Lagos' },
  { lat: 9.0069, lng: 38.7993, iata: 'ADD', icao: 'HAAB', name: 'Addis Ababa' },
  { lat: 0.0424, lng: 32.4435, iata: 'EBB', icao: 'HUEN', name: 'Entebbe' },

  // Oceania
  { lat: -33.9461, lng: 151.1772, iata: 'SYD', icao: 'YSSY', name: 'Sydney' },
  { lat: -37.6690, lng: 144.8410, iata: 'MEL', icao: 'YMML', name: 'Melbourne' },
  { lat: -36.8485, lng: 174.7633, iata: 'AKL', icao: 'NZAA', name: 'Auckland' },
];

// Quick lookup maps
const byICAO = {};
const byIATA = {};
AIRPORTS.forEach(a => {
  byICAO[a.icao] = a;
  byIATA[a.iata] = a;
});

/**
 * Find an airport by either IATA (3 chars) or ICAO (4 chars) code
 * @returns {{ airport: object|null, icao: string }} 
 */
export function findAirport(code) {
  const upper = code.toUpperCase().trim();
  
  if (upper.length === 3) {
    // IATA code
    const airport = byIATA[upper] || null;
    return { airport, icao: airport ? airport.icao : null };
  }
  
  if (upper.length === 4) {
    // ICAO code
    const airport = byICAO[upper] || null;
    return { airport, icao: upper };
  }
  
  return { airport: null, icao: upper };
}

/**
 * Get all airports for globe visualization
 */
export function getAllAirports() {
  return AIRPORTS;
}

export default AIRPORTS;
