# Nginx

Padrão de configuração de reverse proxy e serving que o agente DevOps aplica ao gerar ou ajustar `nginx.conf`/`server` blocks reais. O critério central: **o proxy termina TLS moderno, repassa a identidade real do cliente ao upstream, serve estático com cache e não vaza versão nem deixa rota de auth sem freio.** O `specs/DEPLOY.md` do projeto fixa hosts, upstreams, rotas SPA×API e a origem dos certificados.

## Princípios

1. **Identidade do cliente é repassada.** Atrás do proxy, o upstream precisa do host e do IP real. `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto` são obrigatórios — sem eles a app loga o IP do proxy e gera links `http` atrás de TLS.
2. **Conexão ao upstream é reutilizada.** `upstream` com `keepalive` e HTTP/1.1 (`proxy_http_version 1.1`, `Connection ""`) evita abrir/fechar socket por request sob carga.
3. **TLS é obrigatório e moderno.** Porta 80 só redireciona para 443; apenas TLS 1.2+; certificados emitidos e renovados automaticamente (ACME/certbot), nunca à mão com validade esquecida.
4. **O servidor não se anuncia.** `server_tokens off` e cabeçalhos de segurança em toda resposta reduzem superfície e fingerprinting.
5. **Limites são conscientes.** `client_max_body_size` casa com o maior upload legítimo; timeouts de proxy são explícitos; rotas de autenticação têm rate limiting para conter brute-force e enumeração.
6. **Estático é servido pelo Nginx, dinâmico vai ao upstream.** SPA resolve rota no cliente (`try_files → index.html`) com cache em assets versionados; API é `proxy_pass`. Nginx não deve proxiar o que pode servir do disco.
7. **WebSocket faz upgrade explícito.** Onde há WS/SSE, os headers `Upgrade`/`Connection` são propagados — senão a conexão cai no handshake.
8. **Log serve para operar.** O formato inclui `upstream_response_time` (e status do upstream) para separar latência da app da latência de rede.
9. **Nunca recarrega às cegas.** `nginx -t` valida a sintaxe antes de todo `reload`; um `server` block quebrado jamais chega a derrubar o proxy que está no ar.
10. **Erro não vira vitrine.** Páginas de erro e respostas de upstream indisponível não expõem versão, caminho interno ou stack; o cliente vê uma resposta controlada, não o mapa da infraestrutura.

## Regras verificáveis

- [ ] NGX-01: Todo `location` que faz proxy define `proxy_set_header Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto`
- [ ] NGX-02: Bloco `upstream` com `keepalive N`; proxy usa `proxy_http_version 1.1` e `proxy_set_header Connection ""`
- [ ] NGX-03: Porta 80 apenas redireciona para HTTPS (`return 301 https://...`); nenhum conteúdo servido em texto claro
- [ ] NGX-04: `ssl_protocols` restrito a TLS 1.2 e 1.3 (sem SSLv3/TLS 1.0/1.1); cifras modernas configuradas
- [ ] NGX-05: Certificados emitidos/renovados por automação (ACME/certbot) — renovação verificável, não manual
- [ ] NGX-06: `server_tokens off` definido
- [ ] NGX-07: `gzip on` (ou brotli) habilitado para tipos texto (`text/*`, `application/json`, `application/javascript`, `text/css`) — não para binários já comprimidos
- [ ] NGX-08: `client_max_body_size` definido de forma consciente ao maior upload legítimo (não o default de 1M silencioso, nem ilimitado)
- [ ] NGX-09: Timeouts de proxy explícitos (`proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout`)
- [ ] NGX-10: Rotas de autenticação (`/login`, `/token`, recuperação de senha) sob `limit_req` com zona dedicada
- [ ] NGX-11: Cabeçalhos de segurança presentes: `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`, `X-Frame-Options` (ou CSP `frame-ancestors`)
- [ ] NGX-12: SPA usa `try_files $uri $uri/ /index.html`; assets versionados com `Cache-Control` longo (`immutable`); `index.html` sem cache agressivo
- [ ] NGX-13: WebSocket/SSE (quando aplicável) propaga `Upgrade` e `Connection` no `location` correspondente
- [ ] NGX-14: `log_format` inclui `$upstream_response_time` (e `$upstream_status`) e é aplicado no `access_log`
- [ ] NGX-15: Toda alteração é validada com `nginx -t` antes do `reload`; o fluxo de deploy do proxy inclui esse passo
- [ ] NGX-16: Respostas de erro (4xx/5xx e upstream indisponível) não expõem versão/stack/caminho interno; `error_page` controlado quando aplicável

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer |
|---|---|---|
| Proxy sem `X-Forwarded-*`/`Host` | App loga IP do proxy; gera URL `http` atrás de HTTPS; rate limit por IP inútil | Repassar Host/X-Real-IP/X-Forwarded-For/Proto (NGX-01) |
| Upstream sem keepalive | Socket novo por request; latência e esgotamento de portas sob carga | `upstream ... keepalive` + HTTP/1.1 (NGX-02) |
| Servir conteúdo na porta 80 | Tráfego em texto claro; downgrade | 80 só redireciona 301 para 443 (NGX-03) |
| Certificado renovado "na mão" | Expira num feriado; site fora do ar | Automação ACME/certbot (NGX-05) |
| `server_tokens on` (default) | Versão exata do Nginx exposta ao atacante | `server_tokens off` (NGX-06) |
| Proxiar o SPA inteiro pelo Node | Node vira servidor de arquivo estático; desperdício e lentidão | Nginx serve estático; só API vai ao upstream (NGX-12) |
| Login sem rate limit | Brute-force e enumeração de credenciais livres | `limit_req` na zona de auth (NGX-10) |
| `client_max_body_size` no default | Upload legítimo estoura em 413 silencioso | Dimensionar ao maior upload real (NGX-08) |
| `reload` sem `nginx -t` antes | Config quebrada derruba o proxy no ar | Validar sintaxe antes de recarregar (NGX-15) |
| Página de erro com stack/versão do backend | Entrega reconhecimento de graça ao atacante | `error_page` controlado, sem vazar interno (NGX-16) |

## Exemplo esquemático (server block)

```nginx
upstream api { server 127.0.0.1:3001; keepalive 32; }
server {
  listen 443 ssl http2;
  server_name app.exemplo.com;
  ssl_protocols TLSv1.2 TLSv1.3;
  server_tokens off;
  add_header Strict-Transport-Security "max-age=63072000" always;
  add_header X-Content-Type-Options nosniff always;
  location /api/ {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://api;
  }
  location / { root /var/www/app; try_files $uri $uri/ /index.html; }
}
```

## Como o plano de deploy especializa

O `specs/DEPLOY.md` do projeto deve definir concretamente:

- Os hostnames/server_names por ambiente e o mapa de rotas: quais caminhos são SPA estática (`root` + `try_files`) e quais são `proxy_pass` para qual upstream/porta
- Os upstreams reais (endereço, porta, número de instâncias, valor de `keepalive`) e a política de timeout adequada às rotas lentas do projeto
- A origem e o mecanismo de renovação dos certificados (certbot standalone/webroot, ACME do provedor, TLS terminado num load balancer gerenciado)
- O `client_max_body_size` correto para os uploads reais da feature e as zonas de `limit_req` (quais rotas, qual taxa)
- Se há WebSocket/SSE no projeto e em quais `location` o upgrade deve ser propagado
