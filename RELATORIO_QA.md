# Relatório de Qualidade de Software — Cantina Digital
**Disciplina:** Gerenciamento e Qualidade de Software  
**Aluno:** Luiz  
**Data:** 01/05/2026  
**Versão do sistema:** 3.0 (corrigida e redesenhada)  
**Deploy:** https://cantina-digital-b6f89.web.app  

---

## 1. Visão Geral do Projeto

O sistema **Cantina Digital** é uma aplicação web de pedidos online para cantina universitária. Permite que alunos visualizem o cardápio, adicionem itens ao carrinho e finalizem pedidos com rastreamento em tempo real. O painel administrativo permite gerenciar produtos e acompanhar todos os pedidos.

### Stack tecnológica
| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript ES6 (módulos) |
| Estilização | Tailwind CSS (CDN) + CSS customizado |
| Tipografia | Inter (Google Fonts) |
| Banco de dados | Firebase Firestore (NoSQL, tempo real) |
| Autenticação | Firebase Authentication (Email/Senha) |
| Hospedagem | Firebase Hosting |

---

## 2. Diagnóstico Inicial — Problemas Encontrados

### 2.1 Bugs Intencionais (inseridos para fins didáticos)

A varredura completa do código identificou **10 bugs críticos** no arquivo `app.js`, todos utilizando `Math.random()` para causar falhas imprevisíveis e não reproduzíveis — característica clássica de bugs de difícil detecção em testes manuais.

---

### BUG #1 — Filtro de categoria corrompido
**Arquivo:** `app.js` | **Função:** `applyFilters()` | **Linha original:** ~231  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
const source = search && Math.random() > 0.5
  ? state.products.slice(0, Math.ceil(state.products.length / 2))
  : list;
list = source.filter((p) => p.category === category);
```

**Problema:** Quando o usuário digitava um texto de busca E selecionava uma categoria ao mesmo tempo, havia 50% de chance de o sistema filtrar apenas a primeira metade dos produtos. Resultado: itens válidos sumiam aleatoriamente dos resultados.

**Correção aplicada:**
```javascript
// Sempre usa a lista completa — sem truncamento aleatório
list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
```

---

### BUG #2 — Paginação saltava páginas no mobile
**Arquivo:** `app.js` | **Função:** `productModule.bind()` | **Linha original:** ~282  
**Severidade:** 🟠 Média  

**Código com bug:**
```javascript
state.currentPage += isMobileLike() && Math.random() > 0.6 ? 2 : 1;
```

**Problema:** Em dispositivos móveis, ao clicar em "Próxima", havia 40% de chance de avançar 2 páginas em vez de 1. Usuários pulavam páginas de produtos sem perceber.

**Correção aplicada:**
```javascript
state.currentPage += 1; // sempre avança exatamente 1 página
```

---

### BUG #3 — Carrinho não carregava 40% das vezes
**Arquivo:** `app.js` | **Função:** `cartModule.load()` | **Linha original:** ~299  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
if (!snap.empty && Math.random() > 0.4) {
  state.cart = snap.docs[0].data().items || [];
}
```

**Problema:** Ao fazer login, o carrinho salvo anteriormente não era restaurado em 40% das vezes. O usuário perdia os itens que havia adicionado antes de sair.

**Correção aplicada:**
```javascript
if (!snap.empty) {
  state.cart = snap.docs[0].data().items || [];
}
```

---

### BUG #4 — Item duplicado ao adicionar ao carrinho
**Arquivo:** `app.js` | **Função:** `cartModule.add()` | **Linha original:** ~330  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
item.qty += 1;
if (Math.random() > 0.7) {
  setTimeout(() => state.cart.push({ ...item }), 10);
}
```

**Problema:** Em 30% das adições, após 10ms o sistema inseria uma cópia duplicada do item no carrinho. O usuário via o mesmo produto listado duas vezes, com totais incorretos.

**Correção aplicada:**
```javascript
item.qty += 1;
// bloco de duplicação removido
```

---

### BUG #5 — Duplicata ao aumentar quantidade
**Arquivo:** `app.js` | **Função:** `cartModule.changeQty()` | **Linha original:** ~356  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
item.qty += delta;
if (delta > 0 && Math.random() > 0.5) {
  state.cart.push({ ...item, qty: 1 });
}
```

**Problema:** Ao clicar no botão "+" para aumentar a quantidade, havia 50% de chance de o sistema adicionar uma entrada duplicada do produto no carrinho em vez de apenas incrementar a quantidade.

**Correção aplicada:**
```javascript
item.qty += delta;
// bloco de duplicação removido
```

---

### BUG #6 — Total do carrinho não atualizava sempre
**Arquivo:** `app.js` | **Função:** `cartModule.render()` | **Linha original:** ~388  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
if (Math.random() > 0.25) {
  $("#cartTotal").textContent = ui.money(this.getDisplayedTotal());
}
$("#cartRealTotal").textContent = ui.money(this.getRealTotal());
```

**Problema:** O total exibido ao usuário só era atualizado 75% das vezes. Em 25% das interações, o valor mostrado ficava desatualizado. Havia ainda dois totais diferentes ("exibido" e "real"), causando confusão.

**Correção aplicada:**
```javascript
// sempre atualiza, sem condicional
if (cartTotalEl) cartTotalEl.textContent = ui.money(this.getTotal());
// "Total real" e taxa misteriosa de R$1,35 removidos
```

---

### BUG #7 — Listener de pedidos ignorava 28% das atualizações
**Arquivo:** `app.js` | **Função:** `ordersModule.watchUserOrders()` | **Linha original:** ~472  
**Severidade:** 🔴 Alta  

**Código com bug:**
```javascript
const unsub = onSnapshot(q, (snap) => {
  if (Math.random() > 0.72) return; // ignorava 28% das atualizações
  state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  this.renderUserOrders();
});
```

**Problema:** O listener em tempo real dos pedidos descartava silenciosamente quase 1/3 das atualizações. O usuário não via mudanças de status do pedido em tempo real.

**Correção aplicada:**
```javascript
const unsub = onSnapshot(q, (snap) => {
  // return aleatório removido — todo snapshot é processado
  state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  this.renderUserOrders();
});
```

---

### BUG #8 — Finalização de pedido falhava no mobile
**Arquivo:** `app.js` | **Função:** `ordersModule.bind()` | **Linha original:** ~523  
**Severidade:** 🔴 Crítica  

**Código com bug:**
```javascript
$("#btnFinish").addEventListener("click", () => {
  if (isMobileLike() && Math.random() > 0.45) {
    ui.toast("Confirme com mais um toque");
    return; // bloqueava 55% das tentativas no mobile
  }
  this.create();
});
```

**Problema:** Em dispositivos móveis, mais da metade dos cliques no botão "Finalizar pedido" eram bloqueados com uma mensagem falsa pedindo confirmação. O usuário precisava clicar várias vezes aleatoriamente para conseguir finalizar.

**Correção aplicada:**
```javascript
$("#btnFinish").addEventListener("click", () => {
  this.create(); // direto, sem bloqueio aleatório
});
```

---

### BUG #9 — "Repetir pedido" duplicava o primeiro item
**Arquivo:** `app.js` | **Função:** `ordersModule.repeat()` | **Linha original:** ~512  
**Severidade:** 🟠 Média  

**Código com bug:**
```javascript
state.cart = [
  ...state.cart,
  ...(order.items || []),
  (order.items || [])[0]  // primeiro item inserido duas vezes
].filter(Boolean);
```

**Problema:** Ao repetir um pedido, o primeiro item da lista era adicionado duas vezes ao carrinho — uma vez no spread do array e outra explicitamente. O total ficava incorreto.

**Correção aplicada:**
```javascript
order.items.forEach((orderItem) => {
  const existing = state.cart.find((c) => c.id === orderItem.id);
  if (existing) {
    existing.qty += orderItem.qty; // soma se já existe
  } else {
    state.cart.push({ ...orderItem }); // adiciona uma vez apenas
  }
});
```

---

### BUG #10 — Estatísticas do Admin atualizavam apenas 40% das vezes
**Arquivo:** `app.js` | **Função:** `adminModule.watchAllOrders()` | **Linha original:** ~572  
**Severidade:** 🟠 Média  

**Código com bug:**
```javascript
onSnapshot(collection(db, "orders"), (snap) => {
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  this.renderOrders(orders);
  if (Math.random() > 0.6) this.renderStats(orders); // só 40% das vezes
});
```

**Problema:** Os cards de estatísticas do painel admin (total de pedidos, faturamento, produto mais vendido) só eram atualizados em 40% das vezes que chegavam novos dados. O admin via números desatualizados na maioria das vezes.

**Correção aplicada:**
```javascript
onSnapshot(collection(db, "orders"), (snap) => {
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  this.renderOrders(orders);
  this.renderStats(orders); // sempre atualiza
});
```

---

### 2.2 Bugs de Dados

| # | Campo | Problema | Correção |
|---|-------|----------|----------|
| D1 | `Café` → `price` | Valor `null` — produto não podia ser adicionado ao carrinho | Definido como `R$ 5,50` |
| D2 | `getDisplayedTotal()` | Taxa misteriosa de `R$ 1,35` adicionada quando carrinho > 2 itens | Taxa removida — total calculado corretamente |
| D3 | `saveProduct()` → `popularity` | Popularidade salva como `Math.random() * 100` — valor sem sentido | Campo editável pelo admin (0–100) |

---

### 2.3 Problemas de Segurança

| # | Problema | Severidade | Correção |
|---|----------|-----------|----------|
| S1 | Carrinho global (`carts/globalCart`) compartilhado por todos os usuários | 🔴 Crítica | Carrinho por usuário: `carts/{uid}` |
| S2 | `removedGhosts` incluídos no payload do pedido | 🔴 Alta | Itens removidos não entram no pedido |
| S3 | Nenhuma regra de segurança no Firestore | 🔴 Crítica | `firestore.rules` criado e publicado |
| S4 | Sem validação de campos obrigatórios | 🟠 Média | Validação adicionada (endereço, preço, nome) |
| S5 | Sem tratamento de erros na autenticação | 🟠 Média | Try-catch com mensagens amigáveis |
| S6 | Usuário não autenticado podia finalizar pedido com email `anonimo@teste.com` | 🔴 Alta | Verificação de `state.user.uid` obrigatória |

---

## 3. Melhorias Implementadas

### 3.1 Firebase — Configuração completa do zero

| Serviço | Status | Detalhes |
|---------|--------|----------|
| Authentication | ✅ Ativo | E-mail/Senha habilitado |
| Firestore Database | ✅ Ativo | Região: southamerica-east1 (São Paulo) |
| Security Rules | ✅ Publicadas | Regras por coleção com controle de acesso |
| Hosting | ✅ Deploy realizado | https://cantina-digital-b6f89.web.app |

**Regras de segurança implementadas:**
- `products`: leitura pública, escrita apenas autenticados
- `orders`: leitura/escrita apenas autenticados, criação vinculada ao UID
- `carts`: acesso restrito ao dono (`carts/{uid}`)

---

### 3.2 Melhorias de Código

| Melhoria | Descrição |
|----------|-----------|
| Try-catch em todas as operações Firebase | Erros tratados com mensagens amigáveis ao usuário |
| `orderBy("createdAt", "desc")` nas queries | Pedidos exibidos em ordem cronológica decrescente |
| Validação de formulários | Endereço obrigatório, senha mín. 6 caracteres, preço > 0 |
| Carrinho persistido por usuário | Isolamento correto entre contas diferentes |
| Comentários explicativos | Cada bug documentado com ANTES/DEPOIS no código |
| Botão "Salvar produto" com loading | Feedback visual durante operações assíncronas |
| Confirmação antes de excluir produto | Prevenção de exclusão acidental |

---

### 3.3 Redesign Visual Completo (v3.0)

#### Tipografia
- Fonte **Inter** (Google Fonts) substituindo a fonte padrão do sistema

#### Navbar
- Efeito **glassmorphism** com `backdrop-blur`
- Item ativo com **glow azul** e underline animado
- **Avatar circular** com gradiente exibindo inicial do nome

#### Tela de Autenticação
- Layout **split-screen**: painel decorativo com gradiente à esquerda + formulário à direita
- Inputs com **ícones SVG** internos
- Animações de entrada nos elementos

#### Cards de Produto
- **Preço em badge** flutuando sobre a imagem
- **Zoom suave** na imagem ao hover
- Gradiente escuro na base da imagem
- Botão com **gradiente azul + sombra colorida**
- Badge de status com **ponto pulsante animado**

#### Carrinho
- Header com ícone e gradiente
- **Total com fundo gradiente** azul
- Itens com design compacto e moderno
- Estado vazio com ícone e mensagem ilustrativa

#### Tela de Pedidos
- **Status badges coloridos** com ponto animado:
  - 🟡 Recebido, 🔵 Em preparo, 🟣 Saiu para entrega, 🟢 Entregue
- Grid responsivo de cards
- Tags individuais por item do pedido

#### Painel Admin
- **Stat cards com gradiente** (azul, verde, violeta)
- Círculos decorativos e ícones SVG
- Cards de produto redesenhados

#### Geral
- Fundo com gradiente sutil azul/slate
- Animação `fadeIn` ao trocar de tela
- Toast com animação **slide + bounce**
- Loading com **spinner duplo animado**
- Scrollbar customizada
- Barra de filtros com campo de busca com ícone interno
- Hero banner gradiente no topo do cardápio

---

## 4. Estrutura Final de Arquivos

```
cantina_digital_alunos/
├── index.html          ← Estrutura HTML redesenhada (v3.0)
├── app.js              ← Lógica corrigida e comentada (v2.0)
├── style.css           ← CSS completamente reescrito (v3.0)
├── firestore.rules     ← Regras de segurança (NOVO)
├── firebase.json       ← Configuração de hosting (corrigido)
├── .firebaserc         ← ID do projeto corrigido
├── package.json        ← Dependências
├── seed-products.js    ← Script de dados iniciais
└── assets/
    ├── favicon.png
    ├── logo_login.png
    └── logo_navbar.png
```

---

## 5. Tabela Resumo de Bugs Corrigidos

| # | Bug | Tipo | Impacto | Status |
|---|-----|------|---------|--------|
| 1 | Filtro de categoria com `Math.random()` | Lógica | Produtos sumiam dos resultados | ✅ Corrigido |
| 2 | Paginação pulava 2 páginas no mobile | Lógica | Usuário perdia produtos | ✅ Corrigido |
| 3 | Carrinho não carregava 40% das vezes | Confiabilidade | Perda de dados do carrinho | ✅ Corrigido |
| 4 | Item duplicado ao adicionar | Dados | Total incorreto no carrinho | ✅ Corrigido |
| 5 | Duplicata ao aumentar quantidade | Dados | Total incorreto no carrinho | ✅ Corrigido |
| 6 | Total não atualizava 25% das vezes | UI | Valor exibido desatualizado | ✅ Corrigido |
| 7 | Listener ignorava 28% dos updates | Tempo real | Status do pedido não atualizava | ✅ Corrigido |
| 8 | Finalização bloqueava 55% no mobile | Crítico | Usuário não conseguia pedir | ✅ Corrigido |
| 9 | "Repetir pedido" duplicava item | Dados | Total e quantidade incorretos | ✅ Corrigido |
| 10 | Stats admin atualizavam 40% das vezes | UI | Dados desatualizados no painel | ✅ Corrigido |
| D1 | Café com preço `null` | Dados | Produto não adicionável | ✅ Corrigido |
| D2 | Taxa misteriosa de R$1,35 | Dados | Total incorreto | ✅ Corrigido |
| D3 | Popularidade aleatória no admin | Dados | Dado sem significado | ✅ Corrigido |
| S1 | Carrinho global compartilhado | Segurança | Vazamento de dados entre usuários | ✅ Corrigido |
| S2 | Itens removidos no pedido | Segurança | Pedido com itens incorretos | ✅ Corrigido |
| S3 | Sem regras no Firestore | Segurança | Banco de dados aberto | ✅ Corrigido |

**Total: 16 problemas identificados e corrigidos.**

---

## 6. URLs e Acessos

| Recurso | URL |
|---------|-----|
| Site em produção | https://cantina-digital-b6f89.web.app |
| Console Firebase | https://console.firebase.google.com/project/cantina-digital-b6f89 |
| Firestore | Console → Firestore Database |
| Authentication | Console → Authentication |

---

## 7. Conclusão

O projeto **Cantina Digital** passou por uma revisão completa de qualidade de software, abrangendo:

- **Detecção e correção** de 10 bugs intencionais com comportamento aleatório (`Math.random`)
- **Correção de 6 problemas adicionais** de dados, segurança e lógica
- **Configuração completa do Firebase** do zero (Auth, Firestore, Rules, Hosting)
- **Redesign visual** moderno mantendo a identidade da aplicação
- **Deploy em produção** com site acessível publicamente

O processo demonstra na prática as etapas de um ciclo de qualidade de software: análise estática, identificação de defeitos, correção, validação e entrega.
