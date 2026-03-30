const POSTS_URL = "posts.json";
const SUPABASE_CONFIG = window.ROTAPORT_SUPABASE || {};
const SUPABASE_COLUMNS = [
  "id",
  "title",
  "slug",
  "category",
  "read_time",
  "published_date",
  "excerpt",
  "points",
  "legacy_url",
  "body_html",
  "status",
  "created_at",
].join(", ");

let supabaseClient = null;

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (value) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

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

const normalizePost = (post) => ({
  id: String(post.id || ""),
  title: String(post.title || "").trim(),
  slug: String(post.slug || "").trim(),
  category: String(post.category || "").trim(),
  readTime: String(post.readTime || post.read_time || "").trim(),
  date: String(post.date || post.published_date || "").trim(),
  excerpt: String(post.excerpt || "").trim(),
  points: Array.isArray(post.points) ? post.points.map((item) => String(item || "").trim()).filter(Boolean) : [],
  legacyUrl: String(post.legacyUrl || post.legacy_url || "").trim(),
  bodyHtml: String(post.bodyHtml || post.body_html || "").trim(),
  status: post.status === "draft" ? "draft" : "published",
});

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildDescription = (post) => {
  const fromBody = stripHtml(post.bodyHtml);
  const source = fromBody || post.excerpt || post.title || "RotaPort Blog yazısı";
  return source.length > 170 ? `${source.slice(0, 167).trim()}...` : source;
};

const sortPosts = (posts) =>
  posts.sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return rightTime - leftTime;
  });

const resolvePostHref = (post) =>
  post.legacyUrl
    ? post.legacyUrl
    : `post.html?slug=${encodeURIComponent(post.slug)}`;

const buildMetaHtml = (post) =>
  [
    post.category,
    post.readTime,
    post.date ? formatDate(post.date) : "",
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");

const fetchLocalPosts = async () => {
  const response = await fetch(POSTS_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Yazılar yüklenemedi.");
  }

  const posts = await response.json();
  return posts.map(normalizePost);
};

const fetchRemotePosts = async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(SUPABASE_CONFIG.postsTable || "blog_posts")
    .select(SUPABASE_COLUMNS)
    .eq("status", "published")
    .order("published_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizePost);
};

const mergePosts = (localPosts, remotePosts) => {
  const merged = new Map();

  localPosts.forEach((post) => {
    const key = post.slug || post.id;
    merged.set(key, post);
  });

  remotePosts.forEach((post) => {
    const key = post.slug || post.id;
    merged.set(key, post);
  });

  return [...merged.values()];
};

const fetchPosts = async () => {
  const localPosts = await fetchLocalPosts().catch(() => []);

  if (!hasSupabaseConfig()) {
    return sortPosts(localPosts.filter((post) => post.status === "published"));
  }

  try {
    const remotePosts = await fetchRemotePosts();
    const source = remotePosts.length > 0 ? mergePosts(localPosts, remotePosts) : localPosts;
    return sortPosts(source.filter((post) => post.status === "published"));
  } catch (error) {
    console.warn("Supabase blog akisi okunamadi, yerel veri kullaniliyor.", error);
    return sortPosts(localPosts.filter((post) => post.status === "published"));
  }
};

const renderCategories = (posts) => {
  const categoryWrap = document.getElementById("blog-category-list");

  if (!categoryWrap) {
    return;
  }

  const unique = [...new Set(posts.map((post) => post.category).filter(Boolean))];
  categoryWrap.innerHTML = unique
    .map((category) => `<span class="topic-chip">${escapeHtml(category)}</span>`)
    .join("");
};

const renderIndex = (posts) => {
  const container = document.getElementById("post-list");

  if (!container) {
    return;
  }

  container.innerHTML = posts
    .map((post) => {
      return `
        <article class="post-card post-row reveal is-visible">
          <h2>${escapeHtml(post.title)}</h2>
          <a class="post-link" href="${escapeHtml(resolvePostHref(post))}">Yazıyı oku</a>
        </article>
      `;
    })
    .join("");
};

const updateMeta = (post) => {
  document.title = `${post.title} | RotaPort Blog`;

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute("content", buildDescription(post));
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && !post.legacyUrl) {
    canonical.setAttribute("href", `https://rotaport.org/post.html?slug=${encodeURIComponent(post.slug)}`);
  }
};

const renderPost = (posts) => {
  const article = document.getElementById("post-article");

  if (!article) {
    return;
  }

  const slug = new URLSearchParams(window.location.search).get("slug");
  const post = posts.find((item) => item.slug === slug);

  if (!post) {
    article.innerHTML = `
      <p class="article-intro">
        Aradığınız yazı bulunamadı. Admin panelden slug bilgisini kontrol edip tekrar deneyin.
      </p>
    `;
    return;
  }

  if (post.legacyUrl) {
    window.location.replace(resolvePostHref(post));
    return;
  }

  updateMeta(post);

  const breadcrumb = document.getElementById("post-breadcrumb");
  const category = document.getElementById("post-category");
  const title = document.getElementById("post-title");
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="index.html">Ana Sayfa</a>
      <span>/</span>
      <a href="blog.html">Blog</a>
      <span>/</span>
      <span>${escapeHtml(post.title)}</span>
    `;
  }

  if (category) {
    category.textContent = post.category || "RotaPort Blog";
  }

  if (title) {
    title.textContent = post.title;
  }

  article.innerHTML = post.bodyHtml || "<p class='article-intro'>Bu yazının gövdesi henüz girilmedi.</p>";
};

const bootBlog = async () => {
  try {
    const posts = await fetchPosts();
    renderCategories(posts);
    renderIndex(posts);
    renderPost(posts);
  } catch (error) {
    const list = document.getElementById("post-list");
    const article = document.getElementById("post-article");

    if (list) {
      list.innerHTML = `
        <article class="post-card">
          <div class="post-meta"><span>Hata</span></div>
          <h2>Yazılar yüklenemedi</h2>
          <p>Blog verisi okunamadı. Supabase ayarını veya yedek veri dosyasını kontrol edin.</p>
        </article>
      `;
    }

    if (article) {
      article.innerHTML = `
        <p class="article-intro">
          Yazı içeriği yüklenemedi. Supabase bağlantısını veya yedek veri dosyasını kontrol edin.
        </p>
      `;
    }
  }
};

bootBlog();
