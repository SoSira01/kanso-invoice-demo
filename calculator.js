(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KansoCalculator = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CURRENCIES = {
    USD: { code: "USD", symbol: "$", locale: "en-US", decimals: 2 },
    EUR: { code: "EUR", symbol: "€", locale: "en-US", decimals: 2 },
    GBP: { code: "GBP", symbol: "£", locale: "en-GB", decimals: 2 },
    THB: { code: "THB", symbol: "฿", locale: "th-TH", decimals: 2 },
    SGD: { code: "SGD", symbol: "S$", locale: "en-SG", decimals: 2 },
    JPY: { code: "JPY", symbol: "¥", locale: "ja-JP", decimals: 0 },
  };

  function getCurrencyConfig(currencyCode) {
    return CURRENCIES[currencyCode] || CURRENCIES.USD;
  }

  function toSafeNonNegative(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return num;
  }

  function roundCurrency(value, decimals) {
    const places = Number.isInteger(decimals) ? decimals : 2;
    const factor = Math.pow(10, places);
    const safe = Number.isFinite(value) ? value : 0;
    return Number((Math.round((safe + Number.EPSILON) * factor) / factor).toFixed(places));
  }

  function calculateDocument(input) {
    const data = input || {};
    const currency = getCurrencyConfig(data.currency);
    const decimals = currency.decimals;
    const rawItems = Array.isArray(data.items) ? data.items : [];

    const items = rawItems.map(function (item) {
      const qty = toSafeNonNegative(item && item.qty);
      const rate = toSafeNonNegative(item && item.rate);
      const amount = roundCurrency(qty * rate, decimals);
      return {
        description: item && item.description ? String(item.description) : "",
        qty: qty,
        rate: rate,
        amount: amount,
      };
    });

    const subtotal = roundCurrency(
      items.reduce(function (sum, item) {
        return sum + item.amount;
      }, 0),
      decimals
    );

    const discountType = data.discountType === "fixed" ? "fixed" : "percent";
    const rawDiscount = toSafeNonNegative(data.discountValue);

    let discountAmount = 0;
    if (discountType === "percent") {
      const cappedPct = Math.min(rawDiscount, 100);
      discountAmount = roundCurrency((subtotal * cappedPct) / 100, decimals);
    } else {
      discountAmount = roundCurrency(Math.min(rawDiscount, subtotal), decimals);
    }

    const taxableAmount = roundCurrency(Math.max(0, subtotal - discountAmount), decimals);
    const taxRate = toSafeNonNegative(data.taxRate);
    const taxAmount = roundCurrency((taxableAmount * taxRate) / 100, decimals);
    const total = roundCurrency(taxableAmount + taxAmount, decimals);

    return {
      currency: currency.code,
      decimals: decimals,
      items: items,
      subtotal: subtotal,
      discountType: discountType,
      discountAmount: discountAmount,
      taxableAmount: taxableAmount,
      taxRate: taxRate,
      taxAmount: taxAmount,
      total: total,
    };
  }

  function formatMoney(amount, currencyCode) {
    const currency = getCurrencyConfig(currencyCode);
    const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    try {
      return new Intl.NumberFormat(currency.locale, {
        style: "currency",
        currency: currency.code,
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
      }).format(safe);
    } catch (_err) {
      return currency.symbol + roundCurrency(safe, currency.decimals).toFixed(currency.decimals);
    }
  }

  return {
    CURRENCIES: CURRENCIES,
    getCurrencyConfig: getCurrencyConfig,
    roundCurrency: roundCurrency,
    calculateDocument: calculateDocument,
    formatMoney: formatMoney,
  };
});
