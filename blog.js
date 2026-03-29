const POSTS_URL = "posts.json";

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

const fetchPosts = async () => {
  const response = await fetch(POSTS_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Yazılar yüklenemedi.");
  }

  const posts = await response.json();

  return posts
    .filter((post) => post.status === "published")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
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
      const points = (post.points || [])
        .slice(0, 3)
        .map((point) => `<li>${escapeHtml(point)}</li>`)
        .join("");

      return `
        <article class="post-card reveal is-visible">
          <div class="post-meta">${buildMetaHtml(post)}</div>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.excerpt)}</p>
          <ul class="post-points">${points}</ul>
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
    description.setAttribute("content", post.excerpt);
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
  const excerpt = document.getElementById("post-excerpt");
  const meta = document.getElementById("post-meta");

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

  if (excerpt) {
    excerpt.textContent = post.excerpt;
  }

  if (meta) {
    meta.innerHTML = buildMetaHtml(post);
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
          <p>Veri dosyası okunamadı. Blog veri akışını ve admin sunucusunu kontrol edin.</p>
        </article>
      `;
    }

    if (article) {
      article.innerHTML = `
        <p class="article-intro">
          Yazı içeriği yüklenemedi. Admin sunucusunun açık olduğundan ve veri dosyasının erişilebilir olduğundan emin olun.
        </p>
      `;
    }
  }
};

bootBlog();
