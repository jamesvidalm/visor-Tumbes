
# ================================================================
# GFS TUMBES -> UN SOLO JSON (72 HORAS), SIN INTERPOLACION
# Conserva los puntos GFS en sus coordenadas originales.
# NO aplica IDW, Kriging, griddata ni extrapolacion.
# ================================================================

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime

# ------------------------------------------------
# 1. RUTAS
# ------------------------------------------------
CARPETA = r"E:\descarga_gfs\GFS_RRI"

ARCHIVO_CSV = os.path.join(
    CARPETA,
    "GFS_TUMBES_20261112_12UTC.csv"
)

CARPETA_SALIDA = os.path.join(
    CARPETA,
    "JSON_GFS_TUMBES"
)

os.makedirs(CARPETA_SALIDA, exist_ok=True)

ARCHIVO_JSON = os.path.join(
    CARPETA_SALIDA,
    "GFS_TUMBES_20261112_12UTC.json"
)

# ------------------------------------------------
# 2. LEER Y VALIDAR CSV
# ------------------------------------------------
if not os.path.isfile(ARCHIVO_CSV):
    raise FileNotFoundError(
        f"No se encuentra el CSV:\n{ARCHIVO_CSV}"
    )

df = pd.read_csv(ARCHIVO_CSV)

col_pixel = [
    c for c in df.columns
    if c.startswith("Pixel_")
]

if "Fecha_Peru_UTC-5" not in df.columns:
    raise ValueError(
        "Falta la columna Fecha_Peru_UTC-5."
    )

if len(col_pixel) == 0 or len(df) < 3:
    raise ValueError(
        "El CSV no tiene la estructura esperada."
    )

# Fila 0: latitud
# Fila 1: longitud
# Filas 2+: precipitación horaria

lat0 = pd.to_numeric(
    df.loc[0, col_pixel],
    errors="coerce"
).to_numpy(dtype=float)

lon0 = pd.to_numeric(
    df.loc[1, col_pixel],
    errors="coerce"
).to_numpy(dtype=float)

fechas0 = pd.to_datetime(
    df.loc[2:, "Fecha_Peru_UTC-5"],
    errors="coerce"
)

lluvia0 = df.loc[2:, col_pixel].apply(
    pd.to_numeric,
    errors="coerce"
).to_numpy(dtype=float)

# ------------------------------------------------
# 3. VALIDAR COORDENADAS
# ------------------------------------------------
valid = (
    np.isfinite(lat0) &
    np.isfinite(lon0)
)

lat0 = lat0[valid]
lon0 = lon0[valid]
lluvia0 = lluvia0[:, valid]

# Redondeo mínimo para uniformizar coordenadas
lat0 = np.round(lat0, 4)
lon0 = np.round(lon0, 4)

if len(lat0) == 0:
    raise ValueError(
        "No existen coordenadas GFS válidas."
    )

# ------------------------------------------------
# 4. VALIDAR FECHAS
# ------------------------------------------------
valid_time = ~fechas0.isna().to_numpy()

fechas = fechas0[valid_time].reset_index(drop=True)
lluvia = lluvia0[valid_time, :]

# Orden cronológico
order = np.argsort(fechas.to_numpy())

fechas = fechas.iloc[order].reset_index(drop=True)
lluvia = lluvia[order, :]

if len(fechas) == 0:
    raise ValueError(
        "No existen fechas válidas."
    )

if lluvia.shape[0] != len(fechas):
    raise ValueError(
        "Error en las dimensiones de la lluvia."
    )

# ------------------------------------------------
# 5. CREAR LISTA DE PUNTOS GFS
# ------------------------------------------------
puntos = []

for k in range(len(lat0)):

    punto = {
        "id": f"GFS_{k+1:03d}",
        "latitude": float(lat0[k]),
        "longitude": float(lon0[k]),
        "precipitation": []
    }

    for t in range(len(fechas)):

        valor = lluvia[t, k]

        if np.isfinite(valor):
            valor = max(float(valor), 0.0)
        else:
            valor = None

        punto["precipitation"].append(valor)

    puntos.append(punto)

# ------------------------------------------------
# 6. CONSOLIDAR PUNTOS DUPLICADOS
# ------------------------------------------------
# Si dos columnas tienen las mismas coordenadas,
# se conserva un único punto y se promedian sus valores.
# Esto NO es interpolación.

puntos_unicos = {}

for punto in puntos:

    clave = (
        punto["latitude"],
        punto["longitude"]
    )

    if clave not in puntos_unicos:

        puntos_unicos[clave] = {
            "id": f"GFS_{len(puntos_unicos)+1:03d}",
            "latitude": punto["latitude"],
            "longitude": punto["longitude"],
            "valores": []
        }

    puntos_unicos[clave]["valores"].append(
        punto["precipitation"]
    )

puntos_finales = []

for punto in puntos_unicos.values():

    matriz = np.array(
        punto["valores"],
        dtype=object
    )

    lluvia_final = []

    for t in range(len(fechas)):

        valores = [
            float(v)
            for v in matriz[:, t]
            if v is not None
        ]

        if valores:
            lluvia_final.append(
                float(np.mean(valores))
            )
        else:
            lluvia_final.append(None)

    puntos_finales.append({
        "id": punto["id"],
        "latitude": punto["latitude"],
        "longitude": punto["longitude"],
        "precipitation": lluvia_final
    })

# ------------------------------------------------
# 7. CONSTRUIR JSON
# ------------------------------------------------
fechas_json = [
    fecha.strftime("%Y-%m-%dT%H:%M:%S")
    for fecha in fechas
]

datos_json = {

    "metadata": {

        "title": "Pronóstico de precipitación GFS - Tumbes",

        "model": "GFS",

        "initialization_utc": "2026-11-12 12:00 UTC",

        "timezone": "America/Lima",

        "utc_offset": "-05:00",

        "crs": "EPSG:4326",

        "units": "mm/h",

        "forecast_hours": len(fechas),

        "number_of_points": len(puntos_finales),

        "spatial_method": "Original GFS points",

        "interpolation": False,

        "extrapolation": False

    },

    "time": fechas_json,

    "points": puntos_finales

}

# ------------------------------------------------
# 8. GUARDAR JSON
# ------------------------------------------------
with open(
    ARCHIVO_JSON,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        datos_json,
        f,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":")
    )

# ------------------------------------------------
# 9. VERIFICAR JSON GENERADO
# ------------------------------------------------
if not os.path.isfile(ARCHIVO_JSON):
    raise RuntimeError(
        "No se generó el archivo JSON."
    )

with open(
    ARCHIVO_JSON,
    "r",
    encoding="utf-8"
) as f:

    verificacion = json.load(f)

assert len(verificacion["time"]) == len(fechas)

assert len(verificacion["points"]) == len(puntos_finales)

for punto in verificacion["points"]:

    assert len(punto["precipitation"]) == len(fechas)

# ------------------------------------------------
# 10. RESUMEN
# ------------------------------------------------
print("\n" + "=" * 65)
print("GFS TUMBES - JSON GENERADO CORRECTAMENTE")
print("=" * 65)

print("CSV de entrada:")
print(ARCHIVO_CSV)

print("\nJSON de salida:")
print(ARCHIVO_JSON)

print("\nHoras de pronóstico:", len(fechas))
print("Puntos GFS originales:", len(lat0))
print("Puntos GFS únicos:", len(puntos_finales))

print("\nPrimer tiempo:", fechas.iloc[0])
print("Último tiempo:", fechas.iloc[-1])

print(
    "Tamaño JSON: {:.3f} MB".format(
        os.path.getsize(ARCHIVO_JSON) / 1024**2
    )
)

print("\nInterpolación: NO")
print("Extrapolación: NO")
print("Coordenadas originales: SI")
print("\nPROCESO TERMINADO CORRECTAMENTE.")
print("=" * 65)

