
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;



const BACKEND_MENSAGEM_URL = "http://195.200.0.29:6969";
const BACKEND_TICKET_URL = "http://195.200.0.29:6970";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const gridBody = document.getElementById("gridBody");
const btnAdicionarLinha = document.getElementById("btnAdicionarLinha");
const btnLimparCampos = document.getElementById("btnLimparCampos");
const btnEnviarMensagem = document.getElementById("btnEnviarMensagem");
const btnCriarTicket = document.getElementById("btnCriarTicket");
const csvInput = document.getElementById("csvInput");
const retornoMensagem = document.getElementById("retornoMensagem");
const retornoTicket = document.getElementById("retornoTicket");

let templatesCache = [];
let currentAppUser = null;
const debounceMap = new WeakMap();

function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function $all(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

function setResponse(element, text, type = "") {
  if (!element) return;
  element.textContent = text;
  element.className = type ? `response ${type}` : "response";
  element.style.whiteSpace = "pre-line";
}

function montarRetornoSimples(lista, tipo) {
  if (!lista.length) return "Nenhum processamento realizado.";

  return lista.map((item) => {
    if (tipo === "mensagem") {
      return item.erro
        ? `${item.telefone || "-"} - ERRO: ${item.erro}`
        : `${item.telefone || "-"} - SUCESSO`;
    }

    return item.erro
      ? `${item.email || "-"} - ERRO: ${item.erro}`
      : `${item.email || "-"} - SUCESSO`;
  }).join("\n");
}

function debounceForElement(element, callback, delay = 300) {
  const existing = debounceMap.get(element);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(callback, delay);
  debounceMap.set(element, timer);
}

function normalizarValor(valor) {
  if (!valor) return "";

  valor = valor.toString().trim();

  if (valor.endsWith(".0")) {
    valor = valor.slice(0, -2);
  }

  return valor;
}

function aplicarTemplateEmMassa(templateId) {
  const rows = $all("tr", gridBody);

  rows.forEach((row) => {
    applyTemplateData(row, templateId);

    const select = $('[data-field="template"]', row);
    if (select) {
      select.value = templateId;
    }
  });
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

async function getLoggedAppUser() {
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !authData?.user) {
    throw new Error("Não foi possível identificar o usuário logado.");
  }

  const authUserId = authData.user.id;

  const { data: userData, error: userError } = await supabaseClient
    .from("user")
    .select("id, nome, auth_user_id")
    .eq("auth_user_id", authUserId)
    .single();

  if (userError || !userData) {
    throw new Error("Usuário autenticado sem vínculo com a tabela public.user.");
  }

  currentAppUser = userData;
  return currentAppUser;
}

async function loadTemplates() {
  const { data, error } = await supabaseClient
    .from("template")
    .select("id, nome, mensagem, titulo_ticket, descricao, motivo, time")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar templates: ${error.message}`);
  }

  templatesCache = data || [];
}

function fillTemplateSelect(select) {
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = `<option value="">Selecione</option>`;

  templatesCache.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.nome || "Sem nome";
    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

function applyTemplateData(row, templateId) {
  const template = templatesCache.find((item) => item.id === templateId);
  if (!template) return;

  const mapping = {
    mensagemWhatsapp: template.mensagem || "",
    tituloTicket: template.titulo_ticket || "",
    descricaoTicket: template.descricao || "",
    motivo: template.motivo || "",
    time: template.time || "",
    templateManual: template.nome || ""
  };

  Object.entries(mapping).forEach(([fieldName, value]) => {
    const field = $(`[data-field="${fieldName}"]`, row);
    if (field) field.value = value;
  });

  row.dataset.templateId = template.id || "";
}

async function searchClientsByName(term) {
  const { data, error } = await supabaseClient
    .from("client")
    .select("id, name, oi")
    .ilike("name", `%${term}%`)
    .order("name", { ascending: true })
    .limit(8);

  if (error) {
    console.error("Erro ao buscar empresa:", error);
    return [];
  }

  return data || [];
}

async function searchClientsByOi(term) {
  const { data, error } = await supabaseClient
    .from("client")
    .select("id, name, oi")
    .ilike("oi", `%${term}%`)
    .order("oi", { ascending: true })
    .limit(8);

  if (error) {
    console.error("Erro ao buscar OI:", error);
    return [];
  }

  return data || [];
}

async function getContactsByClientId(clientId) {
  const { data, error } = await supabaseClient
    .from("contact")
    .select("id, client_id, nome, email, telefone")
    .eq("client_id", clientId)
    .eq("principal", true)
    .eq("ativo", true)
    .limit(1);

  if (error) {
    console.error("Erro ao buscar contatos:", error);
    return [];
  }

  return data || [];
}

function clearAutocompleteList(list) {
  if (list) list.innerHTML = "";
}

function fillContactSelect(row, contacts) {
  const contactSelect = $('[data-field="contato"]', row);
  if (!contactSelect) return;

  contactSelect.innerHTML = `<option value="">Selecione</option>`;

  contacts.forEach((contact) => {
    const option = document.createElement("option");
    option.value = contact.id;
    option.textContent = `${contact.nome || "Sem nome"}${contact.email ? ` • ${contact.email}` : ""}`;
    contactSelect.appendChild(option);
  });
}

function applyContactToRow(row, contact) {
  const nomeField = $('[data-field="nome"]', row);
  const emailField = $('[data-field="email"]', row);
  const telefoneField = $('[data-field="telefone"]', row);

  if (!contact) {
    row.dataset.contactId = "";
    if (nomeField) nomeField.value = "";
    if (emailField) emailField.value = "";
    if (telefoneField) telefoneField.value = "";
    return;
  }

  row.dataset.contactId = contact.id || "";

  if (nomeField) nomeField.value = contact.nome || "";
  if (emailField) emailField.value = contact.email || "";
  if (telefoneField) telefoneField.value = contact.telefone || "";
}

async function applyClientToRow(row, client) {
  if (!row || !client) return;

  row.dataset.clientId = client.id || "";
  row.dataset.contactId = "";

  const empresaField = $('[data-field="empresa"]', row);
  const oiField = $('[data-field="oi"]', row);
  const nomeField = $('[data-field="nome"]', row);
  const emailField = $('[data-field="email"]', row);
  const telefoneField = $('[data-field="telefone"]', row);
  const contactSelect = $('[data-field="contato"]', row);

  if (empresaField) empresaField.value = client.name || "";
  if (oiField) oiField.value = client.oi || "";

  if (nomeField) nomeField.value = "";
  if (emailField) emailField.value = "";
  if (telefoneField) telefoneField.value = "";

  const contacts = await getContactsByClientId(client.id);
  row._contactsCache = contacts;

  if (contactSelect) {
    fillContactSelect(row, contacts);

    if (contacts.length > 0) {
      contactSelect.value = contacts[0].id;
      applyContactToRow(row, contacts[0]);
    }
  } else if (contacts.length > 0) {
    applyContactToRow(row, contacts[0]);
  }
}

function setupAutocomplete(row, fieldName, mode) {
  const input = $(`[data-field="${fieldName}"]`, row);
  if (!input) return;

  const wrapper = input.closest(".autocomplete");
  const list = $(".autocomplete-list", wrapper);

  if (!wrapper || !list) return;
  if (input.dataset.bound === "true") return;

  input.addEventListener("input", () => {
    const term = input.value.trim();

    if (!term) {
      clearAutocompleteList(list);

      if (fieldName === "empresa" || fieldName === "oi") {
        row.dataset.clientId = "";
        row.dataset.contactId = "";
        row._contactsCache = [];

        const nomeField = $('[data-field="nome"]', row);
        const emailField = $('[data-field="email"]', row);
        const telefoneField = $('[data-field="telefone"]', row);
        const contactSelect = $('[data-field="contato"]', row);

        if (nomeField) nomeField.value = "";
        if (emailField) emailField.value = "";
        if (telefoneField) telefoneField.value = "";

        if (contactSelect) {
          contactSelect.innerHTML = `<option value="">Selecione</option>`;
        }
      }

      return;
    }

    debounceForElement(input, async () => {
      const items = mode === "empresa"
        ? await searchClientsByName(term)
        : await searchClientsByOi(term);

      clearAutocompleteList(list);

      items.forEach((client) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "autocomplete-item";
        option.textContent = mode === "empresa"
          ? `${client.name || ""}${client.oi ? ` • ${client.oi}` : ""}`
          : `${client.oi || ""}${client.name ? ` • ${client.name}` : ""}`;

        option.addEventListener("click", async () => {
          await applyClientToRow(row, client);
          clearAutocompleteList(list);
        });

        list.appendChild(option);
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      clearAutocompleteList(list);
    }
  });

  input.dataset.bound = "true";
}

function setLoggedAnalyst(row) {
  const analistaField = $('[data-field="analista"]', row);
  if (!analistaField) return;

  analistaField.value = currentAppUser?.nome || "";
  row.dataset.userId = currentAppUser?.id || "";
}

function bindTemplateEvent(row) {
  const templateSelect = $('[data-field="template"]', row);
  if (!templateSelect) return;

  fillTemplateSelect(templateSelect);

  if (templateSelect.dataset.bound === "true") return;

  templateSelect.addEventListener("change", (event) => {
    applyTemplateData(row, event.target.value);
  });

  templateSelect.dataset.bound = "true";
}

function bindContactEvent(row) {
  const contactSelect = $('[data-field="contato"]', row);
  if (!contactSelect) return;
  if (contactSelect.dataset.bound === "true") return;

  contactSelect.addEventListener("change", (event) => {
    const selectedId = event.target.value;
    const contacts = row._contactsCache || [];
    const selectedContact = contacts.find((item) => String(item.id) === String(selectedId)) || null;
    applyContactToRow(row, selectedContact);
  });

  contactSelect.dataset.bound = "true";
}

function clearRow(row) {
  row.dataset.clientId = "";
  row.dataset.contactId = "";
  row.dataset.templateId = "";
  row._contactsCache = [];

  const fieldsToClear = [
    "oi",
    "empresa",
    "nome",
    "telefone",
    "mensagemWhatsapp",
    "email",
    "tituloTicket",
    "descricaoTicket",
    "motivo",
    "time",
    "templateManual"
  ];

  fieldsToClear.forEach((fieldName) => {
    const field = row.querySelector(`[data-field="${fieldName}"]`);
    if (field) field.value = "";
  });

  $all("select", row).forEach((field) => {
    field.selectedIndex = 0;
  });

  const contactSelect = $('[data-field="contato"]', row);
  if (contactSelect) {
    contactSelect.innerHTML = `<option value="">Selecione</option>`;
  }

  $all(".autocomplete-list", row).forEach((list) => {
    list.innerHTML = "";
  });

  row.style.background = "";
  setLoggedAnalyst(row);
}

function bindRemoveButton(row) {
  const removeButton = $(".btn-remove-row", row);
  if (!removeButton) return;
  if (removeButton.dataset.bound === "true") return;

  removeButton.addEventListener("click", (event) => {
    event.preventDefault();

    const rows = $all("tr", gridBody);

    if (rows.length === 1) {
      clearRow(row);
      return;
    }

    row.remove();
  });

  removeButton.dataset.bound = "true";
}

function bindRow(row) {
  bindTemplateEvent(row);
  bindContactEvent(row);
  bindRemoveButton(row);
  setupAutocomplete(row, "empresa", "empresa");
  setupAutocomplete(row, "oi", "oi");
  setLoggedAnalyst(row);
}

function cloneBaseRow() {
  const firstRow = $("#gridBody tr");
  if (!firstRow) return null;

  const clone = firstRow.cloneNode(true);

  clone.dataset.clientId = "";
  clone.dataset.contactId = "";
  clone.dataset.templateId = "";
  clone.dataset.userId = currentAppUser?.id || "";
  clone._contactsCache = [];

  $all("input, textarea", clone).forEach((field) => {
    field.value = "";
    if (field.dataset.field === "analista") {
      field.value = currentAppUser?.nome || "";
    }
    field.dataset.bound = "";
  });

  $all("select", clone).forEach((field) => {
    field.selectedIndex = 0;
    field.dataset.bound = "";

    if (field.dataset.field === "contato") {
      field.innerHTML = `<option value="">Selecione</option>`;
    }
  });

  $all(".autocomplete-list", clone).forEach((list) => {
    list.innerHTML = "";
  });

  const removeButton = $(".btn-remove-row", clone);
  if (removeButton) removeButton.dataset.bound = "";

  return clone;
}

function getRowPayload(row, actionName) {
  const templateSelect = $('[data-field="template"]', row);

  return {
    client_id: row.dataset.clientId || null,
    contact_id: row.dataset.contactId || null,
    template_id: templateSelect?.value || null,
    mesagem: $('[data-field="mensagemWhatsapp"]', row)?.value?.trim() || null,
    email_destino: $('[data-field="email"]', row)?.value?.trim() || null,
    titulo_ticket: $('[data-field="tituloTicket"]', row)?.value?.trim() || null,
    descricao_ticket: $('[data-field="descricaoTicket"]', row)?.value?.trim() || null,
    motivo: $('[data-field="motivo"]', row)?.value?.trim() || null,
    time: $('[data-field="time"]', row)?.value?.trim() || null,
    user_id: currentAppUser?.id || null,
    status: actionName === "mensagem" ? "mensagem_pendente" : "ticket_pendente",
    erro: null,
    tentativas: 0,
    data_envio: null,

    protocolo: null,
    data_resposta: null,
    respondeu: actionName === "mensagem" ? false : null,
    status_followup: actionName === "mensagem" ? "AGUARDANDO" : null,
    prazo_horas: actionName === "mensagem" ? 6 : null
  };
}

function validateRow(payload, actionName) {
  if (!payload.client_id) {
    return "Selecione uma empresa válida na linha.";
  }

  if (actionName === "mensagem" && !payload.mesagem) {
    return "A mensagem é obrigatória para envio.";
  }

  if (actionName === "ticket") {
    if (!payload.email_destino) return "O e-mail é obrigatório para criar o ticket.";
    if (!payload.titulo_ticket) return "O título do ticket é obrigatório.";
    if (!payload.descricao_ticket) return "A descrição do ticket é obrigatória.";
  }

  return null;
}

async function salvarLinha(row, actionName) {
  const payload = getRowPayload(row, actionName);
  const validationError = validateRow(payload, actionName);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabaseClient
    .from("message_sending")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao gravar message_sending: ${error.message}`);
  }

  return data;
}

async function enviarMensagemBackend(row, messageSendingId) {
  const payload = {
    message_sending_id: messageSendingId,
    empresa: $('[data-field="empresa"]', row)?.value?.trim() || "",
    nome: $('[data-field="nome"]', row)?.value?.trim() || "",
    telefone: $('[data-field="telefone"]', row)?.value?.trim() || "",
    mensagem: $('[data-field="mensagemWhatsapp"]', row)?.value?.trim() || "",
    analista: $('[data-field="analista"]', row)?.value?.trim() || ""
  };

  const response = await fetch(`${BACKEND_MENSAGEM_URL}/api/enviar-mensagem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.erro || "Erro ao enviar mensagem.");
  }

  return data;
}

async function criarTicketBackend(row, messageSendingId) {
  const payload = {
    message_sending_id: messageSendingId,
    client_id: row.dataset.clientId || "",
    empresa: $('[data-field="empresa"]', row)?.value?.trim() || "",
    nome: $('[data-field="nome"]', row)?.value?.trim() || "",
    telefone: $('[data-field="telefone"]', row)?.value?.trim() || "",
    email: $('[data-field="email"]', row)?.value?.trim() || "",
    titulo_ticket: $('[data-field="tituloTicket"]', row)?.value?.trim() || "",
    descricao_ticket: $('[data-field="descricaoTicket"]', row)?.value?.trim() || "",
    motivo: $('[data-field="motivo"]', row)?.value?.trim() || "",
    time: $('[data-field="time"]', row)?.value?.trim() || "",
    analista: $('[data-field="analista"]', row)?.value?.trim() || ""
  };

  const response = await fetch(`${BACKEND_TICKET_URL}/api/criar-ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.erro || "Erro ao criar ticket.");
  }

  return data;
}

async function processarCSV(file) {
  const nomeArquivo = (file.name || "").toLowerCase();

  if (!nomeArquivo.endsWith(".csv") && !nomeArquivo.endsWith(".txt")) {
    throw new Error("Envie um arquivo CSV. Arquivos .xlsx não são lidos por este código atual.");
  }

  const text = await file.text();
  const linhas = text.split("\n");
  const header = (linhas[0] || "").replace("\r", "").trim().toLowerCase();
  const rowsExistentes = $all("tr", gridBody);

  let totalLinhas = 0;
  let encontrados = 0;
  let naoEncontrados = 0;

  if (header !== "oi" && header !== "empresa") {
    throw new Error('A primeira linha do arquivo deve conter apenas "oi" ou "empresa".');
  }

  for (let i = 1; i < linhas.length; i++) {
    let valor = linhas[i].replace("\r", "").trim();
    if (!valor) continue;

    totalLinhas++;
    valor = normalizarValor(valor);

    let row;

    if (i === 1 && rowsExistentes.length > 0) {
      row = rowsExistentes[0];
      clearRow(row);
    } else {
      row = cloneBaseRow();
      if (!row) {
        throw new Error("Não foi possível criar novas linhas na grade.");
      }
      gridBody.appendChild(row);
    }

    bindRow(row);

    if (header === "oi") {
      const inputOi = row.querySelector('[data-field="oi"]');
      if (inputOi) inputOi.value = valor;

      const clientes = await searchClientsByOi(valor);

      if (clientes.length > 0) {
        await applyClientToRow(row, clientes[0]);
        row.style.background = "";
        encontrados++;
      } else {
        row.style.background = "#ffe5e5";
        naoEncontrados++;
      }
    }

    if (header === "empresa") {
      const inputEmpresa = row.querySelector('[data-field="empresa"]');
      if (inputEmpresa) inputEmpresa.value = valor;

      const clientes = await searchClientsByName(valor);

      if (clientes.length > 0) {
        await applyClientToRow(row, clientes[0]);
        row.style.background = "";
        encontrados++;
      } else {
        row.style.background = "#ffe5e5";
        naoEncontrados++;
      }
    }
  }

  return {
    arquivo: file.name,
    coluna: header,
    totalLinhas,
    encontrados,
    naoEncontrados
  };
}

function setupMenu() {
  const rotas = {
    acoes: "./main.html",
    templates: "./template.html",
    contatos: "./contato.html",
    relatorios: "./relatorio.html",
  };

  const menuButtons = $all(".menu button");

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

function setupMainActions() {
  if (btnAdicionarLinha) {
    btnAdicionarLinha.addEventListener("click", (event) => {
      event.preventDefault();

      const newRow = cloneBaseRow();
      if (!newRow) return;

      gridBody.appendChild(newRow);
      bindRow(newRow);
    });
  }

  if (btnLimparCampos) {
    btnLimparCampos.addEventListener("click", (event) => {
      event.preventDefault();

      const rows = gridBody.querySelectorAll("tr");

      rows.forEach((row) => {
        clearRow(row);
      });

      if (csvInput) csvInput.value = "";

      setResponse(retornoMensagem, "Campos limpos. Aguardando ação...");
      setResponse(retornoTicket, "Campos limpos. Aguardando ação...");
    });
  }

  if (btnEnviarMensagem) {
    btnEnviarMensagem.addEventListener("click", async (event) => {
      event.preventDefault();
      setButtonLoading(btnEnviarMensagem, true, "Processando envio...");

      try {
        setResponse(retornoMensagem, "Enviando mensagens, aguarde...", "warning");

        const rows = $all("tr", gridBody);

        if (rows.length === 0) {
          throw new Error("Nenhuma linha encontrada para envio.");
        }

        const resultados = [];

        for (const row of rows) {
          const telefone = $('[data-field="telefone"]', row)?.value?.trim() || "";

          try {
            const inserted = await salvarLinha(row, "mensagem");
            await enviarMensagemBackend(row, inserted.id);

            resultados.push({
              telefone,
              erro: ""
            });
          } catch (error) {
            resultados.push({
              telefone,
              erro: error.message || "Erro ao enviar mensagem."
            });
          }
        }

        const teveErro = resultados.some(item => item.erro);

        setResponse(
          retornoMensagem,
          montarRetornoSimples(resultados, "mensagem"),
          teveErro ? "warning" : "success"
        );
      } catch (error) {
        console.error(error);
        setResponse(retornoMensagem, error.message, "error");
      } finally {
        setButtonLoading(btnEnviarMensagem, false);
      }
    });
  }

  if (btnCriarTicket) {
    btnCriarTicket.addEventListener("click", async (event) => {
      event.preventDefault();
      setButtonLoading(btnCriarTicket, true, "Processando ticket...");

      try {
        setResponse(retornoTicket, "Criando tickets, aguarde...", "warning");

        const rows = $all("tr", gridBody);

        if (rows.length === 0) {
          throw new Error("Nenhuma linha encontrada para criação de ticket.");
        }

        const resultados = [];

        for (const row of rows) {
          const email = $('[data-field="email"]', row)?.value?.trim() || "";

          try {
            const inserted = await salvarLinha(row, "ticket");
            await criarTicketBackend(row, inserted.id);

            resultados.push({
              email,
              erro: ""
            });
          } catch (error) {
            resultados.push({
              email,
              erro: error.message || "Erro ao criar ticket."
            });
          }
        }

        const teveErro = resultados.some(item => item.erro);

        setResponse(
          retornoTicket,
          montarRetornoSimples(resultados, "ticket"),
          teveErro ? "warning" : "success"
        );
      } catch (error) {
        console.error(error);
        setResponse(retornoTicket, error.message, "error");
      } finally {
        setButtonLoading(btnCriarTicket, false);
      }
    });
  }

  if (csvInput) {
    csvInput.addEventListener("change", async (event) => {
      try {
        const file = event.target.files[0];
        if (!file) return;

        setResponse(
          retornoMensagem,
          `Arquivo selecionado: ${file.name}\nIniciando carregamento...`,
          "warning"
        );
        setResponse(retornoTicket, "Processando dados...", "warning");

        const resultado = await processarCSV(file);

        setResponse(
          retornoMensagem,
          `Arquivo carregado com sucesso!

Arquivo: ${resultado.arquivo}
Coluna identificada: ${resultado.coluna}
Total de linhas lidas: ${resultado.totalLinhas}
Clientes encontrados: ${resultado.encontrados}
Clientes não encontrados: ${resultado.naoEncontrados}`,
          "success"
        );

        setResponse(
          retornoTicket,
          `Importação finalizada.
${resultado.totalLinhas} linha(s) processada(s).`,
          "success"
        );
      } catch (error) {
        console.error(error);
        setResponse(
          retornoMensagem,
          `Erro ao processar planilha: ${error.message}`,
          "error"
        );
        setResponse(
          retornoTicket,
          "Falha ao carregar os dados.",
          "error"
        );
      }
    });
  }
}

async function init() {
  try {
    await getLoggedAppUser();
    await loadTemplates();

    const firstRow = $("#gridBody tr");
    if (firstRow) {
      bindRow(firstRow);
    }

    setupMenu();
    setupMainActions();

    const templateGlobal = document.getElementById("templateGlobal");
    const btnAplicarTemplate = document.getElementById("btnAplicarTemplate");

    if (templateGlobal) {
      templateGlobal.innerHTML = `<option value="">Selecionar template para todos</option>`;

      templatesCache.forEach((template) => {
        const option = document.createElement("option");
        option.value = template.id;
        option.textContent = template.nome;
        templateGlobal.appendChild(option);
      });
    }

    if (btnAplicarTemplate) {
      btnAplicarTemplate.addEventListener("click", () => {
        const templateId = templateGlobal.value;
        if (!templateId) return;

        aplicarTemplateEmMassa(templateId);
      });
    }

    setResponse(retornoMensagem, "Tela pronta para envio.");
    setResponse(retornoTicket, "Tela pronta para criação de ticket.");
  } catch (error) {
    console.error(error);
    setResponse(retornoMensagem, error.message, "error");
    setResponse(retornoTicket, error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);