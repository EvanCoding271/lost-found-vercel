from fastapi import HTTPException,Request
from itsdangerous import URLSafeSerializer,BadSignature
from supabase import create_client
from .config import SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SESSION_SECRET
supabase_auth=create_client(SUPABASE_URL,SUPABASE_ANON_KEY)
supabase_admin=create_client(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY)
serializer=URLSafeSerializer(SESSION_SECRET,salt='lost-found-session')
COOKIE='lf_session'
def set_session(response,access,refresh):
    response.set_cookie(COOKIE,serializer.dumps({'access_token':access,'refresh_token':refresh}),httponly=True,secure=True,samesite='lax',max_age=604800,path='/')
def clear_session(response): response.delete_cookie(COOKIE,path='/')
def read_session(request):
    v=request.cookies.get(COOKIE)
    if not v:return None
    try:return serializer.loads(v)
    except BadSignature:return None
async def current_auth_user(request):
    s=read_session(request)
    if not s or not s.get('access_token'):raise HTTPException(401,'Not authenticated')
    try:
        r=supabase_auth.auth.get_user(s['access_token'])
        if not r.user:raise HTTPException(401,'Invalid session')
        return r.user
    except HTTPException:raise
    except Exception:raise HTTPException(401,'Session expired or invalid')
