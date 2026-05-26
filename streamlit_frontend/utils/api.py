import requests
import os
import tempfile
import streamlit as st

# FIX 1: Correct Base URL and API Prefix found via discovery
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

# FIX 6: Backend Health Check
def check_backend():
    """Checks if the FastAPI backend is operational."""
    for path in ["/", "/health", "/docs"]:
        try:
            response = requests.get(f"{BASE_URL}{path}", timeout=3)
            if response.status_code == 200:
                return True
        except:
            continue
    return False

# FIX 8: Safe API Call with user-friendly errors
def safe_api_call(url, method='get', data=None, files=None, params=None):
    try:
        if method == 'get':
            r = requests.get(url, params=params, timeout=10)
        elif method == 'post':
            r = requests.post(url, json=data, files=files, timeout=60)
        
        if r.status_code == 404:
            # Silently return None for 404 to allow fallback logic in UI
            return None
            
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        # User friendly warning instead of raw error
        return "CONNECTION_ERROR"
    except Exception as e:
        # General catch for other issues
        return None

# FIX 3: Threat Metrics with fallback
def get_threat_metrics():
    # Try both v1 and dashboard routes
    urls = [f"{BASE_URL}{API_PREFIX}/analytics/metrics", f"{BASE_URL}/api/dashboard/metrics"]
    for url in urls:
        res = safe_api_call(url)
        if res and res != "CONNECTION_ERROR":
            return res
    
    # Return default static content if API fails (as requested in Fix 3)
    return {
        'total_scans': st.session_state.get('total_processed', 0),
        'forensic_integrity': 94.2,
        'fraud_intercepted': st.session_state.get('total_invalid', 0),
        'neural_accuracy': 99.8
    }

def get_analytics_trends():
    return safe_api_call(f"{BASE_URL}{API_PREFIX}/analytics/trends")

# FIX 4: Audit Logs with multi-URL fallback
def get_audit_logs(limit=20, skip=0):
    possible_urls = [
        f"{BASE_URL}{API_PREFIX}/audit/",
        f"{BASE_URL}/api/audit-logs",
        f"{BASE_URL}/api/audit",
        f"{BASE_URL}/api/audits"
    ]
    for url in possible_urls:
        res = safe_api_call(url, params={"limit": limit, "skip": skip})
        if res and res != "CONNECTION_ERROR":
            return res
            
    return {"items": [], "total": 0}

def login_to_backend(username, password):
    # Hardcoded as requested, but prepared for API
    if username == "vvsriram05@gmail.com" and password == "verentis@2024":
        return {"success": True, "name": "Sriram VV", "role": "Forensic Officer", "email": "vvsriram05@gmail.com"}
    return None

def upload_vehicle_document(uploaded_file):
    ext = os.path.splitext(uploaded_file.name)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(uploaded_file.read())
        tmp_path = tmp.name
    
    try:
        with open(tmp_path, "rb") as f:
            files = {"file": (uploaded_file.name, f)}
            return safe_api_call(f"{BASE_URL}{API_PREFIX}/vehicle/upload", method='post', files=files)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def analyze_ticket_folder(input_data):
    """
    Handles both uploaded files (list) and local folder paths (string).
    """
    files_to_send = []
    opened_files = []
    
    try:
        # Case 1: Input is a local folder path string
        if isinstance(input_data, str) and os.path.isdir(input_data):
            for filename in os.listdir(input_data):
                file_path = os.path.join(input_data, filename)
                if os.path.isfile(file_path):
                    f = open(file_path, "rb")
                    opened_files.append(f)
                    files_to_send.append(("files", (filename, f)))
        
        # Case 2: Input is a list of uploaded files from Streamlit
        elif isinstance(input_data, list):
            for uf in input_data:
                ext = os.path.splitext(uf.name)[1]
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                tmp.write(uf.read())
                tmp.close()
                f = open(tmp.name, "rb")
                opened_files.append((f, tmp.name)) # Keep track for cleanup
                files_to_send.append(("files", (uf.name, f)))
        
        if not files_to_send:
            return None
            
        return safe_api_call(f"{BASE_URL}{API_PREFIX}/tickets/analyze-folder", method='post', files=files_to_send)
        
    finally:
        # Cleanup
        for item in opened_files:
            if isinstance(item, tuple):
                f, path = item
                f.close()
                if os.path.exists(path): os.remove(path)
            else:
                item.close()

# FIX 7: Route Discovery Debug (prints to terminal)
def discover_api_routes():
    try:
        response = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        if response.status_code == 200:
            routes = list(response.json().get('paths', {}).keys())
            print("\n🔍 DISCOVERED API ROUTES:")
            for r in routes: print(f"  {r}")
            return routes
    except:
        pass
    return []
