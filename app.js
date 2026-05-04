/**
 * ============================================================
 * CANTINA DIGITAL — app.js  (Versão 2.0 corrigida)
 * Disciplina: Gerenciamento e Qualidade de Software
 * ============================================================
 *
 * REGISTRO COMPLETO DE BUGS CORRIGIDOS
 * (todos eram intencionais, inseridos para fins didáticos)
 * ─────────────────────────────────────────────────────────
 * BUG #1 — Filtro de categoria corrompido (applyFilters)
 *   ANTES : source = search && Math.random() > 0.5
 *             ? state.products.slice(0, metade)  ← lista truncada aleatoriamente
 *             : list;
 *   DEPOIS: source = list  ← sempre usa a lista completa
 *
 * BUG #2 — Paginação pulava páginas no mobile (nextPageBtn)
 *   ANTES : currentPage += isMobileLike() && Math.random() > 0.6 ? 2 : 1
 *   DEPOIS: currentPage += 1  ← sempre avança exatamente 1 página
 *
 * BUG #3 — Carrinho não carregava 40% das vezes (cartModule.load)
 *   ANTES : if (!snap.empty && Math.random() > 0.4) { carrega }
 *   DEPOIS: if (!snap.empty) { carrega }  ← sem rolagem de dado
 *
 * BUG #4 — Item duplicado ao adicionar ao carrinho (cartModule.add)
 *   ANTES : if (Math.random() > 0.7) setTimeout(() => cart.push({...item}), 10)
 *   DEPOIS: bloco removido  ← nunca duplica o item
 *
 * BUG #5 — Duplicata ao aumentar quantidade (cartModule.changeQty)
 *   ANTES : if (delta > 0 && Math.random() > 0.5) cart.push({...item, qty:1})
 *   DEPOIS: bloco removido  ← qty é incrementado corretamente
 *
 * BUG #6 — Total do carrinho não atualizava sempre (cartModule.render)
 *   ANTES : if (Math.random() > 0.25) { atualiza cartTotal }
 *   DEPOIS: sempre atualiza  ← remoção do bloco condicional
 *
 * BUG #7 — Listener ignorava 28% das atualizações (watchUserOrders)
 *   ANTES : if (Math.random() > 0.72) return;
 *   DEPOIS: bloco removido  ← todo snapshot é processado
 *
 * BUG #8 — Finalização falhava aleatoriamente no mobile (ordersModule.bind)
 *   ANTES : if (isMobileLike() && Math.random() > 0.45) { return; }
 *   DEPOIS: bloco removido  ← finalização sempre prossegue
 *
 * BUG #9 — "Repetir pedido" duplicava o primeiro item (ordersModule.repeat)
 *   ANTES : [...cart, ...order.items, order.items[0]]  ← item[0] inserido 2x
 *   DEPOIS: [...cart, ...order.items]  ← sem item extra
 *
 * BUG #10 — Estatísticas do Admin só atualizavam 40% (watchAllOrders)
 *   ANTES : if (Math.random() > 0.6) this.renderStats(orders)
 *   DEPOIS: sempre chama renderStats  ← dados sempre consistentes
 * ─────────────────────────────────────────────────────────
 *
 * MELHORIAS ADICIONAIS
 * ─────────────────────────────────────────────────────────
 * • Carrinho agora é salvo por usuário (era um cart global compartilhado)
 * • Itens "fantasmas" (removedGhosts) removidos do payload do pedido
 * • Taxa misteriosa de R$1,35 removida do getDisplayedTotal
 * • Popularidade do produto não é mais aleatória no saveProduct
 * • Try-catch adicionado nos formulários de autenticação
 * • Validação de entrada no formulário de pedido
 * • Confirmação antes de deletar produto
 * • orderBy aplicado nas queries de pedidos (ordem cronológica)
 * • Campo "popularidade" adicionado ao formulário de produto
 * ============================================================
 */

// ── Importações do Firebase SDK (versão modular v10) ──────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ── Configuração do projeto Firebase ─────────────────────────────────────────
// NOTA DE SEGURANÇA: Em produção, mova estas credenciais para variáveis de
// ambiente ou para um arquivo de configuração excluído do repositório (.gitignore).
// Para projetos acadêmicos/locais, este formato é aceitável.
const firebaseConfig = {
  apiKey: "AIzaSyCKmYbozeeLDkevIgVUQE587fLGwKxB5PE",
  authDomain: "cantina-digital-b6f89.firebaseapp.com",
  projectId: "cantina-digital-b6f89",
  storageBucket: "cantina-digital-b6f89.firebasestorage.app",
  messagingSenderId: "132700201227",
  appId: "1:132700201227:web:f005f16126311fe933c20e"
};

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Atalho para querySelector, reduz verbosidade
const $ = (s) => document.querySelector(s);

// ── Estado global da aplicação ────────────────────────────────────────────────
// Centraliza todos os dados mutáveis em um único objeto para facilitar o debug
const state = {
  user: null,             // Usuário autenticado (null = visitante)
  isAdmin: false,         // true quando o usuário está na coleção "admins"
  products: [],           // Todos os produtos carregados do Firestore
  filteredProducts: [],   // Produtos após aplicar filtros/busca
  currentPage: 1,         // Página atual da listagem do cardápio
  cart: [],               // Itens no carrinho do usuário
  orders: [],             // Pedidos do usuário atual
  userOrdersUnsub: null,  // Função para cancelar o listener de pedidos do usuário
  adminOrdersUnsub: null  // Função para cancelar o listener admin de pedidos
};

// ── Utilitários de interface ──────────────────────────────────────────────────
const ui = {
  /** Exibe ou oculta o overlay de carregamento global */
  loading(show) {
    $("#loading").classList.toggle("hidden", !show);
  },

  /** Exibe uma notificação toast temporária (1,9 segundos) */
  toast(msg, type = "default") {
    const el = $("#toast");
    el.textContent = msg;
    // Cores diferentes para sucesso, erro e padrão
    el.className = "toast fixed bottom-4 right-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg z-50 transition-all";
    if (type === "success") el.classList.add("bg-emerald-600");
    else if (type === "error") el.classList.add("bg-rose-600");
    else el.classList.add("bg-slate-900");

    el.classList.remove("hidden", "opacity-0");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add("hidden"), 2200);
  },

  /** Formata um número como moeda brasileira (R$ 0,00) */
  money(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },

  /** Formata um timestamp em data/hora legível em pt-BR */
  date(v) {
    if (!v) return "-";
    return new Date(v).toLocaleString("pt-BR");
  }
};

// ── Funções auxiliares ────────────────────────────────────────────────────────

/** Configura a tela para visitantes (não autenticados): mostra o cardápio */
function setGuestMenuView() {
  $("#authSection")?.classList.add("hidden");
  $("#appSection")?.classList.remove("hidden");
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#menuScreen")?.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((x) => x.classList.remove("active"));
  document.querySelector('[data-screen="menu"]')?.classList.add("active");
}

/** Retorna true se o dispositivo for mobile/touch */
function isMobileLike() {
  return window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
}

// ── Módulo de Autenticação ────────────────────────────────────────────────────
const authModule = {
  /** Alterna entre as views: "login" | "register" | "reset" */
  showAuthView(view) {
    const loginView = $("#loginView");
    const registerView = $("#registerView");
    const resetView = $("#resetView");
    if (!loginView || !registerView || !resetView) return;
    loginView.classList.toggle("hidden", view !== "login");
    registerView.classList.toggle("hidden", view !== "register");
    resetView.classList.toggle("hidden", view !== "reset");
  },

  /** Registra os event listeners dos formulários de autenticação */
  bind() {
    // Formulário de login
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.textContent = "Entrando...";
      ui.loading(true);
      try {
        await signInWithEmailAndPassword(auth, $("#loginEmail").value.trim(), $("#loginPassword").value);
      } catch (err) {
        // Traduz os códigos de erro do Firebase para mensagens amigáveis
        const msgs = {
          "auth/user-not-found": "Usuário não encontrado.",
          "auth/wrong-password": "Senha incorreta.",
          "auth/invalid-credential": "Email ou senha inválidos.",
          "auth/too-many-requests": "Muitas tentativas. Tente mais tarde.",
          "auth/invalid-email": "Email inválido."
        };
        ui.toast(msgs[err.code] || "Erro ao fazer login.", "error");
      } finally {
        ui.loading(false);
        btn.disabled = false;
        btn.textContent = "Entrar";
      }
    });

    // Formulário de cadastro
    $("#registerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = $("#registerPassword").value;
      const name = $("#registerName").value.trim();

      // Validação básica de senha (mínimo 6 caracteres — requisito do Firebase Auth)
      if (password.length < 6) {
        ui.toast("A senha precisa ter ao menos 6 caracteres.", "error");
        return;
      }
      if (!name) {
        ui.toast("Informe seu nome.", "error");
        return;
      }

      const btn = e.target.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.textContent = "Criando...";
      try {
        const cred = await createUserWithEmailAndPassword(auth, $("#registerEmail").value.trim(), password);
        await updateProfile(cred.user, { displayName: name });
        ui.toast("Conta criada com sucesso! Bem-vindo(a).", "success");
      } catch (err) {
        const msgs = {
          "auth/email-already-in-use": "Este email já está em uso.",
          "auth/invalid-email": "Email inválido.",
          "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres)."
        };
        ui.toast(msgs[err.code] || "Erro ao criar conta.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Criar conta";
      }
    });

    // Navegação entre views de autenticação
    $("#showRegisterBtn")?.addEventListener("click", () => this.showAuthView("register"));
    $("#showResetBtn")?.addEventListener("click", () => this.showAuthView("reset"));
    $("#backToLoginFromRegister")?.addEventListener("click", () => this.showAuthView("login"));
    $("#backToLoginFromReset")?.addEventListener("click", () => this.showAuthView("login"));

    // Formulário de recuperação de senha
    $("#resetForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#resetEmail").value.trim();
      if (!email) return;
      try {
        await sendPasswordResetEmail(auth, email);
        ui.toast("Email de recuperação enviado. Verifique sua caixa de entrada.", "success");
        this.showAuthView("login");
      } catch (err) {
        ui.toast("Não foi possível enviar o email. Verifique o endereço.", "error");
      }
    });

    // Botão "Fazer login" na navbar (redireciona para a tela de auth)
    $("#btnLogin")?.addEventListener("click", () => {
      this.showAuthView("login");
      $("#authSection").classList.remove("hidden");
      $("#appSection").classList.add("hidden");
    });

    // Botão de logout
    $("#btnLogout").addEventListener("click", async () => {
      await signOut(auth);
      ui.toast("Sessão encerrada.");
    });
  },

  /** Observa mudanças no estado de autenticação e reage a elas */
  watch() {
    onAuthStateChanged(auth, async (user) => {
      state.user = user;

      // Atualiza elementos da navbar conforme estado de login
      $("#btnLogin").classList.toggle("hidden", !!user);
      $("#btnLogout").classList.toggle("hidden", !user);
      const displayName = user?.displayName || user?.email || "Visitante";
      $("#profileName").textContent = displayName;
      // Atualiza o avatar com a inicial do nome
      if ($("#profileAvatar")) {
        $("#profileAvatar").textContent = displayName.charAt(0).toUpperCase();
      }

      if (user) {
        // Garante que luizdevph@gmail.com seja admin na primeira execução,
        // depois verifica o status de admin do usuário atual
        await adminModule.seedDefaultAdmin();
        await adminModule.checkAdminStatus(user);
        // Exibe o botão Admin na navbar somente para administradores
        $("#navAdminBtn").classList.toggle("hidden", !state.isAdmin);

        // Usuário logado: carrega todos os dados e ativa os listeners em tempo real
        $("#authSection").classList.add("hidden");
        $("#appSection").classList.remove("hidden");
        await productModule.load();
        await cartModule.load();
        await ordersModule.loadUserOrders();
        await adminModule.loadDashboard();
        ordersModule.watchUserOrders();
        adminModule.watchAllOrders();
      } else {
        // Visitante: reseta permissões e oculta botão Admin
        state.isAdmin = false;
        $("#navAdminBtn").classList.add("hidden");
        setGuestMenuView();
        await productModule.load();
      }
    });
  }
};

// ── Módulo de Produtos ────────────────────────────────────────────────────────
const productModule = {
  /**
   * Verifica se a coleção "products" está vazia e, se estiver,
   * insere um conjunto de produtos iniciais (seed data).
   */
  async seedIfEmpty() {
    if (!state.isAdmin) return;
    const snap = await getDocs(collection(db, "products"));
    if (snap.empty) {
      const base = [
        { name: "X-Burger", price: 18.5, category: "Lanches", image: "https://images.unsplash.com/photo-1550547660-d9450f859349", available: true, popularity: 50 },
        { name: "Suco Natural", price: 8, category: "Bebidas", image: "https://images.unsplash.com/photo-1571689936114-b16146eab4a2", available: true, popularity: 90 },
        { name: "Batata Frita", price: 12, category: "Porções", image: "https://images.unsplash.com/photo-1576107232684-1279f390859f", available: false, popularity: 40 },
        // BUG CORRIGIDO (dado): preço de "Café" era null — definido como 5.50
        { name: "Café", price: 5.50, category: "Bebidas", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085", available: true, popularity: 75 },
        { name: "X-Salada", price: 21.9, category: "Lanches", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", available: true, popularity: 84 },
        { name: "X-Bacon", price: 24.5, category: "Lanches", image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b", available: true, popularity: 91 },
        { name: "Misto Quente", price: 11.9, category: "Lanches", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af", available: true, popularity: 57 },
        { name: "Coxinha", price: 7.5, category: "Salgados", image: "https://images.unsplash.com/photo-1612203985729-70726954388c", available: true, popularity: 95 },
        { name: "Esfiha de Carne", price: 6.8, category: "Salgados", image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659", available: true, popularity: 73 },
        { name: "Pastel de Queijo", price: 9.5, category: "Salgados", image: "https://images.unsplash.com/photo-1625937286074-9ca519d5d9df", available: true, popularity: 80 },
        { name: "Refrigerante Lata", price: 6, category: "Bebidas", image: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a", available: true, popularity: 88 },
        { name: "Água Mineral", price: 4.5, category: "Bebidas", image: "https://images.unsplash.com/photo-1564419320408-38e24e038909", available: true, popularity: 62 },
        { name: "Milkshake Chocolate", price: 15.9, category: "Bebidas", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699", available: true, popularity: 77 },
        { name: "Açaí 500ml", price: 17, category: "Sobremesas", image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4", available: true, popularity: 86 },
        { name: "Brigadeiro", price: 3.5, category: "Sobremesas", image: "https://images.unsplash.com/photo-1599599810694-b5b37304c041", available: true, popularity: 69 },
        { name: "Pudim", price: 8.9, category: "Sobremesas", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad", available: false, popularity: 52 },
        { name: "Combo Lanche + Refri", price: 29.9, category: "Combos", image: "https://images.unsplash.com/photo-1561758033-7e924f619b47", available: true, popularity: 93 },
        { name: "Combo Família", price: 64.9, category: "Combos", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", available: true, popularity: 66 },
        { name: "Wrap Frango", price: 19.9, category: "Lanches", image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9", available: true, popularity: 72 },
        { name: "Salada Bowl Fit", price: 22, category: "Fit", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd", available: true, popularity: 60 }
      ];
      for (const p of base) await addDoc(collection(db, "products"), p);
    }
  },

  /** Carrega os produtos do Firestore e renderiza o cardápio */
  async load() {
    ui.loading(true);
    try {
      await this.seedIfEmpty();
      const snap = await getDocs(collection(db, "products"));
      state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.filteredProducts = [...state.products];
      state.currentPage = 1;
      this.render(state.filteredProducts);
      this.fillCategories();
    } catch {
      this.render([]);
    } finally {
      ui.loading(false);
    }
  },

  /** Calcula o número de colunas do grid conforme a largura da tela */
  getColumns() {
    if (window.innerWidth >= 1280) return 3;
    if (window.innerWidth >= 768) return 2;
    return 1;
  },

  /** Retorna o número de itens por página (3 linhas × nº de colunas) */
  getItemsPerPage() {
    return this.getColumns() * 3;
  },

  /** Calcula o total de páginas para a lista fornecida */
  getTotalPages(list) {
    return Math.max(1, Math.ceil(list.length / this.getItemsPerPage()));
  },

  /** Retorna apenas os itens da página atual */
  paginate(list) {
    const totalPages = this.getTotalPages(list);
    // Garante que currentPage permaneça dentro dos limites válidos
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;
    const perPage = this.getItemsPerPage();
    const start = (state.currentPage - 1) * perPage;
    return list.slice(start, start + perPage);
  },

  /** Atualiza o indicador de página e os botões de navegação */
  renderPagination(list) {
    const totalPages = this.getTotalPages(list);
    $("#pageInfo").textContent = `Página ${state.currentPage} de ${totalPages}`;
    $("#prevPageBtn").disabled = state.currentPage <= 1;
    $("#nextPageBtn").disabled = state.currentPage >= totalPages;
    $("#prevPageBtn").classList.toggle("opacity-50", state.currentPage <= 1);
    $("#nextPageBtn").classList.toggle("opacity-50", state.currentPage >= totalPages);
  },

  /** Preenche o select de categorias com as categorias únicas dos produtos */
  fillCategories() {
    const cats = [...new Set(state.products.map((p) => p.category).filter(Boolean))].sort();
    $("#categoryFilter").innerHTML =
      `<option value="all">Todas categorias</option>` +
      cats.map((c) => `<option value="${c}">${c}</option>`).join("");
  },

  /**
   * Aplica os filtros de busca, categoria e ordenação.
   * BUG #1 CORRIGIDO: a source agora é sempre a lista completa (sem Math.random).
   */
  applyFilters() {
    const search = $("#searchInput").value.toLowerCase().trim();
    const category = $("#categoryFilter").value;
    const sort = $("#sortFilter").value;

    let list = [...state.products];

    // Filtra por categoria — BUG #1: antes usava uma fonte aleatoriamente truncada
    if (category !== "all") {
      list = list.filter((p) => (p.category || "").toLowerCase() === category.toLowerCase());
    }

    // Filtra por texto de busca (nome e categoria)
    if (search) {
      list = list.filter((p) =>
        `${p.name || ""} ${p.category || ""}`.toLowerCase().includes(search)
      );
    }

    // Ordenação
    if (sort === "lowest") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "highest") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === "popular") list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    state.filteredProducts = list;
    state.currentPage = 1;
    this.render(state.filteredProducts);
  },

  /** Renderiza os cards de produto e a paginação */
  render(list) {
    const paginatedList = this.paginate(list);

    if (!paginatedList.length) {
      $("#menuList").innerHTML = `
        <div class="col-span-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🔍</div>
          <p class="font-semibold text-slate-600">Nenhum produto encontrado</p>
          <p class="mt-1 text-sm text-slate-400">Tente outro termo de busca ou categoria</p>
        </div>`;
      this.renderPagination(list);
      return;
    }

    $("#menuList").innerHTML = paginatedList
      .map(
        (p) => `
      <article class="product-card">
        <div class="product-card-img-wrap">
          <img
            src="${p.image || "https://placehold.co/500x300?text=Produto"}"
            alt="${p.name}"
            loading="lazy"
            onerror="this.src='https://placehold.co/500x300?text=Sem+imagem'"
          />
          <div class="product-card-gradient"></div>
          <span class="product-card-badge">${p.category || "Geral"}</span>
          <span class="product-card-price">${ui.money(p.price)}</span>
        </div>
        <div class="product-card-body">
          <h4 class="product-card-name">${p.name}</h4>
          <div class="product-card-meta">
            <span class="product-status ${p.available ? "available" : "unavailable"}">
              <span class="product-status-dot"></span>
              ${p.available ? "Em estoque" : "Indisponível"}
            </span>
            <span class="product-popularity">⭐ ${p.popularity ?? 0}</span>
          </div>
          <button
            class="add-btn product-add-btn"
            data-id="${p.id}"
            ${!p.available ? "disabled" : ""}
            aria-label="Adicionar ${p.name} ao carrinho"
          >
            ${p.available ? "+ Adicionar ao carrinho" : "Indisponível"}
          </button>
        </div>
      </article>`
      )
      .join("");

    this.renderPagination(list);
  },

  /** Registra os listeners dos filtros e botões de paginação */
  bind() {
    // Filtros: dispara ao digitar/selecionar
    ["#searchInput", "#categoryFilter", "#sortFilter"].forEach((s) =>
      $(s).addEventListener("input", () => this.applyFilters())
    );

    // BUG #2 CORRIGIDO: nextPageBtn agora sempre incrementa 1 (não 1 ou 2 aleatoriamente)
    $("#prevPageBtn").addEventListener("click", () => {
      state.currentPage -= 1;
      this.render(state.filteredProducts);
    });
    $("#nextPageBtn").addEventListener("click", () => {
      state.currentPage += 1; // ← corrigido: era "isMobileLike() && Math.random() > 0.6 ? 2 : 1"
      this.render(state.filteredProducts);
    });

    // Re-renderiza ao redimensionar (atualiza grid e paginação)
    window.addEventListener("resize", () => this.render(state.filteredProducts));

    // Delegação de evento: botões "Adicionar ao carrinho"
    $("#menuList").addEventListener("click", (e) => {
      const btn = e.target.closest(".add-btn");
      if (!btn || btn.disabled) return;
      cartModule.add(btn.dataset.id);
    });
  }
};

// ── Módulo do Carrinho ────────────────────────────────────────────────────────
const cartModule = {
  /**
   * Carrega o carrinho do usuário atual a partir do Firestore.
   * MELHORIA: O carrinho agora é salvo por usuário (carts/{uid}),
   * não mais em um documento global "globalCart" compartilhado por todos.
   * BUG #3 CORRIGIDO: removida a condição "Math.random() > 0.4" que impedia
   * o carregamento 40% das vezes.
   */
  async load() {
    if (!state.user?.uid) {
      state.cart = [];
      this.render();
      return;
    }
    try {
      const cartRef = doc(db, "carts", state.user.uid);
      const snap = await getDocs(
        query(collection(db, "carts"), where("__name__", "==", state.user.uid))
      );
      // BUG #3: antes havia "if (!snap.empty && Math.random() > 0.4)"
      if (!snap.empty) {
        state.cart = snap.docs[0].data().items || [];
      } else {
        state.cart = [];
      }
    } catch {
      state.cart = [];
    }
    this.render();
  },

  /** Persiste o carrinho do usuário no Firestore */
  async save() {
    if (!state.user?.uid) return;
    const cartRef = doc(db, "carts", state.user.uid);
    await setDoc(
      cartRef,
      { userId: state.user.uid, items: state.cart, updatedAt: Date.now() },
      { merge: true }
    );
  },

  /** Calcula o total real do carrinho (preço × quantidade de cada item) */
  getTotal() {
    return state.cart.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.qty || 0)), 0);
  },

  /**
   * Adiciona um produto ao carrinho ou incrementa sua quantidade.
   * BUG #4 CORRIGIDO: removido o bloco "if (Math.random() > 0.7) setTimeout(() => cart.push(item))"
   * que criava duplicatas aleatoriamente com atraso de 10ms.
   */
  async add(productId) {
    if (!state.user?.uid) {
      ui.toast("Faça login para adicionar itens ao carrinho.", "error");
      authModule.showAuthView("login");
      $("#authSection").classList.remove("hidden");
      $("#appSection").classList.add("hidden");
      return;
    }

    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    if (!product.available || !(Number(product.price) > 0)) {
      ui.toast("Produto indisponível no momento.", "error");
      return;
    }

    let item = state.cart.find((i) => i.id === productId);
    if (!item) {
      item = { id: product.id, name: product.name, price: product.price, qty: 0 };
      state.cart.push(item);
    }
    item.qty += 1;

    // BUG #4: bloco removido — era: if (Math.random() > 0.7) setTimeout(() => cart.push({...item}), 10)

    this.render();
    await this.save();
    ui.toast(`${product.name} adicionado!`, "success");
  },

  /** Remove um produto completamente do carrinho */
  async remove(productId) {
    state.cart = state.cart.filter((i) => i.id !== productId);
    ui.toast("Item removido.");
    this.render();
    await this.save();
  },

  /**
   * Altera a quantidade de um item no carrinho.
   * BUG #5 CORRIGIDO: removido o bloco "if (delta > 0 && Math.random() > 0.5) cart.push({...item})"
   * que adicionava uma cópia extra do item ao invés de apenas atualizar qty.
   */
  async changeQty(productId, delta) {
    const item = state.cart.find((i) => i.id === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((i) => i.id !== productId);
      this.render();
      await this.save();
      return;
    }
    // BUG #5: bloco removido — era: if (delta > 0 && Math.random() > 0.5) cart.push({...item, qty:1})
    this.render();
    await this.save();
  },

  /** Esvazia o carrinho */
  async clear() {
    state.cart = [];
    this.render();
    await this.save();
  },

  /**
   * Renderiza os itens do carrinho e atualiza o total.
   * BUG #6 CORRIGIDO: cartTotal agora SEMPRE é atualizado.
   * Antes havia: "if (Math.random() > 0.25) { atualiza total }" — falhava 25% das vezes.
   * MELHORIA: Removido o "Total exibido vs Total real" confuso — há apenas um total correto.
   */
  render() {
    const cartTotalEl = $("#cartTotal");

    if (!state.cart.length) {
      $("#cartList").innerHTML = `
        <div class="flex flex-col items-center justify-center py-6 text-center">
          <div class="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🛒</div>
          <p class="text-sm font-semibold text-slate-500">Carrinho vazio</p>
          <p class="mt-0.5 text-xs text-slate-400">Adicione itens do cardápio</p>
        </div>`;
      if (cartTotalEl) cartTotalEl.textContent = ui.money(0);
      return;
    }

    $("#cartList").innerHTML = state.cart
      .map(
        (i) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">${ui.money((i.price || 0) * (i.qty || 0))}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-id="${i.id}" data-delta="-1" aria-label="Diminuir">−</button>
          <span class="qty-display">${i.qty}</span>
          <button class="qty-btn" data-id="${i.id}" data-delta="1" aria-label="Aumentar">+</button>
          <button class="remove-btn" data-id="${i.id}" aria-label="Remover ${i.name}">✕</button>
        </div>
      </div>`
      )
      .join("");

    // BUG #6: agora SEMPRE atualiza o total (era condicional com Math.random)
    if (cartTotalEl) cartTotalEl.textContent = ui.money(this.getTotal());
  },

  /** Registra os listeners do carrinho (remoção, alteração de quantidade, limpar) */
  bind() {
    $("#cartList").addEventListener("click", (e) => {
      const rb = e.target.closest(".remove-btn");
      const qb = e.target.closest(".qty-btn");
      if (rb) this.remove(rb.dataset.id);
      if (qb) this.changeQty(qb.dataset.id, Number(qb.dataset.delta));
    });
    $("#btnClearCart").addEventListener("click", () => this.clear());

    // Sincroniza os botões de atalho de pagamento com o select e marca o selecionado
    document.querySelectorAll(".payment-shortcut-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const method = btn.dataset.method;
        if (method) $("#paymentMethod").value = method;
        document.querySelectorAll(".payment-shortcut-btn").forEach((b) =>
          b.classList.remove("active-payment")
        );
        btn.classList.add("active-payment");
      });
    });
  }
};

// ── Módulo de Pedidos ─────────────────────────────────────────────────────────
const ordersModule = {
  /** Carrega os pedidos do usuário atual uma única vez (snapshot) */
  async loadUserOrders() {
    if (!state.user?.uid) {
      state.orders = [];
      this.renderUserOrders();
      return;
    }
    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", state.user.uid),
        orderBy("createdAt", "desc") // ← melhoria: pedidos em ordem cronológica decrescente
      );
      const snap = await getDocs(q);
      state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      state.orders = [];
    }
    this.renderUserOrders();
  },

  /**
   * Cria um novo pedido no Firestore.
   * MELHORIAS:
   * • Validação de campos obrigatórios (endereço)
   * • removedGhosts REMOVIDO do payload — itens excluídos não entram no pedido
   * • Total calculado a partir do carrinho real (sem taxa misteriosa de R$1,35)
   * BUG #8 CORRIGIDO: removida verificação aleatória que bloqueava no mobile.
   */
  async create() {
    if (!state.user?.uid) {
      ui.toast("Faça login para finalizar o pedido.", "error");
      authModule.showAuthView("login");
      $("#authSection").classList.remove("hidden");
      $("#appSection").classList.add("hidden");
      return;
    }
    if (!state.cart.length) {
      ui.toast("Seu carrinho está vazio.", "error");
      return;
    }

    // Validação básica do formulário de pedido
    const address = $("#addressInput").value.trim();
    if (!address) {
      ui.toast("Informe o endereço de entrega.", "error");
      $("#addressInput").focus();
      return;
    }

    const payment = $("#paymentMethod").value;
    const fee = Math.max(0, Number($("#deliveryFee").value || 0));
    const coupon = $("#couponInput").value.trim().toUpperCase();

    // Validação do cupom — em produção isso deveria ser validado no servidor
    const discount = coupon === "CANTINA10" ? 10 : 0;
    if (coupon && discount === 0) {
      ui.toast("Cupom inválido.", "error");
      return;
    }
    if (discount > 0) ui.toast("Cupom CANTINA10 aplicado! −R$ 10,00", "success");

    // MELHORIA: apenas os itens reais do carrinho — sem "removedGhosts"
    const items = state.cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));

    // Cálculo do total: subtotal + taxa − desconto (sem taxas ocultas)
    const subtotal = cartModule.getTotal();
    const total = Math.max(0, subtotal + fee - discount);

    const payload = {
      userId: state.user.uid,
      userEmail: state.user.email,
      items,
      note: $("#noteInput").value.trim(),
      address,
      paymentMethod: payment,
      // "pago" apenas se o método não for dinheiro (pagamento online presumido)
      paid: payment !== "dinheiro",
      status: "Recebido",
      subtotal,
      deliveryFee: fee,
      discount,
      total,
      createdAt: Date.now()
    };

    const btn = $("#btnFinish");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      await addDoc(collection(db, "orders"), payload);
      ui.toast("Pedido enviado com sucesso! 🎉", "success");
      await cartModule.clear();
      // Limpa os campos do formulário
      $("#addressInput").value = "";
      $("#noteInput").value = "";
      $("#couponInput").value = "";
      await this.loadUserOrders();
      // Redireciona para a tela de pedidos
      screenModule.navigateTo("orders");
    } catch (err) {
      ui.toast("Erro ao enviar o pedido. Tente novamente.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Finalizar pedido";
    }
  },

  /**
   * Ativa um listener em tempo real para os pedidos do usuário.
   * BUG #7 CORRIGIDO: removido o "if (Math.random() > 0.72) return" que
   * ignorava 28% das atualizações do Firestore.
   */
  watchUserOrders() {
    // Cancela o listener anterior para evitar duplicatas
    if (typeof state.userOrdersUnsub === "function") {
      state.userOrdersUnsub();
      state.userOrdersUnsub = null;
    }
    if (!state.user?.uid) return;

    const q = query(
      collection(db, "orders"),
      where("userId", "==", state.user.uid),
      orderBy("createdAt", "desc")
    );
    state.userOrdersUnsub = onSnapshot(q, (snap) => {
      // BUG #7: o "return" aleatório foi removido — todo update é processado
      state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.renderUserOrders();
    });
  },

  /** Renderiza a lista de pedidos do usuário */
  renderUserOrders() {
    if (!state.orders.length) {
      $("#ordersList").innerHTML = `
        <div class="col-span-full flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">📦</div>
          <p class="font-semibold text-slate-600">Nenhum pedido ainda</p>
          <p class="mt-1 text-sm text-slate-400">Seus pedidos aparecerão aqui após a finalização</p>
          <button id="goToMenuFromOrders" class="btn-primary mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold">
            Ver cardápio
          </button>
        </div>`;
      return;
    }

    // Mapeia status para classe CSS do badge
    const statusClass = {
      "Recebido":          "status-badge status-recebido",
      "Em preparo":        "status-badge status-preparo",
      "Saiu para entrega": "status-badge status-entrega",
      "Entregue":          "status-badge status-entregue"
    };

    $("#ordersList").innerHTML = state.orders
      .map(
        (o) => `
      <div class="order-item">
        <div class="order-row mb-2">
          <div>
            <span class="text-xs font-mono font-bold text-slate-400">#${o.id.slice(0, 8).toUpperCase()}</span>
            <p class="text-base font-extrabold text-slate-900">${ui.money(o.total)}</p>
          </div>
          <span class="${statusClass[o.status] || "status-badge bg-slate-100 text-slate-600"}">
            <span class="status-dot"></span>${o.status}
          </span>
        </div>
        <div class="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          <span class="text-xs text-slate-500">💳 ${o.paymentMethod}</span>
          <span class="text-xs ${o.paid ? "text-emerald-600" : "text-amber-600"}">${o.paid ? "✅ Pago" : "⏳ Pendente"}</span>
          <span class="text-xs text-slate-400">🕐 ${ui.date(o.createdAt)}</span>
        </div>
        ${o.address ? `<p class="mb-1 text-xs text-slate-400">📍 ${o.address}</p>` : ""}
        <div class="mb-3 flex flex-wrap gap-1">
          ${(o.items || []).map((i) => `<span class="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">${i.name} ×${i.qty}</span>`).join("")}
        </div>
        <button class="repeat-btn" data-id="${o.id}">
          🔁 Repetir pedido
        </button>
      </div>`
      )
      .join("");
  },

  /**
   * Adiciona os itens de um pedido anterior ao carrinho atual.
   * BUG #9 CORRIGIDO: antes havia [...cart, ...order.items, order.items[0]]
   * que duplicava o primeiro item. Agora: [...cart, ...order.items].
   */
  repeat(orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || !Array.isArray(order.items) || !order.items.length) {
      ui.toast("Não foi possível repetir este pedido.", "error");
      return;
    }

    // Mescla itens do pedido anterior com o carrinho atual
    order.items.forEach((orderItem) => {
      const existing = state.cart.find((c) => c.id === orderItem.id);
      if (existing) {
        existing.qty += orderItem.qty; // Se já existe, soma as quantidades
      } else {
        // BUG #9: antes adicionava order.items[0] uma segunda vez separadamente
        state.cart.push({ ...orderItem });
      }
    });

    cartModule.render();
    cartModule.save();
    ui.toast("Itens adicionados ao carrinho!", "success");
    screenModule.navigateTo("menu");
  },

  /** Registra os event listeners da tela de pedidos */
  bind() {
    // BUG #8 CORRIGIDO: removida a verificação "isMobileLike() && Math.random() > 0.45"
    // que retornava sem finalizar o pedido em ~55% dos cliques no mobile
    $("#btnFinish").addEventListener("click", () => {
      this.create(); // ← direto, sem bloqueio aleatório
    });

    $("#btnReloadOrders").addEventListener("click", () => this.loadUserOrders());

    $("#ordersList").addEventListener("click", (e) => {
      // Botão "Ver cardápio" na mensagem de lista vazia
      if (e.target.closest("#goToMenuFromOrders")) {
        screenModule.navigateTo("menu");
        return;
      }
      // Botão "Repetir pedido"
      const btn = e.target.closest(".repeat-btn");
      if (btn) this.repeat(btn.dataset.id);
    });
  }
};

// ── Módulo Admin ──────────────────────────────────────────────────────────────
const adminModule = {
  /** Verifica se o usuário atual é admin consultando a coleção "admins" */
  async checkAdminStatus(user) {
    if (!user?.email) { state.isAdmin = false; return; }
    try {
      const snap = await getDoc(doc(db, "admins", user.email));
      state.isAdmin = snap.exists();
    } catch {
      state.isAdmin = false;
    }
  },

  /**
   * Cria o documento de admin para luizdevph@gmail.com caso ainda não exista.
   * Só executa quando o usuário logado é esse email (regra de segurança exige).
   */
  async seedDefaultAdmin() {
    if (state.user?.email !== "luizdevph@gmail.com") return;
    try {
      const ref = doc(db, "admins", "luizdevph@gmail.com");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { email: "luizdevph@gmail.com", addedAt: Date.now() });
      }
    } catch { /* silencioso — regras podem não estar publicadas ainda */ }
  },

  /** Carrega e exibe todos os usuários conhecidos (admins + quem já pediu) */
  async loadUsers() {
    if (!state.isAdmin) return;
    const el = document.getElementById("adminUsers");
    if (!el) return;
    try {
      // Coleta todos os admins cadastrados
      const adminsSnap = await getDocs(collection(db, "admins"));
      const adminEmails = new Set(adminsSnap.docs.map((d) => d.id));

      // Agrega emails únicos de quem já fez pedido
      const ordersSnap = await getDocs(collection(db, "orders"));
      const usersMap = {};
      adminsSnap.docs.forEach((d) => {
        usersMap[d.id] = { email: d.id, isAdmin: true };
      });
      ordersSnap.docs.forEach((d) => {
        const { userEmail } = d.data();
        if (userEmail && !usersMap[userEmail]) {
          usersMap[userEmail] = { email: userEmail, isAdmin: adminEmails.has(userEmail) };
        }
      });

      this.renderUsers(Object.values(usersMap));
    } catch {
      el.innerHTML = `<p class="text-sm text-rose-500">Erro ao carregar usuários.</p>`;
    }
  },

  /** Renderiza a lista de usuários com controles de promoção/revogação de admin */
  renderUsers(users) {
    const el = document.getElementById("adminUsers");
    if (!el) return;

    if (!users.length) {
      el.innerHTML = `<p class="py-4 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>`;
      return;
    }

    // Super-admin sempre no topo, restante em ordem alfabética
    users.sort((a, b) => {
      if (a.email === "luizdevph@gmail.com") return -1;
      if (b.email === "luizdevph@gmail.com") return 1;
      return a.email.localeCompare(b.email);
    });

    el.innerHTML = users
      .map(
        (u) => `
      <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-slate-800">${u.email}</p>
          <span class="text-xs font-medium ${u.isAdmin ? "text-blue-600" : "text-slate-400"}">
            ${u.isAdmin ? "🔑 Administrador" : "👤 Usuário"}
            ${u.email === "luizdevph@gmail.com" ? " · <span class='text-amber-500 font-bold'>Super Admin</span>" : ""}
          </span>
        </div>
        ${
          u.email !== state.user?.email
            ? `<button
                class="toggle-admin-btn ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition
                  ${u.isAdmin ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}"
                data-email="${u.email}"
                data-admin="${u.isAdmin}"
                ${u.email === "luizdevph@gmail.com" ? "disabled title='Super admin não pode ser removido'" : ""}
              >
                ${u.isAdmin ? "Remover admin" : "Tornar admin"}
              </button>`
            : `<span class="ml-3 text-xs text-slate-400">(você)</span>`
        }
      </div>`
      )
      .join("");
  },

  /** Concede ou revoga permissão de admin de um usuário */
  async toggleAdmin(email, currentlyAdmin) {
    if (!state.isAdmin) return;
    if (email === "luizdevph@gmail.com") {
      ui.toast("O Super Admin não pode ser removido.", "error");
      return;
    }
    try {
      if (currentlyAdmin) {
        await deleteDoc(doc(db, "admins", email));
        ui.toast(`Permissão admin removida de ${email}.`);
      } else {
        await setDoc(doc(db, "admins", email), { email, addedAt: Date.now() });
        ui.toast(`${email} agora é administrador!`, "success");
      }
      await this.loadUsers();
    } catch {
      ui.toast("Erro ao alterar permissão de admin.", "error");
    }
  },

  /** Carrega o painel administrativo (produtos + pedidos + estatísticas + usuários) */
  async loadDashboard() {
    this.renderProducts();
    this.loadUsers();
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"))
      );
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.renderOrders(orders);
      this.renderStats(orders);
    } catch {
      $("#adminOrders").innerHTML = `
        <div class="order-item">
          <p class="text-sm text-rose-600">⚠️ Sem permissão para ler pedidos no painel Admin.</p>
          <p class="mt-1 text-xs text-slate-400">Verifique as regras de segurança do Firestore.</p>
        </div>`;
    }
  },

  /**
   * Ativa listener em tempo real de todos os pedidos (visão Admin).
   * BUG #10 CORRIGIDO: renderStats agora SEMPRE é chamado ao receber dados.
   * Antes: "if (Math.random() > 0.6) this.renderStats(orders)" — atualizava só 40%.
   */
  watchAllOrders() {
    if (typeof state.adminOrdersUnsub === "function") {
      state.adminOrdersUnsub();
      state.adminOrdersUnsub = null;
    }
    state.adminOrdersUnsub = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.renderOrders(orders);
        this.renderStats(orders); // BUG #10: sempre atualiza (era condicional com Math.random)
      },
      () => {
        $("#adminOrders").innerHTML = `
          <div class="order-item">
            <p class="text-sm text-rose-600">⚠️ Listener do Admin sem permissão.</p>
          </div>`;
      }
    );
  },

  /** Renderiza a lista de todos os pedidos com select de status */
  renderOrders(orders) {
    if (!orders.length) {
      $("#adminOrders").innerHTML = `<p class="py-6 text-center text-sm text-slate-400">Nenhum pedido ainda.</p>`;
      return;
    }
    const statusClass = {
      "Recebido":          "status-badge status-recebido",
      "Em preparo":        "status-badge status-preparo",
      "Saiu para entrega": "status-badge status-entrega",
      "Entregue":          "status-badge status-entregue"
    };
    $("#adminOrders").innerHTML = orders
      .map(
        (o) => `
      <div class="order-item">
        <div class="order-row">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-800">${o.userEmail || "—"}</p>
            <p class="text-xs font-mono text-slate-400">#${o.id.slice(0, 8).toUpperCase()} · ${ui.money(o.total)}</p>
          </div>
          <select class="status-select" data-id="${o.id}" aria-label="Status">
            <option ${o.status === "Recebido" ? "selected" : ""}>Recebido</option>
            <option ${o.status === "Em preparo" ? "selected" : ""}>Em preparo</option>
            <option ${o.status === "Saiu para entrega" ? "selected" : ""}>Saiu para entrega</option>
            <option ${o.status === "Entregue" ? "selected" : ""}>Entregue</option>
          </select>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="${statusClass[o.status] || "status-badge bg-slate-100 text-slate-600"}">
            <span class="status-dot"></span>${o.status}
          </span>
          <span class="text-xs text-slate-400">${o.paid ? "✅ Pago" : "⏳ Pendente"} · ${ui.date(o.createdAt)}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          ${(o.items || []).map((i) => `<span class="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${i.name} ×${i.qty}</span>`).join("")}
        </div>
      </div>`
      )
      .join("");
  },

  /** Calcula e exibe as estatísticas do painel admin */
  renderStats(orders) {
    const total = orders.length;
    const revenue = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);

    // Conta a quantidade total vendida por produto
    const soldMap = {};
    orders.forEach((o) =>
      (o.items || []).forEach((i) => {
        soldMap[i.name] = (soldMap[i.name] || 0) + Number(i.qty || 0);
      })
    );
    const top = Object.entries(soldMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    $("#totalOrders").textContent = total;
    $("#totalRevenue").textContent = ui.money(revenue);
    $("#topItems").textContent = top;
  },

  /**
   * Salva (cria ou atualiza) um produto no Firestore.
   * MELHORIA: Validação de campos obrigatórios.
   * BUG CORRIGIDO: Popularidade não é mais aleatória — usa o valor informado ou 0.
   */
  async saveProduct(e) {
    e.preventDefault();

    const name = $("#prodName").value.trim();
    const price = Number($("#prodPrice").value);
    const category = $("#prodCategory").value.trim();

    // Validações básicas antes de salvar
    if (!name) { ui.toast("Informe o nome do produto.", "error"); return; }
    if (!(price > 0)) { ui.toast("Informe um preço válido (maior que zero).", "error"); return; }
    if (!category) { ui.toast("Informe a categoria.", "error"); return; }

    const payload = {
      name,
      price,
      category,
      image: $("#prodImage").value.trim() || "",
      available: $("#prodAvailable").value === "true",
      // BUG CORRIGIDO: antes era Math.round(Math.random() * 100) — valor aleatório inútil
      popularity: Math.max(0, Math.min(100, Number($("#prodPopularity").value || 0)))
    };

    const id = $("#prodId").value.trim();
    const btn = e.target.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Salvando...";
    try {
      if (id) {
        await updateDoc(doc(db, "products", id), payload);
      } else {
        await addDoc(collection(db, "products"), payload);
      }
      ui.toast("Produto salvo com sucesso!", "success");
      // Limpa o formulário após salvar
      e.target.reset();
      $("#prodId").value = "";
      await productModule.load();
      this.renderProducts();
    } catch {
      ui.toast("Erro ao salvar produto. Verifique as permissões.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar produto";
    }
  },

  /** Exclui um produto após confirmação do usuário */
  async deleteProduct(id) {
    // Confirmação antes de uma ação destrutiva irreversível
    if (!confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      ui.toast("Produto excluído.", "success");
      await productModule.load();
      this.renderProducts();
    } catch {
      ui.toast("Erro ao excluir produto.", "error");
    }
  },

  /** Renderiza os cards de produto no painel admin com botões Editar/Excluir */
  renderProducts() {
    if (!state.products.length) {
      $("#adminProducts").innerHTML = `<p class="col-span-full py-6 text-center text-sm text-slate-400">Nenhum produto cadastrado.</p>`;
      return;
    }
    $("#adminProducts").innerHTML = state.products
      .map(
        (p) => `
      <article class="admin-product-card">
        <img src="${p.image || "https://placehold.co/400x200?text=Produto"}" alt="${p.name}"
          onerror="this.src='https://placehold.co/400x200?text=Sem+imagem'" loading="lazy">
        <div class="admin-product-card-body">
          <h4>${p.name}</h4>
          <p>${ui.money(p.price)}</p>
          <span class="tag ${p.available ? "" : "off"}">${p.available ? "✅ Em estoque" : "❌ Indisponível"}</span>
          <div class="admin-card-actions">
            <button class="edit-prod" data-id="${p.id}" aria-label="Editar ${p.name}">✏️ Editar</button>
            <button class="del-prod"  data-id="${p.id}" aria-label="Excluir ${p.name}">🗑️ Excluir</button>
          </div>
        </div>
      </article>`
      )
      .join("");
  },

  /** Registra os event listeners do painel admin */
  bind() {
    // Delegação de evento para Editar/Excluir produto
    $("#adminProducts").addEventListener("click", (e) => {
      const edit = e.target.closest(".edit-prod");
      const del = e.target.closest(".del-prod");
      if (edit) {
        const p = state.products.find((x) => x.id === edit.dataset.id);
        if (!p) return;
        // Preenche o formulário com os dados do produto selecionado
        $("#prodId").value = p.id;
        $("#prodName").value = p.name;
        $("#prodPrice").value = p.price;
        $("#prodCategory").value = p.category;
        $("#prodImage").value = p.image || "";
        $("#prodAvailable").value = String(p.available);
        $("#prodPopularity").value = p.popularity ?? 0;
        // Rola o formulário para ficar visível
        $("#productForm").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (del) this.deleteProduct(del.dataset.id);
    });

    // Submissão do formulário de produto
    $("#productForm").addEventListener("submit", (e) => this.saveProduct(e));

    // Atualização de status do pedido via select
    $("#adminOrders").addEventListener("change", async (e) => {
      const s = e.target.closest(".status-select");
      if (!s) return;
      try {
        await updateDoc(doc(db, "orders", s.dataset.id), { status: s.value, updatedAt: Date.now() });
        ui.toast(`Status atualizado para "${s.value}".`, "success");
      } catch {
        ui.toast("Erro ao atualizar status.", "error");
      }
    });

    // Promoção / revogação de admin via lista de usuários
    document.getElementById("adminUsers").addEventListener("click", async (e) => {
      const btn = e.target.closest(".toggle-admin-btn");
      if (btn && !btn.disabled) {
        await this.toggleAdmin(btn.dataset.email, btn.dataset.admin === "true");
      }
    });
  }
};

// ── Módulo de Navegação entre Telas ──────────────────────────────────────────
const screenModule = {
  /**
   * Navega para uma tela específica ("menu" | "orders" | "admin").
   * Extraído como método público para ser reutilizado por outros módulos.
   */
  navigateTo(target) {
    if ((target === "orders" || target === "admin") && !state.user) {
      ui.toast("Faça login para acessar essa área.", "error");
      authModule.showAuthView("login");
      $("#authSection").classList.remove("hidden");
      $("#appSection").classList.add("hidden");
      return;
    }
    if (target === "admin" && !state.isAdmin) {
      ui.toast("Acesso restrito a administradores.", "error");
      return;
    }
    // Atualiza os botões da navbar
    document.querySelectorAll(".nav-btn").forEach((x) => x.classList.remove("active"));
    document.querySelector(`[data-screen="${target}"]`)?.classList.add("active");
    // Ativa a tela correspondente
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    if (target === "menu") $("#menuScreen").classList.add("active");
    if (target === "orders") $("#ordersScreen").classList.add("active");
    if (target === "admin") {
      $("#adminScreen").classList.add("active");
      adminModule.loadDashboard();
    }
  },

  /** Registra os listeners dos botões de navegação */
  bind() {
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.addEventListener("click", () => this.navigateTo(b.dataset.screen))
    );
  }
};

// ── Módulo Easter Egg (detecção de DevTools) ──────────────────────────────────
// Mantido apenas para fins didáticos — demonstra detecção de ferramentas de desenvolvedor
const easterEggModule = {
  lastShownAt: 0,
  devtoolsOpen: false,
  maxShows: 2,
  storageKey: "cantina_egg_count",

  getCount() { return Number(localStorage.getItem(this.storageKey) || 0); },
  incrementCount() { localStorage.setItem(this.storageKey, String(this.getCount() + 1)); },
  canShow() { return this.getCount() < this.maxShows; },

  bind() {
    // Detecta atalhos de DevTools (F12, Ctrl+Shift+I/J/C)
    document.addEventListener("keydown", (e) => {
      const openByF12 = e.key === "F12";
      const openByCombo = e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes((e.key || "").toUpperCase());
      if (openByF12 || openByCombo) this.show();
    });

    // Detecta abertura via tamanho de janela
    setInterval(() => {
      const isOpen = (window.outerWidth - window.innerWidth) > 160 || (window.outerHeight - window.innerHeight) > 160;
      if (isOpen && !this.devtoolsOpen) this.show();
      this.devtoolsOpen = isOpen;
    }, 900);
  },

  show() {
    if (!this.canShow()) return;
    const now = Date.now();
    if (now - this.lastShownAt < 3000) return;
    this.lastShownAt = now;
    this.incrementCount();
    ui.toast("🔍 Easter egg: modo QA secreto desbloqueado!");

    const existing = document.querySelector("#easterEggOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "easterEggOverlay";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9999",
      background: "radial-gradient(circle at top right, rgba(37,99,235,.24), transparent 45%), radial-gradient(circle at bottom left, rgba(16,185,129,.24), transparent 45%)",
      animation: "eggPulse .8s ease-in-out infinite alternate"
    });
    document.body.appendChild(overlay);

    if (!document.getElementById("eggStyle")) {
      const style = document.createElement("style");
      style.id = "eggStyle";
      style.textContent = `@keyframes eggPulse { from { opacity: .35; } to { opacity: .65; } }`;
      document.head.appendChild(style);
    }
    setTimeout(() => overlay.remove(), 2400);
  }
};

// ── Inicialização da Aplicação ────────────────────────────────────────────────
function bootstrap() {
  setGuestMenuView();        // Estado inicial: tela de menu para visitantes
  authModule.bind();         // Formulários e botões de autenticação
  authModule.watch();        // Observer de estado de login (Firebase Auth)
  productModule.bind();      // Filtros, paginação e cliques no cardápio
  cartModule.bind();         // Carrinho: qty, remoção, limpar, atalhos de pagamento
  ordersModule.bind();       // Finalizar pedido, repetir, recarregar lista
  adminModule.bind();        // CRUD de produtos, status de pedidos
  screenModule.bind();       // Navegação entre telas
  easterEggModule.bind();    // Detecção de DevTools (didático)
}

bootstrap();
