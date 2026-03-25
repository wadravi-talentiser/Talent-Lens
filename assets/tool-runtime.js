(function () {
  const KEY = "talentlens.anthropic_api_key";

  function readKey() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveKey(value) {
    try {
      if (value) {
        localStorage.setItem(KEY, value);
      } else {
        localStorage.removeItem(KEY);
      }
    } catch (error) {
      console.warn("Unable to persist API key locally.", error);
    }
  }

  function getAnthropicHeaders() {
    const apiKey = readKey().trim();
    if (!apiKey) {
      throw new Error("Add your Anthropic API key in the page header before running AI actions.");
    }

    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  function renderApiKeyControls() {
    const mount = document.getElementById("api-key-panel");
    if (!mount) return;

    const current = readKey();
    mount.innerHTML = `
      <div class="tl-key-card">
        <div>
          <div class="tl-key-title">Anthropic API key</div>
          <div class="tl-key-copy">Stored only in this browser via localStorage. Add your own key to use the AI-powered tools on GitHub Pages.</div>
        </div>
        <div class="tl-key-form">
          <input id="tl-api-key-input" type="password" placeholder="sk-ant-..." value="${current.replace(/"/g, "&quot;")}" />
          <button id="tl-save-key" type="button">Save key</button>
          <button id="tl-clear-key" type="button" class="ghost">Clear</button>
        </div>
      </div>
    `;

    const input = document.getElementById("tl-api-key-input");
    const save = document.getElementById("tl-save-key");
    const clear = document.getElementById("tl-clear-key");

    save.addEventListener("click", function () {
      saveKey(input.value.trim());
      save.textContent = "Saved";
      window.setTimeout(function () {
        save.textContent = "Save key";
      }, 1200);
    });

    clear.addEventListener("click", function () {
      input.value = "";
      saveKey("");
    });
  }

  function bootApp() {
    if (!window.React || !window.ReactDOM || !window.TalentLensApp) {
      window.setTimeout(bootApp, 50);
      return;
    }

    const rootNode = document.getElementById("app");
    if (!rootNode) return;

    ReactDOM.createRoot(rootNode).render(React.createElement(window.TalentLensApp));
  }

  window.TalentLensRuntime = {
    getAnthropicHeaders: getAnthropicHeaders,
    readKey: readKey,
    saveKey: saveKey,
    renderApiKeyControls: renderApiKeyControls,
    bootApp: bootApp
  };
})();
