// script.js
const globe = Globe()(document.getElementById('globe'))
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundColor('#0b1220')
    .pointsData([...Array(500)].map(() => ({
        lat: (Math.random() * 180) - 90,
        lng: (Math.random() * 360) - 180,
        size: Math.random() * 0.7,
        color: '#27ff79'
    })))
    .pointAltitude(0.01)
    .pointColor(d => d.color)
    .pointRadius(0.7)
    .onGlobeReady(() => {
        // Smooth auto-rotation
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.3; // adjust speed
    });
