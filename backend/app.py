import os
import time
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pyproj import Transformer

load_dotenv()

app = Flask(__name__)
CORS(app)

CONSUMER_KEY = os.getenv("SGIS_CONSUMER_KEY", "")
CONSUMER_SECRET = os.getenv("SGIS_CONSUMER_SECRET", "")
SGIS_BASE = "https://sgisapi.kostat.go.kr/OpenAPI3"

_token_cache = {"token": None, "expires_at": 0}

# EPSG:5179 (Korea 2000 / Unified CS) → EPSG:4326 (WGS84)
_transformer = Transformer.from_crs("EPSG:5179", "EPSG:4326", always_xy=True)


def convert_coords(coords):
    """재귀적으로 좌표 배열을 EPSG:5179 → WGS84(lon, lat)로 변환"""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        lon, lat = _transformer.transform(coords[0], coords[1])
        return [round(lon, 7), round(lat, 7)]
    return [convert_coords(c) for c in coords]


def convert_geojson_crs(geojson):
    """FeatureCollection의 모든 geometry 좌표를 WGS84로 변환"""
    for feature in geojson.get("features", []):
        geom = feature.get("geometry")
        if geom and geom.get("coordinates"):
            geom["coordinates"] = convert_coords(geom["coordinates"])
    return geojson


def get_access_token():
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    params = {"consumer_key": CONSUMER_KEY, "consumer_secret": CONSUMER_SECRET}
    resp = requests.get(f"{SGIS_BASE}/auth/authentication.json", params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("errCd") != 0:
        raise ValueError(f"SGIS 인증 오류: {data.get('errMsg')}")

    token = data["result"]["accessToken"]
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + 3600
    return token


@app.route("/api/token")
def api_token():
    try:
        token = get_access_token()
        return jsonify({"accessToken": token})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/population")
def api_population():
    """
    인구 통계 조회 (총조사 주요지표 API)
    Query params: year, adm_cd, low_search
    """
    year = request.args.get("year", "2020")
    adm_cd = request.args.get("adm_cd", "")
    low_search = request.args.get("low_search", "1")

    try:
        token = get_access_token()
        params = {
            "accessToken": token,
            "year": year,
            "low_search": low_search,
        }
        if adm_cd:
            params["adm_cd"] = adm_cd

        resp = requests.get(
            f"{SGIS_BASE}/stats/population.json",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/geojson/boundary")
def api_geojson_boundary():
    """
    SGIS 행정구역경계 GeoJSON (WGS84로 좌표 변환 후 반환)
    Query params: year, adm_cd, low_search
    """
    year = request.args.get("year", "2020")
    adm_cd = request.args.get("adm_cd", "")
    low_search = request.args.get("low_search", "1")

    try:
        token = get_access_token()
        params = {
            "accessToken": token,
            "year": year,
            "low_search": low_search,
        }
        if adm_cd:
            params["adm_cd"] = adm_cd

        resp = requests.get(
            f"{SGIS_BASE}/boundary/hadmarea.geojson",
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("errCd") is not None and data.get("errCd") != 0:
            return jsonify({"error": data.get("errMsg", "GeoJSON 오류")}), 500

        # EPSG:5179 → WGS84 좌표 변환
        converted = convert_geojson_crs(data)
        return jsonify(converted)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/years")
def api_years():
    return jsonify({"years": ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"]})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
