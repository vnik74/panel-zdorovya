/* =========================================================================
   КНОПКА «ПОЛУЧИТЬ КОД» — автономный скрипт сайта «Панель здоровья».
   Версия 1.0, 30.10.2026.

   Что делает: на экране входа появляется кнопка «Нет кода? Получить
   мгновенно». Человек вводит почту — свободный код (с пометкой «авто»)
   приходит из базы и появляется прямо на экране, мгновенно и 24/7.
   Код сразу подставляется в форму регистрации.

   Скрипт самостоятельный: ничего не ломает в самом приложении, при любой
   ошибке просто не показывает кнопку либо вежливо объясняет, что делать.
   Данные для связи берёт из config.js (window.__PANEL_CONFIG__).
   ========================================================================= */
(function () {
  "use strict";
  if (window !== window.top) return; // внутри чужих фреймов не работаем

  // Конфиг подгружается сайтом во время гидрации, поэтому читаем его
  // ЛЕНИВО (при каждой проверке), а не один раз при старте.
  function getConfig() {
    var c = window.__PANEL_CONFIG__ || {};
    return {
      base: (c.supabaseUrl || "").replace(/\/+$/, ""),
      key: c.supabaseAnonKey || ""
    };
  }

  /* ---------------------------------------------------------------- стили */
  var CSS = [
    ".hp-gc-link{display:block;width:100%;box-sizing:border-box;margin-top:2px;",
    "padding:11px 14px;border:2px solid #CFE0F1;border-radius:12px;",
    "background:#FFFFFF;color:#1565C0;font-size:15px;font-weight:600;",
    "line-height:1.35;text-align:center;cursor:pointer;font-family:inherit;",
    "transition:background .15s,border-color .15s}",
    ".hp-gc-link:hover{background:#EAF2FB;border-color:#1565C0}",
    ".hp-gc-link:active{background:#DFEAF8}",
    ".hp-gc-overlay{position:fixed;inset:0;z-index:99999;display:flex;",
    "align-items:center;justify-content:center;padding:16px;",
    "background:rgba(20,35,55,.45)}",
    ".hp-gc-modal{background:#FFFFFF;border-radius:16px;",
    "width:min(420px,100%);max-height:calc(100vh - 32px);overflow:auto;",
    "padding:20px;box-sizing:border-box;box-shadow:0 18px 50px rgba(20,35,55,.35);",
    "font-family:inherit}",
    ".hp-gc-title{margin:0 0 6px;font-size:18px;font-weight:700;color:#274257}",
    ".hp-gc-text{margin:0 0 14px;font-size:14px;line-height:1.5;color:#52606D}",
    ".hp-gc-label{display:block;margin:0 0 6px;font-size:13px;font-weight:600;",
    "color:#52606D}",
    ".hp-gc-input{width:100%;box-sizing:border-box;padding:12px 14px;",
    "border:1.5px solid #CFE0F1;border-radius:12px;font-size:16px;",
    "color:#274257;background:#F7FAFD;outline:none;font-family:inherit}",
    ".hp-gc-input:focus{border-color:#1565C0;background:#FFFFFF}",
    ".hp-gc-btn{display:block;width:100%;box-sizing:border-box;margin-top:12px;",
    "padding:12px 14px;border:none;border-radius:12px;background:#1565C0;",
    "color:#FFFFFF;font-size:16px;font-weight:700;cursor:pointer;",
    "font-family:inherit}",
    ".hp-gc-btn:hover{background:#114FA0}",
    ".hp-gc-btn:disabled{opacity:.6;cursor:default}",
    ".hp-gc-btn2{display:block;width:100%;box-sizing:border-box;margin-top:10px;",
    "padding:11px 14px;border:1.5px solid #CFE0F1;border-radius:12px;",
    "background:#FFFFFF;color:#1565C0;font-size:15px;font-weight:600;",
    "cursor:pointer;font-family:inherit}",
    ".hp-gc-btn2:hover{background:#EAF2FB}",
    ".hp-gc-err{display:none;margin-top:12px;padding:11px 13px;border-radius:12px;",
    "background:#FDEDEC;color:#B03A2E;font-size:14px;line-height:1.45}",
    ".hp-gc-ok{display:none;margin-top:14px}",
    ".hp-gc-codeline{padding:13px 12px;border-radius:12px;background:#EAF2FB;",
    "text-align:center;font-size:24px;font-weight:800;letter-spacing:1px;",
    "color:#1565C0;font-family:ui-monospace,Menlo,Consolas,monospace;",
    "word-break:break-all}",
    ".hp-gc-note{margin:10px 0 0;font-size:13px;line-height:1.5;color:#52606D}",
    ".hp-gc-priv{margin:14px 0 0;font-size:12px;line-height:1.45;color:#8A98A8;",
    "text-align:center}"
  ].join("");

  /* --------------------------------------------------------------- утилиты */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function setNativeValue(input, value) {
    var desc = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function copyText(text, btn) {
    function done() { if (btn) { btn.textContent = "Скопировано ✓"; } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = el("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
      setTimeout(function () { if (btn) btn.textContent = "Скопировать код"; }, 2500);
    }
  }

  /* ----------------------------------------------------------------- модал */
  var overlay = null, emailInput = null, getBtn = null, errBox = null,
      okBox = null, codeLine = null, okNote = null, copyBtn = null;

  function buildModal() {
    overlay = el("div", "hp-gc-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    var m = el("div", "hp-gc-modal");
    overlay.appendChild(m);

    m.appendChild(el("div", "hp-gc-title", "Код доступа — мгновенно"));
    m.appendChild(el("div", "hp-gc-text",
      "Введите свою почту — свободный код появится на экране сразу, " +
      "круглосуточно. Писать кому-то и ждать ответа не нужно."));

    emailInput = el("input", "hp-gc-input");
    emailInput.type = "email";
    emailInput.name = "hp-gc-email";
    emailInput.placeholder = "maria@mail.ru";
    emailInput.autocomplete = "email";
    var lab = el("label", "hp-gc-label", "Почта");
    lab.appendChild(emailInput);
    m.appendChild(lab);

    getBtn = el("button", "hp-gc-btn", "Получить код");
    getBtn.type = "button";
    m.appendChild(getBtn);

    errBox = el("div", "hp-gc-err");
    m.appendChild(errBox);

    okBox = el("div", "hp-gc-ok");
    okBox.appendChild(el("div", "hp-gc-label", "Ваш код доступа:"));
    codeLine = el("div", "hp-gc-codeline");
    okBox.appendChild(codeLine);
    copyBtn = el("button", "hp-gc-btn2", "Скопировать код");
    copyBtn.type = "button";
    okBox.appendChild(copyBtn);
    okNote = el("p", "hp-gc-note");
    okBox.appendChild(okNote);
    m.appendChild(okBox);

    var close = el("button", "hp-gc-btn2", "Закрыть");
    close.type = "button";
    m.appendChild(close);

    m.appendChild(el("p", "hp-gc-priv",
      "Почта никуда не рассылается: она нужна только чтобы вернуть вам " +
      "этот же код, если вы его потеряете."));

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && overlay.parentNode) closeModal();
    });
    getBtn.addEventListener("click", submit);
    emailInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
    copyBtn.addEventListener("click", function () {
      copyText(codeLine.textContent, copyBtn);
    });
    close.addEventListener("click", closeModal);
  }

  function openModal() {
    if (!overlay) buildModal();
    errBox.style.display = "none";
    okBox.style.display = "none";
    getBtn.disabled = false;
    getBtn.textContent = "Получить код";
    if (!overlay.parentNode) document.body.appendChild(overlay);
    emailInput.value = "";
    setTimeout(function () { emailInput.focus(); }, 50);
  }
  function closeModal() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function showError(text) {
    errBox.textContent = text;
    errBox.style.display = "block";
    okBox.style.display = "none";
  }

  function submit() {
    var email = (emailInput.value || "").trim();
    errBox.style.display = "none";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      showError("Похоже, в почте опечатка. Проверьте и попробуйте ещё раз.");
      return;
    }
    getBtn.disabled = true;
    getBtn.textContent = "Получаю код…";

    var cfg = getConfig();
    if (!cfg.base || !cfg.key) {
      showError("Код пока недоступен: сайт ещё не подключён к базе. Возьмите код в меню сообщества, пункт «Получить доступ».");
      getBtn.disabled = false;
      getBtn.textContent = "Получить код";
      return;
    }
    fetch(cfg.base + "/rest/v1/rpc/claim_free_code", {
      method: "POST",
      headers: {
        "apikey": cfg.key,
        "Authorization": "Bearer " + cfg.key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_email: email })
    }).then(function (res) {
      return res.json().then(function (j) { return { status: res.status, j: j }; });
    }).then(function (r) {
      getBtn.disabled = false;
      getBtn.textContent = "Получить код";
      var j = r.j || {};
      if (j.ok && j.code) {
        errBox.style.display = "none";
        codeLine.textContent = j.code;
        okNote.textContent = "Код уже подставлен в форму регистрации ✓ " +
          "Если поле не заполнилось — вставьте код вручную. " +
          "Код нужен один раз, при создании аккаунта: дальше входите " +
          "по почте и паролю.";
        okBox.style.display = "block";
        copyBtn.textContent = "Скопировать код";
        fillForm(j.code, email);
      } else if (j.error) {
        showError(j.error);
      } else {
        showError("Не получилось получить код. Проверьте интернет и " +
          "попробуйте ещё раз — либо возьмите код в меню сообщества, " +
          "пункт «Получить доступ».");
      }
    }).catch(function () {
      getBtn.disabled = false;
      getBtn.textContent = "Получить код";
      showError("Нет связи с базой. Проверьте интернет и попробуйте " +
        "ещё раз — либо возьмите код в меню сообщества, пункт " +
        "«Получить доступ».");
    });
  }

  /* ------------------------------------------- подстановка кода в форму */
  function findCodeInput() {
    var inputs = document.querySelectorAll('input[placeholder="HP-XXXX-XXXX"]');
    return inputs.length ? inputs[inputs.length - 1] : null;
  }
  function findTab(text) {
    var btns = document.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || "").trim() === text) return btns[i];
    }
    return null;
  }
  function fillForm(code, email, attempt) {
    attempt = attempt || 0;
    if (attempt > 25) return;
    var input = findCodeInput();
    if (!input) {
      var tab = findTab("Первый вход по коду");
      if (tab) tab.click();
      setTimeout(function () { fillForm(code, email, attempt + 1); }, 120);
      return;
    }
    if (!input.value) setNativeValue(input, code);
    var emailField = document.querySelector('input[placeholder="maria@mail.ru"]');
    if (emailField && !emailField.value) setNativeValue(emailField, email);
  }

  /* --------------------------------- кнопка-ссылка на экранах входа/регистрации */
  var MARKERS = ["Код доступа выдаёт владелец", "Первый раз здесь?"];

  function authMarkers() {
    var found = [];
    var nodes = document.querySelectorAll("p, div");
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || "").trim();
      if (!t || t.length > 120) continue;
      for (var k = 0; k < MARKERS.length; k++) {
        if (t.indexOf(MARKERS[k]) === 0) { found.push(nodes[i]); break; }
      }
    }
    return found;
  }

  function isAfterMarker(node) {
    var p = node.previousElementSibling;
    var t = p ? (p.textContent || "").trim() : "";
    if (!t) return false;
    for (var k = 0; k < MARKERS.length; k++) {
      if (t.indexOf(MARKERS[k]) === 0) return true;
    }
    return false;
  }

  function ensureLinks() {
    var cfg = getConfig();
    if (!cfg.base || !cfg.key) return; // config.js ещё не готов — ждём
    ensureStyle();
    // React при переключении вкладок переиспользует контейнер и оставляет
    // нашу кнопку «осиротевшей» в случайном месте — убираем такие.
    var stray = document.querySelectorAll(".hp-gc-link");
    for (var s = 0; s < stray.length; s++) {
      if (!isAfterMarker(stray[s]) && stray[s].parentNode) {
        stray[s].parentNode.removeChild(stray[s]);
      }
    }
    var markers = authMarkers();
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (m.nextElementSibling && m.nextElementSibling.className === "hp-gc-link") continue;
      var b = el("button", "hp-gc-link", "🔑 Нет кода доступа? Получить мгновенно");
      b.type = "button";
      b.addEventListener("click", openModal);
      if (m.nextSibling) m.parentNode.insertBefore(b, m.nextSibling);
      else m.parentNode.appendChild(b);
    }
    if (!markers.length && overlay && overlay.parentNode) closeModal();
  }

  var scheduled = false;
  var observer = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; ensureLinks(); });
  });

  var styleDone = false;
  function ensureStyle() {
    if (styleDone) return;
    styleDone = true;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    ensureLinks();
    // Страховка на случай пропущенных мутаций: лёгкий опрос раз в 0,7 с.
    setInterval(ensureLinks, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
