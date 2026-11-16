# Publicação do LusoAncestry na Cloudflare

O Cloudflare Pages serve a landing e o build do editor Vite. Uma Pages Function
encaminha `/api/*` pelo Cloudflare Tunnel até o FastAPI. No navegador, a landing,
o login, o cadastro e a API usam o mesmo endereço HTTPS. O Supabase continua
responsável pela autenticação, pelo banco e pelo armazenamento de imagens.

## Cloudflare Pages e GitHub

Em **Workers & Pages**, crie um projeto **Pages** com integração Git. O repositório
`origin` deste workspace redireciona do nome antigo `lunavoy/teste` para
`lunavoy/HCR-Luso-Ancestry`. Use uma branch dedicada para preservar a landing
existente no GitHub Pages.

| Campo | Valor |
| --- | --- |
| Repositório deste workspace | `lunavoy/HCR-Luso-Ancestry` |
| Branch de produção | `codex/cloudflare-pages` |
| Diretório raiz | `app/frontend` |
| Comando de build | `npm run build:pages` |
| Diretório de saída | `dist` |
| Variável de build `NODE_VERSION` | `24` |

O build copia a landing de `site/` para `dist/site/`. A raiz redireciona para
`/site/`. O Pages serve o React para navegação direta em `/login`,
`/cadastro` e nas rotas do editor. Defina o domínio oficial em
**Custom domains** antes de configurar os redirecionamentos de autenticação.

[Integração Git do Pages](https://developers.cloudflare.com/pages/get-started/git-integration/)
· [Domínios do Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## FastAPI e Tunnel

Mantenha o FastAPI na máquina que tem o ambiente Python e o Kraken configurados.
Na raiz do projeto, inicie-o com o script existente:

```powershell
scripts\start-backend.cmd
```

Ele usa `.venv\Scripts\python.exe` e escuta em `127.0.0.1:8000`. Em outro
terminal, confira `Invoke-RestMethod http://127.0.0.1:8000/health`.

No painel da Cloudflare, crie um Tunnel gerenciado e siga o comando de
instalação para Windows oferecido pelo painel na máquina do FastAPI. Adicione
um hostname dedicado à API em um domínio da sua conta Cloudflare. Aponte o
serviço HTTP do hostname para `http://127.0.0.1:8000`. O hostname do túnel e o
domínio oficial do Pages precisam ser distintos.

Em **Settings → Variables and Secrets**, defina `FASTAPI_ORIGIN` no ambiente de
produção do Pages como a origem HTTPS do túnel, por exemplo
`https://api.seudominio.com`. Se proteger o hostname com uma política Cloudflare
Access do tipo **Service Auth**, configure também `CF_ACCESS_CLIENT_ID` e
`CF_ACCESS_CLIENT_SECRET` como segredos da Function. A Function encaminha o
token Supabase do usuário e o FastAPI continua aplicando as permissões.

O editor e a API dependem de o FastAPI e o conector do Tunnel estarem rodando.
Para o site oficial, mantenha ambos em uma máquina sempre ligada e com
reinício automático. A landing estática continua disponível se o backend cair.

[Instalação do Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
· [Variáveis das Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/)
· [Tokens de serviço do Access](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

## Supabase e verificação

Em **Authentication → URL Configuration**, use o domínio oficial como
`Site URL` e inclua a URL HTTPS oficial terminada em `/login` na lista de
redirecionamentos. Mantenha o cadastro por e-mail habilitado e confira as
migrações do projeto. As credenciais privadas do Supabase permanecem no
ambiente do FastAPI.

1. Abra o domínio do Pages. Confira a landing, suas imagens e **Entrar no aplicativo**.
2. Consulte `/api/auth/config` e confirme que `/api/workspace` devolve 401 sem sessão.
3. Crie uma conta de teste em `/cadastro`, confirme o e-mail e entre pelo domínio oficial.
4. Como Videira, abra uma imagem de teste, edite um polígono e faça uma correção
   rápida de linha. Salve, recarregue a página e confirme que as edições persistiram.
   Confira no painel de Administração se o histórico atribuiu as edições à conta.
5. Em uma página de teste, confirme a segmentação do Kraken com uma conta
   administradora. Depois abra as linhas geradas no fluxo de correção rápida.

[Redirecionamentos do Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls)
