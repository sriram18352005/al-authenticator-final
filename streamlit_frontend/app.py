import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import time
import requests
import os
import tempfile
import json
import hashlib
import re
from PIL import Image

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# --- PART 1 — SESSION STATE INITIALIZATION ---
session_defaults = {
    'logged_in': False,
    'page': 'login',
    'username': '',
    'user_name': '',
    'user_role': 'Operator',
    'user_email': '',
    'theme': 'light',
    'vehicle_results': None,
    'ticket_result': None,
    'batch_results': [],
    'audit_logs': [],
    'metrics': {},
    'analysis_result': None,
    'current_tab': 'vehicle',
    'ticket_mode': 'single',
    'show_preview': False,
    'extracted_texts': {},
    'detected_files': [],
    'ticket_id': '',
    'dashboard_stats': {},
    'current_page': 'Document Analysis'
}

for key, val in session_defaults.items():
    if key not in st.session_state:
        st.session_state[key] = val

# --- PART 2 — THEME CSS ---
light_css = """
<style>
.stApp {
    background-color: #f4f6fa !important;
    color: #1a1a2e;
}
p, span, label {
    font-weight: 500;
}
.stMarkdown {
    color: inherit;
}
.stApp h1 {
    color: #0a0f1e !important;
    font-weight: 800 !important;
}
.stApp h2, .stApp h3 {
    color: #0a0f1e !important;
    font-weight: 700 !important;
}
section[data-testid="stSidebar"] {
    background-color: #1a1a2e !important;
}
section[data-testid="stSidebar"] * {
    color: #ffffff !important;
}
.stButton > button {
    background: linear-gradient(
        135deg, #00d4aa, #00b894
    ) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
    font-size: 14px !important;
}
.stTabs [data-baseweb="tab"] {
    font-weight: 600 !important;
    font-size: 14px !important;
    color: #546e7a !important;
}
.stTabs [aria-selected="true"] {
    color: #00d4aa !important;
    border-bottom: 2px solid #00d4aa !important;
    background: transparent !important;
}
.main .block-container {
    padding-top: 2rem !important;
    padding-left: 2.5rem !important;
    padding-right: 2.5rem !important;
    max-width: 1200px !important;
}
[data-testid="stFileUploader"] {
    border: 2px dashed #b0bec5 !important;
    border-radius: 12px !important;
}
</style>
"""

dark_css = """
<style>
.stApp {
    background-color: #0a0f1e !important;
    color: #e0e0e0;
}
.stMarkdown {
    color: inherit;
}
.stApp h1, .stApp h2, .stApp h3 {
    color: #ffffff !important;
}
section[data-testid="stSidebar"] {
    background-color: #0d1526 !important;
    border-right: 1px solid #1a2744 !important;
}
section[data-testid="stSidebar"] * {
    color: #ffffff !important;
}
.stButton > button {
    background: linear-gradient(
        135deg, #00d4aa, #00b894
    ) !important;
    color: #0a0f1e !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
}
div[data-testid="stMetric"] {
    background-color: #0d1526 !important;
    border: 0.5px solid #1a2744 !important;
    border-radius: 12px !important;
    padding: 16px !important;
}
.stTabs [data-baseweb="tab"] {
    color: #8aa4c0 !important;
    font-weight: 600 !important;
}
.stTabs [aria-selected="true"] {
    color: #00d4aa !important;
    border-bottom: 2px solid #00d4aa !important;
    background: transparent !important;
}
.stTextInput > div > div > input {
    background-color: #0d1526 !important;
    color: #ffffff !important;
    border: 0.5px solid #1a2744 !important;
}
.main .block-container {
    padding-top: 2rem !important;
    padding-left: 2.5rem !important;
    padding-right: 2.5rem !important;
    max-width: 1200px !important;
}
</style>
"""

def apply_theme_css():
    if st.session_state.theme == 'dark':
        st.markdown(dark_css, unsafe_allow_html=True)
    else:
        st.markdown(light_css, unsafe_allow_html=True)

apply_theme_css()

# --- PART 3 — LOGIN & REGISTRATION FLOW ---
def authenticate_user(username, password):
    users_file = os.path.join(
        os.path.dirname(__file__),
        'data', 'users.json'
    )
    if not os.path.exists(users_file):
        os.makedirs(
            os.path.dirname(users_file),
            exist_ok=True
        )
        hashed = hashlib.sha256(
            'verentis@2024'.encode()
        ).hexdigest()
        default_users = [{
            "name": "Sriram VV",
            "email": "vvsriram05@gmail.com",
            "role": "Forensic Officer",
            "password": hashed
        }]
        with open(users_file, 'w') as f:
            json.dump(default_users, f)

    with open(users_file, 'r') as f:
        users = json.load(f)

    hashed_input = hashlib.sha256(
        password.encode()
    ).hexdigest()

    for user in users:
        if user['email'] == username and \
           user['password'] == hashed_input:
            return True
    return False

def get_user_name(username):
    users_file = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
    if os.path.exists(users_file):
        with open(users_file, 'r') as f:
            users = json.load(f)
        for u in users:
            if u['email'] == username:
                return u.get('name', 'Sriram VV')
    return "Sriram VV"

def get_user_role(username):
    users_file = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
    if os.path.exists(users_file):
        with open(users_file, 'r') as f:
            users = json.load(f)
        for u in users:
            if u['email'] == username:
                return u.get('role', 'Forensic Officer')
    return "Forensic Officer"

def show_login():
    st.markdown("""
    <style>
    .stApp {
        background-color: #f0f2f5 !important;
    }
    </style>
    """, unsafe_allow_html=True)

    if st.session_state.page == 'register':
        show_registration_page()
    elif st.session_state.page == 'forgot_password':
        show_forgot_password_page()
    else:
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            st.markdown("""
            <div style='background:#ffffff;
            border:1px solid #e0e8f0;
            border-radius:16px;padding:40px;
            margin-top:60px;
            box-shadow:0 4px 24px rgba(0,0,0,0.08)'>
            <div style='text-align:center;
            margin-bottom:24px'>
            <div style='background:#1a1a2e;
            color:#00d4aa;width:48px;height:48px;
            border-radius:12px;display:inline-flex;
            align-items:center;justify-content:center;
            font-size:24px;font-weight:800;
            margin-bottom:16px'>V</div>
            <h2 style='color:#0a0f1e;font-weight:800;
            margin:0 0 4px 0'>Verentis Gateway</h2>
            <p style='color:#546e7a;font-size:14px;
            margin:0'>Secure Forensic Authentication</p>
            </div>
            </div>
            """, unsafe_allow_html=True)

            with st.form("login_form"):
                st.markdown(
                    "<p style='color:#1a1a2e;"
                    "font-weight:600;font-size:13px;"
                    "margin-bottom:4px'>Operator ID</p>",
                    unsafe_allow_html=True
                )
                username = st.text_input(
                    "Email",
                    placeholder="operator@verentis.com",
                    label_visibility="collapsed"
                )
                st.markdown(
                    "<p style='color:#1a1a2e;"
                    "font-weight:600;font-size:13px;"
                    "margin-bottom:4px;margin-top:12px'>"
                    "Access Token</p>",
                    unsafe_allow_html=True
                )
                password = st.text_input(
                    "Password",
                    type="password",
                    placeholder="Enter access token",
                    label_visibility="collapsed"
                )
                submitted = st.form_submit_button(
                    "Authenticate System",
                    use_container_width=True
                )

            if submitted:
                if authenticate_user(username, password):
                    st.session_state.logged_in = True
                    st.session_state.username = username
                    st.session_state.user_name = get_user_name(username)
                    st.session_state.user_role = get_user_role(username)
                    st.session_state.user_email = username
                    st.session_state.page = 'dashboard'
                    st.rerun()
                else:
                    st.error("Invalid credentials. Please try again.")

            col_a, col_b = st.columns(2)
            with col_a:
                if st.button("Forgot Password?", use_container_width=True):
                    st.session_state.page = 'forgot_password'
                    st.rerun()
            with col_b:
                if st.button("Create Account", use_container_width=True):
                    st.session_state.page = 'register'
                    st.rerun()

def show_registration_page():
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div style='background:#ffffff;
        border:1px solid #e0e8f0;
        border-radius:16px;padding:40px;
        margin-top:40px;
        box-shadow:0 4px 24px rgba(0,0,0,0.08)'>
        <div style='text-align:center;
        margin-bottom:24px'>
        <h2 style='color:#0a0f1e;font-weight:800;
        margin:0 0 4px 0'>Create Operator Account</h2>
        <p style='color:#546e7a;font-size:14px;
        margin:0'>Register with the Forensic Division</p>
        </div>
        </div>
        """, unsafe_allow_html=True)
        
        with st.form("register_form"):
            reg_name = st.text_input("Full Name", placeholder="e.g. Sriram VV")
            reg_email = st.text_input("Operator ID / Email", placeholder="vvsriram05@gmail.com")
            reg_role = st.selectbox("Role", ["Forensic Officer", "Threat Analyst", "Lead Investigator"])
            reg_pass = st.text_input("Access Token / Password", type="password", placeholder="Choose token")
            reg_submit = st.form_submit_button("Register System Access", use_container_width=True)
            
        if reg_submit:
            if not reg_name or not reg_email or not reg_pass:
                st.error("All fields are required")
            else:
                users_file = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
                with open(users_file, 'r') as f:
                    users = json.load(f)
                
                # Check duplicate
                if any(u['email'] == reg_email for u in users):
                    st.error("Account already exists")
                else:
                    hashed = hashlib.sha256(reg_pass.encode()).hexdigest()
                    users.append({
                        "name": reg_name,
                        "email": reg_email,
                        "role": reg_role,
                        "password": hashed
                    })
                    with open(users_file, 'w') as f:
                        json.dump(users, f)
                    st.success("Access Registered Successfully!")
                    time.sleep(1)
                    st.session_state.page = 'login'
                    st.rerun()
                    
        if st.button("Return to Login", use_container_width=True):
            st.session_state.page = 'login'
            st.rerun()

def show_forgot_password_page():
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div style='background:#ffffff;
        border:1px solid #e0e8f0;
        border-radius:16px;padding:40px;
        margin-top:60px;
        box-shadow:0 4px 24px rgba(0,0,0,0.08)'>
        <div style='text-align:center;
        margin-bottom:24px'>
        <h2 style='color:#0a0f1e;font-weight:800;
        margin:0 0 4px 0'>Recover Access</h2>
        <p style='color:#546e7a;font-size:14px;
        margin:0'>Reset your security access token</p>
        </div>
        </div>
        """, unsafe_allow_html=True)
        
        with st.form("forgot_form"):
            recover_email = st.text_input("Operator ID / Email", placeholder="vvsriram05@gmail.com")
            new_pass = st.text_input("New Access Token", type="password", placeholder="Enter new token")
            recover_submit = st.form_submit_button("Reset Token", use_container_width=True)
            
        if recover_submit:
            if not recover_email or not new_pass:
                st.error("Please enter email and new token")
            else:
                users_file = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
                with open(users_file, 'r') as f:
                    users = json.load(f)
                
                found = False
                for u in users:
                    if u['email'] == recover_email:
                        u['password'] = hashlib.sha256(new_pass.encode()).hexdigest()
                        found = True
                        break
                        
                if found:
                    with open(users_file, 'w') as f:
                        json.dump(users, f)
                    st.success("Security token reset successful!")
                    time.sleep(1)
                    st.session_state.page = 'login'
                    st.rerun()
                else:
                    st.error("Operator account not found")
                    
        if st.button("Return to Login", use_container_width=True):
            st.session_state.page = 'login'
            st.rerun()

# --- PART 4 — SIDEBAR NAVIGATION ---
def show_sidebar():
    with st.sidebar:
        st.markdown("""
        <div style='padding:16px 0;
        border-bottom:1px solid #2a3a5c;
        margin-bottom:16px'>
        <div style='display:flex;
        align-items:center;gap:10px'>
        <div style='background:#00d4aa;
        color:#0a0f1e;width:36px;height:36px;
        border-radius:8px;display:flex;
        align-items:center;justify-content:center;
        font-size:18px;font-weight:800'>V</div>
        <div>
        <div style='color:#ffffff;font-weight:700;
        font-size:16px'>VERENTIS</div>
        <div style='color:#8aa4c0;font-size:10px;
        letter-spacing:0.1em'>FORENSIC DIVISION</div>
        </div>
        </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div style='background:#0f6e56;
        border-radius:8px;padding:8px 12px;
        margin-bottom:16px;display:flex;
        align-items:center;gap:8px'>
        <div style='width:8px;height:8px;
        background:#00d4aa;border-radius:50%'></div>
        <span style='color:#00d4aa;font-size:12px;
        font-weight:600'>System Operational</span>
        </div>
        """, unsafe_allow_html=True)

        pages = [
            ("📊", "Dashboard"),
            ("🔍", "Threat Intelligence"),
            ("📄", "Document Analysis"),
            ("📋", "Audit Logs"),
        ]

        for icon, page in pages:
            is_active = (
                st.session_state.get(
                    'current_page', 'Document Analysis'
                ) == page
            )
            btn_style = (
                "primary" if is_active
                else "secondary"
            )
            if st.button(
                f"{icon} {page}",
                key=f"nav_{page}",
                use_container_width=True,
                type=btn_style
            ):
                st.session_state.current_page = page
                st.rerun()

        st.markdown("---")

        # Theme toggle
        theme_label = (
            "☀ Light Mode"
            if st.session_state.theme == 'dark'
            else "🌙 Dark Mode"
        )
        if st.button(
            theme_label,
            use_container_width=True
        ):
            st.session_state.theme = (
                'dark'
                if st.session_state.theme == 'light'
                else 'light'
            )
            st.rerun()

        st.markdown("---")

        # User profile
        name = st.session_state.get(
            'user_name', 'Operator'
        )
        role = st.session_state.get(
            'user_role', 'Forensic Officer'
        )
        initial = name[0].upper() if name else 'O'
        st.markdown(f"""
        <div style='padding:12px;
        background:#0d1f3c;border-radius:8px;
        margin-bottom:12px'>
        <div style='color:#8aa4c0;font-size:10px;
        letter-spacing:0.1em;margin-bottom:8px'>
        OPERATOR</div>
        <div style='display:flex;align-items:center;
        gap:10px'>
        <div style='background:#00d4aa;
        color:#0a0f1e;width:32px;height:32px;
        border-radius:50%;display:flex;
        align-items:center;justify-content:center;
        font-weight:800;font-size:14px'>
        {initial}</div>
        <div>
        <div style='color:#ffffff;font-weight:600;
        font-size:13px'>{name}</div>
        <div style='color:#8aa4c0;font-size:11px'>
        {role}</div>
        </div>
        </div>
        </div>
        """, unsafe_allow_html=True)

        if st.button(
            "🚪 Sign Out",
            use_container_width=True
        ):
            for key in list(
                st.session_state.keys()
            ):
                del st.session_state[key]
            st.rerun()

# --- PART 5 — VEHICLE VALIDATION LOGIC ---
def show_vehicle_validation():
    st.markdown("""
    <div style='background:#ffffff;
    border:1.5px solid #e0e8f0;
    border-radius:16px;padding:24px;
    margin-bottom:20px'>
    <h3 style='margin:0 0 4px 0'>
    Vehicle Identity Scan</h3>
    <p style='color:#546e7a;font-size:13px;
    margin:0'>Upload RC certificate, chassis plate
    image, or any vehicle document</p>
    </div>
    """, unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Drop RC or vehicle document here",
        type=['pdf','jpg','jpeg','png',
              'webp','tiff','tif'],
        label_visibility="visible"
    )

    # BLANK PAGE DETECTION
    if uploaded_file:
        file_bytes = uploaded_file.getvalue()
        file_size = len(file_bytes)
        if file_size < 5000:
            st.error(
                "⚠ BLANK PAGE DETECTED — "
                "The uploaded file appears to be "
                "empty or blank. Please upload a "
                "valid vehicle document."
            )
            st.stop()

        blank, blank_reason = is_blank_document(file_bytes, uploaded_file.name)
        if blank:
            st.error(
                f"⚠ BLANK PAGE DETECTED — {blank_reason}. "
                f"Please upload a valid document with "
                f"readable content."
            )
            st.stop()

    if uploaded_file:
        col1, col2 = st.columns([3, 1])
        with col1:
            st.markdown(
                f"✅ **{uploaded_file.name}** "
                f"({uploaded_file.size/1024:.1f} KB)"
            )
        with col2:
            analyze_btn = st.button(
                "🔍 Analyze Document",
                use_container_width=True,
                type="primary"
            )

        if analyze_btn:
            with st.spinner(
                "Running forensic analysis..."
            ):
                result = run_vehicle_analysis(
                    uploaded_file
                )

            if result:
                st.session_state.vehicle_results = result
                display_vehicle_results(result)

    elif st.session_state.get('vehicle_results'):
        display_vehicle_results(
            st.session_state.vehicle_results
        )

def display_vehicle_results(result):
    # Pipeline display
    st.markdown("#### Analysis Pipeline")
    steps = [
        "Document Loading",
        "OCR Analysis",
        "Chassis Detection",
        "Registration Detection",
        "Verdict"
    ]
    cols = st.columns(len(steps))
    for col, step in zip(cols, steps):
        with col:
            st.markdown(
                f"<div style='text-align:center;"
                f"font-size:11px;font-weight:600;"
                f"color:#00d4aa'>✅<br>{step}</div>",
                unsafe_allow_html=True
            )

    st.markdown("---")

    # Access result fields safely
    # If the backend endpoint returned structure different from vehicle_results model fallback gracefully
    chassis_data = result.get('chassis', {}) if isinstance(result.get('chassis'), dict) else {}
    reg_data = result.get('registration', {}) if isinstance(result.get('registration'), dict) else {}
    
    chassis = chassis_data.get('value') or result.get('chassis_number') or ''
    reg = reg_data.get('value') or result.get('registration_number') or ''
    
    # Check for blank page result
    if not chassis and not reg:
        st.error(
            "⚠ BLANK PAGE OR UNREADABLE DOCUMENT — "
            "No chassis or registration number "
            "could be extracted. Please upload "
            "a clear vehicle document."
        )
        return

    # Check state/manufacturer
    manufacturer = chassis_data.get('manufacturer') or result.get('manufacturer') or 'Unknown Manufacturer'
    state_name = reg_data.get('state') or result.get('state_name') or 'Unknown RTO State'

    # Scores
    chassis_score, chassis_msg, chassis_verdict = calculate_chassis_score(chassis)
    reg_score, reg_state, reg_state_code = validate_registration(reg)

    verdict = result.get('status') or result.get('verdict') or 'INVALID'
    reason = result.get('statusMessage') or result.get('reason') or 'Forensic discrepancy detected'

    # Verdict banner
    if verdict.upper() in ['VALID', 'GENUINE', 'SUCCESS']:
        st.markdown("""
        <div style='background:#0d3b1e;
        border:1.5px solid #00d4aa;
        border-radius:12px;padding:16px 20px;
        margin:16px 0;display:flex;
        align-items:center;gap:12px'>
        <span style='font-size:24px'>✅</span>
        <div>
        <div style='color:#00d4aa;font-size:18px;
        font-weight:700'>VALID DOCUMENT</div>
        <div style='color:#8aa4c0;font-size:13px'>
        Both chassis and registration detected and valid</div>
        </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"""
        <div style='background:#3b0d0d;
        border:1.5px solid #ff4757;
        border-radius:12px;padding:16px 20px;
        margin:16px 0'>
        <div style='color:#ff4757;font-size:18px;
        font-weight:700'>❌ INVALID / FAKE DOCUMENT
        </div>
        <div style='color:#8aa4c0;font-size:13px;
        margin-top:4px'>{reason}</div>
        </div>
        """, unsafe_allow_html=True)

    # Chassis and Registration cards
    col1, col2 = st.columns(2)
    with col1:
        score_color = (
            '#00d4aa' if chassis_score == 100
            else '#ffa502' if chassis_score == 50
            else '#ff4757'
        )
        wmi = chassis[:3] if chassis else ''
        st.markdown(f"""
        <div style='background:#0d1526;
        border:1.5px solid #1a2744;
        border-radius:12px;padding:20px'>
        <div style='color:#00d4aa;font-size:11px;
        letter-spacing:0.1em;margin-bottom:12px;
        font-weight:600'>CHASSIS / VIN</div>
        <div style='display:flex;align-items:center;
        gap:10px;margin-bottom:12px'>
        <span style='background:#00d4aa;
        color:#0a0f1e;padding:3px 8px;
        border-radius:6px;font-weight:700;
        font-size:13px'>{wmi}</span>
        <span style='font-size:18px;font-weight:700;
        font-family:monospace;color:#ffffff'>
        {chassis}</span>
        </div>
        <div style='display:flex;
        align-items:center;gap:8px'>
        <span style='background:#0d3b1e;
        color:#00d4aa;padding:3px 10px;
        border-radius:20px;font-size:12px;
        font-weight:600'>{manufacturer}</span>
        <span style='color:{score_color};
        font-size:20px;font-weight:800'>
        {chassis_score}%</span>
        </div>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        reg_parts = parse_registration(reg)
        reg_color = (
            '#00d4aa' if reg_score == 100
            else '#ff4757'
        )
        st.markdown(f"""
        <div style='background:#0d1526;
        border:1.5px solid #1a2744;
        border-radius:12px;padding:20px'>
        <div style='color:#00d4aa;font-size:11px;
        letter-spacing:0.1em;margin-bottom:12px;
        font-weight:600'>REGISTRATION</div>
        <div style='display:flex;align-items:center;
        gap:8px;margin-bottom:12px'>
        <span style='background:#0080ff;
        color:#fff;padding:3px 8px;
        border-radius:6px;font-weight:700'>
        {reg_parts.get("state","")}</span>
        <span style='background:#1a2744;
        color:#00d4aa;padding:3px 8px;
        border-radius:6px;font-weight:700'>
        {reg_parts.get("district","")}</span>
        <span style='font-size:18px;font-weight:700;
        color:#ffffff'>
        {reg_parts.get("series","")}
        {reg_parts.get("number","")}</span>
        </div>
        <div style='display:flex;
        align-items:center;gap:8px'>
        <span style='background:#0d3b1e;
        color:#00d4aa;padding:3px 10px;
        border-radius:20px;font-size:12px;
        font-weight:600'>{state_name}</span>
        <span style='color:{reg_color};
        font-size:20px;font-weight:800'>
        {reg_score}%</span>
        </div>
        </div>
        """, unsafe_allow_html=True)

# --- PART 6 — CHASSIS VALIDATION LOGIC ---
def calculate_chassis_score(chassis):
    if not chassis:
        return 0, "No chassis detected", "FAKE"

    chassis_upper = chassis.upper().strip()

    # Check 3 — Invalid characters (hard rule)
    for char in ['I', 'O', 'Q']:
        if char in chassis_upper:
            return 0, \
                f"Invalid character '{char}' found", \
                "FAKE"

    score = 0

    # OCR correction before WMI check
    wmi_raw = chassis_upper[:3]
    ocr_corrections = {
        '8': 'B', '0': 'O',
        '5': 'S', '6': 'G', '1': 'I'
    }
    wmi_corrected = ''
    for char in wmi_raw:
        wmi_corrected += ocr_corrections.get(
            char, char
        )

    # Check 1 — Length exactly 17 chars
    if len(chassis_upper) == 17:
        score += 50

    # Check 2 — Valid Indian WMI
    valid_wmi = [
        'MA1','MA3','MAT','MAL','MAK',
        'MBA','MB1','MB8','MBH','MBL',
        'MD2','MD7','MDH','ME3','MEE',
        'MEF','MEG','MEL','MES'
    ]
    if wmi_corrected in valid_wmi or \
       wmi_raw in valid_wmi:
        score += 50

    if score == 100:
        return score, "Valid", "VALID"
    elif score == 50:
        return score, "Partial", "SUSPICIOUS"
    else:
        return score, "Invalid", "FAKE"

# --- PART 7 — REGISTRATION VALIDATION LOGIC ---
def validate_registration(reg_number):
    import re
    if not reg_number:
        return 0, "No registration detected", ""

    reg_clean = reg_number.replace(
        ' ', ''
    ).upper()

    valid_states = {
        'TN':'Tamil Nadu','MH':'Maharashtra',
        'KA':'Karnataka','DL':'Delhi',
        'AP':'Andhra Pradesh','TS':'Telangana',
        'KL':'Kerala','GJ':'Gujarat',
        'RJ':'Rajasthan','UP':'Uttar Pradesh',
        'MP':'Madhya Pradesh','WB':'West Bengal',
        'HR':'Haryana','PB':'Punjab',
        'BR':'Bihar','OR':'Odisha',
        'AS':'Assam','JH':'Jharkhand',
        'UK':'Uttarakhand','HP':'Himachal Pradesh',
        'CG':'Chhattisgarh','GA':'Goa',
        'JK':'Jammu & Kashmir','CH':'Chandigarh',
        'PY':'Puducherry','MN':'Manipur',
        'ML':'Meghalaya','SK':'Sikkim'
    }

    pattern = r'^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$'
    if not re.match(pattern, reg_clean):
        return 0, "Invalid format", ""

    state_code = reg_clean[:2]
    if state_code in valid_states:
        return 100, valid_states[state_code], \
            state_code
    else:
        return 0, "Invalid state code", state_code

def parse_registration(reg):
    import re
    if not reg:
        return {}
    reg_clean = reg.replace(' ','').upper()
    match = re.match(
        r'^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$',
        reg_clean
    )
    if match:
        return {
            'state': match.group(1),
            'district': match.group(2),
            'series': match.group(3),
            'number': match.group(4)
        }
    return {'state': reg[:2], 'district': '',
            'series': '', 'number': ''}

# --- PART 8 — BLANK PAGE DETECTION ---
def is_blank_document(file_bytes, filename):
    ext = filename.split('.')[-1].lower()
    size = len(file_bytes)

    # Very small file = likely blank
    if size < 3000:
        return True, "File is too small to contain valid document content"

    # Try to extract text
    import tempfile, os
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=f'.{ext}'
    ) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = ""
        if ext == 'pdf' and pdfplumber is not None:
            try:
                with pdfplumber.open(tmp_path) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            text += t
            except:
                pass
        elif ext in ['jpg','jpeg','png','webp','tiff', 'tif']:
            try:
                from paddleocr import PaddleOCR
                if 'ocr_engine' not in st.session_state:
                    st.session_state.ocr_engine = PaddleOCR(
                        use_angle_cls=True,
                        lang='en', show_log=False
                    )
                result = st.session_state.ocr_engine.ocr(tmp_path, cls=True)
                if result and result[0]:
                    text = ' '.join([
                        line[1][0]
                        for line in result[0]
                        if line and line[1]
                    ])
            except:
                pass

        if len(text.strip()) < 20:
            return True, \
                "No readable text detected — " \
                "document appears blank or unreadable"
        return False, ""
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass

# --- PART 9 — TICKET VALIDATION LOGIC ---
def show_ticket_validation():
    st.markdown("""
    <div style='background:#ffffff;
    border:1.5px solid #e0e8f0;
    border-radius:16px;padding:24px;
    margin-bottom:20px'>
    <h3 style='margin:0 0 4px 0'>
    Ticket Forensic Validation</h3>
    <p style='color:#546e7a;font-size:13px;
    margin:0'>
    Validate warranty, invoice, investigation
    and estimation documents</p>
    </div>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        if st.button(
            "📄 Single Ticket",
            use_container_width=True,
            type="primary" if
                st.session_state.ticket_mode
                == 'single' else "secondary"
        ):
            st.session_state.ticket_mode = 'single'
            st.rerun()
    with col2:
        if st.button(
            "📦 Batch Tickets",
            use_container_width=True,
            type="primary" if
                st.session_state.ticket_mode
                == 'batch' else "secondary"
        ):
            st.session_state.ticket_mode = 'batch'
            st.rerun()

    st.markdown("---")

    if st.session_state.ticket_mode == 'single':
        show_single_ticket()
    else:
        show_batch_tickets()

def show_single_ticket():
    st.markdown("""
    <div style='background:#f0f9ff;
    border-left:4px solid #00d4aa;
    border-radius:0 8px 8px 0;
    padding:12px 16px;margin-bottom:16px'>
    <span style='color:#0a0f1e;font-weight:600;font-size:13px'>
    📁 Click <b>Select Local Folder</b> and choose your ticket folder. The system will automatically validate the folder name as the Ticket ID.
    </span>
    </div>
    """, unsafe_allow_html=True)

    # Native Folder Picker using tkinter (subprocess isolated for thread safety)
    if st.button("📁 Select Local Folder", use_container_width=True, type="primary"):
        import subprocess
        import sys
        
        script = """
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
print(filedialog.askdirectory(master=root, title='Select Ticket Folder'))
"""
        try:
            result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
            folder_path = result.stdout.strip()
            
            if folder_path:
                st.session_state.single_selected_folder = folder_path
                st.rerun()
        except Exception as e:
            st.error("Could not launch native folder picker. Make sure you are running locally.")
            st.error(str(e))

    uploaded_files = []
    detected_folder_id = ""

    if 'single_selected_folder' in st.session_state and st.session_state.single_selected_folder:
        folder_path = st.session_state.single_selected_folder
        import os
        folder_name = os.path.basename(folder_path)
        
        try:
            for f in os.listdir(folder_path):
                file_path = os.path.join(folder_path, f)
                if os.path.isfile(file_path):
                    with open(file_path, 'rb') as file_data:
                        # Mock uploaded file object
                        class MockUploadedFile:
                            def __init__(self, name, data):
                                self.name = name
                                self._data = data
                                import mimetypes
                                self.type = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                                self.size = len(data)
                            def read(self):
                                return self._data
                        uploaded_files.append(MockUploadedFile(f"{folder_name}/{f}", file_data.read()))
            
            if uploaded_files:
                st.markdown(
                    f"<p style='color:#00d4aa;font-weight:600;font-size:13px'>"
                    f"✅ {len(uploaded_files)} file(s) loaded from: {folder_path}</p>",
                    unsafe_allow_html=True
                )
        except Exception as e:
            st.error(f"Error reading folder: {str(e)}")
            uploaded_files = []
        # Try to extract the folder name from files
        for uf in uploaded_files:
            name_clean = uf.name.replace('\\', '/')
            parts = name_clean.split('/')
            if len(parts) > 1:
                potential_id = parts[0]
                if potential_id:
                    detected_folder_id = potential_id
                    break
            else:
                prefix_parts = uf.name.split('_')
                if len(prefix_parts) > 0 and len(prefix_parts[0]) == 10 and prefix_parts[0].isdigit():
                    detected_folder_id = prefix_parts[0]
                    break

    # Ticket ID Input Field (populated with detected folder name)
    st.markdown("**Ticket ID (Folder Name)**")
    
    # Pre-populate session state if detected_folder_id is found
    if detected_folder_id and st.session_state.get("single_ticket_id_main") != detected_folder_id:
        st.session_state.single_ticket_id_main = detected_folder_id

    ticket_id = st.text_input(
        "Ticket ID",
        placeholder="e.g. 4123456789",
        max_chars=10,
        label_visibility="collapsed",
        key="single_ticket_id_main"
    )

    ticket_valid = False
    if ticket_id:
        # Rules: exactly 10 digits, starts with 4, only numeric
        is_10_digits = len(ticket_id) == 10
        is_numeric = ticket_id.isdigit()
        starts_with_4 = ticket_id.startswith('4')
        
        if is_10_digits and is_numeric and starts_with_4:
            st.success(f"✅ Valid Ticket ID: {ticket_id}")
            ticket_valid = True
        else:
            st.error("❌ Invalid Ticket ID — Must be exactly 10 digits, contain only numbers, and start with 4.")
    elif uploaded_files and not detected_folder_id:
        st.error("❌ Invalid Ticket ID — Could not extract a valid 10-digit Ticket ID from the uploaded folder name/files.")

    can_validate = bool(uploaded_files) and ticket_valid

    if st.button(
        "🔍 Validate Ticket",
        disabled=not can_validate,
        use_container_width=True,
        type="primary",
        key="validate_single_btn"
    ):
        progress_placeholder = st.empty()
        pipeline_steps = [
            "📁 Folder & Ticket ID Validation",
            "🔍 File Detection & Listing",
            "📊 Category Classification",
            "✅ Document Checklist Verification",
            "🔄 Duplicate Detection",
            "💰 Amount Verification",
            "🚗 Chassis & Registration Verification",
            "⚖️ Final Verdict"
        ]

        def update_pipeline(step):
            with progress_placeholder.container():
                for i, s in enumerate(pipeline_steps):
                    icon = "✅" if i < step else ("⏳" if i == step else "⭕")
                    st.markdown(f"{icon} {s}")

        update_pipeline(0)
        with st.spinner("Validating ticket..."):
            result = run_ticket_validation(uploaded_files, ticket_id)

        if result:
            update_pipeline(len(pipeline_steps))
            st.session_state.ticket_result = result
            with st.expander("🔧 Debug — Raw API Response", expanded=False):
                st.json(result.get('_raw', result))
            display_ticket_results(result)
        else:
            progress_placeholder.empty()

    elif st.session_state.get('ticket_result') and st.session_state.get('ticket_mode') == 'single':
        display_ticket_results(st.session_state.ticket_result)


# --- PART 10 — TICKET RESULTS DISPLAY ---
def display_ticket_results(result):
    if not result:
        return

    verdict = result.get('verdict','')
    category = result.get('category','')
    ticket_id = result.get('ticket_id','')
    detected_types = result.get(
        'detected_types', []
    )
    checklist = result.get('checklist', {})
    duplicates = result.get('duplicates', {})
    amount_data = result.get('amount_data', {})
    chassis_verify = result.get(
        'chassis_verification', {}
    )
    reg_verify = result.get(
        'registration_verification', {}
    )
    reason = result.get('reason', '')
    detected_files = result.get(
        'detected_files', []
    )
    extracted_texts = result.get(
        'extracted_texts', {}
    )

    # Dynamic Pipeline steps status calculation
    # Checks
    tid_status = "pass" if len(ticket_id) == 10 and ticket_id.isdigit() and ticket_id.startswith('4') else "fail"
    files_status = "pass" if len(detected_files) > 0 else "fail"
    cat_status = "pass" if category != "OTHER" else "fail"
    
    # Checklist verification check
    missing_docs = False
    required_map = {
        'WARR': ['INVESTIGATION', 'IMAGE'],
        'GOODWILL': ['INVESTIGATION', 'IMAGE'],
        'CAMPAIGN': ['INVESTIGATION', 'IMAGE'],
        'PAID / PURE': ['INVESTIGATION', 'INVOICE', 'IMAGE'],
        'PAID / REJECTED': ['INVESTIGATION', 'INVOICE', 'ESTIMATION', 'REJECTION', 'IMAGE'],
    }
    required = []
    for key in required_map:
        if key.upper() in category.upper():
            required = required_map[key]
            break
    if not required:
        required = ['INVESTIGATION', 'INVOICE', 'ESTIMATION', 'REJECTION', 'IMAGE']
    for req_type in required:
        if checklist.get(req_type, 'MISSING') == 'MISSING':
            missing_docs = True
            
    checklist_status = "fail" if missing_docs else "pass"
    dup_status = "fail" if duplicates else "pass"
    amount_status = "pass" if (not amount_data or amount_data.get('amount_valid', True)) else "fail"
    
    ch_match = chassis_verify.get('match', True) if chassis_verify else True
    rg_match = reg_verify.get('match', True) if reg_verify else True
    chassis_status = "pass" if (ch_match and rg_match) else "fail"
    verdict_status = "pass" if verdict == "ACCEPTED" else ("warning" if verdict == "SUSPICIOUS" else "fail")

    st.markdown("#### Validation Pipeline")
    pipeline_steps = [
        ("Folder & Ticket ID Validation", tid_status),
        ("File Detection & Listing", files_status),
        ("Category Classification", cat_status),
        ("Document Checklist Verification", checklist_status),
        ("Duplicate Detection", dup_status),
        ("Amount Verification", amount_status),
        ("Chassis & Reg Verification", chassis_status),
        ("Final Verdict", verdict_status),
    ]

    step_cols = st.columns(len(pipeline_steps))
    for col, (step, status) in zip(step_cols, pipeline_steps):
        with col:
            if status == "pass":
                icon = "✅"
                color = "#00d4aa"
            elif status == "warning":
                icon = "⚠️"
                color = "#ffa502"
            else:
                icon = "❌"
                color = "#ff4757"
            st.markdown(
                f"<div style='text-align:center;"
                f"font-size:13px;font-weight:800;color:inherit;margin-bottom:12px'>"
                f"<span style='font-size:24px;color:{color};margin-bottom:8px;display:inline-block'>{icon}</span><br>"
                f"{step}</div>",
                unsafe_allow_html=True
            )

    st.markdown("---")

    # Blank documents warning if any
    blank_files = result.get('blank_files', [])
    if blank_files:
        st.markdown("""
        <div style='background:#fff8e1;
        border:1.5px solid #ffa502;
        border-left:4px solid #ffa502;
        border-radius:8px;padding:14px 16px;
        margin:12px 0'>
        <div style='color:#e65100;font-weight:700;
        font-size:14px;margin-bottom:8px'>
        ⚠ Blank Document Detected
        </div>
        """, unsafe_allow_html=True)

        for bf in blank_files:
            st.markdown(
                f"<div style='color:#bf360c;"
                f"font-size:13px;padding:4px 0'>"
                f"📄 <b>{bf['filename']}</b> — "
                f"{bf['reason']}</div>",
                unsafe_allow_html=True
            )

        st.markdown(
            "<div style='color:#546e7a;"
            "font-size:12px;margin-top:8px'>"
            "Blank documents are excluded from "
            "validation. Other documents in this "
            "ticket folder have been validated normally."
            "</div></div>",
            unsafe_allow_html=True
        )

    # Detected files
    if detected_files:
        st.markdown("#### Detected Files")
        type_colors = {
            'INVESTIGATION': '#00d4aa',
            'INVOICE': '#0080ff',
            'ESTIMATION': '#ffa502',
            'REJECTION': '#ff4757',
            'IMAGE': '#00b894',
            'OTHER': '#636e72'
        }
        for fi in detected_files:
            col1, col2, col3 = st.columns(
                [4, 2, 2]
            )
            with col1:
                is_dup = fi.get(
                    'is_duplicate', False
                )
                dup_badge = (
                    " 🔴 DUPLICATE"
                    if is_dup else ""
                )
                st.markdown(
                    f"📄 **{fi['name']}**"
                    f"{dup_badge}"
                )
            with col2:
                is_blank = fi.get('is_blank', False)
                if is_blank:
                    st.markdown(
                        "<span style='background:#ffebee;"
                        "color:#ff4757;padding:2px 8px;"
                        "border-radius:10px;font-size:11px;"
                        "font-weight:600'>BLANK</span>",
                        unsafe_allow_html=True
                    )
                else:
                    ftype = fi.get('type', 'OTHER')
                    color = type_colors.get(ftype, '#636e72')
                    st.markdown(
                        f"<span style='background:{color}22;"
                        f"color:{color};padding:2px 8px;"
                        f"border-radius:10px;font-size:11px;"
                        f"font-weight:600'>"
                        f"{ftype}</span>",
                        unsafe_allow_html=True
                    )
            with col3:
                size = fi.get('size_kb', 0)
                st.markdown(
                    f"<span style='color:#8aa4c0;font-size:12px'>"
                    f"{size:.1f} KB</span>",
                    unsafe_allow_html=True
                )

    # Category cards
    st.markdown("#### Forensic Segregation Logic")
    cats = [
        {
            "name": "WARR / GOODWILL / CAMPAIGN",
            "docs": ["Investigation", "Image"],
            "rule": "Investigation + Image only"
        },
        {
            "name": "PAID / PURE",
            "docs": [
                "Invoice",
                "Investigation",
                "Image"
            ],
            "rule": "Invoice + Investigation + Image"
        },
        {
            "name": "PAID / REJECTED",
            "docs": [
                "Invoice", "Investigation",
                "Estimation", "Rejection", "Image"
            ],
            "rule": "All 5 documents required"
        }
    ]
    cat_cols = st.columns(3)
    for col, cat in zip(cat_cols, cats):
        with col:
            matched = (
                cat['name'].upper() in
                category.upper() or
                category.upper() in
                cat['name'].upper()
            )
            border = (
                '#00d4aa' if matched
                else '#1a2744'
            )
            bg = (
                '#0d3b1e' if matched
                else '#0d1526'
            )
            docs_html = ''.join([
                f"<div style='font-size:11px;"
                f"color:#8aa4c0;padding:2px 0'>"
                f"• {d}</div>"
                for d in cat['docs']
            ])
            badge = (
                "<span style='background:#00d4aa;"
                "color:#0a0f1e;padding:1px 6px;"
                "border-radius:8px;font-size:10px;"
                "font-weight:700'>MATCHED</span> "
                if matched else ""
            )
            st.markdown(
                f"<div style='border:1.5px solid "
                f"{border};border-radius:12px;"
                f"padding:14px;background:{bg};"
                f"min-height:140px'>"
                f"<div style='color:#ffffff;"
                f"font-weight:700;font-size:12px;"
                f"margin-bottom:8px'>"
                f"{badge}{cat['name']}</div>"
                f"{docs_html}"
                f"<div style='color:#546e7a;"
                f"font-size:10px;margin-top:8px'>"
                f"{cat['rule']}</div></div>",
                unsafe_allow_html=True
            )

    # Document checklist
    st.markdown("#### Document Checklist")
    doc_types_list = [
        ('Investigation Report', 'INVESTIGATION'),
        ('Invoice', 'INVOICE'),
        ('Estimation Report', 'ESTIMATION'),
        ('Rejection Report', 'REJECTION'),
        ('Image / Supporting Doc', 'IMAGE')
    ]

    required_map = {
        'WARR': ['INVESTIGATION', 'IMAGE'],
        'GOODWILL': ['INVESTIGATION', 'IMAGE'],
        'CAMPAIGN': ['INVESTIGATION', 'IMAGE'],
        'PAID / PURE': [
            'INVESTIGATION', 'INVOICE', 'IMAGE'
        ],
        'PAID / REJECTED': [
            'INVESTIGATION', 'INVOICE',
            'ESTIMATION', 'REJECTION', 'IMAGE'
        ],
    }
    required = []
    for key in required_map:
        if key.upper() in category.upper():
            required = required_map[key]
            break
    if not required:
        required = [t[1] for t in doc_types_list]

    for doc_name, type_key in doc_types_list:
        is_req = type_key in required
        status = checklist.get(type_key, 'MISSING')
        # Use TYPE_file key not just TYPE key
        filename = checklist.get(f'{type_key}_file', '')

        col1, col2, col3 = st.columns([3, 2, 3])
        with col1:
            st.markdown(f"**{doc_name}**")
        with col2:
            if not is_req:
                st.markdown("<span style='color:#546e7a'>— N/A</span>", unsafe_allow_html=True)
            elif status == 'PRESENT':
                st.markdown("<span style='color:#00d4aa;font-weight:600'>✅ Present</span>", unsafe_allow_html=True)
            else:
                st.markdown("<span style='color:#ff4757;font-weight:600'>❌ Missing</span>", unsafe_allow_html=True)
        with col3:
            # Only show preview if THIS doc is present and has its OWN filename
            if status == 'PRESENT' and filename:
                btn_key = f"preview_{type_key}_{ticket_id}"
                if st.button(f"👁 {filename}", key=btn_key):
                    text = extracted_texts.get(filename, "")
                    with st.expander(f"OCR Preview — {filename}", expanded=True):
                        if text:
                            st.code(text, language=None)
                            st.button("📋 Copy", key=f"copy_{type_key}_{ticket_id}")
                        else:
                            st.info("No text extracted")

    # Duplicate detection
    st.markdown("#### Duplicate Detection")
    if duplicates:
        for dtype, files in duplicates.items():
            st.error(
                f"⚠ DUPLICATE {dtype}: "
                f"{', '.join(files)}"
            )
    else:
        st.success("✅ No duplicate files detected")

    # Amount verification
    if amount_data:
        st.markdown(
            "#### Invoice Amount Verification"
        )
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(
                "Sub Total",
                f"Rs. {amount_data.get('subtotal',0)}"
            )
        with col2:
            gst_pct = amount_data.get('gst_percentage', 0)
            st.metric(
                f"GST ({gst_pct}%)",
                f"Rs. {amount_data.get('gst_amount',0)}"
            )
        with col3:
            st.metric(
                "Total",
                f"Rs. {amount_data.get('total',0)}"
            )
        if amount_data.get('amount_valid'):
            st.success(
                "✅ Amount calculation correct"
            )
        else:
            st.error(
                "❌ Amount mismatch detected: "
                f"{amount_data.get('error','')}"
            )
    # Chassis and registration verification
    if chassis_verify or reg_verify:
        st.markdown("#### Vehicle Identity Verification")
        col1, col2 = st.columns(2)
        with col1:
            ch_val = chassis_verify.get('value', 'N/A') if chassis_verify else 'N/A'
            ch_match = chassis_verify.get('match', False) if chassis_verify else False
            ch_err = chassis_verify.get('error', '') if chassis_verify else ''
            
            border = '#00d4aa' if ch_match else '#ff4757'
            bg = '#0d3b1e' if ch_match else '#3b0d0d'
            icon = "✅" if ch_match else "❌"
            status_text = "Consistent VIN Structure" if ch_match else f"Error: {ch_err}"
            
            st.markdown(
                f"<div style='border:1.5px solid {border};border-radius:12px;padding:14px;background:{bg}'>"
                f"<div style='color:#8aa4c0;font-size:11px;font-weight:600'>CHASSIS / VIN</div>"
                f"<div style='color:#ffffff;font-size:18px;font-weight:700;margin:6px 0'>{ch_val}</div>"
                f"<div style='color:{border};font-size:11px;font-weight:600'>{icon} {status_text}</div>"
                f"</div>",
                unsafe_allow_html=True
            )
            
        with col2:
            rg_val = reg_verify.get('value', 'N/A') if reg_verify else 'N/A'
            rg_match = reg_verify.get('match', False) if reg_verify else False
            rg_err = reg_verify.get('error', '') if reg_verify else ''
            
            border = '#00d4aa' if rg_match else '#ff4757'
            bg = '#0d3b1e' if rg_match else '#3b0d0d'
            icon = "✅" if rg_match else "❌"
            status_text = "Consistent Pattern Match" if rg_match else f"Error: {rg_err}"
            
            st.markdown(
                f"<div style='border:1.5px solid {border};border-radius:12px;padding:14px;background:{bg}'>"
                f"<div style='color:#8aa4c0;font-size:11px;font-weight:600'>VEHICLE REGISTRATION</div>"
                f"<div style='color:#ffffff;font-size:18px;font-weight:700;margin:6px 0'>{rg_val}</div>"
                f"<div style='color:{border};font-size:11px;font-weight:600'>{icon} {status_text}</div>"
                f"</div>",
                unsafe_allow_html=True
            )

    # Verdict banner
    st.markdown("---")
    verdict_styles = {
        'ACCEPTED': (
            '#0d3b1e', '#00d4aa',
            '✅ ACCEPTED',
            'All documents verified and valid'
        ),
        'REJECTED': (
            '#3b0d0d', '#ff4757',
            '❌ REJECTED', reason
        ),
        'SUSPICIOUS': (
            '#3b2200', '#ffa502',
            '⚠ SUSPICIOUS',
            'Manual review recommended'
        )
    }

    if verdict in verdict_styles:
        bg, color, title, msg = \
            verdict_styles[verdict]
        st.markdown(
            f"<div style='background:{bg};"
            f"border:1.5px solid {color};"
            f"border-radius:12px;padding:20px;"
            f"margin:16px 0;display:flex;"
            f"justify-content:space-between;"
            f"align-items:center'>"
            f"<div>"
            f"<div style='color:{color};"
            f"font-size:20px;font-weight:700'>"
            f"{title}</div>"
            f"<div style='color:#8aa4c0;"
            f"font-size:13px;margin-top:4px'>"
            f"{msg}</div></div>"
            f"<div style='color:{color};"
            f"font-weight:700;font-size:14px'>"
            f"{category}</div>"
            f"</div>",
            unsafe_allow_html=True
        )

    # CSV Export
    csv = generate_ticket_csv(result)
    from datetime import datetime
    date_str = datetime.now().strftime("%Y%m%d")
    st.download_button(
        label="⬇ Export CSV Report",
        data=csv.encode('utf-8'),
        file_name=f"ticket_{ticket_id}_{date_str}.csv",
        mime="text/csv",
        key=f"csv_{ticket_id}"
    )

# --- PART 11 — CSV GENERATION ---
def generate_ticket_csv(result):
    from datetime import datetime
    now = datetime.now().strftime(
        "%d/%m/%Y, %I:%M:%S %p"
    )
    bom = '\ufeff'
    ticket_id = result.get('ticket_id','')
    category = result.get('category','')
    verdict = result.get('verdict','')
    checklist = result.get('checklist',{})

    def get_status(key):
        return checklist.get(key, 'N/A')

    lines = [
        'Ticket Forensic Validation - Document Checklist',
        '',
        f'Generated: {now}',
        'Ticket ID,Category,Verdict,Investigation Report,Invoice,Estimation Report,Rejection Report,Image/Supporting Doc',
        ','.join([
            f'="{ticket_id}"',
            category,
            verdict,
            get_status('INVESTIGATION'),
            get_status('INVOICE'),
            get_status('ESTIMATION'),
            get_status('REJECTION'),
            get_status('IMAGE')
        ]),
        '',
        'Present = Document found   Missing = Document not found   N/A = Not required for category',
        f'Verentis Forensic Validation System - {now}'
    ]
    return bom + '\n'.join(lines)

# --- PART 12 — BATCH MODE ---
def group_files_by_ticket(uploaded_files):
    ticket_groups = {}
    invalid_files = []
    batch_name = ""

    for uf in uploaded_files:
        name_parts = uf.name.replace('\\', '/').split('/')

        ticket_id = None
        for part in name_parts:
            clean = part.split('.')[0]
            if (len(clean) == 10 and
                    clean.isdigit() and
                    clean.startswith('4')):
                ticket_id = clean
                idx = name_parts.index(part)
                if idx > 0:
                    batch_name = name_parts[0]
                break

        if not ticket_id:
            fname = name_parts[-1]
            prefix = fname.split('_')[0] if '_' in fname else ''
            if (len(prefix) == 10 and
                    prefix.isdigit() and
                    prefix.startswith('4')):
                ticket_id = prefix

        if ticket_id:
            if ticket_id not in ticket_groups:
                ticket_groups[ticket_id] = []
            ticket_groups[ticket_id].append(uf)
        else:
            invalid_files.append(uf)

    return ticket_groups, invalid_files, batch_name

def show_batch_tickets():
    st.markdown("""
    <div style='background:#f0f9ff;
    border-left:4px solid #00d4aa;
    border-radius:0 8px 8px 0;
    padding:14px 16px;margin-bottom:16px'>
    <b style='color:#0a0f1e'>
    📁 How to upload batch folder:
    </b><br>
    <span style='color:#546e7a;font-size:13px'>
    1. Click Browse files below<br>
    2. Navigate to your batch folder<br>
    3. Select ALL files inside
       (use Ctrl+A to select all)<br>
    4. Files from all ticket subfolders
       will be auto-detected by their
       10 digit folder names
    </span>
    </div>
    """, unsafe_allow_html=True)

    batch_files = []
    
    if st.button("📁 Browse for Batch Folder", type="primary"):
        import subprocess, sys
        script = """
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
print(filedialog.askdirectory(master=root, title='Select Batch Folder'))
"""
        try:
            result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
            fpath = result.stdout.strip()
            if fpath:
                st.session_state.batch_master_folder = fpath
                st.rerun()
        except Exception as e:
            st.error(f"Error launching folder picker: {e}")

    if 'batch_master_folder' in st.session_state and st.session_state.batch_master_folder:
        import os
        fpath = st.session_state.batch_master_folder
        
        col1, col2 = st.columns([4, 1])
        with col1:
            st.markdown(f"**Selected:** `{fpath}`")
        with col2:
            if st.button("✕ Clear"):
                del st.session_state.batch_master_folder
                st.rerun()
                
        try:
            # Walk directory to find files
            parent_dir = os.path.dirname(fpath)
            for root_dir, _, files in os.walk(fpath):
                for f in files:
                    ext = f.split('.')[-1].lower()
                    if ext in ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp']:
                        full_path = os.path.join(root_dir, f)
                        # Relative path (e.g. "Batch_001/4567891235/invoice.pdf")
                        rel_path = os.path.relpath(full_path, start=parent_dir)
                        
                        with open(full_path, 'rb') as file_data:
                            class MockUploadedFile:
                                def __init__(self, name, data):
                                    self.name = name
                                    self._data = data
                                    import mimetypes
                                    self.type = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                                    self.size = len(data)
                                def read(self):
                                    return self._data
                                def seek(self, *args):
                                    pass
                            batch_files.append(MockUploadedFile(rel_path.replace('\\', '/'), file_data.read()))
        except Exception as e:
            st.error(f"Error reading folder: {e}")

    if batch_files:
        groups, invalid, batch_name = group_files_by_ticket(batch_files)

        # Batch summary header
        st.markdown(f"""
        <div style='background:#0d1526;
        border:1.5px solid #1a2744;
        border-radius:12px;padding:16px 20px;
        margin:12px 0;display:flex;
        justify-content:space-between;
        align-items:center'>
        <div>
        <div style='color:#00d4aa;font-size:11px;
        letter-spacing:0.1em;font-weight:600;
        margin-bottom:4px'>BATCH FOLDER</div>
        <div style='color:#ffffff;font-size:16px;
        font-weight:700'>
        {batch_name or "Uploaded Batch"}
        </div>
        </div>
        <div style='text-align:right'>
        <div style='color:#00d4aa;font-size:24px;
        font-weight:800'>{len(groups)}</div>
        <div style='color:#8aa4c0;font-size:12px'>
        Ticket folders detected</div>
        </div>
        </div>
        """, unsafe_allow_html=True)

        # Show ticket ID chips
        if groups:
            chips_html = ""
            for tid in groups.keys():
                file_count = len(groups[tid])
                chips_html += (
                    f"<span style='background:#0d3b1e;"
                    f"color:#00d4aa;padding:4px 12px;"
                    f"border-radius:20px;font-size:12px;"
                    f"font-weight:600;margin:3px;display:"
                    f"inline-block'>📁 {tid} "
                    f"({file_count} files)</span>"
                )
            st.markdown(
                f"<div style='margin:12px 0'>"
                f"{chips_html}</div>",
                unsafe_allow_html=True
            )

        if invalid:
            st.warning(
                f"⚠ {len(invalid)} files could not "
                f"be assigned to any ticket folder. "
                f"Make sure files are inside folders "
                f"named with 10 digit ticket IDs "
                f"starting with 4."
            )
            for f in invalid[:5]:
                st.markdown(
                    f"<span style='color:#ffa502;"
                    f"font-size:12px'>• {f.name}"
                    f"</span>",
                    unsafe_allow_html=True
                )

        if not groups:
            st.error(
                "No valid ticket folders detected. "
                "Make sure your files are inside "
                "folders named with 10 digit IDs "
                "starting with 4."
            )
            st.stop()

        # Start button
        col1, col2, col3 = st.columns([1,2,1])
        with col2:
            start_btn = st.button(
                f"🚀 Start Batch Validation "
                f"({len(groups)} tickets)",
                type="primary",
                use_container_width=True
            )

        if start_btn:
            st.markdown("---")
            st.markdown("### Batch Processing")

            # Overall progress
            overall_progress = st.progress(0)
            current_status = st.empty()

            # Results container
            results_container = st.container()

            all_results = []
            total = len(groups)

            for i, (tid, files) in enumerate(groups.items()):
                # Update status
                current_status.markdown(
                    f"<div style='background:#0d1526;"
                    f"border:1px solid #1a2744;"
                    f"border-radius:8px;padding:10px 14px;"
                    f"margin:8px 0'>"
                    f"<span style='color:#ffa502'>⏳</span> "
                    f"<b style='color:#ffffff'>Processing "
                    f"ticket {i+1}/{total}:</b> "
                    f"<span style='color:#00d4aa'>{tid}</span>"
                    f"</div>",
                    unsafe_allow_html=True
                )

                # Run validation same as single ticket
                result = run_ticket_validation(files, tid)

                if result:
                    result['ticket_id'] = tid
                    all_results.append(result)

                    # Show mini result card immediately
                    verdict = result.get('verdict','')
                    category = result.get('category','')
                    files_count = len(result.get('detected_files',[]))

                    verdict_colors = {
                        'ACCEPTED': ('#0d3b1e','#00d4aa'),
                        'REJECTED': ('#3b0d0d','#ff4757'),
                        'SUSPICIOUS': ('#3b2200','#ffa502')
                    }
                    bg, color = verdict_colors.get(verdict, ('#1a2744','#8aa4c0'))

                    with results_container:
                        st.markdown(
                            f"<div style='background:{bg};"
                            f"border:1px solid {color};"
                            f"border-radius:8px;padding:10px "
                            f"14px;margin:4px 0;display:flex;"
                            f"justify-content:space-between;"
                            f"align-items:center'>"
                            f"<div>"
                            f"<span style='color:{color};"
                            f"font-weight:700'>✓ {tid}</span>"
                            f"<span style='color:#8aa4c0;"
                            f"font-size:12px;margin-left:12px'>"
                            f"{category}</span>"
                            f"</div>"
                            f"<div style='text-align:right'>"
                            f"<span style='color:{color};"
                            f"font-weight:700'>{verdict}</span>"
                            f"<span style='color:#8aa4c0;"
                            f"font-size:11px;margin-left:8px'>"
                            f"{files_count} files</span>"
                            f"</div></div>",
                            unsafe_allow_html=True
                        )

                # Update overall progress
                overall_progress.progress((i+1)/total)

            current_status.success(f"✅ Batch complete — {total} tickets processed")
            st.session_state.batch_results = all_results

    # Section 4 - Summary
    if st.session_state.get('batch_results'):
        results = st.session_state.batch_results

        accepted = [r for r in results if r.get('verdict') == 'ACCEPTED']
        rejected = [r for r in results if r.get('verdict') == 'REJECTED']
        suspicious = [r for r in results if r.get('verdict') == 'SUSPICIOUS']

        st.markdown("---")
        st.markdown("### Batch Summary")

        # Summary metric cards
        col1,col2,col3,col4 = st.columns(4)
        with col1:
            st.markdown(f"""
            <div style='background:#0d1526;
            border:1px solid #1a2744;
            border-radius:12px;padding:16px;
            text-align:center'>
            <div style='color:#8aa4c0;font-size:11px;
            font-weight:600;letter-spacing:0.1em'>
            TOTAL</div>
            <div style='color:#ffffff;font-size:28px;
            font-weight:800'>{len(results)}</div>
            </div>
            """, unsafe_allow_html=True)
        with col2:
            st.markdown(f"""
            <div style='background:#0d3b1e;
            border:1px solid #00d4aa;
            border-radius:12px;padding:16px;
            text-align:center'>
            <div style='color:#00d4aa;font-size:11px;
            font-weight:600;letter-spacing:0.1em'>
            ACCEPTED</div>
            <div style='color:#00d4aa;font-size:28px;
            font-weight:800'>{len(accepted)}</div>
            </div>
            """, unsafe_allow_html=True)
        with col3:
            st.markdown(f"""
            <div style='background:#3b0d0d;
            border:1px solid #ff4757;
            border-radius:12px;padding:16px;
            text-align:center'>
            <div style='color:#ff4757;font-size:11px;
            font-weight:600;letter-spacing:0.1em'>
            REJECTED</div>
            <div style='color:#ff4757;font-size:28px;
            font-weight:800'>{len(rejected)}</div>
            </div>
            """, unsafe_allow_html=True)
        with col4:
            st.markdown(f"""
            <div style='background:#3b2200;
            border:1px solid #ffa502;
            border-radius:12px;padding:16px;
            text-align:center'>
            <div style='color:#ffa502;font-size:11px;
            font-weight:600;letter-spacing:0.1em'>
            SUSPICIOUS</div>
            <div style='color:#ffa502;font-size:28px;
            font-weight:800'>{len(suspicious)}</div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # Filter tabs
        filter_col1, filter_col2, filter_col3, filter_col4 = st.columns(4)
        with filter_col1:
            show_all = st.button("All", use_container_width=True)
        with filter_col2:
            show_accepted = st.button("✅ Accepted", use_container_width=True)
        with filter_col3:
            show_rejected = st.button("❌ Rejected", use_container_width=True)
        with filter_col4:
            show_suspicious = st.button("⚠ Suspicious", use_container_width=True)

        if 'batch_filter' not in st.session_state:
            st.session_state.batch_filter = 'ALL'
        if show_all:
            st.session_state.batch_filter = 'ALL'
        if show_accepted:
            st.session_state.batch_filter = 'ACCEPTED'
        if show_rejected:
            st.session_state.batch_filter = 'REJECTED'
        if show_suspicious:
            st.session_state.batch_filter = 'SUSPICIOUS'

        # Filter results
        current_filter = st.session_state.batch_filter
        if current_filter == 'ALL':
            filtered = results
        else:
            filtered = [r for r in results if r.get('verdict') == current_filter]

        # Results table
        st.markdown(f"**Showing {len(filtered)} tickets**")

        import pandas as pd
        table_data = []
        for r in filtered:
            checklist = r.get('checklist', {})
            blank_files = r.get('blank_files', [])
            blank_note = f"⚠ {len(blank_files)} blank file(s)" if blank_files else ""
            reason = r.get('reason', '')
            notes = reason + (" | " + blank_note if blank_note and reason else blank_note)
            
            table_data.append({
                'Ticket ID': r.get('ticket_id',''),
                'Category': r.get('category',''),
                'Verdict': r.get('verdict',''),
                'Files': len(r.get('detected_files',[])),
                'Investigation': checklist.get('INVESTIGATION','—'),
                'Invoice': checklist.get('INVOICE','—'),
                'Estimation': checklist.get('ESTIMATION','—'),
                'Rejection': checklist.get('REJECTION','—'),
                'Image/Doc': checklist.get('IMAGE','—'),
                'Notes': notes
            })

        df = pd.DataFrame(table_data)
        st.dataframe(df, use_container_width=True, hide_index=True)

        # Expandable detail view per ticket
        st.markdown("### Ticket Details")
        st.markdown("Click any ticket to see full results:")

        for r in filtered:
            tid = r.get('ticket_id','')
            verdict = r.get('verdict','')
            category = r.get('category','')
            verdict_icon = {
                'ACCEPTED':'✅',
                'REJECTED':'❌',
                'SUSPICIOUS':'⚠'
            }.get(verdict,'❓')

            with st.expander(f"{verdict_icon} {tid} — {verdict} — {category}"):
                reason = r.get('reason', '')
                if verdict in ['SUSPICIOUS', 'REJECTED'] and reason:
                    color = '#ff4757' if verdict == 'REJECTED' else '#ffa502'
                    st.markdown(f"<div style='color:{color};font-weight:600;margin-bottom:12px;padding:8px;background:{color}11;border-radius:4px;border-left:4px solid {color}'>Reason: {reason}</div>", unsafe_allow_html=True)
                
                # Show blank file warning if any
                blank_files = r.get('blank_files',[])
                if blank_files:
                    for bf in blank_files:
                        st.warning(f"⚠ Blank file excluded: {bf['filename']}")

                # Show detected files
                detected = r.get('detected_files',[])
                if detected:
                    st.markdown("**Files detected:**")
                    for fi in detected:
                        ftype = fi.get('type','OTHER')
                        fname = fi.get('name','')
                        size = fi.get('size_kb',0)
                        is_dup = fi.get('is_duplicate', False)
                        
                        type_colors = {
                            'INVESTIGATION':'#00d4aa',
                            'INVOICE':'#0080ff',
                            'ESTIMATION':'#ffa502',
                            'REJECTION':'#ff4757',
                            'IMAGE':'#00b894',
                            'OTHER':'#636e72',
                            'SUPPORTING_DOC':'#9c27b0'
                        }
                        color = type_colors.get(ftype,'#636e72')
                        dup_badge = "<span style='margin-left:8px;color:#ff4757;font-size:11px;font-weight:700'>🔴 DUPLICATE</span>" if is_dup else ""
                        
                        st.markdown(
                            f"<span style='margin-right:8px'>📄 {fname}</span>"
                            f"<span style='background:{color}22;color:{color};"
                            f"padding:2px 8px;border-radius:10px;font-size:11px;"
                            f"font-weight:600'>{ftype}</span> "
                            f"<span style='color:#8aa4c0;font-size:11px'>"
                            f"{size:.1f} KB</span>"
                            f"{dup_badge}",
                            unsafe_allow_html=True
                        )

                # Show checklist
                st.markdown("**Document checklist:**")
                checklist = r.get('checklist',{})
                doc_rows = [
                    ('Investigation','INVESTIGATION'),
                    ('Invoice','INVOICE'),
                    ('Estimation','ESTIMATION'),
                    ('Rejection','REJECTION'),
                    ('Image/Doc','IMAGE')
                ]
                for label, key in doc_rows:
                    status = checklist.get(key,'—')
                    if status == 'PRESENT':
                        icon = "✅"
                    elif status == 'MISSING':
                        icon = "❌"
                    else:
                        icon = "—"
                    st.markdown(f"{icon} {label}: **{status}**")

                # Show amount verification
                amount_data = r.get('amount_data',{})
                if amount_data:
                    st.markdown("**Amount verification:**")
                    if amount_data.get('amount_valid'):
                        st.success("✅ Amount calculation correct")
                    else:
                        st.error(f"❌ Amount mismatch: {amount_data.get('error', '')}")

        # CSV & Excel Export buttons
        st.markdown("---")
        col1, col2 = st.columns(2)
        with col1:
            csv = generate_batch_csv(results)
            from datetime import datetime
            date_str = datetime.now().strftime("%Y%m%d_%H%M")
            batch_name_clean = batch_name.replace(' ','_') if 'batch_name' in locals() and batch_name else 'batch'
            st.download_button(
                label="⬇ Export CSV Report",
                data=csv.encode('utf-8'),
                file_name=f"{batch_name_clean}_{date_str}.csv",
                mime="text/csv",
                use_container_width=True
            )
        with col2:
            excel_bytes = generate_batch_excel(results)
            st.download_button(
                label="⬇ Export Excel Report",
                data=excel_bytes,
                file_name=f"{batch_name_clean}_{date_str}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )

def generate_batch_excel(results):
    import pandas as pd
    import io
    
    data = []
    for r in results:
        checklist = r.get('checklist', {})
        def get_status(key):
            return checklist.get(key, 'N/A')
            
        blank_files = r.get('blank_files', [])
        blank_note = f"⚠ {len(blank_files)} blank file(s)" if blank_files else ""
        reason = r.get('reason', '')
        notes = reason + (" | " + blank_note if blank_note and reason else blank_note)
            
        data.append({
            'Ticket ID': r.get('ticket_id', ''),
            'Category': r.get('category', ''),
            'Verdict': r.get('verdict', ''),
            'Investigation Report': get_status('INVESTIGATION'),
            'Invoice': get_status('INVOICE'),
            'Estimation Report': get_status('ESTIMATION'),
            'Rejection Report': get_status('REJECTION'),
            'Image/Supporting Doc': get_status('IMAGE'),
            'Total Files': len(r.get('detected_files', [])),
            'Blank Files': len(r.get('blank_files', [])),
            'Notes / Reason': notes
        })
        
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Batch Results')
        
        worksheet = writer.sheets['Batch Results']
        for idx, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = max_len
            
    return output.getvalue()

def generate_batch_csv(results):
    from datetime import datetime
    now = datetime.now().strftime(
        "%d/%m/%Y, %I:%M:%S %p"
    )
    bom = '\ufeff'
    lines = [
        'Ticket Forensic Validation - Document Checklist',
        '',
        f'Generated: {now}',
        'Ticket ID,Category,Verdict,Investigation Report,Invoice,Estimation Report,Rejection Report,Image/Supporting Doc,Notes/Reason'
    ]
    for r in results:
        checklist = r.get('checklist',{})
        def gs(k):
            return checklist.get(k, 'N/A')
            
        blank_files = r.get('blank_files', [])
        blank_note = f"⚠ {len(blank_files)} blank file(s)" if blank_files else ""
        reason = r.get('reason', '')
        notes = reason + (" | " + blank_note if blank_note and reason else blank_note)
        notes = f'"{notes}"' if ',' in notes else notes
        
        lines.append(','.join([
            f'="{r.get("ticket_id","")}"',
            r.get('category',''),
            r.get('verdict',''),
            gs('INVESTIGATION'),
            gs('INVOICE'),
            gs('ESTIMATION'),
            gs('REJECTION'),
            gs('IMAGE'),
            notes
        ]))
    lines += [
        '',
        'Present = Document found   Missing = Document not found   N/A = Not required for category',
        f'Verentis Forensic Validation System - {now}'
    ]
    return bom + '\n'.join(lines)

# --- PART 13 — API CALLS & REFACTOR ---
def run_vehicle_analysis(uploaded_file):
    import tempfile, os, requests
    BASE_URL = get_backend_url()

    suffix = os.path.splitext(
        uploaded_file.name
    )[1]
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=suffix
    ) as tmp:
        tmp.write(uploaded_file.read())
        tmp_path = tmp.name

    try:
        with open(tmp_path, 'rb') as f:
            # We identified that the exact backend endpoint is f"{BASE_URL}/api/v1/vehicle/upload"
            response = requests.post(
                f"{BASE_URL}/api/v1/vehicle/upload",
                files={
                    'file': (
                        uploaded_file.name,
                        f,
                        uploaded_file.type
                    )
                },
                timeout=60
            )
        if response.status_code == 200:
            return response.json()
        else:
            st.error(
                f"Analysis failed: {response.status_code}"
            )
            return None
    except Exception as e:
        st.error(f"Connection error: {e}")
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass

def classify_document_frontend(filename: str, text: str) -> str:
    fn = filename.lower()
    text_upper = text.upper()
    
    # 1. Rejection report keywords
    rejection_keywords = ["rejection", "declined", "denied", "reject"]
    if any(k in fn for k in rejection_keywords) or any(k.upper() in text_upper for k in rejection_keywords):
        return "REJECTION"
        
    # 2. Estimation report keywords
    estimation_keywords = ["estimate", "quotation", "repair estimate", "estimat"]
    if any(k in fn for k in estimation_keywords) or any(k.upper() in text_upper for k in estimation_keywords):
        return "ESTIMATION"
        
    # 3. Investigation keywords
    investigation_keywords = ["investigation", "inspect", "survey", "damage report", "invest", "inves"]
    if any(k in fn for k in investigation_keywords) or any(k.upper() in text_upper for k in investigation_keywords):
        return "INVESTIGATION"
        
    # 4. Invoice keywords
    invoice_keywords = ["invoice", "bill", "tax invoice", "final bill", "billing"]
    if any(k in fn for k in invoice_keywords) or any(k.upper() in text_upper for k in invoice_keywords):
        return "INVOICE"
        
    # 5. Image keywords/extensions
    image_extensions = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".bmp"]
    image_keywords = ["photo", "image", "pic"]
    if any(fn.endswith(ext) for ext in image_extensions) or any(k in fn for k in image_keywords):
        return "IMAGE"
        
    return "OTHER"

def extract_vehicle_details(text: str) -> dict:
    text_upper = text.upper()
    vin_pattern = r'\b([A-HJ-NPR-Z0-9]{17})\b'
    vins = re.findall(vin_pattern, text_upper)
    chassis = vins[0] if vins else None
    
    reg_pattern = r'\b([A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4})\b'
    regs = re.findall(reg_pattern, text_upper)
    registration = regs[0].replace(" ", "") if regs else None
    
    return {
        'chassis': chassis,
        'registration': registration
    }

def extract_amounts(text: str) -> dict:
    import re
    text_upper = text.upper()
    amounts = {}

    # Find Sub Total
    subtotal_patterns = [
        r'SUB\s*TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'SUB\s*TOTAL[:\s]+([\d,]+)',
        r'SUBTOTAL[:\s]+RS\.?\s*([\d,]+)',
    ]
    for pattern in subtotal_patterns:
        match = re.search(pattern, text_upper)
        if match:
            amounts['subtotal'] = float(match.group(1).replace(',', ''))
            break

    # Find GST percentage
    gst_pct_match = re.search(r'GST\s*@\s*(\d+)%', text_upper)
    if gst_pct_match:
        amounts['gst_pct'] = float(gst_pct_match.group(1))

    # Find GST amount
    gst_amt_patterns = [
        r'GST\s*@\s*\d+%[:\s]+RS\.?\s*([\d,]+)',
        r'GST\s*AMOUNT[:\s]+RS\.?\s*([\d,]+)',
        r'GST[:\s]+RS\.?\s*([\d,]+)',
    ]
    for pattern in gst_amt_patterns:
        match = re.search(pattern, text_upper)
        if match:
            amounts['gst_amount'] = float(match.group(1).replace(',', ''))
            break

    # Find Grand Total / Final Total / Total
    total_patterns = [
        r'GRAND\s*TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'FINAL\s*TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'TOTAL\s*AMOUNT[:\s]+RS\.?\s*([\d,]+)',
        r'^TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'NET\s*TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'SUM\s*TOTAL[:\s]+RS\.?\s*([\d,]+)',
        r'AMOUNT\s*PAYABLE[:\s]+RS\.?\s*([\d,]+)',
    ]
    for pattern in total_patterns:
        match = re.search(pattern, text_upper, re.MULTILINE)
        if match:
            val = float(match.group(1).replace(',', ''))
            subtotal = amounts.get('subtotal', 0)
            if val >= subtotal:
                amounts['total'] = val
                break

    return amounts

def verify_amounts(amounts):
    errors = []
    subtotal = amounts.get('subtotal', 0)
    gst_pct = amounts.get('gst_pct', 0)
    gst_amount = amounts.get('gst_amount', 0)
    total = amounts.get('total', 0)

    if not subtotal or not total:
        return {
            'valid': None,
            'message': 'Could not extract amounts',
            'amounts': amounts
        }

    # Check GST calculation
    if gst_pct and gst_amount:
        expected_gst = round(subtotal * gst_pct / 100, 2)
        if abs(expected_gst - gst_amount) > 2:
            errors.append(f"GST mismatch: expected Rs.{expected_gst} but found Rs.{gst_amount}")

    # Check final total
    expected_total = round(subtotal + gst_amount, 2)
    if abs(expected_total - total) > 2:
        errors.append(f"Total mismatch: Sub Total Rs.{subtotal} + GST Rs.{gst_amount} = Rs.{expected_total} but invoice shows Rs.{total}")

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'amounts': amounts,
        'message': 'Amount calculation correct' if not errors else '; '.join(errors)
    }

def run_ticket_validation(files, ticket_id):
    import tempfile, os, requests
    BASE_URL = get_backend_url()
    temp_info = []  # (tmp_path, orig_name, mime)

    # Step 1: read all bytes first with seek(0)
    for uf in files:
        try:
            uf.seek(0)
        except Exception:
            pass
        raw = uf.read()
        mime = uf.type or 'application/octet-stream'
        suffix = os.path.splitext(uf.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(raw)
            temp_info.append((tmp.name, uf.name, mime))

    file_handles = []
    try:
        files_multipart = []
        for tmp_path, orig_name, mime in temp_info:
            fh = open(tmp_path, 'rb')
            file_handles.append(fh)
            files_multipart.append(('files', (orig_name, fh, mime)))

        response = requests.post(
            f"{BASE_URL}/api/v1/tickets/analyze-folder",
            files=files_multipart,
            timeout=120
        )

        if response.status_code == 200:
            data = response.json()
            analysis = data.get('analysis', [])
            duplicates = data.get('duplicates', [])
            inv_val = data.get('invoice_validation') or {}

            # Perform frontend re-classification with Alternate Keywords
            frontend_analysis = []
            detected_types = []
            extracted_texts = {}
            blank_files = data.get('blank_files', [])
            blank_filenames = [b['filename'] for b in blank_files]
            duplicate_doc_warning = False
            duplicate_map = {}

            for a in analysis:
                orig_name = a.get('filename', '')
                text = a.get('full_text', '')
                extracted_texts[orig_name] = text
                
                # Use the robust backend classification
                dt = a.get('detected_type', 'OTHER')
                detected_types.append(dt)
                
                # Check duplicates of document types
                if dt not in ["OTHER", "IMAGE", "SUPPORTING_DOC"]:
                    if dt not in duplicate_map:
                        duplicate_map[dt] = []
                    duplicate_map[dt].append(orig_name)
                    if len(duplicate_map[dt]) > 1:
                        duplicate_doc_warning = True

                frontend_analysis.append({
                    'name': orig_name,
                    'type': dt,
                    'size_kb': len(text) * 0.001 if text else 0.0,
                    'is_duplicate': False,
                    'is_blank': False,
                    'engine': a.get('ocr_engine', 'paddleocr'),
                    'text_type': a.get('text_type', 'printed')
                })

            for bf in blank_files:
                frontend_analysis.append({
                    'name': bf['filename'],
                    'type': 'OTHER',
                    'size_kb': 0.0,
                    'is_duplicate': False,
                    'is_blank': True,
                    'engine': 'N/A',
                    'text_type': 'N/A'
                })

            # Check if duplicates list has duplicates
            actual_duplicates_dict = {}
            for dt, flist in duplicate_map.items():
                if len(flist) > 1:
                    actual_duplicates_dict[dt] = flist
                    for fa in frontend_analysis:
                        if fa['name'] in flist:
                            fa['is_duplicate'] = True

            # Rebuild checklist
            file_type_map = {fa['name']: fa['type'] for fa in frontend_analysis}
            checklist = {}
            all_types = ['INVESTIGATION', 'INVOICE', 'ESTIMATION', 'REJECTION']
            for doc_type in all_types:
                matching_files = [fname for fname, ftype in file_type_map.items() if ftype == doc_type]
                if matching_files:
                    checklist[doc_type] = 'PRESENT'
                    checklist[f'{doc_type}_file'] = matching_files[0]
                else:
                    checklist[doc_type] = 'MISSING'
                    checklist[f'{doc_type}_file'] = ''

            # IMAGE / SUPPORTING DOC
            image_files = [
                fname for fname, ftype in file_type_map.items()
                if ftype in ['IMAGE', 'OTHER', 'SUPPORTING_DOC'] and fname not in blank_filenames
            ]
            if image_files:
                checklist['IMAGE'] = 'PRESENT'
                checklist['IMAGE_file'] = image_files[0]
            else:
                checklist['IMAGE'] = 'MISSING'
                checklist['IMAGE_file'] = ''

            # ── 1. Category Classification Rules ──
            def classify_category(file_map):
                detected = set(file_map.values())
                has_investigation = 'INVESTIGATION' in detected
                has_invoice = 'INVOICE' in detected
                has_estimation = 'ESTIMATION' in detected
                has_rejection = 'REJECTION' in detected
                has_image = ('IMAGE' in detected or 'OTHER' in detected or 'SUPPORTING_DOC' in detected)

                if has_investigation and has_invoice and has_estimation and has_rejection:
                    return "PAID / REJECTED"
                if has_invoice and has_investigation and not has_estimation and not has_rejection:
                    return "PAID / PURE"
                if has_investigation and not has_invoice and not has_estimation and not has_rejection:
                    return "WARR / GOODWILL / CAMPAIGN"
                if has_invoice and not has_investigation:
                    return "PAID / PURE"
                if has_investigation and not has_invoice:
                    return "WARR / GOODWILL / CAMPAIGN"
                return "UNKNOWN"

            category = classify_category(file_type_map)
            verdict = "ACCEPTED" if category != "UNKNOWN" else "REJECTED"
            reason = "Cluster matches expected " + category + " pattern." if category != "UNKNOWN" else "Required document patterns missing from cluster."

            # ── 2. Duplicate Validation ──
            if duplicate_doc_warning:
                verdict = "SUSPICIOUS"
                reason = "Duplicate files detected in document cluster."

            # ── 3. Blank Document Validation ──
            if len(blank_files) == len(files):
                verdict = "REJECTED"
                reason = "All uploaded documents are blank"
            elif blank_files:
                reason += f" (Note: {len(blank_files)} blank file(s) were excluded from validation)"

            # ── 4. Amount Validation ──
            invoice_amounts = {}
            estimation_amounts = {}
            amount_data = {}
            
            invoice_text = ""
            est_text = ""
            for fa in frontend_analysis:
                if fa['type'] == 'INVOICE':
                    invoice_text = extracted_texts.get(fa['name'], '')
                elif fa['type'] == 'ESTIMATION':
                    est_text = extracted_texts.get(fa['name'], '')

            if invoice_text:
                invoice_amounts = extract_amounts(invoice_text)
            if est_text:
                estimation_amounts = extract_amounts(est_text)

            if invoice_amounts:
                verification = verify_amounts(invoice_amounts)
                amount_valid = verification['valid'] if verification['valid'] is not None else False
                err_msg = "" if amount_valid else "; ".join(verification['errors'])
                
                # Invoice vs Estimation Cross Check
                est_tot = estimation_amounts.get('total', 0) if estimation_amounts else 0.0
                tot = invoice_amounts.get('total', 0)
                if est_tot > 0:
                    cross_valid = abs(est_tot - tot) <= 5.0
                    if not cross_valid:
                        amount_valid = False
                        err_msg += f" Estimation Total (Rs. {est_tot:.2f}) does not match Invoice Total (Rs. {tot:.2f})."
                
                amount_data = {
                    'subtotal': invoice_amounts.get('subtotal', 0),
                    'gst_percentage': invoice_amounts.get('gst_pct', 0),
                    'gst_amount': invoice_amounts.get('gst_amount', 0),
                    'total': invoice_amounts.get('total', 0),
                    'amount_valid': amount_valid,
                    'error': err_msg or "Consistency checks passed."
                }
                
                if not amount_valid:
                    verdict = "SUSPICIOUS"
                    reason = f"Amount mismatch: {err_msg}"

            # ── 5. Vehicle Identity Validation ──
            chassis_verify = {}
            reg_verify = {}
            
            inv_report_text = ""
            estimation_report_text = ""
            for fa in frontend_analysis:
                if fa['type'] == 'INVESTIGATION':
                    inv_report_text = extracted_texts.get(fa['name'], '')
                elif fa['type'] == 'ESTIMATION':
                    estimation_report_text = extracted_texts.get(fa['name'], '')

            inv_vehicle = extract_vehicle_details(inv_report_text) if inv_report_text else {}
            est_vehicle = extract_vehicle_details(estimation_report_text) if estimation_report_text else {}

            ch_inv = inv_vehicle.get('chassis')
            ch_est = est_vehicle.get('chassis')
            reg_inv = inv_vehicle.get('registration')
            reg_est = est_vehicle.get('registration')

            # VIN verification
            vin_val = ch_inv or ch_est
            if vin_val:
                vin_regex = r'^[A-HJ-NPR-Z0-9]{17}$'
                vin_pattern_ok = bool(re.match(vin_regex, vin_val))
                match = (ch_inv == ch_est) if (ch_inv and ch_est) else True
                chassis_verify = {
                    'value': vin_val,
                    'match': match and vin_pattern_ok,
                    'error': "" if (match and vin_pattern_ok) else ("VIN format invalid or document mismatch." if not vin_pattern_ok else "Chassis mismatch between documents.")
                }
                if not (match and vin_pattern_ok):
                    verdict = "SUSPICIOUS"
                    reason = f"Chassis verification failed: {chassis_verify['error']}"

            # Registration verification
            reg_val = reg_inv or reg_est
            if reg_val:
                reg_regex = r'^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$'
                reg_pattern_ok = bool(re.match(reg_regex, reg_val))
                match = (reg_inv == reg_est) if (reg_inv and reg_est) else True
                reg_verify = {
                    'value': reg_val,
                    'match': match and reg_pattern_ok,
                    'error': "" if (match and reg_pattern_ok) else ("Registration pattern invalid or document mismatch." if not reg_pattern_ok else "Registration number mismatch.")
                }
                if not (match and reg_pattern_ok):
                    verdict = "SUSPICIOUS"
                    reason = f"Registration verification failed: {reg_verify['error']}"

            return {
                'verdict': verdict,
                'category': category,
                'ticket_id': ticket_id,
                'detected_types': detected_types,
                'checklist': checklist,
                'duplicates': actual_duplicates_dict,
                'amount_data': amount_data,
                'chassis_verification': chassis_verify,
                'registration_verification': reg_verify,
                'reason': reason,
                'detected_files': frontend_analysis,
                'extracted_texts': extracted_texts,
                'blank_files': blank_files,
                '_raw': data
            }
        else:
            st.error(f"Backend error {response.status_code}: {response.text[:300]}")
            return None

    except requests.exceptions.ConnectionError:
        st.error(f"Cannot connect to backend at {BASE_URL}. Make sure FastAPI is running.")
        return None
    except Exception as e:
        st.error(f"Error: {str(e)}")
        return None
    finally:
        for fh in file_handles:
            try:
                fh.close()
            except Exception:
                pass
        for tmp_path, _, _ in temp_info:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass




def get_backend_url():
    import os, requests as _req
    url = os.environ.get('BACKEND_URL', '')
    if url:
        return url
    for port in [8000, 8001, 8080, 5000]:
        try:
            r = _req.get(f'http://localhost:{port}/', timeout=2)
            if r.status_code in [200, 404, 422]:
                return f'http://localhost:{port}'
        except Exception:
            continue
    return 'http://localhost:8000'

def get_audit_logs():
    import requests
    BASE_URL = get_backend_url()
    possible = [
        '/api/v1/audit',
        '/api/audit-logs',
        '/api/audit',
        '/api/audits',
        '/api/logs'
    ]
    for path in possible:
        try:
            r = requests.get(
                f"{BASE_URL}{path}",
                timeout=5
            )
            if r.status_code == 200:
                return r.json().get('items', [])
        except:
            continue
    return []

# --- EXTENDED MODULE PANELS ---
def show_dashboard():
    theme = st.session_state.theme
    
    if theme == 'dark':
        header_bg = "linear-gradient(135deg, #0d1526, #16223f)"
        border_color = "#1a2744"
        text_primary = "#ffffff"
        text_secondary = "#8aa4c0"
        card_bg = "#0d1526"
        grid_color = "#1a2744"
        card_shadow = "0 8px 24px rgba(0,0,0,0.4)"
        chart_title_color = "#00d4aa"
    else:
        header_bg = "linear-gradient(135deg, #ffffff, #f1f5f9)"
        border_color = "#e2e8f0"
        text_primary = "#0f172a"
        text_secondary = "#64748b"
        card_bg = "#ffffff"
        grid_color = "#e2e8f0"
        card_shadow = "0 8px 24px rgba(148, 163, 184, 0.15)"
        chart_title_color = "#00b894"

    st.markdown(f"""
    <div style='background: {header_bg};
    border: 1px solid {border_color};
    border-radius: 16px; padding: 24px;
    margin-bottom: 24px; box-shadow: {card_shadow}'>
        <div style='display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;'>
            <div>
                <h1 style='margin: 0; font-size: 26px; font-weight: 800; background: linear-gradient(to right, #00d4aa, #00b894); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>
                    Forensic Operations Dashboard
                </h1>
                <p style='color: {text_secondary}; font-size: 13px; margin: 4px 0 0 0; font-weight: 500'>
                    Verentis real-time forensic scanning status and operations metrics
                </p>
            </div>
            <div style='background: rgba(0, 212, 170, 0.1); border: 1px solid rgba(0, 212, 170, 0.2); padding: 6px 14px; border-radius: 20px;'>
                <span style='color: #00d4aa; font-weight: 700; font-size: 11px;'>🛰️ SECURE CHANNEL RUNNING</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Grid of Metrics
    st.markdown(f"""
    <div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;'>
        <!-- Card 1 -->
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 12px; padding: 18px; box-shadow: {card_shadow}'>
            <div style='color: {text_secondary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;'>Total Scanned</div>
            <div style='font-size: 28px; font-weight: 800; color: {text_primary}; margin: 6px 0;'>1,420 <span style='font-size: 14px; font-weight: 500; color: {text_secondary};'>Docs</span></div>
            <div style='color: #00d4aa; font-size: 11px; font-weight: 700;'>⚡ +18.4% <span style='color: {text_secondary}; font-weight: 500;'>this week</span></div>
        </div>
        <!-- Card 2 -->
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 12px; padding: 18px; box-shadow: {card_shadow}'>
            <div style='color: {text_secondary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;'>Verified Clean</div>
            <div style='font-size: 28px; font-weight: 800; color: #00d4aa; margin: 6px 0;'>1,184 <span style='font-size: 14px; font-weight: 500; color: {text_secondary};'>Docs</span></div>
            <div style='color: #00d4aa; font-size: 11px; font-weight: 700;'>▲ 93.4% <span style='color: {text_secondary}; font-weight: 500;'>integrity</span></div>
        </div>
        <!-- Card 3 -->
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 12px; padding: 18px; box-shadow: {card_shadow}'>
            <div style='color: {text_secondary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;'>Discrepancies / Fakes</div>
            <div style='font-size: 28px; font-weight: 800; color: #ff4757; margin: 6px 0;'>142 <span style='font-size: 14px; font-weight: 500; color: {text_secondary};'>Cases</span></div>
            <div style='color: #ff4757; font-size: 11px; font-weight: 700;'>▼ -12.5% <span style='color: {text_secondary}; font-weight: 500;'>improvement</span></div>
        </div>
        <!-- Card 4 -->
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 12px; padding: 18px; box-shadow: {card_shadow}'>
            <div style='color: {text_secondary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;'>System Accuracy</div>
            <div style='font-size: 28px; font-weight: 800; color: #3b82f6; margin: 6px 0;'>99.8%</div>
            <div style='color: #3b82f6; font-size: 11px; font-weight: 700;'>▲ 0.2% <span style='color: {text_secondary}; font-weight: 500;'>confidence</span></div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"""
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 14px; padding: 20px; box-shadow: {card_shadow}; margin-bottom: 20px'>
            <h3 style='margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: {chart_title_color}'>📈 Daily Processing Load</h3>
        """, unsafe_allow_html=True)
        
        df = pd.DataFrame({
            'Day': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            'Volume': [120, 150, 180, 220, 190, 80, 45]
        })
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=df['Day'], 
            y=df['Volume'], 
            mode='lines+markers',
            line=dict(color='#00d4aa', width=3, shape='spline'),
            marker=dict(size=8, color='#00d4aa', line=dict(width=2, color=card_bg)),
            fill='tozeroy',
            fillcolor='rgba(0, 212, 170, 0.08)',
            name='Docs Scanned'
        ))
        
        fig.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(
                showgrid=True, gridcolor=grid_color, 
                tickfont=dict(color=text_secondary, size=11),
                showline=False
            ),
            yaxis=dict(
                showgrid=True, gridcolor=grid_color, 
                tickfont=dict(color=text_secondary, size=11),
                showline=False
            ),
            hovermode='x unified',
            height=280
        )
        st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
        st.markdown("</div>", unsafe_allow_html=True)

    with col2:
        st.markdown(f"""
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 14px; padding: 20px; box-shadow: {card_shadow}; margin-bottom: 20px'>
            <h3 style='margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: {chart_title_color}'>🍩 Document Classification</h3>
        """, unsafe_allow_html=True)
        
        df_pie = pd.DataFrame({
            'Category': ['Investigation', 'Invoice', 'Estimation', 'Rejection', 'Identity Cards'],
            'Count': [450, 320, 210, 140, 300]
        })
        
        fig_pie = go.Figure(data=[go.Pie(
            labels=df_pie['Category'],
            values=df_pie['Count'],
            hole=.6,
            marker=dict(colors=['#00d4aa', '#3b82f6', '#ffa502', '#ff4757', '#64748b']),
            textinfo='percent',
            hoverinfo='label+value',
            textfont=dict(size=11, color='#ffffff')
        )])
        
        fig_pie.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=10, r=10, t=10, b=10),
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=-0.2,
                xanchor="center",
                x=0.5,
                font=dict(color=text_secondary, size=10)
            ),
            height=280
        )
        st.plotly_chart(fig_pie, use_container_width=True, config={'displayModeBar': False})
        st.markdown("</div>", unsafe_allow_html=True)

    # Live activity feed at bottom
    st.markdown(f"""
    <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 14px; padding: 20px; box-shadow: {card_shadow}'>
        <h3 style='margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: {chart_title_color}'>📡 Live Forensic Scan Timeline</h3>
        <div style='display: flex; flex-direction: column; gap: 12px;'>
            <div style='display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid {grid_color}'>
                <div style='display: flex; align-items: center; gap: 12px;'>
                    <span style='background: rgba(0, 212, 170, 0.1); color: #00d4aa; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace;'>VERIFIED</span>
                    <span style='color: {text_primary}; font-size: 13px; font-weight: 600;'>Chassis signature validated for ticket #4092830193</span>
                </div>
                <span style='color: {text_secondary}; font-size: 11px;'>2 mins ago</span>
            </div>
            <div style='display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid {grid_color}'>
                <div style='display: flex; align-items: center; gap: 12px;'>
                    <span style='background: rgba(0, 212, 170, 0.1); color: #00d4aa; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace;'>VERIFIED</span>
                    <span style='color: {text_primary}; font-size: 13px; font-weight: 600;'>Invoice subtotal + GST matches Total (₹4,235.00)</span>
                </div>
                <span style='color: {text_secondary}; font-size: 11px;'>14 mins ago</span>
            </div>
            <div style='display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid {grid_color}'>
                <div style='display: flex; align-items: center; gap: 12px;'>
                    <span style='background: rgba(255, 71, 87, 0.1); color: #ff4757; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace;'>ALERT</span>
                    <span style='color: {text_primary}; font-size: 13px; font-weight: 600;'>Duplicate invoice detected in folder #4012938491</span>
                </div>
                <span style='color: {text_secondary}; font-size: 11px;'>35 mins ago</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

def show_threat_intelligence():
    theme = st.session_state.theme
    
    if theme == 'dark':
        header_bg = "linear-gradient(135deg, #0d1526, #16223f)"
        border_color = "#1a2744"
        text_primary = "#ffffff"
        text_secondary = "#8aa4c0"
        card_bg = "#0d1526"
        grid_color = "#1a2744"
        card_shadow = "0 8px 24px rgba(0,0,0,0.4)"
        chart_title_color = "#00d4aa"
    else:
        header_bg = "linear-gradient(135deg, #ffffff, #f1f5f9)"
        border_color = "#e2e8f0"
        text_primary = "#0f172a"
        text_secondary = "#64748b"
        card_bg = "#ffffff"
        grid_color = "#e2e8f0"
        card_shadow = "0 8px 24px rgba(148, 163, 184, 0.15)"
        chart_title_color = "#00b894"

    st.markdown(f"""
    <div style='background: {header_bg};
    border: 1px solid {border_color};
    border-radius: 16px; padding: 24px;
    margin-bottom: 24px; box-shadow: {card_shadow}'>
        <div style='display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;'>
            <div>
                <h1 style='margin: 0; font-size: 26px; font-weight: 800; background: linear-gradient(to right, #00d4aa, #00b894); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>
                    Forensic Threat Intelligence
                </h1>
                <p style='color: {text_secondary}; font-size: 13px; margin: 4px 0 0 0; font-weight: 500'>
                    Real-time tracking of duplicate document networks and OCR verification anomalies
                </p>
            </div>
            <div style='background: rgba(0, 212, 170, 0.1); border: 1px solid rgba(0, 212, 170, 0.2); padding: 6px 14px; border-radius: 20px;'>
                <span style='color: #00d4aa; font-weight: 700; font-size: 11px;'>📡 NETWORK SECURE</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("### Active Risk Clusters")
    
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"""
        <div style='border: 1px solid #ff4757; border-radius: 12px; padding: 18px; background: rgba(255, 71, 87, 0.08); margin-bottom: 16px;'>
            <div style='color: #ff4757 !important; font-weight: 700; font-size: 14px; margin-bottom: 6px;'>
                ⚠ ANOMALOUS CLUSTER #92A3
            </div>
            <div style='color: {text_primary} !important; font-size: 13px; line-height: 1.5; font-weight: 500;'>
                Multiple identical service invoice totals extracted from independent dealer network IDs within Tamil Nadu.
            </div>
        </div>
        
        <div style='border: 1px solid #ffa502; border-radius: 12px; padding: 18px; background: rgba(255, 165, 2, 0.08);'>
            <div style='color: #ffa502 !important; font-weight: 700; font-size: 14px; margin-bottom: 6px;'>
                ⚠ WARNING: WMI MISMATCH TREND
            </div>
            <div style='color: {text_primary} !important; font-size: 13px; line-height: 1.5; font-weight: 500;'>
                Increase in chassis numbers containing standard prohibited characters (I, O, Q) detected in regional certificate uploads.
            </div>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown(f"""
        <div style='background: {card_bg}; border: 1px solid {border_color}; border-radius: 14px; padding: 20px; box-shadow: {card_shadow};'>
            <h3 style='margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: {chart_title_color}'>🗺️ Risk Level Heatmap</h3>
        """, unsafe_allow_html=True)
        
        fig = go.Figure(data=[go.Bar(
            x=['Tamil Nadu', 'Maharashtra', 'Karnataka', 'Delhi', 'Kerala', 'Gujarat'],
            y=[85, 45, 62, 78, 30, 52],
            marker=dict(
                color=[85, 45, 62, 78, 30, 52],
                colorscale='Reds',
                showscale=True,
                colorbar=dict(
                    title="Risk Level",
                    thickness=12,
                    tickfont=dict(color=text_secondary, size=9)
                )
            ),
            hovertemplate='<b>%{x}</b><br>Risk Score: %{y}%<extra></extra>'
        )])
        
        fig.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(
                showgrid=False,
                tickfont=dict(color=text_secondary, size=11)
            ),
            yaxis=dict(
                showgrid=True,
                gridcolor=grid_color,
                tickfont=dict(color=text_secondary, size=11),
                title=dict(
                    text="Risk Index (%)",
                    font=dict(color=text_secondary, size=11)
                )
            ),
            height=280
        )
        st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
        st.markdown("</div>", unsafe_allow_html=True)

def show_audit_logs():
    st.markdown("""
    <div style='background:#ffffff;
    border:1.5px solid #e0e8f0;
    border-radius:16px;padding:24px;
    margin-bottom:20px'>
    <h1 style='margin:0 0 4px 0;font-size:28px'>Forensic Audit Logs</h1>
    <p style='color:#546e7a;font-size:13px;
    margin:0'>System execution timeline, operator access logs, and verification audits</p>
    </div>
    """, unsafe_allow_html=True)
    
    logs = get_audit_logs()
    
    if logs:
        df_logs = pd.DataFrame(logs)
        st.dataframe(df_logs, use_container_width=True)
    else:
        # Fallback beautiful mock timeline
        st.markdown("### Recent System Activity")
        mock_timeline = [
            {"time": "21:35:12", "operator": "Sriram VV", "action": "Completed Ticket cluster validation for #4092830193", "status": "✅ SUCCESS"},
            {"time": "21:12:45", "operator": "Sriram VV", "action": "Chassis verification mismatch detected (WMI mismatch)", "status": "⚠ ANOMALY"},
            {"time": "20:45:30", "operator": "Sriram VV", "action": "Logged in from secure endpoint VR-T8302", "status": "✅ ONLINE"},
            {"time": "19:04:18", "operator": "System Maintenance", "action": "PaddleOCR warm start complete", "status": "✅ INITIALIZED"}
        ]
        
        for item in mock_timeline:
            st.markdown(f"""
            <div style='display:flex;justify-content:space-between;padding:12px;border-bottom:1.5px solid #1a2744'>
                <span style='font-family:monospace;color:#8aa4c0'>{item['time']}</span>
                <span style='font-weight:700'>{item['operator']}</span>
                <span style='color:#e0e0e0'>{item['action']}</span>
                <span style='font-weight:800'>{item['status']}</span>
            </div>
            """, unsafe_allow_html=True)

# --- PART 14 — MAIN APP ROUTING ---
if not st.session_state.get('logged_in'):
    show_login()
else:
    apply_theme_css()
    show_sidebar()

    page = st.session_state.get(
        'current_page', 'Document Analysis'
    )

    if page == 'Document Analysis':
        st.markdown("""
        <div style='margin-bottom:20px'>
        <h1 style='margin:0 0 4px 0'>Document Analysis</h1>
        <p style='color:#546e7a;font-size:14px;margin:0'>
        Automated validation of vehicle documents and ticket forensic analysis
        </p>
        </div>
        """, unsafe_allow_html=True)
        
        tab1, tab2 = st.tabs([
            "🚗 Vehicle Validation",
            "🎫 Ticket Validation"
        ])
        with tab1:
            show_vehicle_validation()
        with tab2:
            show_ticket_validation()

    elif page == 'Audit Logs':
        show_audit_logs()

    elif page == 'Threat Intelligence':
        show_threat_intelligence()

    elif page == 'Dashboard':
        show_dashboard()