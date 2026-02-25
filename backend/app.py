import os
import time
import math
import random
import requests
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape
from shapely.errors import TopologicalError

load_dotenv()

app = Flask(__name__)
CORS(app)

CONSUMER_KEY = os.getenv("SGIS_CONSUMER_KEY", "")
CONSUMER_SECRET = os.getenv("SGIS_CONSUMER_SECRET", "")
SGIS_BASE = "https://sgisapi.kostat.go.kr/OpenAPI3"

_token_cache = {"token": None, "expires_at": 0}
_transformer = Transformer.from_crs("EPSG:5179", "EPSG:4326", always_xy=True)

SIDO_CODES = ['11','21','22','23','24','25','26','29','31','32','33','34','35','36','37','38','39']


# ─── 인증 ────────────────────────────────────────────────────────────────────

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


# ─── 좌표 변환 ───────────────────────────────────────────────────────────────

def convert_coords(coords):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        lon, lat = _transformer.transform(coords[0], coords[1])
        return [round(lon, 7), round(lat, 7)]
    return [convert_coords(c) for c in coords]


def convert_geojson_crs(geojson):
    for feature in geojson.get("features", []):
        geom = feature.get("geometry")
        if geom and geom.get("coordinates"):
            geom["coordinates"] = convert_coords(geom["coordinates"])
    return geojson


# ─── 공간통계 유틸리티 ────────────────────────────────────────────────────────

def norm_cdf(x):
    """표준정규분포 누적분포함수 (Abramowitz & Stegun 근사)"""
    t = 1.0 / (1.0 + 0.2316419 * abs(x))
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937
                + t * (-1.821255978 + t * 1.330274429))))
    p = 1.0 - (1.0 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * x * x) * poly
    return p if x >= 0 else 1.0 - p


def build_knn_weights(coords, k):
    """k-최근접 이웃 이진 가중치 행렬 (EPSG:5179 미터 좌표 사용)"""
    n = len(coords)
    W = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        dists = []
        xi, yi = coords[i]
        for j in range(n):
            if i == j:
                continue
            dx = xi - coords[j][0]
            dy = yi - coords[j][1]
            dists.append((dx * dx + dy * dy, j))
        dists.sort()
        for _, j in dists[:k]:
            W[i][j] = 1.0
    return W


def build_distance_weights(coords, dist_m):
    """거리 기준 이진 가중치 행렬 (dist_m: 미터)"""
    n = len(coords)
    W = np.zeros((n, n), dtype=np.float32)
    dist_sq = dist_m ** 2
    for i in range(n):
        xi, yi = coords[i]
        for j in range(n):
            if i == j:
                continue
            dx = xi - coords[j][0]
            dy = yi - coords[j][1]
            if dx * dx + dy * dy <= dist_sq:
                W[i][j] = 1.0
    return W


def build_contiguity_weights(features, codes, weight_type):
    """
    Queen / Rook / Bishop 인접 가중치 행렬
      Queen  : 변 또는 꼭짓점 공유 (= Rook ∪ Bishop)
      Rook   : 변(선분)만 공유
      Bishop : 꼭짓점(점)만 공유
    EPSG:5179 좌표 그대로 사용 (shapely는 CRS 무관하게 위상 연산)
    """
    code_to_idx = {c: i for i, c in enumerate(codes)}
    n = len(codes)

    # shapely 도형 구축 (유효하지 않으면 buffer(0)로 보정)
    geoms = {}
    for feat in features:
        code = feat.get("properties", {}).get("adm_cd", "")
        if code not in code_to_idx:
            continue
        try:
            g = shape(feat["geometry"])
            if not g.is_valid:
                g = g.buffer(0)
            geoms[code] = g
        except Exception:
            pass

    W = np.zeros((n, n), dtype=np.float32)

    code_list = [c for c in codes if c in geoms]
    for a in range(len(code_list)):
        ca = code_list[a]
        ga = geoms[ca]
        ia = code_to_idx[ca]
        for b in range(a + 1, len(code_list)):
            cb = code_list[b]
            gb = geoms[cb]
            ib = code_to_idx[cb]

            # 바운딩박스 빠른 필터
            if not ga.bounds[2] >= gb.bounds[0] - 1 or not gb.bounds[2] >= ga.bounds[0] - 1:
                continue

            try:
                # 경계 교차만 확인 (touches = 내부는 겹치지 않고 경계만 접촉)
                if not ga.touches(gb):
                    continue
                if weight_type == "queen":
                    W[ia][ib] = W[ib][ia] = 1.0
                    continue
                # Rook / Bishop 구분: 경계 교선 유형 확인
                inter = ga.boundary.intersection(gb.boundary)
                itype = inter.geom_type
                has_line = itype in ("LineString", "MultiLineString") or (
                    itype == "GeometryCollection"
                    and any(g.geom_type in ("LineString", "MultiLineString")
                            for g in getattr(inter, "geoms", []))
                )
                if weight_type == "rook" and has_line:
                    W[ia][ib] = W[ib][ia] = 1.0
                elif weight_type == "bishop" and not has_line:
                    W[ia][ib] = W[ib][ia] = 1.0
            except TopologicalError:
                pass

    return W


def classify_gistar(z, p):
    if z >= 2.58 and p <= 0.01:
        return "hot_99"
    if z >= 1.96 and p <= 0.05:
        return "hot_95"
    if z >= 1.65 and p <= 0.10:
        return "hot_90"
    if z <= -2.58 and p <= 0.01:
        return "cold_99"
    if z <= -1.96 and p <= 0.05:
        return "cold_95"
    if z <= -1.65 and p <= 0.10:
        return "cold_90"
    return "ns"


def compute_gistar(values, W):
    """Getis-Ord Gi* 통계량 계산"""
    n = len(values)
    x = np.array(values, dtype=np.float64)
    x_bar = np.mean(x)
    s = np.std(x)
    results = []
    for i in range(n):
        w_i = W[i].astype(np.float64)
        sum_w = w_i.sum()
        sum_w2 = (w_i ** 2).sum()
        numerator = np.dot(w_i, x) - x_bar * sum_w
        denom_inner = (n * sum_w2 - sum_w ** 2) / (n - 1)
        denominator = s * math.sqrt(denom_inner) if denom_inner > 0 else 1e-10
        z = float(numerator / denominator)
        p = 2.0 * (1.0 - norm_cdf(abs(z)))
        results.append({"z": round(z, 4), "p": round(p, 4), "cls": classify_gistar(z, p)})
    return results


def compute_local_moran(values, W, n_perms=199):
    """Local Moran's I 통계량 계산 (조건부 순열 의사 p-값)"""
    n = len(values)
    x = np.array(values, dtype=np.float64)
    x_bar = np.mean(x)
    std = np.std(x)
    z = (x - x_bar) / std if std > 0 else x - x_bar

    # 행 표준화 가중치
    row_sums = W.sum(axis=1, keepdims=True)
    W_rs = np.where(row_sums > 0, W / row_sums, 0).astype(np.float64)

    results = []
    for i in range(n):
        lag_i = float(np.dot(W_rs[i], z))
        Ii = float(z[i] * lag_i)

        # 사분면 분류
        if z[i] > 0 and lag_i > 0:
            quad = "HH"
        elif z[i] < 0 and lag_i < 0:
            quad = "LL"
        elif z[i] > 0 and lag_i < 0:
            quad = "HL"
        else:
            quad = "LH"

        # 조건부 순열 의사 p-값: z[i]를 고정하고 나머지 값을 순열
        others = np.delete(z, i)
        neighbor_idx = np.where(W_rs[i] > 0)[0]
        if len(neighbor_idx) == 0:
            p_val = 1.0
        else:
            w_neighbors = W_rs[i][neighbor_idx]
            count = 0
            for _ in range(n_perms):
                perm = np.random.choice(others, size=len(neighbor_idx), replace=False)
                Ii_perm = float(z[i] * np.dot(w_neighbors, perm))
                if abs(Ii_perm) >= abs(Ii):
                    count += 1
            p_val = (count + 1) / (n_perms + 1)

        cls = quad if p_val <= 0.05 else "ns"
        results.append({
            "I": round(Ii, 4),
            "z": round(float(z[i]), 4),
            "lag": round(lag_i, 4),
            "quad": quad,
            "p": round(p_val, 4),
            "cls": cls,
        })
    return results


# ─── API 엔드포인트 ───────────────────────────────────────────────────────────

@app.route("/api/token")
def api_token():
    try:
        return jsonify({"accessToken": get_access_token()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/population")
def api_population():
    year = request.args.get("year", "2020")
    adm_cd = request.args.get("adm_cd", "")
    low_search = request.args.get("low_search", "1")
    try:
        token = get_access_token()
        params = {"accessToken": token, "year": year, "low_search": low_search}
        if adm_cd:
            params["adm_cd"] = adm_cd
        resp = requests.get(f"{SGIS_BASE}/stats/population.json", params=params, timeout=15)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/geojson/boundary")
def api_geojson_boundary():
    year = request.args.get("year", "2020")
    adm_cd = request.args.get("adm_cd", "")
    low_search = request.args.get("low_search", "1")
    try:
        token = get_access_token()
        params = {"accessToken": token, "year": year, "low_search": low_search}
        if adm_cd:
            params["adm_cd"] = adm_cd
        resp = requests.get(f"{SGIS_BASE}/boundary/hadmarea.geojson", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if data.get("errCd") is not None and data.get("errCd") != 0:
            return jsonify({"error": data.get("errMsg", "GeoJSON 오류")}), 500
        return jsonify(convert_geojson_crs(data))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/years")
def api_years():
    return jsonify({"years": ["2015","2016","2017","2018","2019","2020","2021","2022","2023"]})


@app.route("/api/hotspot")
def api_hotspot():
    """
    전국 시군구 핫스팟 분석
    Query params:
      year        - 기준연도
      variable    - population | density
      stat_type   - gistar | moran
      weight_type - knn | distance | queen | rook | bishop
      k           - k-최근접 이웃 수 (weight_type=knn 시 사용, default: 8)
      dist_km     - 거리 임계값 km (weight_type=distance 시 사용, default: 50)
    """
    year = request.args.get("year", "2023")
    variable = request.args.get("variable", "population")
    stat_type = request.args.get("stat_type", "gistar")
    weight_type = request.args.get("weight_type", "knn")
    k = int(request.args.get("k", "8"))
    dist_km = float(request.args.get("dist_km", "50"))

    try:
        token = get_access_token()

        def fetch_sido(sido_code):
            pop_r = requests.get(f"{SGIS_BASE}/stats/population.json",
                params={"accessToken": token, "year": year,
                        "adm_cd": sido_code, "low_search": "1"},
                timeout=20)
            bnd_r = requests.get(f"{SGIS_BASE}/boundary/hadmarea.geojson",
                params={"accessToken": token, "year": year,
                        "adm_cd": sido_code, "low_search": "1"},
                timeout=20)
            return pop_r.json(), bnd_r.json()

        pop_map = {}       # adm_cd → {pop, density, name}
        centroid_map = {}  # adm_cd → {x, y, name}
        all_features = []  # 경계 피처 목록 (contiguity 가중치용)

        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {ex.submit(fetch_sido, c): c for c in SIDO_CODES}
            for fut in as_completed(futures):
                pop_data, bnd_data = fut.result()
                for item in pop_data.get("result", []):
                    code = item.get("adm_cd", "")
                    if len(code) == 5:
                        pop_map[code] = {
                            "pop": int(item.get("tot_ppltn", 0) or 0),
                            "density": float(item.get("ppltn_dnsty", 0) or 0),
                            "name": item.get("adm_nm", ""),
                        }
                for feat in bnd_data.get("features", []):
                    props = feat.get("properties", {})
                    code = props.get("adm_cd", "")
                    if len(code) == 5:
                        centroid_map[code] = {
                            "x": float(props.get("x", 0)),
                            "y": float(props.get("y", 0)),
                            "name": props.get("adm_nm", ""),
                        }
                        all_features.append(feat)

        codes = sorted([c for c in pop_map if c in centroid_map])
        n = len(codes)
        if n < 2:
            return jsonify({"error": f"분석 가능한 지역 수 부족 ({n}개)"}), 400

        values = np.array(
            [pop_map[c]["density"] if variable == "density" else pop_map[c]["pop"]
             for c in codes],
            dtype=np.float64,
        )
        coords = [(centroid_map[c]["x"], centroid_map[c]["y"]) for c in codes]

        # 가중치 행렬 구축
        if weight_type == "knn":
            W = build_knn_weights(coords, min(k, n - 1))
        elif weight_type == "distance":
            W = build_distance_weights(coords, dist_km * 1000)
        elif weight_type in ("queen", "rook", "bishop"):
            W = build_contiguity_weights(all_features, codes, weight_type)
        else:
            W = build_knn_weights(coords, min(k, n - 1))

        # 고립된 지역 확인 (neighbor 없으면 경고)
        isolated = int(np.sum(W.sum(axis=1) == 0))

        if stat_type == "moran":
            stats_result = compute_local_moran(values, W)
        else:
            stats_result = compute_gistar(values, W)

        output = []
        for i, code in enumerate(codes):
            item = {
                "adm_cd": code,
                "adm_nm": centroid_map[code]["name"],
                "value": float(values[i]),
            }
            item.update(stats_result[i])
            output.append(item)

        return jsonify({
            "result": output,
            "stat_type": stat_type,
            "variable": variable,
            "weight_type": weight_type,
            "n": n,
            "k": k if weight_type == "knn" else None,
            "dist_km": dist_km if weight_type == "distance" else None,
            "isolated": isolated,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
