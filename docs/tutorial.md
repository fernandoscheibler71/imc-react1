# Tutorial do zero: IMC React + Supabase + Google + Stripe + Vercel

## 0. O que está incluído

Este ZIP já é um projeto Vite/React completo. Não execute `npm create vite` e não substitua arquivos manualmente. A pasta contém `src/` (interface), `public/icon.svg` (ícone), `supabase/schema.sql` (banco e permissões), `api/checkout.js` e `api/webhook.js` (funções de servidor Vercel), `.env.example` (nomes das variáveis), `package.json`, `index.html`, `.gitignore` e `vercel.json`. Não há `node_modules`: será instalado pelo npm.

A publicidade é somente visual, sem anúncios reais. Usuários anônimos podem calcular IMC, mas nenhum cálculo é enviado ao banco. Usuários autenticados salvam automaticamente cada cálculo e visualizam até 100 registros recentes. As assinaturas são recorrentes e processadas pelo Stripe em modo de teste. O acesso sem anúncios depende da confirmação do webhook Stripe, nunca de um parâmetro no navegador.

## 1. Preparar o computador

Instale Node.js LTS compatível com Vite 6 (Node 18 ou superior; preferencialmente Node 20/22) em https://nodejs.org/. Instale Git em https://git-scm.com/downloads. No Terminal execute:

```bash
node -v
npm -v
git --version
```

Se `node -v` indicar 16 ou inferior, atualize o Node antes de continuar. Não use `sudo npm install`.

## 2. Extrair e executar

Baixe o ZIP, extraia e abra a pasta `imc-react` no Terminal. Exemplo:

```bash
cd caminho/para/imc-react
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`. O cálculo e os anúncios demonstrativos funcionam sem configurar serviços. Login e histórico dependem do Supabase; pagamentos dependem também das funções de servidor.

## 3. Criar o projeto Supabase

1. Acesse https://supabase.com/dashboard e crie conta ou entre.
2. Clique **New project**, escolha organização, nome `imc-react`, região e senha forte do banco. Aguarde o provisionamento.
3. No painel, abra **SQL Editor**, clique **New query** e cole TODO o conteúdo de `supabase/schema.sql`. Clique **Run** uma única vez. O SQL cria `profiles` e `bmi_records`, políticas RLS, índice e trigger de perfil.
4. Em **Project Settings > API** (ou **Connect / API Keys**, conforme a interface), copie a **Project URL** e a chave pública **anon/publishable**. Nunca use a service role no frontend.
5. Na pasta do projeto copie `.env.example` para `.env.local`. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores públicos. Preencha também `SUPABASE_URL` com a mesma URL.
6. Reinicie `npm run dev` depois de editar o `.env.local`.

O banco aplica RLS: cada usuário só pode ler e inserir seus próprios registros. Não existe política de alteração do plano pelo cliente; somente a função de servidor com service role pode atualizá-lo. A service role ignora RLS: mantenha-a exclusivamente nas variáveis de ambiente do servidor.

## 4. Configurar Google OAuth

1. Acesse https://console.cloud.google.com/, crie ou selecione um projeto.
2. Configure **Google Auth Platform > Branding** (nome, contato e domínio, conforme exigido). Em **Audience**, selecione público externo e adicione usuários de teste enquanto o aplicativo estiver em modo de teste.
3. Em **Clients**, crie um **OAuth Client ID** do tipo **Web application**.
4. Em **Authorized redirect URIs**, adicione exatamente `https://SEU-PROJETO.supabase.co/auth/v1/callback` (copie a URL de callback mostrada no provedor Google do Supabase). O callback é do Supabase, não `/` do React.
5. Copie Client ID e Client Secret. No Supabase abra **Authentication > Providers > Google**, habilite o provedor e cole os dois valores. Salve.
6. Em **Authentication > URL Configuration**, defina `Site URL` inicialmente como `http://localhost:5173`; inclua `http://localhost:5173/**` em **Redirect URLs**. Posteriormente inclua `https://SEU-DOMINIO.vercel.app/**` e atualize a Site URL para produção.
7. Clique **Entrar com Google** no aplicativo e conclua o login. Em **Table Editor > profiles** confirme a criação do perfil. Calcule um IMC e confira a linha em `bmi_records`.

Se o Google informar `redirect_uri_mismatch`, confira o callback do Supabase, letra por letra. Se o usuário não conseguir entrar durante a fase de testes, confira a lista de usuários de teste no Google Cloud.

## 5. Configurar Stripe em modo de teste

1. Entre em https://dashboard.stripe.com/ e ative **Test mode** / ambiente de teste. Nunca misture chaves `sk_test` com preços de produção.
2. Em **Product catalog**, crie o produto `Meu IMC sem anúncios`.
3. Crie dois preços **recorrentes** em BRL: mensal de **R$ 4,90** (intervalo mês) e anual de **R$ 34,90** (intervalo ano). Copie os IDs `price_...` para `STRIPE_PRICE_MONTHLY` e `STRIPE_PRICE_YEARLY`.
4. Em **Developers > API keys**, copie a chave secreta de teste `sk_test_...` para `STRIPE_SECRET_KEY` no ambiente do servidor. Nunca use prefixo `VITE_` nessa chave.
5. No Supabase, copie a chave **service_role/secret** para `SUPABASE_SERVICE_ROLE_KEY` SOMENTE no ambiente do servidor Vercel. Não compartilhe esse arquivo.
6. Após publicar no Vercel, no Stripe configure um destino de eventos webhook para `https://SEU-DOMINIO.vercel.app/api/webhook`. Selecione `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
7. Copie o **signing secret** do webhook `whsec_...` para `STRIPE_WEBHOOK_SECRET` no Vercel. Ele é diferente da chave API.
8. Configure `PUBLIC_SITE_URL` com a URL HTTPS do Vercel, sem barra final.
9. Faça novo deploy para carregar as variáveis.

### Testar a cobrança

Entre com Google, clique no plano mensal ou anual, conclua o Stripe Checkout com um cartão de teste oficial (ex.: `4242 4242 4242 4242`, validade futura e CVC fictício). Confira em **Stripe > Events** se o webhook recebeu o evento e respondeu HTTP 200. No Supabase verifique `profiles.plan` e `plan_expires_at`. Recarregue a página: os anúncios devem desaparecer.

**Importante:** este projeto demonstra o checkout e sincronização básica do status. Não inclui portal de cancelamento, cobrança de impostos, e-mails transacionais, gestão completa de falhas de pagamento, proteção contra reordenação de webhooks nem conciliação financeira. Não venda assinaturas reais antes de implementar e testar esses pontos. Para testar alterações de assinatura e expiração, use eventos reais de teste no Stripe, não altere manualmente o plano no frontend.

## 6. Publicar na Vercel

1. Crie conta em https://github.com e em https://vercel.com (pode usar login GitHub).
2. No Terminal, dentro de `imc-react`, execute:

```bash
git init
git add .
git commit -m "Primeira versão do IMC"
```

3. Crie um repositório vazio no GitHub, por exemplo `imc-react`, sem README inicial. Siga a URL fornecida pelo GitHub:

```bash
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/imc-react.git
git push -u origin main
```

4. Na Vercel clique **Add New > Project**, importe esse repositório GitHub. Framework **Vite**, build `npm run build`, output `dist`.
5. Em **Settings > Environment Variables**, adicione `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`. Os dois `VITE_` são públicos; os demais são privados do servidor. Use valores de teste do Stripe.
6. Clique **Deploy**. Copie a URL definitiva `https://...vercel.app`. Atualize `PUBLIC_SITE_URL` com ela e faça redeploy.
7. Volte ao Supabase **Authentication > URL Configuration**, inclua a URL do Vercel nas URLs permitidas e defina a URL principal. No Google Cloud, se solicitado para branding/domínio, registre o domínio público, mas mantenha o callback OAuth apontando ao Supabase.
8. Configure o webhook Stripe com a URL definitiva. Confira o segredo `whsec_...` correspondente ao destino e faça redeploy se necessário.
9. Teste, nesta ordem: IMC anônimo; login Google; IMC logado; histórico após recarregar; Checkout mensal; webhook; anúncios ocultos; checkout anual com outra conta; atualização/cancelamento de assinatura pelo painel Stripe.

## 7. Teste local das funções de pagamento

`npm run dev` inicia apenas o Vite: ele **não** executa `/api/checkout` nem `/api/webhook`. Para testar pagamentos localmente, instale a CLI da Vercel (`npm install -g vercel`), autentique com `vercel login`, associe o projeto com `vercel link`, carregue variáveis locais de desenvolvimento e execute `vercel dev` (porta normalmente 3000). Para receber webhooks locais, use a Stripe CLI oficial e `stripe listen --forward-to localhost:3000/api/webhook`; o segredo `whsec_...` exibido por essa sessão deve ser configurado no ambiente local do servidor. A alternativa mais simples para iniciantes é testar os pagamentos diretamente no deploy de teste Vercel.

## 8. Solução de problemas

- **Tela branca:** abra o Console do navegador, confira `npm install` e execute `npm run build` para encontrar erros.
- **Login não funciona:** verifique URL e chave pública Supabase, provedor Google, callback e Redirect URLs.
- **Histórico não salva:** execute SQL, confirme usuário autenticado e inspecione políticas RLS.
- **Checkout retorna 404 no localhost:5173:** use `vercel dev` ou a implantação Vercel; Vite sozinho não hospeda as funções API.
- **Checkout retorna 500:** confira logs da função Vercel e as variáveis secretas e IDs dos preços.
- **Assinatura paga mas banners continuam:** verifique Stripe Events, URL e assinatura do webhook, registro `profiles` e recarregue a página.
- **Nunca comite `.env.local`:** já está no `.gitignore`. Se uma chave secreta vazar, revogue-a imediatamente.

## 9. Observações de segurança e produto

O cálculo é informativo, não diagnóstico. A classificação usa faixas usuais de IMC de adultos. O histórico contém dados de saúde e merece política de privacidade, retenção, exclusão e avaliação de conformidade com a LGPD antes de operação pública. O exemplo não implementa exclusão de conta nem portal de cancelamento; esses são requisitos antes de produção comercial. Preços apresentados na interface são valores de demonstração definidos neste projeto, e o preço efetivo cobrado será aquele configurado no Stripe.
