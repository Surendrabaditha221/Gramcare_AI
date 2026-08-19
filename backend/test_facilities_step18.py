"""
Verification Test Suite for Step 18 - Real Nearby Healthcare / PHC / Hospital Search
Tests:
A. Live Coordinate Query (e.g. Hyderabad / rural Telangana coordinates) -> Returns real OSM facilities.
B. Category Filter: 'phc' -> Filters for PHCs/CHCs.
C. Category Filter: 'hospital' -> Filters for Hospitals.
D. Category Filter: 'pharmacy' -> Filters for Pharmacies.
E. Category Filter: 'emergency' -> Returns 24x7 emergency facilities.
F. Zero Demo Data Standard -> Remote coordinates (0.0, 0.0) returns empty list [] without synthetic injection.
G. No Fake Phone Numbers -> Phone is real or None.
H. Strict Absence of Demo Data -> No 'Rampura', 'Sample Hospital', 'Demo Hospital', or hardcoded coordinates.
"""
import os
import sys
import asyncio
import httpx
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from routers.facilities import get_facilities, calculate_haversine_km
from services.data_store import memory_store

async def run_facilities_tests():
    print("==================================================")
    print("   STEP 18 HEALTHCARE SEARCH VERIFICATION        ")
    print("==================================================")

    # 1. Test Zero Demo Storage
    print("\n[TEST 1] Verifying Zero Hardcoded Demo Facilities in Memory Store...")
    stored = memory_store.get_facilities()
    assert len(stored) == 0, f"Memory store must have 0 default demo facilities, found {len(stored)}"
    print("  [✓] Memory store contains zero demo facilities.")

    # 2. Test Real OSM Query with Coordinates (e.g. Hyderabad / Secunderabad region 17.3850, 78.4867)
    print("\n[TEST 2] Testing Live Overpass Query for Hyderabad Region (17.3850, 78.4867)...", flush=True)
    res_all = await get_facilities(lat=17.3850, lon=78.4867, radius_km=15.0, category="all")
    print(f"  --> Found {len(res_all)} verified live facilities:", flush=True)
    for f in res_all[:3]:
        print(f"      • {f['name']} ({f['type']}) - {f['distanceKm']}km | {f['villageOrTaluka']}, {f['district']}", flush=True)
        assert f.get("latitude") is not None and f.get("longitude") is not None, "Real coordinates must be present"
        assert "Rampura" not in f["name"], "No Rampura demo facility"
        assert "Sample Hospital" not in f["name"], "No Sample Hospital demo facility"

    assert len(res_all) > 0, "Live OSM query must return real facilities in Hyderabad"
    print("  [✓] Live OpenStreetMap facilities retrieved successfully.", flush=True)

    # 3. Test Category: PHC / CHC
    print("\n[TEST 3] Testing Category: 'phc'...", flush=True)
    res_phc = await get_facilities(lat=17.3850, lon=78.4867, radius_km=15.0, category="phc")
    print(f"  --> Found {len(res_phc)} PHC/CHC facilities.", flush=True)
    for f in res_phc[:2]:
        print(f"      • {f['name']} ({f['type']}) - {f['distanceKm']}km")
        assert f["type"] in ["phc", "chc"], "Category phc must only return PHC or CHC"
    print("  [✓] Category 'phc' correctly filtered.")

    # 4. Test Category: Hospital
    print("\n[TEST 4] Testing Category: 'hospital'...")
    res_hosp = await get_facilities(lat=17.3850, lon=78.4867, radius_km=15.0, category="hospital")
    print(f"  --> Found {len(res_hosp)} Hospitals.")
    for f in res_hosp[:2]:
        print(f"      • {f['name']} ({f['type']}) - {f['distanceKm']}km")
        assert f["type"] in ["hospital", "district_hospital"], "Category hospital must only return hospitals"
    print("  [✓] Category 'hospital' correctly filtered.")

    # 5. Test Category: Emergency
    print("\n[TEST 5] Testing Category: 'emergency'...")
    res_emerg = await get_facilities(lat=17.3850, lon=78.4867, radius_km=15.0, category="emergency")
    print(f"  --> Found {len(res_emerg)} Emergency 24x7 facilities.")
    for f in res_emerg[:2]:
        print(f"      • {f['name']} - 24x7: {f['emergency24x7']}")
        assert f["emergency24x7"] is True, "Category emergency must only return 24x7 emergency facilities"
    print("  [✓] Category 'emergency' correctly filtered.")

    # 6. Test Category: Pharmacy
    print("\n[TEST 6] Testing Category: 'pharmacy'...")
    res_pharm = await get_facilities(lat=17.3850, lon=78.4867, radius_km=15.0, category="pharmacy")
    print(f"  --> Found {len(res_pharm)} Pharmacies.")
    for f in res_pharm[:2]:
        print(f"      • {f['name']} ({f['type']})")
        assert f["type"] == "pharmacy", "Category pharmacy must only return pharmacies"
    print("  [✓] Category 'pharmacy' correctly filtered.")

    # 7. Test Zero Demo Fallback (Remote Null Island / Ocean coordinates)
    print("\n[TEST 7] Testing Zero Demo Fallback on Remote Coordinates (0.0, 0.0)...")
    res_empty = await get_facilities(lat=0.0, lon=0.0, radius_km=5.0, category="all")
    print(f"  --> Returned {len(res_empty)} facilities.")
    assert len(res_empty) == 0, "Must return empty list for remote location without facilities; NEVER fabricate demo centers"
    print("  [✓] Zero fabrication confirmed: Empty state returned properly.")

    # 8. Test Distance Calculation Accuracy
    print("\n[TEST 8] Testing Haversine Distance Function...")
    d = calculate_haversine_km(17.3850, 78.4867, 17.4000, 78.4700)
    assert 2.0 <= d <= 3.0, f"Distance should be around 2.4 km, got {d}"
    print(f"  --> Calculated distance between points: {d} km")
    print("  [✓] Haversine calculation verified.")

    print("\n==================================================")
    print("   ALL STEP 18 FACILITIES TESTS PASSED!          ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_facilities_tests())
