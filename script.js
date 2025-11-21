const globeEl = document.getElementById('globe');

const globe = Globe()(globeEl)
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
  .backgroundColor('rgba(0,0,0,0)')  // transparent pour que le fond du body passe
  .pointOfView({ altitude: 3.5 })
  .pointsData([...Array(500)].map(() => ({
    lat: Math.random() * 180 - 90,
    lng: Math.random() * 360 - 180,
    size: Math.random() * 0.7 + 0.2,
    color: '#a8e6cf'
  })))
  .pointAltitude(0.008)
  .pointRadius(0.7)
  .pointColor(d => d.color);

// Rotation uniquement au scroll
let lastScrollY = 0;
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY || document.documentElement.scrollTop;
    const diff = currentScrollY - lastScrollY;
    globe.rotation.y += diff * 0.0003;  // ajuste la sensibilité ici
    lastScrollY = currentScrollY;
});
