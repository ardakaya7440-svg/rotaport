const tabButtons = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll("[data-panel]");
const forms = document.querySelectorAll("[data-form]");
const copyButtons = document.querySelectorAll("[data-copy]");

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

const setText = (key, value) => {
  const target = document.querySelector(`[data-result="${key}"]`);

  if (target) {
    target.textContent = value;
  }
};

const setSummary = (type, text) => {
  const target = document.querySelector(`[data-summary="${type}"]`);

  if (target) {
    target.textContent = text;
  }
};

const setInsights = (type, items) => {
  const list = document.querySelector(`[data-insights="${type}"]`);

  if (!list) {
    return;
  }

  list.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
};

const saveFormState = (form) => {
  const type = form.dataset.form;
  const payload = {};

  Array.from(form.elements).forEach((element) => {
    if (!element.name) {
      return;
    }

    payload[element.name] = element.value;
  });

  localStorage.setItem(`rotaport-cost-robot-${type}`, JSON.stringify(payload));
};

const loadFormState = (form) => {
  const type = form.dataset.form;
  const saved = localStorage.getItem(`rotaport-cost-robot-${type}`);

  if (!saved) {
    return;
  }

  try {
    const payload = JSON.parse(saved);

    Object.entries(payload).forEach(([name, value]) => {
      const element = form.elements.namedItem(name);

      if (element) {
        element.value = value;
      }
    });
  } catch (error) {
    console.warn("Kaydedilen form durumu okunamadı:", error);
  }
};

const calculateImport = () => {
  const form = document.querySelector('[data-form="import"]');

  if (!form) {
    return;
  }

  const foreignCurrency = getString(form, "foreignCurrency") || "USD";
  const unitPrice = getNumber(form, "unitPrice");
  const quantity = Math.max(1, getNumber(form, "quantity"));
  const fxRate = Math.max(0.0001, getNumber(form, "fxRate"));
  const freightForeign = getNumber(form, "freightForeign");
  const insuranceForeign = getNumber(form, "insuranceForeign");
  const customsRate = getNumber(form, "customsRate") / 100;
  const additionalRate = getNumber(form, "additionalRate") / 100;
  const vatRate = getNumber(form, "vatRate") / 100;
  const brokerFee = getNumber(form, "brokerFee");
  const warehouseFee = getNumber(form, "warehouseFee");
  const inlandTransport = getNumber(form, "inlandTransport");
  const otherLocal = getNumber(form, "otherLocal");
  const targetMarkup = getNumber(form, "targetMarkup") / 100;

  const productForeign = unitPrice * quantity;
  const logisticsForeign = freightForeign + insuranceForeign;
  const productTry = productForeign * fxRate;
  const cifTry = (productForeign + logisticsForeign) * fxRate;
  const customsTax = cifTry * customsRate;
  const additionalTax = cifTry * additionalRate;
  const localTotal = brokerFee + warehouseFee + inlandTransport + otherLocal;
  const vatBase = cifTry + customsTax + additionalTax + localTotal;
  const vatAmount = vatBase * vatRate;
  const taxTotal = customsTax + additionalTax + vatAmount;
  const totalCost = vatBase + vatAmount;
  const unitCost = totalCost / quantity;
  const suggestedSell = unitCost * (1 + targetMarkup);
  const fxStress = (productForeign + logisticsForeign) * (fxRate * 0.05);

  const logisticsRatio = productTry > 0 ? ((logisticsForeign * fxRate) / productTry) * 100 : 0;
  const taxRatio = cifTry > 0 ? (taxTotal / cifTry) * 100 : 0;
  const localRatio = cifTry > 0 ? (localTotal / cifTry) * 100 : 0;

  const insights = [];

  if (logisticsRatio > 18) {
    insights.push(
      "Navlun ve sigorta yükü ürün bedeline göre yüksek görünüyor; taşıma tipi veya sipariş hacmi yeniden düşünülmeli."
    );
  } else {
    insights.push(
      "Taşıma maliyeti ürün bedeline göre yönetilebilir seviyede; tedarikçi ve teslim modeli doğruysa plan sürdürülebilir olabilir."
    );
  }

  if (taxRatio > 35) {
    insights.push(
      "Vergi yükü CIF tabanına göre ciddi seviyede; GTİP ve ek vergi varsayımlarını ayrıca doğrulamak önemli."
    );
  } else {
    insights.push(
      "Vergi yükü yüksek ama aşırı değil; yine de GTİP ve ek vergi kalemleri için resmi teyit alınmalı."
    );
  }

  if (localRatio > 15) {
    insights.push(
      "Yerel operasyon giderleri yükselmiş; müşavirlik, ardiye ve yurtiçi nakliye kalemleri ayrı ayrı pazarlık konusu olabilir."
    );
  } else {
    insights.push(
      "Yerel operasyon giderleri toplam yapı içinde kontrol edilebilir seviyede görünüyor."
    );
  }

  if (targetMarkup < 0.15) {
    insights.push(
      "Hedef satış marjı düşük; ilk sevkiyatta görünmeyen maliyetler için güvenlik tamponu bırakmak daha sağlıklı olur."
    );
  } else {
    insights.push(
      "Girilen hedef marj, ilk sevkiyatta operasyonel sürprizlere karşı makul bir tampon oluşturabilir."
    );
  }

  const summary = [
    "İTHALAT MALİYET ÖZETİ",
    `Urun bedeli: ${formatCurrency(productForeign, foreignCurrency)} / ${formatTRY(productTry)}`,
    `CIF tabani: ${formatTRY(cifTry)}`,
    `Vergi toplami: ${formatTRY(taxTotal)} (Gumruk ${formatTRY(customsTax)} + Ilave ${formatTRY(additionalTax)} + KDV ${formatTRY(vatAmount)})`,
    `Yerel giderler: ${formatTRY(localTotal)}`,
    `Toplam ithalat maliyeti: ${formatTRY(totalCost)}`,
    `Birim landed cost: ${formatTRY(unitCost)}`,
    `Hedef satis fiyati: ${formatTRY(suggestedSell)}`,
    `%5 kur stresi: ${formatTRY(fxStress)}`,
  ].join("\n");

  setText("import-productTry", formatTRY(productTry));
  setText("import-productForeign", formatCurrency(productForeign, foreignCurrency));
  setText("import-cif", formatTRY(cifTry));
  setText("import-taxTotal", formatTRY(taxTotal));
  setText(
    "import-taxBreakdown",
    `Gümrük ${formatTRY(customsTax)} + İlave ${formatTRY(additionalTax)} + KDV ${formatTRY(vatAmount)}`
  );
  setText("import-localTotal", formatTRY(localTotal));
  setText("import-total", formatTRY(totalCost));
  setText("import-unitCost", formatTRY(unitCost));
  setText("import-sellPrice", formatTRY(suggestedSell));
  setText("import-fxStress", formatTRY(fxStress));
  setInsights("import", insights);
  setSummary("import", summary);
};

const buildScenario = (subtotal, marginRate, quantity, fxRate, currency) => {
  const totalTry = subtotal * (1 + marginRate);
  const unitTry = totalTry / quantity;
  const unitForeign = unitTry / fxRate;

  return {
    totalTry,
    unitTry,
    unitForeign,
    foreignLabel: formatCurrency(unitForeign, currency),
    tryLabel: `${formatTRY(unitTry)} / birim`,
  };
};

const calculateExport = () => {
  const form = document.querySelector('[data-form="export"]');

  if (!form) {
    return;
  }

  const quoteCurrency = getString(form, "quoteCurrency") || "USD";
  const quoteFxRate = Math.max(0.0001, getNumber(form, "quoteFxRate"));
  const productionUnitCost = getNumber(form, "productionUnitCost");
  const quantity = Math.max(1, getNumber(form, "quantity"));
  const packagingUnitCost = getNumber(form, "packagingUnitCost");
  const localLogistics = getNumber(form, "localLogistics");
  const customsDocs = getNumber(form, "customsDocs");
  const commissionRate = getNumber(form, "commissionRate") / 100;
  const otherCosts = getNumber(form, "otherCosts");
  const targetMargin = getNumber(form, "targetMargin") / 100;
  const aggressiveMargin = getNumber(form, "aggressiveMargin") / 100;
  const confidentMargin = getNumber(form, "confidentMargin") / 100;

  const productionTotal = productionUnitCost * quantity;
  const packagingTotal = packagingUnitCost * quantity;
  const baseCost = productionTotal + packagingTotal + localLogistics + customsDocs + otherCosts;
  const commissionAmount = baseCost * commissionRate;
  const subtotal = baseCost + commissionAmount;
  const unitBaseCost = subtotal / quantity;
  const breakevenForeign = unitBaseCost / quoteFxRate;
  const aggressiveScenario = buildScenario(
    subtotal,
    Math.max(0, aggressiveMargin),
    quantity,
    quoteFxRate,
    quoteCurrency
  );
  const targetScenario = buildScenario(
    subtotal,
    Math.max(0, targetMargin),
    quantity,
    quoteFxRate,
    quoteCurrency
  );
  const confidentScenario = buildScenario(
    subtotal,
    Math.max(0, confidentMargin),
    quantity,
    quoteFxRate,
    quoteCurrency
  );
  const fxStress = targetScenario.totalTry * 0.05;

  const logisticsRatio = baseCost > 0 ? ((localLogistics + customsDocs) / baseCost) * 100 : 0;
  const packagingRatio = baseCost > 0 ? (packagingTotal / baseCost) * 100 : 0;

  const insights = [];

  if (targetMargin < 0.12) {
    insights.push(
      "Hedef kâr marjı düşük; ilk müşteri kazanımı için anlaşılır ama kur ve operasyon sapması için tampon dar kalabilir."
    );
  } else {
    insights.push(
      "Hedef marj, teklif gücü ile güvenli kârlılık arasında dengeli bir başlangıç seviyesi sunuyor."
    );
  }

  if (logisticsRatio > 18) {
    insights.push(
      "Lojistik ve belge giderleri baz maliyet içinde yüksek ağırlıkta; teslim şekli ve sevkiyat planı yeniden optimize edilebilir."
    );
  } else {
    insights.push(
      "Lojistik yükü baz maliyet içinde yönetilebilir görünüyor; asıl farkı teklif disiplini yaratacaktır."
    );
  }

  if (packagingRatio > 12) {
    insights.push(
      "Ambalaj maliyeti toplam yapı içinde dikkat çekici; müşteri beklentisi ile ambalaj standardı birlikte gözden geçirilebilir."
    );
  } else {
    insights.push(
      "Ambalaj maliyeti teklif yapısını bozmuyor; marjı daha çok lojistik ve komisyon kalemleri etkiliyor."
    );
  }

  if (confidentMargin <= targetMargin) {
    insights.push(
      "Güçlü teklif marjı hedef marjdan düşük veya eşit kalmış; üç senaryo arasında daha net ayrım kurmak satışta işinizi kolaylaştırır."
    );
  } else {
    insights.push(
      "Agresif, hedef ve güçlü teklif seviyeleri arasında anlamlı fark oluşmuş; müşteri segmentine göre esnek fiyat sunabilirsiniz."
    );
  }

  const summary = [
    "IHRACAT TEKLIF OZETI",
    `Toplam baz maliyet: ${formatTRY(baseCost)}`,
    `Komisyon yukü: ${formatTRY(commissionAmount)}`,
    `Basa bas birim teklif: ${formatCurrency(breakevenForeign, quoteCurrency)} / ${formatTRY(unitBaseCost)}`,
    `Agresif teklif: ${aggressiveScenario.foreignLabel} / ${aggressiveScenario.tryLabel}`,
    `Hedef teklif: ${targetScenario.foreignLabel} / ${targetScenario.tryLabel}`,
    `Guclu teklif: ${confidentScenario.foreignLabel} / ${confidentScenario.tryLabel}`,
    `%5 kur sapmasi gelir etkisi: ${formatTRY(fxStress)}`,
  ].join("\n");

  setText("export-baseCost", formatTRY(baseCost));
  setText("export-commission", formatTRY(commissionAmount));
  setText("export-breakevenForeign", formatCurrency(breakevenForeign, quoteCurrency));
  setText("export-breakevenTry", `${formatTRY(unitBaseCost)} / birim`);
  setText("export-aggressiveForeign", aggressiveScenario.foreignLabel);
  setText("export-aggressiveTry", aggressiveScenario.tryLabel);
  setText("export-targetForeign", targetScenario.foreignLabel);
  setText("export-targetTry", targetScenario.tryLabel);
  setText("export-confidentForeign", confidentScenario.foreignLabel);
  setText("export-confidentTry", confidentScenario.tryLabel);
  setText("export-unitBaseCost", formatTRY(unitBaseCost));
  setText("export-fxStress", formatTRY(fxStress));
  setInsights("export", insights);
  setSummary("export", summary);
};

const recalculate = () => {
  calculateImport();
  calculateExport();
};

const activateTab = (target) => {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === target);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === target);
  });
};

const copyText = async (text) => {
  if (!navigator.clipboard?.writeText) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return;
  }

  await navigator.clipboard.writeText(text);
};

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

forms.forEach((form) => {
  loadFormState(form);

  form.addEventListener("input", () => {
    saveFormState(form);
    recalculate();
  });

  form.addEventListener("change", () => {
    saveFormState(form);
    recalculate();
  });
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const type = button.dataset.copy;
    const target = document.querySelector(`[data-summary="${type}"]`);
    const previous = button.textContent;

    if (!target) {
      return;
    }

    try {
      await copyText(target.textContent || "");
      button.textContent = "Kopyalandı";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1600);
    } catch (error) {
      button.textContent = "Kopyalanamadı";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1600);
    }
  });
});

activateTab("import");
recalculate();
