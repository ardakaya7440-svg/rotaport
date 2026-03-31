const modeButtons = document.querySelectorAll("[data-mode]");
const calcPanels = document.querySelectorAll("[data-calc-panel]");
const calcForms = document.querySelectorAll("[data-form]");

const formatTRY = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatCurrency = (value, currency) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const getNumber = (form, name) => {
  const input = form.elements.namedItem(name);
  return Number.parseFloat(input?.value || "0") || 0;
};

const getString = (form, name) => {
  const input = form.elements.namedItem(name);
  return String(input?.value || "").trim();
};

const setOutput = (key, value) => {
  const target = document.querySelector(`[data-output="${key}"]`);

  if (target) {
    target.textContent = value;
  }
};

const setMode = (nextMode) => {
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === nextMode);
  });

  calcPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.calcPanel === nextMode);
  });
};

const renderImport = () => {
  const form = document.querySelector('[data-form="import"]');

  if (!form) {
    return;
  }

  const currency = getString(form, "currency") || "USD";
  const unitPrice = getNumber(form, "unitPrice");
  const quantity = Math.max(1, getNumber(form, "quantity"));
  const fxRate = Math.max(0.0001, getNumber(form, "fxRate"));
  const shipping = getNumber(form, "shipping");
  const taxRate = getNumber(form, "taxRate") / 100;
  const localCosts = getNumber(form, "localCosts");
  const targetMargin = getNumber(form, "targetMargin") / 100;

  const productForeign = unitPrice * quantity;
  const cifTry = (productForeign + shipping) * fxRate;
  const taxAmount = cifTry * Math.max(0, taxRate);
  const totalCost = cifTry + taxAmount + localCosts;
  const unitCost = totalCost / quantity;
  const targetSell = unitCost * (1 + Math.max(0, targetMargin));
  const shippingRatio = productForeign > 0 ? (shipping / productForeign) * 100 : 0;

  const note =
    shippingRatio > 18
      ? `Tasima yuku urun bedeline gore yuksek gorunuyor. Toplam maliyet ${formatTRY(totalCost)} seviyesinde; navlun modelini ayrica yeniden dusunmek faydali olabilir.`
      : `Toplam maliyet ${formatTRY(totalCost)} seviyesinde. Birim landed cost ${formatTRY(unitCost)} ciktigi icin satis fiyatini en az ${formatTRY(targetSell)} civarinda test etmek mantikli olur.`;

  setOutput("import-total", formatTRY(totalCost));
  setOutput("import-unit", `${formatTRY(unitCost)} / birim`);
  setOutput("import-target", `${formatTRY(targetSell)} / birim`);
  setOutput("import-note", note);
};

const renderExport = () => {
  const form = document.querySelector('[data-form="export"]');

  if (!form) {
    return;
  }

  const currency = getString(form, "currency") || "USD";
  const unitCostTry = getNumber(form, "unitCostTry");
  const quantity = Math.max(1, getNumber(form, "quantity"));
  const fxRate = Math.max(0.0001, getNumber(form, "fxRate"));
  const extraCosts = getNumber(form, "extraCosts");
  const commissionRate = getNumber(form, "commissionRate") / 100;
  const targetMargin = getNumber(form, "targetMargin") / 100;

  const productionTotal = unitCostTry * quantity;
  const subtotal = productionTotal + extraCosts;
  const commissionAmount = subtotal * Math.max(0, commissionRate);
  const totalCost = subtotal + commissionAmount;
  const breakevenUnitTry = totalCost / quantity;
  const targetUnitTry = breakevenUnitTry * (1 + Math.max(0, targetMargin));
  const breakevenUnitForeign = breakevenUnitTry / fxRate;
  const targetUnitForeign = targetUnitTry / fxRate;
  const estimatedGrossProfit = targetUnitTry * quantity - totalCost;

  const note =
    targetMargin < 0.15
      ? `Hedef marj dusuk gorunuyor. Bu seviyede teklif verirsen toplam brut alan yaklasik ${formatTRY(estimatedGrossProfit)} olur; operasyon surprizleri icin tampon birakmak isteyebilirsin.`
      : `Hedef teklif seviyesinde toplam brut alan yaklasik ${formatTRY(estimatedGrossProfit)} olur. Bu, teklif verirken nefes alani birakmak icin daha dengeli bir gorunum sunar.`;

  setOutput("export-total", formatTRY(totalCost));
  setOutput("export-breakeven", `${formatCurrency(breakevenUnitForeign, currency)} / birim`);
  setOutput("export-target", `${formatCurrency(targetUnitForeign, currency)} / birim`);
  setOutput("export-note", note);
};

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

calcForms.forEach((form) => {
  form.addEventListener("input", () => {
    if (form.dataset.form === "import") {
      renderImport();
      return;
    }

    renderExport();
  });
});

renderImport();
renderExport();
