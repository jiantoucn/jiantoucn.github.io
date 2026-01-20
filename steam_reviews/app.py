import streamlit as st
import pandas as pd
import io
import time
import os
import uuid
import threading
import re
import json
import requests
from datetime import datetime
import extra_streamlit_components as stx

# --- 配置与常量 ---
OUTPUT_DIR = "output"
TASKS_FILE = "tasks.json"
USERS_FILE = "users.json"
DEFAULT_TIMEOUT = 15
MAX_RETRIES = 5

FIELD_GROUPS = {
    "👤 玩家信息": ["作者ID", "作者游戏时长(小时)", "上次游玩时长(小时)"],
    "📝 评价详情": ["好评/差评", "评测内容", "评论语言", "点赞数", "欢乐数"],
    "📅 时间与其他": ["发布日期", "最后更新", "是否免费获取"]
}
ALL_FIELDS = [field for group in FIELD_GROUPS.values() for field in group]

# --- 目录初始化 ---
try:
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
except Exception as e:
    st.error(f"无法创建输出目录 '{OUTPUT_DIR}': {e}")
    st.info("请检查服务器权限，或手动创建该目录并赋予写权限。")
    st.stop()

# --- 通用工具函数 ---
def get_user_session_version(username):
    users = get_users()
    return users.get(username, {}).get('session_version', 0)

def increment_user_session_version(username):
    users = get_users()
    if username in users:
        users[username]['session_version'] = users[username].get('session_version', 0) + 1
        save_json(USERS_FILE, users)
        return users[username]['session_version']
    return 0
def load_json(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_tasks():
    return load_json(TASKS_FILE)

def save_task(task_id, status_data):
    tasks = get_tasks()
    tasks[task_id] = status_data
    save_json(TASKS_FILE, tasks)

def get_users():
    return load_json(USERS_FILE)

def register_user(username, password):
    users = get_users()
    if username in users:
        return False, "用户名已存在"
    users[username] = {"password": password, "session_version": 0}
    save_json(USERS_FILE, users)
    return True, "注册成功"

def authenticate_user(username, password):
    users = get_users()
    if username in users and users[username]['password'] == password:
        return True
    return False

def get_user_session_version(username):
    users = get_users()
    try:
        return int(users.get(username, {}).get("session_version", 0))
    except Exception:
        return 0

def bump_user_session_version(username):
    users = get_users()
    if username not in users:
        return 0
    current_version = users[username].get("session_version", 0)
    try:
        current_version = int(current_version)
    except Exception:
        current_version = 0
    new_version = current_version + 1
    users[username]["session_version"] = new_version
    save_json(USERS_FILE, users)
    return new_version

def clean_filename(filename):
    s = re.sub(r'[^\w\s-]', '', filename).strip().replace(' ', '_')
    return re.sub(r'[-\s]+', '_', s).lower()

# --- 核心抓取逻辑 ---
def fetch_reviews(app_id, max_reviews=1000, language='all', since_timestamp=0, progress_callback=None, stop_check=None):
    url = f"https://store.steampowered.com/appreviews/{app_id}?json=1"
    params = {
        'filter': 'recent',
        'language': language,
        'day_range': '9223372036854775807',
        'review_type': 'all',
        'purchase_type': 'all',
        'num_per_page': 50,
        'cursor': '*'
    }
    reviews_data = []
    cursor = '*'
    consecutive_failures = 0
    newest_timestamp = 0
    target_count = max_reviews if max_reviews > 0 else 0
    
    try:
        first_resp = requests.get(url, params=params, timeout=DEFAULT_TIMEOUT)
        first_data = first_resp.json()
        if first_data.get('success') == 1:
            total_available = first_data.get('query_summary', {}).get('total_reviews', 0)
            if max_reviews <= 0:
                target_count = total_available
            else:
                target_count = min(max_reviews, total_available)
            
            if progress_callback:
                progress_callback(0, 0, target_count, f"准备抓取 {target_count} 条评价...")
    except Exception:
        pass

    while True:
        if stop_check and stop_check():
            break
        if target_count > 0 and len(reviews_data) >= target_count:
            break
            
        params['cursor'] = cursor
        try:
            response = requests.get(url, params=params, timeout=DEFAULT_TIMEOUT)
            response.encoding = 'utf-8'
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            data = response.json()
            if data.get('success') != 1:
                break
            
            consecutive_failures = 0 
            batch_reviews = data.get('reviews', [])
            if not batch_reviews:
                break
                
            for review in batch_reviews:
                ts = review.get('timestamp_created', 0)
                if ts > newest_timestamp:
                    newest_timestamp = ts
                
                content = str(review.get('review', '')).replace('\x00', '').replace('\x0b', '')
                if not content: content = "[无内容]"
                
                reviews_data.append({
                    '作者ID': review['author']['steamid'],
                    '作者游戏时长(小时)': round(review['author'].get('playtime_forever', 0) / 60, 1),
                    '上次游玩时长(小时)': round(review['author'].get('playtime_last_two_weeks', 0) / 60, 1),
                    '发布日期': pd.to_datetime(ts, unit='s'),
                    '最后更新': pd.to_datetime(review['timestamp_updated'], unit='s'),
                    '好评/差评': '好评' if review['voted_up'] else '差评',
                    '点赞数': review['votes_up'],
                    '欢乐数': review['votes_funny'],
                    '评测内容': content,
                    '评论语言': review['language'],
                    '是否免费获取': review.get('received_for_free', False),
                    '_ts': ts
                })
                if target_count > 0 and len(reviews_data) >= target_count:
                    break
            
            current_count = len(reviews_data)
            if progress_callback:
                progress = min(current_count / target_count, 1.0) if target_count > 0 else 0
                progress_callback(progress, current_count, target_count, f"正在抓取... {int(progress * 100)}%")
            
            new_cursor = data.get('cursor')
            if new_cursor == cursor:
                break
            cursor = new_cursor
            time.sleep(3.0)
        except Exception as e:
            consecutive_failures += 1
            if consecutive_failures > MAX_RETRIES:
                break 
            time.sleep(consecutive_failures * 2)

    if not reviews_data:
        return pd.DataFrame(), newest_timestamp
    df = pd.DataFrame(reviews_data)
    if target_count > 0 and len(df) > target_count:
        df = df.head(target_count)
    if '_ts' in df.columns:
        df = df.drop(columns=['_ts'])
    return df, newest_timestamp

# --- 页面配置 ---
st.set_page_config(page_title="Steam 评论抓取系统", page_icon="🎮", layout="wide")
cookie_manager = stx.CookieManager()

def safe_cookie_get(cookie_key):
    try:
        return cookie_manager.get(cookie=cookie_key)
    except Exception:
        return None

def safe_cookie_set(cookie_key, value, expires_at=None):
    try:
        if expires_at is None:
            cookie_manager.set(cookie_key, value)
        else:
            cookie_manager.set(cookie_key, value, expires_at=expires_at)
        return True
    except Exception:
        return False

def safe_cookie_delete(cookie_key):
    ok = True
    try:
        cookie_manager.delete(cookie_key)
    except Exception:
        ok = False
    try:
        cookie_manager.set(cookie_key, "", expires_at=datetime.now() - pd.Timedelta(days=1))
    except Exception:
        ok = False
    return ok

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
if "username" not in st.session_state:
    st.session_state.username = None
if "logout_in_progress" not in st.session_state:
    st.session_state.logout_in_progress = False
if "stop_signals" not in st.session_state:
    st.session_state.stop_signals = set()
if "flash_message" not in st.session_state:
    st.session_state.flash_message = None

# --- 登录页面逻辑 ---
def login_page():
    st.title("🎮 Steam 评论抓取系统 - 登录")
    
    if st.session_state.flash_message:
        st.info(st.session_state.flash_message)
        st.session_state.flash_message = None

    # 获取 Cookie 并尝试解析
    saved_cookie = cookie_manager.get(cookie="steam_review_user")
    
    if saved_cookie and not st.session_state.logged_in and not st.session_state.logout_in_progress:
        try:
            # 兼容旧版(字符串)和新版(字典) Cookie
            if isinstance(saved_cookie, dict) and 'u' in saved_cookie and 'v' in saved_cookie:
                u, v = saved_cookie['u'], saved_cookie['v']
                if u and int(v) == get_user_session_version(u):
                    st.session_state.logged_in = True
                    st.session_state.username = u
                    st.rerun()
            elif isinstance(saved_cookie, str) and saved_cookie.strip():
                # 处理 JSON 字符串形式的旧版 Cookie
                if saved_cookie.strip().startswith("{"):
                    parsed = json.loads(saved_cookie)
                    u, v = parsed.get("u"), parsed.get("v", 0)
                    if u and int(v) == get_user_session_version(u):
                        st.session_state.logged_in = True
                        st.session_state.username = u
                        st.rerun()
                else:
                    # 如果是纯字符串用户名，直接登录
                    st.session_state.logged_in = True
                    st.session_state.username = saved_cookie.strip()
                    st.rerun()
        except Exception:
            pass

    tab1, tab2 = st.tabs(["登录", "注册"])
    with tab1:
        with st.form("login_form"):
            u = st.text_input("用户名")
            p = st.text_input("密码", type="password")
            remember_me = st.checkbox("记住登录状态 (30天)")
            submit = st.form_submit_button("登录")
            if submit:
                if authenticate_user(u, p):
                    st.session_state.logged_in = True
                    st.session_state.username = u
                    st.session_state.logout_in_progress = False
                    if remember_me:
                        v = get_user_session_version(u)
                        cookie_manager.set("steam_review_user", {"u": u, "v": v}, expires_at=datetime.now() + pd.Timedelta(days=30))
                    else:
                        cookie_manager.delete("steam_review_user")
                    st.success("登录成功！正在跳转...")
                    time.sleep(1)
                    st.rerun()
                else:
                    st.error("用户名或密码错误")
    with tab2:
        with st.form("register_form"):
            new_u = st.text_input("设置用户名")
            new_p = st.text_input("设置密码", type="password")
            confirm_p = st.text_input("确认密码", type="password")
            reg_submit = st.form_submit_button("注册")
            if reg_submit:
                if not new_u or not new_p:
                    st.error("请填写完整信息")
                elif new_p != confirm_p:
                    st.error("两次输入的密码不一致")
                else:
                    success, msg = register_user(new_u, new_p)
                    if success:
                        st.session_state.logged_in = True
                        st.session_state.username = new_u
                        st.session_state.logout_in_progress = False
                        st.success(f"{msg}！正在为您自动登录...")
                        time.sleep(1.5)
                        st.rerun()
                    else:
                        st.error(msg)

if not st.session_state.logged_in:
    login_page()
    st.stop()

user_id = st.session_state.username

def run_scraping_task(task_id, app_id, max_reviews, language, since_ts, selected_fields):
    try:
        save_task(task_id, {
            "status": "running",
            "progress": 0,
            "message": "任务已启动...",
            "game_name": f"AppID_{app_id}",
            "app_id": app_id,
            "current_count": 0,
            "target_count": 0,
            "start_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        def progress_cb(p, current_count, target_count, text):
            tasks = get_tasks()
            current_task_data = tasks.get(task_id, {})
            save_task(task_id, {
                **current_task_data, 
                "status": "running", 
                "progress": int(p * 100), 
                "current_count": current_count,
                "target_count": target_count,
                "message": text
            })
        def stop_check():
            tasks = get_tasks()
            return tasks.get(task_id, {}).get("status") == "cancelled"

        df_result, newest_ts = fetch_reviews(app_id, max_reviews, language, since_timestamp=since_ts, progress_callback=progress_cb, stop_check=stop_check)
        tasks = get_tasks()
        is_cancelled = tasks.get(task_id, {}).get("status") == "cancelled"

        if not df_result.empty:
            df_result = df_result[selected_fields]
            timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
            suffix = "partial" if is_cancelled else len(df_result)
            filename = f"steam_{app_id}_{timestamp_str}_{suffix}.xlsx"
            filepath = os.path.join(OUTPUT_DIR, filename)

            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                df_result.to_excel(writer, index=False, sheet_name='Steam评测')
                worksheet = writer.sheets['Steam评测']
                date_format = 'yyyy/m/d'
                for i, col in enumerate(df_result.columns):
                    if col in ['发布日期', '最后更新']:
                        for cell in worksheet.iter_cols(min_col=i+1, max_col=i+1, min_row=2):
                            for c in cell: c.number_format = date_format

            final_status = "completed" if not is_cancelled else "cancelled_saved"
            save_task(task_id, {"status": final_status, "progress": 100, "filename": filename, "count": len(df_result), "finish_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
        else:
            save_task(task_id, {"status": "cancelled" if is_cancelled else "failed", "message": "任务已取消" if is_cancelled else "未获取到新数据"})
    except Exception as e:
        save_task(task_id, {"status": "failed", "message": str(e)})

# --- 侧边栏：配置参数 ---
with st.sidebar:
    st.header(f"👤 当前用户: {user_id}")
    if st.button("注销登录", type="secondary"):
        increment_user_session_version(user_id)
        st.session_state.logged_in = False
        st.session_state.username = None
        st.session_state.logout_in_progress = True
        cookie_manager.delete("steam_review_user")
        st.rerun()
    st.divider()
    st.header("1. 配置参数")
    
    app_id = st.text_input(
        "Steam App ID", 
        placeholder="例如: 2358720", 
        key="app_id_input"
    )
    
    fetch_all = st.checkbox("抓取全部评价", value=True)
    if fetch_all:
        max_reviews = 0
    else:
        max_reviews = st.number_input("最大抓取数量", min_value=1, value=1000, step=500)
    language = st.selectbox("语言", ["all", "schinese", "tchinese", "english"])
    st.header("2. 自定义字段")
    selected_fields = []
    for group_name, fields in FIELD_GROUPS.items():
        with st.expander(group_name, expanded=True):
            for field in fields:
                if f"field_{field}" not in st.session_state: st.session_state[f"field_{field}"] = True
                if st.checkbox(field, key=f"field_{field}"): selected_fields.append(field)
    if st.button("提交后台抓取任务", type="primary"):
        if not app_id: st.error("请输入 App ID")
        else:
            task_id = f"{user_id}_{int(time.time())}"
            since_ts = 0
            
            threading.Thread(target=run_scraping_task, args=(task_id, app_id, max_reviews, language, since_ts, selected_fields)).start()
            st.success(f"任务已提交！ID: {task_id}")

# --- 主页面 ---
st.title("🎮 Steam 评论抓取 (服务端持久化版)")

# 使用 fragment 实现局部刷新任务进度，不影响主页面其他部分
@st.fragment(run_every="2s")
def show_task_progress():
    st.subheader("⏳ 当前抓取任务")
    tasks = get_tasks()
    user_tasks = {tid: t for tid, t in tasks.items() if tid.startswith(user_id) and t['status'] == 'running'}
    
    if not user_tasks:
        st.write("暂无正在运行的任务。")
    else:
        for tid, t in user_tasks.items():
            with st.container(border=True):
                st.markdown(f"### 🎮 {t.get('game_name', '未知游戏')}")
                c1, c2 = st.columns(2)
                with c1:
                    st.caption(f"🆔 **AppID**: `{t.get('app_id', 'N/A')}`")
                    st.caption(f"⏱️ **启动时间**: {t.get('start_time', 'N/A')}")
                with c2:
                    target_count = t.get('target_count', 0)
                    count_text = f"{t.get('current_count', 0)} / {target_count}" if target_count > 0 else f"{t.get('current_count', 0)}"
                    st.caption(f"📈 **已抓取**: `{count_text}` 条")
                    st.caption(f"任务ID: `{tid}`")
                st.progress(t['progress'] / 100, text=f"完成进度: {t['progress']}%")
                if st.button("取消任务", key=f"cancel_{tid}"):
                    t['status'], t['message'] = 'cancelled', '正在停止...'
                    save_task(tid, t)
                    st.warning("已发送停止信号...")
                    st.rerun()

col_progress, col_history = st.columns([1, 1])

with col_progress:
    show_task_progress()

with col_history:
    st.subheader("📂 已完成的文件 (服务端保存)")
    tasks = get_tasks()
    completed_tasks = {tid: t for tid, t in tasks.items() if tid.startswith(user_id) and t['status'] in ['completed', 'cancelled_saved']}
    if not completed_tasks: st.write("暂无历史记录。")
    else:
        sorted_tasks = sorted(completed_tasks.items(), key=lambda x: x[1].get('finish_time', ''), reverse=True)
        for tid, t in sorted_tasks:
            filepath = os.path.join(OUTPUT_DIR, t['filename'])
            if os.path.exists(filepath):
                with st.container(border=True):
                    status_icon = "📄" if t['status'] == 'completed' else "⚠️"
                    status_text = "已完成" if t['status'] == 'completed' else "已取消 (部分保存)"
                    st.write(f"{status_icon} **{t['filename']}**")
                    st.caption(f"状态: {status_text} | 时间: {t['finish_time']} | 数量: {t['count']}")
                    with open(filepath, "rb") as f:
                        st.download_button(label="📥 下载到本地", data=f, file_name=t['filename'], mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key=f"dl_{tid}")
            else: st.error(f"文件 {t['filename']} 在服务端已被移除。")
    if st.button("刷新记录"): st.rerun()
