const API_SPORTS_KEY = 'da0d7c0a26d6309d94c406a2271ddfca';
const BASE_URL = 'https://v3.football.api-sports.io';

async function test() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const [resToday, resTom] = await Promise.all([
      fetch(`${BASE_URL}/fixtures?date=${todayStr}`, { headers: { 'x-apisports-key': API_SPORTS_KEY } }),
      fetch(`${BASE_URL}/fixtures?date=${tomorrowStr}`, { headers: { 'x-apisports-key': API_SPORTS_KEY } })
    ]);
    
    const dataToday = await resToday.json();
    const dataTom = await resTom.json();
    
    const allFixtures = [...(dataToday.response || []), ...(dataTom.response || [])];

    const majorLeagues = [
      39, 40, 140, 135, 78, 61, 2, 3, 848, 253, 88, 94, 71, 128, 262
    ];

    const now = Date.now();

    let upcomingFixtures = allFixtures.filter((f) => 
      f.fixture.status.short === 'NS' && 
      (f.fixture.timestamp * 1000) > now &&
      majorLeagues.includes(f.league.id)
    );

    console.log("Total upcoming fixtures:", upcomingFixtures.length);
    if(upcomingFixtures.length > 0) {
        console.log(upcomingFixtures[0].fixture);
        console.log(upcomingFixtures[0].league);
    }
}

test();
