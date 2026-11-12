(function () {
  "use strict";

  const STORAGE_KEY = "kanso_invoice_studio_v1";
  const MAX_LOGO_BYTES = 1500000;
  const calc = window.KansoCalculator;

  const DOC_META = {
    invoice: {
      heading: "INVOICE",
      prefix: "INV",
      billToLabel: "Bill To",
      dueLabel: "Due Date",
      totalLabel: "Total Due",
      defaultStatus: "unpaid",
    },
    quote: {
      heading: "QUOTE",
      prefix: "QTE",
      billToLabel: "Prepared For",
      dueLabel: "Valid Until",
      totalLabel: "Estimated Total",
      defaultStatus: "draft",
    },
    receipt: {
      heading: "RECEIPT",
      prefix: "RCP",
      billToLabel: "Received From",
      dueLabel: "Payment Date",
      totalLabel: "Amount Paid",
      defaultStatus: "paid",
    },
  };

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function addDaysISO(baseISO, days) {
    const dt = new Date(baseISO + "T00:00:00");
    if (Number.isNaN(dt.getTime())) return baseISO;
    dt.setDate(dt.getDate() + days);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function createSampleState() {
    const issue = getTodayISO();
    return {
      docType: "invoice",
      currency: "USD",
      docNumber: "INV-2026-004",
      status: "unpaid",
      issueDate: issue,
      dueDate: addDaysISO(issue, 14),
      logoDataUrl: "",
      senderName: "Northwind Design Studio",
      senderMeta: "billing@northwind.studio\n42 Market Street, Suite 300\nSan Francisco, CA 94105",
      clientName: "Acme Commerce Ltd.",
      clientMeta: "accounts@acme.co\n180 King Street West\nToronto, ON M5H 1J8",
      items: [
        { description: "Design System & Typography Audit", qty: 1, rate: 1200 },
        { description: "Checkout Flow UI Redesign (Desktop + Mobile)", qty: 1, rate: 1850 },
        { description: "Interactive HTML/CSS Prototype Handoff", qty: 4, rate: 150 },
      ],
      discountType: "percent",
      discountValue: 0,
      taxRate: 7,
      paymentInfo: "ACH / Wire Transfer — Mercury Bank\nAccount: •••• 4821 | Routing: 021000021\nReference: INV-2026-004",
      notes: "Payment is due within 14 days of issue date.\nThank you for working with Northwind Design Studio.",
    };
  }

  function createBlankState(preserveSender) {
    const issue = getTodayISO();
    return {
      docType: "invoice",
      currency: preserveSender ? preserveSender.currency : "USD",
      docNumber: "INV-" + issue.slice(0, 4) + "-001",
      status: "draft",
      issueDate: issue,
      dueDate: addDaysISO(issue, 14),
      logoDataUrl: preserveSender ? preserveSender.logoDataUrl : "",
      senderName: preserveSender ? preserveSender.senderName : "",
      senderMeta: preserveSender ? preserveSender.senderMeta : "",
      clientName: "",
      clientMeta: "",
      items: [{ description: "", qty: 1, rate: 0 }],
      discountType: "percent",
      discountValue: 0,
      taxRate: 0,
      paymentInfo: preserveSender ? preserveSender.paymentInfo : "",
      notes: "",
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSampleState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return createSampleState();
      const base = createSampleState();
      const merged = Object.assign({}, base, parsed);
      if (!Array.isArray(merged.items) || merged.items.length === 0) {
        merged.items = [{ description: "", qty: 1, rate: 0 }];
      }
      return merged;
    } catch (_err) {
      return createSampleState();
    }
  }

  let state = loadState();
  let toastTimer = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_err) {
      showToast("Could not save locally (storage quota exceeded).");
    }
  }

  function showToast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2400);
  }

  function formatDisplayDate(iso) {
    if (!iso) return "—";
    const dt = new Date(iso + "T00:00:00");
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function syncTopControls() {
    document.querySelectorAll("[data-doc-type]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-doc-type") === state.docType);
    });
    const currencyEl = document.getElementById("currency-select");
    if (currencyEl) currencyEl.value = state.currency;
  }

  function syncFormInputs() {
    document.querySelectorAll("[data-bind]").forEach(function (el) {
      const key = el.getAttribute("data-bind");
      const val = state[key];
      if (el.type === "number") {
        el.value = val === "" || val === undefined ? 0 : val;
      } else {
        el.value = val === undefined || val === null ? "" : String(val);
      }
    });

    const meta = DOC_META[state.docType] || DOC_META.invoice;
    const dueLabel = document.getElementById("due-date-label");
    if (dueLabel) dueLabel.textContent = meta.dueLabel;

    const thumb = document.getElementById("editor-logo-thumb");
    const removeBtn = document.getElementById("btn-remove-logo");
    if (state.logoDataUrl) {
      thumb.src = state.logoDataUrl;
      thumb.hidden = false;
      removeBtn.hidden = false;
    } else {
      thumb.removeAttribute("src");
      thumb.hidden = true;
      removeBtn.hidden = true;
    }
  }

  function renderItemsEditor() {
    const list = document.getElementById("items-editor-list");
    list.innerHTML = "";
    const result = calc.calculateDocument(state);

    state.items.forEach(function (item, index) {
      const card = document.createElement("div");
      card.className = "item-card";

      const top = document.createElement("div");
      top.className = "item-card-top";

      const descInput = document.createElement("input");
      descInput.type = "text";
      descInput.className = "field-input";
      descInput.placeholder = "Service or item description";
      descInput.value = item.description || "";
      descInput.setAttribute("aria-label", "Item description " + (index + 1));
      descInput.addEventListener("input", function (e) {
        state.items[index].description = e.target.value;
        saveState();
        renderPreview();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-icon-remove";
      removeBtn.title = "Remove item";
      removeBtn.setAttribute("aria-label", "Remove item " + (index + 1));
      removeBtn.textContent = "×";
      removeBtn.disabled = state.items.length <= 1;
      removeBtn.addEventListener("click", function () {
        if (state.items.length <= 1) return;
        state.items.splice(index, 1);
        saveState();
        renderItemsEditor();
        renderPreview();
      });

      top.appendChild(descInput);
      top.appendChild(removeBtn);

      const metrics = document.createElement("div");
      metrics.className = "item-card-metrics";

      const qtyWrap = document.createElement("div");
      const qtyLabel = document.createElement("label");
      qtyLabel.className = "field-label";
      qtyLabel.textContent = "Qty";
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "0";
      qtyInput.step = "any";
      qtyInput.className = "field-input is-num";
      qtyInput.value = item.qty;
      qtyInput.setAttribute("aria-label", "Quantity " + (index + 1));

      const rateWrap = document.createElement("div");
      const rateLabel = document.createElement("label");
      rateLabel.className = "field-label";
      rateLabel.textContent = "Rate";
      const rateInput = document.createElement("input");
      rateInput.type = "number";
      rateInput.min = "0";
      rateInput.step = "any";
      rateInput.className = "field-input is-num";
      rateInput.value = item.rate;
      rateInput.setAttribute("aria-label", "Rate " + (index + 1));

      const amountBadge = document.createElement("div");
      amountBadge.className = "item-amount-badge";
      amountBadge.textContent = calc.formatMoney(result.items[index].amount, state.currency);

      function updateLineAmount() {
        const updated = calc.calculateDocument(state);
        amountBadge.textContent = calc.formatMoney(updated.items[index].amount, state.currency);
        renderPreview();
      }

      qtyInput.addEventListener("input", function (e) {
        state.items[index].qty = e.target.value;
        saveState();
        updateLineAmount();
      });

      rateInput.addEventListener("input", function (e) {
        state.items[index].rate = e.target.value;
        saveState();
        updateLineAmount();
      });

      qtyWrap.appendChild(qtyLabel);
      qtyWrap.appendChild(qtyInput);
      rateWrap.appendChild(rateLabel);
      rateWrap.appendChild(rateInput);

      metrics.appendChild(qtyWrap);
      metrics.appendChild(rateWrap);
      metrics.appendChild(amountBadge);

      card.appendChild(top);
      card.appendChild(metrics);
      list.appendChild(card);
    });
  }

  function renderPreview() {
    const meta = DOC_META[state.docType] || DOC_META.invoice;
    const result = calc.calculateDocument(state);

    const logoEl = document.getElementById("preview-logo");
    if (state.logoDataUrl) {
      logoEl.src = state.logoDataUrl;
      logoEl.hidden = false;
    } else {
      logoEl.removeAttribute("src");
      logoEl.hidden = true;
    }

    document.getElementById("preview-sender-name").textContent =
      state.senderName.trim() || "Your Business Name";
    document.getElementById("preview-sender-meta").textContent = state.senderMeta || "";

    document.getElementById("preview-doc-type").textContent = meta.heading;
    document.getElementById("preview-doc-number").textContent =
      state.docNumber.trim() ? "#" + state.docNumber.trim() : "#0001";

    const statusEl = document.getElementById("preview-status");
    const safeStatus = ["draft", "unpaid", "paid"].includes(state.status) ? state.status : "draft";
    statusEl.setAttribute("data-status", safeStatus);
    statusEl.textContent = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);

    document.getElementById("preview-billto-label").textContent = meta.billToLabel;
    document.getElementById("preview-client-name").textContent =
      state.clientName.trim() || "Client Name";
    document.getElementById("preview-client-meta").textContent = state.clientMeta || "";

    document.getElementById("preview-issue-date").textContent = formatDisplayDate(state.issueDate);
    document.getElementById("preview-due-label").textContent = meta.dueLabel;
    document.getElementById("preview-due-date").textContent = formatDisplayDate(state.dueDate);

    const tbody = document.getElementById("preview-items-body");
    tbody.innerHTML = "";
    result.items.forEach(function (item) {
      const tr = document.createElement("tr");

      const tdDesc = document.createElement("td");
      tdDesc.className = "col-desc";
      tdDesc.textContent = item.description.trim() || "Line item";

      const tdQty = document.createElement("td");
      tdQty.className = "col-qty is-right";
      tdQty.textContent = String(item.qty);

      const tdRate = document.createElement("td");
      tdRate.className = "col-rate is-right";
      tdRate.textContent = calc.formatMoney(item.rate, state.currency);

      const tdAmt = document.createElement("td");
      tdAmt.className = "col-amount is-right";
      tdAmt.textContent = calc.formatMoney(item.amount, state.currency);

      tr.appendChild(tdDesc);
      tr.appendChild(tdQty);
      tr.appendChild(tdRate);
      tr.appendChild(tdAmt);
      tbody.appendChild(tr);
    });

    document.getElementById("preview-subtotal").textContent = calc.formatMoney(
      result.subtotal,
      state.currency
    );

    const discountRow = document.getElementById("preview-discount-row");
    if (result.discountAmount > 0) {
      discountRow.hidden = false;
      document.getElementById("preview-discount-label").textContent =
        result.discountType === "percent"
          ? "Discount (" + Number(state.discountValue || 0) + "%)"
          : "Discount";
      document.getElementById("preview-discount").textContent =
        "-" + calc.formatMoney(result.discountAmount, state.currency);
    } else {
      discountRow.hidden = true;
    }

    const taxRow = document.getElementById("preview-tax-row");
    if (result.taxRate > 0) {
      taxRow.hidden = false;
      document.getElementById("preview-tax-label").textContent = "Tax (" + result.taxRate + "%)";
      document.getElementById("preview-tax").textContent = calc.formatMoney(
        result.taxAmount,
        state.currency
      );
    } else {
      taxRow.hidden = true;
    }

    document.getElementById("preview-total-label").textContent = meta.totalLabel;
    document.getElementById("preview-total").textContent = calc.formatMoney(
      result.total,
      state.currency
    );

    document.getElementById("preview-payment-info").textContent =
      state.paymentInfo.trim() || "—";
    document.getElementById("preview-notes").textContent = state.notes.trim() || "—";
  }

  function renderAll() {
    syncTopControls();
    syncFormInputs();
    renderItemsEditor();
    renderPreview();
  }

  function bindEvents() {
    document.querySelectorAll("[data-doc-type]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const nextType = btn.getAttribute("data-doc-type");
        if (!DOC_META[nextType]) return;
        const prevMeta = DOC_META[state.docType] || DOC_META.invoice;
        const nextMeta = DOC_META[nextType];
        state.docType = nextType;
        if (state.docNumber.startsWith(prevMeta.prefix + "-")) {
          state.docNumber = nextMeta.prefix + state.docNumber.slice(prevMeta.prefix.length);
        }
        state.status = nextMeta.defaultStatus;
        saveState();
        renderAll();
      });
    });

    document.getElementById("currency-select").addEventListener("change", function (e) {
      state.currency = e.target.value;
      saveState();
      renderItemsEditor();
      renderPreview();
    });

    document.querySelectorAll("[data-bind]").forEach(function (el) {
      const eventName = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
      el.addEventListener(eventName, function (e) {
        const key = el.getAttribute("data-bind");
        state[key] = e.target.value;
        saveState();
        renderPreview();
      });
    });

    document.getElementById("btn-add-item").addEventListener("click", function () {
      state.items.push({ description: "", qty: 1, rate: 0 });
      saveState();
      renderItemsEditor();
      renderPreview();
    });

    document.getElementById("btn-upload-logo").addEventListener("click", function () {
      document.getElementById("logo-upload").click();
    });

    document.getElementById("logo-upload").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > MAX_LOGO_BYTES) {
        showToast("Logo must be under 1.5 MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        state.logoDataUrl = typeof reader.result === "string" ? reader.result : "";
        saveState();
        syncFormInputs();
        renderPreview();
        showToast("Logo updated.");
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });

    document.getElementById("btn-remove-logo").addEventListener("click", function () {
      state.logoDataUrl = "";
      saveState();
      syncFormInputs();
      renderPreview();
    });

    document.getElementById("btn-sample").addEventListener("click", function () {
      state = createSampleState();
      saveState();
      renderAll();
      showToast("Sample loaded.");
    });

    document.getElementById("btn-reset").addEventListener("click", function () {
      state = createBlankState(state);
      saveState();
      renderAll();
      showToast("New blank document ready.");
    });

    document.getElementById("btn-export-json").addEventListener("click", function () {
      const payload = JSON.stringify(state, null, 2);
      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = (state.docNumber || "document").replace(/[^a-zA-Z0-9_-]/g, "-");
      link.href = url;
      link.download = slug + ".json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Backup JSON downloaded.");
    });

    document.getElementById("btn-import-json").addEventListener("click", function () {
      document.getElementById("input-import-json").click();
    });

    document.getElementById("input-import-json").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = JSON.parse(String(reader.result || ""));
          if (!imported || typeof imported !== "object" || !Array.isArray(imported.items)) {
            throw new Error("Invalid schema");
          }
          state = Object.assign({}, createBlankState(), imported);
          saveState();
          renderAll();
          showToast("Document imported.");
        } catch (_err) {
          showToast("Invalid JSON backup file.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    document.getElementById("btn-print").addEventListener("click", function () {
      const originalTitle = document.title;
      const docSlug = (state.docNumber || state.docType || "document").trim();
      const clientSlug = (state.clientName || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
      document.title = clientSlug ? docSlug + "-" + clientSlug : docSlug;
      window.print();
      setTimeout(function () {
        document.title = originalTitle;
      }, 300);
    });

    document.querySelectorAll("[data-mobile-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const view = btn.getAttribute("data-mobile-tab");
        document.body.setAttribute("data-mobile-view", view);
        document.querySelectorAll("[data-mobile-tab]").forEach(function (tab) {
          tab.classList.toggle("is-active", tab === btn);
        });
      });
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      document.body.setAttribute("data-demo", "true");
    }
  }

  bindEvents();
  renderAll();
})();
