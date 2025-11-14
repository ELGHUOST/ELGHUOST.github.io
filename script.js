const globe = Globe()(document.getElementById('globe'))
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')  // correct URL
    .pointsData([...Array(500)].map(() => ({  // reduced number of points for performance
        lat: (Math.random() * 180) - 90,   // latitude from -90 to 90
        lng: (Math.random() * 360) - 180,  // longitude from -180 to 180
        size: Math.random() * 0.7,
        color: "#27ff79"
    })))
    .pointAltitude(0.01)
    .pointColor(d => d.color)
    .pointRadius(0.7);
