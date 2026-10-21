from contextlib import asynccontextmanager
from datetime import datetime,date
from fastapi import FastAPI,HTTPException,Depends,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse,Response
from pydantic import BaseModel,EmailStr
from .config import FRONTEND_ORIGINS,SCHOOL_EMAIL_DOMAIN
from .db import init_db,close_db,get_db
from .auth import supabase_auth,supabase_admin,set_session,clear_session,current_auth_user
from .storage import upload_photo

@asynccontextmanager
async def lifespan(app):
    await init_db(); yield; await close_db()
app=FastAPI(title='Lost & Found API',version='3.0.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=FRONTEND_ORIGINS or ['*'],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
class Login(BaseModel): email:EmailStr; password:str

class Register(BaseModel):
    fullName: str
    email: EmailStr
    studentId: str | int | None = None
    password: str

class Forgot(BaseModel): email:EmailStr
class Receive(BaseModel): storage:str; details:str
class Verify(BaseModel): outcome:str; rationale:str
class Release(BaseModel): claimRef:str; itemType:str='found'
async def app_user(conn,u):
    uid=str(u.id)
    s=await conn.fetchrow('select student_id,first_name,last_name,middle_name,student_email from public.students where auth_user_id=$1::uuid',uid)
    if s:return {'id':str(s['student_id']),'role':'student','fullName':' '.join(x for x in [s['first_name'],s['middle_name'],s['last_name']] if x),'email':s['student_email'],'studentId':s['student_id']}
    a=await conn.fetchrow('select admin_id,full_name,email from public.admins where auth_user_id=$1::uuid',uid)
    if a:return {'id':str(a['admin_id']),'role':'staff','fullName':a['full_name'],'email':a['email']}
    raise HTTPException(403,'Authenticated account is not linked to a student or staff record')
def ref(kind,id,when):return f'{kind}-{when.year}-{int(id):04d}'
def public_item(r,kind,role,student_id=None):
    sensitive=r.get('category','').lower() in ('documents','personal accessories') and any(x in r['name'].lower() for x in ('id','card','wallet','passport','license'))
    status=r['status']
    # Normalize database statuses to the public API statuses used by the UI.
    # A found report is not claimable until staff records the physical item.
    if kind == 'lost':
        # New lost reports are stored in the database as 'reported', while
        # the UI's Reported Lost view filters for the public status 'open'.
        if status == 'reported':
            status = 'open'
        elif status == 'under_review':
            status = 'pending'
        elif status == 'returned':
            status = 'released'
    elif kind == 'found':
        if status == 'unclaimed' and not r.get('received_at'):
            status = 'awaiting'
        elif status == 'stored':
            status = 'available'
        elif status == 'matched':
            status = 'pending'
        elif status in ('claimed', 'returned'):
            status = 'released'
    if sensitive and role!='staff':
        return {'id':str(r['id']),'ref':ref('LST' if kind=='lost' else 'FND',r['id'],r['created_at']),'type':kind,'name':'Sensitive item','category':r['category'],'description':'Identifying details are withheld for privacy.','place':None,'date':r['item_date'].isoformat(),'createdAt':r['created_at'].isoformat(),'photo':None,'status':status,'canClaim':role=='student' and ((kind=='found' and status=='available') or (kind=='lost' and status=='pending')) and not r.get('my_claim'),'myClaim':r.get('my_claim')}
    return {'id':str(r['id']),'ref':ref('LST' if kind=='lost' else 'FND',r['id'],r['created_at']),'type':kind,'name':r['name'],'category':r['category'],'description':r['description'],'place':r['place'],'date':r['item_date'].isoformat(),'createdAt':r['created_at'].isoformat(),'photo':r['photo'],'status':status,'canClaim':role=='student' and ((kind=='found' and status=='available') or (kind=='lost' and status=='pending')) and not r.get('my_claim'),'myClaim':r.get('my_claim')}
@app.get('/health')
async def health():return {'ok':True}
@app.post('/api/auth/login')
async def login(b:Login,conn=Depends(get_db)):
    try:r=supabase_auth.auth.sign_in_with_password({'email':str(b.email),'password':b.password})
    except Exception:raise HTTPException(401,'Invalid email or password')
    if not r.session:raise HTTPException(401,'Invalid email or password')
    u=await app_user(conn,r.user); out=JSONResponse({'user':u});set_session(out,r.session.access_token,r.session.refresh_token);return out
@app.post('/api/auth/logout')
async def logout():
    r=Response(status_code=204);clear_session(r);return r
@app.get('/api/auth/me')
async def me(request:Request,conn=Depends(get_db)):return {'user':await app_user(conn,await current_auth_user(request))}

@app.post("/api/auth/register", status_code=202)
async def register(b: Register, conn=Depends(get_db)):
    email = str(b.email).strip().lower()
    full_name = " ".join(b.fullName.strip().split())

    # Validate the name.
    if len(full_name.split()) < 2:
        raise HTTPException(
            status_code=422,
            detail="Please enter your first and last name."
        )

    # Validate the password.
    if len(b.password) < 8:
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 8 characters."
        )

    # Require a configured school email domain.
    if not SCHOOL_EMAIL_DOMAIN:
        raise HTTPException(
            status_code=503,
            detail="School email registration is not configured."
        )

    # Match the exact email domain.
    email_domain = email.rsplit("@", 1)[-1].lower()
    if email_domain != SCHOOL_EMAIL_DOMAIN.lower():
        raise HTTPException(
            status_code=422,
            detail="Please use your school email address."
        )

    try:
        result = supabase_auth.auth.sign_up({
            "email": email,
            "password": b.password,
            "options": {
                "email_redirect_to": (
                    f"{FRONTEND_ORIGINS[0].rstrip('/')}/verify-email.html"
                    if FRONTEND_ORIGINS
                    else None
                ),
            }
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Registration could not be completed. "
                "Please check your details or try again later."
            )
        )

    if not result.user:
        raise HTTPException(
            status_code=400,
            detail="Registration could not be completed."
        )

    return {
        "message": (
            "Registration submitted. Please check your school "
            "email for a confirmation link before logging in."
        )
    }

@app.post('/api/auth/forgot',status_code=202)
async def forgot(b:Forgot):
    try:supabase_auth.auth.reset_password_email(str(b.email))
    except Exception:pass
    return {'message':'If an account exists for that email, a reset email will be sent.'}
@app.get('/api/items')
async def items(request:Request,view:str='lost',q:str='',conn=Depends(get_db)):
    u=await current_auth_user(request);au=await app_user(conn,u);sid=au.get('studentId',-1);search=f'%{q.strip()}%' if q.strip() else None
    ls=await conn.fetch('''select l.lost_item_id id,l.item_name name,l.item_description description,l.date_lost item_date,l.date_reported created_at,l.item_status status,c.category_name category,loc.building_name,loc.room_name,l.photo_url photo from public.lost_items l join public.categories c on c.category_id=l.category_id join public.locations loc on loc.location_id=l.location_id where ($1::text is null or l.item_name ilike $1 or coalesce(l.item_description,'') ilike $1) order by l.date_reported desc''',search)
    fs=await conn.fetch('''select f.found_item_id id,f.item_name name,f.item_description description,f.date_found item_date,f.date_submitted created_at,f.item_status status,f.received_at,c.category_name category,loc.building_name,loc.room_name,f.photo_url photo from public.found_items f join public.categories c on c.category_id=f.category_id join public.locations loc on loc.location_id=f.location_id where ($1::text is null or f.item_name ilike $1 or coalesce(f.item_description,'') ilike $1) order by f.date_submitted desc''',search)
    out=[]
    for r in ls:
        d=dict(r);d['place']=f"{r['building_name']} / {r['room_name']}"
        c=await conn.fetchrow("select claim_id,claim_status from public.claims where lost_item_id=$1 and student_id=$2 order by claim_id desc limit 1",r['id'],sid)
        d['my_claim']={'ref':f"CLM-{c['claim_id']}",'status':c['claim_status']} if c and c['claim_status'] in ('pending','approved') and r['status'] not in ('returned','closed') else None
        out.append(public_item(d,'lost',au['role'],sid))
    for r in fs:
        d=dict(r);d['place']=f"{r['building_name']} / {r['room_name']}";c=await conn.fetchrow("select claim_id,claim_status from public.claims where found_item_id=$1 and student_id=$2 order by claim_id desc limit 1",r['id'],sid);d['my_claim']={'ref':f"CLM-{c['claim_id']}",'status':c['claim_status']} if c else None;out.append(public_item(d,'found',au['role'],sid))
    if view=='lost':out=[x for x in out if x['type']=='lost' and x['status'] in ('open','pending')]
    elif view=='found':out=[x for x in out if x['type']=='found' and x['status']=='available']
    elif view=='pending':out=[x for x in out if x['status']=='pending']
    elif view=='claimed':out=[x for x in out if x['status']=='released']
    elif view=='awaiting':
        if au['role']!='staff':raise HTTPException(403,'Staff access required')
        out=[x for x in out if x['type']=='found' and x['status']=='awaiting']
    elif view=='mine':
        if au['role']=='student':
            ids={r['lost_item_id'] for r in await conn.fetch('select lost_item_id from public.lost_items where student_id=$1',sid)};fids={r['found_item_id'] for r in await conn.fetch('select found_item_id from public.claims where student_id=$1 and found_item_id is not null',sid)};clids={r['lost_item_id'] for r in await conn.fetch('select lost_item_id from public.claims where student_id=$1 and lost_item_id is not null',sid)}
            out=[x for x in out if (x['type']=='lost' and (int(x['id']) in ids or int(x['id']) in clids)) or (x['type']=='found' and int(x['id']) in fids)]
        else:out=[]
    return {'items':out}
@app.post('/api/reports',status_code=201)
async def report(request:Request,conn=Depends(get_db)):
    u=await current_auth_user(request);au=await app_user(conn,u);f=await request.form();typ=str(f.get('type','')).lower();name=str(f.get('name','')).strip();cat=str(f.get('category','')).strip();dt=str(f.get('date',''));place=str(f.get('place','')).strip();desc=str(f.get('description','')).strip();photo=f.get('photo')
    if typ not in ('lost','found'):raise HTTPException(422,'Invalid report type')
    try:item_date=date.fromisoformat(dt)
    except:raise HTTPException(422,'Invalid date')
    c = await conn.fetchrow(
    """
    SELECT category_id
    FROM public.categories
    WHERE LOWER(TRIM(category_name)) = LOWER(TRIM($1))
    LIMIT 1
    """,
    cat
    )
    if not c:raise HTTPException(422,'Invalid category')
    building,room=(place.split('/',1)+[''])[:2] if '/' in place else (place,'');loc=await conn.fetchrow('select location_id from public.locations where building_name=$1 and room_name=$2',building.strip(),room.strip())
    if not loc:loc=await conn.fetchrow('insert into public.locations(building_name,room_name) values($1,$2) returning location_id',building.strip(),room.strip())
    url=upload_photo(photo,'reports') if photo and hasattr(photo,'file') else None
    if typ=='lost':
        if au['role']!='student':raise HTTPException(422,'A staff account cannot own a lost report')
        r=await conn.fetchrow('insert into public.lost_items(student_id,category_id,location_id,item_name,item_description,date_lost,photo_url) values($1,$2,$3,$4,$5,$6,$7) returning lost_item_id,date_reported',au['studentId'],c['category_id'],loc['location_id'],name,desc,item_date,url);d={'id':r['lost_item_id'],'name':name,'description':desc,'category':cat,'item_date':item_date,'created_at':r['date_reported'],'status':'reported','place':f'{building.strip()} / {room.strip()}','photo':url,'my_claim':None};return {'report':public_item(d,'lost',au['role'],au.get('studentId'))}
    sid=au.get('studentId');r=await conn.fetchrow('insert into public.found_items(student_id,category_id,location_id,item_name,item_description,date_found,item_status,photo_url,on_behalf_of) values($1,$2,$3,$4,$5,$6,\'unclaimed\',$7,$8) returning found_item_id,date_submitted',sid,c['category_id'],loc['location_id'],name,desc,item_date,url,str(f.get('onBehalfOf','')).strip() or None);d={'id':r['found_item_id'],'name':name,'description':desc,'category':cat,'item_date':item_date,'created_at':r['date_submitted'],'status':'unclaimed','received_at':None,'place':f'{building.strip()} / {room.strip()}','photo':url,'my_claim':None};return {'report':public_item(d,'found',au['role'],au.get('studentId'))}
@app.post('/api/items/{item_id}/claims',status_code=201)
async def claim(item_id:int,request:Request,conn=Depends(get_db)):
    au=await app_user(conn,await current_auth_user(request))
    if au['role']!='student':raise HTTPException(403,'Students only')
    f=await request.form();ev=str(f.get('evidence','')).strip();lost_when=str(f.get('lostWhen','')).strip();lost_where=str(f.get('lostWhere','')).strip();confirm=str(f.get('confirm','')).lower();photo=f.get('photo');item_type=str(f.get('itemType','found')).lower()
    if len(ev)<10 or confirm not in ('true','1','on','yes'):raise HTTPException(422,'Please provide your evidence and confirm the item belongs to you')
    if item_type=='lost' and (len(lost_when)<2 or len(lost_where)<2):raise HTTPException(422,'Please provide when and where you lost the item')
    if item_type=='lost':ev=f"Description: {ev}\nLast lost: {lost_when}\nWhere lost: {lost_where}"
    if item_type not in ('lost','found'):raise HTTPException(422,'Invalid item type')
    if item_type=='lost':
        item=await conn.fetchrow("select lost_item_id,item_status from public.lost_items where lost_item_id=$1",item_id)
        if not item or item['item_status']!='under_review':raise HTTPException(409,'This lost report must be verified by staff before it can be claimed')
        if not photo or not hasattr(photo,'file'):raise HTTPException(422,'Please attach a photo that helps prove the item is yours')
        existing=await conn.fetchrow("select claim_id from public.claims where lost_item_id=$1 and student_id=$2 and claim_status in ('pending','approved')",item_id,au['studentId'])
        if existing:raise HTTPException(409,'You already have an active claim for this lost report')
        url=upload_photo(photo,'claims')
        c=await conn.fetchrow("insert into public.claims(student_id,lost_item_id,proof_description,claim_status,photo_url) values($1,$2,$3,'pending',$4) returning claim_id",au['studentId'],item_id,ev,url)
    else:
        item=await conn.fetchrow('select found_item_id,item_status from public.found_items where found_item_id=$1',item_id)
        if not item or item['item_status'] != 'stored':raise HTTPException(409,'This item is not available to claim until staff receives it')
        existing=await conn.fetchrow("select claim_id from public.claims where found_item_id=$1 and student_id=$2 and claim_status in ('pending','approved')",item_id,au['studentId'])
        if existing:raise HTTPException(409,'You already have an active claim for this item')
        url=upload_photo(photo,'claims') if photo and hasattr(photo,'file') else None
        c=await conn.fetchrow("insert into public.claims(student_id,found_item_id,proof_description,claim_status,photo_url) values($1,$2,$3,'pending',$4) returning claim_id",au['studentId'],item_id,ev,url)
        await conn.execute("update public.found_items set item_status='matched' where found_item_id=$1",item_id)
    return {'claim':{'ref':f"CLM-{c['claim_id']}",'status':'pending'}}
async def staff_check(request,conn):
    au=await app_user(conn,await current_auth_user(request))
    if au['role']!='staff':raise HTTPException(403,'Staff access required')
    return au
@app.post('/api/lost-items/{item_id}/verification')
async def verify_lost_item(item_id:int,request:Request,conn=Depends(get_db)):
    """Staff review of a lost-item report. Store under_review and expose it as Pending."""
    au=await staff_check(request,conn)
    r=await conn.fetchrow("""update public.lost_items
        set item_status='under_review'
        where lost_item_id=$1 and item_status='reported'
        returning lost_item_id""",item_id)
    if not r:
        exists=await conn.fetchval('select 1 from public.lost_items where lost_item_id=$1',item_id)
        if not exists: raise HTTPException(404,'Lost report not found')
        raise HTTPException(409,'This lost report has already been reviewed or cannot be reviewed in its current status')
    return {'item':{'id':str(item_id),'type':'lost','status':'pending'}}

@app.get('/api/items/{item_id}/staff')
async def staff_item(item_id:int,request:Request,kind:str='found',conn=Depends(get_db)):
    await staff_check(request,conn)
    if kind=='lost':
        r=await conn.fetchrow('''select l.*,c.category_name,loc.building_name,loc.room_name from public.lost_items l join public.categories c on c.category_id=l.category_id join public.locations loc on loc.location_id=l.location_id where l.lost_item_id=$1''',item_id)
        if not r:raise HTTPException(404,'Lost report not found')
        claims=await conn.fetch('''select c.*,s.first_name,s.last_name,s.student_email from public.claims c join public.students s on s.student_id=c.student_id where c.lost_item_id=$1 order by c.claim_id''',item_id)
        raw=r['item_status'];status='open' if raw=='reported' else ('pending' if raw=='under_review' else ('released' if raw=='returned' else raw))
        item={'id':str(item_id),'ref':ref('LST',item_id,r['date_reported']),'type':'lost','name':r['item_name'],'category':r['category_name'],'description':r['item_description'],'place':f"{r['building_name']} / {r['room_name']}",'date':r['date_lost'].isoformat(),'createdAt':r['date_reported'].isoformat(),'photo':r['photo_url'],'status':status,'canClaim':False,'myClaim':None}
        record=None
    else:
        r=await conn.fetchrow('''select f.*,c.category_name,loc.building_name,loc.room_name from public.found_items f join public.categories c on c.category_id=f.category_id join public.locations loc on loc.location_id=f.location_id where f.found_item_id=$1''',item_id)
        if not r:raise HTTPException(404,'Found item not found')
        claims=await conn.fetch('''select c.*,s.first_name,s.last_name,s.student_email from public.claims c join public.students s on s.student_id=c.student_id where c.found_item_id=$1 order by c.claim_id''',item_id)
        item={'id':str(item_id),'ref':ref('FND',item_id,r['date_submitted']),'type':'found','name':r['item_name'],'category':r['category_name'],'description':r['item_description'],'place':f"{r['building_name']} / {r['room_name']}",'date':r['date_found'].isoformat(),'createdAt':r['date_submitted'].isoformat(),'photo':r['photo_url'],'status':'awaiting' if r['item_status']=='unclaimed' and not r['received_at'] else ('released' if r['item_status'] in ('claimed','returned') else ('pending' if r['item_status']=='matched' else 'available')),'canClaim':False,'myClaim':None}
        record={'storage':r['storage_location'],'details':r['private_details'],'receivedBy':r['received_by'],'receivedAt':r['received_at'].isoformat() if r['received_at'] else None} if r['received_at'] else None
    cs=[]
    for c in claims:cs.append({'ref':f"CLM-{c['claim_id']}",'createdAt':c['date_reviewed'].isoformat() if c['date_reviewed'] else r['date_reported' if kind=='lost' else 'date_submitted'].isoformat(),'status':c['claim_status'],'evidence':c['proof_description'],'photo':c['photo_url'],'claimant':{'fullName':f"{c['first_name']} {c['last_name']}",'email':c['student_email'],'studentId':c['student_id']},'rationale':c['admin_remarks'],'decidedBy':None,'decidedAt':c['date_reviewed'].isoformat() if c['date_reviewed'] else None})
    return {'item':item,'record':record,'claims':cs}
@app.post('/api/items/{item_id}/receive')
async def receive(item_id:int,b:Receive,request:Request,conn=Depends(get_db)):
    au=await staff_check(request,conn);r=await conn.fetchrow("update public.found_items set item_status='stored',storage_location=$2,private_details=$3,received_by=$4,received_at=now() where found_item_id=$1 and item_status='unclaimed' returning found_item_id,date_submitted,item_name,item_description,date_found,photo_url",item_id,b.storage,b.details,au['fullName'])
    if not r:raise HTTPException(409,'Item was already received or does not exist')
    return {'item':{'id':str(item_id),'ref':ref('FND',item_id,r['date_submitted']),'type':'found','name':r['item_name'],'description':r['item_description'],'date':r['date_found'].isoformat(),'status':'available','photo':r['photo_url']}}
@app.post('/api/claims/{claim_ref}/verification')
async def verify(claim_ref:str,b:Verify,request:Request,conn=Depends(get_db)):
    au=await staff_check(request,conn)
    try:cid=int(claim_ref[4:]) if claim_ref.startswith('CLM-') else 0
    except:cid=0
    if not cid or b.outcome not in ('approved','rejected') or len(b.rationale.strip())<10:raise HTTPException(422,'Valid outcome and rationale are required')
    c=await conn.fetchrow("update public.claims set claim_status=$2,date_reviewed=now(),admin_remarks=$3,reviewed_by_admin_id=$4 where claim_id=$1 and claim_status='pending' returning claim_id,found_item_id,lost_item_id,claim_status,date_reviewed,admin_remarks",cid,b.outcome,b.rationale,au['id'])
    if not c:raise HTTPException(409,'Claim was already decided or not found')
    if c['lost_item_id'] is not None:
        # A lost report remains under_review while staff decides who owns it.
        # It is marked returned only when staff explicitly releases it.
        pass
    elif b.outcome=='approved':await conn.execute("update public.found_items set item_status='matched' where found_item_id=$1",c['found_item_id'])
    else:
        n=await conn.fetchval("select count(*) from public.claims where found_item_id=$1 and claim_status in ('pending','approved')",c['found_item_id'])
        if n==0:await conn.execute("update public.found_items set item_status='stored' where found_item_id=$1",c['found_item_id'])
    return {'claim':{'ref':claim_ref,'status':b.outcome,'rationale':b.rationale,'decidedAt':c['date_reviewed'].isoformat()}}
@app.post('/api/items/{item_id}/release')
async def release(item_id:int,b:Release,request:Request,conn=Depends(get_db)):
    au=await staff_check(request,conn)
    try:cid=int(b.claimRef[4:]) if b.claimRef.startswith('CLM-') else 0
    except:cid=0
    c=await conn.fetchrow("select claim_id,found_item_id,lost_item_id,claim_status from public.claims where claim_id=$1",cid)
    if not c:raise HTTPException(404,'Claim not found')
    if c['claim_status']!='approved':raise HTTPException(409,'An approved claim is required')
    if b.itemType=='lost':
        if c['lost_item_id']!=item_id:raise HTTPException(404,'Claim does not belong to this lost report')
        r=await conn.fetchrow("update public.lost_items set item_status='returned' where lost_item_id=$1 and item_status='under_review' returning lost_item_id",item_id)
        if not r:raise HTTPException(409,'Lost report is not ready to be released')
        return {'item':{'id':str(item_id),'type':'lost','status':'released'}}
    if c['found_item_id']!=item_id:raise HTTPException(404,'Claim does not belong to this found item')
    await conn.execute("update public.found_items set item_status='claimed' where found_item_id=$1",item_id)
    await conn.execute("insert into public.returns(found_item_id,admin_id,admin_remarks) values($1,$2,$3) on conflict(found_item_id) do update set admin_id=excluded.admin_id,admin_remarks=excluded.admin_remarks,date_returned=now()",item_id,au['id'],'Released against approved claim')
    return {'item':{'id':str(item_id),'type':'found','status':'released'}}

