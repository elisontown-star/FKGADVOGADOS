// Marcador da versão publicada: aparece no rodapé da barra lateral e serve
// para conferir, numa olhada, se o que está no ar é mesmo o último pacote.
const VPOINT_VERSAO='2026.10.26';
const SUPERADMIN_USER='superadmin';
const SUPERADMIN_PASS='FKG@Admin2026!';
// Token exclusivo das tarefas automáticas (cron-job.org). Não depende de login,
// então continua valendo mesmo quando as sessões dos usuários expiram.
// O valor NÃO fica no código: vem da variável de ambiente CRON_TOKEN, cadastrada
// no Cloudflare Pages (Settings → Variables and Secrets, tipo Secret).
// Sem ela, as rotas /api/cron/* respondem 503 e nada mais é afetado.
const DEFAULT_EMPLOYEES={"Sócios":["Cristiano Kozan","Giovanna Rizzo","Marco Gasparetti","Marina Falcone","Marina Tavares","Raphael Burleigh","Renata Ambrosio"],"Advogados":["Anike Taucci","Beatriz Armani","Bárbara Yassu","Eduardo Gagliano","Edvânia Cassimiro","Fernanda Rodrigues","Gabriela Ciaramicoli","Graziela Coelho","Luisa Opice","Luiz Gustavo Garcia","Luís Simão","Mariana Ambrósio","Mariana Ferro","Nathalia Caropreso de Almeida","Pietra Maciel","Rafaela Notarbartolo Farina","Rebeca Bizetti","Reynaldo Tufano","Sasha Santos","Verônica Oliveira Corradini","Vitória Franco","Vitória Sardeiro"],"Estagiários":["Ana Clara Carvalho","Ana Clara Domingos","Ana Clara Freitas Oliveira","Beatriz Seragini","Bruno Batista","Camila Alves Barbosa","Camylli Carvalho","Gabriel Ramon C. Camargos","Guilherme Oliveira","Gustavo Lahuerta Pires","Heloisa Pieruzzi","Izabella Machado","Júlia Gusmão Patto","Leonardo Alves Robeldo","Leticia Miranda Ligeri","Luiza Baesso Rocha","Maria Eduarda Russo Chacon","Maria Eduarda de Paschoal","Maria Eduarda Pereira Antunes","Maria Fernanda Cantarin","Mateus Ribeiro Galeano","Suzanna Rodrigues Novaes"],"Administrativo":["Evelyn Chiogna","Francisca Monteiro","Leila Almeida Marques","Marcos Serafim","Meire","Renata Simões","Vanessa Moraes"]};
const DEFAULT_CUSTOM_STATUSES=['Feriado','Licença','Atestado'];
// 'tv' é o acesso de apresentação: entra direto na vitrine e não enxerga mais nada.
const PAPEIS=['user','superadmin','tv'];
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
function jsonRes(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}})}
// Compara dois segredos sem vazar, pelo tempo de resposta, quantos caracteres acertaram.
function comparaSegredo(a,b){
  a=String(a||'');b=String(b||'');
  if(a.length!==b.length)return false;
  let dif=0;
  for(let i=0;i<a.length;i++)dif|=a.charCodeAt(i)^b.charCodeAt(i);
  return dif===0;
}
// O KV responde uma chave por vez, com a latência da rede em cada uma. Ler
// 200 chaves em sequência custa 200 idas e voltas; em lotes paralelos, custa
// o tempo do lote mais lento. O limite existe para não estourar a quantidade
// de conexões simultâneas que o Worker aguenta.
// Avança o selo da presença: é o que faz o resumo guardado do painel ser
// descartado. Barato (uma gravação) perto de recalcular o ano inteiro.
async function marcarPresencaMudou(env){
  try{await env.ATTENDANCE.put('att_versao',String(Date.now()))}catch(e){}
}
async function lerVarias(env,nomes,lote=40){
  const out=new Map();
  for(let i=0;i<nomes.length;i+=lote){
    const bloco=nomes.slice(i,i+lote);
    const vals=await Promise.all(bloco.map(n=>env.ATTENDANCE.get(n).catch(()=>null)));
    bloco.forEach((n,k)=>out.set(n,vals[k]));
  }
  return out;
}
async function getEmployees(env){const r=await env.ATTENDANCE.get('employees');return r?JSON.parse(r):DEFAULT_EMPLOYEES}
async function getStatuses(env){const r=await env.ATTENDANCE.get('custom_statuses');return r?JSON.parse(r):DEFAULT_CUSTOM_STATUSES}
async function getVacations(env){const r=await env.ATTENDANCE.get('vacations');return r?JSON.parse(r):[]}
// Férias coletivas: o escritório para, mas só para quem é celetista ou
// estagiário. Sócio e advogado são associados e não entram no recesso.
const EQUIPES_COLETIVAS=['Estagiários','Administrativo'];
async function getColetivas(env){const r=await env.ATTENDANCE.get('vacations_coletivas');return r?JSON.parse(r):[]}
async function saveColetivas(env,l){await env.ATTENDANCE.put('vacations_coletivas',JSON.stringify(l))}
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
// Quanto o relógio do equipamento pode divergir do servidor e ainda ser aceito.
const CID_TOLERANCIA=120;
async function getControlIdConfig(env){
  const r=await env.ATTENDANCE.get('controlid_config');
  // usar_hora_servidor começa ligado: é o comportamento seguro
  return Object.assign({secret:'',granted_events:'6,7',usar_hora_servidor:true},r?JSON.parse(r):{});
}
async function getControlIdMapping(env){const r=await env.ATTENDANCE.get('controlid_mapping');return r?JSON.parse(r):[]}
async function getControlIdLog(env){const r=await env.ATTENDANCE.get('controlid_log');return r?JSON.parse(r):[]}
async function createSession(env,role,name,username,hrAccess,medAccess,officeAccess,contAccess,contManage,provAccess,externo){
  const token=crypto.randomUUID();
  await env.ATTENDANCE.put('session:'+token,JSON.stringify({role,name,username,hr_access:!!hrAccess,med_access:!!medAccess,office_access:!!officeAccess,cont_access:!!contAccess,cont_manage:!!contManage,prov_access:!!provAccess,externo:!!externo}));
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

// ══ ASSISTÊNCIA MÉDICA ══
const MED_DEFAULT_CONFIG={pct_associado:20,pct_clt:5,operadora:'',vigencia:'',manual_plans:['7033 /7036'],alerta_dias:35};
const MED_EQUIPES=['Sócios','Advogados','Administrativo'];
// Sócios e advogados seguem o modelo associado (20%); o administrativo é CLT (5%).
function medVinculoPadrao(team){return team==='Administrativo'?'clt':'associado'}

// Faixas etárias da ANS — a tabela de preços da operadora é organizada por elas.
const MED_FAIXAS=[
  {id:'0-18',min:0,max:18,label:'0 a 18 anos'},
  {id:'19-23',min:19,max:23,label:'19 a 23 anos'},
  {id:'24-28',min:24,max:28,label:'24 a 28 anos'},
  {id:'29-33',min:29,max:33,label:'29 a 33 anos'},
  {id:'34-38',min:34,max:38,label:'34 a 38 anos'},
  {id:'39-43',min:39,max:43,label:'39 a 43 anos'},
  {id:'44-48',min:44,max:48,label:'44 a 48 anos'},
  {id:'49-53',min:49,max:53,label:'49 a 53 anos'},
  {id:'54-58',min:54,max:58,label:'54 a 58 anos'},
  {id:'59+',min:59,max:200,label:'59 anos ou mais'}
];
function medFaixaDe(idade){
  const i=Number(idade);
  if(isNaN(i)||i<0)return null;
  const f=MED_FAIXAS.find(f=>i>=f.min&&i<=f.max);
  return f?f.id:null;
}
const MED_IOF_PADRAO=2.38;
const MED_DEFAULT_PLAN_TYPES=[
  {code:'7023 /7024',label:'Diamante Mais R1',iof:MED_IOF_PADRAO,full:'7023 DIAMANTE MAIS R1 Q - PME + REDE TERCEIRIZADA / 7024 MEDISERVICE BRANCO AP DIAMANTE MAIS R1 Q PME+RD PO'},
  {code:'7029 /7030',label:'Ouro Mais',iof:MED_IOF_PADRAO,full:'7029 OURO MAIS Q - PME + REDE TERCEIRIZADA / 7030 MEDISERVICE BRANCO AP OURO MAIS Q PME + REDE PORTO'},
  // O Diamante Mais R2 é custeado inteiramente pelo beneficiário: desconta
  // 100% em folha e o escritório não entra com nada.
  {code:'7033 /7036',label:'Diamante Mais R2',iof:MED_IOF_PADRAO,integral:true,full:'7033 DIAMANTE MAIS R2 Q - PME + REDE TERCEIRIZADA / 7036 MEDISERVICE BRANCO AP DIAMANTE MAIS R2 Q PME+RD PO'}
];
// A tabela guarda o valor base. O IOF entra por cima: total = base x (1 + iof/100).
// Planos marcados assim descontam tudo do titular, qualquer que seja o
// vínculo. O percentual de associado ou CLT não se aplica a eles.
function medIntegral(types,planCode){
  const t=(types||[]).find(t=>t.code===planCode);
  return !!(t&&t.integral);
}
function medIofDe(types,planCode){
  const t=(types||[]).find(t=>t.code===planCode);
  const v=t&&t.iof!==undefined?Number(t.iof):MED_IOF_PADRAO;
  return (isNaN(v)||v<0)?0:v;
}
function medComIof(base,iof){
  const b=Number(base);
  if(isNaN(b)||b<=0)return 0;
  return Math.round(b*(1+(Number(iof)||0)/100)*100)/100;
}
// Monta a tabela já com IOF, para o resto do cálculo não precisar saber da alíquota.
function medPrecosComIof(prices,types){
  const out={};
  for(const[code,faixas]of Object.entries(prices||{})){
    const iof=medIofDe(types,code);
    out[code]={};
    for(const[f,v]of Object.entries(faixas||{})){
      const total=medComIof(v,iof);
      if(total>0)out[code][f]=total;
    }
  }
  return out;
}
async function getMedPlanTypes(env){
  const r=await env.ATTENDANCE.get('med_plan_types');
  return r?JSON.parse(r):MED_DEFAULT_PLAN_TYPES.slice();
}
async function getMedPriceTable(env){
  const r=await env.ATTENDANCE.get('med_price_table');
  return r?JSON.parse(r):{};
}
async function getMedConfig(env){
  const r=await env.ATTENDANCE.get('med_config');
  return r?Object.assign({},MED_DEFAULT_CONFIG,JSON.parse(r)):Object.assign({},MED_DEFAULT_CONFIG);
}
async function getMedPlans(env){const r=await env.ATTENDANCE.get('med_plans');return r?JSON.parse(r):{}}
async function saveMedPlans(env,plans){await env.ATTENDANCE.put('med_plans',JSON.stringify(plans))}
function medNum(v){const n=Number(v);return (isNaN(n)||n<0)?0:Math.round(n*100)/100}
function medIdade(v){const n=parseInt(v,10);return (isNaN(n)||n<0||n>120)?'':n}
function medVinculo(v,team){
  const t=String(v||'').toLowerCase();
  if(t==='associado'||t==='clt')return t;
  return medVinculoPadrao(team);
}
function medPlanoVazio(team){
  return {vinculo:medVinculoPadrao(team),plan_value:0,plan_code:'',group_code:'',cpf:'',age:'',birth_date:'',
          card:'',start_date:'',status:'A',exclusion_date:'',notes:'',external:false,team:team||'',dependents:[]};
}
// Valor sugerido pela tabela da operadora, se houver preço para o plano e a faixa.
function medPrecoTabela(prices,planCode,idade){
  const faixa=medFaixaDe(idade);
  if(!faixa||!planCode)return null;
  const p=prices[planCode];
  if(!p)return null;
  const v=Number(p[faixa]);
  return (isNaN(v)||v<=0)?null:Math.round(v*100)/100;
}
// Idade completa na data de referência (hoje, no fuso de Brasília, se não vier outra).
function medHoje(){const d=new Date(Date.now()-3*60*60*1000);return d.toISOString().slice(0,10)}
function medIdadeEm(birthDate,ref){
  if(!birthDate||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return null;
  const r=(ref||medHoje()).slice(0,10);
  const[by,bm,bd]=birthDate.split('-').map(Number);
  const[ry,rm,rd]=r.split('-').map(Number);
  let idade=ry-by;
  if(rm<bm||(rm===bm&&rd<bd))idade--;
  return idade<0?null:idade;
}
// Idade que vale para o cálculo: nascimento tem prioridade; sem ele, cai na idade digitada.
function medIdadeEfetiva(rec,ref){
  const porNasc=medIdadeEm(rec.birth_date,ref);
  if(porNasc!==null)return {idade:porNasc,fonte:'nascimento'};
  const n=parseInt(rec.age,10);
  return (isNaN(n)||n<0)?{idade:null,fonte:'ausente'}:{idade:n,fonte:'idade'};
}
// Planos cuja regra ainda não foi definida: valor fica congelado como veio da operadora.
function medPlanoManual(cfg,planCode){
  const lista=Array.isArray(cfg.manual_plans)?cfg.manual_plans:MED_DEFAULT_CONFIG.manual_plans;
  return lista.indexOf(planCode)>=0;
}
// Valor que vale hoje: a tabela por faixa manda, desde que haja nascimento e preço.
// REGRA: todo valor guardado (na ficha ou na tabela) é o valor BASE, sem IOF.
// O IOF é sempre somado por cima para chegar ao valor cobrado pela operadora.
function medValorVigente(rec,planCode,prices,cfg,ref,iof){
  const aliq=(iof===undefined||iof===null)?0:iof;
  const guardado=medNum(rec.plan_value);
  const fim=(base,fonte,faixa,tabela)=>({
    base:Math.round(base*100)/100,
    valor:medComIof(base,aliq),
    iof:Math.round((medComIof(base,aliq)-base)*100)/100,
    aliquota:aliq,fonte,faixa,tabela
  });
  // Plano com regra ainda não definida: fica exatamente como a operadora mandou.
  // O valor guardado JÁ é o cobrado, com IOF — aqui só separamos as duas partes.
  if(medPlanoManual(cfg,planCode)){
    const b=Math.round(guardado/(1+aliq/100)*100)/100;
    return {base:b,valor:guardado,iof:Math.round((guardado-b)*100)/100,
      aliquota:aliq,fonte:'congelado',faixa:null,tabela:null};
  }
  const{idade,fonte}=medIdadeEfetiva(rec,ref);
  const faixa=medFaixaDe(idade);
  const tabela=medPrecoTabela(prices,planCode,idade);
  if(tabela===null)return fim(guardado,'sem-tabela',faixa,null);
  // A tabela vale sempre que a idade for conhecida. Sem data de nascimento o valor
  // não muda sozinho no aniversário, mas o preço da faixa atual continua correto.
  return fim(tabela,fonte==='nascimento'?'tabela':'tabela-por-idade',faixa,tabela);
}
// Idades em que se muda de faixa etária.
const MED_LIMITES=[19,24,29,34,39,44,49,54,59];
// Próxima virada de faixa: data, idade nova e quanto o valor passa a ser.
function medProximaVirada(rec,planCode,prices,cfg,ref,iof){
  const aliq=(iof===undefined||iof===null)?0:iof;
  if(medPlanoManual(cfg,planCode))return null;
  if(!rec.birth_date||!/^\d{4}-\d{2}-\d{2}$/.test(rec.birth_date))return null;
  const hoje=(ref||medHoje()).slice(0,10);
  const idade=medIdadeEm(rec.birth_date,hoje);
  if(idade===null)return null;
  const alvo=MED_LIMITES.find(l=>l>idade);
  if(!alvo)return null;
  const[by,bm,bd]=rec.birth_date.split('-').map(Number);
  const data=`${by+alvo}-${String(bm).padStart(2,'0')}-${String(bd).padStart(2,'0')}`;
  const dias=Math.round((Date.parse(data+'T12:00:00Z')-Date.parse(hoje+'T12:00:00Z'))/86400000);
  const baseAtual=medPrecoTabela(prices,planCode,idade);
  const baseNovo=medPrecoTabela(prices,planCode,alvo);
  if(baseAtual===null||baseNovo===null)return null;
  // Mostra o valor cobrado, com IOF, que é o que aparece na fatura.
  const atual=medComIof(baseAtual,aliq),novo=medComIof(baseNovo,aliq);
  return {data,dias,idade_atual:idade,idade_nova:alvo,
    faixa_atual:medFaixaDe(idade),faixa_nova:medFaixaDe(alvo),
    valor_atual:atual,valor_novo:novo,
    diferenca:Math.round((novo-atual)*100)/100};
}

// Regra: o percentual (associado ou CLT) incide SEMPRE sobre o VALOR DO PLANO,
// nunca sobre o salário. Dependentes não têm desconto — pagam 100% do plano deles.
// Beneficiários excluídos (situação E) não entram em nenhum total.
function medCalcular(plano,cfg,prices,ref,types){
  const ativo=(plano.status||'A')!=='E';
  const iof=medIofDe(types,plano.plan_code);
  const integral=medIntegral(types,plano.plan_code);
  const pct=integral?100:(plano.vinculo==='associado'?medNum(cfg.pct_associado):medNum(cfg.pct_clt));
  const pv=medValorVigente(plano,plano.plan_code,prices||{},cfg,ref,iof);
  const planoTitular=ativo?pv.valor:0;
  const descTitular=Math.round(planoTitular*pct)/100;
  const empresaTitular=Math.round((planoTitular-descTitular)*100)/100;
  const deps=(plano.dependents||[]).map(d=>{
    const dAtivo=(d.status||'A')!=='E';
    const dv=medValorVigente(d,plano.plan_code,prices||{},cfg,ref,iof);
    const v=dAtivo?dv.valor:0;
    const info=medIdadeEfetiva(d,ref);
    // Por padrão o dependente é 100% descontado do titular. Em casos específicos
    // o escritório assume o custo integral e nada é descontado.
    const bancado=d.custeio==='empresa';
    return {...d,plan_value:dv.valor,valor_base:dv.base,valor_iof:dv.iof,valor_guardado:medNum(d.plan_value),origem_valor:dv.fonte,
      idade_calc:info.idade,fonte_idade:info.fonte,faixa:dv.faixa,
      custeio:bancado?'empresa':'titular',ativo:dAtivo,
      desconto:bancado?0:v,empresa:bancado?v:0};
  });
  const planoDeps=Math.round(deps.reduce((t,d)=>t+(d.ativo?d.plan_value:0),0)*100)/100;
  const descDeps=Math.round(deps.reduce((t,d)=>t+d.desconto,0)*100)/100;
  const empresaDeps=Math.round(deps.reduce((t,d)=>t+d.empresa,0)*100)/100;
  const infoTit=medIdadeEfetiva(plano,ref);
  return {
    ativo,pct,integral,aliquota_iof:iof,
    premio_titular:ativo?pv.base:0,
    iof_titular:ativo?pv.iof:0,
    premio_dependentes:Math.round(deps.reduce((t,d)=>t+(d.ativo?d.valor_base:0),0)*100)/100,
    iof_dependentes:Math.round(deps.reduce((t,d)=>t+(d.ativo?d.valor_iof:0),0)*100)/100,
    origem_valor:pv.fonte,valor_guardado:medNum(plano.plan_value),faixa:pv.faixa,
    idade_calc:infoTit.idade,fonte_idade:infoTit.fonte,
    plano_titular:planoTitular,
    desconto_titular:descTitular,
    empresa_titular:empresaTitular,
    dependents:deps,
    dependentes_ativos:deps.filter(d=>d.ativo).length,
    dependentes_bancados:deps.filter(d=>d.ativo&&d.custeio==='empresa').length,
    plano_dependentes:planoDeps,
    desconto_dependentes:descDeps,
    empresa_dependentes:empresaDeps,
    plano_total:Math.round((planoTitular+planoDeps)*100)/100,
    desconto_total:Math.round((descTitular+descDeps)*100)/100,
    empresa_total:Math.round((empresaTitular+empresaDeps)*100)/100
  };
}

// Id curto, usado por vários módulos.
function novoId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
async function getHrStaff(env){const r=await env.ATTENDANCE.get('hr_staff');return r?JSON.parse(r):{}}
// Pagamentos fora da folha (proporcional de admissão)
async function getPayrollExt(env){const r=await env.ATTENDANCE.get('hr_payroll_ext');return r?JSON.parse(r):[]}


// Monta o panorama da quinzena. Fica fora da rota porque o cron também usa.
async function montarRelatorio(env,ini,fim,quem){

    const emp=await getEmployees(env);
    const equipes=Object.keys(emp);
    const totalPessoas=equipes.reduce((a,t)=>a+(emp[t]||[]).length,0);

    // ── presença dia a dia ──
    const feriados=new Set(feriadosDoAno(Number(ini.slice(0,4)),await getFeriadosCfg(env)).map(f=>f.data));
    if(ini.slice(0,4)!==fim.slice(0,4))
      feriadosDoAno(Number(fim.slice(0,4)),await getFeriadosCfg(env)).forEach(f=>feriados.add(f.data));
    // Presença por dia da semana vira média: somar quarta com quarta não diz
    // nada se o período tem três quartas e duas sextas. Guardamos o total e
    // quantas vezes aquele dia realmente foi trabalhado (sem feriado).
    const porDia=[], porEquipe={}, porDiaSemana={1:0,2:0,3:0,4:0,5:0};
    const diasDaSemana={1:0,2:0,3:0,4:0,5:0};
    equipes.forEach(t=>porEquipe[t]={presente:0,ho:0,pessoas:(emp[t]||[]).length});
    let diasUteis=0, feriadosNoPeriodo=0;
    const d0=new Date(ini+'T12:00:00'), d1=new Date(fim+'T12:00:00');
    for(let d=new Date(d0);d<=d1;d.setDate(d.getDate()+1)){
      const data=d.toISOString().slice(0,10);
      const dow=d.getDay();
      if(dow===0||dow===6)continue;
      if(feriados.has(data)){feriadosNoPeriodo++;continue}
      diasUteis++;
      diasDaSemana[dow]=(diasDaSemana[dow]||0)+1;
      const raw=await env.ATTENDANCE.get('att:'+data);
      const dia=raw?JSON.parse(raw):{};
      let presentes=0, ho=0;
      for(const[time,membros]of Object.entries(dia)){
        for(const st of Object.values(membros||{})){
          if(st==='Presente'){presentes++;porDiaSemana[dow]=(porDiaSemana[dow]||0)+1;
            if(porEquipe[time])porEquipe[time].presente++}
          else if(st==='Home Office'){ho++;if(porEquipe[time])porEquipe[time].ho++}
        }
      }
      porDia.push({data,presentes,ho});
    }

    // ── afastamentos que cruzam a quinzena ──
    const todasVacs=await getVacations(env);
    const vacs=todasVacs.filter(v=>v.start<=fim&&v.end>=ini);
    // Férias ganham seção própria; por isso saem daqui, senão a mesma pessoa
    // apareceria duas vezes no relatório — foi o que o cliente apontou.
    const outros=vacs.filter(v=>v.type!=='Férias');
    const porTipo={};
    outros.forEach(v=>{porTipo[v.type]=(porTipo[v.type]||0)+1});
    // Em andamento: as férias que cruzam o período fechado.
    const feriasPeriodo=vacs.filter(v=>v.type==='Férias')
      .map(v=>({person:v.person,team:v.team,start:v.start,end:v.end}))
      .sort((a,b)=>a.start.localeCompare(b.start));
    const limiteAg=new Date(new Date(fim+'T12:00:00').getTime()+90*86400000).toISOString().slice(0,10);
    const feriasAgendadas=todasVacs.filter(v=>v.type==='Férias'&&v.start>fim&&v.start<=limiteAg)
      .map(v=>({person:v.person,team:v.team,start:v.start,end:v.end}))
      .sort((a,b)=>a.start.localeCompare(b.start)).slice(0,20);

    // ── documentação arquivada na quinzena ──
    let docsPeriodo=0, docsTotal=0;
    const chaves=await env.ATTENDANCE.list({prefix:'cont_docs:'});
    const docsBrutos=await lerVarias(env,chaves.keys.map(k=>k.name));
    for(const k of chaves.keys){
      const raw=docsBrutos.get(k.name);
      const lista=raw?JSON.parse(raw):[];
      if(!Array.isArray(lista))continue;
      docsTotal+=lista.length;
      docsPeriodo+=lista.filter(d=>String(d.criado_em||'').slice(0,10)>=ini&&
                                   String(d.criado_em||'').slice(0,10)<=fim).length;
    }

    // ── contratos de prestadores a vencer ──
    const hoje=medHoje();
    const limite=new Date(new Date(hoje+'T12:00:00').getTime()+60*86400000).toISOString().slice(0,10);
    const prestadores=await getProviders(env);
    const vencendo=prestadores.filter(p=>p.vigencia_fim&&p.vigencia_fim>=hoje&&p.vigencia_fim<=limite)
      .map(p=>({nome:p.nome,segmento:p.segmento,fim:p.vigencia_fim}))
      .sort((a,b)=>a.fim.localeCompare(b.fim));
    const vencidos=prestadores.filter(p=>p.vigencia_fim&&p.vigencia_fim<hoje).length;

    // ── movimentação de pessoas: admissões, desligamentos e promoções ──
    const hist=(await getEmployeeLog(env)).filter(e=>e.date>=ini&&e.date<=fim);
    const admissoes=hist.filter(e=>e.type==='admissao')
      .map(e=>({person:e.person,team:e.team,date:e.date,motivo:e.reason||''}));
    const desligamentos=hist.filter(e=>e.type==='desligamento')
      .map(e=>({person:e.person,team:e.team,date:e.date,motivo:e.reason||''}));
    // Estagiário que virou advogado, advogado que virou sócio: é o que o
    // escritório chama de promoção, e o gerencial precisa mostrar.
    const transferencias=hist.filter(e=>e.type==='transferencia')
      .map(e=>({person:e.person,de:e.from||'',para:e.team,date:e.date}));

    // ── plano médico: quem mudou de faixa etária no período ──
    // A faixa da ANS muda no aniversário. Comparamos a faixa da véspera do
    // início com a faixa no fim: quem trocou, trocou dentro da quinzena.
    const planos=await getMedPlans(env);
    const faixas=[];
    const anteriorA=new Date(new Date(ini+'T12:00:00').getTime()-86400000).toISOString().slice(0,10);
    const conferir=(nome,nasc,titular)=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(nasc||'')))return;
      const antes=medFaixaDe(medIdadeEm(nasc,anteriorA));
      const depois=medFaixaDe(medIdadeEm(nasc,fim));
      if(!antes||!depois||antes===depois)return;
      const rot=f=>(MED_FAIXAS.find(x=>x.id===f)||{}).label||f;
      faixas.push({person:nome,titular:titular||'',de:rot(antes),para:rot(depois),
        aniversario:nasc.slice(5)});
    };
    for(const[nome,p]of Object.entries(planos||{})){
      if(!p||p.status==='E')continue;
      conferir(nome,p.birth_date,'');
      (p.dependents||[]).forEach(dep=>{
        if(dep&&dep.status!=='E')conferir(dep.name||dep.nome||'(dependente)',dep.birth_date,nome);
      });
    }

    // ── convênio médico: o custo do mês, na mesma quebra do resumo da
    // operadora (prêmio + IOF = total). Não é a fatura em si: é o que o VPoint
    // calcula a partir das vidas cadastradas, e serve para conferir a cobrança.
    const medCfg=await getMedConfig(env);
    const medPrices=await getMedPriceTable(env);
    const medTypes=await getMedPlanTypes(env);
    let cvTotal=0,cvPremio=0,cvIof=0,cvFolha=0,cvEmpresa=0,cvTit=0,cvDeps=0,cvBancados=0,cvSemPlano=0;
    for(const[nome,plano]of Object.entries(planos||{})){
      if(!plano){cvSemPlano++;continue}
      const c=medCalcular(plano,medCfg,medPrices,fim,medTypes);
      if(!c.ativo&&!c.dependents.some(d=>d.ativo)){cvSemPlano++;continue}
      cvTotal+=c.plano_total; cvFolha+=c.desconto_total; cvEmpresa+=c.empresa_total;
      if(c.ativo)cvTit++;
      cvDeps+=c.dependentes_ativos; cvBancados+=c.dependentes_bancados;
      // prêmio e IOF já vêm separados do cálculo, como a operadora apresenta
      cvPremio+=c.premio_titular+c.premio_dependentes;
      cvIof+=c.iof_titular+c.iof_dependentes;
    }
    const cent=v=>Math.round(v*100)/100;
    const convenio={vidas:cvTit+cvDeps,titulares:cvTit,dependentes:cvDeps,bancados:cvBancados,
      sem_plano:cvSemPlano,total:cent(cvTotal),premio:cent(cvPremio),iof:cent(cvIof),
      folha:cent(cvFolha),empresa:cent(cvEmpresa),
      pct_empresa:cvTotal?Math.round(cvEmpresa/cvTotal*1000)/10:0,
      medio:cvTit+cvDeps?cent(cvTotal/(cvTit+cvDeps)):0};

    // ── folha fora da folha ──
    const ff=(await getPayrollExt(env)).filter(r=>{
      const ref=r.modo==='demissao'?String(r.saida||''):String(r.referencia||'')+'-01';
      return ref>=ini&&ref<=fim;
    });

    return {
      periodo:{ini,fim,dias_uteis:diasUteis,feriados:feriadosNoPeriodo},
      pessoas:{total:totalPessoas,por_equipe:equipes.map(t=>({equipe:t,pessoas:(emp[t]||[]).length}))},
      presenca:{por_dia:porDia,por_equipe:porEquipe,
        por_dia_semana:Object.fromEntries(Object.keys(porDiaSemana).map(k=>[k,{
          total:porDiaSemana[k],dias:diasDaSemana[k]||0,
          media:diasDaSemana[k]?Math.round(porDiaSemana[k]/diasDaSemana[k]*10)/10:0}])),
        media_dia:diasUteis?Math.round(porDia.reduce((a,x)=>a+x.presentes,0)/diasUteis*10)/10:0,
        total_ho:porDia.reduce((a,x)=>a+x.ho,0)},
      ferias:{no_periodo:feriasPeriodo,agendadas:feriasAgendadas},
      pessoal:{admissoes,desligamentos,transferencias},
      plano_medico:{faixas,convenio},
      afastamentos:{total:outros.length,por_tipo:porTipo,
        lista:outros.map(v=>({person:v.person,team:v.team,type:v.type,start:v.start,end:v.end}))
          .sort((a,b)=>a.start.localeCompare(b.start)).slice(0,25)},
      documentacao:{no_periodo:docsPeriodo,total:docsTotal},
      prestadores:{total:prestadores.length,vencendo:vencendo.slice(0,12),vencidos},
      folha_extra:{lancamentos:ff.length,total:Math.round(ff.reduce((a,r)=>a+(Number(r.total)||0),0)*100)/100},
      gerado_em:new Date().toISOString(),gerado_por:quem||''
    };
}

// ══ RELATÓRIO GERENCIAL: envio por e-mail ══
const REPORT_PADRAO={ativo:false,recorrencia:'quinzenal',hora:'08:00',destinatarios:[],ultimo_envio:''};
async function getReportConfig(env){
  const r=await env.ATTENDANCE.get('report_config');
  return Object.assign({},REPORT_PADRAO,r?JSON.parse(r):{});
}
// Qual período fechar hoje. Quinzenal fecha nos dias 1 e 16, sempre olhando
// para trás — no dia 16 fecha de 1 a 15; no dia 1 fecha a segunda quinzena
// do mês anterior.
// Hora corrente em Brasília, no formato HH:MM — o Worker roda em UTC.
function reportHoraBR(){
  const d=new Date(Date.now()-3*60*60*1000);
  return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');
}
function reportHoraValida(h){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h||''))}

function reportPeriodoDeHoje(recorrencia,hojeISO){
  const [y,m,d]=hojeISO.split('-').map(Number);
  const iso=x=>x.toISOString().slice(0,10);
  const fimMes=(ano,mes)=>new Date(Date.UTC(ano,mes,0)).getUTCDate();
  if(recorrencia==='mensal'){
    if(d!==1)return null;
    const am=m===1?y-1:y, mm=m===1?12:m-1;
    return {ini:`${am}-${String(mm).padStart(2,'0')}-01`,
            fim:`${am}-${String(mm).padStart(2,'0')}-${String(fimMes(am,mm)).padStart(2,'0')}`};
  }
  if(recorrencia==='semanal'){
    if(new Date(Date.UTC(y,m-1,d)).getUTCDay()!==1)return null;   // segunda-feira
    return {ini:iso(new Date(Date.UTC(y,m-1,d-7))),fim:iso(new Date(Date.UTC(y,m-1,d-1)))};
  }
  if(d===16)return {ini:`${y}-${String(m).padStart(2,'0')}-01`,fim:`${y}-${String(m).padStart(2,'0')}-15`};
  if(d===1){
    const am=m===1?y-1:y, mm=m===1?12:m-1;
    return {ini:`${am}-${String(mm).padStart(2,'0')}-16`,
            fim:`${am}-${String(mm).padStart(2,'0')}-${String(fimMes(am,mm)).padStart(2,'0')}`};
  }
  return null;
}

// O último período que já fechou, olhando de hoje para trás. Existe porque o
// horário escolhido pode cair depois da última visita do cron naquele dia: sem
// isso o relatório simplesmente não sairia, já que no dia seguinte nenhum
// período fecha. Assim ele sai atrasado, mas sai.
function reportPeriodoDevido(recorrencia,hojeISO){
  const base=new Date(hojeISO+'T12:00:00Z');
  for(let i=0;i<40;i++){
    const d=new Date(base); d.setUTCDate(d.getUTCDate()-i);
    const dia=d.toISOString().slice(0,10);
    const per=reportPeriodoDeHoje(recorrencia,dia);
    if(per)return Object.assign({dia},per);
  }
  return null;
}

// Quando sai o próximo — só para mostrar na tela de configuração.
function reportProximoEnvio(cfg,hojeISO){
  const hora=reportHoraValida(cfg.hora)?cfg.hora:'08:00';
  const base=new Date(hojeISO+'T12:00:00Z');
  const devido=reportDeveEnviar(cfg,hojeISO,reportHoraBR());
  if(devido.enviar)return {data:hojeISO,hora,agora:true};
  // se hoje fecha período e ainda não deu a hora, é hoje mesmo
  if(devido.periodo&&devido.periodo.dia===hojeISO&&cfg.ultimo_envio!==devido.periodo.ini+'|'+devido.periodo.fim)
    return {data:hojeISO,hora,agora:false};
  for(let i=1;i<=40;i++){
    const d=new Date(base); d.setUTCDate(d.getUTCDate()+i);
    const dia=d.toISOString().slice(0,10);
    if(reportPeriodoDeHoje(cfg.recorrencia,dia))return {data:dia,hora,agora:false};
  }
  return null;
}

// Decide se o relatório sai agora. Devolve o período ou o motivo de não sair.
function reportDeveEnviar(cfg,hojeISO,agoraHHMM){
  const per=reportPeriodoDevido(cfg.recorrencia,hojeISO);
  if(!per)return {enviar:false,motivo:'nenhum período fechado ainda'};
  const chave=per.ini+'|'+per.fim;
  if(cfg.ultimo_envio===chave)return {enviar:false,motivo:'este período já foi enviado',periodo:per};
  const hora=reportHoraValida(cfg.hora)?cfg.hora:'08:00';
  if(per.dia===hojeISO&&agoraHHMM<hora)
    return {enviar:false,motivo:`ainda não deu a hora (envio às ${hora})`,periodo:per};
  return {enviar:true,periodo:per,chave};
}

// ══ GERADOR DE PDF ══
// O Worker não tem biblioteca de PDF e não roda navegador, então o arquivo é
// escrito à mão. É menos assustador do que parece: PDF é texto com uma tabela
// de posições no fim. Usamos só as fontes padrão (Helvetica), que todo leitor
// já tem embutidas — assim não precisamos carregar arquivo de fonte.
const PDF_L=595.28, PDF_A=841.89;        // A4 em pontos
const PDF_M=40;                          // margem

// Helvetica padrão usa WinAnsi: acentuação do português cabe, desde que os
// bytes saiam na codificação certa e os caracteres de escape sejam tratados.
const PDF_WIN={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,
 '‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,
 '™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function pdfTxt(s){
  let out='';
  for(const ch of String(s==null?'':s)){
    const c=PDF_WIN[ch]!==undefined?PDF_WIN[ch]:ch.codePointAt(0);
    if(c>255){out+='?';continue}
    if(ch==='('||ch===')'||ch==='\\')out+='\\'+ch;
    else if(c<32)out+=' ';
    else out+=String.fromCharCode(c);
  }
  return out;
}
// Largura aproximada do texto em Helvetica, para centralizar e alinhar à
// direita sem precisar da tabela de métricas completa.
const PDF_W={' ':278,'!':278,'"':355,'#':556,'$':556,'%':889,'&':667,"'":191,'(':333,')':333,
 '*':389,'+':584,',':278,'-':333,'.':278,'/':278,':':278,';':278,'<':584,'=':584,'>':584,'?':556,
 '@':1015,'[':278,']':278,'_':556,'{':334,'}':334,'|':260};
function pdfLarg(s,tam,negrito){
  let t=0;
  for(const ch of String(s||'')){
    let w=PDF_W[ch];
    if(w===undefined){
      if(ch>='0'&&ch<='9')w=556;
      else if(ch===ch.toUpperCase()&&ch!==ch.toLowerCase())w='IJ'.includes(ch)?278:('MW'.includes(ch)?833:722);
      else w='ilj'.includes(ch)?230:('mw'.includes(ch)?833:'frt'.includes(ch)?320:556);
    }
    t+=w;
  }
  return t/1000*tam*(negrito?1.04:1);
}
const pdfHex=c=>{
  const h=String(c||'#000000').replace('#','');
  return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]
    .map(n=>(isNaN(n)?0:n).toFixed(3)).join(' ');
};

// Logo do VPoint para o cabeçalho do PDF. Guardado como o próprio fluxo
// comprimido do PNG (240x72, tons de cinza, já composto sobre o #333333 da
// barra) — assim o PDF carrega a marca de verdade, sem depender de rede.
// Imagens embutidas no PDF: o logo e os ícones dos bancos, guardados como o
// próprio fluxo comprimido do PNG. Nada é buscado na rede na hora de gerar.
const PDF_IMAGENS={
  ILOGO:{l:240,a:72,cores:1,dados:
  'eNrVW3mUVNWZ/33freputpaAtE3TDYqKEhlQRMSNoAHconGZI7gkOm5jmGjOiRmHk0RzjPHMTJYTTXLIqHMIQmOIGxGMCoIQhYls'+
  'HQSGXXaaXpSl6KbtqrrfN3+896peVb969brlzGnuX91V9753f9/6+757i6YRcofysWPHEwCxKIoOVkXZOReMGFLVV0kpuSexbdPO'+
  'vYJuO+iv4zUfckuipX7VynoHTfhqEnz166PP7pnzafP+rcvWa3cFfMdLvfMRMwCcWL986TFwqK6Mxeip42OAJZDzEHHWr/yB1e4J'+
  '2ZQNHq6GfAOsqoKSmquupF0po2F4Bz76+NkkAJOLF0REYtNPNVI3VbGpOnCLgV/FBCJiUpX+V47dV09cYOfEMuYXl0KZKc9C1Cz9'+
  'E3dXNzbVh08b2cGLARCx6BmTeqzWYMRE8u0f9bPMHb5RtP9Hc3dVMMwg2jGpVxBigEhiF1X/vS0QsZGHpxk1AQvFLH+l2yoYLGhe'+
  'UMhqwbA3PNdfOOAbe//DVjlQTnZ2981KYCi91lAwNJFJj/hlGbijnK7+jnAgXuHXN3dfBcNUgU8kJgTbtKPKygHL8z2SpfKXvYL1'+
  'KzjyTEu39WCAAeVlW0lCks9NUzoYNX/3dAnEC+V367uxgsGAUuurFDbFPnZ+LjqWEV+X4CVKx1/pxvp1WJXwe+tDlEJU+kRp3qpv'+
  'xVEAML/WSNLNASslXxBoiIpH3iHGr+Dzxgc7MIT21TLQzQFDeN0qDrFDkjvOyDHqbxQO668mIN0esEJmJUNrwIH3qk/Bp40rMFH4'+
  '4IJu7cEuYAiv+wvbMHryjRqfis8fXCBkQWaeOCUAA/Ta8ZBYQ+j5rUyUIpxNwXnb8oZ3uHvj9QALbf8g3ItvGu2pWHF+gRBNmJvC'+
  'qQEYoFmHQxAT4nd7Fb3Eqgt58Pq/suDUACy0f15Y/mS9arSTigg9BwdqWCFzhHCKAAb47VDGoHwPXJxaaMa6v+VGPuKgQfQlpEJM'+
  'JwmwUNP8MMpActloCecU6d/m5DYmlaChqsSmK/SEDKl8yRgRy4ZYmjd5aGFIpPF76hSFVSy8JKcsZEHv6n4dbIaSOzX9hURoiQYk'+
  'R8u9a+qPfqnEF/NtpWX2TzTsdVeNrmMBQCbQg9trcy3i7AfGlcUDJragbe+BdRvr0ckAx1Iy4Zvn9n1yURhjKJCEAgGDl941LMRq'+
  'le+pAymQTpR3zMPK8/0KZhn5q68E2gKXo/yMsbcd+rD2kLGdwnvWj0dBKdkJFwgISqbKV9ml2iagcEwgHVR3yCgodXlNB8BKx59q'+
  'zdoakXl6aIopYEABVSkfMWn3vk6wFJbq585LQ3jH+qirSHXU9ZePvvgSPphdEsvxwnevuzzUix/8ngCkDR01pzy/0adgkq8Ol1gh'+
  'egICRAf85/SVka2aUPKTwak4FJGtgrR0+nVxAFi8Ovsezp0SypRYLp0oBoQtAWVh0xucs7+qHhqaQNhIjx9VKUdW8LUXSRwA9kfP'+
  'YPffxNbapK0PzMMALK9bE2ovOrWHkmKvdgiUNLs+tyzMpA+1+cOdx+mKezWytmiSKgCVeNQlUn6XkDEmZj71bS1Pwuk5NlTMI64S'+
  'Bg4cyhOL8IGFeR9l2AWZ/OEdSxq58SzhiLsfdC6RiMY4FtkJhpaS8/QBvsgUy9v4mr/cHLIHwr0rvlBu3jpQc1MSXmoNNg2lhto8'+
  'P624dLintrKrd0clTn17WWKgYfGqyB2kgSwEQHFmQcAA5k4sK4yY5bwpf2Doh9dQrpzqFhVwBaXP5uV/NmPqv8RdAxjuDxlE2Y0p'+
  '8niJiZv05o3rPjmSa0b+fWjeknqP2YsxWgCw8KcLp4RJUG996yiwoqnCH5KIatMFfd+U5HuJvlJ5l7uXwX0yPWwmmwdR/RtpS3w4'+
  'f3M+q8jnmblLMn8nrS2oYaWXrjk9pC0vVVNnMB9dfI+vqye8fkVhO1ObD5j5ralu4dV/wHFHUiyCWE3Pwe6b+bPPGo/76Keiedqn'+
  '8ZE1bGNr610RsaBf5aCSDOaGloOt8NM316QJlRN7eHswHQDz0TcesSYkXN799r6Yvv+PpRmpKNpmSGcaHYLmxoHOchGPEvGIScOH'+
  '9My2gxMNm5attuSCUxw5cv0Dg+IAfljvUEuWYVNGVZb5Htt6aM+Sle1Zjp7yDGH8eBT2YfCCWytC2IeUPvJjpS0bx2RULOajuk6R'+
  'RKA14QJ2nJZFr7j7YgNkWQWVlw+7ddvLS8XVGMu1z0AsrOnv2dr9D8XhpyHUp8+wybtmvUOekrMBwdO6Ncs5gEK8SaHNnquvtEbe'+
  'yoQLpVRtZ+uX3PKDpPTx58eyFdVM6iIVi/P//We9HNmT9nsIKTLGuAe0LPdNM1bUl+1IxcrQnz4R79CFyGTGmFnDAWXenO0mrJ8X'+
  '/35fy+9/7MlReNnmTp81aA4jKnn2Titk/FcJiNiQ2MnPloIcwP3gUNUGpwHzDw8KTE43gIgNS/qOx2IFOwyU3h1wgE/JuUVY/KMS'+
  'sy8mnV0rJf7Q6SZETv4ge/uEtHf0qs7w6Gf6ygddfQ3o4f7hOKFOzmTP/CVTr+mgYneK0K4dHFTJL98WpjKSmyYlSzb8zYlTyu/t'+
  '6LSC42X+MFjziHuTQEXckkqsF4lvHyoMEMrjfiFJ/EI1rq24S1xHJca0HtKhTnQKNexNcBBXaJ1HoVUm/dtZSZ6VhAKKxKzOKphp'+
  'UJXLaVXBenMvRyVKzElnsHHCAmv5RDfe5PpVaZV3bUjanSVgT0bVE2BygpY3pT25gmKB/fR3rh0XRjCl75OPtm2c9bAQxMxvilDj'+
  'sX+zqrfHxDnFO1TPtuQSN/WQXfzx5lYGwMMmXM/qOO91L7fn7N7L7q417vqZc3/BnDn5RgUBUL3sXVdGTurjlc+3O6+QZg2k4mRn'+
  'j+GQ6o5l5M+faJ1zxQUCOvRaBAXnioRvv8V5uGJ/Mp6qGUIMQJF8elGGFS7/+/SYEsA6cMj2whJVfLrB/fPgymMOfyOqJCVVbE+W'+
  'KAGKpj2khfMwAOG1qy8PazGzvfQX0xPPvwhwbUNxBZOcOcAzSaquGT0yo+ytINT0cTg+/3lR3Lrxm2JvXXCbNQA0Vr097NmlTF6m'+
  'nnFNpSPIiopGViCZ9aFY2hNQLJjxy+yxoXWbkbEvPFs36z7Zt7BoDibSB6b0y9WL67Mn3odgMJQBBVaweLLTNC+/xdkBnfNBmA2p'+
  'R/Isf7HBBRxz4pnJUuxsWihwrs1rF4T3BlnOnfHt37/DtSeKkkrWh77TL9uWtlbcPGlpYVN2NbUd9tUCKluOZmhl1JHOzfLq2dFO'+
  '3zMK6TH8NBEAS8/Hftf80eIoJHqIpLP9POP14CV2aA75C+emHGyt7SfteCVRHLDwjmVFoLDKJfdubImSg5czI9u19MIstzzT4F/N'+
  '+TXVSQMcA4pqWGlOWxHEBLv/zxHwKtYdzJ2mKpZM/b+uzol3Wph9fslhIwAW2j27KBgz93CEskH4yFzy2J2qKojYHH7zgTX/X2er'+
  'cYSVhxkFvnnLgNAWm9DeRZHMTvj1kZNtdqoeb9m0asOe/KMWQti/XR+K83yvihXe5efzHwnXAP3peDQdqT79x9JsXtd9LUmAVUJt'+
  '2J489ZtIGlZ6/eaqEBUL7387Yh2slPrffDqdD5e0stLnIKQVfcKPo7tYjIacndHR/wo90ZRZkW/sKPKOxMWvPzfdlvXyb4aH9taO'+
  '+una8JPGECdUXrajcCfA8vrO3NjJOxL3o91DpAApRkmMnUsDxDEZ73Udj3RVx149hTOUOApgtL0SdvhRe5Ju7HzW7jS2dMqYpDiX'+
  'BlSSX5voXilJb+nqg9Mpl8mPHZcqHrQACC8ueGAsXLfipGQVxb69w4QA0q/8asHHzgkqD7/oRqctqnRsd9fkqvT5jlFKAGn8qZkf'+
  'fe7Ru9BFyed/HSuk/f+Wk0KF1LRsGqaOzfS6885UJnO6fVyzqqWLgmX7PxeKYzsV0x+tV4CkZGYoYOV1a64IbFIrf7j6JNEGxYJv'+
  'ui1bVXI5gii7BVX7G13NyIqV95U5XQRBr3MBACcOcfiSdG2BPkByTtTX7rBchJZsWsSut2W6kOx2Y9O88pOuClZ42xJOu7xcRUTS'+
  'smNzsc2sfTvofcJLt0bbh6VtRTVEz+2Op4L8VNLxXc9Rl3/Tp/T7+rj1esHMzFyXLOaHOvtEx/vPQkdejGJnKqn4ziXFJCM4/Pia'+
  'OInNORpTscKxjd+vL1IVaxjg5h/sN7DiPZhkGbiYWex+LyDb0sL9xWCotVY5fvDJw0WDrPK+7/22iQ2TZG8JEBtunPHdA957WKzz'+
  'rWYSu7U276DOWZrpmwhv/+cFScOsVqy1Kdm5nYqfp//xhtI8P1ZKzCvKseLGAI11L+2LYPrCyZcXXj1ucP++vqK9+eDKZYeRqdhS'+
  'XOLQLiesUR/2/+vmWOME2N6UeXDTT1+9YdjgCpeyfZA2dHHRhuMPb8sL1Nb8ZnYRGKQVF6ZMov5AxNtnRAKUn17Z09acnjatu7St'+
  'qSmRc1uv55gYAGj8k0ZSwFxWqgA0vmunJ3vSoeeknWZR3ReZU2cIqHrgaak+Z4EOLjlKxQFj4Mx+OZdthPb+U2vEHzZw5B9AEOVP'+
  'ZZyUnyAz5cQG38W0Qp6fODZBfZFWxfxmY4TWrGHOe1exGpK8y7bEzJQHl4xbeXgb9woR9XeFOn7mfy5HAQzlbRijXqcRAvPqzCh2'+
  '6jvhio7Z3xcp8GX+3KD1hZ4bCTDAazGGVUFQVaYXXtBufs0/tBlQFcUN1m6pHEgEENH2n79ucQoDLhq03FAdu+zGEZU4sPWDjxN8'+
  'KisY/wfmYPEw'}
};
const PDF_LOGO=PDF_IMAGENS.ILOGO;

function pdfDoc(){
  const paginas=[];
  let buf=[], y=PDF_A-PDF_M;
  const nova=()=>{paginas.push(buf.join('\n'));buf=[];y=PDF_A-PDF_M};
  const api={
    get y(){return y}, set y(v){y=v},
    espaco(n){if(y-n<PDF_M+26){nova();return true}return false},
    texto(t,x,tam,cor,negrito,alinha,larguraCaixa){
      const s=pdfTxt(t);
      let px=x;
      if(alinha==='dir')px=x-pdfLarg(t,tam,negrito);
      else if(alinha==='centro')px=x+(larguraCaixa-pdfLarg(t,tam,negrito))/2;
      buf.push(`BT /${negrito?'FB':'FR'} ${tam} Tf ${pdfHex(cor)} rg ${px.toFixed(2)} ${y.toFixed(2)} Td (${s}) Tj ET`);
    },
    textoEm(t,x,yy,tam,cor,negrito,alinha){
      const s=pdfTxt(t);
      let px=x;
      if(alinha==='dir')px=x-pdfLarg(t,tam,negrito);
      buf.push(`BT /${negrito?'FB':'FR'} ${tam} Tf ${pdfHex(cor)} rg ${px.toFixed(2)} ${yy.toFixed(2)} Td (${s}) Tj ET`);
    },
    ret(x,yy,l,a,cor){buf.push(`${pdfHex(cor)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${l.toFixed(2)} ${a.toFixed(2)} re f`);},
    // A matriz 'cm' escala a imagem (que é 1x1 no espaço do PDF) para o tamanho
    // pedido e a posiciona; q/Q isolam isso do resto do desenho.
    imagem(x,yy,l,a,nome){
      const n=nome||'ILOGO';
      if(!PDF_IMAGENS[n])return;
      buf.push(`q ${l.toFixed(2)} 0 0 ${a.toFixed(2)} ${x.toFixed(2)} ${yy.toFixed(2)} cm /${n} Do Q`);},
    linha(x1,yy,x2,cor,esp){buf.push(`${pdfHex(cor)} RG ${(esp||0.6).toFixed(2)} w ${x1.toFixed(2)} ${yy.toFixed(2)} m ${x2.toFixed(2)} ${yy.toFixed(2)} l S`);},
    quebra(){nova()},
    fim(){if(buf.length)nova();return paginas}
  };
  return api;
}

// Monta o arquivo final: objetos, páginas, fontes e a tabela de posições.
function pdfMontar(paginas){
  // ATENÇÃO: o conteúdo é WinAnsi (1 byte por caractere). Usar TextEncoder
  // aqui transformaria cada acento em dois bytes e o leitor mostraria "Ã³".
  const bytesDe=t=>{const a=new Uint8Array(t.length);
    for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i)&0xFF;return a};
  const enc={encode:bytesDe};
  const objs=[];
  const nPag=paginas.length;
  const idsPag=[], idsCont=[];
  for(let i=0;i<nPag;i++){idsPag.push(4+i*2);idsCont.push(5+i*2)}
  objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objs[2]=`<< /Type /Pages /Kids [${idsPag.map(i=>i+' 0 R').join(' ')}] /Count ${nPag} >>`;
  objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const idBold=4+nPag*2;
  objs[idBold]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  // As imagens entram como vieram do PNG: o fluxo já está em Flate e as linhas
  // usam o preditor do próprio formato, por isso o /Predictor 15.
  let prox=idBold;
  const refs=[];
  for(const[nome,img]of Object.entries(PDF_IMAGENS)){
    const id=++prox;
    const bin=atob(img.dados);
    const cor=img.cores===3?'DeviceRGB':'DeviceGray';
    objs[id]={dados:bin,
      dic:`<< /Type /XObject /Subtype /Image /Width ${img.l} /Height ${img.a} `+
        `/ColorSpace /${cor} /BitsPerComponent 8 /Filter /FlateDecode `+
        `/DecodeParms << /Predictor 15 /Colors ${img.cores} /BitsPerComponent 8 /Columns ${img.l} >> `+
        `/Length ${bin.length} >>`};
    refs.push(`/${nome} ${id} 0 R`);
  }
  const idImg=prox;
  paginas.forEach((c,i)=>{
    objs[idsPag[i]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_L} ${PDF_A}] `+
      `/Resources << /Font << /FR 3 0 R /FB ${idBold} 0 R >> /XObject << ${refs.join(' ')} >> >> `+
      `/Contents ${idsCont[i]} 0 R >>`;
    objs[idsCont[i]]=null;   // marcado abaixo como stream
  });

  let saida='%PDF-1.4\n';
  const pos=[];
  const push=t=>{saida+=t};
  for(let i=1;i<=idImg;i++){
    if(objs[i]===undefined)continue;
    pos[i]=enc.encode(saida).length;
    if(objs[i]===null){
      const idx=idsCont.indexOf(i);
      const corpo=paginas[idx];
      const bytes=enc.encode(corpo).length;
      push(`${i} 0 obj\n<< /Length ${bytes} >>\nstream\n${corpo}\nendstream\nendobj\n`);
    }else if(typeof objs[i]==='object'){
      push(`${i} 0 obj\n${objs[i].dic}\nstream\n${objs[i].dados}\nendstream\nendobj\n`);
    }else{
      push(`${i} 0 obj\n${objs[i]}\nendobj\n`);
    }
  }
  const inicioXref=enc.encode(saida).length;
  const total=idImg+1;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for(let i=1;i<total;i++){
    push(String(pos[i]!==undefined?pos[i]:0).padStart(10,'0')+' 00000 n \n');
  }
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);
  return enc.encode(saida);
}

const pdfB64=bytes=>{
  let s='';
  for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(s);
};

// ── O relatório em si ──
function relatorioPdf(d){
  const C={escuro:'#191919',cinza:'#5E5E5E',claro:'#8A8A8A',linha:'#E6E6E6',fundo:'#FAFAFA',
    verde:'#2F7A4F',ambar:'#B8860B',vinho:'#B4453C',roxo:'#6B5B95',azul:'#1D4ED8',barra:'#333333'};
  const L=PDF_L-PDF_M*2, X=PDF_M, XD=PDF_L-PDF_M;
  const doc=pdfDoc();
  const P=d.periodo, DS=['','Seg','Ter','Qua','Qui','Sex'];

  // cabeçalho
  doc.ret(X,doc.y-30,L,34,C.barra);
  const logoL=52, logoA=logoL*PDF_LOGO.a/PDF_LOGO.l;
  doc.imagem(X+12,doc.y-30+(34-logoA)/2,logoL,logoA);
  doc.textoEm('FKG ADVOGADOS',XD-12,doc.y-18,9,'#FFFFFF',false,'dir');
  doc.y-=52;
  doc.texto('Relatório gerencial',X,17,C.escuro,true); doc.y-=17;
  doc.texto(rData(P.ini)+' a '+rData(P.fim)+'  ·  '+P.dias_uteis+' dias úteis'+
    (P.feriados?'  ·  '+P.feriados+' feriado(s)':''),X,9.5,C.claro); doc.y-=22;

  // indicadores
  const kpis=[['Colaboradores',String(d.pessoas.total),'',C.barra],
    ['Presenças/dia',rNum(d.presenca.media_dia),'média',C.verde],
    ['Atestados/licenças',String(d.afastamentos.total),'férias à parte',C.ambar],
    ['Lançamentos fora da folha',String(d.folha_extra.lancamentos),rMoeda(d.folha_extra.total),C.azul]];
  const lk=(L-18)/4, ak=52;
  kpis.forEach((k,i)=>{
    const x=X+i*(lk+6);
    doc.ret(x,doc.y-ak,lk,ak,C.fundo);
    doc.ret(x,doc.y-2,lk,2.5,k[3]);
    doc.textoEm(k[1],x,doc.y-24,15,k[3],true,null);
    doc.textoEm(k[0],x,doc.y-37,7.5,C.claro);
    if(k[2])doc.textoEm(k[2],x,doc.y-46,6.5,'#B0B0B0');
  });
  doc.y-=ak+16;

  const secao=(tit,cor)=>{
    doc.espaco(52);
    doc.ret(X,doc.y-1,8,8,cor);
    doc.textoEm(tit.toUpperCase(),X+13,doc.y,8.5,C.cinza,true);
    doc.y-=7;
    doc.linha(X,doc.y,XD,cor,1.4);
    doc.y-=15;
  };
  const barras=(itens,cor)=>{
    const rotL=118, valL=44, trilho=L-rotL-valL-14;
    const max=Math.max(1,...itens.map(i=>i.valor));
    itens.forEach(i=>{
      doc.espaco(20);
      doc.textoEm(i.rotulo,X,doc.y,8.5,C.cinza);
      doc.ret(X+rotL,doc.y-2,trilho,9,C.linha);
      doc.ret(X+rotL,doc.y-2,Math.max(1.5,trilho*(i.valor/max)),9,cor);
      doc.textoEm(String(i.texto!==undefined?i.texto:i.valor),XD,doc.y,8.5,C.escuro,true,'dir');
      doc.y-=16;
    });
    doc.y-=4;
  };
  // tabela: colunas em fração da largura; a última alinha à direita
  const tabela=(cabec,linhas,fracs)=>{
    // cada fração é o início da coluna, medido da margem esquerda
    const xs=fracs.map(f=>X+L*f);
    if(cabec){
      doc.espaco(24);
      doc.ret(X,doc.y-4,L,15,C.fundo);
      cabec.forEach((c,i)=>{
        const ult=i===cabec.length-1;
        doc.textoEm(c.toUpperCase(),ult?XD-3:xs[i]+3,doc.y,6.8,C.claro,true,ult?'dir':null);
      });
      doc.y-=19;
    }
    linhas.forEach(l=>{
      if(doc.espaco(20)&&cabec){
        doc.ret(X,doc.y-4,L,15,C.fundo);
        cabec.forEach((c,i)=>{
          const ult=i===cabec.length-1;
          doc.textoEm(c.toUpperCase(),ult?XD-3:xs[i]+3,doc.y,6.8,C.claro,true,ult?'dir':null);
        });
        doc.y-=19;
      }
      l.forEach((cel,i)=>{
        const ult=i===l.length-1;
        const cor=cel.cor||(i===0?C.escuro:C.cinza);
        doc.textoEm(String(cel.t!==undefined?cel.t:cel),ult?XD-3:xs[i]+3,doc.y,8.5,cor,!!cel.neg,ult?'dir':null);
      });
      doc.y-=6;
      doc.linha(X,doc.y,XD,C.linha,0.5);
      doc.y-=10;
    });
    doc.y-=6;
  };

  const equipes=Object.entries(d.presenca.por_equipe||{}).filter(([,v])=>v.pessoas>0)
    .map(([k,v])=>({rotulo:k,valor:v.presente}));
  const semana=Object.entries(d.presenca.por_dia_semana||{})
    .map(([k,v])=>({rotulo:DS[k]||k,valor:mediaSemana(v),texto:rNum(mediaSemana(v)),dias:(v&&v.dias)||0}));
  const F=d.ferias||{no_periodo:[],agendadas:[]};
  const PE=d.pessoal||{admissoes:[],desligamentos:[],transferencias:[]};
  const FX=(d.plano_medico||{}).faixas||[];
  let algo=false;

  if(equipes.length){algo=true;secao('Presença por equipe',C.barra);barras(equipes,C.barra);}
  if(semana.some(x=>x.valor)){
    algo=true;secao('Média de presença por dia da semana',C.claro);barras(semana,C.claro);
    doc.texto('Média de pessoas presentes em cada dia da semana ('+
      semana.map(x=>x.rotulo+': '+x.dias).join('  ·  ')+' dia(s) no período).',X,8.5,C.claro);doc.y-=14;
  }

  if(PE.admissoes.length||PE.desligamentos.length||PE.transferencias.length){
    algo=true;secao('Movimentação no escritório',C.verde);
    // Entradas e saídas em destaque: é o número que o sócio procura primeiro.
    const foco=[['Admissões',PE.admissoes.length,C.verde],
                ['Desligamentos',PE.desligamentos.length,C.vinho],
                ['Promoções',PE.transferencias.length,C.roxo]];
    const lf=(L-12)/3, af=46;
    doc.espaco(af+10);
    foco.forEach((f,i)=>{
      const x=X+i*(lf+6);
      doc.ret(x,doc.y-af,lf,af,C.fundo);
      doc.ret(x,doc.y-2,lf,2.5,f[2]);
      doc.textoEm(String(f[1]),x+10,doc.y-24,17,f[1]?f[2]:C.claro,true);
      doc.textoEm(f[0].toUpperCase(),x+10,doc.y-37,7,C.claro,true);
    });
    doc.y-=af+14;
    const l=[];
    PE.admissoes.forEach(x=>l.push([{t:'Admissão',cor:C.verde,neg:true},{t:x.person,neg:true},x.team||'',rData(x.date)]));
    PE.transferencias.forEach(x=>l.push([{t:'Promoção',cor:C.roxo,neg:true},{t:x.person,neg:true},x.de+' > '+x.para,rData(x.date)]));
    PE.desligamentos.forEach(x=>l.push([{t:'Desligamento',cor:C.vinho,neg:true},{t:x.person,neg:true},x.team||'',rData(x.date)]));
    tabela(null,l,[0,0.22,0.5,1]);
  }
  if(F.no_periodo.length){
    algo=true;secao('Férias em andamento',C.azul);
    tabela(['Colaborador','Equipe','Período'],
      F.no_periodo.map(x=>[{t:x.person,neg:true},x.team||'',rData(x.start)+' a '+rData(x.end)]),[0,0.42,1]);
  }
  if(F.agendadas.length){
    algo=true;secao('Férias agendadas',C.azul);
    tabela(['Colaborador','Equipe','A partir de'],
      F.agendadas.map(x=>[{t:x.person,neg:true},x.team||'',{t:rData(x.start),cor:C.azul,neg:true}]),[0,0.42,1]);
  }
  if(d.afastamentos.total){
    algo=true;secao('Atestados e licenças',C.ambar);
    const tipos=Object.entries(d.afastamentos.por_tipo||{}).map(([k,v])=>k+': '+v).join('   ·   ');
    doc.texto(tipos,X,8.5,C.cinza); doc.y-=16;
    if(d.afastamentos.lista.length)
      tabela(['Colaborador','Tipo','Período'],
        d.afastamentos.lista.map(v=>[v.person,v.type,rData(v.start)+' a '+rData(v.end)]),[0,0.42,1]);
  }
  const CV=(d.plano_medico||{}).convenio;
  if(CV&&CV.vidas){
    algo=true;secao('Convênio médico · custo do mês',C.roxo);
    const linhas=[
      ['Prêmio (sem IOF)',rMoeda(CV.premio)],
      ['IOF',rMoeda(CV.iof)],
      ['Total do convênio',rMoeda(CV.total),true],
      ['Descontado em folha',rMoeda(CV.folha)],
      ['Custo do escritório',rMoeda(CV.empresa)+'   ('+rNum(CV.pct_empresa)+'% do total)']];
    linhas.forEach(([rot,val,neg])=>{
      doc.espaco(18);
      if(neg){doc.ret(X,doc.y-4,L,15,C.fundo)}
      doc.textoEm(rot,X+3,doc.y,8.5,neg?C.escuro:C.cinza,!!neg);
      doc.textoEm(val,XD-3,doc.y,8.5,neg?C.roxo:C.escuro,!!neg,'dir');
      doc.y-=6; doc.linha(X,doc.y,XD,C.linha,0.5); doc.y-=10;
    });
    doc.y-=2;
    doc.texto(CV.vidas+' vida(s): '+CV.titulares+' titular(es) + '+CV.dependentes+' dependente(s)'+
      (CV.bancados?'  ·  '+CV.bancados+' pago(s) pelo escritório':'')+
      '  ·  média de '+rMoeda(CV.medio)+' por vida.',X,8.5,C.claro);doc.y-=16;
  }
  if(FX.length){
    algo=true;secao('Plano médico · mudança de faixa etária',C.roxo);
    tabela(['Beneficiário','Faixa','Aniversário'],
      FX.map(x=>[{t:x.person+(x.titular?' (dep. '+x.titular+')':''),neg:true},
        {t:x.de+' > '+x.para,cor:C.roxo},x.aniversario.split('-').reverse().join('/')]),[0,0.46,1]);
  }
  if(d.prestadores.vencendo.length||d.prestadores.vencidos){
    algo=true;secao('Contratos a vencer',C.vinho);
    if(d.prestadores.vencidos){
      doc.texto(d.prestadores.vencidos+' contrato(s) já vencido(s).',X,8.5,C.vinho,true);doc.y-=16;
    }
    if(d.prestadores.vencendo.length)
      tabela(['Prestador','Segmento','Vence em'],
        d.prestadores.vencendo.map(p=>[{t:p.nome,neg:true},p.segmento||'',{t:rData(p.fim),cor:C.ambar,neg:true}]),[0,0.46,1]);
  }
  const mov=[];
  if(d.documentacao.no_periodo)mov.push(['Documentos arquivados na Contabilidade',{t:String(d.documentacao.no_periodo),neg:true}]);
  if(d.folha_extra.lancamentos)mov.push(['Lançamentos fora da folha',{t:d.folha_extra.lancamentos+(d.folha_extra.total?'  ·  '+rMoeda(d.folha_extra.total):''),neg:true}]);
  if(mov.length){algo=true;secao('Movimentações no período',C.cinza);tabela(null,mov,[0,1]);}

  if(!algo){doc.texto('Nenhuma movimentação registrada neste período.',X,10,C.claro);doc.y-=16}

  doc.espaco(30);
  doc.linha(X,doc.y,XD,C.linha,0.6); doc.y-=12;
  doc.texto('FKG Advogados  ·  gerado pelo VPoint em '+
    new Date(d.gerado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',
      day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),X,7.5,'#A0A0A0');

  return pdfMontar(doc.fim());
}

// Monta e dispara. Usado pelo botão "Enviar agora" e pelo cron.
async function reportEnviar(env,dados,para,origem){
  const cfgMail=await getMailConfig(env);
  if(!ehEmail(cfgMail.remetente_email))
    return {ok:false,erro:'Configure o remetente em Avisos por e-mail antes de enviar o relatório.'};
  const P=dados.periodo;
  // Vai com o PDF anexo e o mesmo conteúdo no corpo: quem abre no celular lê
  // na hora, quem precisa arquivar ou encaminhar tem o arquivo.
  let anexo=null;
  try{
    const bytes=relatorioPdf(dados);
    anexo=[{filename:'Relatorio-gerencial-'+P.ini+'-a-'+P.fim+'.pdf',content:pdfB64(bytes)}];
  }catch(e){/* se o PDF falhar, o e-mail ainda sai com o corpo em HTML */}
  const r=await enviarEmail(env,{
    de:mailRemetente(cfgMail),para,
    assunto:'Relatório gerencial · '+rData(P.ini)+' a '+rData(P.fim),
    texto:'Relatório gerencial do período de '+rData(P.ini)+' a '+rData(P.fim)+'. O PDF segue anexo.',
    html:relatorioEmailHtml(dados,await mailTema(env),origem),
    anexos:anexo
  });
  await mailRegistrar(env,cfgMail,{tipo:'relatorio',pessoa:P.ini+' a '+P.fim,para,
    ok:r.ok,erro:r.erro||'',id:r.id||''});
  return r;
}

const rEsc=x=>String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rMoeda=v=>'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const rData=d=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
// por_dia_semana guarda {total,dias,media}; aceita o formato antigo (número puro).
const mediaSemana=v=>typeof v==='object'&&v?(v.media||0):(Number(v)||0);
const rNum=v=>(Math.round(Number(v)*10)/10).toFixed(1).replace('.',',');

// Barras feitas com tabela e largura percentual: é o gráfico que sobrevive a
// cliente de e-mail. Canvas e SVG não renderizam no Outlook.
function rBarras(itens,cor){
  const max=Math.max(1,...itens.map(i=>i.valor));
  return itens.map(i=>{
    const pct=Math.round(i.valor/max*100);
    return `<tr>
    <td style="padding:5px 10px 5px 0;font-size:12px;color:#5E5E5E;white-space:nowrap">${rEsc(i.rotulo)}</td>
    <td style="padding:5px 0;width:100%">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
        <td style="background:${cor};height:14px;border-radius:3px;width:${pct}%;font-size:1px;line-height:1px">&nbsp;</td>
        <td style="width:${100-pct}%;font-size:1px;line-height:1px">&nbsp;</td>
      </tr></table>
    </td>
    <td style="padding:5px 0 5px 10px;font-size:12px;font-weight:700;color:#191919;text-align:right;white-space:nowrap">${rEsc(i.texto||i.valor)}</td>
  </tr>`}).join('');
}

function relatorioEmailHtml(d,tema,origem){
  const t=tema||{barra:'#333333',escuro:'#191919'};
  const P=d.periodo, DS=['','Seg','Ter','Qua','Qui','Sex'];
  const C={verde:'#2F7A4F',ambar:'#B8860B',vinho:'#B4453C',roxo:'#6B5B95',azul:'#1D4ED8',cinza:'#5E5E5E'};

  const kpi=(rot,val,sub,cor)=>`<td style="padding:0 5px" width="25%">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #ECECEC;border-top:3px solid ${cor};border-radius:8px">
      <tr><td style="padding:13px 8px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:${cor};line-height:1.1">${rEsc(val)}</div>
        <div style="font-size:10.5px;color:#8A8A8A;padding-top:6px;line-height:1.4">${rEsc(rot)}</div>
        ${sub?`<div style="font-size:10px;color:#B0B0B0;padding-top:3px">${rEsc(sub)}</div>`:''}
      </td></tr></table></td>`;

  // "ícone" que sobrevive a e-mail: um quadradinho colorido antes do título.
  // SVG e webfont não renderizam no Outlook; cor e forma, sim.
  const secao=(tit,cor)=>`<tr><td style="padding:24px 26px 10px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
      <tr>
        <td width="10" style="width:10px"><div style="width:10px;height:10px;background:${cor};border-radius:3px;font-size:1px;line-height:1px">&nbsp;</div></td>
        <td style="padding-left:9px;font-size:11.5px;font-weight:700;letter-spacing:.8px;color:#5E5E5E;text-transform:uppercase">${rEsc(tit)}</td>
      </tr>
      <tr><td colspan="2" style="padding-top:7px"><div style="height:2px;background:${cor};opacity:.25;font-size:1px;line-height:1px">&nbsp;</div></td></tr>
    </table></td></tr>`;

  const linhas=(itens,cols)=>`<tr><td style="padding:0 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px">
    ${itens.map(l=>`<tr>${cols(l)}</tr>`).join('')}
    </table></td></tr>`;
  const cel=(txt,estilo)=>`<td style="padding:6px 0;border-bottom:1px solid #F2F2F2;${estilo||'color:#333'}">${rEsc(txt)}</td>`;

  const equipes=Object.entries(d.presenca.por_equipe||{}).filter(([,v])=>v.pessoas>0)
    .map(([k,v])=>({rotulo:k,valor:v.presente}));
  const semana=Object.entries(d.presenca.por_dia_semana||{})
    .map(([k,v])=>({rotulo:DS[k]||k,valor:mediaSemana(v),texto:rNum(mediaSemana(v)),dias:(v&&v.dias)||0}));
  const tipos=Object.entries(d.afastamentos.por_tipo||{})
    .map(([k,v])=>`${rEsc(k)}: <strong>${v}</strong>`).join(' &nbsp;·&nbsp; ');

  const F=d.ferias||{no_periodo:[],agendadas:[]};
  const PE=d.pessoal||{admissoes:[],desligamentos:[],transferencias:[]};
  const FX=(d.plano_medico||{}).faixas||[];

  // Seção sem movimentação simplesmente não entra na folha.
  let corpo='';
  if(equipes.length){
    corpo+=secao('Presença por equipe',t.barra)+
      `<tr><td style="padding:0 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rBarras(equipes,t.barra)}</table>
      ${d.presenca.total_ho?'<div style="font-size:11px;color:#9A9A9A;padding-top:8px">'+d.presenca.total_ho+' registro(s) de home office no período, contados à parte.</div>':''}
      </td></tr>`;
  }
  if(semana.some(x=>x.valor)){
    corpo+=secao('Média de presença por dia da semana','#8A8A8A')+
      `<tr><td style="padding:0 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rBarras(semana,'#8A8A8A')}</table>`+
      `<div style="font-size:11px;color:#9A9A9A;padding-top:8px">Média de pessoas presentes em cada dia da semana (${semana.map(x=>x.rotulo+': '+x.dias).join(' &middot; ')} dia(s) no período).</div></td></tr>`;
  }
  if(PE.admissoes.length||PE.desligamentos.length||PE.transferencias.length){
    corpo+=secao('Movimentação no escritório',C.verde);
    // Entradas e saídas em bloco, antes dos nomes: é o número que se procura.
    const foco=(rot,n,cor)=>`<td width="33%" style="padding:0 5px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAFA;border:1px solid #ECECEC;border-top:3px solid ${cor};border-radius:8px">
        <tr><td style="padding:12px 8px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:${n?cor:'#C4C4C4'};line-height:1.1">${n}</div>
          <div style="font-size:10px;color:#8A8A8A;padding-top:5px;letter-spacing:.6px;text-transform:uppercase">${rEsc(rot)}</div>
        </td></tr></table></td>`;
    corpo+=`<tr><td style="padding:2px 21px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`+
      foco('Admissões',PE.admissoes.length,C.verde)+
      foco('Desligamentos',PE.desligamentos.length,C.vinho)+
      foco('Promoções',PE.transferencias.length,C.roxo)+
      `</tr></table></td></tr>`;
    if(PE.admissoes.length)corpo+=linhas(PE.admissoes,l=>
      cel('↗ '+l.person,'color:'+C.verde+';font-weight:700')+cel(l.team,'color:#8A8A8A')+
      cel('admitido em '+rData(l.date),'color:#8A8A8A;text-align:right;white-space:nowrap'));
    if(PE.transferencias.length)corpo+=linhas(PE.transferencias,l=>
      cel('★ '+l.person,'color:'+C.roxo+';font-weight:700')+cel(l.de+' → '+l.para,'color:#8A8A8A')+
      cel(rData(l.date),'color:#8A8A8A;text-align:right;white-space:nowrap'));
    if(PE.desligamentos.length)corpo+=linhas(PE.desligamentos,l=>
      cel('↘ '+l.person,'color:'+C.vinho+';font-weight:700')+cel(l.team,'color:#8A8A8A')+
      cel('desligado em '+rData(l.date),'color:#8A8A8A;text-align:right;white-space:nowrap'));
  }
  if(F.no_periodo.length){
    corpo+=secao('Férias em andamento',C.azul)+linhas(F.no_periodo,l=>
      cel(l.person,'color:#333;font-weight:600')+cel(l.team||'','color:#8A8A8A')+
      cel(rData(l.start)+' a '+rData(l.end),'color:#8A8A8A;text-align:right;white-space:nowrap'));
  }
  if(F.agendadas.length){
    corpo+=secao('Férias agendadas',C.azul)+linhas(F.agendadas,l=>
      cel(l.person,'color:#333;font-weight:600')+cel(l.team||'','color:#8A8A8A')+
      cel('a partir de '+rData(l.start),'color:'+C.azul+';text-align:right;white-space:nowrap'));
  }
  if(d.afastamentos.total){
    corpo+=secao('Atestados e licenças',C.ambar)+
      `<tr><td style="padding:0 26px"><div style="font-size:12.5px;color:#5E5E5E;line-height:1.8">${tipos}</div></td></tr>`+
      linhas(d.afastamentos.lista.slice(0,8),l=>
        cel(l.person,'color:#333')+cel(l.type,'color:#8A8A8A')+
        cel(rData(l.start)+' a '+rData(l.end),'color:#8A8A8A;text-align:right;white-space:nowrap'));
  }
  const CV=(d.plano_medico||{}).convenio;
  if(CV&&CV.vidas){
    const ln=(rot,val,dest)=>`<tr>
      <td style="padding:${dest?'9px 0':'6px 0'};border-bottom:1px solid #F2F2F2;font-size:12.5px;color:${dest?'#191919':'#5E5E5E'};${dest?'font-weight:700':''}">${rEsc(rot)}</td>
      <td style="padding:${dest?'9px 0':'6px 0'};border-bottom:1px solid #F2F2F2;font-size:${dest?'14px':'12.5px'};font-weight:700;color:${dest?C.roxo:'#191919'};text-align:right;white-space:nowrap">${rEsc(val)}</td></tr>`;
    corpo+=secao('Convênio médico · custo do mês',C.roxo)+
      `<tr><td style="padding:0 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`+
      ln('Prêmio (sem IOF)',rMoeda(CV.premio))+
      ln('IOF',rMoeda(CV.iof))+
      ln('Total do convênio',rMoeda(CV.total),true)+
      ln('Descontado em folha',rMoeda(CV.folha))+
      ln('Custo do escritório',rMoeda(CV.empresa)+' ('+rNum(CV.pct_empresa)+'%)')+
      `</table><div style="font-size:11px;color:#9A9A9A;padding-top:8px;line-height:1.6">`+
      `${CV.vidas} vida(s): ${CV.titulares} titular(es) + ${CV.dependentes} dependente(s)`+
      `${CV.bancados?' &middot; '+CV.bancados+' pago(s) pelo escritório':''} &middot; média de ${rMoeda(CV.medio)} por vida.</div></td></tr>`;
  }
  if(FX.length){
    corpo+=secao('Plano médico · mudança de faixa etária',C.roxo)+linhas(FX,l=>
      cel(l.person+(l.titular?' (dep. de '+l.titular+')':''),'color:#333;font-weight:600')+
      cel(l.de+' → '+l.para,'color:'+C.roxo)+
      cel('aniversário '+l.aniversario.split('-').reverse().join('/'),'color:#8A8A8A;text-align:right;white-space:nowrap'));
  }
  if(d.prestadores.vencendo.length||d.prestadores.vencidos){
    corpo+=secao('Contratos a vencer',C.vinho)+
      (d.prestadores.vencidos?`<tr><td style="padding:0 26px"><div style="font-size:12.5px;color:${C.vinho};padding-bottom:6px"><strong>${d.prestadores.vencidos}</strong> contrato(s) já vencido(s).</div></td></tr>`:'')+
      (d.prestadores.vencendo.length?linhas(d.prestadores.vencendo,l=>
        cel(l.nome,'color:#333;font-weight:600')+cel(l.segmento||'','color:#8A8A8A')+
        cel('vence '+rData(l.fim),'color:'+C.ambar+';text-align:right;white-space:nowrap')):'');
  }
  const mov=[];
  if(d.documentacao.no_periodo)mov.push(['Documentos arquivados na Contabilidade',d.documentacao.no_periodo]);
  if(d.folha_extra.lancamentos)mov.push(['Lançamentos fora da folha',d.folha_extra.lancamentos+(d.folha_extra.total?' · '+rMoeda(d.folha_extra.total):'')]);
  if(mov.length){
    corpo+=secao('Movimentações no período',C.cinza)+linhas(mov,l=>
      cel(l[0],'color:#8A8A8A')+cel(l[1],'color:#191919;font-weight:700;text-align:right'));
  }
  if(!corpo)corpo=`<tr><td style="padding:30px 26px;text-align:center;color:#9A9A9A;font-size:13px">Nenhuma movimentação registrada neste período.</td></tr>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>Relatório gerencial</title></head>
<body style="margin:0;padding:0;background:#F1F1F1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1F1;padding:26px 12px;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:100%;background:#FFFFFF;border-radius:10px;overflow:hidden">

  <tr><td style="background:${t.barra};padding:20px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left"><img src="${mailLogo(origem)}" alt="VPoint" width="110" style="display:block;width:110px;height:auto;border:0"></td>
      <td align="right" style="color:#FFFFFF;font-size:11px;letter-spacing:1.2px">FKG ADVOGADOS</td>
    </tr></table></td></tr>

  <tr><td style="padding:26px 26px 4px">
    <div style="font-size:21px;font-weight:700;color:${t.escuro}">Relatório gerencial</div>
    <div style="font-size:13px;color:#7A7A7A;padding-top:5px">${rData(P.ini)} a ${rData(P.fim)} · ${P.dias_uteis} dias úteis${P.feriados?' · '+P.feriados+' feriado(s)':''}</div>
  </td></tr>

  <tr><td style="padding:18px 21px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${kpi('Colaboradores',d.pessoas.total,'',t.barra)}
      ${kpi('Presenças/dia',rNum(d.presenca.media_dia),'média',C.verde)}
      ${kpi('Atestados e licenças',d.afastamentos.total,'férias à parte',C.ambar)}
      ${kpi('Fora da folha',String(d.folha_extra.lancamentos),rMoeda(d.folha_extra.total),C.azul)}
    </tr></table></td></tr>

  ${corpo}

  <tr><td style="background:#FAFAFA;border-top:1px solid #EFEFEF;padding:15px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="font-size:11px;color:#A0A0A0">Gerado pelo VPoint</td>
      <td align="right" style="font-size:11px;color:#A0A0A0">${rEsc(new Date(d.gerado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}))}</td>
    </tr></table></td></tr>

</table>
<div style="font-size:10.5px;color:#B4B4B4;padding-top:13px">Uma solução VWork IT</div>
</td></tr></table></body></html>`;
}

// ══ LIXEIRA ══
// Nenhuma exclusão de registro é definitiva na hora: o que sai vai para cá e
// fica 30 dias, podendo voltar. Só o superadmin restaura.
//
// Cada item guarda a coleção de origem (a chave do KV onde a lista vive), o
// registro inteiro e os arquivos anexos. Restaurar é devolver o registro à
// lista — por isso funciona igual para prestador, pedido de compra ou férias.
const LIXO_DIAS=30;
const LIXO_TTL=LIXO_DIAS*24*60*60;

async function lixoGuardar(env,{colecao,modulo,rotulo,dados,quem,arquivos}){
  const id='lx'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const agora=new Date();
  const expira=new Date(agora.getTime()+LIXO_TTL*1000);
  const item={id,colecao,modulo,rotulo:String(rotulo||'').slice(0,160),
    dados,arquivos:Array.isArray(arquivos)?arquivos:[],
    excluido_em:agora.toISOString(),excluido_por:quem||'',expira_em:expira.toISOString()};
  await env.ATTENDANCE.put('lixo:'+id,JSON.stringify(item),{expirationTtl:LIXO_TTL});
  // Os arquivos vivem no R2, que não expira sozinho. Este índice diz ao cron
  // diário quais apagar depois que o prazo vence.
  if(item.arquivos.length){
    const idx=await lixoArquivos(env);
    idx.push({chave:id,arquivos:item.arquivos,expira_em:item.expira_em});
    await env.ATTENDANCE.put('lixo_arquivos',JSON.stringify(idx.slice(-500)));
  }
  return id;
}
async function lixoArquivos(env){
  const r=await env.ATTENDANCE.get('lixo_arquivos');
  const l=r?JSON.parse(r):[];
  return Array.isArray(l)?l:[];
}
// Apaga do R2 os arquivos cujo item já saiu da lixeira pelo prazo.
// Confere se o item ainda existe antes de apagar: se alguém restaurou, o
// arquivo tem que ficar.
async function lixoLimpar(env){
  const idx=await lixoArquivos(env);
  const agora=Date.now();
  const ficam=[];
  let apagados=0;
  for(const item of idx){
    if(new Date(item.expira_em).getTime()>agora){ficam.push(item);continue}
    if(await env.ATTENDANCE.get('lixo:'+item.chave)){ficam.push(item);continue}
    for(const a of item.arquivos||[]){
      try{await delHrFile(env,a);apagados++}catch(e){}
    }
  }
  await env.ATTENDANCE.put('lixo_arquivos',JSON.stringify(ficam));
  return {arquivos_apagados:apagados,pendentes:ficam.length};
}

async function lixoListar(env){
  const l=await env.ATTENDANCE.list({prefix:'lixo:'});
  const itens=[];
  for(const k of l.keys){
    const raw=await env.ATTENDANCE.get(k.name);
    if(raw)itens.push(JSON.parse(raw));
  }
  return itens.sort((a,b)=>String(b.excluido_em).localeCompare(String(a.excluido_em)));
}
// Devolve o registro à lista de origem. Se um registro com o mesmo id já
// estiver lá (alguém recriou na mão), não sobrescreve.
async function lixoRestaurar(env,item){
  const raw=await env.ATTENDANCE.get(item.colecao);
  const lista=raw?JSON.parse(raw):[];
  if(!Array.isArray(lista))return {ok:false,erro:'A lista de origem mudou de formato e não aceita a restauração.'};
  const id=item.dados&&item.dados.id;
  if(id&&lista.some(x=>x&&x.id===id))
    return {ok:false,erro:'Já existe um registro com este identificador no destino.'};
  lista.push(item.dados);
  await env.ATTENDANCE.put(item.colecao,JSON.stringify(lista));
  await env.ATTENDANCE.delete('lixo:'+item.id);
  const idx=(await lixoArquivos(env)).filter(x=>x.chave!==item.id);
  await env.ATTENDANCE.put('lixo_arquivos',JSON.stringify(idx));
  return {ok:true};
}

// ══ AVISOS POR E-MAIL (Resend) ══
// A chave vive em env.RESEND_API_KEY, cadastrada como secret — nunca no
// wrangler.toml, que é texto puro. Sem a chave, nada quebra: o sistema
// registra que não está configurado e segue.
const MAIL_PADRAO={ativo:false,frequencia:'todas',remetente_nome:'VPoint',remetente_email:'',regras:[],log:[]};
async function getMailConfig(env){
  const r=await env.ATTENDANCE.get('mail_config');
  return Object.assign({},MAIL_PADRAO,r?JSON.parse(r):{});
}
async function putMailConfig(env,cfg){
  await env.ATTENDANCE.put('mail_config',JSON.stringify(cfg));
}
const ehEmail=v=>/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v||'').trim());
// A regra guarda uma lista de monitorados. Cadastros antigos tinham um nome só
// no campo "person" — continuam funcionando sem precisar refazer nada.
function mailPessoas(r){
  if(Array.isArray(r&&r.persons))return r.persons;
  return (r&&r.person)?[r.person]:[];
}

async function enviarEmail(env,{de,para,assunto,html,texto,anexos}){
  const chave=String((env&&env.RESEND_API_KEY)||'').trim();
  if(!chave)return {ok:false,erro:'A chave do Resend não está configurada neste ambiente.'};
  const lista=(Array.isArray(para)?para:[para]).map(e=>String(e||'').trim()).filter(ehEmail);
  if(!lista.length)return {ok:false,erro:'Nenhum destinatário válido.'};
  try{
    const res=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':'Bearer '+chave,'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({from:de,to:lista,subject:assunto,html,text:texto},
        (anexos&&anexos.length)?{attachments:anexos}:{}))
    });
    const dados=await res.json().catch(()=>({}));
    if(!res.ok)return {ok:false,erro:(dados&&(dados.message||dados.name))||('Resend respondeu '+res.status)};
    return {ok:true,id:dados.id||''};
  }catch(e){return {ok:false,erro:'Falha ao falar com o Resend: '+e.message}}
}

function mailRemetente(cfg){
  const nome=String(cfg.remetente_nome||'VPoint').replace(/[<>"]/g,'').trim()||'VPoint';
  return nome+' <'+String(cfg.remetente_email||'').trim()+'>';
}

// Guarda as últimas 40 tentativas, para a tela mostrar o que saiu e o que falhou.
async function mailRegistrar(env,cfg,item){
  cfg.log=[Object.assign({quando:new Date().toISOString()},item)].concat(cfg.log||[]).slice(0,40);
  await putMailConfig(env,cfg);
}

// Aviso de chegada: dispara na primeira batida do dia de quem tem regra ativa.
async function avisarChegada(env,pessoa,equipe,quando,origem){
  const cfg=await getMailConfig(env);
  if(!cfg.ativo)return;
  // Junta os destinatários de TODAS as regras ativas que monitoram a pessoa.
  const destinos=[...new Set((cfg.regras||[])
    .filter(r=>r.ativo!==false&&mailPessoas(r).includes(pessoa))
    .flatMap(r=>r.emails||[]))];
  if(!destinos.length)return;
  if(!ehEmail(cfg.remetente_email))return;
  const dia=logDiaBR();
  // Trava curta contra a MESMA passagem chegando duas vezes: o equipamento
  // reenvia evento quando não recebe confirmação, e o dedo encostado duas
  // vezes em segundos é uma passagem só. Isso vale nos dois modos.
  const antiDup='mail_dup:'+pessoa;
  if(await env.ATTENDANCE.get(antiDup))return;
  await env.ATTENDANCE.put(antiDup,'1',{expirationTtl:90});

  const contador='mail_av:'+dia+':'+pessoa;
  const anteriores=parseInt(await env.ATTENDANCE.get(contador)||'0',10)||0;
  if(cfg.frequencia!=='todas'&&anteriores>0)return;   // modo "só a primeira"
  const numero=anteriores+1;
  await env.ATTENDANCE.put(contador,String(numero),{expirationTtl:60*60*30});
  const hora=quando||new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
  const dataBR=dia.slice(8,10)+'/'+dia.slice(5,7)+'/'+dia.slice(0,4);
  const r=await enviarEmail(env,{
    de:mailRemetente(cfg),
    para:destinos,
    assunto:numero===1?(pessoa+' chegou ao escritório')
                      :(pessoa+' — '+numero+'ª passagem de hoje'),
    texto:pessoa+' registrou passagem em '+dataBR+' às '+hora+'.',
    html:mailCorpo(pessoa,equipe,dataBR,hora,await mailTema(env),origem,numero)
  });
  await mailRegistrar(env,cfg,{tipo:numero===1?'chegada':'passagem',pessoa,para:destinos,numero,
    ok:r.ok,erro:r.erro||'',id:r.id||''});
}

// O aviso segue as cores definidas em Personalização: o escritório troca o
// tema do sistema e o e-mail acompanha, sem ninguém mexer aqui.
async function mailTema(env){
  const padrao={barra:'#333333',escuro:'#191919'};
  try{
    const r=await env.ATTENDANCE.get('ui_theme');
    const v=(r&&JSON.parse(r).vars)||{};
    const hex=x=>/^#[0-9a-fA-F]{6}$/.test(String(x||''))?x:null;
    return {barra:hex(v['--sidebar'])||padrao.barra,escuro:hex(v['--dark'])||padrao.escuro};
  }catch(e){return padrao}
}

// O logo sai do próprio VPoint (arquivo vpoint-logo.png na raiz do projeto).
// A origem vem da requisição, então trocar de domínio não quebra a imagem.
// Em e-mail, data: URI não serve — a maioria dos clientes bloqueia.
const mailLogo=origem=>String(origem||'https://vpoint.app.br').replace(/\/$/,'')+'/vpoint-logo.png';
const MAIL_DIAS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

// HTML de e-mail é outro mundo: tabela, estilo em linha e nada de flex ou
// grid — é o que sobrevive ao Outlook. A imagem leva alt, porque muitos
// clientes bloqueiam imagem por padrão e o cabeçalho não pode sumir.
function mailCorpo(pessoa,equipe,data,hora,tema,origem,numero){
  const t=tema||{barra:'#333333',escuro:'#191919'};
  const esc=x=>String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let diaSemana='';
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(data||''));
  if(m)diaSemana=MAIL_DIAS[new Date(+m[3],+m[2]-1,+m[1],12).getDay()]||'';
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(pessoa)} chegou</title></head>
<body style="margin:0;padding:0;background:#F1F1F1;">
<!-- linha de prévia da caixa de entrada; mso-hide evita que o Outlook desktop a mostre -->
<div style="display:none;mso-hide:all;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F1F1F1">${esc(pessoa)} registrou passagem às ${esc(hora)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1F1;padding:28px 14px;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background:#FFFFFF;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

  <tr><td style="background:${t.barra};padding:20px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="vertical-align:middle">
        <img src="${mailLogo(origem)}" alt="VPoint" width="118"
          style="display:block;width:118px;height:auto;border:0;outline:none">
      </td>
      <td align="right" style="vertical-align:middle;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:1.2px;opacity:.85">FKG ADVOGADOS</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:30px 26px 6px">
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#9A9A9A;text-transform:uppercase">${(numero||1)===1?'Registro de entrada':esc(numero+'ª passagem de hoje')}</div>
    <div style="font-size:25px;font-weight:700;color:${t.escuro};line-height:1.25;padding-top:8px">${esc(pessoa)}</div>
    ${equipe?`<div style="padding-top:10px"><span style="display:inline-block;font-size:11.5px;font-weight:700;color:#5E5E5E;background:#F1F1F1;border-radius:20px;padding:5px 13px">${esc(equipe)}</span></div>`:''}
  </td></tr>

  <tr><td style="padding:22px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#FAFAFA;border:1px solid #ECECEC;border-radius:8px">
      <tr><td align="center" style="padding:20px 16px">
        <div style="font-size:40px;font-weight:700;color:${t.escuro};line-height:1;letter-spacing:-1px">${esc(hora)}</div>
        <div style="font-size:13px;color:#7A7A7A;padding-top:9px">${diaSemana?esc(diaSemana)+', ':''}${esc(data)}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 26px 28px">
    <div style="font-size:13px;color:#6E6E6E;line-height:1.7">${(numero||1)===1
      ?'Registro feito na biometria da entrada. Este é o primeiro do dia.'
      :'Registro feito na biometria da entrada. Passagens anteriores hoje: '+esc(String(numero-1))+'.'}</div>
  </td></tr>

  <tr><td style="background:#FAFAFA;border-top:1px solid #EFEFEF;padding:15px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="font-size:11px;color:#A0A0A0">Aviso automático do VPoint</td>
      <td align="right" style="font-size:11px;color:#A0A0A0">FKG Advogados</td>
    </tr></table>
  </td></tr>

</table>
<div style="font-size:10.5px;color:#B4B4B4;padding-top:14px">Uma solução VWork IT</div>
</td></tr></table>
</body></html>`;
}

// ── PRESTADORES DE SERVIÇO ──
async function getProviders(env){const r=await env.ATTENDANCE.get('providers');return r?JSON.parse(r):[]}
// Segmentos sugeridos na tela. A lista cresce sozinha com o que for cadastrado,
// então ninguém fica preso a um menu fechado.
const PROV_SEGMENTOS=['Elétrica','Hidráulica','Contabilidade','Jurídico','Brindes',
  'Informática','Limpeza','Manutenção predial','Segurança','Telefonia','Gráfica',
  'Marketing','Seguros','Transporte','Outros'];
async function getProvSegmentos(env){
  const lista=await getProviders(env);
  const usados=lista.map(p=>String(p.segmento||'').trim()).filter(Boolean);
  return [...new Set(PROV_SEGMENTOS.concat(usados))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
const txt=(v,max)=>String(v==null?'':v).trim().slice(0,max);
const dataOuVazio=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
// Vários números e vários e-mails, cada um com uma etiqueta livre
// ("Financeiro", "João — técnico"). Guarda no máximo 12 de cada.
function listaContato(v){
  if(!Array.isArray(v))return [];
  return v.map(x=>({rotulo:txt(x&&x.rotulo,60),valor:txt(x&&x.valor,120)}))
          .filter(x=>x.valor).slice(0,12);
}
function campoProvider(b){
  return {
    nome:txt(b.nome,120), endereco:txt(b.endereco,240), responsavel:txt(b.responsavel,120),
    segmento:txt(b.segmento,60), site:txt(b.site,200),
    whatsapps:listaContato(b.whatsapps), emails:listaContato(b.emails),
    vigencia_inicio:dataOuVazio(b.vigencia_inicio), vigencia_fim:dataOuVazio(b.vigencia_fim),
    observacao:txt(b.observacao,2000)
  };
}
// Cadastros antigos tinham um campo "Contato" só, com tudo misturado. Aqui ele
// é repartido na leitura — o que tem @ vira e-mail, o resto vira telefone —
// para a tela nunca precisar lidar com os dois formatos.
function normalizaProvider(p){
  if(Array.isArray(p.whatsapps)&&Array.isArray(p.emails))return p;
  const partes=String(p.contato||'').split(/[;,\n]/).map(s=>s.trim()).filter(Boolean);
  return Object.assign({},p,{
    whatsapps:Array.isArray(p.whatsapps)?p.whatsapps
      :partes.filter(x=>!x.includes('@')).map(valor=>({rotulo:'',valor})),
    emails:Array.isArray(p.emails)?p.emails
      :partes.filter(x=>x.includes('@')).map(valor=>({rotulo:'',valor}))
  });
}
function validaVigencia(b){
  const i=dataOuVazio(b.vigencia_inicio), f=dataOuVazio(b.vigencia_fim);
  if(i&&f&&f<i)return 'A vigência final é anterior à inicial.';
  return '';
}
// Guarda o arquivo binário no KV e confere na hora se o que foi gravado tem o mesmo
// tamanho do que foi recebido — se não tiver, o upload falha com erro claro em vez de
// gravar um arquivo corrompido silenciosamente.
// ══ ARQUIVOS: R2 quando estiver ligado, KV quando não ══
// Enquanto o bucket não estiver vinculado, tudo continua funcionando no KV.
// Depois de vincular, gravações novas vão para o R2 e a leitura procura nos
// dois lugares — os arquivos antigos continuam abrindo sem migração.
function temR2(env){return !!(env&&env.ARQUIVOS&&typeof env.ARQUIVOS.put==='function')}

async function putHrFile(env,key,buf,tipo){
  if(temR2(env)){
    await env.ARQUIVOS.put(key,buf,{httpMetadata:tipo?{contentType:tipo}:undefined});
    const check=await env.ARQUIVOS.head(key);
    const stored=check?check.size:0;
    if(stored!==buf.byteLength){
      await env.ARQUIVOS.delete(key);
      throw new Error('Falha ao gravar o arquivo no R2 (recebido '+buf.byteLength+' bytes, gravado '+stored+' bytes). Tente novamente.');
    }
    // se o mesmo arquivo existia no KV, tira de lá para não pagar espaço duas vezes
    try{await env.ATTENDANCE.delete(key)}catch(e){}
    return stored;
  }
  await env.ATTENDANCE.put(key,buf);
  const check=await env.ATTENDANCE.get(key,{type:'arrayBuffer'});
  const stored=check?check.byteLength:0;
  if(stored!==buf.byteLength){
    await env.ATTENDANCE.delete(key);
    throw new Error('Falha ao gravar o arquivo (recebido '+buf.byteLength+' bytes, gravado '+stored+' bytes). Tente novamente ou use um arquivo menor.');
  }
  return stored;
}
// Lê primeiro no R2; se não achar, procura no KV (arquivo antigo).
async function getHrFile(env,key){
  if(temR2(env)){
    const obj=await env.ARQUIVOS.get(key);
    if(obj)return await obj.arrayBuffer();
  }
  return await env.ATTENDANCE.get(key,{type:'arrayBuffer'});
}
async function delHrFile(env,key){
  if(temR2(env)){try{await env.ARQUIVOS.delete(key)}catch(e){}}
  try{await env.ATTENDANCE.delete(key)}catch(e){}
}
// O equipamento Control iD grava o horário local (Brasília) já "rotulado" como se fosse UTC
// (não faz a conversão de fuso internamente). Por isso usamos os campos UTC do timestamp
// diretamente — eles já representam o horário local correto, sem precisar de ajuste extra.
// Data do registro no fuso de Brasília. Em UTC, uma batida às 22h caía no
// dia seguinte e a presença ia parar na data errada.
function todayStrFromTs(ts){
  return new Date(ts*1000-3*60*60*1000).toISOString().split('T')[0];
}
function isoWeek(date){const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()+4-(d.getDay()||7));const y=d.getFullYear();const j=new Date(y,0,1);const w=Math.ceil(((d-j)/86400000+1)/7);return`${y}-W${String(w).padStart(2,'0')}`}
function mondayOf(s){const d=new Date(s+'T12:00:00');const day=d.getDay();const diff=day===0?-6:1-day;d.setDate(d.getDate()+diff);return d.toISOString().split('T')[0]}
function weekDates(m){const dates=[];const md=new Date(m+'T12:00:00');for(let i=0;i<5;i++){const d=new Date(md);d.setDate(md.getDate()+i);dates.push(d.toISOString().split('T')[0])}return dates}
// ══ CONTABILIDADE: pastas e documentos ══
// Estrutura por ano: 01 a 13 (o 13 é o décimo terceiro), cada mês com as pastas
// padrão do escritório, mais Informes de Rendimentos, Dissídio e a PLR do ano
// anterior. Dentro disso o superadmin cria as subpastas que quiser.
const CONT_PASTAS_MES=['Admissão CLT','Admissão Estagiário','Adiantamento',
  'Folha de Pagamento','Rescisão CLT','Rescisão Estagiário','Férias',
  'Despesa Autônomos','Outros'];
const CONT_PASTAS_ANO=['Informes de Rendimentos','Dissídio'];

async function getContTree(env){
  const r=await env.ATTENDANCE.get('cont_tree');
  const l=r?JSON.parse(r):[];
  return Array.isArray(l)?l:[];
}
async function putContTree(env,tree){
  await env.ATTENDANCE.put('cont_tree',JSON.stringify(tree));
}
async function getContDocs(env,pastaId){
  const r=await env.ATTENDANCE.get('cont_docs:'+pastaId);
  const l=r?JSON.parse(r):[];
  return Array.isArray(l)?l:[];
}
function contNome(v){return String(v||'').trim().replace(/[\\/]/g,'-').slice(0,80)}
// Todos os descendentes de uma pasta, para apagar ou impedir a exclusão.
function contDescendentes(tree,id){
  const filhos=tree.filter(p=>p.parent_id===id);
  return filhos.reduce((acc,f)=>acc.concat([f],contDescendentes(tree,f.id)),[]);
}
// Monta o ano inteiro de uma vez: 13 meses × 9 pastas padrão + as do ano.
function contEsqueletoDoAno(ano,quem){
  const agora=new Date().toISOString();
  const base={criado_em:agora,criado_por:quem};
  const novos=[];
  const idAno='a'+ano;
  novos.push({id:idAno,parent_id:'',nome:String(ano),tipo:'ano',ordem:Number(ano),...base});
  for(let m=1;m<=13;m++){
    const mm=String(m).padStart(2,'0');
    const idMes=idAno+'-'+mm;
    novos.push({id:idMes,parent_id:idAno,nome:mm+'.'+ano,tipo:'mes',ordem:m,...base});
    CONT_PASTAS_MES.forEach((nome,i)=>{
      novos.push({id:idMes+'-'+i,parent_id:idMes,nome,tipo:'padrao',ordem:i,...base});
    });
  }
  CONT_PASTAS_ANO.forEach((nome,i)=>{
    novos.push({id:idAno+'-x'+i,parent_id:idAno,nome,tipo:'padrao',ordem:100+i,...base});
  });
  novos.push({id:idAno+'-plr',parent_id:idAno,nome:'PLR ano base '+(Number(ano)-1),
    tipo:'padrao',ordem:110,...base});
  return novos;
}

// ══ COMUNICADOS DA TV ══
// Três modelos de tela: só texto, imagem em tela cheia ou imagem ao lado do texto.
const COMUNICADO_MODELOS=['texto','imagem','lado'];
async function getComunicados(env){
  const r=await env.ATTENDANCE.get('comunicados');
  const l=r?JSON.parse(r):[];
  return Array.isArray(l)?l:[];
}
function comunicadoLimpo(b,base){
  const modelo=COMUNICADO_MODELOS.indexOf(b.modelo)>=0?b.modelo:'texto';
  const data=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
  return Object.assign({},base,{
    titulo:String(b.titulo||'').trim().slice(0,120),
    texto:String(b.texto||'').trim().slice(0,1200),
    modelo,
    inicio:data(b.inicio),
    fim:data(b.fim),
    ativo:b.ativo!==false
  });
}
// Datas em branco valem como "sempre".
function comunicadoVigente(c,hoje){
  if(!c||c.ativo===false)return false;
  if(c.inicio&&hoje<c.inicio)return false;
  if(c.fim&&hoje>c.fim)return false;
  return true;
}

// ══ FERIADOS ══
// Nacionais pela Lei 662/1949, com as alterações da Lei 10.607/2002 e da Lei
// 14.759/2023 (Consciência Negra). Estadual de São Paulo e municipal da capital.
// Carnaval, quarta-feira de cinzas e Corpus Christi são ponto facultativo na lei,
// mas o escritório não trabalha nesses dias — por isso entram como feriado.
function somaDiasISO(iso,n){
  const d=new Date(iso+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
// Algoritmo de Meeus/Butcher para o domingo de Páscoa no calendário gregoriano.
function domingoDePascoa(ano){
  const a=ano%19, b=Math.floor(ano/100), c=ano%100;
  const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m+114)/31), dia=((h+l-7*m+114)%31)+1;
  return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}
const FERIADOS_FIXOS=[
  ['01-01','Confraternização Universal','nacional'],
  ['01-25','Aniversário de São Paulo','municipal'],
  ['04-21','Tiradentes','nacional'],
  ['05-01','Dia do Trabalho','nacional'],
  ['07-09','Revolução Constitucionalista','estadual'],
  ['09-07','Independência do Brasil','nacional'],
  ['10-12','Nossa Senhora Aparecida','nacional'],
  ['11-02','Finados','nacional'],
  ['11-15','Proclamação da República','nacional'],
  ['11-20','Consciência Negra','nacional'],
  ['12-25','Natal','nacional']
];
const FERIADOS_CFG_PADRAO={ativo:true,facultativos:true,estaduais:true,municipais:true,extras:[],removidos:[]};
function feriadosDoAno(ano,cfg){
  cfg=Object.assign({},FERIADOS_CFG_PADRAO,cfg||{});
  const usar=(tipo)=>tipo==='nacional'
    ||(tipo==='estadual'&&cfg.estaduais!==false)
    ||(tipo==='municipal'&&cfg.municipais!==false)
    ||(tipo==='facultativo'&&cfg.facultativos!==false);
  const lista=[];
  for(const[md,nome,tipo]of FERIADOS_FIXOS)
    if(usar(tipo))lista.push({data:`${ano}-${md}`,nome,tipo,origem:'calendario'});
  const p=domingoDePascoa(ano);
  const moveis=[
    [somaDiasISO(p,-48),'Carnaval','facultativo'],
    [somaDiasISO(p,-47),'Carnaval','facultativo'],
    [somaDiasISO(p,-46),'Quarta-feira de Cinzas','facultativo'],
    [somaDiasISO(p,-2),'Sexta-feira Santa','nacional'],
    [somaDiasISO(p,60),'Corpus Christi','facultativo']
  ];
  for(const[data,nome,tipo]of moveis)
    if(usar(tipo))lista.push({data,nome,tipo,origem:'calendario'});
  for(const e of(cfg.extras||[])){
    if(e&&e.data&&String(e.data).slice(0,4)===String(ano))
      lista.push({data:e.data,nome:e.nome||'Feriado do escritório',tipo:'escritorio',origem:'manual'});
  }
  const fora=new Set(cfg.removidos||[]);
  return lista.filter(f=>!fora.has(f.data)).sort((a,b)=>a.data.localeCompare(b.data));
}
async function getFeriadosCfg(env){
  const r=await env.ATTENDANCE.get('holidays_config');
  return Object.assign({},FERIADOS_CFG_PADRAO,r?JSON.parse(r):{});
}
async function feriadoEm(env,data){
  const cfg=await getFeriadosCfg(env);
  if(cfg.ativo===false)return null;
  return feriadosDoAno(Number(String(data).slice(0,4)),cfg).find(f=>f.data===data)||null;
}

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
  // Em feriado ninguém entra como home office: o dia inteiro vira "Feriado".
  const feriado=await feriadoEm(env,dateStr);
  let filled=0;
  for(const[team,members]of Object.entries(employees)){
    if(!existing[team])existing[team]={};
    for(const person of members){
      if(!existing[team][person]){
        const vac=vacations.find(v=>v.team===team&&v.person===person&&v.start<=dateStr&&v.end>=dateStr);
        if(vac)continue;
        existing[team][person]=feriado?'Feriado':'Home Office';
        filled++;
      }
    }
  }
  if(filled>0)await env.ATTENDANCE.put(key,JSON.stringify(existing));
  return{ok:true,date:dateStr,filled,feriado:feriado?feriado.nome:null};
}

// ══════════ COMUNICADOS AO COLABORADOR ══════════
// Dois modelos: boas-vindas, que sai uma vez na vida de cada pessoa, e o
// informativo do Control iD, que pode ser reenviado quando fizer sentido.
// Quem já recebeu fica registrado — é o que impede a repetição.
const COM_TIPOS={
  boasvindas:{rotulo:'Boas-vindas',unico:true,
    assunto:'Bem-vindo(a) ao FKG Advogados'},
  controlid:{rotulo:'Control iD — registro diário',unico:false,
    assunto:'Como registrar sua presença no FKG Advogados'}
};
async function comEnviados(env){const r=await env.ATTENDANCE.get('com_enviados');return r?JSON.parse(r):{}}

// Quem recebe o quê. O e-mail corporativo da ficha do RH Geral manda; para o
// estagiário, o pessoal entra como reserva enquanto o corporativo não existe.
async function comPessoas(env){
  const emp=await getEmployees(env);
  const staff=await getHrStaff(env);
  const interns=await getHrInterns(env);
  const out=[];
  for(const[equipe,membros]of Object.entries(emp)){
    for(const person of membros){
      const s=staff[person]||{};
      const i=interns[person]||{};
      const email=String(s.email||'').trim()||String(i.personal_email||'').trim();
      out.push({person,equipe,
        cargo:s.role||(equipe==='Estagiários'?'Estagiário(a)':''),
        email:email.toLowerCase(),
        origem_email:s.email?'corporativo':(i.personal_email?'pessoal':''),
        admissao:s.admission_date||i.contract_start||''});
    }
  }
  return out.sort((a,b)=>a.person.localeCompare(b.person,'pt-BR'));
}

// ── os modelos ──
// Arial 11 em todo o corpo, tom formal e sem travessões: é a carta que o
// escritório assina, não um aviso de sistema.
const COM_FONTE="Arial, Helvetica, sans-serif";
function comMolde(tema,titulo,corpo,rodape){
  const t=tema||{barra:'#333333',escuro:'#191919'};
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${rEsc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#F1F1F1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1F1;padding:26px 12px;font-family:${COM_FONTE}">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;font-family:${COM_FONTE}">
  <tr><td style="background:${t.barra};padding:24px 26px" align="center">
    <img src="https://www.fkgadv.com.br/wp-content/themes/fkg/images/logo_fkg_branco.png"
      alt="FKG Advogados" width="150" style="display:block;width:150px;height:auto;border:0;margin:0 auto">
  </td></tr>
  ${corpo}
  <tr><td style="padding:22px 34px 28px">
    <div style="border-top:1px solid #E6E6E6;padding-top:14px;font-family:${COM_FONTE};font-size:8.5pt;color:#8A8A8A;line-height:1.6">
      ${rodape}
    </div></td></tr>
</table></td></tr></table></body></html>`;
}

function comBoasVindasHtml(p,tema,cfg){
  const t=tema||{barra:'#333333',escuro:'#191919'};
  const primeiro=String(p.person||'').trim().split(/\s+/)[0]||'';
  const gestor=(cfg&&cfg.gestor_nome)||'seu gestor direto';
  const F=COM_FONTE;
  const corpo=`
  <tr><td style="padding:32px 34px 0">
    <div style="font-family:${F};font-size:15pt;font-weight:bold;color:${t.escuro};line-height:1.35">Boas-vindas ao FKG Advogados</div>
    ${p.cargo?`<div style="font-family:${F};font-size:10pt;color:#8A8A8A;padding-top:6px">${rEsc(p.cargo)}</div>`:''}
  </td></tr>
  <tr><td style="padding:22px 34px 0;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
    <p style="margin:0 0 14px;font-family:${F};font-size:11pt">Prezado(a) ${rEsc(primeiro)},</p>
    <p style="margin:0 0 14px;font-family:${F};font-size:11pt">É com satisfação que recebemos você em nossa equipe. Reunimos neste comunicado as orientações essenciais para os seus primeiros dias de trabalho. Recomendamos a sua leitura atenta e a guarda desta mensagem para consultas futuras.</p>
  </td></tr>
  <tr><td style="padding:10px 34px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6E6E6">
      <tr><td style="padding:20px 22px;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
        <div style="font-family:${F};font-size:9pt;font-weight:bold;letter-spacing:.6pt;color:#8A8A8A;text-transform:uppercase;padding-bottom:12px">Orientações iniciais</div>
        <p style="margin:0 0 12px;font-family:${F};font-size:11pt"><strong>Registro de presença.</strong> Sua digital será cadastrada no leitor localizado na entrada do escritório. O registro deve ser realizado <strong>ao menos uma vez por dia</strong>, pois é por meio dele que a sua presença é lançada no sistema.</p>
        <p style="margin:0 0 12px;font-family:${F};font-size:11pt"><strong>Férias e licenças.</strong> Todo afastamento deve ser previamente acordado com ${rEsc(gestor)} e formalizado junto ao Departamento Pessoal.</p>
        <p style="margin:0 0 12px;font-family:${F};font-size:11pt"><strong>Dados cadastrais.</strong> Mantenha atualizados junto ao Departamento Pessoal os seus dados de endereço, telefone e conta bancária.</p>
        <p style="margin:0;font-family:${F};font-size:11pt"><strong>Dúvidas.</strong> Permanecemos à disposição por meio de ${rEsc(gestor)} para esclarecer qualquer questão relativa à sua rotina de trabalho.</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 34px 0;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
    <p style="margin:0 0 16px;font-family:${F};font-size:11pt">Desejamos a você uma excelente trajetória conosco.</p>
    <p style="margin:0;font-family:${F};font-size:11pt">Atenciosamente,</p>
    <p style="margin:4px 0 0;font-family:${F};font-size:11pt"><strong>FKG Advogados</strong></p>
  </td></tr>`;
  return comMolde(tema,'Boas-vindas ao FKG Advogados',corpo,
    'Comunicado emitido automaticamente pelo VPoint, sistema de gestão do FKG Advogados.<br>Em caso de dúvida, procure o Departamento Pessoal ou o seu gestor direto.');
}

function comControlIdHtml(p,tema,cfg){
  const t=tema||{barra:'#333333',escuro:'#191919'};
  const primeiro=String(p.person||'').trim().split(/\s+/)[0]||'';
  const gestor=(cfg&&cfg.gestor_nome)||'seu gestor direto';
  const F=COM_FONTE;
  const corpo=`
  <tr><td style="padding:32px 34px 0">
    <div style="font-family:${F};font-size:15pt;font-weight:bold;color:${t.escuro};line-height:1.35">Registro diário de presença</div>
    <div style="font-family:${F};font-size:10pt;color:#8A8A8A;padding-top:6px">Orientações sobre o uso do leitor biométrico</div>
  </td></tr>
  <tr><td style="padding:22px 34px 0;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
    <p style="margin:0 0 14px;font-family:${F};font-size:11pt">Prezado(a) ${rEsc(primeiro)},</p>
    <p style="margin:0 0 14px;font-family:${F};font-size:11pt">O leitor biométrico instalado na entrada do escritório é o equipamento responsável por alimentar o controle de presença. Ao encostar o dedo no sensor, o registro é transmitido imediatamente ao sistema e passa a constar no quadro do dia.</p>
  </td></tr>
  <tr><td style="padding:10px 34px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid ${t.barra};background:#FAFAFA">
      <tr><td style="padding:16px 20px;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
        <strong>Solicitamos que o registro seja efetuado ao menos uma vez por dia, no momento da chegada.</strong> Na ausência do registro, o dia permanece sem presença lançada, e a regularização posterior depende de lançamento manual pelo Departamento Pessoal.
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 34px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6E6E6">
      <tr><td style="padding:20px 22px;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
        <div style="font-family:${F};font-size:9pt;font-weight:bold;letter-spacing:.6pt;color:#8A8A8A;text-transform:uppercase;padding-bottom:12px">Caso o leitor não reconheça a digital</div>
        <p style="margin:0 0 10px;font-family:${F};font-size:11pt">1. Limpe o dedo e a superfície do sensor. Umidade e resíduos de creme prejudicam a leitura.</p>
        <p style="margin:0 0 10px;font-family:${F};font-size:11pt">2. Utilize outro dedo cadastrado, caso possua mais de um registro.</p>
        <p style="margin:0 0 10px;font-family:${F};font-size:11pt">3. Não insista em tentativas sucessivas nem solicite que outra pessoa efetue o registro em seu nome.</p>
        <p style="margin:0;font-family:${F};font-size:11pt">4. <strong>Comunique ${rEsc(gestor)} no mesmo dia.</strong> Pode ser necessário refazer o cadastro da digital, e a comunicação tempestiva reduz a necessidade de ajustes manuais.</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 34px 0;font-family:${F};font-size:11pt;color:#2E2E2E;line-height:1.7">
    <p style="margin:0 0 16px;font-family:${F};font-size:11pt">Agradecemos a colaboração de todos na manutenção do controle de frequência.</p>
    <p style="margin:0;font-family:${F};font-size:11pt">Atenciosamente,</p>
    <p style="margin:4px 0 0;font-family:${F};font-size:11pt"><strong>FKG Advogados</strong></p>
  </td></tr>`;
  return comMolde(tema,'Registro diário de presença',corpo,
    'Comunicado emitido automaticamente pelo VPoint, sistema de gestão do FKG Advogados.<br>Em caso de falha no leitor biométrico, comunique o seu gestor direto no mesmo dia.');
}

function comHtml(tipo,p,tema,cfg){
  return tipo==='boasvindas'?comBoasVindasHtml(p,tema,cfg):comControlIdHtml(p,tema,cfg);
}

// ══ LOGS DE USO ══
// Um registro por dia em uselog:AAAA-MM-DD, para a consulta por período ser barata
// e o histórico antigo poder ser apagado sem mexer no resto.
const LOG_MAX_DIA=2000;
function logDiaBR(){return new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10)}
async function registrarLog(env,entrada){
  try{
    const dia=logDiaBR();
    const key='uselog:'+dia;
    const raw=await env.ATTENDANCE.get(key);
    const lista=raw?JSON.parse(raw):[];
    lista.unshift({t:new Date().toISOString(),...entrada});
    await env.ATTENDANCE.put(key,JSON.stringify(lista.slice(0,LOG_MAX_DIA)));
  }catch(e){/* log nunca pode derrubar a requisição */}
}
const LOG_ACAO={POST:'criacao',PUT:'alteracao',PATCH:'alteracao',DELETE:'exclusao'};
const LOG_MODULOS=[
  {p:['employees','inactive'],m:'Colaboradores',o:'Desligados'},
  {p:['employees','log'],m:'Colaboradores',o:'Histórico de movimentação'},
  {p:['employees','terminate'],m:'Colaboradores',o:'Desligamento'},
  {p:['employees','reactivate'],m:'Colaboradores',o:'Reativação'},
  {p:['employees'],m:'Colaboradores',o:'Cadastro'},
  {p:['attendance'],m:'Presença',o:'Lançamento'},
  {p:['vacations'],m:'Férias e Licenças',o:'Registro'},
  {p:['users'],m:'Usuários',o:'Conta'},
  {p:['statuses'],m:'Configurações',o:'Status personalizados'},
  {p:['hr','intern-salary-table'],m:'RH Estagiários',o:'Tabela de bolsas'},
  {p:['hr','library','folders'],m:'RH Estagiários',o:'Pasta da biblioteca'},
  {p:['hr','library'],m:'RH Estagiários',o:'Biblioteca'},
  {p:['hr','interns'],m:'RH Estagiários',o:'Ficha'},
  {p:['hr','staff'],m:'RH Geral',o:'Ficha do colaborador'},
  {p:['hr','payroll-ext'],m:'RH Geral',o:'Fora da folha'},
  {p:['med','holders'],m:'Assistência Médica',o:'Beneficiário'},
  {p:['med','config'],m:'Assistência Médica',o:'Percentuais'},
  {p:['med','plan-types'],m:'Assistência Médica',o:'Planos'},
  {p:['med','price-table'],m:'Assistência Médica',o:'Tabela de valores'},
  {p:['photos'],m:'Escritório',o:'Foto de perfil'},
  {p:['profiles'],m:'Escritório',o:'Perfil profissional'},
  {p:['prov'],m:'Prestadores',o:'Prestador de serviço'},
  {p:['mail'],m:'Configurações',o:'Avisos por e-mail'},
  {p:['lixeira'],m:'Configurações',o:'Lixeira'},
  {p:['report'],m:'Configurações',o:'Relatório gerencial'},
  {p:['controlid'],m:'Control iD',o:'Configuração'},
  {p:['theme'],m:'Personalização',o:'Cores do sistema'},
  {p:['holidays'],m:'Configurações',o:'Calendário de feriados'},
  {p:['notices'],m:'Escritório',o:'Comunicado da TV'},
  {p:['storage'],m:'Configurações',o:'Armazenamento'},
  {p:['cont','folders'],m:'Contabilidade',o:'Pasta'},
  {p:['cont','years'],m:'Contabilidade',o:'Ano'},
  {p:['cont','docs'],m:'Contabilidade',o:'Documento'},
  {p:['logs'],m:'Logs',o:'Histórico de um dia'}
];
// Variáveis de cor que o superadmin pode alterar pela tela de Personalização.
// A lista é fechada: o que não estiver aqui é descartado na gravação.
const TEMA_VARIAVEIS=[
  '--sidebar','--dark','--gray','--gray-mid','--gray-light','--gold','--gold-light',
  '--bg','--surface','--text','--muted','--border','--border-dark',
  '--k90','--k80','--k70','--k60','--k50','--k40','--k30','--k20','--k10',
  '--presente','--homeoffice','--ferias','--dayoff','--folga','--falta',
  '--feriado','--licenca','--atestado'
];
// segmentos que são o nome da ação, não o registro afetado
const LOG_SEM_ALVO=new Set(['docs','dependents','backfill','terminate','reactivate','folders','download','log']);
function logDecode(v){try{return decodeURIComponent(v||'')}catch(e){return String(v||'')}}
function logDescrever(parts){
  for(const d of LOG_MODULOS){
    if(!d.p.every((seg,i)=>parts[i]===seg))continue;
    let objeto=d.o;
    // detalha o que veio depois do nome da pessoa
    if(parts.includes('docs'))objeto='Documentos';
    else if(parts.includes('dependents'))objeto='Dependente';
    else if(parts.includes('backfill'))objeto='Carga de histórico';
    const bruto=logDecode(parts[d.p.length]);
    return {modulo:d.m,objeto,alvo:LOG_SEM_ALVO.has(bruto)?'':bruto.slice(0,120)};
  }
  return {modulo:parts[0]||'—',objeto:parts.slice(1).join('/').slice(0,60),alvo:''};
}
async function logRequisicao(env,request,url,method,status){
  const parts=url.pathname.slice(5).split('/').filter(Boolean);
  if(!LOG_ACAO[method])return;                       // só o que altera dados
  if(parts[0]==='auth'||parts[0]==='cron')return;    // login e cron têm registro próprio
  const tok=(request.headers.get('Authorization')||'').replace('Bearer ','').trim();
  const s=tok?await getSession(env,tok):null;
  const d=logDescrever(parts);
  await registrarLog(env,{
    usuario:s?(s.name||s.username||'—'):'sessão expirada',
    login:s?(s.username||''):'',
    papel:s?(s.role||'user'):'',
    acao:LOG_ACAO[method],
    modulo:d.modulo,objeto:d.objeto,alvo:d.alvo,
    ok:status<400,status
  });
}

export default{async fetch(request,env,ctx){
  const url=new URL(request.url);const method=request.method;
  if(method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  let res;
  try{res=await handleAPI(url,method,request,env,ctx)}catch(err){res=jsonRes({error:err.message},500)}
  // o registro roda depois da resposta e nunca a atrasa
  const gravar=logRequisicao(env,request,url,method,res.status).catch(()=>{});
  if(ctx&&ctx.waitUntil)ctx.waitUntil(gravar); else await gravar;
  return res;
}};
async function handleAPI(url,method,request,env,ctx){
  const path=url.pathname.slice(5);const parts=path.split('/').filter(Boolean);

  // ── AUTH ──
  if(parts[0]==='auth'&&method==='POST'){
    const{username,password}=await request.json();
    if(username===SUPERADMIN_USER&&password===SUPERADMIN_PASS){
      const tok=await createSession(env,'superadmin','Superadmin',SUPERADMIN_USER,true,true,true,true,true,true);
      await registrarLog(env,{usuario:'Superadmin',login:SUPERADMIN_USER,papel:'superadmin',
        acao:'entrada',modulo:'Acesso',objeto:'Login',alvo:'',ok:true,status:200});
      return jsonRes({token:tok,role:'superadmin',name:'Superadmin',hr_access:true,med_access:true,office_access:true,cont_access:true,cont_manage:true,prov_access:true});
    }
    const users=await getUsers(env);
    const user=users.find(u=>u.username===username&&u.password===password);
    if(user){
      const tok=await createSession(env,user.role||'user',user.name,user.username,user.hr_access,user.med_access,user.office_access,user.cont_access,user.cont_manage,user.prov_access,user.externo);
      await registrarLog(env,{usuario:user.name,login:user.username,papel:user.role||'user',
        acao:'entrada',modulo:'Acesso',objeto:'Login',alvo:'',ok:true,status:200});
      return jsonRes({token:tok,role:user.role||'user',name:user.name,hr_access:!!user.hr_access,med_access:!!user.med_access,office_access:!!user.office_access,cont_access:!!user.cont_access,cont_manage:!!user.cont_manage,prov_access:!!user.prov_access,externo:!!user.externo});
    }
    await registrarLog(env,{usuario:String(username||'').slice(0,60)||'—',login:String(username||'').slice(0,60),papel:'',
      acao:'entrada-negada',modulo:'Acesso',objeto:'Login',alvo:'',ok:false,status:401});
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
      let role=null,name=null,hrAccess=false,medAccess=false,officeAccess=false,contAccess=false,contManage=false,provAccess=false;
      if(env.SUPERADMIN_MICROSOFT_EMAIL&&email===env.SUPERADMIN_MICROSOFT_EMAIL.toLowerCase()){
        role='superadmin';name='Superadmin';hrAccess=true;provAccess=true;
      }else{
        const users=await getUsers(env);
        const match=users.find(u=>u.microsoft_email&&u.microsoft_email.toLowerCase()===email);
        if(match){role=match.role||'user';name=match.name;hrAccess=!!match.hr_access;medAccess=!!match.med_access;officeAccess=!!match.office_access;contAccess=!!match.cont_access;contManage=!!match.cont_manage;provAccess=!!match.prov_access;}
      }
      if(!role)return fail('Sua conta Microsoft ('+email+') não está associada a nenhum usuário do VPoint. Peça ao administrador para vincular seu e-mail em Configurações → Usuários.');
      const tok=await createSession(env,role,name,email,hrAccess,medAccess,officeAccess,contAccess,contManage,provAccess);
      return new Response(null,{status:302,headers:{Location:url.origin+'/?msauth=1&token='+encodeURIComponent(tok)+'&role='+encodeURIComponent(role)+'&name='+encodeURIComponent(name)+'&hr_access='+(hrAccess?'1':'0')+'&med_access='+(medAccess?'1':'0')+'&office_access='+(officeAccess?'1':'0')+'&cont_access='+(contAccess?'1':'0')+'&cont_manage='+(contManage?'1':'0')+'&prov_access='+(provAccess?'1':'0')}});
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
    const desvios=[];
    for(const change of changes){
      if(change.object!=='access_logs'||change.type!=='inserted')continue;
      const v=change.values||{};
      const eventCode=String(v.event??'');
      const controlidUserId=String(v.user_id??'');
      // O relógio do equipamento erra: perde a hora ao reiniciar, volta para
      // 2000, fica em outro fuso. O servidor sabe a hora certa, então o
      // horário do aparelho só vale quando bate com o nosso.
      const tsAparelho=parseInt(v.time||0)||0;
      const tsServidor=Math.floor(Date.now()/1000);
      const desvio=tsAparelho?tsAparelho-tsServidor:0;
      const confiar=cfg.usar_hora_servidor===false&&tsAparelho&&Math.abs(desvio)<=CID_TOLERANCIA;
      const ts=confiar?tsAparelho:tsServidor;
      if(tsAparelho)desvios.push(desvio);
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
        // aviso de chegada: roda depois da resposta, para não segurar o
        // equipamento, que desiste em poucos segundos
        const hora=new Date((ts||0)*1000).toLocaleTimeString('pt-BR',
          {hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
        const envio=avisarChegada(env,map.person,map.team,hora,url.origin).catch(()=>{});
        if(ctx&&ctx.waitUntil)ctx.waitUntil(envio);
      }
      log.unshift({time:ts,event:eventCode,controlid_user_id:controlidUserId,matched,
        person:map?map.person:null,team:map?map.team:null,marked,
        desvio:tsAparelho?desvio:null,hora_usada:confiar?'equipamento':'servidor'});
    }
    await env.ATTENDANCE.put('controlid_log',JSON.stringify(log.slice(0,50)));
    if(desvios.length){
      cfg.ultimo_desvio=desvios[desvios.length-1];
      cfg.ultimo_desvio_em=new Date().toISOString();
      await env.ATTENDANCE.put('controlid_config',JSON.stringify(cfg));
    }
    return jsonRes({ok:true});
  }

  // ── TAREFAS AUTOMÁTICAS (cron-job.org) ──
  // Autenticadas pelo CRON_TOKEN, antes da checagem de sessão: como não dependem de
  // login, continuam funcionando mesmo quando nenhuma sessão de usuário está ativa.
  if(parts[0]==='cron'){
    const esperado=String((env&&env.CRON_TOKEN)||'').trim();
    if(!esperado)return jsonRes({error:'Tarefas automáticas não configuradas: cadastre a variável CRON_TOKEN no Cloudflare Pages.'},503);
    const cronAuth=(request.headers.get('Authorization')||'').replace('Bearer ','').trim();
    // Comparação de tempo constante: evita que a resposta entregue o token aos poucos.
    if(!comparaSegredo(cronAuth,esperado))return jsonRes({error:'Não autorizado'},401);
    if(parts[1]==='auto-fill-home-office'&&method==='POST'){
      const r=await autoFillHomeOffice(env);
      // Aproveita a visita diária para limpar os arquivos cujo prazo na
      // lixeira venceu. O registro some sozinho pelo TTL do KV, mas o arquivo
      // no R2 não — sem isto, ficaria lá para sempre.
      r.lixeira=await lixoLimpar(env);
      // tenta o relatório: só sai se hoje fechar período na recorrência escolhida
      try{
        const cfgR=await getReportConfig(env);
        if(cfgR.ativo&&cfgR.destinatarios.length){
          const dec=reportDeveEnviar(cfgR,logDiaBR(),reportHoraBR());
          if(dec.enviar){
            const per=dec.periodo;
            const dados=await montarRelatorio(env,per.ini,per.fim,'Envio automático');
            const env2=await reportEnviar(env,dados,cfgR.destinatarios,url.origin);
            if(env2.ok){
              cfgR.ultimo_envio=dec.chave;
              await env.ATTENDANCE.put('report_config',JSON.stringify(cfgR));
            }
            r.relatorio={enviado:env2.ok,periodo:per,erro:env2.erro||''};
          }else r.relatorio={enviado:false,motivo:dec.motivo};
        }
      }catch(e){r.relatorio={enviado:false,erro:e.message}}
      return jsonRes(r);
    }
    if(parts[1]==='limpar-lixeira'&&method==='POST')return jsonRes(await lixoLimpar(env));
    // Relatório na recorrência escolhida. O cron passa aqui todo dia; quem
    // decide se hoje é dia de fechar período é reportPeriodoDeHoje.
    if(parts[1]==='relatorio'&&method==='POST'){
      const cfg=await getReportConfig(env);
      if(!cfg.ativo)return jsonRes({ok:true,enviado:false,motivo:'envio automático desligado'});
      if(!cfg.destinatarios.length)return jsonRes({ok:true,enviado:false,motivo:'sem destinatários'});
      const dec=reportDeveEnviar(cfg,logDiaBR(),reportHoraBR());
      if(!dec.enviar)return jsonRes({ok:true,enviado:false,motivo:dec.motivo});
      const per=dec.periodo;
      const dados=await montarRelatorio(env,per.ini,per.fim,'Envio automático');
      const r=await reportEnviar(env,dados,cfg.destinatarios,url.origin);
      if(r.ok){
        cfg.ultimo_envio=dec.chave;
        await env.ATTENDANCE.put('report_config',JSON.stringify(cfg));
      }
      return jsonRes({ok:r.ok,enviado:r.ok,periodo:per,erro:r.erro||''});
    }
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ── PERSONALIZAÇÃO (cores do sistema) ──
  // A leitura é pública de propósito: a tela de login precisa das cores
  // antes de existir sessão. A gravação continua restrita ao superadmin.
  if(parts[0]==='theme'&&method==='GET'){
    const r=await env.ATTENDANCE.get('ui_theme');
    return jsonRes(r?JSON.parse(r):{vars:{}});
  }

  // ── TOKEN CHECK ──
  const token=(request.headers.get('Authorization')||'').replace('Bearer ','');
  const session=token?await getSession(env,token):null;
  if(!session)return jsonRes({error:'Não autorizado'},401);
  const currentRole=session.role||'user';

  // ── PAPEL APRESENTAÇÃO (TV) ──
  // Existe só para a vitrine da televisão. Lista branca: só as leituras que a
  // apresentação precisa passam daqui. Tudo o mais é recusado antes de chegar
  // na rota, então nem um erro de programação na tela abre uma porta.
  const ehTV=currentRole==='tv';
  if(ehTV){
    const rota=parts.join('/');
    const liberado=method==='GET'&&(
      rota==='office'||rota==='profiles'||rota==='notices'||
      rota==='photos'||rota==='show-config'||rota==='theme'||
      (parts[0]==='photos'&&parts.length===2)||
      (parts[0]==='notices'&&parts.length===3&&parts[2]==='image')
    );
    if(!liberado)return jsonRes({error:'Este acesso é exclusivo do modo apresentação.'},403);
  }


  // ── ACESSO EXTERNO ──
  // Para prestadores de fora do escritório (uma contabilidade, por exemplo), a
  // regra se inverte: em vez de liberar tudo e restringir o que é sensível,
  // nada é liberado além dos módulos explicitamente marcados. Presença,
  // férias, colaboradores, relatórios e usuários ficam fora do alcance mesmo
  // que alguém descubra o endereço da rota.
  if(currentRole!=='superadmin'&&session.externo){
    const permitido=
      parts[0]==='me'||parts[0]==='theme'||
      (parts[0]==='cont'&&!!session.cont_access)||
      (parts[0]==='med'&&!!session.med_access);
    if(!permitido)
      return jsonRes({error:'Seu acesso é restrito aos módulos liberados pelo escritório.'},403);
  }

  const hasHrAccess=currentRole==='superadmin'||!!session.hr_access;
  // Quem tem RH também enxerga e edita a Assistência Médica.
  const hasMedAccess=currentRole==='superadmin'||!!session.med_access;
  const hasMedView=hasMedAccess||hasHrAccess;
  const hasProvAccess=currentRole==='superadmin'||!!session.prov_access;

  // ── QUEM SOU EU ──
  // A tela guarda as permissões no navegador para não perguntar a cada clique.
  // O problema é que elas só eram atualizadas no login: o superadmin liberava
  // um módulo e a pessoa precisava sair e entrar para enxergar. Esta rota é
  // consultada a cada carregamento da página e resolve isso.
  if(parts[0]==='me'&&method==='GET'){
    const ehSuper=currentRole==='superadmin';
    const u=ehSuper?null:(await getUsers(env)).find(x=>x.username===session.username);
    const v=c=>ehSuper?true:!!(u?u[c]:session[c]);
    return jsonRes({role:currentRole,name:session.name||'',username:session.username||'',
      hr_access:v('hr_access'),med_access:v('med_access'),
      office_access:v('office_access'),cont_access:v('cont_access'),cont_manage:v('cont_manage'),
      prov_access:v('prov_access'),externo:ehSuper?false:!!(u?u.externo:session.externo),versao:VPOINT_VERSAO});
  }

  // A TV lê o Escritório porque é de lá que vêm as pessoas, os perfis e os comunicados.
  const hasOfficeAccess=currentRole==='superadmin'||ehTV||!!session.office_access;
  // Contabilidade: ver é uma permissão; criar/apagar pasta é outra, delegável.
  const hasContAccess=currentRole==='superadmin'||!!session.cont_access;
  const hasContManage=currentRole==='superadmin'||!!session.cont_manage;

  // ── PERSONALIZAÇÃO: gravação (só superadmin) ──
  // Guardamos apenas variáveis conhecidas e só aceitamos cor em hexadecimal,
  // para que ninguém consiga injetar CSS pela API.
  if(parts[0]==='theme'&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin pode personalizar o sistema.'},403);
    const b=await request.json();
    const entrada=(b&&b.vars)||{};
    const limpos={};
    for(const nome of TEMA_VARIAVEIS){
      const v=String(entrada[nome]||'').trim();
      if(/^#[0-9a-fA-F]{6}$/.test(v))limpos[nome]=v.toUpperCase();
    }
    await env.ATTENDANCE.put('ui_theme',JSON.stringify({
      vars:limpos,updated_at:new Date().toISOString(),updated_by:session.name||session.username||''}));
    return jsonRes({ok:true,vars:limpos});
  }
  if(parts[0]==='theme'&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin pode personalizar o sistema.'},403);
    await env.ATTENDANCE.delete('ui_theme');
    return jsonRes({ok:true});
  }

  // ── CONTABILIDADE ──
  if(parts[0]==='cont'){
    if(!hasContAccess)return jsonRes({error:'Sem acesso ao módulo Contabilidade.'},403);
    const soGestor=()=>jsonRes({error:'Você não tem permissão para criar ou alterar pastas.'},403);

    if(parts[1]==='tree'&&method==='GET'){
      const tree=await getContTree(env);
      // quantos documentos em cada pasta, para a tela mostrar sem abrir uma a uma
      const cont={};
      const lista=await env.ATTENDANCE.list({prefix:'cont_docs:'});
      const nomes=lista.keys.map(k=>k.name);
      const brutos=await lerVarias(env,nomes);
      for(const n of nomes){
        const raw=brutos.get(n);
        const arr=raw?JSON.parse(raw):[];
        cont[n.slice(10)]=Array.isArray(arr)?arr.length:0;
      }
      return jsonRes({pastas:tree,docs:cont,pode_gerir:hasContManage,
        pode_estrutura:currentRole==='superadmin',pastas_mes:CONT_PASTAS_MES});
    }
    // Cria o ano inteiro com o esqueleto padrão
    if(parts[1]==='years'&&method==='POST'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const ano=Number(b.ano);
      if(!ano||ano<2000||ano>2100)return jsonRes({error:'Ano inválido.'},400);
      const tree=await getContTree(env);
      if(tree.some(p=>p.id==='a'+ano))return jsonRes({error:'O ano '+ano+' já existe.'},400);
      const novos=contEsqueletoDoAno(ano,session.name||session.username||'');
      await putContTree(env,tree.concat(novos));
      return jsonRes({ok:true,ano,pastas:novos.length});
    }
    if(parts[1]==='folders'&&!parts[2]&&method==='POST'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const nome=contNome(b.nome);
      if(!nome)return jsonRes({error:'Informe o nome da pasta.'},400);
      const tree=await getContTree(env);
      const pai=String(b.parent_id||'');
      if(pai&&!tree.some(p=>p.id===pai))return jsonRes({error:'Pasta de origem não encontrada.'},404);
      if(tree.some(p=>p.parent_id===pai&&p.nome.toLowerCase()===nome.toLowerCase()))
        return jsonRes({error:'Já existe uma pasta com esse nome aqui.'},400);
      const nova={id:novoId(),parent_id:pai,nome,tipo:'livre',ordem:900,
        criado_em:new Date().toISOString(),criado_por:session.name||session.username||''};
      tree.push(nova);
      await putContTree(env,tree);
      return jsonRes({ok:true,pasta:nova});
    }
    // !parts[3] é o que separa renomear de /move — sem isso, esta rota
    // engole o PUT de mover, que tem um segmento a mais.
    if(parts[1]==='folders'&&parts[2]&&!parts[3]&&method==='PUT'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const nome=contNome(b.nome);
      if(!nome)return jsonRes({error:'Informe o nome da pasta.'},400);
      const tree=await getContTree(env);
      const i=tree.findIndex(p=>p.id===parts[2]);
      if(i<0)return jsonRes({error:'Pasta não encontrada.'},404);
      // ano, mês e pastas padrão são a espinha da estrutura: só o superadmin mexe
      if(tree[i].tipo!=='livre'&&currentRole!=='superadmin')
        return jsonRes({error:'Apenas o superadmin altera as pastas da estrutura.'},403);
      if(tree.some(p=>p.parent_id===tree[i].parent_id&&p.id!==tree[i].id&&
        p.nome.toLowerCase()===nome.toLowerCase()))
        return jsonRes({error:'Já existe uma pasta com esse nome aqui.'},400);
      tree[i].nome=nome;
      await putContTree(env,tree);
      return jsonRes({ok:true});
    }
    // ── MOVER PASTA ──
    // Só troca o parent_id. Os documentos e os arquivos no R2 não se mexem:
    // eles pertencem à pasta pelo id, que não muda de lugar.
    if(parts[1]==='folders'&&parts[2]&&parts[3]==='move'&&method==='PUT'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const tree=await getContTree(env);
      const i=tree.findIndex(p=>p.id===parts[2]);
      if(i<0)return jsonRes({error:'Pasta não encontrada.'},404);
      const destino=String(b.parent_id||'');
      if(tree[i].tipo!=='livre'&&currentRole!=='superadmin')
        return jsonRes({error:'Apenas o superadmin move as pastas da estrutura.'},403);
      if(destino&&!tree.some(p=>p.id===destino))
        return jsonRes({error:'Pasta de destino não encontrada.'},404);
      if(destino===tree[i].id)
        return jsonRes({error:'Uma pasta não pode ser movida para dentro dela mesma.'},400);
      // impedir ciclo: o destino não pode estar dentro da própria pasta
      if(destino&&contDescendentes(tree,tree[i].id).some(p=>p.id===destino))
        return jsonRes({error:'Não dá para mover uma pasta para dentro de uma subpasta dela.'},400);
      if(tree[i].parent_id===destino)
        return jsonRes({error:'A pasta já está nesse lugar.'},400);
      if(tree.some(p=>p.parent_id===destino&&p.id!==tree[i].id&&
        p.nome.toLowerCase()===tree[i].nome.toLowerCase()))
        return jsonRes({error:'Já existe uma pasta com esse nome no destino.'},400);
      tree[i].parent_id=destino;
      tree[i].movido_em=new Date().toISOString();
      tree[i].movido_por=session.name||session.username||'';
      await putContTree(env,tree);
      return jsonRes({ok:true});
    }

    // ── MOVER DOCUMENTOS (em lote) ──
    if(parts[1]==='docs'&&parts[2]==='move'&&method==='POST'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const origem=String(b.origem||''), destino=String(b.destino||'');
      const ids=Array.isArray(b.ids)?b.ids.map(String):[];
      if(!ids.length)return jsonRes({error:'Escolha ao menos um documento.'},400);
      if(!origem||!destino)return jsonRes({error:'Informe a pasta de origem e a de destino.'},400);
      if(origem===destino)return jsonRes({error:'Os documentos já estão nessa pasta.'},400);
      const tree=await getContTree(env);
      if(!tree.some(p=>p.id===origem))return jsonRes({error:'Pasta de origem não encontrada.'},404);
      if(!tree.some(p=>p.id===destino))return jsonRes({error:'Pasta de destino não encontrada.'},404);
      const docsOrigem=await getContDocs(env,origem);
      const mover=docsOrigem.filter(d=>ids.includes(d.id));
      if(!mover.length)return jsonRes({error:'Nenhum dos documentos foi encontrado na pasta de origem.'},404);
      const docsDestino=await getContDocs(env,destino);
      // nome repetido no destino ganha sufixo, em vez de sobrescrever em silêncio
      const usados=new Set(docsDestino.map(d=>String(d.nome||'').toLowerCase()));
      const agora=new Date().toISOString();
      for(const d of mover){
        let nome=d.nome;
        if(usados.has(String(nome).toLowerCase())){
          const ponto=String(nome).lastIndexOf('.');
          const base=ponto>0?nome.slice(0,ponto):nome, ext=ponto>0?nome.slice(ponto):'';
          let n=2;
          while(usados.has((base+' ('+n+')'+ext).toLowerCase()))n++;
          nome=base+' ('+n+')'+ext;
        }
        usados.add(String(nome).toLowerCase());
        docsDestino.push(Object.assign({},d,{nome,pasta_id:destino,
          movido_em:agora,movido_por:session.name||session.username||''}));
      }
      const movidosIds=new Set(mover.map(d=>d.id));
      await env.ATTENDANCE.put('cont_docs:'+destino,JSON.stringify(docsDestino));
      await env.ATTENDANCE.put('cont_docs:'+origem,
        JSON.stringify(docsOrigem.filter(d=>!movidosIds.has(d.id))));
      return jsonRes({ok:true,movidos:mover.length});
    }

    // ── APAGAR DOCUMENTOS EM LOTE ──
    if(parts[1]==='docs'&&parts[2]==='delete'&&method==='POST'){
      if(!hasContManage)return soGestor();
      const b=await request.json();
      const pastaId=String(b.pasta||'');
      const ids=Array.isArray(b.ids)?b.ids.map(String):[];
      if(!pastaId)return jsonRes({error:'Informe a pasta.'},400);
      if(!ids.length)return jsonRes({error:'Escolha ao menos um documento.'},400);
      const docs=await getContDocs(env,pastaId);
      const apagar=docs.filter(d=>ids.includes(d.id));
      if(!apagar.length)return jsonRes({error:'Nenhum dos documentos foi encontrado nesta pasta.'},404);
      const fora=new Set(apagar.map(d=>d.id));
      for(const d of apagar)await lixoGuardar(env,{colecao:'cont_docs:'+pastaId,
        modulo:'Contabilidade',rotulo:'Documento · '+(d.nome||''),dados:d,quem:session.name||session.username||'',
        arquivos:['cont_file:'+d.id]});
      await env.ATTENDANCE.put('cont_docs:'+pastaId,JSON.stringify(docs.filter(d=>!fora.has(d.id))));
      return jsonRes({ok:true,apagados:apagar.length});
    }

    if(parts[1]==='folders'&&parts[2]&&method==='DELETE'){
      if(!hasContManage)return soGestor();
      const tree=await getContTree(env);
      const alvo=tree.find(p=>p.id===parts[2]);
      if(!alvo)return jsonRes({error:'Pasta não encontrada.'},404);
      if(alvo.tipo!=='livre'&&currentRole!=='superadmin')
        return jsonRes({error:'Apenas o superadmin apaga as pastas da estrutura.'},403);
      const dentro=contDescendentes(tree,alvo.id).concat([alvo]);
      // não apaga nada que ainda tenha documento — evita perda silenciosa
      let comArquivo=0;
      for(const p of dentro){
        const docs=await getContDocs(env,p.id);
        comArquivo+=docs.length;
      }
      if(comArquivo)return jsonRes({error:'Esta pasta (ou uma subpasta) ainda tem '+comArquivo+' documento(s). Apague os documentos antes.'},400);
      const fora=new Set(dentro.map(p=>p.id));
      await putContTree(env,tree.filter(p=>!fora.has(p.id)));
      for(const p of dentro)await env.ATTENDANCE.delete('cont_docs:'+p.id);
      return jsonRes({ok:true,apagadas:dentro.length});
    }

    // ── documentos dentro de uma pasta ──
    if(parts[1]==='docs'&&parts[2]&&!parts[3]&&method==='GET'){
      return jsonRes(await getContDocs(env,decodeURIComponent(parts[2])));
    }
    if(parts[1]==='docs'&&parts[2]&&!parts[3]&&method==='POST'){
      if(!hasContManage)return soGestor();
      const pastaId=decodeURIComponent(parts[2]);
      const tree=await getContTree(env);
      if(!tree.some(p=>p.id===pastaId))return jsonRes({error:'Pasta não encontrada.'},404);
      const form=await request.formData();
      const file=form.get('file');
      if(!file||typeof file.arrayBuffer!=='function')return jsonRes({error:'Envie um arquivo.'},400);
      const buf=await file.arrayBuffer();
      if(buf.byteLength>20*1024*1024)return jsonRes({error:'Arquivo maior que 20 MB.'},400);
      const id=novoId();
      const nome=contNome(form.get('nome')||file.name||'documento');
      const tipo=file.type||'application/octet-stream';
      await putHrFile(env,'cont_file:'+id,buf,tipo);
      const docs=await getContDocs(env,pastaId);
      docs.push({id,nome,tamanho:buf.byteLength,tipo,pasta_id:pastaId,
        criado_em:new Date().toISOString(),criado_por:session.name||session.username||''});
      await env.ATTENDANCE.put('cont_docs:'+pastaId,JSON.stringify(docs));
      return jsonRes({ok:true,id,tamanho:buf.byteLength});
    }
    if(parts[1]==='docs'&&parts[2]==='file'&&parts[3]&&method==='GET'){
      const id=decodeURIComponent(parts[3]);
      const buf=await getHrFile(env,'cont_file:'+id);
      if(!buf)return jsonRes({error:'Documento não encontrado.'},404);
      const nome=url.searchParams.get('nome')||'documento';
      return new Response(buf,{headers:{
        'Content-Type':url.searchParams.get('tipo')||'application/octet-stream',
        'Content-Disposition':'inline; filename="'+nome.replace(/"/g,'')+'"',
        'Cache-Control':'private, max-age=300',...CORS}});
    }
    if(parts[1]==='docs'&&parts[2]&&parts[3]&&method==='DELETE'){
      if(!hasContManage)return soGestor();
      const pastaId=decodeURIComponent(parts[2]), id=decodeURIComponent(parts[3]);
      const docs=await getContDocs(env,pastaId);
      const alvoDoc=docs.find(d=>d.id===id);
      if(alvoDoc)await lixoGuardar(env,{colecao:'cont_docs:'+pastaId,modulo:'Contabilidade',
        rotulo:'Documento · '+(alvoDoc.nome||''),dados:alvoDoc,quem:session.name||session.username||'',
        arquivos:['cont_file:'+id]});
      await env.ATTENDANCE.put('cont_docs:'+pastaId,JSON.stringify(docs.filter(d=>d.id!==id)));
      return jsonRes({ok:true});
    }
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ── ARMAZENAMENTO: situação do R2 e migração dos arquivos antigos ──
  const PREFIXOS_ARQUIVO=['photo:','hr_lib_file:','hr_intern_doc_file:','comunicado_img:','prov_file:'];
  if(parts[0]==='storage'&&!parts[1]&&method==='GET'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin consulta o armazenamento.'},403);
    const pendentes={};
    let total=0;
    for(const p of PREFIXOS_ARQUIVO){
      const l=await env.ATTENDANCE.list({prefix:p});
      pendentes[p]=l.keys.length;
      total+=l.keys.length;
    }
    return jsonRes({r2:temR2(env),bucket:temR2(env)?'ARQUIVOS':null,
      no_kv:pendentes,total_no_kv:total});
  }
  // Copia para o R2 o que ainda está no KV, em lotes, e libera o espaço.
  if(parts[0]==='storage'&&parts[1]==='migrar'&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin migra os arquivos.'},403);
    if(!temR2(env))return jsonRes({error:'O bucket R2 ainda não está vinculado a este projeto.'},400);
    const b=await request.json().catch(()=>({}));
    const limite=Math.min(Math.max(Number(b.limite)||15,1),40);
    let movidos=0,bytes=0,erros=[];
    let restam=0;
    for(const p of PREFIXOS_ARQUIVO){
      const l=await env.ATTENDANCE.list({prefix:p});
      restam+=l.keys.length;
      for(const k of l.keys){
        if(movidos>=limite)continue;
        try{
          const buf=await env.ATTENDANCE.get(k.name,{type:'arrayBuffer'});
          if(!buf){await env.ATTENDANCE.delete(k.name);continue}
          const tipo=k.name.startsWith('photo:')||k.name.startsWith('comunicado_img:')?'image/jpeg':undefined;
          await env.ARQUIVOS.put(k.name,buf,{httpMetadata:tipo?{contentType:tipo}:undefined});
          const conf=await env.ARQUIVOS.head(k.name);
          if(!conf||conf.size!==buf.byteLength){erros.push(k.name);continue}
          await env.ATTENDANCE.delete(k.name);
          movidos++;bytes+=buf.byteLength;restam--;
        }catch(e){erros.push(k.name+': '+e.message)}
      }
    }
    return jsonRes({ok:true,movidos,bytes,restam,erros:erros.slice(0,5),
      concluido:restam===0});
  }

  // ── COMUNICADOS DA TV ──
  // Telas avulsas que entram no modo apresentação. Só o superadmin cria;
  // quem tem o módulo Escritório apenas enxerga os que estão no ar.
  if(parts[0]==='notices'&&!parts[1]&&method==='GET'){
    if(!hasOfficeAccess)return jsonRes({error:'Sem acesso ao módulo Escritório.'},403);
    const lista=await getComunicados(env);
    const hoje=medHoje();
    const comVigencia=lista.map(c=>Object.assign({},c,{vigente:comunicadoVigente(c,hoje)}));
    return jsonRes({comunicados:currentRole==='superadmin'?comVigencia:comVigencia.filter(c=>c.vigente)});
  }
  if(parts[0]==='notices'&&!parts[1]&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin cria comunicados.'},403);
    const b=await request.json();
    const lista=await getComunicados(env);
    const novo=comunicadoLimpo(b,{id:novoId(),criado_em:new Date().toISOString(),
      criado_por:session.name||session.username||'',img:false,img_v:0});
    lista.push(novo);
    await env.ATTENDANCE.put('comunicados',JSON.stringify(lista));
    return jsonRes({ok:true,comunicado:novo});
  }
  if(parts[0]==='notices'&&parts[1]&&!parts[2]&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera comunicados.'},403);
    const b=await request.json();
    const lista=await getComunicados(env);
    const i=lista.findIndex(c=>c.id===parts[1]);
    if(i<0)return jsonRes({error:'Comunicado não encontrado.'},404);
    lista[i]=comunicadoLimpo(b,lista[i]);
    await env.ATTENDANCE.put('comunicados',JSON.stringify(lista));
    return jsonRes({ok:true,comunicado:lista[i]});
  }
  if(parts[0]==='notices'&&parts[1]&&!parts[2]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin apaga comunicados.'},403);
    const lista=await getComunicados(env);
    const restante=lista.filter(c=>c.id!==parts[1]);
    await env.ATTENDANCE.put('comunicados',JSON.stringify(restante));
    await delHrFile(env,'comunicado_img:'+parts[1]);
    return jsonRes({ok:true});
  }
  if(parts[0]==='notices'&&parts[1]&&parts[2]==='image'&&method==='GET'){
    if(!hasOfficeAccess)return jsonRes({error:'Sem acesso ao módulo Escritório.'},403);
    const buf=await getHrFile(env,'comunicado_img:'+parts[1]);
    if(!buf)return jsonRes({error:'Sem imagem.'},404);
    return new Response(buf,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300',...CORS}});
  }
  if(parts[0]==='notices'&&parts[1]&&parts[2]==='image'&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera comunicados.'},403);
    const lista=await getComunicados(env);
    const i=lista.findIndex(c=>c.id===parts[1]);
    if(i<0)return jsonRes({error:'Comunicado não encontrado.'},404);
    const form=await request.formData();
    const file=form.get('file');
    if(!file||typeof file.arrayBuffer!=='function')return jsonRes({error:'Envie um arquivo de imagem.'},400);
    const buf=await file.arrayBuffer();
    if(buf.byteLength>1400000)return jsonRes({error:'Imagem muito grande. Reduza antes de enviar.'},400);
    const gravado=await putHrFile(env,'comunicado_img:'+parts[1],buf,'image/jpeg');
    lista[i].img=true;lista[i].img_v=Date.now();
    await env.ATTENDANCE.put('comunicados',JSON.stringify(lista));
    return jsonRes({ok:true,size:gravado,img_v:lista[i].img_v});
  }
  if(parts[0]==='notices'&&parts[1]&&parts[2]==='image'&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera comunicados.'},403);
    const lista=await getComunicados(env);
    const i=lista.findIndex(c=>c.id===parts[1]);
    if(i>=0){lista[i].img=false;lista[i].img_v=0;await env.ATTENDANCE.put('comunicados',JSON.stringify(lista))}
    await delHrFile(env,'comunicado_img:'+parts[1]);
    return jsonRes({ok:true});
  }

  // ── FERIADOS ──
  if(parts[0]==='holidays'&&!parts[1]&&method==='GET'){
    const ano=Number(url.searchParams.get('ano'))||Number(logDiaBR().slice(0,4));
    const cfg=await getFeriadosCfg(env);
    return jsonRes({ano,config:cfg,feriados:cfg.ativo===false?[]:feriadosDoAno(ano,cfg)});
  }
  if(parts[0]==='holidays'&&parts[1]==='config'&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera o calendário de feriados.'},403);
    const b=await request.json();
    const cfg=await getFeriadosCfg(env);
    ['ativo','facultativos','estaduais','municipais'].forEach(k=>{
      if(typeof b[k]==='boolean')cfg[k]=b[k];
    });
    await env.ATTENDANCE.put('holidays_config',JSON.stringify(cfg));
    return jsonRes({ok:true,config:cfg});
  }
  // Dia de folga do próprio escritório (emenda, aniversário da banca, etc.)
  if(parts[0]==='holidays'&&parts[1]==='extra'&&!parts[2]&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera o calendário de feriados.'},403);
    const b=await request.json();
    const data=String(b.data||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return jsonRes({error:'Data inválida.'},400);
    const cfg=await getFeriadosCfg(env);
    cfg.extras=(cfg.extras||[]).filter(e=>e.data!==data);
    cfg.extras.push({data,nome:String(b.nome||'').trim().slice(0,80)||'Feriado do escritório'});
    cfg.removidos=(cfg.removidos||[]).filter(d=>d!==data);
    await env.ATTENDANCE.put('holidays_config',JSON.stringify(cfg));
    return jsonRes({ok:true});
  }
  // Tira um dia do calendário — serve tanto para o feriado do escritório
  // quanto para uma data oficial que a banca decidiu trabalhar.
  if(parts[0]==='holidays'&&parts[1]==='extra'&&parts[2]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera o calendário de feriados.'},403);
    const data=decodeURIComponent(parts[2]);
    const cfg=await getFeriadosCfg(env);
    const era=(cfg.extras||[]).some(e=>e.data===data);
    cfg.extras=(cfg.extras||[]).filter(e=>e.data!==data);
    if(!era&&!(cfg.removidos||[]).includes(data))cfg.removidos=(cfg.removidos||[]).concat([data]);
    await env.ATTENDANCE.put('holidays_config',JSON.stringify(cfg));
    return jsonRes({ok:true});
  }
  // Devolve ao calendário uma data oficial que tinha sido retirada.
  if(parts[0]==='holidays'&&parts[1]==='restaurar'&&parts[2]&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin altera o calendário de feriados.'},403);
    const data=decodeURIComponent(parts[2]);
    const cfg=await getFeriadosCfg(env);
    cfg.removidos=(cfg.removidos||[]).filter(d=>d!==data);
    await env.ATTENDANCE.put('holidays_config',JSON.stringify(cfg));
    return jsonRes({ok:true});
  }
  // Marca todo mundo como "Feriado" naquele dia, sem apagar o que já foi lançado.
  if(parts[0]==='holidays'&&parts[1]==='aplicar'&&parts[2]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'É necessário ter acesso ao RH para aplicar o feriado.'},403);
    const data=decodeURIComponent(parts[2]);
    const feriado=await feriadoEm(env,data);
    if(!feriado)return jsonRes({error:'Esta data não é feriado no calendário.'},400);
    const employees=await getEmployees(env);
    const raw=await env.ATTENDANCE.get(`att:${data}`);
    const att=raw?JSON.parse(raw):{};
    let marcados=0;
    for(const[team,members]of Object.entries(employees)){
      if(!att[team])att[team]={};
      for(const person of members)if(!att[team][person]){att[team][person]='Feriado';marcados++}
    }
    await env.ATTENDANCE.put(`att:${data}`,JSON.stringify(att));
    await marcarPresencaMudou(env);
    return jsonRes({ok:true,data,feriado:feriado.nome,marcados});
  }

  // ── FOTOS DE PERFIL ──
  // A imagem fica em photo:<pessoa> e a lista de quem tem foto em photos_index,
  // para a tela montar a grade sem baixar todas as imagens.
  if(parts[0]==='photos'&&!parts[1]&&method==='GET'){
    const r=await env.ATTENDANCE.get('photos_index');
    return jsonRes(r?JSON.parse(r):{});
  }
  if(parts[0]==='photos'&&parts[1]&&!parts[2]&&method==='GET'){
    const person=decodeURIComponent(parts[1]);
    const buf=await getHrFile(env,'photo:'+person);
    if(!buf)return jsonRes({error:'Sem foto.'},404);
    const idx=await env.ATTENDANCE.get('photos_index');
    const meta=(idx?JSON.parse(idx):{})[person]||{};
    return new Response(buf,{headers:{...CORS,
      'Content-Type':meta.mime||'image/jpeg',
      'Cache-Control':'private, max-age=300',
      'ETag':'"'+(meta.updated_at||'0')+'"'}});
  }
  if(parts[0]==='photos'&&parts[1]&&!parts[2]&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'É necessário ter acesso ao RH para alterar fotos.'},403);
    const person=decodeURIComponent(parts[1]);
    const form=await request.formData();
    const file=form.get('file');
    if(!file||typeof file==='string')return jsonRes({error:'Selecione uma imagem.'},400);
    const buf=await file.arrayBuffer();
    if(buf.byteLength>900000)return jsonRes({error:'Imagem muito grande ('+Math.round(buf.byteLength/1024)+' KB). O limite é 900 KB.'},400);
    await putHrFile(env,'photo:'+person,buf,'image/jpeg');
    const check=await getHrFile(env,'photo:'+person);
    if(!check||check.byteLength!==buf.byteLength){
      await delHrFile(env,'photo:'+person);
      return jsonRes({error:'Falha ao gravar a imagem. Tente novamente.'},500);
    }
    const r=await env.ATTENDANCE.get('photos_index');
    const idx=r?JSON.parse(r):{};
    idx[person]={mime:file.type||'image/jpeg',size:buf.byteLength,updated_at:Date.now()};
    await env.ATTENDANCE.put('photos_index',JSON.stringify(idx));
    return jsonRes({ok:true,size:buf.byteLength});
  }
  if(parts[0]==='photos'&&parts[1]&&!parts[2]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'É necessário ter acesso ao RH para alterar fotos.'},403);
    const person=decodeURIComponent(parts[1]);
    await delHrFile(env,'photo:'+person);
    const r=await env.ATTENDANCE.get('photos_index');
    const idx=r?JSON.parse(r):{};
    delete idx[person];
    await env.ATTENDANCE.put('photos_index',JSON.stringify(idx));
    return jsonRes({ok:true});
  }

  // ── PERFIS PROFISSIONAIS (texto de apresentação de cada pessoa) ──
  if(parts[0]==='profiles'&&!parts[1]&&method==='GET'){
    if(!hasOfficeAccess)return jsonRes({error:'Sem acesso ao módulo Escritório.'},403);
    const r=await env.ATTENDANCE.get('office_profiles');
    return jsonRes(r?JSON.parse(r):{});
  }
  if(parts[0]==='profiles'&&parts[1]&&!parts[2]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'É necessário ter acesso ao RH para editar perfis.'},403);
    const person=decodeURIComponent(parts[1]);
    const b=await request.json();
    const r=await env.ATTENDANCE.get('office_profiles');
    const todos=r?JSON.parse(r):{};
    const lista=(v)=>Array.isArray(v)?v.map(x=>String(x||'').trim().slice(0,2000)).filter(Boolean).slice(0,12):[];
    todos[person]={
      email:String(b.email||'').trim().slice(0,120),
      experiencia:lista(b.experiencia),
      reconhecimentos:lista(b.reconhecimentos),
      formacao:lista(b.formacao),
      idiomas:lista(b.idiomas),
      publicacoes:lista(b.publicacoes)
    };
    await env.ATTENDANCE.put('office_profiles',JSON.stringify(todos));
    return jsonRes({ok:true});
  }
  if(parts[0]==='profiles'&&parts[1]&&!parts[2]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'É necessário ter acesso ao RH para editar perfis.'},403);
    const person=decodeURIComponent(parts[1]);
    const r=await env.ATTENDANCE.get('office_profiles');
    const todos=r?JSON.parse(r):{};
    delete todos[person];
    await env.ATTENDANCE.put('office_profiles',JSON.stringify(todos));
    return jsonRes({ok:true});
  }

  // ── ESCRITÓRIO: equipe com foto, cargo e tempo de casa ──
  if(parts[0]==='office'&&method==='GET'){
    if(!hasOfficeAccess)return jsonRes({error:'Sem acesso ao módulo Escritório.'},403);
    const emp=await getEmployees(env);
    const staff=await getHrStaff(env);
    const estagiarios=await getHrInterns(env);
    const r=await env.ATTENDANCE.get('photos_index');
    const fotos=r?JSON.parse(r):{};
    const rp=await env.ATTENDANCE.get('office_profiles');
    const perfis=rp?JSON.parse(rp):{};
    const hoje=medHoje();
    const out=[];
    for(const[team,membros]of Object.entries(emp)){
      for(const person of membros){
        const rec=staff[person]||{};
        let anos=null;
        if(rec.admission_date&&/^\d{4}-\d{2}-\d{2}$/.test(rec.admission_date)){
          const[ay,am,ad]=rec.admission_date.split('-').map(Number);
          const[hy,hm,hd]=hoje.split('-').map(Number);
          anos=hy-ay; if(hm<am||(hm===am&&hd<ad))anos--;
          if(anos<0)anos=null;
        }
        // Só dia e mês do aniversário: é o que a apresentação precisa e evita
        // expor data de nascimento completa a quem só tem acesso ao Escritório.
        const nasc=rec.birth_date||(estagiarios[person]||{}).birth_date||'';
        const nascOk=/^\d{4}-\d{2}-\d{2}$/.test(nasc);
        out.push({person,team,
          initials:rec.initials||'',role:rec.role||'',grad_year:rec.grad_year||'',
          admission_date:rec.admission_date||'',anos_casa:anos,
          nasc_dia:nascOk?Number(nasc.slice(8,10)):null,
          nasc_mes:nascOk?Number(nasc.slice(5,7)):null,
          email:(perfis[person]||{}).email||'',
          perfil:!!perfis[person],
          foto:!!fotos[person],foto_v:fotos[person]?fotos[person].updated_at:0});
      }
    }
    out.sort((a,b)=>a.person.localeCompare(b.person,'pt-BR'));
    return jsonRes({equipes:Object.keys(emp),pessoas:out,hoje,can_edit:hasHrAccess,
      foto_lado:512,foto_max_kb:880});
  }

  // ── LOGS DE USO (apenas superadmin) ──
  if(parts[0]==='logs'&&method==='GET'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode consultar os logs.'},403);
    const hoje=logDiaBR();
    const de=(url.searchParams.get('de')||'').slice(0,10);
    const ate=(url.searchParams.get('ate')||'').slice(0,10)||hoje;
    // sem data inicial, traz os últimos 7 dias
    const padraoDe=new Date(Date.parse(ate+'T12:00:00Z')-6*86400000).toISOString().slice(0,10);
    const inicio=de||padraoDe;
    const lista=await env.ATTENDANCE.list({prefix:'uselog:'});
    const dias=lista.keys.map(k=>k.name.slice(7)).sort().reverse();
    const alvo=dias.filter(d=>d>=inicio&&d<=ate).slice(0,62);
    let itens=[];
    for(const d of alvo){
      const raw=await env.ATTENDANCE.get('uselog:'+d);
      if(raw)itens=itens.concat(JSON.parse(raw));
    }
    const fUser=(url.searchParams.get('usuario')||'').toLowerCase();
    const fAcao=url.searchParams.get('acao')||'';
    const fModulo=url.searchParams.get('modulo')||'';
    if(fUser)itens=itens.filter(i=>String(i.usuario||'').toLowerCase().includes(fUser)||String(i.login||'').toLowerCase().includes(fUser));
    if(fAcao)itens=itens.filter(i=>i.acao===fAcao);
    if(fModulo)itens=itens.filter(i=>i.modulo===fModulo);
    itens.sort((a,b)=>String(b.t).localeCompare(String(a.t)));
    const total=itens.length;
    const limite=Math.min(parseInt(url.searchParams.get('limite')||'400',10)||400,2000);
    return jsonRes({itens:itens.slice(0,limite),total,dias,de:inicio,ate,hoje,
      modulos:[...new Set(['Acesso'].concat(LOG_MODULOS.map(m=>m.m)))].sort()});
  }
  if(parts[0]==='logs'&&parts[1]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode apagar logs.'},403);
    const dia=parts[1].slice(0,10);
    await env.ATTENDANCE.delete('uselog:'+dia);
    return jsonRes({ok:true,dia});
  }

  // ── CONTROL ID CONFIG / MAPPING / LOG (autenticado) ──
  if(parts[0]==='controlid'&&parts[1]==='config'&&method==='GET')return jsonRes(await getControlIdConfig(env));
  if(parts[0]==='controlid'&&parts[1]==='config'&&method==='PUT'){
    const b=await request.json();
    const atual=await getControlIdConfig(env);
    // preserva o desvio medido, que é apurado pelo webhook e não vem da tela
    await env.ATTENDANCE.put('controlid_config',JSON.stringify(Object.assign({},atual,b,{
      ultimo_desvio:atual.ultimo_desvio,ultimo_desvio_em:atual.ultimo_desvio_em})));
    return jsonRes({ok:true});
  }
  if(parts[0]==='controlid'&&parts[1]==='mapping'&&method==='GET')return jsonRes(await getControlIdMapping(env));
  if(parts[0]==='controlid'&&parts[1]==='mapping'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('controlid_mapping',JSON.stringify(b));return jsonRes({ok:true})}
  if(parts[0]==='controlid'&&parts[1]==='log'&&method==='GET')return jsonRes(await getControlIdLog(env));

  // ── USERS (superadmin only by convention) ──
  // ── VITRINE DA TV: o que passa no modo apresentação ──
  // Quem monta é o superadmin; quem lê é o acesso de apresentação, em qualquer
  // televisão. Fica no servidor de propósito: trocar a TV não perde a seleção.
  if(parts[0]==='show-config'&&method==='GET'){
    const r=await env.ATTENDANCE.get('show_config');
    return jsonRes(r?JSON.parse(r):{itens:[],tempo:'8'});
  }
  if(parts[0]==='show-config'&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Somente o superadmin define o que passa na TV.'},403);
    const b=await request.json();
    const itens=Array.isArray(b&&b.itens)
      ?b.itens.filter(x=>typeof x==='string'&&x.length<200).slice(0,300):[];
    const t=String((b&&b.tempo)||'8');
    await env.ATTENDANCE.put('show_config',JSON.stringify({
      itens,tempo:/^\d{1,2}$/.test(t)?t:'8',
      updated_at:new Date().toISOString(),updated_by:session.name||session.username||''}));
    return jsonRes({ok:true});
  }

  if(parts[0]==='users'&&method==='GET'){
    // Saber quem são os usuários e o que cada um acessa é informação de
    // administração: não cabe a quem apenas usa o sistema.
    if(currentRole!=='superadmin')
      return jsonRes({error:'Apenas o superadmin pode ver os usuários do sistema.'},403);
    const users=await getUsers(env);
    return jsonRes(users.map(u=>({id:u.id,username:u.username,name:u.name,microsoft_email:u.microsoft_email||'',role:u.role||'user',hr_access:!!u.hr_access,med_access:!!u.med_access,office_access:!!u.office_access,cont_access:!!u.cont_access,cont_manage:!!u.cont_manage,prov_access:!!u.prov_access,externo:!!u.externo})));
  }
  if(parts[0]==='users'&&method==='POST'){
    const{username,password,name,microsoft_email,role,hr_access,med_access,office_access,cont_access,cont_manage,prov_access,externo}=await request.json();
    if(!username||!password||!name)return jsonRes({error:'Campos obrigatórios faltando'},400);
    if(username===SUPERADMIN_USER)return jsonRes({error:'Nome de usuário reservado'},400);
    if(role&&!PAPEIS.includes(role))return jsonRes({error:'Tipo de acesso inválido'},400);
    const users=await getUsers(env);
    if(users.find(u=>u.username===username))return jsonRes({error:'Usuário já existe'},400);
    const papel=PAPEIS.includes(role)?role:'user';
    // O acesso de apresentação não carrega permissão nenhuma: ele só vê a TV.
    const ehApres=papel==='tv';
    const newUser={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),username,password,name,microsoft_email:microsoft_email||'',role:papel,hr_access:!ehApres&&!!hr_access,med_access:!ehApres&&!!med_access,office_access:!ehApres&&!!office_access,cont_access:!ehApres&&!!cont_access,cont_manage:!ehApres&&!!cont_manage,prov_access:!ehApres&&!!prov_access,externo:!ehApres&&!!externo};
    users.push(newUser);
    await env.ATTENDANCE.put('app_users',JSON.stringify(users));
    return jsonRes({ok:true,id:newUser.id});
  }
  if(parts[0]==='users'&&parts[1]&&method==='PUT'){
    const{password,name,microsoft_email,role,hr_access,med_access,office_access,cont_access,cont_manage,prov_access,externo}=await request.json();
    if(role&&!PAPEIS.includes(role))return jsonRes({error:'Tipo de acesso inválido'},400);
    const users=await getUsers(env);
    const idx=users.findIndex(u=>u.id===parts[1]);
    if(idx===-1)return jsonRes({error:'Usuário não encontrado'},404);
    // Virou acesso de apresentação: perde toda permissão que porventura tivesse.
    if(role==='tv'){
      users[idx].role='tv';
      users[idx].hr_access=users[idx].med_access=false;
      users[idx].office_access=users[idx].cont_access=users[idx].cont_manage=false;
      users[idx].prov_access=false;
      if(password)users[idx].password=password;
      if(name)users[idx].name=name;
      await env.ATTENDANCE.put('app_users',JSON.stringify(users));
      return jsonRes({ok:true});
    }
    if(password)users[idx].password=password;
    if(name)users[idx].name=name;
    if(microsoft_email!==undefined)users[idx].microsoft_email=microsoft_email;
    if(role)users[idx].role=role;
    if(hr_access!==undefined)users[idx].hr_access=!!hr_access;
    if(med_access!==undefined)users[idx].med_access=!!med_access;
    if(office_access!==undefined)users[idx].office_access=!!office_access;
    if(cont_access!==undefined)users[idx].cont_access=!!cont_access;
    if(cont_manage!==undefined)users[idx].cont_manage=!!cont_manage;
    if(prov_access!==undefined)users[idx].prov_access=!!prov_access;
    if(externo!==undefined)users[idx].externo=!!externo;
    await env.ATTENDANCE.put('app_users',JSON.stringify(users));
    return jsonRes({ok:true});
  }
  if(parts[0]==='users'&&parts[1]&&method==='DELETE'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin pode excluir usuários definitivamente.'},403);
    let users=await getUsers(env);
    const alvoUser=users.find(u=>u.id===parts[1]);
    if(alvoUser)await lixoGuardar(env,{colecao:'app_users',modulo:'Configurações',
      rotulo:'Usuário · '+(alvoUser.name||alvoUser.username||''),dados:alvoUser,quem:session.name||session.username||''});
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
          // person é o nome de exibição (a chave); full_name é o nome de
          // registro, que vai em contrato, carteira e documentos oficiais.
          full_name:rec.full_name||'',
          email:rec.email||'',
          birth_date:rec.birth_date||'',
          phone:rec.phone||'',
          role:rec.role||'',
          admission_date:rec.admission_date||'',
          initials:rec.initials||'',
          grad_year:rec.grad_year||'',
          cpf:rec.cpf||'',rg:rec.rg||'',
          rg_orgao:rec.rg_orgao||'',rg_emissao:rec.rg_emissao||'',
          cep:rec.cep||'',street:rec.street||'',number:rec.number||'',
          complement:rec.complement||'',district:rec.district||'',
          city:rec.city||'',state:rec.state||''});
      }
    }
    return jsonRes(out);
  }
  // Gravação em lote só do e-mail. Existe porque o PUT da ficha reescreve o
  // registro inteiro: usá-lo para preencher um campo apagaria o resto.
  if(parts[0]==='hr'&&parts[1]==='staff'&&parts[2]==='emails'&&method==='POST'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const b=await request.json();
    const mapa=(b&&typeof b.mapa==='object')?b.mapa:null;
    if(!mapa)return jsonRes({error:'Formato inválido.'},400);
    const emp=await getEmployees(env);
    const validos=new Set();
    Object.values(emp).forEach(ms=>ms.forEach(m=>validos.add(m)));
    const records=await getHrStaff(env);
    const gravados=[], ignorados=[], ruins=[];
    for(const[pessoa,email]of Object.entries(mapa)){
      if(!validos.has(pessoa)){ignorados.push(pessoa);continue}
      const e=String(email||'').trim().toLowerCase();
      if(e&&!ehEmail(e)){ruins.push(pessoa+': '+e);continue}
      records[pessoa]=Object.assign({},records[pessoa]||{},{email:e});
      gravados.push(pessoa);
    }
    if(ruins.length)return jsonRes({error:'E-mail inválido em: '+ruins.join('; ')},400);
    if(gravados.length)await env.ATTENDANCE.put('hr_staff',JSON.stringify(records));
    await registrarLog(env,{modulo:'RH Geral',acao:'alteracao',
      alvo:'E-mail corporativo de '+gravados.length+' colaborador(es)',
      quem:session.name||session.username||''});
    return jsonRes({ok:true,gravados,ignorados});
  }
  if(parts[0]==='hr'&&parts[1]==='staff'&&parts[2]&&!parts[3]&&method==='PUT'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    const body=await request.json();
    const records=await getHrStaff(env);
    records[person]={
      full_name:String(body.full_name||'').trim().slice(0,120),
      email:String(body.email||'').trim().toLowerCase().slice(0,120),
      birth_date:body.birth_date||'',
      phone:body.phone||'',
      role:body.role||'',
      admission_date:body.admission_date||'',
      initials:(body.initials||'').toString().trim().toUpperCase().slice(0,6),
      grad_year:(function(v){const n=parseInt(v,10);return (n>=1950&&n<=2100)?String(n):''})(body.grad_year),
      cpf:body.cpf||'',rg:body.rg||'',
      rg_orgao:String(body.rg_orgao||'').trim().slice(0,30),
      rg_emissao:/^\d{4}-\d{2}-\d{2}$/.test(String(body.rg_emissao||''))?body.rg_emissao:'',
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
    // Admissão usa mês de referência; demissão usa a data de saída.
    const modo=b.modo==='demissao'?'demissao':'admissao';
    if(!b.admissao)return jsonRes({error:'Informe a data de admissão.'},400);
    if(modo==='admissao'&&!b.referencia)return jsonRes({error:'Informe o mês de referência.'},400);
    if(modo==='demissao'&&!b.saida)return jsonRes({error:'Informe a data de saída.'},400);
    const list=await getPayrollExt(env);
    const rec={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:b.tipo==='advogado'?'advogado':'estagiario',
      modo,
      nome:String(b.nome||'').trim()||'(sem nome)',
      admissao:b.admissao,
      referencia:b.referencia||(modo==='demissao'?String(b.saida).slice(0,7):''),
      saida:modo==='demissao'?b.saida:'',
      salario:Number(b.salario)||0,
      vt:b.vt===null||b.vt===undefined||b.vt===''?null:Number(b.vt),
      dias_corridos:Number(b.dias_corridos)||0,
      dias_uteis:Number(b.dias_uteis)||0,
      // Feriados descontados do vale-transporte, guardados para o cálculo
      // poder ser conferido depois sem refazer a conta.
      feriados:Array.isArray(b.feriados)
        ?b.feriados.slice(0,40).map(f=>({data:String(f&&f.data||'').slice(0,10),nome:String(f&&f.nome||'').slice(0,60)}))
        :[],
      meses_completos:Number(b.meses_completos)||0,
      valor_ferias:Number(b.valor_ferias)||0,
      valor_13:Number(b.valor_13)||0,
      desconto:Number(b.desconto)||0,
      desconto_label:String(b.desconto_label||'').trim(),
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
    const alvoFF=list.find(r=>r.id===parts[2]);
    if(!alvoFF)return jsonRes({error:'Registro não encontrado.'},404);
    await lixoGuardar(env,{colecao:'hr_payroll_ext',modulo:'RH Geral',
      rotulo:(alvoFF.nome||'(sem nome)')+' · '+(alvoFF.modo==='demissao'?'demissão':'admissão'),
      dados:alvoFF,quem:session.name||session.username||''});
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
    const buf=await getHrFile(env,'hr_intern_doc_file:'+parts[4]);
    if(!buf)return jsonRes({error:'Arquivo não encontrado.'},404);
    return new Response(buf,{status:200,headers:{...CORS,'Content-Type':meta.mimetype,'Content-Length':String(buf.byteLength),'X-Expected-Size':String(meta.size||''),'X-Actual-Size':String(buf.byteLength),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.filename)}});
  }
  if(parts[0]==='hr'&&parts[1]==='interns'&&parts[2]&&parts[3]==='docs'&&parts[4]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const person=decodeURIComponent(parts[2]);
    let index=await getHrInternDocsIndex(env,person);
    index=index.filter(f=>f.id!==parts[4]);
    await env.ATTENDANCE.put('hr_intern_docs:'+person,JSON.stringify(index));
    await delHrFile(env,'hr_intern_doc_file:'+parts[4]);
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
    const buf=await getHrFile(env,'hr_lib_file:'+parts[2]);
    if(!buf)return jsonRes({error:'Arquivo não encontrado.'},404);
    return new Response(buf,{status:200,headers:{...CORS,'Content-Type':meta.mimetype,'Content-Length':String(buf.byteLength),'X-Expected-Size':String(meta.size||''),'X-Actual-Size':String(buf.byteLength),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.filename)}});
  }
  if(parts[0]==='hr'&&parts[1]==='library'&&parts[2]&&parts[2]!=='folders'&&!parts[3]&&method==='DELETE'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    let index=await getHrLibraryIndex(env);
    index=index.filter(f=>f.id!==parts[2]);
    await env.ATTENDANCE.put('hr_library_index',JSON.stringify(index));
    await delHrFile(env,'hr_lib_file:'+parts[2]);
    return jsonRes({ok:true});
  }

  // ══ RELATÓRIO GERENCIAL (quinzenal) ══
  // Uma chamada só monta o panorama inteiro: presença, afastamentos,
  // documentação e pendências. Fazer isso na tela exigiria uma dúzia de idas
  // ao servidor e o número sairia diferente a cada recarga.
  if(parts[0]==='report'&&parts[1]==='gerencial'&&method==='GET'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin gera o relatório gerencial.'},403);
    const ini=String(url.searchParams.get('ini')||'');
    const fim=String(url.searchParams.get('fim')||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ini)||!/^\d{4}-\d{2}-\d{2}$/.test(fim)||fim<ini)
      return jsonRes({error:'Período inválido.'},400);
    return jsonRes(await montarRelatorio(env,ini,fim,session.name||session.username||''));
  }

  // ── configuração do envio automático ──
  if(parts[0]==='report'&&parts[1]==='config'&&method==='GET'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin.'},403);
    const cfgR=await getReportConfig(env);
    return jsonRes(Object.assign({},cfgR,{proximo:cfgR.ativo?reportProximoEnvio(cfgR,logDiaBR()):null}));
  }
  if(parts[0]==='report'&&parts[1]==='config'&&method==='PUT'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin.'},403);
    const b=await request.json();
    const cfg=await getReportConfig(env);
    cfg.ativo=!!b.ativo;
    cfg.recorrencia=['quinzenal','mensal','semanal'].includes(b.recorrencia)?b.recorrencia:'quinzenal';
    if(b.hora!==undefined){
      if(!reportHoraValida(b.hora))return jsonRes({error:'Horário inválido. Use o formato HH:MM.'},400);
      cfg.hora=b.hora;
    }
    const dest=(Array.isArray(b.destinatarios)?b.destinatarios:[])
      .map(e=>String(e||'').trim()).filter(Boolean);
    const ruim=dest.find(e=>!ehEmail(e));
    if(ruim)return jsonRes({error:'E-mail inválido: '+ruim},400);
    if(cfg.ativo&&!dest.length)return jsonRes({error:'Informe ao menos um destinatário.'},400);
    cfg.destinatarios=dest.slice(0,15);
    // Ao ligar pela primeira vez, marca o período que já fechou como enviado.
    // Sem isso o cliente receberia, de imediato, um relatório de um período
    // que ele nunca pediu — a intenção de quem liga é valer daqui para frente.
    if(cfg.ativo&&!cfg.ultimo_envio){
      const per=reportPeriodoDevido(cfg.recorrencia,logDiaBR());
      if(per)cfg.ultimo_envio=per.ini+'|'+per.fim;
    }
    await env.ATTENDANCE.put('report_config',JSON.stringify(cfg));
    return jsonRes({ok:true,proximo:reportProximoEnvio(cfg,logDiaBR())});
  }
  // envio manual: manda o período que está na tela
  if(parts[0]==='report'&&parts[1]==='enviar'&&method==='POST'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin.'},403);
    const b=await request.json();
    const para=(Array.isArray(b.para)?b.para:[]).map(e=>String(e||'').trim()).filter(ehEmail);
    if(!para.length)return jsonRes({error:'Informe ao menos um destinatário válido.'},400);
    if(!b.dados||!b.dados.periodo)return jsonRes({error:'Gere o relatório antes de enviar.'},400);
    const r=await reportEnviar(env,b.dados,para,url.origin);
    if(!r.ok)return jsonRes({error:r.erro},502);
    return jsonRes({ok:true});
  }

  // ══ LIXEIRA ══
  if(parts[0]==='lixeira'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin acessa a lixeira.'},403);
    if(!parts[1]&&method==='GET')
      return jsonRes({itens:await lixoListar(env),dias:LIXO_DIAS});
    if(parts[1]&&parts[2]==='restaurar'&&method==='POST'){
      const raw=await env.ATTENDANCE.get('lixo:'+parts[1]);
      if(!raw)return jsonRes({error:'Item não encontrado — o prazo pode ter vencido.'},404);
      const r=await lixoRestaurar(env,JSON.parse(raw));
      if(!r.ok)return jsonRes({error:r.erro},400);
      return jsonRes({ok:true});
    }
    if(parts[1]&&method==='DELETE'){
      const raw=await env.ATTENDANCE.get('lixo:'+parts[1]);
      if(raw){
        const item=JSON.parse(raw);
        for(const a of item.arquivos||[])await delHrFile(env,a);
        const idx=(await lixoArquivos(env)).filter(x=>x.chave!==item.id);
        await env.ATTENDANCE.put('lixo_arquivos',JSON.stringify(idx));
      }
      await env.ATTENDANCE.delete('lixo:'+parts[1]);
      return jsonRes({ok:true});
    }
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ══ AVISOS POR E-MAIL ══
  if(parts[0]==='mail'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin configura os avisos por e-mail.'},403);

    if(parts[1]==='config'&&method==='GET'){
      const cfg=await getMailConfig(env);
      return jsonRes({ativo:!!cfg.ativo,frequencia:cfg.frequencia||'todas',remetente_nome:cfg.remetente_nome,
        remetente_email:cfg.remetente_email,regras:cfg.regras||[],log:cfg.log||[],
        // a chave nunca volta para a tela; só se ela existe
        chave_ok:!!String((env&&env.RESEND_API_KEY)||'').trim()});
    }

    if(parts[1]==='config'&&method==='PUT'){
      const b=await request.json();
      const cfg=await getMailConfig(env);
      cfg.ativo=!!b.ativo;
      cfg.frequencia=b.frequencia==='primeira'?'primeira':'todas';
      cfg.remetente_nome=String(b.remetente_nome||'VPoint').trim().slice(0,60);
      cfg.remetente_email=String(b.remetente_email||'').trim().slice(0,120);
      if(cfg.ativo&&!ehEmail(cfg.remetente_email))
        return jsonRes({error:'Informe um e-mail de remetente válido, de um domínio verificado no Resend.'},400);
      const regras=Array.isArray(b.regras)?b.regras:[];
      const vistos=new Set();
      cfg.regras=[];
      for(const r of regras.slice(0,60)){
        const pessoas=[...new Set(mailPessoas(r)
          .map(n=>String(n||'').trim().slice(0,120)).filter(Boolean))].slice(0,80);
        if(!pessoas.length)continue;
        const emails=(Array.isArray(r.emails)?r.emails:[])
          .map(e=>String(e||'').trim().slice(0,120)).filter(ehEmail).slice(0,10);
        const invalidos=(Array.isArray(r.emails)?r.emails:[])
          .filter(e=>String(e||'').trim()&&!ehEmail(e));
        if(invalidos.length)return jsonRes({error:'E-mail inválido: '+invalidos[0]},400);
        if(!emails.length)return jsonRes({error:'Informe ao menos um destinatário para '+pessoas[0]+'.'},400);
        cfg.regras.push({persons:pessoas,emails,ativo:r.ativo!==false});
      }
      void vistos;
      await putMailConfig(env,cfg);
      return jsonRes({ok:true,regras:cfg.regras.length});
    }

    // Envia um e-mail de teste para conferir chave, domínio e caixa de entrada.
    if(parts[1]==='test'&&method==='POST'){
      const b=await request.json();
      const cfg=await getMailConfig(env);
      const para=(Array.isArray(b.para)?b.para:[b.para]).map(e=>String(e||'').trim()).filter(ehEmail);
      if(!para.length)return jsonRes({error:'Informe um e-mail válido para o teste.'},400);
      if(!ehEmail(cfg.remetente_email))return jsonRes({error:'Configure o remetente antes de testar.'},400);
      const agora=new Date();
      const dataBR=logDiaBR().split('-').reverse().join('/');
      const hora=agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
      const r=await enviarEmail(env,{de:mailRemetente(cfg),para,
        assunto:'Teste de aviso do VPoint',
        texto:'Se você recebeu esta mensagem, os avisos por e-mail estão funcionando.',
        html:mailCorpo('Teste de envio','Disparo manual',dataBR,hora,await mailTema(env),url.origin)});
      await mailRegistrar(env,cfg,{tipo:'teste',pessoa:session.name||'',para,
        ok:r.ok,erro:r.erro||'',id:r.id||''});
      if(!r.ok)return jsonRes({error:r.erro},502);
      return jsonRes({ok:true,id:r.id});
    }

    // Libera a trava do dia, para poder testar o disparo real de novo.
    if(parts[1]==='reset'&&method==='POST'){
      const b=await request.json();
      const pessoa=String(b.person||'').trim();
      if(!pessoa)return jsonRes({error:'Informe a pessoa.'},400);
      await env.ATTENDANCE.delete('mail_av:'+logDiaBR()+':'+pessoa);
      return jsonRes({ok:true});
    }

    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ══ PRESTADORES DE SERVIÇO ══
  // Agenda de contatos do escritório: quem presta serviço com contrato
  // (elétrica, contador, brindes...). É coisa distinta dos Fornecedores de
  // continuado ao escritório, com contrato e vigência.
  if(parts[0]==='prov'){
    if(!hasProvAccess)return jsonRes({error:'Sem acesso a Prestadores de Serviço.'},403);

    if(!parts[1]&&method==='GET'){
      const lista=(await getProviders(env)).map(normalizaProvider);
      return jsonRes({prestadores:lista,segmentos:await getProvSegmentos(env),hoje:medHoje()});
    }

    if(!parts[1]&&method==='POST'){
      const b=await request.json();
      const nome=String(b.nome||'').trim();
      if(!nome)return jsonRes({error:'Informe o nome do prestador.'},400);
      const erro=validaVigencia(b);
      if(erro)return jsonRes({error:erro},400);
      const lista=await getProviders(env);
      const rec=Object.assign(campoProvider(b),{
        id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        contrato:null,
        created_at:new Date().toISOString(),created_by:session.name||session.username||''});
      lista.push(rec);
      await env.ATTENDANCE.put('providers',JSON.stringify(lista));
      return jsonRes({ok:true,id:rec.id});
    }

    if(parts[1]&&!parts[2]&&method==='PUT'){
      const b=await request.json();
      if(!String(b.nome||'').trim())return jsonRes({error:'Informe o nome do prestador.'},400);
      const erro=validaVigencia(b);
      if(erro)return jsonRes({error:erro},400);
      const lista=await getProviders(env);
      const i=lista.findIndex(p=>p.id===parts[1]);
      if(i===-1)return jsonRes({error:'Prestador não encontrado.'},404);
      Object.assign(lista[i],campoProvider(b),{
        updated_at:new Date().toISOString(),updated_by:session.name||session.username||''});
      delete lista[i].contato;   // repartido em whatsapps/emails, não volta
      await env.ATTENDANCE.put('providers',JSON.stringify(lista));
      return jsonRes({ok:true});
    }

    if(parts[1]&&!parts[2]&&method==='DELETE'){
      let lista=await getProviders(env);
      const alvo=lista.find(p=>p.id===parts[1]);
      if(!alvo)return jsonRes({error:'Prestador não encontrado.'},404);
      // O contrato anexado NÃO é apagado agora: fica guardado junto na lixeira
      // e some com ela, para a restauração trazer o arquivo de volta.
      await lixoGuardar(env,{colecao:'providers',modulo:'Prestadores',
        rotulo:alvo.nome||'(sem nome)',dados:alvo,quem:session.name||session.username||'',
        arquivos:alvo.contrato?['prov_file:'+parts[1]]:[]});
      lista=lista.filter(p=>p.id!==parts[1]);
      await env.ATTENDANCE.put('providers',JSON.stringify(lista));
      return jsonRes({ok:true});
    }

    // ── CONTRATO ANEXADO ──
    if(parts[1]&&parts[2]==='contrato'&&method==='POST'){
      const lista=await getProviders(env);
      const i=lista.findIndex(p=>p.id===parts[1]);
      if(i===-1)return jsonRes({error:'Prestador não encontrado.'},404);
      const form=await request.formData();
      const file=form.get('file');
      if(!file||typeof file==='string')return jsonRes({error:'Escolha o arquivo do contrato.'},400);
      const buf=await file.arrayBuffer();
      if(buf.byteLength>20*1024*1024)return jsonRes({error:'O contrato deve ter no máximo 20 MB.'},400);
      try{await putHrFile(env,'prov_file:'+parts[1],buf,file.type||undefined)}
      catch(e){return jsonRes({error:e.message},500)}
      lista[i].contrato={filename:file.name,mimetype:file.type||'application/octet-stream',
        size:buf.byteLength,uploaded_at:new Date().toISOString()};
      await env.ATTENDANCE.put('providers',JSON.stringify(lista));
      return jsonRes({ok:true,contrato:lista[i].contrato});
    }

    if(parts[1]&&parts[2]==='contrato'&&method==='GET'){
      const lista=await getProviders(env);
      const p=lista.find(x=>x.id===parts[1]);
      if(!p||!p.contrato)return jsonRes({error:'Sem contrato anexado.'},404);
      const buf=await getHrFile(env,'prov_file:'+parts[1]);
      if(!buf)return jsonRes({error:'Arquivo não encontrado.'},404);
      return new Response(buf,{status:200,headers:{...CORS,
        'Content-Type':p.contrato.mimetype,'Content-Length':String(buf.byteLength),
        'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(p.contrato.filename)}});
    }

    if(parts[1]&&parts[2]==='contrato'&&method==='DELETE'){
      const lista=await getProviders(env);
      const i=lista.findIndex(p=>p.id===parts[1]);
      if(i===-1)return jsonRes({error:'Prestador não encontrado.'},404);
      await delHrFile(env,'prov_file:'+parts[1]);
      lista[i].contrato=null;
      await env.ATTENDANCE.put('providers',JSON.stringify(lista));
      return jsonRes({ok:true});
    }

    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ══ ASSISTÊNCIA MÉDICA ══
  // Ver: quem tem RH ou a permissão própria. Criar/alterar titulares e dependentes: quem tem RH.
  // Tipos de plano, tabela de valores e percentuais: apenas superadmin.
  if(parts[0]==='med'){
    if(!hasMedView)return jsonRes({error:'Sem acesso à Assistência Médica.'},403);
    const negaEdicao=()=>jsonRes({error:'É necessário ter acesso ao RH para criar ou alterar beneficiários.'},403);
    const negaAdmin=()=>jsonRes({error:'Apenas o superadmin pode alterar planos, valores e percentuais.'},403);

    // ── PERCENTUAIS E DADOS DO CONTRATO ──
    if(parts[1]==='config'&&method==='GET')return jsonRes(await getMedConfig(env));
    if(parts[1]==='config'&&method==='PUT'){
      if(currentRole!=='superadmin')return negaAdmin();
      const b=await request.json();
      const cur=await getMedConfig(env);
      const cfg={
        pct_associado:Math.min(100,medNum(b.pct_associado!==undefined?b.pct_associado:cur.pct_associado)),
        pct_clt:Math.min(100,medNum(b.pct_clt!==undefined?b.pct_clt:cur.pct_clt)),
        operadora:String(b.operadora!==undefined?b.operadora:cur.operadora||'').trim().slice(0,80),
        vigencia:String(b.vigencia!==undefined?b.vigencia:cur.vigencia||'').trim().slice(0,20)
      };
      await env.ATTENDANCE.put('med_config',JSON.stringify(cfg));
      return jsonRes({ok:true,config:cfg});
    }

    // ── TIPOS DE PLANO ──
    if(parts[1]==='plan-types'&&method==='GET')return jsonRes(await getMedPlanTypes(env));
    if(parts[1]==='plan-types'&&method==='PUT'){
      if(currentRole!=='superadmin')return negaAdmin();
      const b=await request.json();
      const lista=Array.isArray(b.types)?b.types:[];
      const vistos=new Set();
      const types=[];
      for(const t of lista){
        const code=String(t.code||'').trim().slice(0,30);
        if(!code||vistos.has(code))continue;
        vistos.add(code);
        const iofNum=Number(t.iof);
        types.push({code,label:String(t.label||code).trim().slice(0,60),
          iof:(isNaN(iofNum)||iofNum<0||iofNum>50)?MED_IOF_PADRAO:Math.round(iofNum*100)/100,
          integral:!!t.integral,
          full:String(t.full||'').trim().slice(0,200)});
      }
      if(!types.length)return jsonRes({error:'Informe ao menos um plano.'},400);
      await env.ATTENDANCE.put('med_plan_types',JSON.stringify(types));
      return jsonRes({ok:true,types});
    }

    // ── TABELA DE VALORES POR FAIXA ETÁRIA ──
    if(parts[1]==='price-table'&&method==='GET'){
      const meta=await env.ATTENDANCE.get('med_price_meta');
      const tps=await getMedPlanTypes(env);
      const base=await getMedPriceTable(env);
      return jsonRes({faixas:MED_FAIXAS,types:tps,prices:base,prices_total:medPrecosComIof(base,tps),
        iof_padrao:MED_IOF_PADRAO,meta:meta?JSON.parse(meta):null});
    }
    if(parts[1]==='price-table'&&method==='PUT'){
      if(currentRole!=='superadmin')return negaAdmin();
      const b=await request.json();
      const entrada=b.prices||{};
      const types=await getMedPlanTypes(env);
      const prices={};
      for(const t of types){
        const linha=entrada[t.code]||{};
        const out={};
        for(const f of MED_FAIXAS){
          const v=medNum(linha[f.id]);
          if(v>0)out[f.id]=v;
        }
        prices[t.code]=out;
      }
      await env.ATTENDANCE.put('med_price_table',JSON.stringify(prices));
      await env.ATTENDANCE.put('med_price_meta',JSON.stringify({
        origin:String(b.origin||'manual').slice(0,30),
        updated_at:new Date().toISOString(),
        updated_by:session.name||session.username||''
      }));
      return jsonRes({ok:true,prices});
    }

    // ── BENEFICIÁRIOS ──
    if(parts[1]==='holders'&&!parts[2]&&method==='GET'){
      const emp=await getEmployees(env);
      const staff=await getHrStaff(env);
      const plans=await getMedPlans(env);
      const cfg=await getMedConfig(env);
      const types=await getMedPlanTypes(env);
      const precoBase=await getMedPriceTable(env);
      const prices=precoBase;
      const hoje=medHoje();
      const alertaDias=Number(cfg.alerta_dias)||35;
      const out=[];const alertas=[];
      const vistos=new Set();
      const anotaAlertas=(person,team,plano)=>{
        if(!plano||(plano.status||'A')==='E')return;
        const iofP=medIofDe(types,plano.plan_code);
        const v=medProximaVirada(plano,plano.plan_code,prices,cfg,hoje,iofP);
        if(v&&v.dias>=0&&v.dias<=alertaDias)alertas.push({person,team,quem:person,tipo:'Titular',...v});
        (plano.dependents||[]).forEach(d=>{
          if((d.status||'A')==='E')return;
          const dv=medProximaVirada(d,plano.plan_code,prices,cfg,hoje,iofP);
          if(dv&&dv.dias>=0&&dv.dias<=alertaDias)
            alertas.push({person,team,quem:d.name,tipo:d.relation||'Dependente',...dv});
        });
      };
      for(const team of MED_EQUIPES){
        for(const person of (emp[team]||[])){
          vistos.add(person);
          const rec=staff[person]||{};
          const bruto=plans[person];
          const plano=bruto?Object.assign(medPlanoVazio(team),bruto):null;
          if(plano){
            plano.vinculo=medVinculo(plano.vinculo,team);plano.external=false;plano.team=team;
            // A data de nascimento do RH Geral vale quando a ficha do convênio não tem uma própria.
            if(!plano.birth_date&&rec.birth_date){plano.birth_date=rec.birth_date;plano.birth_from_hr=true}
          }
          if(plano)anotaAlertas(person,team,plano);
          out.push({person,team,external:false,
            initials:rec.initials||'',role:rec.role||'',grad_year:rec.grad_year||'',
            hr_birth_date:rec.birth_date||'',
            has_plan:!!plano,plan:plano||medPlanoVazio(team),
            calc:plano?medCalcular(plano,cfg,prices,hoje,types):null});
        }
      }
      // Titulares que estão no convênio mas não constam no cadastro de colaboradores
      for(const[person,bruto]of Object.entries(plans)){
        if(vistos.has(person))continue;
        const team=bruto.team||'';
        const plano=Object.assign(medPlanoVazio(team),bruto);
        plano.external=true;
        plano.vinculo=medVinculo(plano.vinculo,team);
        anotaAlertas(person,team||'Externo',plano);
        out.push({person,team:team||'Externo',external:true,
          initials:'',role:bruto.role||'',grad_year:'',hr_birth_date:'',
          has_plan:true,plan:plano,calc:medCalcular(plano,cfg,prices,hoje,types)});
      }
      out.sort((a,b)=>a.person.localeCompare(b.person,'pt-BR'));
      alertas.sort((a,b)=>a.dias-b.dias);
      return jsonRes({config:cfg,types,prices,prices_base:precoBase,faixas:MED_FAIXAS,holders:out,alertas,hoje,can_edit:hasHrAccess});
    }

    // ── FICHA DO TITULAR ──
    if(parts[1]==='holders'&&parts[2]&&!parts[3]&&method==='PUT'){
      if(!hasHrAccess)return negaEdicao();
      const person=decodeURIComponent(parts[2]);
      const emp=await getEmployees(env);
      let team=null;
      for(const t of MED_EQUIPES)if((emp[t]||[]).includes(person))team=t;
      const b=await request.json();
      const plans=await getMedPlans(env);
      const externo=!team;
      if(externo&&!plans[person]&&!b.allow_external)
        return jsonRes({error:'Titular não encontrado entre sócios, advogados e administrativo.'},404);
      const atual=plans[person]||medPlanoVazio(team||'');
      plans[person]={
        vinculo:medVinculo(b.vinculo,team||atual.team||''),
        plan_value:medNum(b.plan_value),
        plan_code:String(b.plan_code||'').trim().slice(0,30),
        group_code:String(b.group_code||'').trim().slice(0,30),
        cpf:String(b.cpf||'').replace(/\D/g,'').slice(0,11),
        age:medIdade(b.age),
        birth_date:String(b.birth_date||'').slice(0,10),
        card:String(b.card||'').trim().slice(0,40),
        start_date:String(b.start_date||'').slice(0,10),
        status:b.status==='E'?'E':'A',
        exclusion_date:String(b.exclusion_date||'').slice(0,10),
        notes:String(b.notes||'').trim().slice(0,500),
        role:String(b.role||atual.role||'').trim().slice(0,60),
        external:externo,
        team:team||String(b.team||atual.team||'').trim().slice(0,30),
        dependents:Array.isArray(atual.dependents)?atual.dependents:[]
      };
      await saveMedPlans(env,plans);
      const cfg=await getMedConfig(env);
      const tps=await getMedPlanTypes(env);
      return jsonRes({ok:true,calc:medCalcular(plans[person],cfg,await getMedPriceTable(env),null,tps)});
    }
    if(parts[1]==='holders'&&parts[2]&&!parts[3]&&method==='DELETE'){
      if(!hasHrAccess)return negaEdicao();
      const person=decodeURIComponent(parts[2]);
      const plans=await getMedPlans(env);
      if(!plans[person])return jsonRes({error:'Este colaborador não possui plano cadastrado.'},404);
      delete plans[person];
      await saveMedPlans(env,plans);
      return jsonRes({ok:true});
    }

    // ── DEPENDENTES ──
    if(parts[1]==='holders'&&parts[2]&&parts[3]==='dependents'&&!parts[4]&&method==='POST'){
      if(!hasHrAccess)return negaEdicao();
      const person=decodeURIComponent(parts[2]);
      const plans=await getMedPlans(env);
      if(!plans[person])return jsonRes({error:'Cadastre o plano do titular antes de incluir dependentes.'},400);
      const b=await request.json();
      const nome=String(b.name||'').trim();
      if(!nome)return jsonRes({error:'Informe o nome do dependente.'},400);
      const dep={
        id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        name:nome.slice(0,120),
        relation:String(b.relation||'').trim().slice(0,40),
        birth_date:String(b.birth_date||'').slice(0,10),
        age:medIdade(b.age),
        cpf:String(b.cpf||'').replace(/\D/g,'').slice(0,11),
        card:String(b.card||'').trim().slice(0,40),
        start_date:String(b.start_date||'').slice(0,10),
        status:b.status==='E'?'E':'A',
        exclusion_date:String(b.exclusion_date||'').slice(0,10),
        custeio:b.custeio==='empresa'?'empresa':'titular',
        plan_value:medNum(b.plan_value)
      };
      if(!Array.isArray(plans[person].dependents))plans[person].dependents=[];
      plans[person].dependents.push(dep);
      await saveMedPlans(env,plans);
      return jsonRes({ok:true,id:dep.id});
    }
    if(parts[1]==='holders'&&parts[2]&&parts[3]==='dependents'&&parts[4]&&method==='PUT'){
      if(!hasHrAccess)return negaEdicao();
      const person=decodeURIComponent(parts[2]);
      const plans=await getMedPlans(env);
      if(!plans[person])return jsonRes({error:'Plano não encontrado.'},404);
      const deps=plans[person].dependents||[];
      const idx=deps.findIndex(d=>d.id===parts[4]);
      if(idx<0)return jsonRes({error:'Dependente não encontrado.'},404);
      const b=await request.json(),cur=deps[idx];
      const pick=(k,max)=>String(b[k]!==undefined?b[k]:(cur[k]||'')).trim().slice(0,max);
      deps[idx]={
        id:cur.id,
        name:String(b.name||cur.name).trim().slice(0,120),
        relation:pick('relation',40),
        birth_date:pick('birth_date',10),
        age:medIdade(b.age!==undefined?b.age:cur.age),
        cpf:pick('cpf',14).replace(/\D/g,'').slice(0,11),
        card:pick('card',40),
        start_date:pick('start_date',10),
        status:(b.status!==undefined?b.status:cur.status)==='E'?'E':'A',
        exclusion_date:pick('exclusion_date',10),
        custeio:(b.custeio!==undefined?b.custeio:cur.custeio)==='empresa'?'empresa':'titular',
        plan_value:medNum(b.plan_value!==undefined?b.plan_value:cur.plan_value)
      };
      await saveMedPlans(env,plans);
      return jsonRes({ok:true});
    }
    if(parts[1]==='holders'&&parts[2]&&parts[3]==='dependents'&&parts[4]&&method==='DELETE'){
      if(!hasHrAccess)return negaEdicao();
      const person=decodeURIComponent(parts[2]);
      const plans=await getMedPlans(env);
      if(!plans[person])return jsonRes({error:'Plano não encontrado.'},404);
      const deps=plans[person].dependents||[];
      const idx=deps.findIndex(d=>d.id===parts[4]);
      if(idx<0)return jsonRes({error:'Dependente não encontrado.'},404);
      deps.splice(idx,1);
      await saveMedPlans(env,plans);
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

    // 5) registra no histórico: estagiário que virou advogado é promoção, e
    // isso precisa aparecer no relatório gerencial
    await addEmployeeLog(env,[{type:'transferencia',person,team:to,from,date:brToday(),
      at:new Date().toISOString(),by:session.name||''}]);

    // As fichas de RH (hr_staff e hr_interns) são indexadas pelo nome da pessoa,
    // então acompanham a migração automaticamente, sem perder nada.
    return jsonRes({ok:true,person,from,to,days_moved:daysMoved,vacations_moved:vacsMoved,biometrics_moved:mapMoved});
  }

  // ── STATUSES ──
  if(parts[0]==='statuses'&&method==='GET')return jsonRes(await getStatuses(env));
  if(parts[0]==='statuses'&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put('custom_statuses',JSON.stringify(b));return jsonRes({ok:true})}

  // ── ATTENDANCE ──
  if(parts[0]==='attendance'&&parts[1]&&method==='GET'){const r=await env.ATTENDANCE.get(`att:${parts[1]}`);return jsonRes(r?JSON.parse(r):{})}
  if(parts[0]==='attendance'&&parts[1]&&method==='PUT'){const b=await request.json();await env.ATTENDANCE.put(`att:${parts[1]}`,JSON.stringify(b));await marcarPresencaMudou(env);return jsonRes({ok:true})}

  // ── REPORT ──
  if(parts[0]==='report'&&parts[1]&&method==='GET'){
    const emp=await getEmployees(env);const dates=weekDates(parts[1]);const vacs=await getVacations(env);const report={};
    for(const[team,members]of Object.entries(emp)){report[team]={};for(const person of members){report[team][person]={};for(const date of dates){const r=await env.ATTENDANCE.get(`att:${date}`);const day=r?JSON.parse(r):{};let status=day[team]?.[person]??'';if(!status){const vac=vacs.find(v=>v.team===team&&v.person===person&&v.start<=date&&v.end>=date);if(vac)status=vac.type;}report[team][person][date]=status;}}}
    return jsonRes({dates,report,requirements:{"Sócios":2,"Advogados":2,"Estagiários":2,"Administrativo":3}});
  }

  // ── DASHBOARD ──
  if(parts[0]==='dashboard'&&method==='GET'){
    const start=url.searchParams.get('start')||'';const end=url.searchParams.get('end')||'9999';
    // O painel refaz a conta do ano inteiro a cada abertura. Como o resultado
    // só muda quando alguém lança presença, ele fica guardado e é refeito
    // apenas depois de uma alteração — daí o selo de versão.
    const selo=(await env.ATTENDANCE.get('att_versao'))||'0';
    const chaveCache='dash_cache:'+start+':'+end+':'+selo;
    const pronto=await env.ATTENDANCE.get(chaveCache);
    if(pronto)return jsonRes(JSON.parse(pronto));

    const emp=await getEmployees(env);const keys=await env.ATTENDANCE.list({prefix:'att:'});
    const nomes=keys.keys.map(k=>k.name).filter(n=>{const d=n.slice(4);return d>=start&&d<=end});
    const brutos=await lerVarias(env,nomes);
    const byDow={1:0,2:0,3:0,4:0,5:0};const byWeek={};const byTeam=Object.fromEntries(Object.keys(emp).map(k=>[k,0]));const recent=[];
    for(const name of nomes){
      const r=brutos.get(name);if(!r)continue;
      const date=name.slice(4);
      const day=JSON.parse(r);const d=new Date(date+'T12:00:00');const dow=d.getDay();
      if(dow===0||dow===6)continue;
      let dt=0;
      for(const[team,members]of Object.entries(day))for(const s of Object.values(members))if(s==='Presente'){byDow[dow]=(byDow[dow]||0)+1;if(byTeam[team]!==undefined)byTeam[team]++;dt++}
      const wk=isoWeek(d);byWeek[wk]=(byWeek[wk]||0)+dt;recent.push({date,total:dt});
    }
    recent.sort((a,b)=>b.date.localeCompare(a.date));
    const saida={byDow,byWeek:Object.fromEntries(Object.entries(byWeek).sort()),byTeam,recent:recent.slice(0,60)};
    // uma hora de validade, além do selo: se algo escapar da invalidação,
    // o painel se corrige sozinho em vez de ficar velho para sempre
    try{await env.ATTENDANCE.put(chaveCache,JSON.stringify(saida),{expirationTtl:3600})}catch(e){}
    return jsonRes(saida);
  }

  // ── FÉRIAS COLETIVAS ──
  // Programar o recesso gera um registro de férias para cada pessoa das
  // equipes elegíveis. É isso que faz o período aparecer na presença, nos
  // relatórios e no gerencial — sem precisar de tratamento especial em
  // nenhum deles. O grupo fica guardado para poder ser desfeito inteiro.
  if(parts[0]==='vacations'&&parts[1]==='coletivas'&&method==='GET'){
    const col=await getColetivas(env);
    const emp=await getEmployees(env);
    const vacs=await getVacations(env);
    const eleg=[];
    EQUIPES_COLETIVAS.forEach(t=>(emp[t]||[]).forEach(person=>eleg.push({team:t,person})));
    // conta quantos registros o grupo ainda tem de fato: alguém pode ter sido
    // excluído individualmente pela tabela depois da programação.
    const lista=col.map(c=>Object.assign({},c,
      {vigentes:vacs.filter(v=>v&&v.coletiva===c.id).length}));
    return jsonRes({coletivas:lista,elegiveis:eleg,equipes:EQUIPES_COLETIVAS});
  }
  if(parts[0]==='vacations'&&parts[1]==='coletivas'&&method==='POST'){
    const b=await request.json();
    const dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
    if(!dt(b.start)||!dt(b.end))return jsonRes({error:'Informe as datas de início e fim.'},400);
    if(b.end<b.start)return jsonRes({error:'A data final não pode ser anterior à inicial.'},400);
    const emp=await getEmployees(env);
    const validos=new Set();
    EQUIPES_COLETIVAS.forEach(t=>(emp[t]||[]).forEach(p=>validos.add(t+'|'+p)));
    const pedidos=(Array.isArray(b.pessoas)?b.pessoas:[])
      .filter(x=>x&&validos.has(x.team+'|'+x.person));
    if(!pedidos.length)
      return jsonRes({error:'Selecione ao menos um colaborador. Só entram estagiários e administrativo.'},400);
    const vacs=await getVacations(env);
    const grupo=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const nota=String(b.note||'').trim().slice(0,120);
    const criados=[], pulados=[];
    for(const x of pedidos){
      // quem já tem algo marcado no período fica de fora: o lançamento
      // individual manda, e sobrepor criaria dois afastamentos no mesmo dia.
      const choque=vacs.find(v=>v.person===x.person&&v.team===x.team&&v.start<=b.end&&v.end>=b.start);
      if(choque){pulados.push({person:x.person,team:x.team,motivo:choque.type+' de '+choque.start+' a '+choque.end});continue}
      const reg={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        team:x.team,person:x.person,type:'Férias',start:b.start,end:b.end,
        note:nota?'Férias coletivas — '+nota:'Férias coletivas',coletiva:grupo};
      vacs.push(reg); criados.push(reg);
    }
    if(!criados.length)
      return jsonRes({error:'Ninguém pôde ser incluído: todos já têm afastamento neste período.',pulados},409);
    await env.ATTENDANCE.put('vacations',JSON.stringify(vacs));
    const col=await getColetivas(env);
    col.push({id:grupo,start:b.start,end:b.end,note:nota,
      pessoas:criados.map(r=>({team:r.team,person:r.person})),
      criado_em:new Date().toISOString(),criado_por:session.name||session.username||''});
    await saveColetivas(env,col);
    await registrarLog(env,{modulo:'Férias e Licença',acao:'criacao',
      alvo:'Férias coletivas '+b.start+' a '+b.end+' ('+criados.length+' pessoa(s))',
      quem:session.name||session.username||''});
    return jsonRes({ok:true,id:grupo,criados:criados.length,pulados});
  }
  if(parts[0]==='vacations'&&parts[1]==='coletivas'&&parts[2]&&method==='DELETE'){
    const id=parts[2];
    const col=await getColetivas(env);
    const g=col.find(c=>c.id===id);
    if(!g)return jsonRes({error:'Programação não encontrada.'},404);
    const vacs=await getVacations(env);
    const restam=[];
    let removidos=0;
    for(const v of vacs){
      if(v&&v.coletiva===id){
        removidos++;
        await lixoGuardar(env,{colecao:'vacations',modulo:'Férias e Licença',
          rotulo:(v.person||'')+' · Férias coletivas · '+(v.start||''),dados:v,
          quem:session.name||session.username||''});
      }else restam.push(v);
    }
    await env.ATTENDANCE.put('vacations',JSON.stringify(restam));
    await saveColetivas(env,col.filter(c=>c.id!==id));
    await registrarLog(env,{modulo:'Férias e Licença',acao:'exclusao',
      alvo:'Férias coletivas '+g.start+' a '+g.end+' ('+removidos+' registro(s))',
      quem:session.name||session.username||''});
    return jsonRes({ok:true,removidos});
  }

  // ══ SAÍDA DOS MÓDULOS COMPRAS E SISJURI ══
  // Rotas de uso único, só para o superadmin: baixar tudo antes e, depois,
  // apagar. Ficam aqui porque o KV não tem exclusão em lote pelo painel.
  if(parts[0]==='baixa-modulos'){
    if(currentRole!=='superadmin')return jsonRes({error:'Apenas o superadmin.'},403);
    const CHAVES=['purch_categories','purch_suppliers','purch_orders','purch_products',
                  'sj_contas','sj_cats','sj_regras','sj_extratos','sj_envio'];

    if(parts[1]==='backup'&&method==='GET'){
      const saida={gerado_em:new Date().toISOString(),por:session.name||'',dados:{},extratos:{},pdfs:{}};
      for(const k of CHAVES){
        const v=await env.ATTENDANCE.get(k);
        if(v!==null)saida.dados[k]=JSON.parse(v);
      }
      // cada extrato do Sisjuri fica numa chave própria, com o PDF no R2
      const indice=saida.dados.sj_extratos||[];
      for(const x of indice){
        const raw=await env.ATTENDANCE.get('sj_ext:'+x.id);
        if(raw)saida.extratos[x.id]=JSON.parse(raw);
        try{
          const buf=await getHrFile(env,'sisjuri/'+x.id+'.pdf');
          if(buf)saida.pdfs[x.id]=pdfB64(new Uint8Array(buf));
        }catch(e){}
      }
      saida.resumo={
        pedidos:(saida.dados.purch_orders||[]).length,
        fornecedores:(saida.dados.purch_suppliers||[]).length,
        produtos:(saida.dados.purch_products||[]).length,
        extratos:indice.length,
        lancamentos:Object.values(saida.extratos).reduce((a,e)=>a+(e.lancamentos||[]).length,0),
        pdfs:Object.keys(saida.pdfs).length};
      return new Response(JSON.stringify(saida),{headers:{...CORS,'Content-Type':'application/json',
        'Content-Disposition':'attachment; filename="vpoint-backup-compras-sisjuri.json"'}});
    }

    if(parts[1]==='apagar'&&method==='POST'){
      const b=await request.json();
      // confirmação explícita: sem ela, não apaga nada
      if(b.confirmar!=='APAGAR')
        return jsonRes({error:'Confirmação ausente.'},400);
      const apagadas=[], arquivos=[];
      const indice=JSON.parse(await env.ATTENDANCE.get('sj_extratos')||'[]');
      for(const x of indice){
        await env.ATTENDANCE.delete('sj_ext:'+x.id);
        apagadas.push('sj_ext:'+x.id);
        try{await delHrFile(env,'sisjuri/'+x.id+'.pdf');arquivos.push(x.id+'.pdf')}catch(e){}
      }
      for(const k of CHAVES){
        const v=await env.ATTENDANCE.get(k);
        if(v!==null){await env.ATTENDANCE.delete(k);apagadas.push(k)}
      }
      // a lixeira pode guardar itens dos dois módulos: vão junto
      const lixo=await env.ATTENDANCE.list({prefix:'lixo:'});
      for(const k of lixo.keys){
        try{
          const it=JSON.parse(await env.ATTENDANCE.get(k.name)||'{}');
          if(['purch_orders','purch_suppliers','purch_products','sj_extratos'].includes(it.colecao)){
            await env.ATTENDANCE.delete(k.name);apagadas.push(k.name);
          }
        }catch(e){}
      }
      await registrarLog(env,{modulo:'Sistema',acao:'exclusao',
        alvo:'Dados de Compras e Relatórios Sisjuri ('+apagadas.length+' registros)',
        quem:session.name||session.username||''});
      return jsonRes({ok:true,apagadas:apagadas.length,arquivos:arquivos.length,chaves:apagadas});
    }
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ══ COMUNICADOS ══
  if(parts[0]==='comunicados'){
    if(!hasHrAccess)return jsonRes({error:'Sem acesso ao módulo de RH.'},403);
    const quem=session.name||session.username||'';

    if(!parts[1]&&method==='GET'){
      const pessoas=await comPessoas(env);
      const enviados=await comEnviados(env);
      return jsonRes({tipos:Object.entries(COM_TIPOS).map(([id,t])=>({id,...t})),
        pessoas:pessoas.map(p=>Object.assign({},p,{
          recebeu:Object.fromEntries(Object.keys(COM_TIPOS).map(t=>
            [t,(enviados[t]&&enviados[t][p.person])||null]))}))});
    }
    // a prévia usa o mesmo modelo do envio, para o que se vê ser o que sai
    if(parts[1]==='previa'&&method==='GET'){
      const tipo=url.searchParams.get('tipo')||'boasvindas';
      if(!COM_TIPOS[tipo])return jsonRes({error:'Comunicado desconhecido.'},400);
      const pessoas=await comPessoas(env);
      const alvo=pessoas.find(p=>p.person===url.searchParams.get('pessoa'))||
        pessoas[0]||{person:'Maria Silva',equipe:'Advogados',cargo:'Advogada'};
      const cfg=await getMailConfig(env);
      return new Response(comHtml(tipo,alvo,await mailTema(env),cfg),
        {headers:{...CORS,'Content-Type':'text/html; charset=utf-8'}});
    }
    if(parts[1]==='enviar'&&method==='POST'){
      const b=await request.json();
      const tipo=String(b.tipo||'');
      if(!COM_TIPOS[tipo])return jsonRes({error:'Comunicado desconhecido.'},400);
      const cfgMail=await getMailConfig(env);
      if(!ehEmail(cfgMail.remetente_email))
        return jsonRes({error:'Configure o remetente em Avisos por e-mail antes de enviar comunicados.'},400);
      const pedidos=new Set((Array.isArray(b.pessoas)?b.pessoas:[]).map(String));
      if(!pedidos.size)return jsonRes({error:'Selecione ao menos um colaborador.'},400);

      const pessoas=(await comPessoas(env)).filter(p=>pedidos.has(p.person));
      const enviados=await comEnviados(env);
      enviados[tipo]=enviados[tipo]||{};
      const tema=await mailTema(env);
      const enviadosAgora=[], semEmail=[], repetidos=[], erros=[];

      for(const p of pessoas){
        if(!p.email){semEmail.push(p.person);continue}
        // Boas-vindas é uma vez na vida: a trava fica aqui, no servidor, e não
        // só na tela — um clique duplo não pode mandar duas.
        if(COM_TIPOS[tipo].unico&&enviados[tipo][p.person]){repetidos.push(p.person);continue}
        const r=await enviarEmail(env,{de:cfgMail.remetente_email,para:[p.email],
          assunto:COM_TIPOS[tipo].assunto,
          html:comHtml(tipo,p,tema,cfgMail),
          texto:COM_TIPOS[tipo].assunto+' — abra em um leitor com HTML.'});
        if(r.ok){
          enviados[tipo][p.person]={em:new Date().toISOString(),para:p.email,por:quem};
          enviadosAgora.push(p.person);
        }else erros.push({pessoa:p.person,erro:r.erro||'falha no envio'});
      }
      if(enviadosAgora.length)await env.ATTENDANCE.put('com_enviados',JSON.stringify(enviados));
      await registrarLog(env,{modulo:'RH Geral',acao:'criacao',
        alvo:'Comunicado '+COM_TIPOS[tipo].rotulo+': '+enviadosAgora.length+' enviado(s)',quem});
      return jsonRes({ok:true,enviados:enviadosAgora,sem_email:semEmail,repetidos,erros});
    }
    // desfaz a marca, para reenviar as boas-vindas a quem precisa
    if(parts[1]==='marca'&&parts[2]&&method==='DELETE'){
      const tipo=parts[2];
      const pessoa=url.searchParams.get('pessoa')||'';
      if(!COM_TIPOS[tipo]||!pessoa)return jsonRes({error:'Informe o comunicado e a pessoa.'},400);
      const enviados=await comEnviados(env);
      if(enviados[tipo])delete enviados[tipo][pessoa];
      await env.ATTENDANCE.put('com_enviados',JSON.stringify(enviados));
      await registrarLog(env,{modulo:'RH Geral',acao:'alteracao',
        alvo:'Liberou reenvio de '+COM_TIPOS[tipo].rotulo+' para '+pessoa,quem});
      return jsonRes({ok:true});
    }
    return jsonRes({error:'Rota não encontrada'},404);
  }

  // ── VACATIONS ──
  if(parts[0]==='vacations'&&method==='GET')return jsonRes(await getVacations(env));
  if(parts[0]==='vacations'&&method==='PUT'){
    const b=await request.json();
    // A tela manda a lista inteira. O que sumiu em relação à anterior foi
    // excluído — guarda cada um, para poder voltar.
    if(Array.isArray(b)){
      const antes=await getVacations(env);
      const ids=new Set(b.map(v=>v&&v.id).filter(Boolean));
      for(const v of antes){
        if(v&&v.id&&!ids.has(v.id))
          await lixoGuardar(env,{colecao:'vacations',modulo:'Férias e Licença',
            rotulo:(v.person||'')+' · '+(v.type||'')+' · '+(v.start||''),dados:v,quem:session.name||session.username||''});
      }
    }
    await env.ATTENDANCE.put('vacations',JSON.stringify(b));
    return jsonRes({ok:true});
  }

  return jsonRes({error:'Rota não encontrada'},404);
}
