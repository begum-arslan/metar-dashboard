import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import parse from 'metar-parser';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationParam = searchParams.get('station');
    const start = searchParams.get('start'); // format YYYY-MM-DD
    const end = searchParams.get('end'); // format YYYY-MM-DD

    if (!stationParam || !start || !end) {
      return NextResponse.json({ error: 'Missing required parameters (station, start, end)' }, { status: 400 });
    }

    const [year1, month1, day1] = start.split('-');
    const [year2, month2, day2] = end.split('-');

    const iemUrl = new URL('https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py');
    
    // Support multiple comma-separated stations
    const stations = stationParam.split(',');
    stations.forEach(st => {
      const trimmed = st.trim();
      if (trimmed) {
        iemUrl.searchParams.append('station', trimmed.toUpperCase());
      }
    });

    iemUrl.searchParams.append('data', 'metar');
    iemUrl.searchParams.append('year1', year1);
    iemUrl.searchParams.append('month1', month1);
    iemUrl.searchParams.append('day1', day1);
    iemUrl.searchParams.append('year2', year2);
    iemUrl.searchParams.append('month2', month2);
    iemUrl.searchParams.append('day2', day2);
    iemUrl.searchParams.append('tz', 'Etc/UTC');
    iemUrl.searchParams.append('format', 'onlycomma');
    iemUrl.searchParams.append('latlon', 'yes');
    iemUrl.searchParams.append('missing', 'M');
    iemUrl.searchParams.append('trace', 'T');
    iemUrl.searchParams.append('direct', 'no');
    // report_type=1 (Routine), report_type=2 (Special)
    iemUrl.searchParams.append('report_type', '1');
    iemUrl.searchParams.append('report_type', '2');

    const response = await fetch(iemUrl.toString(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`IEM API responded with status ${response.status}`);
    }

    const csvText = await response.text();
    
    // Parse CSV
    const parsedCsv = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    // Parse METAR strings
    const results = [];
    for (const row of parsedCsv.data) {
      if (row.metar && typeof row.metar === 'string' && row.metar.trim() !== '') {
        try {
          const metarData = parse(row.metar);
          
          results.push({
            station: row.station,
            valid: row.valid, // Timestamp in UTC
            lat: row.lat ? parseFloat(row.lat) : null,
            lon: row.lon ? parseFloat(row.lon) : null,
            raw: row.metar,
            temperature: metarData.temperature?.celsius || null,
            dewpoint: metarData.dewpoint?.celsius || null,
            windSpeed: metarData.wind?.speedKt || 0,
            windGust: metarData.wind?.gust || 0,
            windDirection: metarData.wind?.direction || null,
            altimeter: metarData.altimeter?.inches || null,
            visibility: metarData.visibility?.meters || null,
            weather: metarData.weather || [],
            clouds: metarData.clouds || [],
            pressureHpa: metarData.altimeter?.millibars || (metarData.altimeter?.inches ? Math.round(metarData.altimeter.inches * 33.8639) : null),
          });
        } catch (err) {
          // If a specific METAR fails to parse, we can skip it or just include raw
          console.warn('Failed to parse METAR string:', row.metar);
        }
      }
    }

    return NextResponse.json({ data: results });

  } catch (error) {
    console.error('Error fetching/parsing API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
