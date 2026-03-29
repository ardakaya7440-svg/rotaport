const siteHeader = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll(".reveal");
const contactForm = document.getElementById("contact-form");
const statusField = document.getElementById("form-status");
const yearField = document.getElementById("year");
const whatsappLinks = document.querySelectorAll(".js-whatsapp-link");

const normalizeWhatsapp = (value) => String(value || "").replace(/\D/g, "");
const getWhatsappNumber = () => normalizeWhatsapp(document.body?.dataset.whatsapp || "");

const buildWhatsappUrl = (message) => {
  const whatsappNumber = getWhatsappNumber();

  if (!whatsappNumber) {
    return "";
  }

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
};

const updateWhatsappLinks = () => {
  whatsappLinks.forEach((link) => {
    const defaultMessage =
      link.dataset.whatsappMessage || "Merhaba, dış ticaret danışmanlığı hakkında bilgi almak istiyorum.";
    const whatsappUrl = buildWhatsappUrl(defaultMessage);

    if (!whatsappUrl) {
      link.setAttribute("href", "#iletisim");
      link.removeAttribute("target");
      link.removeAttribute("rel");
      return;
    }

    link.setAttribute("href", whatsappUrl);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
};

if (yearField) {
  yearField.textContent = new Date().getFullYear();
}

updateWhatsappLinks();

const syncHeaderState = () => {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("scrolled", window.scrollY > 12);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

if (navToggle && siteNav) {
  const setMenuState = (isOpen) => {
    siteNav.dataset.open = String(isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  };

  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.dataset.open === "true";
    setMenuState(!isOpen);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -30px 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const whatsappNumber = getWhatsappNumber();
    const formData = new FormData(contactForm);
    const fullName = String(formData.get("full-name") || "").trim();
    const company = String(formData.get("company") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const service = String(formData.get("service") || "").trim();
    const timeline = String(formData.get("timeline") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!whatsappNumber) {
      if (statusField) {
        statusField.textContent =
          "WhatsApp numarası henüz eklenmedi. index.html içindeki REPLACE_WITH_WHATSAPP alanını gerçek numaranızla güncelleyelim.";
      }
      return;
    }

    const lines = [
      "Merhaba, web sitesi üzerinden iletişime geçiyorum.",
      "",
      `Ad soyad: ${fullName || "-"}`,
      `Firma: ${company || "-"}`,
      `Telefon: ${phone || "-"}`,
      `E-posta: ${email || "-"}`,
      `İhtiyaç alanı: ${service || "-"}`,
      `Hedef zaman: ${timeline || "-"}`,
      "",
      "Kısa not:",
      message || "-",
    ];

    const whatsappUrl = buildWhatsappUrl(lines.join("\n"));

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    if (statusField) {
      statusField.textContent = "WhatsApp'ta hazır mesaj açıldı.";
    }

    contactForm.reset();
  });
}
