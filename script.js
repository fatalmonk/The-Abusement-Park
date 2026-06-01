const seasons = [
    { year: '2008_09', title: 'Season 2008-09', desc: 'The beginning', img: '2008_09.png', winner: 'TBD' },
    { year: '2009_10', title: 'Season 2009-10', desc: 'Growing pains', img: '2009_10.png', winner: 'TBD' },
    { year: '2010_11', title: 'Season 2010-11', desc: 'Finding our stride', img: '2010_11.png', winner: 'TBD' },
    { year: '2011_12', title: 'Season 2011-12', desc: 'Expansion', img: '2011_12.png', winner: 'TBD' },
    { year: '2012_13', title: 'Season 2012-13', desc: 'New heights', img: '2012_13.png', winner: 'TBD' },
    { year: '2013_14', title: 'Season 2013-14', desc: 'Maturing', img: '2013_14.png', winner: 'TBD' },
    { year: '2014_15', title: 'Season 2014-15', desc: 'Evolution', img: '2014_15.png', winner: 'TBD' },
    { year: '2015_16', title: 'Season 2015-16', desc: 'Redefining', img: '2015_16.png', winner: 'TBD' },
    { year: '2016_17', title: 'Season 2016-17', desc: 'Resilience', img: '2016_17.png', winner: 'TBD' },
    { year: '2017_18', title: 'Season 2017-18', desc: 'Transformation', img: '2017_18.png', winner: 'TBD' },
    { year: '2018_19', title: 'Season 2018-19', desc: 'Innovation', img: '2018_19.png', winner: 'TBD' },
    { year: '2019_20', title: 'Season 2019-20', desc: 'Adaptation', img: '2019_20.png', winner: 'TBD' },
    { year: '2020_21', title: 'Season 2020-21', desc: 'Perseverance', img: '2020_21.png', winner: 'TBD' },
    { year: '2021_22', title: 'Season 2021-22', desc: 'Rebuilding', img: '2021_22.png', winner: 'TBD' },
    { year: '2022_23', title: 'Season 2022-23', desc: 'Momentum', img: '2022_23.png', winner: 'TBD' },
    { year: '2023_24', title: 'Season 2023-24', desc: 'Collaboration', img: '2023_24.png', winner: 'TBD' },
    { year: '2024_25', title: 'Season 2024-25', desc: 'Excellence', img: '2024_25.png', winner: 'TBD' },
    { year: '2025_26', title: 'Season 2025-26', desc: 'The future', img: '2025_26.png', winner: 'TBD' }
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('seasonsGrid');
    
    seasons.reverse().forEach(season => {
        const card = document.createElement('div');
        card.className = 'season-card';
        card.innerHTML = `
            <img src="images/${season.img}" 
                 alt="${season.title}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 180%22><rect fill=%22%231a1a2e%22 width=%22400%22 height=%22180%22/><text fill=%22%23666%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22>${season.year}</text></svg>'">
            <div class="season-card-content">
                <h3>${season.title}</h3>
                <p class="winner">🏆 ${season.winner}</p>
                <p>${season.desc}</p>
            </div>
        `;
        card.addEventListener('click', () => {
            window.open(`images/${season.img}`, '_blank');
        });
        grid.appendChild(card);
    });
});
