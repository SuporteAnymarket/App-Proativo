const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const BACKEND_MENSAGEM_URL = "http://195.200.0.29:6969";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const filtroTipo = document.getElementById("filtroTipo");
const filtroOi = document.getElementById("filtroOi");
const filtroEmpresa = document.getElementById("filtroEmpresa");
const filtroTemplate = document.getElementById("filtroTemplate");
const filtroStatus = document.getElementById("filtroStatus");
const filtroDataInicio = document.getElementById("filtroDataInicio");
const filtroDataFim = document.getElementById("filtroDataFim");

const btnBuscarRelatorio = document.getElementById("btnBuscarRelatorio");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const btnExportarRelatorio = document.getElementById("btnExportarRelatorio");
const btnAtualizarFollowup = document.getElementById("btnAtualizarFollowup");

const relatorioBody = document.getElementById("relatorioBody");
const retornoRelatorio = document.getElementById("retornoRelatorio");

const totalRegistros = document.getElementById("totalRegistros");
const totalAguardando = document.getElementById("totalAguardando");
const totalRespondidos = document.getElementById("totalRespondidos");
const totalSemRetorno = document.getElementById("totalSemRetorno");

let templatesCache = [];
let relatorioCache = [];

function setResponse(element, text, type = "") {
  if (!element) return;
  element.textContent = text;
  element.className = type ? `response ${type}` : "response";
  element.style.whiteSpace = "pre-line";
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;

  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = loadingText || "Processando...";
    return;
  }

  button.disabled = false;
  button.classList.remove("is-loading");
  button.textContent = button.dataset.originalText || button.textContent;
}

function formatarData(data) {
  if (!data) return "-";

  const date = new Date(data);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
}

function formatarPrazo(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return `${valor}h`;
}

function escapeCsv(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).replace(/"/g, '""');
  return `"${texto}"`;
}

function normalizarTexto(valor) {
  return (valor || "").toString().trim().toLowerCase();
}

function getStatusFollowupBadge(status) {
  const valor = (status || "").toUpperCase();

  if (valor === "RESPONDIDO") {
    return `<span class="status-badge status-respondido">Respondido</span>`;
  }

  if (valor === "SEM_RETORNO") {
    return `<span class="status-badge status-sem-retorno">Sem retorno</span>`;
  }

  if (valor === "AGUARDANDO") {
    return `<span class="status-badge status-aguardando">Aguardando</span>`;
  }

  return `<span class="status-badge status-enviado">${status || "-"}</span>`;
}

function getStatusEnvioBadge(status) {
  const valor = (status || "").toUpperCase();

  if (valor === "MENSAGEM_ENVIADA") {
    return `<span class="status-badge status-enviado">Enviada</span>`;
  }

  if (valor === "MENSAGEM_PENDENTE") {
    return `<span class="status-badge status-aguardando">Pendente</span>`;
  }

  if (valor === "MENSAGEM_ERRO") {
    return `<span class="status-badge status-sem-retorno">Erro</span>`;
  }

  if (valor === "TICKET_PENDENTE") {
    return `<span class="status-badge status-aguardando">Ticket pendente</span>`;
  }

  return `<span class="status-badge status-enviado">${status || "-"}</span>`;
}

function atualizarResumo(lista) {
  const aguardando = lista.filter(item => (item.status_followup || "").toUpperCase() === "AGUARDANDO").length;
  const respondidos = lista.filter(item => (item.status_followup || "").toUpperCase() === "RESPONDIDO").length;
  const semRetorno = lista.filter(item => (item.status_followup || "").toUpperCase() === "SEM_RETORNO").length;

  totalRegistros.textContent = lista.length;
  totalAguardando.textContent = aguardando;
  totalRespondidos.textContent = respondidos;
  totalSemRetorno.textContent = semRetorno;
}

function renderProtocoloCell(item) {
  if (item.protocolo) {
    return item.protocolo;
  }

  return `
    <div class="protocolo-manual-wrap">
      <span>-</span>
      <button
        type="button"
        class="btn-add-protocolo"
        data-id="${item.id}"
        title="Adicionar protocolo manualmente"
      >+</button>
    </div>
  `;
}

async function salvarProtocoloManual(messageSendingId, protocolo) {
  const protocoloFinal = (protocolo || "").trim();

  if (!protocoloFinal) {
    throw new Error("Informe um protocolo válido.");
  }

  const { error } = await supabaseClient
    .from("message_sending")
    .update({
      protocolo: protocoloFinal
    })
    .eq("id", messageSendingId);

  if (error) {
    throw new Error(`Erro ao salvar protocolo: ${error.message}`);
  }
}

function bindBotoesProtocoloManual() {
  const buttons = document.querySelectorAll(".btn-add-protocolo");

  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;

    button.addEventListener("click", async () => {
      const messageSendingId = button.dataset.id;
      const protocolo = window.prompt("Informe o protocolo manualmente:");

      if (!protocolo || !protocolo.trim()) {
        return;
      }

      try {
        setResponse(retornoRelatorio, "Salvando protocolo manualmente...", "warning");
        await salvarProtocoloManual(messageSendingId, protocolo.trim());
        await buscarRelatorio();
        setResponse(retornoRelatorio, "Protocolo salvo com sucesso.", "success");
      } catch (error) {
        console.error(error);
        setResponse(retornoRelatorio, error.message, "error");
      }
    });

    button.dataset.bound = "true";
  });
}

function renderTabela(lista) {
  if (!relatorioBody) return;

  if (!lista.length) {
    relatorioBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-row">Nenhum registro encontrado.</td>
      </tr>
    `;
    atualizarResumo([]);
    return;
  }

  relatorioBody.innerHTML = lista.map((item) => {
    const client = item.client || {};
    const contact = item.contact || {};
    const template = item.template || {};
    const user = item.user || {};

    return `
      <tr>
        <td>${client.oi || "-"}</td>
        <td>${client.name || "-"}</td>
        <td>${contact.nome || "-"}</td>
        <td>${contact.telefone || "-"}</td>
        <td>${template.nome || "-"}</td>
        <td>${renderProtocoloCell(item)}</td>
        <td>${getStatusEnvioBadge(item.status)}</td>
        <td>${getStatusFollowupBadge(item.status_followup)}</td>
        <td>${formatarData(item.data_envio)}</td>
        <td>${formatarData(item.data_resposta)}</td>
        <td>${formatarPrazo(item.prazo_horas)}</td>
        <td>${user.nome || "-"}</td>
      </tr>
    `;
  }).join("");

  atualizarResumo(lista);
  bindBotoesProtocoloManual();
}

function aplicarFiltrosLocais(lista) {
  const tipo = (filtroTipo?.value || "mensagens").toLowerCase();
  const oi = normalizarTexto(filtroOi?.value);
  const empresa = normalizarTexto(filtroEmpresa?.value);
  const templateId = filtroTemplate?.value || "";
  const status = (filtroStatus?.value || "").toUpperCase();
  const dataInicio = filtroDataInicio?.value || "";
  const dataFim = filtroDataFim?.value || "";

  return lista.filter((item) => {
    const client = item.client || {};
    const clientOi = normalizarTexto(client.oi);
    const clientName = normalizarTexto(client.name);
    const itemTemplateId = item.template_id || "";
    const itemStatus = (item.status_followup || "").toUpperCase();
    const itemStatusEnvio = (item.status || "").toUpperCase();

    const ehMensagem =
      itemStatusEnvio.startsWith("MENSAGEM_") ||
      itemStatusEnvio === "MENSAGEM_ENVIADA" ||
      itemStatusEnvio === "MENSAGEM_PENDENTE" ||
      itemStatusEnvio === "MENSAGEM_ERRO";

    const ehTicket =
      itemStatusEnvio.startsWith("TICKET_") ||
      itemStatusEnvio === "TICKET_PENDENTE";

    if (tipo === "mensagens" && !ehMensagem) return false;
    if (tipo === "tickets" && !ehTicket) return false;

    if (oi && !clientOi.includes(oi)) return false;
    if (empresa && !clientName.includes(empresa)) return false;
    if (templateId && itemTemplateId !== templateId) return false;
    if (status && itemStatus !== status) return false;

    if (dataInicio) {
      const inicio = new Date(`${dataInicio}T00:00:00`);
      const dataEnvio = item.data_envio ? new Date(item.data_envio) : null;
      if (!dataEnvio || dataEnvio < inicio) return false;
    }

    if (dataFim) {
      const fim = new Date(`${dataFim}T23:59:59`);
      const dataEnvio = item.data_envio ? new Date(item.data_envio) : null;
      if (!dataEnvio || dataEnvio > fim) return false;
    }

    return true;
  });
}

async function loadTemplatesFiltro() {
  const { data, error } = await supabaseClient
    .from("template")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar templates: ${error.message}`);
  }

  templatesCache = data || [];

  if (filtroTemplate) {
    filtroTemplate.innerHTML = `<option value="">Todos</option>`;

    templatesCache.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.nome || "Sem nome";
      filtroTemplate.appendChild(option);
    });
  }
}

async function buscarRelatorio() {
  setResponse(retornoRelatorio, "Buscando registros...", "warning");

  const { data, error } = await supabaseClient
    .from("message_sending")
    .select(`
      id,
      client_id,
      contact_id,
      template_id,
      user_id,
      status,
      erro,
      tentativas,
      data_envio,
      created_at,
      protocolo,
      data_resposta,
      respondeu,
      status_followup,
      prazo_horas,
      client:client_id (
        id,
        oi,
        name
      ),
      contact:contact_id (
        id,
        nome,
        email,
        telefone
      ),
      template:template_id (
        id,
        nome
      ),
      user:user_id (
        id,
        nome
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar relatório: ${error.message}`);
  }

  relatorioCache = data || [];

  const listaFiltrada = aplicarFiltrosLocais(relatorioCache);
  renderTabela(listaFiltrada);

  setResponse(
    retornoRelatorio,
    `Consulta finalizada.\n${listaFiltrada.length} registro(s) encontrado(s).`,
    "success"
  );
}

async function atualizarFollowup() {
  setResponse(retornoRelatorio, "Atualizando follow-up dos registros...", "warning");

  const payload = {
    template_id: filtroTemplate?.value || null,
    somente_pendentes: true
  };

  const response = await fetch(`${BACKEND_MENSAGEM_URL}/api/atualizar-followup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.erro || "Erro ao atualizar follow-up.");
  }

  await buscarRelatorio();

  setResponse(
    retornoRelatorio,
    `Follow-up atualizado com sucesso.
Registros encontrados: ${data.total_registros_encontrados || 0}
Processados: ${data.total_processados || 0}
Respondidos: ${data.total_respondidos || 0}
Sem retorno: ${data.total_sem_retorno || 0}
Aguardando: ${data.total_aguardando || 0}
Erros: ${data.total_erros || 0}`,
    "success"
  );
}

function limparFiltros() {
  if (filtroTipo) filtroTipo.value = "mensagens";
  if (filtroOi) filtroOi.value = "";
  if (filtroEmpresa) filtroEmpresa.value = "";
  if (filtroTemplate) filtroTemplate.value = "";
  if (filtroStatus) filtroStatus.value = "";
  if (filtroDataInicio) filtroDataInicio.value = "";
  if (filtroDataFim) filtroDataFim.value = "";

  const listaFiltrada = aplicarFiltrosLocais(relatorioCache);
  renderTabela(listaFiltrada);
  setResponse(retornoRelatorio, "Filtros limpos.", "success");
}

function exportarCsv() {
  const listaFiltrada = aplicarFiltrosLocais(relatorioCache);

  if (!listaFiltrada.length) {
    setResponse(retornoRelatorio, "Não há dados para exportar.", "warning");
    return;
  }

  const header = [
    "OI",
    "Empresa",
    "Contato",
    "Telefone",
    "Template",
    "Protocolo",
    "Status Envio",
    "Status Follow-up",
    "Data Envio",
    "Data Resposta",
    "Prazo Horas",
    "Analista"
  ];

  const linhas = listaFiltrada.map((item) => {
    const client = item.client || {};
    const contact = item.contact || {};
    const template = item.template || {};
    const user = item.user || {};

    return [
      client.oi || "",
      client.name || "",
      contact.nome || "",
      contact.telefone || "",
      template.nome || "",
      item.protocolo || "",
      item.status || "",
      item.status_followup || "",
      item.data_envio || "",
      item.data_resposta || "",
      item.prazo_horas || "",
      user.nome || ""
    ].map(escapeCsv).join(";");
  });

  const csvContent = [header.join(";"), ...linhas].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio_envios.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  setResponse(retornoRelatorio, "CSV exportado com sucesso.", "success");
}

function setupMenu() {
  const rotas = {
    acoes: "./main.html",
    templates: "./template.html",
    contatos: "./contato.html",
    relatorios: "./relatorio.html",
  };

  const menuButtons = [...document.querySelectorAll(".menu button")];

  menuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;

      menuButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      if (rotas[target]) {
        window.location.href = rotas[target];
      }
    });
  });
}

function bindEvents() {
  if (btnBuscarRelatorio) {
    btnBuscarRelatorio.addEventListener("click", async () => {
      try {
        await buscarRelatorio();
      } catch (error) {
        console.error(error);
        setResponse(retornoRelatorio, error.message, "error");
      }
    });
  }

  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener("click", () => {
      limparFiltros();
    });
  }

  if (btnExportarRelatorio) {
    btnExportarRelatorio.addEventListener("click", () => {
      exportarCsv();
    });
  }

  if (btnAtualizarFollowup) {
    btnAtualizarFollowup.addEventListener("click", async () => {
      try {
        setButtonLoading(btnAtualizarFollowup, true, "Atualizando follow-up...");
        await atualizarFollowup();
      } catch (error) {
        console.error(error);
        setResponse(retornoRelatorio, error.message, "error");
      } finally {
        setButtonLoading(btnAtualizarFollowup, false);
      }
    });
  }

  [filtroTipo, filtroOi, filtroEmpresa, filtroTemplate, filtroStatus, filtroDataInicio, filtroDataFim]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener("change", () => {
        const listaFiltrada = aplicarFiltrosLocais(relatorioCache);
        renderTabela(listaFiltrada);
      });

      if (element.tagName === "INPUT" && element.type === "text") {
        element.addEventListener("input", () => {
          const listaFiltrada = aplicarFiltrosLocais(relatorioCache);
          renderTabela(listaFiltrada);
        });
      }
    });
}

async function init() {
  try {
    setupMenu();
    bindEvents();
    await loadTemplatesFiltro();

    if (filtroTipo) {
      filtroTipo.value = "mensagens";
    }

    await buscarRelatorio();
  } catch (error) {
    console.error(error);
    setResponse(retornoRelatorio, error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);