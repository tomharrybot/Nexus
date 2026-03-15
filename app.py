import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, jsonify, send_from_directory, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import json
import smtplib
import random
import string
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.utils import secure_filename
import uuid
import time
import base64
import mimetypes
import tempfile
from functools import wraps
from pymongo import MongoClient, errors as mongo_errors

# Pakistan Standard Time (UTC+5) - All timestamps use UTC with Z suffix
# so browsers auto-convert to local (PKT) time correctly
def now_utc():
    """Return current UTC time as ISO string with Z suffix for correct timezone display."""
    return datetime.utcnow().isoformat() + 'Z'

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'nexus-chat-secret-key-2024')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=60, ping_interval=25, async_mode='eventlet')

# Create upload directories
UPLOAD_FOLDER = 'uploads'
for folder in ['images', 'videos', 'audios', 'avatars', 'documents']:
    os.makedirs(os.path.join(UPLOAD_FOLDER, folder), exist_ok=True)

# Data directories
DATA_DIR = 'data'
CONTACTS_DIR = os.path.join(DATA_DIR, 'contacts')
CHATS_DIR = os.path.join(DATA_DIR, 'chats')
GROUPS_DIR = os.path.join(DATA_DIR, 'groups')
BROADCASTS_DIR = os.path.join(DATA_DIR, 'broadcasts')
STARRED_DIR = os.path.join(DATA_DIR, 'starred')
# Added: Statuses directory for Stories feature
STATUSES_DIR = os.path.join(DATA_DIR, 'statuses')

for dir_path in [DATA_DIR, CONTACTS_DIR, CHATS_DIR, GROUPS_DIR, BROADCASTS_DIR, STARRED_DIR, STATUSES_DIR]:
    os.makedirs(dir_path, exist_ok=True)

# Data files
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
OTP_FILE = os.path.join(DATA_DIR, 'otp.json')
BLOCKED_FILE = os.path.join(DATA_DIR, 'blocked.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
# Added: Subscriptions file for Non-Firebase Push Notifications
SUBSCRIPTIONS_FILE = os.path.join(DATA_DIR, 'subscriptions.json')

# =========================================================
# MONGODB CONNECTION
# =========================================================
_mongo_client = None
_mongo_db = None
_json_store = None
_mongo_failed = False   # prevents hammering the server on repeated failures

def get_mongo_store():
    """Get MongoDB json_store collection. Returns None if not configured."""
    global _mongo_client, _mongo_db, _json_store, _mongo_failed
    if _json_store is not None:
        return _json_store
    if _mongo_failed:
        return None
    uri = os.environ.get('MONGODB_URI', '')
    if not uri:
        return None
    try:
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        _mongo_client.admin.command('ping')
        _mongo_db = _mongo_client['nexuschat']
        _json_store = _mongo_db['json_store']
        print("✓ MongoDB connected successfully")
        _migrate_files_to_mongo()
        return _json_store
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}  → falling back to file storage")
        _mongo_failed = True
        return None

def _migrate_files_to_mongo():
    """One-time migration: copy existing JSON files into MongoDB."""
    import glob
    store = _json_store
    if store is None:
        return
    all_files = []
    for fpath in [USERS_FILE, OTP_FILE, BLOCKED_FILE, SETTINGS_FILE, SUBSCRIPTIONS_FILE]:
        all_files.append(fpath)
    for d in [CONTACTS_DIR, CHATS_DIR, GROUPS_DIR, BROADCASTS_DIR, STARRED_DIR, STATUSES_DIR]:
        all_files.extend(glob.glob(os.path.join(d, '*.json')))
    migrated = 0
    for fpath in all_files:
        if not os.path.exists(fpath):
            continue
        # Skip if already in Mongo
        if store.find_one({'_id': fpath}, {'_id': 1}):
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            store.insert_one({'_id': fpath, 'data': data})
            migrated += 1
        except Exception as err:
            print(f"  migration skip {fpath}: {err}")
    if migrated:
        print(f"  Migrated {migrated} files to MongoDB")

# Initialize MongoDB connection at module load
_store = get_mongo_store()

# Online users tracking
online_users = {}
user_sessions = {}

# =========================================================
# STORAGE HELPERS (MongoDB-backed, file-system fallback)
# =========================================================

def load_json(file_path, default=None):
    """Load data from MongoDB (or file fallback). Never crashes."""
    _def = default if default is not None else []
    store = get_mongo_store()
    if store is not None:
        try:
            doc = store.find_one({'_id': file_path})
            return doc['data'] if doc else _def
        except Exception as e:
            print(f"MongoDB load error ({file_path}): {e}")
            return _def
    # ---- file fallback ----
    if not os.path.exists(file_path):
        return _def
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        return json.loads(content) if content else _def
    except (json.JSONDecodeError, ValueError):
        return _def

def save_json(file_path, data):
    """Save data to MongoDB (or file fallback). Atomic."""
    store = get_mongo_store()
    if store is not None:
        try:
            store.replace_one({'_id': file_path}, {'_id': file_path, 'data': data}, upsert=True)
            return
        except Exception as e:
            print(f"MongoDB save error ({file_path}): {e}")
    # ---- file fallback ----
    target_dir = os.path.dirname(os.path.abspath(file_path)) or '.'
    os.makedirs(target_dir, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=target_dir, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, file_path)
    except Exception as e:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise e

def json_exists(file_path):
    """Check if a JSON document exists (in MongoDB or file system)."""
    store = get_mongo_store()
    if store is not None:
        try:
            return store.find_one({'_id': file_path}, {'_id': 1}) is not None
        except Exception:
            pass
    return os.path.exists(file_path)

def json_list_dir(dir_path):
    """List JSON file names in a directory (from MongoDB or file system)."""
    store = get_mongo_store()
    if store is not None:
        try:
            prefix = dir_path.rstrip('/') + '/'
            docs = store.find({'_id': {'$regex': f'^{prefix}[^/]+\\.json$'}}, {'_id': 1})
            return [os.path.basename(d['_id']) for d in docs]
        except Exception as e:
            print(f"MongoDB list_dir error: {e}")
    if os.path.isdir(dir_path):
        return [f for f in os.listdir(dir_path) if f.endswith('.json')]
    return []

# Initialize data files (no-ops when MongoDB is active)
def init_json_file(file_path, default_data):
    if not json_exists(file_path):
        save_json(file_path, default_data)

init_json_file(USERS_FILE, [])
init_json_file(OTP_FILE, {})
init_json_file(BLOCKED_FILE, {})
init_json_file(SETTINGS_FILE, {})
init_json_file(SUBSCRIPTIONS_FILE, {})

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def send_email_otp(to_email, otp):
    try:
        sender_email = os.environ.get("MAIL_USERNAME")
        sender_password = os.environ.get("MAIL_PASSWORD")

        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to_email
        msg['Subject'] = "Nexus Chat Verification Code"

        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #7C3AED; border-radius: 10px;">
            <h2 style="color: #7C3AED; text-align: center;">Nexus Chat Verification</h2>
            <p style="color: #333;">Your verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #7C3AED; padding: 15px 25px; background: #f0f0f0; border-radius: 8px;">{otp}</span>
            </div>
            <p style="color: #666;">Use this code to verify your account. This code will expire in 10 minutes.</p>
            <hr style="border: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this code, please ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP('smtp-relay.brevo.com', 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(sender_email, sender_password)
            server.send_message(msg)

        print(f"OTP email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Brevo Email error: {e}")
        return False

def send_login_alert(to_email, ip_address, device_info):
    try:
        sender_email = os.environ.get("MAIL_USERNAME")
        sender_password = os.environ.get("MAIL_PASSWORD")

        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to_email
        msg['Subject'] = "Security Alert: New Login to Nexus Chat"

        html = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #EF4444; border-radius: 10px;">
            <h2 style="color: #EF4444; text-align: center;">New Login Detected</h2>
            <p>Welcome back to Nexus Chat! We noticed a new login to your account.</p>
            <p><strong>Device/Browser:</strong> {device_info}</p>
            <p><strong>Location/IP:</strong> {ip_address}</p>
            <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>If this was you, you can ignore this email. If not, please secure your account immediately.</p>
        </div>
        """
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP('smtp-relay.brevo.com', 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(sender_email, sender_password)
            server.send_message(msg)
    except Exception as e:
        print(f"Brevo Login alert email error: {e}")

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'doc', 'docx', 'txt', 'zip'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        return 'image'
    elif ext in ['mp4', 'webm', 'mov', 'avi']:
        return 'video'
    elif ext in ['mp3', 'wav', 'ogg', 'm4a']:
        return 'audio'
    else:
        return 'file'

def get_avatar_url(email):
    users = load_json(USERS_FILE)
    user = next((u for u in users if u['email'] == email), None)
    if user and user.get('profile', {}).get('avatar'):
        return user['profile']['avatar']
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237C3AED'%3E%3Cpath d='M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-6.627 0-12 5.373-12 12h24c0-6.627-5.373-12-12-12z'/%3E%3C/svg%3E"

def get_user_by_email(email):
    users = load_json(USERS_FILE)
    return next((u for u in users if u['email'] == email), None)

def update_user_online_status(email, online):
    timestamp = now_utc()

    users = load_json(USERS_FILE)
    for user in users:
        if user['email'] == email:
            if 'profile' not in user:
                user['profile'] = {}
            user['profile']['lastSeen'] = timestamp
            break
    save_json(USERS_FILE, users)

    socketio.emit('user-status-updated', {
        'email': email,
        'online': online,
        'lastSeen': None if online else timestamp
    })

def create_chat_id(user1, user2):
    return '_'.join(sorted([user1, user2]))

def get_chat_messages(chat_id):
    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if json_exists(chat_file):
        return load_json(chat_file).get('messages', [])
    return []

def save_chat_message(chat_id, message):
    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")
    chat = {'messages': []}
    if json_exists(chat_file):
        chat = load_json(chat_file)
    chat['messages'].append(message)
    save_json(chat_file, chat)

def format_message_preview(message):
    if message['type'] == 'text':
        return message['message'][:50] + ('...' if len(message['message']) > 50 else '')
    elif message['type'] == 'image':
        return '📷 Photo'
    elif message['type'] == 'video':
        return '🎥 Video'
    elif message['type'] == 'audio':
        return '🎵 Audio'
    elif message['type'] == 'voice':
        return '🎤 Voice message'
    else:
        return '📄 File'

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# Auth Routes
@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    email = data.get('email')

    if not email:
        return jsonify({'status': 'error', 'msg': 'Email required'})

    otp = generate_otp()

    if send_email_otp(email, otp):
        otps = load_json(OTP_FILE, {})
        otps[email] = {
            'code': otp,
            'expires': (datetime.utcnow() + timedelta(minutes=10)).isoformat()
        }
        save_json(OTP_FILE, otps)
        return jsonify({'status': 'ok', 'msg': 'OTP sent successfully'})
    else:
        return jsonify({'status': 'error', 'msg': 'Failed to send OTP. Please try again.'})

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    username = data.get('username', '')

    otps = load_json(OTP_FILE, {})

    if email not in otps:
        return jsonify({'status': 'error', 'msg': 'OTP not found or expired'})

    otp_data = otps[email]
    if otp_data['code'] != code:
        return jsonify({'status': 'error', 'msg': 'Invalid OTP'})

    if datetime.fromisoformat(otp_data['expires']) < datetime.utcnow():
        del otps[email]
        save_json(OTP_FILE, otps)
        return jsonify({'status': 'error', 'msg': 'OTP expired'})

    del otps[email]
    save_json(OTP_FILE, otps)

    users = load_json(USERS_FILE)
    user = next((u for u in users if u['email'] == email), None)

    if not user:
        user = {
            'email': email,
            'username': username or email.split('@')[0],
            'id': str(uuid.uuid4()),
            'createdAt': now_utc(),
            'profile': {
                'name': username or email.split('@')[0],
                'about': 'Hey there! I\'m using Nexus Chat',
                'avatar': get_avatar_url(email),
                'lastSeen': now_utc()
            },
            'settings': {
                'theme': 'dark',
                'notifications': True,
                'sound': True,
                'vibration': True,
                'preview': True
            }
        }
        users.append(user)
        save_json(USERS_FILE, users)

        contacts_file = os.path.join(CONTACTS_DIR, f"{email}.json")
        if not json_exists(contacts_file):
            save_json(contacts_file, [])

    # Added: Security Check & Multi-device handling
    user_ip = request.remote_addr
    user_agent = request.headers.get('User-Agent', 'Unknown Browser')

    if email in online_users:
        existing_sid = online_users[email]
        socketio.emit('security-alert', {
            'msg': 'New login detected from another device.',
            'ip': user_ip,
            'agent': user_agent
        }, room=existing_sid)

    # Send email notification about login
    send_login_alert(email, user_ip, user_agent)

    session['user'] = user
    session.permanent = True

    return jsonify({'status': 'ok', 'msg': 'Verified', 'user': user})

@app.route('/logout', methods=['POST'])
def logout():
    data = request.json
    email = data.get('email')

    if email:
        if email in online_users:
            del online_users[email]

        update_user_online_status(email, False)

        for sid, user_email in list(user_sessions.items()):
            if user_email == email:
                del user_sessions[sid]

    session.clear()

    return jsonify({'status': 'ok', 'msg': 'Logged out'})

# Profile Routes
@app.route('/update-profile', methods=['POST'])
def update_profile():
    data = request.json
    email = data.get('email')
    name = data.get('name')
    about = data.get('about')
    avatar = data.get('avatar')

    users = load_json(USERS_FILE)
    user = None

    # Reject base64 DataURLs - they bloat the JSON file (can be 100KB+ per user)
    if avatar and avatar.startswith('data:'):
        avatar = None

    for u in users:
        if u['email'] == email:
            if 'profile' not in u:
                u['profile'] = {}
            if name:
                u['profile']['name'] = name
            if about:
                u['profile']['about'] = about
            if avatar:
                u['profile']['avatar'] = avatar
            user = u
            break

    save_json(USERS_FILE, users)

    # Update in contacts
    for filename in json_list_dir(CONTACTS_DIR):
        if filename.endswith('.json'):
            contacts_file = os.path.join(CONTACTS_DIR, filename)
            contacts = load_json(contacts_file)
            updated = False
            for contact in contacts:
                if contact['email'] == email:
                    if name:
                        contact['name'] = name
                    if about:
                        contact['about'] = about
                    if avatar:
                        contact['avatar'] = avatar
                    updated = True
            if updated:
                save_json(contacts_file, contacts)

    # Notify all connected clients
    socketio.emit('profile-updated', {
        'email': email,
        'profile': user['profile'] if user else {}
    })

    return jsonify({'status': 'ok', 'user': user})

@app.route('/upload-avatar', methods=['POST'])
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({'status': 'error', 'msg': 'No file uploaded'})

    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'status': 'error', 'msg': 'No file selected'})

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, 'avatars', filename)
        file.save(filepath)

        return jsonify({
            'status': 'ok',
            'avatarUrl': f'/uploads/avatars/{filename}'
        })

    return jsonify({'status': 'error', 'msg': 'Invalid file type'})

# Contact Routes
@app.route('/users', methods=['GET'])
def get_users():
    users = load_json(USERS_FILE)
    result = []
    for user in users:
        result.append({
            'email': user['email'],
            'username': user.get('username', ''),
            'profile': user.get('profile', {}),
            'online': user['email'] in online_users
        })
    return jsonify(result)

@app.route('/contacts/<email>', methods=['GET'])
def get_contacts(email):
    contacts_file = os.path.join(CONTACTS_DIR, f"{email}.json")

    if not json_exists(contacts_file):
        return jsonify([])

    contacts = load_json(contacts_file)
    result = []

    # Load users data once outside the loop for efficiency
    users_data = load_json(USERS_FILE)
    users_by_email = {u['email']: u for u in users_data}

    for contact in contacts:
        online = contact['email'] in online_users

        chat_id = create_chat_id(email, contact['email'])
        chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

        last_message = 'No messages yet'
        last_time = ''
        unread_count = 0

        if json_exists(chat_file):
            chat = load_json(chat_file)
            if chat.get('messages'):
                last_msg = chat['messages'][-1]
                last_message = format_message_preview(last_msg)
                last_time = last_msg['timestamp']
                unread_count = sum(1 for m in chat['messages'] 
                                 if m['from'] == contact['email'] and m.get('status') != 'seen')

        # Get lastSeen from users data
        contact_user_data = users_by_email.get(contact['email'])
        last_seen = None
        if contact_user_data and contact_user_data.get('profile', {}).get('lastSeen'):
            last_seen = contact_user_data['profile']['lastSeen']

        result.append({
            **contact,
            'online': online,
            'lastMessage': last_message,
            'lastTime': last_time,
            'unreadCount': unread_count,
            'typing': False,
            'lastSeen': last_seen
        })

    return jsonify(result)

@app.route('/add-contact', methods=['POST'])
def add_contact():
    data = request.json
    user_email = data.get('userEmail')
    contact_email = data.get('contactEmail')

    if not user_email or not contact_email:
        return jsonify({'status': 'error', 'msg': 'Emails required'})

    if user_email == contact_email:
        return jsonify({'status': 'error', 'msg': 'Cannot add yourself'})

    users = load_json(USERS_FILE)
    contact_user = next((u for u in users if u['email'] == contact_email), None)

    if not contact_user:
        return jsonify({'status': 'error', 'msg': 'User not found'})

    contacts_file = os.path.join(CONTACTS_DIR, f"{user_email}.json")
    contacts = load_json(contacts_file)

    if any(c['email'] == contact_email for c in contacts):
        return jsonify({'status': 'error', 'msg': 'Contact already exists'})

    new_contact = {
        'email': contact_email,
        'name': contact_user['profile'].get('name', contact_user['username']),
        'avatar': get_avatar_url(contact_email),
        'about': contact_user['profile'].get('about', 'Hey there!'),
        'addedAt': now_utc()
    }

    contacts.append(new_contact)
    save_json(contacts_file, contacts)

    return jsonify({'status': 'ok', 'contact': new_contact})

@app.route('/delete-contact', methods=['POST'])
def delete_contact():
    data = request.json
    user_email = data.get('userEmail')
    contact_email = data.get('contactEmail')

    contacts_file = os.path.join(CONTACTS_DIR, f"{user_email}.json")

    if json_exists(contacts_file):
        contacts = load_json(contacts_file)
        contacts = [c for c in contacts if c['email'] != contact_email]
        save_json(contacts_file, contacts)

    return jsonify({'status': 'ok', 'msg': 'Contact deleted'})

# Chat Routes
@app.route('/get-chat', methods=['POST'])
def get_chat():
    data = request.json
    user1 = data.get('user1')
    user2 = data.get('user2')

    chat_id = create_chat_id(user1, user2)
    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)
    else:
        chat = {'messages': []}
        save_json(chat_file, chat)

    return jsonify(chat)

# Added: Clear Chat API to permanently delete messages
@app.route('/clear-chat', methods=['POST'])
def clear_chat():
    data = request.json
    user_email = data.get('userEmail')
    contact_email = data.get('contactEmail')

    chat_id = create_chat_id(user_email, contact_email)
    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        # Empty the messages array permanently
        save_json(chat_file, {'messages': []})

        # Notify if the other user is online
        if contact_email in online_users:
            socketio.emit('chat-cleared', {'chatId': chat_id}, room=online_users[contact_email])

    return jsonify({'status': 'ok', 'msg': 'Chat permanently cleared'})

@app.route('/send-message', methods=['POST'])
def send_message():
    data = request.json
    from_email = data.get('from')
    to_email = data.get('to')
    message = data.get('message')
    msg_type = data.get('type', 'text')
    reply_to = data.get('replyTo')
    duration = data.get('duration')
    file_name = data.get('fileName')
    file_size = data.get('fileSize')

    # Added: Check if user is blocked before sending message
    blocked = load_json(BLOCKED_FILE, {})
    if to_email in blocked.get(from_email, []) or from_email in blocked.get(to_email, []):
        return jsonify({'status': 'error', 'msg': 'Cannot send message. User blocked.'})

    message_id = str(uuid.uuid4())
    timestamp = now_utc()

    new_message = {
        'id': message_id,
        'from': from_email,
        'to': to_email,
        'message': message,
        'type': msg_type,
        'timestamp': timestamp,
        'status': 'sent'
    }

    if reply_to:
        new_message['replyTo'] = reply_to

    if duration:
        new_message['duration'] = duration

    if file_name:
        new_message['fileName'] = file_name

    if file_size:
        new_message['fileSize'] = file_size

    chat_id = create_chat_id(from_email, to_email)
    save_chat_message(chat_id, new_message)

    # Update contact's last message
    contacts_file = os.path.join(CONTACTS_DIR, f"{from_email}.json")
    if json_exists(contacts_file):
        contacts = load_json(contacts_file)
        for contact in contacts:
            if contact['email'] == to_email:
                contact['lastMessage'] = format_message_preview(new_message)
                contact['lastTime'] = timestamp
                break
        save_json(contacts_file, contacts)

    # Auto-add contact if not exists
    contacts_file_to = os.path.join(CONTACTS_DIR, f"{to_email}.json")
    if json_exists(contacts_file_to):
        contacts_to = load_json(contacts_file_to)
        if not any(c['email'] == from_email for c in contacts_to):
            from_user = get_user_by_email(from_email)
            if from_user:
                new_contact = {
                    'email': from_email,
                    'name': from_user['profile'].get('name', from_user['username']),
                    'avatar': get_avatar_url(from_email),
                    'about': from_user['profile'].get('about', 'Hey there!'),
                    'addedAt': timestamp
                }
                contacts_to.append(new_contact)
                save_json(contacts_file_to, contacts_to)

    # Send real-time update
    if to_email in online_users:
        socketio.emit('new-message', new_message, room=online_users[to_email])

        # Update status to delivered
        new_message['status'] = 'delivered'
        socketio.emit('message-status-updated', {
            'messageId': message_id,
            'status': 'delivered'
        }, room=online_users[from_email] if from_email in online_users else None)

    return jsonify({'status': 'ok', 'message': new_message})

@app.route('/upload-file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'msg': 'No file uploaded'})

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'msg': 'No file selected'})

    if file and allowed_file(file.filename):
        file_type = get_file_type(file.filename)
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4()}.{ext}"

        folder_map = {
            'image': 'images',
            'video': 'videos',
            'audio': 'audios',
            'file': 'documents'
        }

        filepath = os.path.join(UPLOAD_FOLDER, folder_map[file_type], filename)
        file.save(filepath)

        return jsonify({
            'status': 'ok',
            'fileUrl': f'/uploads/{folder_map[file_type]}/{filename}',
            'fileName': file.filename,
            'fileSize': os.path.getsize(filepath),
            'fileType': file_type
        })

    return jsonify({'status': 'error', 'msg': 'Invalid file type'})

@app.route('/upload-voice', methods=['POST'])
def upload_voice():
    if 'audio' not in request.files:
        return jsonify({'status': 'error', 'msg': 'No audio file uploaded'})

    file = request.files['audio']
    if file.filename == '':
        return jsonify({'status': 'error', 'msg': 'No file selected'})

    # Preserve the actual file extension (.webm, .ogg, .mp4, etc.)
    original_name = file.filename or ''
    if '.' in original_name:
        ext = '.' + original_name.rsplit('.', 1)[1].lower()
    elif file.content_type and 'ogg' in file.content_type:
        ext = '.ogg'
    elif file.content_type and 'mp4' in file.content_type:
        ext = '.mp4'
    else:
        ext = '.webm'
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, 'audios', filename)
    file.save(filepath)

    duration = request.form.get('duration', '0:00')

    return jsonify({
        'status': 'ok',
        'fileUrl': f'/uploads/audios/{filename}',
        'duration': duration,
        'fileSize': os.path.getsize(filepath)
    })

@app.route('/mark-messages-seen', methods=['POST'])
def mark_messages_seen():
    data = request.json
    user_email = data.get('userEmail')
    contact_email = data.get('contactEmail')

    chat_id = create_chat_id(user_email, contact_email)
    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)
        updated = False

        for message in chat['messages']:
            if message['from'] == contact_email and message.get('status') != 'seen':
                message['status'] = 'seen'
                updated = True

                if contact_email in online_users:
                    socketio.emit('message-status-updated', {
                        'messageId': message['id'],
                        'status': 'seen'
                    }, room=online_users[contact_email])

        if updated:
            save_json(chat_file, chat)

            # Update unread count in contacts
            contacts_file = os.path.join(CONTACTS_DIR, f"{user_email}.json")
            if json_exists(contacts_file):
                contacts = load_json(contacts_file)
                for contact in contacts:
                    if contact['email'] == contact_email:
                        contact['unreadCount'] = 0
                        break
                save_json(contacts_file, contacts)

    return jsonify({'status': 'ok'})

@app.route('/delete-message', methods=['POST'])
def delete_message():
    data = request.json
    chat_id = data.get('chatId')
    message_id = data.get('messageId')
    user_email = data.get('userEmail')

    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)

        for message in chat['messages']:
            if message['id'] == message_id and message['from'] == user_email:
                message['deleted'] = True
                message['message'] = 'This message was deleted'
                break

        save_json(chat_file, chat)

        # Notify other user
        other_email = chat_id.split('_')[0] if chat_id.split('_')[0] != user_email else chat_id.split('_')[1]
        if other_email in online_users:
            socketio.emit('message-deleted', {
                'messageId': message_id,
                'chatId': chat_id
            }, room=online_users[other_email])

    return jsonify({'status': 'ok'})

@app.route('/edit-message', methods=['POST'])
def edit_message():
    data = request.json
    chat_id = data.get('chatId')
    message_id = data.get('messageId')
    user_email = data.get('userEmail')
    new_message = data.get('newMessage')

    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)

        for message in chat['messages']:
            if message['id'] == message_id and message['from'] == user_email:
                message['message'] = new_message
                message['edited'] = True
                message['editedAt'] = now_utc()
                break

        save_json(chat_file, chat)

        # Notify other user
        other_email = chat_id.split('_')[0] if chat_id.split('_')[0] != user_email else chat_id.split('_')[1]
        if other_email in online_users:
            socketio.emit('message-edited', {
                'messageId': message_id,
                'chatId': chat_id,
                'newMessage': new_message
            }, room=online_users[other_email])

    return jsonify({'status': 'ok'})

@app.route('/add-reaction', methods=['POST'])
def add_reaction():
    data = request.json
    chat_id = data.get('chatId')
    message_id = data.get('messageId')
    user_email = data.get('userEmail')
    reaction = data.get('reaction')

    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)

        for message in chat['messages']:
            if message['id'] == message_id:
                if 'reactions' not in message:
                    message['reactions'] = []

                # Check if user already reacted
                existing = next((r for r in message['reactions'] if r['user'] == user_email), None)

                if existing:
                    if existing['reaction'] == reaction:
                        message['reactions'].remove(existing)
                    else:
                        existing['reaction'] = reaction
                else:
                    message['reactions'].append({
                        'user': user_email,
                        'reaction': reaction
                    })

                break

        save_json(chat_file, chat)

        # Notify other user
        other_email = chat_id.split('_')[0] if chat_id.split('_')[0] != user_email else chat_id.split('_')[1]
        if other_email in online_users:
            socketio.emit('message-reaction', {
                'messageId': message_id,
                'chatId': chat_id,
                'reactions': message.get('reactions', [])
            }, room=online_users[other_email])

    return jsonify({'status': 'ok'})

@app.route('/star-message', methods=['POST'])
def star_message():
    data = request.json
    user_email = data.get('userEmail')
    message_id = data.get('messageId')
    chat_id = data.get('chatId')

    starred_file = os.path.join(STARRED_DIR, f"{user_email}.json")
    starred = load_json(starred_file)

    if message_id not in starred:
        starred.append({
            'messageId': message_id,
            'chatId': chat_id,
            'starredAt': now_utc()
        })
        save_json(starred_file, starred)

    return jsonify({'status': 'ok'})

@app.route('/search-messages', methods=['POST'])
def search_messages():
    data = request.json
    chat_id = data.get('chatId')
    query = data.get('query')

    chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

    if not json_exists(chat_file):
        return jsonify({'messages': []})

    chat = load_json(chat_file)
    results = []

    for message in chat['messages']:
        if message['type'] == 'text' and query.lower() in message['message'].lower():
            results.append(message)

    return jsonify({'messages': results})

# Group Routes
@app.route('/create-group', methods=['POST'])
def create_group():
    data = request.json
    creator_email = data.get('creatorEmail')
    group_name = data.get('groupName')
    members = data.get('members', [])
    avatar = data.get('groupAvatar')

    group_id = f"group_{uuid.uuid4().hex[:8]}"

    group = {
        'id': group_id,
        'name': group_name,
        'avatar': avatar or "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237C3AED'%3E%3Cpath d='M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E",
        'creator': creator_email,
        'admins': [creator_email],
        'members': [creator_email] + members,
        'createdAt': now_utc(),
        'lastMessage': None,
        'lastMessageTime': None
    }

    group_file = os.path.join(GROUPS_DIR, f"{group_id}.json")
    save_json(group_file, group)

    chat_file = os.path.join(CHATS_DIR, f"{group_id}.json")
    save_json(chat_file, {'messages': [], 'groupId': group_id, 'type': 'group'})

    return jsonify({'status': 'ok', 'group': group})

@app.route('/send-group-message', methods=['POST'])
def send_group_message():
    data = request.json
    group_id = data.get('groupId')
    from_email = data.get('from')
    message = data.get('message')
    msg_type = data.get('type', 'text')
    reply_to = data.get('replyTo')
    duration = data.get('duration')

    message_id = str(uuid.uuid4())
    timestamp = now_utc()

    new_message = {
        'id': message_id,
        'from': from_email,
        'groupId': group_id,
        'message': message,
        'type': msg_type,
        'timestamp': timestamp,
        'status': 'sent'
    }

    if reply_to:
        new_message['replyTo'] = reply_to

    if duration:
        new_message['duration'] = duration

    chat_file = os.path.join(CHATS_DIR, f"{group_id}.json")
    chat = load_json(chat_file, {'messages': []})
    chat['messages'].append(new_message)
    save_json(chat_file, chat)

    group_file = os.path.join(GROUPS_DIR, f"{group_id}.json")
    if json_exists(group_file):
        group = load_json(group_file)
        group['lastMessage'] = format_message_preview(new_message)
        group['lastMessageTime'] = timestamp
        save_json(group_file, group)

        for member in group['members']:
            if member != from_email and member in online_users:
                socketio.emit('new-group-message', new_message, room=online_users[member])

    return jsonify({'status': 'ok', 'message': new_message})

@app.route('/get-group-chat', methods=['POST'])
def get_group_chat():
    data = request.json
    group_id = data.get('groupId')

    chat_file = os.path.join(CHATS_DIR, f"{group_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)
    else:
        chat = {'messages': []}

    return jsonify(chat)

@app.route('/user-groups/<email>', methods=['GET'])
def user_groups(email):
    groups = []

    for filename in json_list_dir(GROUPS_DIR):
        if filename.endswith('.json'):
            group = load_json(os.path.join(GROUPS_DIR, filename))
            if email in group['members']:
                groups.append(group)

    return jsonify(groups)

@app.route('/update-group-avatar', methods=['POST'])
def update_group_avatar():
    if 'avatar' not in request.files:
        return jsonify({'status': 'error', 'msg': 'No file uploaded'})
    group_id = request.form.get('groupId')
    if not group_id:
        return jsonify({'status': 'error', 'msg': 'Group ID required'})
    file = request.files['avatar']
    ext = os.path.splitext(secure_filename(file.filename))[1] or '.jpg'
    filename = f"group_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, 'avatars', filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    file.save(filepath)
    avatar_url = f'/uploads/avatars/{filename}'
    group_file = os.path.join(GROUPS_DIR, f"{group_id}.json")
    if json_exists(group_file):
        group = load_json(group_file)
        group['avatar'] = avatar_url
        save_json(group_file, group)
    return jsonify({'status': 'ok', 'avatarUrl': avatar_url})

# Broadcast Routes
@app.route('/create-broadcast', methods=['POST'])
def create_broadcast():
    data = request.json
    creator_email = data.get('creatorEmail')
    name = data.get('name')
    members = data.get('members', [])

    broadcast_id = f"broadcast_{uuid.uuid4().hex[:8]}"

    broadcast = {
        'id': broadcast_id,
        'name': name,
        'creator': creator_email,
        'members': members,
        'createdAt': now_utc(),
        'lastMessage': None,
        'lastMessageTime': None,
        'avatar': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237C3AED'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z'/%3E%3C/svg%3E"
    }

    broadcast_file = os.path.join(BROADCASTS_DIR, f"{broadcast_id}.json")
    save_json(broadcast_file, broadcast)

    chat_file = os.path.join(CHATS_DIR, f"{broadcast_id}.json")
    save_json(chat_file, {'messages': [], 'broadcastId': broadcast_id, 'type': 'broadcast'})

    return jsonify({'status': 'ok', 'broadcast': broadcast})

@app.route('/send-broadcast', methods=['POST'])
def send_broadcast():
    data = request.json
    broadcast_id = data.get('broadcastId')
    from_email = data.get('from')
    message = data.get('message')
    msg_type = data.get('type', 'text')

    message_id = str(uuid.uuid4())
    timestamp = now_utc()

    new_message = {
        'id': message_id,
        'from': from_email,
        'broadcastId': broadcast_id,
        'message': message,
        'type': msg_type,
        'timestamp': timestamp,
        'status': 'sent'
    }

    chat_file = os.path.join(CHATS_DIR, f"{broadcast_id}.json")
    chat = load_json(chat_file, {'messages': []})
    chat['messages'].append(new_message)
    save_json(chat_file, chat)

    broadcast_file = os.path.join(BROADCASTS_DIR, f"{broadcast_id}.json")
    if json_exists(broadcast_file):
        broadcast = load_json(broadcast_file)
        broadcast['lastMessage'] = format_message_preview(new_message)
        broadcast['lastMessageTime'] = timestamp
        save_json(broadcast_file, broadcast)

        for member in broadcast['members']:
            if member != from_email and member in online_users:
                socketio.emit('new-broadcast-message', new_message, room=online_users[member])

    return jsonify({'status': 'ok', 'message': new_message})

@app.route('/get-broadcast-chat', methods=['POST'])
def get_broadcast_chat():
    data = request.json
    broadcast_id = data.get('broadcastId')

    chat_file = os.path.join(CHATS_DIR, f"{broadcast_id}.json")

    if json_exists(chat_file):
        chat = load_json(chat_file)
    else:
        chat = {'messages': []}

    return jsonify(chat)

@app.route('/user-broadcasts/<email>', methods=['GET'])
def user_broadcasts(email):
    broadcasts = []

    for filename in json_list_dir(BROADCASTS_DIR):
        if filename.endswith('.json'):
            broadcast = load_json(os.path.join(BROADCASTS_DIR, filename))
            if email in broadcast['members']:
                broadcasts.append(broadcast)

    return jsonify(broadcasts)

# Settings Routes
@app.route('/update-settings', methods=['POST'])
def update_settings():
    data = request.json
    email = data.get('email')

    settings = load_json(SETTINGS_FILE, {})
    settings[email] = data
    save_json(SETTINGS_FILE, settings)

    users = load_json(USERS_FILE)
    for user in users:
        if user['email'] == email:
            if 'settings' not in user:
                user['settings'] = {}
            user['settings'].update(data)
            break
    save_json(USERS_FILE, users)

    return jsonify({'status': 'ok'})

@app.route('/get-settings/<email>', methods=['GET'])
def get_settings(email):
    settings = load_json(SETTINGS_FILE, {})
    return jsonify(settings.get(email, {}))

# Block/Unblock Routes
@app.route('/block-user', methods=['POST'])
def block_user():
    data = request.json
    user_email = data.get('userEmail')
    block_email = data.get('blockEmail')

    blocked = load_json(BLOCKED_FILE, {})

    if user_email not in blocked:
        blocked[user_email] = []

    if block_email not in blocked[user_email]:
        blocked[user_email].append(block_email)
        save_json(BLOCKED_FILE, blocked)

    return jsonify({'status': 'ok'})

@app.route('/unblock-user', methods=['POST'])
def unblock_user():
    data = request.json
    user_email = data.get('userEmail')
    unblock_email = data.get('unblockEmail')

    blocked = load_json(BLOCKED_FILE, {})

    if user_email in blocked:
        blocked[user_email] = [e for e in blocked[user_email] if e != unblock_email]
        save_json(BLOCKED_FILE, blocked)

    return jsonify({'status': 'ok'})

@app.route('/blocked-users/<email>', methods=['GET'])
def get_blocked_users(email):
    blocked = load_json(BLOCKED_FILE, {})

    # Enrich the blocked user list with user details
    users = load_json(USERS_FILE)
    blocked_emails = blocked.get(email, [])

    enriched_blocked = []
    for be in blocked_emails:
        u = next((u for u in users if u['email'] == be), None)
        if u:
            enriched_blocked.append({
                'email': u['email'],
                'name': u.get('profile', {}).get('name', u.get('username')),
                'avatar': u.get('profile', {}).get('avatar')
            })

    return jsonify(enriched_blocked)

# Added: Subscribe to Push Notifications Route
@app.route('/subscribe', methods=['POST'])
def subscribe_push():
    data = request.json
    email = data.get('email')
    subscription = data.get('subscription')

    if email and subscription:
        subs = load_json(SUBSCRIPTIONS_FILE, {})
        subs[email] = subscription
        save_json(SUBSCRIPTIONS_FILE, subs)
        return jsonify({'status': 'ok'})
    return jsonify({'status': 'error', 'msg': 'Missing data'})

# Added: Create Status/Story Route
@app.route('/create-status', methods=['POST'])
def create_status():
    data = request.json
    email = data.get('email')
    status_type = data.get('type') # text, image, video
    content = data.get('content') or data.get('url') or data.get('text')
    caption = data.get('caption', '')

    status_file = os.path.join(STATUSES_DIR, f"{email}.json")
    statuses = load_json(status_file)

    new_status = {
        'id': str(uuid.uuid4()),
        'type': status_type,
        'content': content,
        'caption': caption,
        'timestamp': now_utc()
    }
    statuses.append(new_status)
    save_json(status_file, statuses)

    socketio.emit('new-status-update', {'email': email})

    return jsonify({'status': 'ok', 'status_data': new_status})

@app.route('/post-status', methods=['POST'])
def post_status():
    data = request.json
    email = data.get('email')
    status_type = data.get('type')
    content = data.get('content') or data.get('url') or data.get('text')
    caption = data.get('caption', '')

    status_file = os.path.join(STATUSES_DIR, f"{email}.json")
    statuses = load_json(status_file)

    new_status = {
        'id': str(uuid.uuid4()),
        'type': status_type,
        'content': content,
        'caption': caption,
        'timestamp': now_utc()
    }
    statuses.append(new_status)
    save_json(status_file, statuses)

    socketio.emit('new-status-update', {'email': email})

    return jsonify({'status': 'ok', 'status_data': new_status})

# Added: Get Statuses/Stories Route
@app.route('/get-statuses/<email>', methods=['GET'])
def get_statuses(email):
    contacts_file = os.path.join(CONTACTS_DIR, f"{email}.json")
    contacts = load_json(contacts_file)
    contact_emails = [c['email'] for c in contacts]
    contact_emails.append(email) # Include own status

    all_statuses = {}
    cutoff_time = datetime.utcnow() - timedelta(hours=24)  # Stories expire in 24 hrs

    for c_email in contact_emails:
        status_file = os.path.join(STATUSES_DIR, f"{c_email}.json")
        if json_exists(status_file):
            user_statuses = load_json(status_file)
            # Strip 'Z' suffix for fromisoformat compatibility (Python < 3.11)
            active_statuses = [s for s in user_statuses if datetime.fromisoformat(s['timestamp'].replace('Z', '')) > cutoff_time]
            if active_statuses:
                all_statuses[c_email] = active_statuses
            # Cleanup old statuses if any
            if len(user_statuses) != len(active_statuses):
                save_json(status_file, active_statuses)

    return jsonify({'status': 'ok', 'statuses': all_statuses})

@app.route('/view-status', methods=['POST'])
def view_status():
    data = request.json
    status_id = data.get('statusId')
    owner_email = data.get('ownerEmail')
    viewer_email = data.get('viewerEmail')
    if not status_id or not owner_email or not viewer_email:
        return jsonify({'status': 'error', 'msg': 'Missing data'})
    status_file = os.path.join(STATUSES_DIR, f"{owner_email}.json")
    if not json_exists(status_file):
        return jsonify({'status': 'error', 'msg': 'Status not found'})
    statuses = load_json(status_file)
    updated = False
    for s in statuses:
        if s.get('id') == status_id:
            if 'views' not in s:
                s['views'] = []
            if viewer_email not in s['views']:
                s['views'].append(viewer_email)
                updated = True
            break
    if updated:
        save_json(status_file, statuses)
    return jsonify({'status': 'ok'})

@app.route('/delete-status', methods=['POST'])
def delete_status():
    data = request.json
    email = data.get('email')
    status_id = data.get('statusId')
    if not email or not status_id:
        return jsonify({'status': 'error', 'msg': 'Missing data'})
    status_file = os.path.join(STATUSES_DIR, f"{email}.json")
    if not json_exists(status_file):
        return jsonify({'status': 'error', 'msg': 'Status not found'})
    statuses = load_json(status_file)
    statuses = [s for s in statuses if s.get('id') != status_id]
    save_json(status_file, statuses)
    return jsonify({'status': 'ok'})

@app.route('/online-status', methods=['POST'])
def update_online_status_route():
    """REST endpoint for online status - handles both JSON and sendBeacon (blob)"""
    try:
        # sendBeacon sends as blob/text, not JSON
        if request.content_type and 'application/json' in request.content_type:
            data = request.get_json(force=True, silent=True) or {}
        else:
            # sendBeacon sends raw body
            try:
                data = json.loads(request.data.decode('utf-8'))
            except:
                data = {}

        email = data.get('email', '')
        online = data.get('online', False)

        if email:
            update_user_online_status(email, online)
            return jsonify({'status': 'ok'})

        return jsonify({'status': 'error', 'msg': 'Missing email'}), 400
    except Exception as e:
        print(f"Error updating online status: {e}")
        return jsonify({'status': 'error', 'msg': str(e)}), 500

@app.route('/online-status/<email>', methods=['GET'])
def get_online_status_route(email):
    """Get current online status of a user"""
    try:
        users_data = load_json(USERS_FILE)
        user = next((u for u in users_data if u.get('email') == email), None)

        if user:
            is_online = email in online_users
            last_seen = user.get('profile', {}).get('lastSeen')
            return jsonify({
                'online': is_online,
                'lastSeen': last_seen
            })

        return jsonify({'online': False, 'lastSeen': None})
    except Exception as e:
        return jsonify({'online': False, 'lastSeen': None})

# Socket.IO Events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('user-login')
def handle_user_login(email):
    online_users[email] = request.sid
    user_sessions[request.sid] = email

    update_user_online_status(email, True)

    emit('user-login-success', {'email': email})

@socketio.on('typing')
def handle_typing(data):
    to_email = data.get('to')
    typing = data.get('typing')
    from_email = user_sessions.get(request.sid)

    if to_email and from_email and to_email in online_users:
        emit('typing', {
            'from': from_email,
            'typing': typing
        }, room=online_users[to_email])

@socketio.on('messages-seen')
def handle_messages_seen(data):
    contact_email = data.get('contactEmail')
    user_email = user_sessions.get(request.sid)

    if user_email and contact_email:
        chat_id = create_chat_id(user_email, contact_email)
        chat_file = os.path.join(CHATS_DIR, f"{chat_id}.json")

        if json_exists(chat_file):
            chat = load_json(chat_file)
            updated = False

            for message in chat['messages']:
                if message['from'] == contact_email and message.get('status') != 'seen':
                    message['status'] = 'seen'
                    updated = True

                    if contact_email in online_users:
                        emit('message-status-updated', {
                            'messageId': message['id'],
                            'status': 'seen'
                        }, room=online_users[contact_email])

            if updated:
                save_json(chat_file, chat)

                emit('messages-seen', {
                    'by': user_email,
                    'chatId': chat_id
                }, room=online_users[contact_email] if contact_email in online_users else None)

@socketio.on('screenshot-taken')
def handle_screenshot(data):
    if data.get('to'):
        emit('screenshot-taken', data, room=data['to'])

@socketio.on('disconnect')
def handle_disconnect(reason=None):
    email = user_sessions.get(request.sid)
    if email:
        if email in online_users:
            del online_users[email]
        if request.sid in user_sessions:
            del user_sessions[request.sid]

        update_user_online_status(email, False)

    print(f"Client disconnected: {request.sid}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=False, use_reloader=False, host='0.0.0.0', port=port)