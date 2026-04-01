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
const templatesTableBody = document.getElementById("templatesTableBody");

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

async function carregarTemplates() {
  if (!templatesTableBody) return;

  templatesTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-row">Carregando templates...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("id, nome, motivo, titulo_ticket, descricao, mensagem, time")
    .order("nome", { ascending: true });

  if (error) {
    templatesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Erro ao carregar templates.</td>
      </tr>
    `;
    console.error("Erro ao buscar templates:", error);
    return;
  }

  if (!data || data.length === 0) {
    templatesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Nenhum template cadastrado.</td>
      </tr>
    `;
    return;
  }

  templatesTableBody.innerHTML = data
    .map((item) => {
      return `
        <tr>
          <td>${escapeHtml(item.nome)}</td>
          <td class="cell-wrap">${escapeHtml(item.motivo)}</td>
          <td class="cell-wrap">${escapeHtml(item.titulo_ticket)}</td>
          <td class="cell-wrap">${escapeHtml(item.descricao)}</td>
          <td class="cell-wrap">${escapeHtml(item.mensagem)}</td>
          <td>${escapeHtml(item.time)}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-editar" data-id="${item.id}">Editar</button>
              <button type="button" class="btn-excluir" data-id="${item.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const botoesEditar = document.querySelectorAll(".btn-editar");
  botoesEditar.forEach((botao) => {
    botao.addEventListener("click", async () => {
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
  });

  const botoesExcluir = document.querySelectorAll(".btn-excluir");
  botoesExcluir.forEach((botao) => {
    botao.addEventListener("click", async () => {
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
  });
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