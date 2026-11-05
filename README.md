Visor hidrológico e inundaciones - Cuenca del río Tumbes
Dashboard estático para GitHub Pages. No utiliza Python ni servidor backend.

1. Archivos de datos
data/caudales.xlsx: serie horaria; columna fecha y columnas Q.
data/ubicacion.xlsx: columnas punto, lat, lon.
data/quebradas/*.geojson: ocho polígonos exportados en WGS84 (EPSG:4326).
data/inundaciones/manifest.json: relación entre objetivo, caudal de escenario y seis PNG.
2. Activar GitHub Pages
En GitHub: Settings → Pages → Build and deployment → Deploy from a branch. Selecciona main, carpeta / (root) y guarda. Espera a que GitHub publique la URL.

3. Importante
Los nombres de columnas y puntos se configuran en js/datos.js.
Si las hojas Excel no son la primera, indica su nombre en caudalesSheet y ubicacionesSheet.
GeoJSON debe estar en coordenadas geográficas WGS84 (EPSG:4326).
Edita manifest.json: crea escenarios para cada objetivo y caudal de referencia. El código elige el escenario cuyo caudal de referencia esté más cerca del caudal máximo de la serie seleccionada.
Los PNG deben ser accesibles como archivos estáticos y sus rutas deben coincidir exactamente con las del manifest.
GitHub Pages es público si el repositorio/página es público. No subas claves, contraseñas ni datos privados.
La fecha se interpreta desde el Excel; procura usar fechas locales de Perú (UTC-5) de forma consistente.
