const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TABLE_NAME = "template";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const form = document.getElementById("templateForm");
const btnLimparCampos = document.getElementById("btnLimparCampos");
const btnSalvarTemplate = document.getElementById("btnSalvarTemplate");
const retornoMensagem = document.getElementById("retornoMensagem");
const templatesList = document.getElementById("templatesList");

const inputTemplateId = document.getElementById("templateId");
const inputNome = document.getElementById("nome");
const inputTime = document.getElementById("time");
const inputMotivo = document.getElementById("motivo");
const inputTituloTicket = document.getElementById("titulo_ticket");
const inputDescricao = document.getElementById("descricao");
const inputMensagem = document.getElementById("mensagem");

function setFeedback(message, type = "default") {
  if (!retornoMensagem) return;

  retornoMensagem.textContent = message;
  retornoMensagem.classList.remove("feedback-success", "feedback-error", "feedback-warning");

  if (type === "success") retornoMensagem.classList.add("feedback-success");
  if (type === "error") retornoMensagem.classList.add("feedback-error");
  if (type === "warning") retornoMensagem.classList.add("feedback-warning");
}

function limparFormulario() {
  if (inputTemplateId) inputTemplateId.value = "";
  if (inputNome) inputNome.value = "";
  if (inputMotivo) inputMotivo.selectedIndex = 0;
  if (inputTituloTicket) inputTituloTicket.value = "";
  if (inputDescricao) inputDescricao.value = "";
  if (inputMensagem) inputMensagem.value = "";

  if (btnSalvarTemplate) {
    btnSalvarTemplate.textContent = "Salvar template";
    btnSalvarTemplate.disabled = false;
  }
}

function preencherFormularioParaEdicao(template) {
  if (!template) return;

  if (inputTemplateId) inputTemplateId.value = template.id || "";
  if (inputNome) inputNome.value = template.nome || "";
  if (inputTime) inputTime.value = template.time || "Ativo";
  if (inputMotivo) inputMotivo.value = template.motivo || "";
  if (inputTituloTicket) inputTituloTicket.value = template.titulo_ticket || "";
  if (inputDescricao) inputDescricao.value = template.descricao || "";
  if (inputMensagem) inputMensagem.value = template.mensagem || "";

  if (btnSalvarTemplate) {
    btnSalvarTemplate.textContent = "Atualizar template";
  }

  setFeedback(`Editando template: ${template.nome || "Sem nome"}`, "warning");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bindAccordionEvents() {
  const headers = document.querySelectorAll(".template-header");

  headers.forEach((header) => {
    if (header.dataset.bound === "true") return;

    header.addEventListener("click", () => {
      const item = header.closest(".template-item");
      const icon = item.querySelector(".template-toggle-icon");
      const isOpen = item.classList.contains("open");

      document.querySelectorAll(".template-item.open").forEach((openedItem) => {
        openedItem.classList.remove("open");
        const openedIcon = openedItem.querySelector(".template-toggle-icon");
        if (openedIcon) openedIcon.textContent = "+";
      });

      if (!isOpen) {
        item.classList.add("open");
        if (icon) icon.textContent = "−";
      }
    });

    header.dataset.bound = "true";
  });
}

function bindTemplateActionButtons() {
  const botoesEditar = document.querySelectorAll(".btn-editar");
  botoesEditar.forEach((botao) => {
    if (botao.dataset.bound === "true") return;

    botao.addEventListener("click", async (event) => {
      event.stopPropagation();

      const id = botao.dataset.id;

      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select("id, nome, motivo, titulo_ticket, descricao, mensagem, time")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar template para edição:", error);
        setFeedback("Erro ao carregar dados do template para edição.", "error");
        return;
      }

      preencherFormularioParaEdicao(data);
    });

    botao.dataset.bound = "true";
  });

  const botoesExcluir = document.querySelectorAll(".btn-excluir");
  botoesExcluir.forEach((botao) => {
    if (botao.dataset.bound === "true") return;

    botao.addEventListener("click", async (event) => {
      event.stopPropagation();

      const id = botao.dataset.id;
      const confirmar = confirm("Deseja realmente excluir este template?");
      if (!confirmar) return;

      const { error } = await supabaseClient
        .from(TABLE_NAME)
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Erro ao excluir template:", error);
        setFeedback("Erro ao excluir template.", "error");
        return;
      }

      if (inputTemplateId && inputTemplateId.value === id) {
        limparFormulario();
      }

      setFeedback("Template excluído com sucesso.", "success");
      await carregarTemplates();
    });

    botao.dataset.bound = "true";
  });
}

async function carregarTemplates() {
  if (!templatesList) return;

  templatesList.innerHTML = `<div class="empty-state">Carregando templates...</div>`;

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("id, nome, motivo, titulo_ticket, descricao, mensagem, time")
    .order("nome", { ascending: true });

  if (error) {
    templatesList.innerHTML = `<div class="empty-state">Erro ao carregar templates.</div>`;
    console.error("Erro ao buscar templates:", error);
    return;
  }

  if (!data || data.length === 0) {
    templatesList.innerHTML = `<div class="empty-state">Nenhum template cadastrado.</div>`;
    return;
  }

  templatesList.innerHTML = data
    .map((item) => {
      const nome = escapeHtml(item.nome || "Sem nome");
      const motivo = escapeHtml(item.motivo || "-");
      const titulo = escapeHtml(item.titulo_ticket || "-");
      const descricao = escapeHtml(item.descricao || "-");
      const mensagem = escapeHtml(item.mensagem || "-");
      const time = escapeHtml(item.time || "-");

      return `
        <div class="template-item">
          <button type="button" class="template-header" data-id="${item.id}">
            <div class="template-header-main">
              <strong>${nome}</strong>
              <span class="template-badge">${motivo}</span>
            </div>

            <div class="template-header-side">
              <span class="template-time">${time}</span>
              <span class="template-toggle-icon">+</span>
            </div>
          </button>

          <div class="template-content" id="template-content-${item.id}">
            <div class="template-content-grid">
              <div class="template-block">
                <span class="template-label">Título do ticket</span>
                <p>${titulo}</p>
              </div>

              <div class="template-block">
                <span class="template-label">Descrição</span>
                <p>${descricao}</p>
              </div>

              <div class="template-block">
                <span class="template-label">Mensagem</span>
                <p>${mensagem}</p>
              </div>

              <div class="template-block">
                <span class="template-label">Time</span>
                <p>${time}</p>
              </div>
            </div>

            <div class="template-actions">
              <button type="button" class="btn-editar" data-id="${item.id}">Editar</button>
              <button type="button" class="btn-excluir" data-id="${item.id}">Excluir</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindAccordionEvents();
  bindTemplateActionButtons();
}

async function salvarTemplate(event) {
  event.preventDefault();

  const id = inputTemplateId?.value || "";
  const nome = inputNome?.value.trim() || "";
  const mensagem = inputMensagem?.value.trim() || "";
  const titulo_ticket = inputTituloTicket?.value.trim() || "";
  const descricao = inputDescricao?.value.trim() || "";
  const motivo = inputMotivo?.value || "";
  const time = inputTime?.value || "Ativo";

  if (!nome || !mensagem) {
    setFeedback("Preencha pelo menos os campos Nome e Mensagem.", "error");
    return;
  }

  if (btnSalvarTemplate) {
    btnSalvarTemplate.disabled = true;
    btnSalvarTemplate.textContent = id ? "Atualizando..." : "Salvando...";
  }

  const payload = {
    nome,
    mensagem,
    titulo_ticket: titulo_ticket || null,
    descricao: descricao || null,
    motivo: motivo || null,
    time: time || "Ativo"
  };

  let response;

  if (id) {
    response = await supabaseClient
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", id);
  } else {
    response = await supabaseClient
      .from(TABLE_NAME)
      .insert([payload]);
  }

  if (btnSalvarTemplate) {
    btnSalvarTemplate.disabled = false;
  }

  if (response.error) {
    console.error("Erro ao salvar template:", response.error);
    setFeedback(`Erro ao salvar template: ${response.error.message}`, "error");

    if (btnSalvarTemplate) {
      btnSalvarTemplate.textContent = id ? "Atualizar template" : "Salvar template";
    }
    return;
  }

  setFeedback(
    id ? "Template atualizado com sucesso." : "Template salvo com sucesso.",
    "success"
  );

  limparFormulario();
  await carregarTemplates();
}

function setupMenu() {
  const rotas = {
    acoes: "./main.html",
    contatos: "./contato.html",
    templates: "./template.html",
    relatorios: "./relatorio.html"
  };

  const botoesMenu = document.querySelectorAll(".menu button");

  botoesMenu.forEach((botao) => {
    botao.addEventListener("click", () => {
      const target = botao.dataset.target;
      const rota = rotas[target];

      if (rota) {
        window.location.href = rota;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupMenu();

  if (form) {
    form.addEventListener("submit", salvarTemplate);
  }

  if (btnLimparCampos) {
    btnLimparCampos.addEventListener("click", (event) => {
      event.preventDefault();
      limparFormulario();
      setFeedback("Campos limpos.");
    });
  }

  carregarTemplates();
});