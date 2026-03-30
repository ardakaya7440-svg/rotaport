const authScreen = document.getElementById("auth-screen");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const authStatus = document.getElementById("auth-status");
const sessionEmail = document.getElementById("session-email");
const signOutButton = document.getElementById("sign-out");
const configNote = document.getElementById("config-note");

const listEl = document.getElementById("post-list");
const formEl = document.getElementById("post-form");
const searchInput = document.getElementById("search-input");
const newButton = document.getElementById("new-post");
const deleteButton = document.getElementById("delete-post");
const saveButton = document.getElementById("save-post");
const statusLine = document.getElementById("status-line");
const editorTitle = document.getElementById("editor-title");
const cardPreview = document.getElementById("card-preview");
const articlePreview = document.getElementById("article-preview");
const snippetButtons = document.querySelectorAll("[data-snippet]");
const publicUrlEl = document.getElementById("public-url");
const openPublicButton = document.getElementById("open-public");
const copyPublicButton = document.getElementById("copy-public");

const SUPABASE_CONFIG = window.ROTAPORT_SUPABASE || {};
const POSTS_TABLE = SUPABASE_CONFIG.postsTable || "blog_posts";
const POST_TEMPLATE = document.body.dataset.postTemplate || "post.html";
const LEGACY_PREFIX = document.body.dataset.legacyPrefix || "";

let posts = [];
let selectedId = null;
let supabaseClient = null;

const emptyPost = () => ({
  id: "",
  status: "draft",
  category: "RotaPort Blog",
  title: "",
  slug: "",
  readTime: "8 dk okuma",
  date: new Date().toISOString().slice(0, 10),
  legacyUrl: "",
  excerpt: "",
  points: [],
  bodyHtml: "",
});

const slugify = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const hasSupabaseConfig = () =>
  Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && window.supabase?.createClient);

const getSupabaseClient = () => {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }

  return supabaseClient;
};

const setAuthStatus = (text) => {
  authStatus.textContent = text;
};

const setStatus = (text) => {
  statusLine.textContent = text;
};

const setEditorBusy = (isBusy) => {
  if (saveButton) {
    saveButton.disabled = isBusy;
    saveButton.textContent = isBusy ? "Kaydediliyor..." : "Kaydet";
  }

  if (deleteButton) {
    deleteButton.disabled = isBusy;
  }
};

const buildPublicUrl = (post) => {
  const slug = post.slug || slugify(post.title);

  if (post.legacyUrl) {
    return `${LEGACY_PREFIX}${post.legacyUrl}`;
  }

  if (!slug) {
    return "";
  }

  return `${POST_TEMPLATE}?slug=${encodeURIComponent(slug)}`;
};

const toAbsoluteUrl = (relativeUrl) => {
  if (!relativeUrl) {
    return "";
  }

  return new URL(relativeUrl, window.location.origin).toString();
};

const getFormData = () => {
  const formData = new FormData(formEl);

  return {
    id: String(formData.get("id") || "").trim(),
    status: String(formData.get("status") || "draft"),
    category: String(formData.get("category") || "RotaPort Blog").trim() || "RotaPort Blog",
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim(),
    readTime: String(formData.get("readTime") || "").trim(),
    date: String(formData.get("date") || "").trim(),
    legacyUrl: String(formData.get("legacyUrl") || "").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    points: String(formData.get("points") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    bodyHtml: String(formData.get("bodyHtml") || "").trim(),
  };
};

const normalizeRow = (row) => ({
  id: String(row.id || ""),
  status: row.status === "draft" ? "draft" : "published",
  category: String(row.category || "RotaPort Blog").trim() || "RotaPort Blog",
  title: String(row.title || "").trim(),
  slug: String(row.slug || "").trim(),
  readTime: String(row.read_time || "").trim(),
  date: String(row.published_date || "").trim(),
  legacyUrl: String(row.legacy_url || "").trim(),
  excerpt: String(row.excerpt || "").trim(),
  points: Array.isArray(row.points) ? row.points.map((item) => String(item || "").trim()).filter(Boolean) : [],
  bodyHtml: String(row.body_html || "").trim(),
});

const mapPayloadToRow = (payload, userId) => ({
  title: payload.title,
  slug: payload.slug,
  category: payload.category || "RotaPort Blog",
  read_time: payload.readTime,
  published_date: payload.date || null,
  excerpt: payload.excerpt,
  points: payload.points,
  legacy_url: payload.legacyUrl,
  body_html: payload.bodyHtml,
  status: payload.status === "published" ? "published" : "draft",
  author_user_id: userId || null,
});

const fillForm = (post) => {
  formEl.elements.id.value = post.id || "";
  formEl.elements.status.value = post.status || "draft";
  formEl.elements.category.value = post.category || "RotaPort Blog";
  formEl.elements.title.value = post.title || "";
  formEl.elements.slug.value = post.slug || "";
  formEl.elements.readTime.value = post.readTime || "";
  formEl.elements.date.value = post.date || "";
  formEl.elements.legacyUrl.value = post.legacyUrl || "";
  formEl.elements.excerpt.value = post.excerpt || "";
  formEl.elements.points.value = (post.points || []).join("\n");
  formEl.elements.bodyHtml.value = post.bodyHtml || "";

  selectedId = post.id || null;
  editorTitle.textContent = post.title ? `Düzenleniyor: ${post.title}` : "Yeni yazı oluştur";
  renderPreview();
};

const renderList = () => {
  const term = (searchInput.value || "").trim().toLocaleLowerCase("tr-TR");
  const filtered = posts.filter((post) => {
    const haystack = [post.title, post.slug].join(" ").toLocaleLowerCase("tr-TR");
    return haystack.includes(term);
  });

  listEl.innerHTML = filtered
    .map((post) => {
      const isActive = post.id === selectedId;
      const legacyBadge = post.legacyUrl ? '<span class="status-pill legacy">legacy</span>' : "";

      return `
        <button class="post-item ${isActive ? "is-active" : ""}" type="button" data-id="${escapeHtml(post.id)}">
          <strong>${escapeHtml(post.title || "Başlıksız içerik")}</strong>
          <div class="post-meta-line">
            <span class="status-pill ${escapeHtml(post.status)}">${escapeHtml(post.status)}</span>
            ${legacyBadge}
            <span>${escapeHtml(post.date || "-")}</span>
          </div>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const post = posts.find((item) => item.id === button.dataset.id);
      if (post) {
        fillForm(post);
        renderList();
      }
    });
  });
};

const renderPreview = () => {
  const post = getFormData();
  const slug = post.slug || slugify(post.title);
  const points = post.points.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const publicUrl = buildPublicUrl(post);
  const absoluteUrl = toAbsoluteUrl(publicUrl);

  publicUrlEl.textContent = absoluteUrl || "Slug oluşunca yayın linki burada görünecek.";
  openPublicButton.disabled = !publicUrl;
  copyPublicButton.disabled = !publicUrl;

  cardPreview.innerHTML = `
    <div class="preview-card-meta">
      <span>${escapeHtml(post.readTime || "Okuma süresi")}</span>
      <span>${escapeHtml(post.date || "Tarih")}</span>
    </div>
    <h3>${escapeHtml(post.title || "Önizleme başlığı")}</h3>
    <p>${escapeHtml(post.excerpt || "Kısa özet burada görünecek.")}</p>
    <ul class="preview-points">${points || "<li>Madde önizlemesi burada görünür.</li>"}</ul>
    <p><strong>Slug:</strong> ${escapeHtml(slug || "otomatik-olusturulacak")}</p>
    <p><strong>Yayın linki:</strong> ${escapeHtml(absoluteUrl || "Henüz hazır değil")}</p>
    <p><strong>Bağlantı tipi:</strong> ${post.legacyUrl ? "Legacy URL" : "Dinamik yazı"}</p>
  `;

  articlePreview.innerHTML =
    post.bodyHtml ||
    "<p>Yazı gövdesi girildiğinde burada canlı önizleme görünür. Sadece kart yönetmek istersen gövdeyi boş bırakabilirsin.</p>";
};

const refreshPosts = async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase yapılandırması eksik.");
  }

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("id, title, slug, category, read_time, published_date, excerpt, points, legacy_url, body_html, status, created_at")
    .order("published_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  posts = (data || []).map(normalizeRow);
  renderList();

  if (!selectedId) {
    fillForm(posts[0] || emptyPost());
    return;
  }

  const current = posts.find((post) => post.id === selectedId);
  fillForm(current || emptyPost());
};

const savePost = async (event) => {
  event.preventDefault();

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase yapılandırması eksik.");
      return;
    }

    const payload = getFormData();
    if (!payload.title) {
      setStatus("Başlık zorunlu.");
      return;
    }

    payload.slug = payload.slug || slugify(payload.title);
    setEditorBusy(true);
    setStatus("Kaydediliyor...");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const row = mapPayloadToRow(payload, session?.user?.id);
    let response;

    if (payload.id) {
      response = await supabase.from(POSTS_TABLE).update(row).eq("id", payload.id).select().single();
    } else {
      response = await supabase.from(POSTS_TABLE).insert(row).select().single();
    }

    if (response.error) {
      setStatus(`Kaydetme sırasında hata oluştu: ${response.error.message}`);
      return;
    }

    selectedId = response.data?.id || payload.id || null;
    setStatus("Yazı kaydedildi.");
    await refreshPosts();
  } catch (error) {
    setStatus(`Beklenmeyen hata: ${error.message || "Kaydetme işlemi tamamlanamadı."}`);
  } finally {
    setEditorBusy(false);
  }
};

const deletePost = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    setStatus("Supabase yapılandırması eksik.");
    return;
  }

  const payload = getFormData();
  if (!payload.id) {
    setStatus("Silinecek kayıt seçili değil.");
    return;
  }

  if (!window.confirm("Bu kaydı silmek istediğine emin misin?")) {
    return;
  }

  const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", payload.id);
  if (error) {
    setStatus(`Silme sırasında hata oluştu: ${error.message}`);
    return;
  }

  selectedId = null;
  fillForm(emptyPost());
  setStatus("Yazı silindi.");
  await refreshPosts();
};

const insertSnippet = (snippet) => {
  const textarea = formEl.elements.bodyHtml;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const current = textarea.value;

  textarea.value = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  renderPreview();
};

const setSignedInState = (session) => {
  authScreen.classList.add("is-hidden");
  adminApp.classList.remove("is-hidden");
  sessionEmail.textContent = session?.user?.email || "Giriş yapıldı";
};

const setSignedOutState = () => {
  adminApp.classList.add("is-hidden");
  authScreen.classList.remove("is-hidden");
  sessionEmail.textContent = "-";
  setAuthStatus("Girişten sonra panel açılacak.");
};

const bootAuth = async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    loginButton.disabled = true;
    setAuthStatus("Önce supabase-config.js dosyasını doldurman gerekiyor.");
    configNote.classList.add("is-warning");
    return;
  }

  configNote.classList.add("is-ready");
  configNote.innerHTML = `
    <strong>Canlı bağlantı hazır</strong>
    <p>
      Supabase yapılandırması algılandı. Yetkili admin hesabınla giriş yaptığında canlı blog
      verisini yönetebileceksin.
    </p>
  `;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    setSignedInState(session);
    await refreshPosts();
  }

  supabase.auth.onAuthStateChange(async (event, sessionState) => {
    if (sessionState) {
      setSignedInState(sessionState);
      await refreshPosts();
      return;
    }

    setSignedOutState();
    fillForm(emptyPost());
    renderList();
  });
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const supabase = getSupabaseClient();
  if (!supabase) {
    setAuthStatus("Supabase yapılandırması eksik.");
    return;
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setAuthStatus("E-posta ve şifre zorunlu.");
    return;
  }

  loginButton.disabled = true;
  setAuthStatus("Giriş deneniyor...");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  loginButton.disabled = false;

  if (error) {
    setAuthStatus(`Giriş başarısız: ${error.message}`);
    return;
  }

  setSignedInState(data.session);
  setAuthStatus("Giriş başarılı.");
  loginForm.reset();
  await refreshPosts();
});

signOutButton.addEventListener("click", async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
  setSignedOutState();
});

newButton.addEventListener("click", () => {
  selectedId = null;
  fillForm(emptyPost());
  renderList();
  setStatus("Yeni yazı taslağı hazır.");
});

deleteButton.addEventListener("click", deletePost);
formEl.addEventListener("submit", savePost);
formEl.addEventListener("input", renderPreview);
searchInput.addEventListener("input", renderList);

formEl.elements.title.addEventListener("blur", () => {
  if (!formEl.elements.slug.value.trim()) {
    formEl.elements.slug.value = slugify(formEl.elements.title.value);
    renderPreview();
  }
});

snippetButtons.forEach((button) => {
  button.addEventListener("click", () => insertSnippet(button.dataset.snippet));
});

openPublicButton.addEventListener("click", () => {
  const publicUrl = buildPublicUrl(getFormData());

  if (!publicUrl) {
    setStatus("Önce başlık veya slug oluştur.");
    return;
  }

  window.open(publicUrl, "_blank", "noopener,noreferrer");
});

copyPublicButton.addEventListener("click", async () => {
  const publicUrl = toAbsoluteUrl(buildPublicUrl(getFormData()));

  if (!publicUrl) {
    setStatus("Kopyalanacak yayın linki henüz hazır değil.");
    return;
  }

  try {
    await navigator.clipboard.writeText(publicUrl);
    setStatus("Yayın linki kopyalandı.");
  } catch (error) {
    setStatus("Link kopyalanamadı. Tarayıcı iznini kontrol et.");
  }
});

fillForm(emptyPost());
renderPreview();
bootAuth();
