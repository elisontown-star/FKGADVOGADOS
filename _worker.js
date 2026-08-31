const SUPERADMIN_USER='superadmin';
const SUPERADMIN_PASS='FKG@Admin2026!';
// Token exclusivo das tarefas automáticas (cron-job.org). Não depende de login,
// então continua valendo mesmo quando as sessões dos usuários expiram.
const CRON_TOKEN='vpoint-cron-2f7a91d4c8e35b60';
const DEFAULT_EMPLOYEES={"Sócios":["Cristiano Kozan","Giovanna Rizzo","Marco Gasparetti","Marina Falcone","Marina Tavares","Raphael Burleigh","Renata Ambrosio"],"Advogados":["Anike Taucci","Beatriz Armani","Bárbara Yassu","Eduardo Gagliano","Edvânia Cassimiro","Fernanda Rodrigues","Gabriela Ciaramicoli","Graziela Coelho","Luisa Opice","Luiz Gustavo Garcia","Luís Simão","Mariana Ambrósio","Mariana Ferro","Nathalia Caropreso de Almeida","Pietra Maciel","Rafaela Notarbartolo Farina","Rebeca Bizetti","Reynaldo Tufano","Sasha Santos","Verônica Oliveira Corradini","Vitória Franco","Vitória Sardeiro"],"Estagiários":["Ana Clara Carvalho","Ana Clara Domingos","Ana Clara Freitas Oliveira","Beatriz Seragini","Bruno Batista","Camila Alves Barbosa","Camylli Carvalho","Gabriel Ramon C. Camargos","Guilherme Oliveira","Gustavo Lahuerta Pires","Heloisa Pieruzzi","Izabella Machado","Júlia Gusmão Patto","Leonardo Alves Robeldo","Leticia Miranda Ligeri","Luiza Baesso Rocha","Maria Eduarda Russo Chacon","Maria Eduarda de Paschoal","Maria Eduarda Pereira Antunes","Maria Fernanda Cantarin","Mateus Ribeiro Galeano","Suzanna Rodrigues Novaes"],"Administrativo":["Evelyn Chiogna","Francisca Monteiro","Leila Almeida Marques","Marcos Serafim","Meire","Renata Simões","Vanessa Moraes"]};
const DEFAULT_CUSTOM_STATUSES=['Feriado','Licença','Atestado'];
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
function jsonRes(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}})}
async function getEmployees(env){const r=await env.ATTENDANCE.get('employees');return r?JSON.parse(r):DEFAULT_EMPLOYEES}
async function getStatuses(env){const r=await env.ATTENDANCE.get('custom_statuses');return r?JSON.parse(r):DEFAULT_CUSTOM_STATUSES}
async function getVacations(env){const r=await env.ATTENDANCE.get('vacations');return r?JSON.parse(r):[]}
async function getUsers(env){const r=await env.ATTENDANCE.get('app_users');return r?JSON.parse(r):[]}
// Colaboradores desligados: saem das listas ativas (e dos relatórios de presença),
// mas continuam guardados para consulta e relatórios de movimentação.
async function getInactiveEmployees(env){const r=await env.ATTENDANCE.get('employees_inactive');return r?JSON.parse(r):[]}
// Histórico de entradas e saídas por equipe
async function getEmployeeLog(env){const r=await env.ATTENDANCE.get('employees_log');return r?JSON.parse(r):[]}
async function addEmployeeLog(env,entries){
  if(!entries.length)return;
  const log=await getEmployeeLog(env);
  entries.forEach(e=>log.push(e));
  await env.ATTENDANCE.put('employees_log',JSON.stringify(log));
}
function brToday(){return new Date(Date.now()-3*60*60*1000).toISOString().split('T')[0]}
async function getControlIdConfig(env){const r=await env.ATTENDANCE.get('controlid_config');return r?JSON.parse(r):{secret:'',granted_events:'6,7'}}
async function getControlIdMapping(env){const r=await env.ATTENDANCE.get('controlid_mapping');return r?JSON.parse(r):[]}
async function getControlIdLog(env){const r=await env.ATTENDANCE.get('controlid_log');return r?JSON.parse(r):[]}
async function createSession(env,role,name,username,hrAccess,purchAccess){
  const token=crypto.randomUUID();
  await env.ATTENDANCE.put('session:'+token,JSON.stringify({role,name,username,hr_access:!!hrAccess,purch_access:!!purchAccess}));
  return token;
}
async function getSession(env,token){
  const r=await env.ATTENDANCE.get('session:'+token);
  return r?JSON.parse(r):null;
}
// ── RH ESTAGIÁRIOS (módulo com permissão própria) ──
async function getHrInterns(env){const r=await env.ATTENDANCE.get('hr_interns');return r?JSON.parse(r):{}}
async function getHrLibraryIndex(env){const r=await env.ATTENDANCE.get('hr_library_index');return r?JSON.parse(r):[]}
// Pastas fixas (sempre existem) + pastas criadas pelo usuário
const HR_LIB_CATEGORIES=['contratacao','desligamento','procedimentos','contratos_modelo'];
const HR_LIB_FIXED_LABELS={contratacao:'Contratação',desligamento:'Desligamento',procedimentos:'Procedimentos',contratos_modelo:'Contratos Modelo'};
async function getHrLibFolders(env){const r=await env.ATTENDANCE.get('hr_lib_folders');return r?JSON.parse(r):[]}
function hrSlug(name){
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')

    .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
}
async function getHrInternDocsIndex(env,person){const r=await env.ATTENDANCE.get('hr_intern_docs:'+person);return r?JSON.parse(r):[]}
// Tabela de bolsa por ano do curso (editável em Configurações)
const HR_DEFAULT_SALARY_TABLE={'1':1500,'2':1750,'3':2000,'4':2250,'5':2500};
async function getInternSalaryTable(env){
  const r=await env.ATTENDANCE.get('hr_intern_salary_table');
  return r?JSON.parse(r):HR_DEFAULT_SALARY_TABLE;
}
// RH Geral: ficha simplificada de TODOS os colaboradores (todas as equipes)
async function getHrStaff(env){const r=await env.ATTENDANCE.get('hr_staff');return r?JSON.parse(r):{}}
// Pagamentos fora da folha (proporcional de admissão)
async function getPayrollExt(env){const r=await env.ATTENDANCE.get('hr_payroll_ext');return r?JSON.parse(r):[]}

// ── DEPARTAMENTO DE COMPRAS (permissão própria, independente do RH) ──
const PURCH_DEFAULT_CATEGORIES=[
  {id:'material_escritorio',label:'Material de Escritório',desc:'Pilhas, folha sulfite, canetas, borracha, grampos, clips'},
  {id:'perifericos_tecnologicos',label:'Periféricos Tecnológicos',desc:'Mouse, teclado, mousepad, adaptadores, cabos HDMI, suportes'},
  {id:'higiene_limpeza',label:'Higiene e Limpeza',desc:'Sabonete líquido, papel higiênico, produtos de limpeza'},
  {id:'copa',label:'Copa',desc:'Bolachas, chás, café, açúcar, geleia'},
  {id:'manutencao_predial',label:'Manutenção Predial',desc:'Lâmpadas, pequenos reparos, elétrica e hidráulica'},
  {id:'impressos_grafica',label:'Impressos e Gráfica',desc:'Papel timbrado, cartões, envelopes, encadernação'}
];
async function getPurchCategories(env){const r=await env.ATTENDANCE.get('purch_categories');return r?JSON.parse(r):PURCH_DEFAULT_CATEGORIES}
async function getPurchSuppliers(env){const r=await env.ATTENDANCE.get('purch_suppliers');return r?JSON.parse(r):[]}
async function getPurchOrders(env){const r=await env.ATTENDANCE.get('purch_orders');return r?JSON.parse(r):[]}
function purchId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
// Guarda o arquivo binário no KV e confere na hora se o que foi gravado tem o mesmo
// tamanho do que foi recebido — se não tiver, o upload falha com erro claro em vez de
// gravar um arquivo corrompido silenciosamente.
async function putHrFile(env,key,buf){
  await env.ATTENDANCE.put(key,buf);
  const check=await env.ATTENDANCE.get(key,{type:'arrayBuffer'});
  const stored=check?check.byteLength:0;
  if(stored!==buf.byteLength){
    await env.ATTENDANCE.delete(key);
    throw new Error('Falha ao gravar o arquivo (recebido '+buf.byteLength+' bytes, gravado '+stored+' bytes). Tente novamente ou use um arquivo menor.');
  }
  return stored;
}
// O equipamento Control iD grava o horário local (Brasília) já "rotulado" como se fosse UTC
// (não faz a conversão de fuso internamente). Por isso usamos os campos UTC do timestamp
// diretamente — eles já representam o horário local correto, sem precisar de ajuste extra.
function todayStrFromTs(ts){const d=new Date(ts*1000);return d.toISOString().split('T')[0]}
function isoWeek(date){const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()+4-(d.getDay()||7));const y=d.getFullYear();const j=new Date(y,0,1);const w=Math.ceil(((d-j)/86400000+1)/7);return`${y}-W${String(w).padStart(2,'0')}`}
function mondayOf(s){const d=new Date(s+'T12:00:00');const day=d.getDay();const diff=day===0?-6:1-day;d.setDate(d.getDate()+diff);return d.toISOString().split('T')[0]}
function weekDates(m){const dates=[];const md=new Date(m+'T12:00:00');for(let i=0;i<5;i++){const d=new Date(md);d.setDate(md.getDate()+i);dates.push(d.toISOString().split('T')[0])}return dates}
// Preenchimento automático "Home Office" às 20h (Brasília) para quem não lançou nada no dia.
// Brasília é UTC-3 o ano todo (sem horário de verão desde 2019), então subtraímos 3h de
// Date.now() (UTC) para obter a data/dia-da-semana correta em horário local.
async function autoFillHomeOffice(env){
  const brNow=new Date(Date.now()-3*60*60*1000);
  const dow=brNow.getUTCDay(); // 0=domingo,6=sábado (já em horário de Brasília)
  const dateStr=brNow.toISOString().split('T')[0];
  if(dow===0||dow===6)return{ok:true,skipped:true,reason:'fim de semana',date:dateStr};
  const employees=await getEmployees(env);
  const vacations=await getVacations(env);
  const key=`att:${dateStr}`;
  const raw=await env.ATTENDANCE.get(key);
  const existing=raw?JSON.parse(raw):{};
  let filled=0;
  for(const[team,members]of Object.entries(employees)){
    if(!existing[team])existing[team]={};
    for(const person of members){
      if(!existing[team][person]){
        const vac=vacations.find(v=>v.team===team&&v.person===person&&v.start<=dateStr&&v.end>=dateStr);
        if(!vac){existing[team][person]='Home Office';filled++}
      }
    }
  }
  if(filled>0)await env.ATTENDANCE.put(key,JSON.stringify(existing));
  return{ok:true,date:dateStr,filled};
}
export default{async fetch(request,env,ctx){
  const url=new URL(request.url);const method=request.method;
  if(method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{return await handleAPI(url,method,request,env)}catch(err){return jsonRes({error:err.message},500)}
}};
async function handleAPI(url,method,request,env){
  const path=url.pathname.slice(5);const parts=path.split('/').filter(Boolean);

  // ── AUTH ──
  if(parts[0]==='auth'&&method==='POST'){
    const{username,password}=await request.json();
    if(username===SUPERADMIN_USER&&password===SUPERADMIN_PASS){
      const tok=await createSession(env,'superadmin','Superadmin',SUPERADMIN_USER,true,true);
      return jsonRes({token:tok,role:'superadmin',name:'Superadmin',hr_access:true,purch_access:true});
    }
    const users=await getUsers(env);
    const user=users.find(u=>u.username===username&&u.password===password);
    if(user){
      const tok=await createSession(env,user.role||'user',user.name,user.username,user.hr_access,user.purch_access);
      return jsonRes({token:tok,role:user.role||'user',name:user.name,hr_access:!!user.hr_access,purch_access:!!user.purch_access});
    }
    return jsonRes({error:'Usuário ou senha incorretos'},401);
  }

  // ── LOGIN COM MICROSOFT (SSO / Azure AD, opcional — sem auth Bearer) ──
  // Requer as variáveis de ambiente MS_CLIENT_ID, MS_CLIENT_SECRET e MS_TENANT_ID
  // configuradas no Cloudflare Pages (Settings → Environment variables).
  if(parts[0]==='auth'&&parts[1]==='microsoft'&&parts[2]==='login'&&method==='GET'){
    if(!env.MS_CLIENT_ID||!env.MS_TENANT_ID)return jsonRes({error:'Login com Microsoft não configurado.'},500);
    const state=crypto.randomUUID();
    await env.ATTENDANCE.put('msauth_state:'+state,'1',{expirationTtl:300});
    const redirectUri=url.origin+'/api/auth/microsoft/callback';
    const authUrl='https://login.microsoftonline.com/'+env.MS_TENANT_ID+'/oauth2/v2.0/authorize'
      +'?client_id='+encodeURIComponent(env.MS_CLIENT_ID)
      +'&response_type=code'
      +'&redirect_uri='+encodeURIComponent(redirectUri)
      +'&response_mode=query'
      +'&scope='+encodeURIComponent('openid profile email User.Read')
      +'&state='+state;
    return new Response(null,{status:302,headers:{Location:authUrl}});
  }

  if(parts[0]==='auth'&&parts[1]==='microsoft'&&parts[2]==='callback'&&method==='GET'){
    const fail=(msg)=>new Response(null,{status:302,headers:{Location:url.origin+'/?msauth_error='+encodeURIComponent(msg)}});
    const code=url.searchParams.get('code');
    const state=url.searchParams.get('state');
    if(!code||!state)return fail('Login com Microsoft cancelado ou inválido.');
    const stateKey='msauth_state:'+state;
    const stateOk=await env.ATTENDANCE.get(stateKey);
    if(!stateOk)return fail('Sessão de login expirada, tente novamente.');
    await env.ATTENDANCE.delete(stateKey);
    try{
      const redirectUri=url.origin+'/api/auth/microsoft/callback';
      const tokenRes=await fetch('https://login.microsoftonline.com/'+env.MS_TENANT_ID+'/oauth2/v2.0/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,code,redirect_uri:redirectUri,grant_type:'authorization_code',scope:'openid profile email User.Read'})
      });
      const tokenData=await tokenRes.json();
      if(!tokenData.access_token)return fail('Não foi possível concluir o login com Microsoft.');
      const meRes=await fetch('https://graph.microsoft.com/v1.0/me',{headers:{Authorization:'Bearer '+tokenData.access_token}});
      const me=await meRes.json();
      const email=(me.mail||me.userPrincipalName||'').toLowerCase();
      if(!email)return fail('Não foi possível obter seu e-mail da Microsoft.');
      let role=null,name=null,hrAccess=false,purchAccess=false;
      if(env.SUPERADMIN_MICROSOFT_EMAIL&&email===env.SUPERADMIN_MICROSOFT_EMAIL.toLowerCase()){
        role='superadmin';name='Superadmin';hrAccess=true;purchAccess=true;
      }else{
        const users=await getUsers(env);
        const match=users.find(u=>u.microsoft_email&&u.microsoft_email.toLowerCase()===email);
        if(match){role=match.role||'user';name=match.name;hrAccess=!!match.hr_access;purchAccess=!!match.purch_access;}
      }
      if(!role)return fail('Sua conta Microsoft ('+email+') não está associada a nenhum usuário do VPoint. Peça ao administrador para vincular seu e-mail em Configurações → Usuários.');
      const tok=await createSession(env,role,name,email,hrAccess,purchAccess);
      return new Response(null,{status:302,headers:{Location:url.origin+'/?msauth=1&token='+encodeURIComponent(tok)+'&role='+encodeURIComponent(role)+'&name='+encodeURIComponent(name)+'&hr_access='+(hrAccess?'1':'0')+'&purch_access='+(purchAccess?'1':'0')}});
    }catch(e){
      return fail('Erro ao conectar com a Microsoft: '+e.message);
    }
  }

  // ── CONTROL ID WEBHOOK (sem auth Bearer — protegido pelo secret na URL) ──
  // O equipamento acrescenta um sufixo ao path configurado (ex: /dao, /device_is_alive, /door).
  // Aceitamos qualquer sufixo após o secret e só processamos quando fizer sentido (object_changes presente).
  if(parts[0]==='controlid'&&parts[1]==='webhook'&&parts[2]&&method==='POST'){
    const cfg=await getControlIdConfig(env);
    if(!cfg.secret||parts[2]!==cfg.secret)return jsonRes({error:'Secret inválido'},403);
    let body;
    try{body=await request.json()}catch{return jsonRes({ok:true})} // ack mesmo se payload vazio/estranho (ex: device_is_alive)
    const changes=body.object_changes||[];
    if(!changes.length)return jsonRes({ok:true}); // outros tipos de evento (device_is_alive, door, etc.) — apenas confirma recebimento
    const mapping=await getControlIdMapping(env);
    const grantedEvents=(cfg.granted_events||'').split(',').map(s=>s.trim()).filter(Boolean);
    const log=await getControlIdLog(env);
    for(const change of changes){
      if(change.object!=='access_logs'||change.type!=='inserted')continue;
      const v=change.values||{};
      const eventCode=String(v.event??'');
      const controlidUserId=String(v.user_id??'');
      const ts=parseInt(v.time||Date.now()/1000);
      const map=mapping.find(m=>String(m.controlid_user_id)===controlidUserId);
      const matched=!!map;
      const granted=grantedEvents.length===0||grantedEvents.includes(eventCode);
      let marked=false;
      if(matched&&granted){
        const dateStr=todayStrFromTs(ts);
        const key=`att:${dateStr}`;
        const existingRaw=await env.ATTENDANCE.get(key);
        const existing=existingRaw?JSON.parse(existingRaw):{};
        if(!existing[map.team])existing[map.team]={};
        existing[map.team][map.person]='Presente';
        await env.ATTENDANCE.put(key,JSON.stringify(existing));
        marked=true;
      }
      log.unshift({time:ts,event:eventCode,controlid_user_id:controlidUserId,matched,person:map?map.person:null,team:map?map.team:null,marked});
    }
    await env.ATTENDANCE.put('controlid_log',JSON.stringify(log.slice(0,50)));
    return jsonRes({ok:true});
  }

  // ── TAREFAS AUTOMÁTICAS (cron-job.org) ──
  // Autenticadas pelo CRON_TOKEN, antes da checagem de sessão: como não dependem de
  // login, continuam funcionando mesmo quando nenhuma sessão de usuário está ativa.
  if(parts[0]==='cron'){
    const cronAuth=(request.headers.get('Authorization')||'').replace('Bearer ','').trim();
    const cronOk=cronAuth===CRON_TOKEN||(env.CRON_TOKEN&&cronAuth===env.CRON_TOKEN);
    if(!cronOk)return jsonRes({error:'Não autorizado'},401);
    if(parts[1]==='auto-fill-home-office'&&method==='POST')return jsonRes(await autoFillHomeOffice(env));
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ── TOKEN CHECK ──
  const token=(request.headers.get('Authorization')||'').replace('Bearer ','');
  const session=token?await getSession(env,token):null;
  if(!session)return jsonRes({error:'Não autorizado'},401);
  const currentRole=session.role||'user';
  const hasHrAccess=currentRole==='superadmin'||!!session.hr_access;
  const hasPurchAccess=currentRole==='superadmin'||!!session.purch_access;

  // ── CONTROL ID CONFIG / MAPPING / LOG (autenticado) ──
  if(parts[0]==='controlid'&&parts[1]==='config'&&method==='GET')return jsonRes(await getControlIdConfig(env));
  if(parts[0]==='controlid'&&parts[1]==='config'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('controlid_config',JSON.stringify(b));return jsonRes({ok:true})}
  if(parts[0]==='controlid'&&parts[1]==='mapping'&&method==='GET')return jsonRes(await getControlIdMapping(env));
  if(parts[0]==='controlid'&&parts[1]==='mapping'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('controlid_mapping',JSON.stringify(b));return jsonRes({ok:true})}
  if(parts[0]==='controlid'&&parts[1]==='log'&&method==='GET')return jsonRes(await getControlIdLog(env));

  // ── USERS (superadmin only by convention) ──
  if(parts[0]==='users'&&method==='GET'){
    const users=await getUsers(env);
    return jsonRes(users.map(u=>({id:u.id,username:u.username,name:u.name,microsoft_email:u.microsoft_email||'',role:u.role||'user',hr_access:!!u.hr_access,purch_access:!!u.purch_access})));
  }
  if(parts[0]==='users'&&method==='POST'){
    const{username,password,name,microsoft_email,role,hr_access,purch_access}=await request.json();
    if(!username||!password||!name)return jsonRes({error:'Campos obrigatórios faltando'},400);
    if(username===SUPERADMIN_USER)return jsonRes({error:'Nome de usuário reservado'},400);
    if(role&&role!=='user'&&role!=='superadmin')return jsonRes({error:'Tipo de acesso inválido'},400);
    const users=await getUsers(env);
    if(users.find(u=>u.username===username))return jsonRes({error:'Usuário já existe'},400);
    const newUser={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),username,password,name,microsoft_email:microsoft_email||'',role:role==='superadmin'?'superadmin':'user',hr_access:!!hr_access,purch_access:!!purch_access};
    users.push(newUser);
    await env.ATTENDANCE.put('app_users',JSON.stringify(users));
    return jsonRes({ok:true,id:newUser.id});
  }
  if(parts[0]==='users'&&parts[1]&&method==='PUT'){
    const{password,name,microsoft_email,role,hr_access,purch_access}=await request.json();
    if(role&&role!=='user'&&role!=='superadmin')return jsonRes({error:'Tipo de acesso inválido'},400);
    const users=await getUsers(env);
    const idx=users.findIndex(u=>u.id===parts[1]);
    if(idx===-1)return jsonRes({error:'Usuário não encontrado'},404);
    if(password)users[idx].password=password;
    if(name)users[idx].name=name;
    if(microsoft_email!==undefined)users[idx].microsoft_email=microsoft_email;
    if(role)users[idx].role=role;
    if(hr_access!==undefined)users[idx].hr_access=!!hr_access;
    if(purch_access!==undefined)users[idx].purch_access=!!purch_access;
    await env.ATTENDANCE.put('app_users',JSON.stringify(users));
    return jsonRes({ok:true});
  }
  if(parts[0]==='users'&&parts[1]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode excluir usuários definitivamente.'},403);
    let users=await getUsers(env);
    users=users.filter(u=>u.id!==parts[1]);
    await env.ATTENDANCE.put('app_users',JSON.stringify(users));
    return jsonRes({ok:true});
  }

  // ── RH ESTAGIÁRIOS (permissão própria: hasHrAccess) ──
  if(parts[0]==='hr'&&parts[1]==='interns'&&!parts[2]&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const emp=await getEmployees(env);
    const list=emp['Estagiários']||[];
    const records=await getHrInterns(env);
    const out=list.map(person=>({person,...(records[person]||{semester:'',contract_start:'',contract_end:'',salary:'',birth_date:'',cpf:'',rg:'',phone:'',personal_email:'',address:'',cep:'',street:'',number:'',complement:'',district:'',city:'',state:'',school:'',course:'',course_start:'',supervisor:''})}));
    return jsonRes(out);
  }
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&!parts[3]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    const body=await request.json();
    const records=await getHrInterns(env);
    records[person]={
      semester:body.semester||'',contract_start:body.contract_start||'',contract_end:body.contract_end||'',
      salary:body.salary||'',birth_date:body.birth_date||'',cpf:body.cpf||'',rg:body.rg||'',phone:body.phone||'',personal_email:body.personal_email||'',
      address:body.address||'',cep:body.cep||'',street:body.street||'',number:body.number||'',
      complement:body.complement||'',district:body.district||'',city:body.city||'',state:body.state||'',
      school:body.school||'',course:body.course||'',course_start:body.course_start||'',supervisor:body.supervisor||''
    };
    await env.ATTENDANCE.put('hr_interns',JSON.stringify(records));
    return jsonRes({ok:true});
  }

  // ── RH GERAL: todos os colaboradores (dados básicos) ──
  if(parts[0]==='hr'&&parts[1]==='staff'&&!parts[2]&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const emp=await getEmployees(env);
    const records=await getHrStaff(env);
    const out=[];
    for(const[team,members]of Object.entries(emp)){
      for(const person of members){
        const rec=records[person]||{};
        out.push({person,team,
          birth_date:rec.birth_date||'',
          phone:rec.phone||'',
          role:rec.role||'',
          admission_date:rec.admission_date||'',
          cpf:rec.cpf||'',rg:rec.rg||'',
          cep:rec.cep||'',street:rec.street||'',number:rec.number||'',
          complement:rec.complement||'',district:rec.district||'',
          city:rec.city||'',state:rec.state||''});
      }
    }
    return jsonRes(out);
  }
  if(parts[0]==='hr'&&parts[1]==='staff'&&parts[2]&&!parts[3]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    const body=await request.json();
    const records=await getHrStaff(env);
    records[person]={
      birth_date:body.birth_date||'',
      phone:body.phone||'',
      role:body.role||'',
      admission_date:body.admission_date||'',
      cpf:body.cpf||'',rg:body.rg||'',
      cep:body.cep||'',street:body.street||'',number:body.number||'',
      complement:body.complement||'',district:body.district||'',
      city:body.city||'',state:body.state||''
    };
    await env.ATTENDANCE.put('hr_staff',JSON.stringify(records));
    return jsonRes({ok:true});
  }

  // ── TABELA DE BOLSA POR ANO DO CURSO ──
  if(parts[0]==='hr'&&parts[1]==='intern-salary-table'&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    return jsonRes(await getInternSalaryTable(env));
  }
  if(parts[0]==='hr'&&parts[1]==='intern-salary-table'&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode alterar a tabela de bolsas.'},403);
    const b=await request.json();
    const table={};
    for(const ano of ['1','2','3','4','5']){
      const v=Number(b[ano]);
      table[ano]=isNaN(v)||v<0?0:v;
    }
    await env.ATTENDANCE.put('hr_intern_salary_table',JSON.stringify(table));
    return jsonRes({ok:true,table});
  }

  // ── PAGAMENTOS FORA DA FOLHA (proporcional de admissão) ──
  if(parts[0]==='hr'&&parts[1]==='payroll-ext'&&!parts[2]&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    return jsonRes(await getPayrollExt(env));
  }
  if(parts[0]==='hr'&&parts[1]==='payroll-ext'&&!parts[2]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const b=await request.json();
    if(!b.admissao||!b.referencia)return jsonRes({error:'Informe a data de admissão e o mês de referência.'},400);
    const list=await getPayrollExt(env);
    const rec={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:b.tipo==='advogado'?'advogado':'estagiario',
      nome:String(b.nome||'').trim()||'(sem nome)',
      admissao:b.admissao,referencia:b.referencia,
      salario:Number(b.salario)||0,
      vt:b.vt===null||b.vt===undefined||b.vt===''?null:Number(b.vt),
      dias_corridos:Number(b.dias_corridos)||0,
      dias_uteis:Number(b.dias_uteis)||0,
      salario_proporcional:Number(b.salario_proporcional)||0,
      valor_vt:Number(b.valor_vt)||0,
      total:Number(b.total)||0,
      pago:false,
      created_at:new Date().toISOString(),created_by:session.name||''
    };
    list.push(rec);
    await env.ATTENDANCE.put('hr_payroll_ext',JSON.stringify(list));
    return jsonRes({ok:true,id:rec.id});
  }
  if(parts[0]==='hr'&&parts[1]==='payroll-ext'&&parts[2]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const b=await request.json();
    const list=await getPayrollExt(env);
    const i=list.findIndex(r=>r.id===parts[2]);
    if(i===-1)return jsonRes({error:'Registro não encontrado.'},404);
    if(b.pago!==undefined)list[i].pago=!!b.pago;
    await env.ATTENDANCE.put('hr_payroll_ext',JSON.stringify(list));
    return jsonRes({ok:true});
  }
  if(parts[0]==='hr'&&parts[1]==='payroll-ext'&&parts[2]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    let list=await getPayrollExt(env);
    if(!list.find(r=>r.id===parts[2]))return jsonRes({error:'Registro não encontrado.'},404);
    list=list.filter(r=>r.id!==parts[2]);
    await env.ATTENDANCE.put('hr_payroll_ext',JSON.stringify(list));
    return jsonRes({ok:true});
  }

  // ── RH: DOCUMENTOS INDIVIDUAIS POR ESTAGIÁRIO ──
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&parts[3]==='docs'&&!parts[4]&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    return jsonRes(await getHrInternDocsIndex(env,person));
  }
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&parts[3]==='docs'&&!parts[4]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    const form=await request.formData();
    // Aceita vários arquivos de uma vez. O nome do documento é o próprio nome do arquivo.
    const files=form.getAll('file').filter(f=>f&&typeof f!=='string');
    if(!files.length)return jsonRes({error:'Selecione ao menos um arquivo.'},400);
    const index=await getHrInternDocsIndex(env,person);
    const ids=[];
    for(const file of files){
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      const buf=await file.arrayBuffer();
      try{await putHrFile(env,'hr_intern_doc_file:'+id,buf)}
      catch(e){return jsonRes({error:'Falha ao enviar "'+file.name+'": '+e.message},500)}
      index.unshift({id,name:file.name,filename:file.name,
        mimetype:file.type||'application/octet-stream',size:buf.byteLength,
        uploaded_at:new Date().toISOString()});
      ids.push(id);
    }
    await env.ATTENDANCE.put('hr_intern_docs:'+person,JSON.stringify(index));
    return jsonRes({ok:true,ids,count:ids.length});
  }
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&parts[3]==='docs'&&parts[4]&&parts[5]==='download'&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    const index=await getHrInternDocsIndex(env,person);
    const meta=index.find(f=>f.id===parts[4]);
    if(!meta)return jsonRes({error:'Arquivo não encontrado.'},404);
    const buf=await env.ATTENDANCE.get('hr_intern_doc_file:'+parts[4],{type:'arrayBuffer'});
    if(!buf)return jsonRes({error:'Arquivo não encontrado.'},404);
    return new Response(buf,{status:200,headers:{...CORS,'Content-Type':meta.mimetype,'Content-Length':String(buf.byteLength),'X-Expected-Size':String(meta.size||''),'X-Actual-Size':String(buf.byteLength),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.filename)}});
  }
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&parts[3]==='docs'&&parts[4]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    let index=await getHrInternDocsIndex(env,person);
    index=index.filter(f=>f.id!==parts[4]);
    await env.ATTENDANCE.put('hr_intern_docs:'+person,JSON.stringify(index));
    await env.ATTENDANCE.delete('hr_intern_doc_file:'+parts[4]);
    return jsonRes({ok:true});
  }

  if(parts[0]==='hr'&&parts[1]==='library'&&!parts[2]&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const files=await getHrLibraryIndex(env);
    const custom=await getHrLibFolders(env);
    const folders=[
      ...HR_LIB_CATEGORIES.map(id=>({id,label:HR_LIB_FIXED_LABELS[id],parent:'',fixed:true})),
      ...custom.map(f=>({...f,parent:f.parent||'',fixed:false}))
    ];
    return jsonRes({folders,files});
  }

  // ── PASTAS DA BIBLIOTECA (criar / renomear / excluir) ──
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]==='folders'&&!parts[3]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const{label,parent}=await request.json();
    const name=String(label||'').trim();
    const parentId=String(parent||'');
    if(!name)return jsonRes({error:'Informe o nome da pasta.'},400);
    const folders=await getHrLibFolders(env);
    // valida a pasta-mãe (vazio = raiz)
    if(parentId&&!HR_LIB_CATEGORIES.includes(parentId)&&!folders.find(f=>f.id===parentId))
      return jsonRes({error:'Pasta de destino não encontrada.'},404);
    // o id inclui o caminho, então o mesmo nome pode existir em pastas diferentes
    const base=hrSlug(name);
    if(!base)return jsonRes({error:'Nome de pasta inválido.'},400);
    const id=parentId?parentId+'/'+base:base;
    if(HR_LIB_CATEGORIES.includes(id))return jsonRes({error:'Já existe uma pasta com esse nome aqui.'},400);
    if(folders.find(f=>f.id===id))return jsonRes({error:'Já existe uma pasta com esse nome aqui.'},400);
    folders.push({id,label:name,parent:parentId});
    await env.ATTENDANCE.put('hr_lib_folders',JSON.stringify(folders));
    return jsonRes({ok:true,id,label:name,parent:parentId});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]==='folders'&&parts[3]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const{label}=await request.json();
    const name=String(label||'').trim();
    if(!name)return jsonRes({error:'Informe o nome da pasta.'},400);
    const fid=decodeURIComponent(parts[3]);
    const folders=await getHrLibFolders(env);
    const f=folders.find(x=>x.id===fid);
    if(!f)return jsonRes({error:'Pasta não encontrada.'},404);
    f.label=name;
    await env.ATTENDANCE.put('hr_lib_folders',JSON.stringify(folders));
    return jsonRes({ok:true});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]==='folders'&&parts[3]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const id=decodeURIComponent(parts[3]);
    if(HR_LIB_CATEGORIES.includes(id))return jsonRes({error:'As pastas padrão não podem ser excluídas.'},400);
    const files=await getHrLibraryIndex(env);
    if(files.some(f=>f.category===id))return jsonRes({error:'Esvazie a pasta antes de excluí-la.'},400);
    let folders=await getHrLibFolders(env);
    if(!folders.find(f=>f.id===id))return jsonRes({error:'Pasta não encontrada.'},404);
    if(folders.some(f=>f.parent===id))return jsonRes({error:'Exclua as subpastas antes de excluir esta pasta.'},400);
    folders=folders.filter(f=>f.id!==id);
    await env.ATTENDANCE.put('hr_lib_folders',JSON.stringify(folders));
    return jsonRes({ok:true});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&!parts[2]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const form=await request.formData();
    const file=form.get('file');
    const name=(form.get('name')||'').toString();
    const category=(form.get('category')||'').toString();
    const customFolders=await getHrLibFolders(env);
    const validFolder=HR_LIB_CATEGORIES.includes(category)||customFolders.some(f=>f.id===category);
    if(!category||!validFolder)return jsonRes({error:'Pasta inválida.'},400);
    if(!name||!file||typeof file==='string')return jsonRes({error:'Campos obrigatórios faltando.'},400);
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    const buf=await file.arrayBuffer();
    try{await putHrFile(env,'hr_lib_file:'+id,buf)}catch(e){return jsonRes({error:e.message},500)}
    const index=await getHrLibraryIndex(env);
    index.unshift({id,category,name,filename:file.name,mimetype:file.type||'application/octet-stream',size:buf.byteLength,uploaded_at:new Date().toISOString()});
    await env.ATTENDANCE.put('hr_library_index',JSON.stringify(index));
    return jsonRes({ok:true,id});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]&&parts[3]==='download'&&method==='GET'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const index=await getHrLibraryIndex(env);
    const meta=index.find(f=>f.id===parts[2]);
    if(!meta)return jsonRes({error:'Arquivo não encontrado.'},404);
    const buf=await env.ATTENDANCE.get('hr_lib_file:'+parts[2],{type:'arrayBuffer'});
    if(!buf)return jsonRes({error:'Arquivo não encontrado.'},404);
    return new Response(buf,{status:200,headers:{...CORS,'Content-Type':meta.mimetype,'Content-Length':String(buf.byteLength),'X-Expected-Size':String(meta.size||''),'X-Actual-Size':String(buf.byteLength),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.filename)}});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]&&parts[2]!=='folders'&&!parts[3]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    let index=await getHrLibraryIndex(env);
    index=index.filter(f=>f.id!==parts[2]);
    await env.ATTENDANCE.put('hr_library_index',JSON.stringify(index));
    await env.ATTENDANCE.delete('hr_lib_file:'+parts[2]);
    return jsonRes({ok:true});
  }

  // ══ DEPARTAMENTO DE COMPRAS (permissão purch_access, separada do RH) ══
  if(parts[0]==='purch'){
    if(!hasPurchAccess)return jsonRes({error:'Sem acesso ao Departamento de Compras.'},403);

    // ── DEPARTAMENTOS / CATEGORIAS ──
    if(parts[1]==='categories'&&!parts[2]&&method==='GET')return jsonRes(await getPurchCategories(env));
    if(parts[1]==='categories'&&!parts[2]&&method==='POST'){
      const{label,desc}=await request.json();
      const name=String(label||'').trim();
      if(!name)return jsonRes({error:'Informe o nome do departamento.'},400);
      const id=hrSlug(name);
      if(!id)return jsonRes({error:'Nome inválido.'},400);
      const cats=await getPurchCategories(env);
      if(cats.find(c=>c.id===id))return jsonRes({error:'Já existe um departamento com esse nome.'},400);
      cats.push({id,label:name,desc:String(desc||'').trim()});
      await env.ATTENDANCE.put('purch_categories',JSON.stringify(cats));
      return jsonRes({ok:true,id});
    }
    if(parts[1]==='categories'&&parts[2]&&method==='PUT'){
      const{label,desc}=await request.json();
      const cats=await getPurchCategories(env);
      const c=cats.find(x=>x.id===decodeURIComponent(parts[2]));
      if(!c)return jsonRes({error:'Departamento não encontrado.'},404);
      if(label!==undefined)c.label=String(label).trim()||c.label;
      if(desc!==undefined)c.desc=String(desc).trim();
      await env.ATTENDANCE.put('purch_categories',JSON.stringify(cats));
      return jsonRes({ok:true});
    }
    if(parts[1]==='categories'&&parts[2]&&method==='DELETE'){
      const id=decodeURIComponent(parts[2]);
      const orders=await getPurchOrders(env);
      const sups=await getPurchSuppliers(env);
      if(orders.some(o=>o.category===id))return jsonRes({error:'Existem pedidos neste departamento.'},400);
      if(sups.some(s=>s.category===id))return jsonRes({error:'Existem fornecedores neste departamento.'},400);
      let cats=await getPurchCategories(env);
      if(!cats.find(c=>c.id===id))return jsonRes({error:'Departamento não encontrado.'},404);
      cats=cats.filter(c=>c.id!==id);
      await env.ATTENDANCE.put('purch_categories',JSON.stringify(cats));
      return jsonRes({ok:true});
    }

    // ── FORNECEDORES ──
    if(parts[1]==='suppliers'&&!parts[2]&&method==='GET')return jsonRes(await getPurchSuppliers(env));
    if(parts[1]==='suppliers'&&!parts[2]&&method==='POST'){
      const b=await request.json();
      if(!String(b.name||'').trim())return jsonRes({error:'Informe o nome do fornecedor.'},400);
      const sups=await getPurchSuppliers(env);
      const sup={id:purchId(),
        name:String(b.name).trim(),category:b.category||'',contact:b.contact||'',
        phone:b.phone||'',whatsapp:b.whatsapp||'',email:b.email||'',site:b.site||'',
        cnpj:b.cnpj||'',address:b.address||'',payment:b.payment||'',delivery:b.delivery||'',
        notes:b.notes||'',created_at:new Date().toISOString()};
      sups.push(sup);
      await env.ATTENDANCE.put('purch_suppliers',JSON.stringify(sups));
      return jsonRes({ok:true,id:sup.id});
    }
    if(parts[1]==='suppliers'&&parts[2]&&method==='PUT'){
      const b=await request.json();
      const sups=await getPurchSuppliers(env);
      const i=sups.findIndex(s=>s.id===parts[2]);
      if(i===-1)return jsonRes({error:'Fornecedor não encontrado.'},404);
      ['name','category','contact','phone','whatsapp','email','site','cnpj','address','payment','delivery','notes']
        .forEach(k=>{if(b[k]!==undefined)sups[i][k]=b[k]});
      await env.ATTENDANCE.put('purch_suppliers',JSON.stringify(sups));
      return jsonRes({ok:true});
    }
    if(parts[1]==='suppliers'&&parts[2]&&method==='DELETE'){
      let sups=await getPurchSuppliers(env);
      if(!sups.find(s=>s.id===parts[2]))return jsonRes({error:'Fornecedor não encontrado.'},404);
      sups=sups.filter(s=>s.id!==parts[2]);
      await env.ATTENDANCE.put('purch_suppliers',JSON.stringify(sups));
      return jsonRes({ok:true});
    }

    // ── PEDIDOS DE COMPRA ──
    if(parts[1]==='orders'&&!parts[2]&&method==='GET')return jsonRes(await getPurchOrders(env));
    if(parts[1]==='orders'&&!parts[2]&&method==='POST'){
      const b=await request.json();
      if(!String(b.item||'').trim())return jsonRes({error:'Informe o item.'},400);
      if(!b.date)return jsonRes({error:'Informe a data.'},400);
      const qty=Number(b.qty)||0, price=Number(b.unit_price)||0;
      const orders=await getPurchOrders(env);
      const o={id:purchId(),date:b.date,category:b.category||'',supplier_id:b.supplier_id||'',
        item:String(b.item).trim(),qty,unit:b.unit||'un',unit_price:price,total:+(qty*price).toFixed(2),
        status:b.status||'Solicitado',requester:b.requester||'',invoice:b.invoice||'',notes:b.notes||'',
        created_at:new Date().toISOString(),created_by:session.name||''};
      orders.push(o);
      await env.ATTENDANCE.put('purch_orders',JSON.stringify(orders));
      return jsonRes({ok:true,id:o.id});
    }
    if(parts[1]==='orders'&&parts[2]&&method==='PUT'){
      const b=await request.json();
      const orders=await getPurchOrders(env);
      const i=orders.findIndex(o=>o.id===parts[2]);
      if(i===-1)return jsonRes({error:'Pedido não encontrado.'},404);
      ['date','category','supplier_id','item','unit','status','requester','invoice','notes']
        .forEach(k=>{if(b[k]!==undefined)orders[i][k]=b[k]});
      if(b.qty!==undefined)orders[i].qty=Number(b.qty)||0;
      if(b.unit_price!==undefined)orders[i].unit_price=Number(b.unit_price)||0;
      orders[i].total=+((orders[i].qty||0)*(orders[i].unit_price||0)).toFixed(2);
      await env.ATTENDANCE.put('purch_orders',JSON.stringify(orders));
      return jsonRes({ok:true});
    }
    if(parts[1]==='orders'&&parts[2]&&method==='DELETE'){
      let orders=await getPurchOrders(env);
      if(!orders.find(o=>o.id===parts[2]))return jsonRes({error:'Pedido não encontrado.'},404);
      orders=orders.filter(o=>o.id!==parts[2]);
      await env.ATTENDANCE.put('purch_orders',JSON.stringify(orders));
      return jsonRes({ok:true});
    }

    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ── EMPLOYEES ──
  if(parts[0]==='employees'&&!parts[1]&&method==='GET')return jsonRes(await getEmployees(env));
  // Ao salvar a lista, registra automaticamente quem entrou (admissão) e quem foi
  // retirado sem passar pelo desligamento formal (correção de cadastro).
  if(parts[0]==='employees'&&!parts[1]&&method==='PUT'){
    const b=await request.json();
    const old=await getEmployees(env);
    const today=brToday(),at=new Date().toISOString(),by=session.name||'';
    const events=[];
    for(const[team,members]of Object.entries(b)){
      const before=old[team]||[];
      members.filter(p=>!before.includes(p)).forEach(person=>
        events.push({type:'admissao',person,team,date:today,at,by}));
    }
    for(const[team,members]of Object.entries(old)){
      const now=b[team]||[];
      members.filter(p=>!now.includes(p)).forEach(person=>
        events.push({type:'removido',person,team,date:today,at,by}));
    }
    await env.ATTENDANCE.put('employees',JSON.stringify(b));
    await addEmployeeLog(env,events);
    return jsonRes({ok:true,admissoes:events.filter(e=>e.type==='admissao').length,removidos:events.filter(e=>e.type==='removido').length});
  }

  // ── DESLIGAMENTO (mantém o histórico, tira das listas ativas) ──
  if(parts[0]==='employees'&&parts[1]==='terminate'&&method==='POST'){
    const{person,team,date,reason,notes}=await request.json();
    if(!person||!team)return jsonRes({error:'Informe o colaborador e a equipe.'},400);
    const emp=await getEmployees(env);
    if(!emp[team]||!emp[team].includes(person))return jsonRes({error:'Colaborador não encontrado nesta equipe.'},404);
    emp[team]=emp[team].filter(p=>p!==person);
    await env.ATTENDANCE.put('employees',JSON.stringify(emp));
    const inactive=await getInactiveEmployees(env);
    const termDate=date||brToday();
    inactive.push({person,team,date:termDate,reason:reason||'',notes:notes||'',
      at:new Date().toISOString(),by:session.name||''});
    await env.ATTENDANCE.put('employees_inactive',JSON.stringify(inactive));
    await addEmployeeLog(env,[{type:'desligamento',person,team,date:termDate,reason:reason||'',at:new Date().toISOString(),by:session.name||''}]);
    return jsonRes({ok:true});
  }

  // ── LISTA DE DESLIGADOS ──
  if(parts[0]==='employees'&&parts[1]==='inactive'&&!parts[2]&&method==='GET')
    return jsonRes(await getInactiveEmployees(env));

  // ── REATIVAR (recontratação / correção) ──
  if(parts[0]==='employees'&&parts[1]==='reactivate'&&method==='POST'){
    const{person,team}=await request.json();
    if(!person)return jsonRes({error:'Informe o colaborador.'},400);
    let inactive=await getInactiveEmployees(env);
    const rec=inactive.find(r=>r.person===person);
    if(!rec)return jsonRes({error:'Colaborador não está na lista de desligados.'},404);
    const destTeam=team||rec.team;
    const emp=await getEmployees(env);
    if(!emp[destTeam])return jsonRes({error:'Equipe inválida.'},400);
    if(emp[destTeam].includes(person))return jsonRes({error:'Já existe alguém com esse nome nesta equipe.'},400);
    emp[destTeam].push(person);
    emp[destTeam].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    await env.ATTENDANCE.put('employees',JSON.stringify(emp));
    inactive=inactive.filter(r=>r.person!==person);
    await env.ATTENDANCE.put('employees_inactive',JSON.stringify(inactive));
    await addEmployeeLog(env,[{type:'admissao',person,team:destTeam,date:brToday(),
      reason:'reativação',at:new Date().toISOString(),by:session.name||''}]);
    return jsonRes({ok:true,team:destTeam});
  }

  // ── EXCLUIR DEFINITIVAMENTE UM DESLIGADO (somente superadmin) ──
  if(parts[0]==='employees'&&parts[1]==='inactive'&&parts[2]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode excluir definitivamente.'},403);
    const person=decodeURIComponent(parts[2]);
    let inactive=await getInactiveEmployees(env);
    if(!inactive.find(r=>r.person===person))return jsonRes({error:'Registro não encontrado.'},404);
    inactive=inactive.filter(r=>r.person!==person);
    await env.ATTENDANCE.put('employees_inactive',JSON.stringify(inactive));
    await addEmployeeLog(env,[{type:'excluido',person,team:'',date:brToday(),
      at:new Date().toISOString(),by:session.name||''}]);
    return jsonRes({ok:true});
  }

  // ── HISTÓRICO DE MOVIMENTAÇÃO (admissões e desligamentos) ──
  if(parts[0]==='employees'&&parts[1]==='log'&&!parts[2]&&method==='GET')
    return jsonRes(await getEmployeeLog(env));

  // ── CARGA INICIAL DO HISTÓRICO (usa as datas de admissão já cadastradas) ──
  // Não duplica: ignora quem já tem admissão registrada no log.
  if(parts[0]==='employees'&&parts[1]==='log'&&parts[2]==='backfill'&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode fazer a carga inicial.'},403);
    const{entries}=await request.json();
    if(!Array.isArray(entries))return jsonRes({error:'Formato inválido.'},400);
    const log=await getEmployeeLog(env);
    const jaTem=new Set(log.filter(e=>e.type==='admissao').map(e=>e.person));
    const at=new Date().toISOString(),by=session.name||'';
    let added=0,skipped=0;
    for(const e of entries){
      const person=String(e.person||'').trim();
      const team=String(e.team||'').trim();
      const date=String(e.date||'').trim();
      if(!person||!team||!date){skipped++;continue}
      if(jaTem.has(person)){skipped++;continue}
      log.push({type:'admissao',person,team,date,reason:'carga inicial',at,by});
      jaTem.add(person);added++;
    }
    if(added)await env.ATTENDANCE.put('employees_log',JSON.stringify(log));
    return jsonRes({ok:true,added,skipped});
  }

  // ── MIGRAR COLABORADOR DE EQUIPE (ex: Estagiário -> Advogado), preservando o histórico ──
  if(parts[0]==='employees'&&parts[1]==='move'&&method==='POST'){
    const{person,from,to}=await request.json();
    if(!person||!from||!to)return jsonRes({error:'Informe colaborador, equipe de origem e destino.'},400);
    if(from===to)return jsonRes({error:'A equipe de destino é a mesma da atual.'},400);
    const emp=await getEmployees(env);
    if(!emp[from]||!emp[from].includes(person))return jsonRes({error:'Colaborador não encontrado na equipe de origem.'},404);
    if(!emp[to])return jsonRes({error:'Equipe de destino inválida.'},400);
    if(emp[to].includes(person))return jsonRes({error:'Já existe alguém com esse nome na equipe de destino.'},400);

    // 1) move na lista de colaboradores
    emp[from]=emp[from].filter(p=>p!==person);
    emp[to].push(person);
    emp[to].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    await env.ATTENDANCE.put('employees',JSON.stringify(emp));

    // 2) move o histórico de presença (att:YYYY-MM-DD) para a nova equipe
    let daysMoved=0;
    let cursor,done=false;
    while(!done){
      const listed=await env.ATTENDANCE.list({prefix:'att:',cursor});
      for(const{name}of listed.keys){
        const raw=await env.ATTENDANCE.get(name);
        if(!raw)continue;
        const day=JSON.parse(raw);
        if(day[from]&&day[from][person]!==undefined){
          const status=day[from][person];
          delete day[from][person];
          if(!day[to])day[to]={};
          day[to][person]=status;
          await env.ATTENDANCE.put(name,JSON.stringify(day));
          daysMoved++;
        }
      }
      cursor=listed.cursor;
      done=listed.list_complete||!cursor;
    }

    // 3) atualiza férias/licenças
    const vacs=await getVacations(env);
    let vacsMoved=0;
    for(const v of vacs){if(v.person===person&&v.team===from){v.team=to;vacsMoved++}}
    if(vacsMoved)await env.ATTENDANCE.put('vacations',JSON.stringify(vacs));

    // 4) atualiza o vínculo da biometria
    const mapping=await getControlIdMapping(env);
    let mapMoved=0;
    for(const m of mapping){if(m.person===person&&m.team===from){m.team=to;mapMoved++}}
    if(mapMoved)await env.ATTENDANCE.put('controlid_mapping',JSON.stringify(mapping));

    // As fichas de RH (hr_staff e hr_interns) são indexadas pelo nome da pessoa,
    // então acompanham a migração automaticamente, sem perder nada.
    return jsonRes({ok:true,person,from,to,days_moved:daysMoved,vacations_moved:vacsMoved,biometrics_moved:mapMoved});
  }

  // ── STATUSES ──
  if(parts[0]==='statuses'&&method==='GET')return jsonRes(await getStatuses(env));
  if(parts[0]==='statuses'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('custom_statuses',JSON.stringify(b));return jsonRes({ok:true})}

  // ── ATTENDANCE ──
  if(parts[0]==='attendance'&&parts[1]&&method==='GET'){const r=await env.ATTENDANCE.get(`att:${parts[1]}`);return jsonRes(r?JSON.parse(r):{})}
  if(parts[0]==='attendance'&&parts[1]&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put(`att:${parts[1]}`,JSON.stringify(b));return jsonRes({ok:true})}

  // ── REPORT ──
  if(parts[0]==='report'&&parts[1]&&method==='GET'){
    const emp=await getEmployees(env);const dates=weekDates(parts[1]);const vacs=await getVacations(env);const report={};
    for(const[team,members]of Object.entries(emp)){report[team]={};for(const person of members){report[team][person]={};for(const date of dates){const r=await env.ATTENDANCE.get(`att:${date}`);const day=r?JSON.parse(r):{};let status=day[team]?.[person]??'';if(!status){const vac=vacs.find(v=>v.team===team&&v.person===person&&v.start<=date&&v.end>=date);if(vac)status=vac.type;}report[team][person][date]=status;}}}
    return jsonRes({dates,report,requirements:{"Sócios":2,"Advogados":2,"Estagiários":2,"Administrativo":3}});
  }

  // ── DASHBOARD ──
  if(parts[0]==='dashboard'&&method==='GET'){
    const start=url.searchParams.get('start')||'';const end=url.searchParams.get('end')||'9999';
    const emp=await getEmployees(env);const keys=await env.ATTENDANCE.list({prefix:'att:'});
    const byDow={1:0,2:0,3:0,4:0,5:0};const byWeek={};const byTeam=Object.fromEntries(Object.keys(emp).map(k=>[k,0]));const recent=[];
    for(const{name}of keys.keys){const date=name.slice(4);if(date<start||date>end)continue;const r=await env.ATTENDANCE.get(name);if(!r)continue;const day=JSON.parse(r);const d=new Date(date+'T12:00:00');const dow=d.getDay();if(dow===0||dow===6)continue;let dt=0;for(const[team,members]of Object.entries(day))for(const s of Object.values(members))if(s==='Presente'){byDow[dow]=(byDow[dow]||0)+1;if(byTeam[team]!==undefined)byTeam[team]++;dt++}const wk=isoWeek(d);byWeek[wk]=(byWeek[wk]||0)+dt;recent.push({date,total:dt})}
    recent.sort((a,b)=>b.date.localeCompare(a.date));
    return jsonRes({byDow,byWeek:Object.fromEntries(Object.entries(byWeek).sort()),byTeam,recent:recent.slice(0,60)});
  }

  // ── VACATIONS ──
  if(parts[0]==='vacations'&&method==='GET')return jsonRes(await getVacations(env));
  if(parts[0]==='vacations'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('vacations',JSON.stringify(b));return jsonRes({ok:true})}

  return jsonRes({error:'Rota não encontrada'},404);
}
