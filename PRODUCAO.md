# Colocar o Guia Mão de Obra no ar — passo a passo

Checklist do que **você** precisa fazer (o código já está pronto). Siga na ordem. Tempo estimado: 40–60 min.

> Sempre que aparecer `guiadamaodeobra`, é o ID do seu projeto Firebase.

---

## 0. O que você precisa ter

- [ ] Computador com **Node.js 22** ([nodejs.org](https://nodejs.org)) e **Git**
- [ ] Acesso ao [Console do Firebase](https://console.firebase.google.com) do projeto `guiadamaodeobra`
- [ ] Conta no **Mercado Pago** (conta de vendedor)
- [ ] Uma conta **Gmail** com verificação em 2 etapas ativa (para enviar os e-mails automáticos)
- [ ] Um **cartão de crédito** para ativar o plano Blaze do Firebase (tem cota grátis; você só paga se passar dela)

---

## 1. Baixar o projeto

```bash
git clone -b claude/focused-edison-ku8tqe https://github.com/maxgfortes/guiadamaodeobra.git
cd guiadamaodeobra
cd functions && npm install && cd ..
```

---

## 2. Firebase (console)

1. [ ] **Plano Blaze**: ⚙️ → *Uso e faturamento* → *Detalhes e configurações* → *Modificar plano* → **Blaze**.
   Obrigatório para as Cloud Functions e para conversar com o Mercado Pago.
   Dica: crie um **alerta de orçamento** (ex.: R$ 50) na mesma tela.
2. [ ] **Authentication** → *Começar* → *Sign-in method* → **Google** → Ativar → escolha o e-mail de suporte → *Salvar*.
3. [ ] **Firestore Database** → *Criar banco de dados* → local **southamerica-east1 (São Paulo)** → modo **produção**.
   (Se já criou antes, pule.)
4. [ ] **Storage** → *Começar* → modo **produção** → mesma região.

---

## 3. Mercado Pago

1. [ ] Entre em <https://www.mercadopago.com.br/developers/panel/app> → **Criar aplicação**
   → tipo *Pagamentos online* → produto **Checkout Transparente / Bricks**.
2. [ ] Em **Credenciais de produção**, preencha os dados do negócio para liberar as credenciais.
   Anote:
   - **Public Key** (começa com `APP_USR-…`) → vai no site
   - **Access Token** (começa com `APP_USR-…`) → é **secreto**, vai só no servidor
3. [ ] Abra `public/js/firebase-config.js` e troque:
   ```js
   mercadoPagoPublicKey: 'YOUR_MP_PUBLIC_KEY',
   ```
   pela sua Public Key.
4. [ ] **Webhook**: no painel da aplicação → *Webhooks* → *Configurar notificações*
   - URL (modo produção): `https://guiadamaodeobra.web.app/api/mp-webhook`
   - Evento: **Pagamentos**
   - Salve e copie a **assinatura secreta** (clique em *revelar*).

> 💡 Quer testar antes sem cobrar de verdade? Faça o passo 9 com as **credenciais de teste** primeiro.

---

## 4. Senha de app do Gmail (para os e-mails)

1. [ ] Acesse <https://myaccount.google.com/apppasswords>
2. [ ] Crie uma senha de app chamada "Guia Mão de Obra" e copie os **16 caracteres**.

---

## 5. Ajustar os preços dos planos

Os valores atuais (R$ 29,90 / 79,90 / 149,90 / 269,90) são sugestões. Edite **os dois arquivos** com os mesmos valores:

- [ ] `functions/src/plans.js` → é o valor que **realmente é cobrado**
- [ ] `public/js/data/plans.js` → é o valor **mostrado** na tela

---

## 6. Guardar os segredos no Firebase

No terminal, dentro da pasta do projeto:

```bash
npx firebase-tools login
npx firebase-tools functions:secrets:set MP_ACCESS_TOKEN     # cole o Access Token do Mercado Pago
npx firebase-tools functions:secrets:set MP_WEBHOOK_SECRET   # cole a assinatura secreta do webhook
npx firebase-tools functions:secrets:set SMTP_PASS           # cole a senha de app do Gmail (16 letras)
```

---

## 7. Publicar (deploy)

```bash
npx firebase-tools deploy
```

Na **primeira vez** ele faz algumas perguntas — responda assim:

| Pergunta | Resposta |
| --- | --- |
| `APP_URL` | `https://guiadamaodeobra.web.app` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | seu Gmail (ex.: `voce@gmail.com`) |
| `MAIL_FROM` | `Guia Mão de Obra <voce@gmail.com>` |
| `ADMIN_EMAILS` | e-mails que serão administradores, separados por vírgula (ex.: `voce@gmail.com`) |

- Se perguntar para **ativar APIs** (Cloud Build, Artifact Registry, Secret Manager, Cloud Scheduler…), aceite.
- Se o primeiro deploy das functions falhar com erro de permissão, espere **5 minutos** e rode de novo (o Google ainda está liberando as APIs).
- As respostas ficam salvas em `functions/.env.guiadamaodeobra` (não contém segredos).

Ao terminar, o site estará em **https://guiadamaodeobra.web.app** 🎉

> Os **índices** do Firestore levam alguns minutos para ficar prontos. Se a lista de profissionais der erro logo após o deploy, aguarde 5–10 min.

---

## 8. Virar administrador e configurar a home

1. [ ] Abra **https://guiadamaodeobra.web.app/admin.html** e entre com o Google usando um e-mail que está em `ADMIN_EMAILS`.
   O acesso de admin é liberado automaticamente no primeiro login.
2. [ ] Aba **Banners** → *Novo banner* → envie a imagem (formato largo **1600×640 px**) ou cole a URL dela → coloque o **link** (abre em nova aba) → *Salvar*.
   Sem banners ativos, o carrossel simplesmente não aparece.
3. [ ] Para dar acesso a outra pessoa: aba **Admins** → e-mail → *Tornar admin* (ela precisa ter entrado no site uma vez).

---

## 9. Testar um pagamento

### Com credenciais de teste (recomendado antes de abrir ao público)

1. Use a **Public Key de teste** no `firebase-config.js` e rode
   `npx firebase-tools functions:secrets:set MP_ACCESS_TOKEN` com o **Access Token de teste**.
   Depois: `npx firebase-tools deploy`.
2. Cadastre-se em `/signup.html` com uma conta Google, preencha o perfil, escolha um plano e pague com um **cartão de teste**:

| Campo | Valor |
| --- | --- |
| Cartão Mastercard | `5031 4332 1540 6351` |
| Cartão Visa | `4235 6477 2802 5682` |
| Validade / CVV | `11/30` / `123` |
| CPF | `12345678909` |
| Nome no cartão | `APRO` → aprovado · `OTHE` → recusado · `CONT` → pendente · `FUND` → saldo insuficiente |

> Lista oficial atualizada: [cartões de teste do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/test/cards).
> Se der erro de e-mail, use um e-mail diferente do da sua conta Mercado Pago.

3. Confira:
   - [ ] **APRO** → tela "Perfil no ar!", perfil aparece na busca e chega o e-mail de pagamento aprovado
   - [ ] **OTHE** / **FUND** → mensagem com o motivo e e-mail de falha
   - [ ] No admin → **Pagamentos**, os pagamentos aparecem

### Virar para produção

4. [ ] Troque para a **Public Key de produção** no `firebase-config.js`
5. [ ] `npx firebase-tools functions:secrets:set MP_ACCESS_TOKEN` com o **Access Token de produção**
6. [ ] `npx firebase-tools deploy`
7. [ ] Faça um pagamento real de 1 mês com seu cartão e, se quiser, estorne pelo painel do Mercado Pago (o perfil é desativado automaticamente no estorno).

---

## 10. (Opcional) Domínio próprio

1. Firebase → **Hosting** → *Adicionar domínio personalizado* → siga as instruções de DNS.
2. Firebase → **Authentication** → *Configurações* → *Domínios autorizados* → adicione o domínio.
3. Atualize `APP_URL` em `functions/.env.guiadamaodeobra` e a **URL do webhook** no Mercado Pago para o novo domínio.
4. `npx firebase-tools deploy`

---

## Atualizações futuras

Sempre que mudar algo no código:

```bash
git pull
npx firebase-tools deploy                 # tudo
npx firebase-tools deploy --only hosting  # só o site (mais rápido)
```

---

## Problemas comuns

| Sintoma | Solução |
| --- | --- |
| "Pagamentos ainda não configurados" | Falta a Public Key no `firebase-config.js` (passo 3.3) + deploy |
| Login Google: `auth/unauthorized-domain` | Adicione o domínio em Authentication → Domínios autorizados |
| Lista de profissionais com erro logo após o deploy | Índices do Firestore ainda criando — aguarde alguns minutos |
| Pagou mas o perfil não ativou | Admin → Pagamentos (status). Firebase → Functions → Logs de `mpWebhook`. Confira a URL e o segredo do webhook |
| Webhook com erro 401 nos logs | `MP_WEBHOOK_SECRET` diferente da assinatura do painel — refaça o passo 6 e o deploy |
| E-mails não chegam | Confira `SMTP_USER` e a senha de app (passo 4). Veja os logs da function (procure "E-mail failed") e a caixa de spam |
| Não consigo entrar no admin | Seu e-mail precisa estar em `ADMIN_EMAILS` (`functions/.env.guiadamaodeobra`) — edite e rode `npx firebase-tools deploy --only functions` |

---

## Como o sistema funciona (resumo)

- O profissional se cadastra → perfil fica **invisível** até pagar.
- Pagamento aprovado → perfil **liberado na hora** pelo tempo do plano (1, 3, 6 ou 12 meses) + e-mail.
- Pagamento recusado → e-mail com o motivo.
- 3 dias antes de vencer → e-mail de lembrete. Venceu → perfil sai das buscas + e-mail.
- Renovar antes de vencer **soma** o tempo restante.
- Tudo isso roda sozinho nas Cloud Functions (incluindo a verificação de hora em hora).
