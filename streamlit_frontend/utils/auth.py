import json
import hashlib
import os
import re
from datetime import datetime

USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users.json")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

def authenticate_user(email, password):
    users = load_users()
    h_password = hash_password(password)
    for user in users:
        if user["email"] == email and user["password"] == h_password:
            return user
    return None

def register_user(name, email, role, password):
    users = load_users()
    if any(u["email"] == email for u in users):
        return False, "Email already registered"
    
    new_user = {
        "name": name,
        "email": email,
        "role": role,
        "password": hash_password(password),
        "created_at": datetime.now().strftime("%Y-%m-%d")
    }
    users.append(new_user)
    save_users(users)
    return True, "Success"

def update_password(email, new_password):
    users = load_users()
    found = False
    for user in users:
        if user["email"] == email:
            user["password"] = hash_password(new_password)
            found = True
            break
    if found:
        save_users(users)
    return found

def validate_password(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search("[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search("[0-9]", password):
        return False, "Password must contain at least one number"
    if not re.search("[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    return True, "Valid"

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# PERSISTENT SESSION LOGIC
SESSION_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "session.json")

def save_session(user_data):
    with open(SESSION_FILE, "w") as f:
        json.dump(user_data, f)

def load_session():
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r") as f:
                return json.load(f)
        except:
            return None
    return None

def sign_out():
    if os.path.exists(SESSION_FILE):
        os.remove(SESSION_FILE)
    
    # Also clear streamlit session state if called
    import streamlit as st
    for key in list(st.session_state.keys()):
        del st.session_state[key]
