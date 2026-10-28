// Service worker do VPoint.
//
// Premissa deliberada: NADA de dado é guardado em cache. O VPoint lida com
// folha de pagamento, atestados e dados de saúde — um cache no aparelho do
// colaborador seria cópia desses dados fora do nosso controle, e sobreviveria
// ao logout. Então toda requisição vai para a rede, sempre.
//
// O que este arquivo entrega é o que a instalação exige (um fetch handler) e
// uma coisa útil: quando a rede cai, uma página de aviso decente em vez do
// dinossauro do navegador.

const VERSAO = 'vpoint-v1';
const CASCA = '/offline.html';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSAO).then(c => c.add(CASCA)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST/PUT/DELETE passam direto
  if (new URL(req.url).origin !== self.location.origin) return;

  // A API nunca é servida de cache: dado velho aqui é dado errado na tela.
  if (new URL(req.url).pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req).catch(() =>
      req.mode === 'navigate'
        ? caches.match(CASCA)
        : new Response('', { status: 504, statusText: 'Sem conexão' })
    )
  );
});
