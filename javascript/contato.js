const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const TABLE_CLIENT = "client";
const TABLE_CONTACT = "contact";

const empresaForm = document.getElementById("empresaForm");
const empresaId = document.getElementById("empresaId");
const empresaNome = document.getElementById("empresaNome");
const empresaOi = document.getElementById("empresaOi");
const empresaAtiva = document.getElementById("empresaAtiva");
const btnSalvarEmpresa = document.getElementById("btnSalvarEmpresa");
const btnLimparEmpresa = document.getElementById("btnNovaEmpresa");
const retornoEmpresa = document.getElementById("retornoEmpresa");
const empresasTableBody = document.getElementById("empresasTableBody");

const btnAdicionarContato = document.getElementById("btnAdicionarContato");
const btnLimparContatosGrid = document.getElementById("btnLimparContatosGrid");
const contatosGridBody = document.getElementById("contatosGridBody");

const modalContatoBackdrop = document.getElementById("modalContatoBackdrop");
const modalEmpresaTitulo = document.getElementById("modalEmpresaTitulo");
const btnFecharModal = document.getElementById("btnFecharModal");
const btnModalAdicionarContato = document.getElementById("btnModalAdicionarContato");
const btnModalSalvarContatos = document.getElementById("btnModalSalvarContatos");
const btnModalLimparContatos = document.getElementById("btnModalLimparContatos");
const modalContatosGridBody = document.getElementById("modalContatosGridBody");
const retornoModalContato = document.getElementById("retornoModalContato");

const csvInput = document.getElementById("csvInput");
const btnImportarCsv = document.getElementById("btnImportarCsv");
const retornoCsv = document.getElementById("retornoCsv");

const filtroTipoBusca = document.getElementById("filtroTipoBusca");
const inputBuscaEmpresa = document.getElementById("inputBuscaEmpresa");
const btnBuscarEmpresa = document.getElementById("btnBuscarEmpresa");
const btnLimparBuscaEmpresa = document.getElementById("btnLimparBuscaEmpresa");
const retornoBuscaEmpresa = document.getElementById("retornoBuscaEmpresa");
const resultadoBuscaWrap = document.getElementById("resultadoBuscaWrap");

let empresaSelecionada = null;

function setFeedback(element, message, type = "default") {
  if (!element) return;

  element.textContent = message;
  element.classList.remove("feedback-success", "feedback-error", "feedback-warning");

  if (type === "success") element.classList.add("feedback-success");
  if (type === "error") element.classList.add("feedback-error");
  if (type === "warning") element.classList.add("feedback-warning");
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizarBoolean(valor, fallback = false) {
  if (typeof valor === "boolean") return valor;
  if (valor === null || valor === undefined || valor === "") return fallback;

  const texto = String(valor).trim().toLowerCase();
  return ["true", "1", "sim", "s", "yes", "y", "ativo", "principal"].includes(texto);
}

function limparTextoCsv(texto) {
  if (typeof texto !== "string") return "";
  return texto.replace(/^\uFEFF/, "").trim();
}

function setupMenu() {
  const rotas = {
    acoes: "./main.html",
    contatos: "./contatos.html",
    templates: "./template.html",
    relatorios: "./relatorio.html"
  };

  const botoesMenu = document.querySelectorAll(".menu button");
  if (!botoesMenu.length) return;

  botoesMenu.forEach((botao) => {
    botao.addEventListener("click", () => {
      const target = botao.dataset.target;
      const rota = rotas[target];
      if (rota) window.location.href = rota;
    });
  });
}

function abrirModal() {
  if (modalContatoBackdrop) {
    modalContatoBackdrop.classList.remove("hidden");
  }
}

function fecharModal() {
  if (modalContatoBackdrop) {
    modalContatoBackdrop.classList.add("hidden");
  }
}

function limparLinhaContato(row) {
  const contatoId = row.querySelector('[data-field="contatoId"]');
  const nome = row.querySelector('[data-field="nome"]');
  const email = row.querySelector('[data-field="email"]');
  const telefone = row.querySelector('[data-field="telefone"]');
  const cargo = row.querySelector('[data-field="cargo"]');
  const principal = row.querySelector('[data-field="principal"]');
  const ativo = row.querySelector('[data-field="ativo"]');

  if (contatoId) contatoId.value = "";
  if (nome) nome.value = "";
  if (email) email.value = "";
  if (telefone) telefone.value = "";
  if (cargo) cargo.value = "";
  if (principal) principal.value = "false";
  if (ativo) ativo.value = "true";
}

function bindRemoveButton(row, gridBody, rowSelector) {
  const botao = row.querySelector(".btn-remove-row");
  if (!botao) return;
  if (botao.dataset.bound === "true") return;

  botao.addEventListener("click", (event) => {
    event.preventDefault();

    const rows = [...gridBody.querySelectorAll(rowSelector)];

    if (rows.length === 1) {
      limparLinhaContato(row);
      return;
    }

    row.remove();
  });

  botao.dataset.bound = "true";
}

function bindContatoRow(row, gridBody, rowSelector) {
  bindRemoveButton(row, gridBody, rowSelector);
}

function resetarGrid(gridBody, rowSelector) {
  if (!gridBody) return;

  const rows = [...gridBody.querySelectorAll(rowSelector)];

  rows.forEach((row, index) => {
    if (index === 0) {
      limparLinhaContato(row);
    } else {
      row.remove();
    }
  });
}

function cloneContatoRow(gridBody, rowSelector) {
  const baseRow = gridBody?.querySelector(rowSelector);
  if (!baseRow) return null;

  const clone = baseRow.cloneNode(true);
  limparLinhaContato(clone);

  const removeBtn = clone.querySelector(".btn-remove-row");
  if (removeBtn) removeBtn.dataset.bound = "";

  return clone;
}

function getGridContatosPayload(gridBody, rowSelector) {
  if (!gridBody) return [];

  const rows = [...gridBody.querySelectorAll(rowSelector)];

  return rows.map((row) => ({
    id: row.querySelector('[data-field="contatoId"]')?.value || "",
    nome: row.querySelector('[data-field="nome"]')?.value.trim() || "",
    email: row.querySelector('[data-field="email"]')?.value.trim() || "",
    telefone: row.querySelector('[data-field="telefone"]')?.value.trim() || "",
    cargo: row.querySelector('[data-field="cargo"]')?.value.trim() || "",
    principal: row.querySelector('[data-field="principal"]')?.value === "true",
    ativo: row.querySelector('[data-field="ativo"]')?.value === "true"
  }));
}

function preencherGridComLista(gridBody, rowSelector, contatos) {
  resetarGrid(gridBody, rowSelector);

  if (!contatos || contatos.length === 0 || !gridBody) return;

  contatos.forEach((item, index) => {
    let row;

    if (index === 0) {
      row = gridBody.querySelector(rowSelector);
    } else {
      row = cloneContatoRow(gridBody, rowSelector);
      if (!row) return;
      gridBody.appendChild(row);
      bindContatoRow(row, gridBody, rowSelector);
    }

    const contatoId = row.querySelector('[data-field="contatoId"]');
    const nome = row.querySelector('[data-field="nome"]');
    const email = row.querySelector('[data-field="email"]');
    const telefone = row.querySelector('[data-field="telefone"]');
    const cargo = row.querySelector('[data-field="cargo"]');
    const principal = row.querySelector('[data-field="principal"]');
    const ativo = row.querySelector('[data-field="ativo"]');

    if (contatoId) contatoId.value = item.id || "";
    if (nome) nome.value = item.nome || "";
    if (email) email.value = item.email || "";
    if (telefone) telefone.value = item.telefone || "";
    if (cargo) cargo.value = item.cargo || "";
    if (principal) principal.value = item.principal ? "true" : "false";
    if (ativo) ativo.value = item.ativo === false ? "false" : "true";
  });
}

function limparFormularioEmpresa() {
  if (empresaId) empresaId.value = "";
  if (empresaNome) empresaNome.value = "";
  if (empresaOi) empresaOi.value = "";
  if (empresaAtiva) empresaAtiva.checked = true;

  if (btnSalvarEmpresa) {
    btnSalvarEmpresa.textContent = "Salvar empresa e contatos";
    btnSalvarEmpresa.disabled = false;
  }

  resetarGrid(contatosGridBody, ".contato-row");
  setFeedback(retornoEmpresa, "Formulário pronto para cadastrar uma nova empresa com vários contatos.", "warning");
}

function preencherFormularioEmpresa(item) {
  if (!item) return;

  if (empresaId) empresaId.value = item.id || "";
  if (empresaNome) empresaNome.value = item.name || "";
  if (empresaOi) empresaOi.value = item.oi || "";
  if (empresaAtiva) empresaAtiva.checked = item.active !== false;

  if (btnSalvarEmpresa) {
    btnSalvarEmpresa.textContent = "Atualizar empresa";
    btnSalvarEmpresa.disabled = false;
  }

  setFeedback(retornoEmpresa, `Editando empresa: ${item.name || "Sem nome"}`, "warning");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validarContatos(contatos, retornoEl) {
  const contatosValidos = contatos.filter((item) => item.nome || item.email || item.telefone || item.cargo);

  if (contatosValidos.length === 0) {
    setFeedback(retornoEl, "Adicione pelo menos um contato.", "error");
    return null;
  }

  for (const [index, item] of contatosValidos.entries()) {
    if (!item.nome || !item.email) {
      setFeedback(retornoEl, `Linha ${index + 1}: preencha nome e e-mail do contato.`, "error");
      return null;
    }
  }

  const principais = contatosValidos.filter((item) => item.principal);
  if (principais.length > 1) {
    setFeedback(retornoEl, "Marque apenas um contato principal por empresa.", "error");
    return null;
  }

  return contatosValidos;
}

async function buscarEmpresaPorOi(oi) {
  const oiLimpo = (oi || "").trim();
  if (!oiLimpo) return null;

  const { data, error } = await supabaseClient
    .from(TABLE_CLIENT)
    .select("id, name, oi")
    .eq("oi", oiLimpo)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function validarOiDuplicado(oi, idAtual = "") {
  const existente = await buscarEmpresaPorOi(oi);

  if (!existente) {
    return false;
  }

  if (idAtual && String(existente.id) === String(idAtual)) {
    return false;
  }

  return true;
}

async function inserirContatosDaEmpresa(clientId, contatos) {
  if (!contatos.length) return { inseridos: 0, ignorados: 0 };

  const { data: contatosExistentes, error: fetchError } = await supabaseClient
    .from(TABLE_CONTACT)
    .select("id, nome, email")
    .eq("client_id", clientId);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const existentes = contatosExistentes || [];

  const payload = [];
  let ignorados = 0;

  for (const item of contatos) {
    const emailNormalizado = (item.email || "").trim().toLowerCase();
    const nomeNormalizado = (item.nome || "").trim().toLowerCase();

    const duplicado = existentes.some((contato) => {
      const contatoEmail = (contato.email || "").trim().toLowerCase();
      const contatoNome = (contato.nome || "").trim().toLowerCase();

      if (emailNormalizado && contatoEmail) {
        return contatoEmail === emailNormalizado;
      }

      return nomeNormalizado && contatoNome === nomeNormalizado;
    });

    if (duplicado) {
      ignorados++;
      continue;
    }

    payload.push({
      client_id: clientId,
      nome: item.nome,
      email: item.email,
      telefone: item.telefone || null,
      cargo: item.cargo || null,
      principal: item.principal,
      ativo: item.ativo
    });
  }

  if (payload.length > 0) {
    const { error } = await supabaseClient
      .from(TABLE_CONTACT)
      .insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    inseridos: payload.length,
    ignorados
  };
}

function limparBuscaEmpresas() {
  if (filtroTipoBusca) filtroTipoBusca.value = "name";
  if (inputBuscaEmpresa) inputBuscaEmpresa.value = "";

  if (resultadoBuscaWrap) {
    resultadoBuscaWrap.classList.add("hidden");
  }

  if (empresasTableBody) {
    empresasTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">Faça uma busca para visualizar os resultados.</td>
      </tr>
    `;
  }

  setFeedback(retornoBuscaEmpresa, "Faça uma busca para visualizar empresas cadastradas.", "warning");
}

async function carregarEmpresas(filtros = {}) {
  if (!empresasTableBody) return;

  empresasTableBody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-row">Carregando empresas...</td>
    </tr>
  `;

  let query = supabaseClient
    .from(TABLE_CLIENT)
    .select(`
      id,
      name,
      oi,
      active,
      ${TABLE_CONTACT} ( id )
    `)
    .order("name", { ascending: true });

  const termo = (filtros.termo || "").trim();
  const tipo = filtros.tipo || "name";

  if (termo) {
    if (tipo === "oi") {
      query = query.ilike("oi", `%${termo}%`);
    } else {
      query = query.ilike("name", `%${termo}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    empresasTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">Erro ao carregar empresas.</td>
      </tr>
    `;

    if (resultadoBuscaWrap) {
      resultadoBuscaWrap.classList.remove("hidden");
    }

    setFeedback(retornoBuscaEmpresa, "Erro ao buscar empresas.", "error");
    return;
  }

  if (!data || data.length === 0) {
    empresasTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">Nenhuma empresa encontrada.</td>
      </tr>
    `;

    if (resultadoBuscaWrap) {
      resultadoBuscaWrap.classList.remove("hidden");
    }

    setFeedback(retornoBuscaEmpresa, "Nenhuma empresa encontrada para o filtro informado.", "warning");
    return;
  }

  empresasTableBody.innerHTML = data.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.oi)}</td>
      <td>${item.active ? "Ativa" : "Inativa"}</td>
      <td>${Array.isArray(item.contact) ? item.contact.length : 0}</td>
      <td>
        <div class="action-buttons">
          <button type="button" class="btn-editar btn-editar-empresa" data-id="${item.id}">Editar</button>
          <button type="button" class="btn-gerenciar btn-gerenciar-empresa" data-id="${item.id}">Gerenciar contatos</button>
          <button type="button" class="btn-excluir btn-excluir-empresa" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  if (resultadoBuscaWrap) {
    resultadoBuscaWrap.classList.remove("hidden");
  }

  setFeedback(
    retornoBuscaEmpresa,
    `${data.length} empresa(s) encontrada(s).`,
    "success"
  );

  bindEmpresaButtons();
}

async function buscarEmpresasComFiltro() {
  const tipo = filtroTipoBusca?.value || "name";
  const termo = inputBuscaEmpresa?.value.trim() || "";

  if (!termo) {
    setFeedback(retornoBuscaEmpresa, "Digite um valor para realizar a busca.", "error");

    if (resultadoBuscaWrap) {
      resultadoBuscaWrap.classList.add("hidden");
    }

    return;
  }

  setFeedback(retornoBuscaEmpresa, "Buscando empresas...", "warning");
  await carregarEmpresas({ tipo, termo });
}

function getBuscaAtual() {
  return {
    tipo: filtroTipoBusca?.value || "name",
    termo: inputBuscaEmpresa?.value.trim() || ""
  };
}

async function atualizarListaConformeBuscaAtual() {
  const buscaAtual = getBuscaAtual();

  if (buscaAtual.termo) {
    await carregarEmpresas(buscaAtual);
  } else {
    limparBuscaEmpresas();
  }
}

async function salvarEmpresa(event) {
  event.preventDefault();

  const id = empresaId?.value || "";
  const payload = {
    name: empresaNome?.value.trim() || "",
    oi: empresaOi?.value.trim() || "",
    active: empresaAtiva ? empresaAtiva.checked : true
  };

  if (!payload.name || !payload.oi) {
    setFeedback(retornoEmpresa, "Preencha nome da empresa e OI.", "error");
    return;
  }

  const contatos = getGridContatosPayload(contatosGridBody, ".contato-row");
  const contatosValidos = validarContatos(contatos, retornoEmpresa);
  if (!contatosValidos) return;

  try {
    const oiDuplicado = await validarOiDuplicado(payload.oi, id);

    if (oiDuplicado) {
      setFeedback(retornoEmpresa, `Já existe uma empresa cadastrada com o OI ${payload.oi}.`, "error");
      return;
    }

    if (btnSalvarEmpresa) {
      btnSalvarEmpresa.disabled = true;
      btnSalvarEmpresa.textContent = id ? "Atualizando..." : "Salvando...";
    }

    let clientId = id;

    if (id) {
      const { error: updateError } = await supabaseClient
        .from(TABLE_CLIENT)
        .update(payload)
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);

      const { error: deleteContactsError } = await supabaseClient
        .from(TABLE_CONTACT)
        .delete()
        .eq("client_id", id);

      if (deleteContactsError) throw new Error(deleteContactsError.message);
    } else {
      const { data: insertedClient, error: insertError } = await supabaseClient
        .from(TABLE_CLIENT)
        .insert([payload])
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);
      clientId = insertedClient.id;
    }

    await inserirContatosDaEmpresa(clientId, contatosValidos);

    setFeedback(
      retornoEmpresa,
      id ? "Empresa e contatos atualizados com sucesso." : "Empresa e contatos cadastrados com sucesso.",
      "success"
    );

    limparFormularioEmpresa();
    await atualizarListaConformeBuscaAtual();
  } catch (error) {
    setFeedback(retornoEmpresa, `Erro ao salvar empresa: ${error.message}`, "error");
  } finally {
    if (btnSalvarEmpresa) {
      btnSalvarEmpresa.disabled = false;
      btnSalvarEmpresa.textContent = empresaId?.value ? "Atualizar empresa" : "Salvar empresa e contatos";
    }
  }
}

function bindEmpresaButtons() {
  document.querySelectorAll(".btn-editar-empresa").forEach((botao) => {
    botao.onclick = async () => {
      const id = botao.dataset.id;

      const { data, error } = await supabaseClient
        .from(TABLE_CLIENT)
        .select("id, name, oi, active")
        .eq("id", id)
        .single();

      if (error) {
        setFeedback(retornoEmpresa, "Erro ao carregar empresa para edição.", "error");
        return;
      }

      preencherFormularioEmpresa(data);

      const { data: contatos, error: contatosError } = await supabaseClient
        .from(TABLE_CONTACT)
        .select("id, nome, email, telefone, cargo, principal, ativo")
        .eq("client_id", id)
        .order("principal", { ascending: false })
        .order("nome", { ascending: true });

      if (!contatosError) {
        preencherGridComLista(contatosGridBody, ".contato-row", contatos || []);
      }
    };
  });

  document.querySelectorAll(".btn-gerenciar-empresa").forEach((botao) => {
    botao.onclick = async () => {
      const id = botao.dataset.id;
      await selecionarEmpresa(id);
    };
  });

  document.querySelectorAll(".btn-excluir-empresa").forEach((botao) => {
    botao.onclick = async () => {
      const id = botao.dataset.id;
      const confirmar = confirm("Deseja realmente excluir esta empresa? Os contatos vinculados também serão removidos.");
      if (!confirmar) return;

      try {
        const { error: deleteContactsError } = await supabaseClient
          .from(TABLE_CONTACT)
          .delete()
          .eq("client_id", id);

        if (deleteContactsError) throw new Error(deleteContactsError.message);

        const { error } = await supabaseClient
          .from(TABLE_CLIENT)
          .delete()
          .eq("id", id);

        if (error) throw new Error(error.message);

        if (empresaSelecionada && String(empresaSelecionada.id) === String(id)) {
          empresaSelecionada = null;
          if (modalEmpresaTitulo) modalEmpresaTitulo.textContent = "Empresa não selecionada";
          resetarGrid(modalContatosGridBody, ".modal-contato-row");
          fecharModal();
        }

        if (empresaId && String(empresaId.value) === String(id)) {
          limparFormularioEmpresa();
        }

        setFeedback(retornoEmpresa, "Empresa excluída com sucesso.", "success");
        await atualizarListaConformeBuscaAtual();
      } catch (error) {
        setFeedback(retornoEmpresa, `Erro ao excluir empresa: ${error.message}`, "error");
      }
    };
  });
}

async function selecionarEmpresa(clientId) {
  const { data, error } = await supabaseClient
    .from(TABLE_CLIENT)
    .select("id, name, oi, active")
    .eq("id", clientId)
    .single();

  if (error) {
    setFeedback(retornoEmpresa, "Erro ao selecionar empresa.", "error");
    return;
  }

  empresaSelecionada = data;

  if (modalEmpresaTitulo) {
    modalEmpresaTitulo.textContent = `${data.name} • OI ${data.oi}`;
  }

  resetarGrid(modalContatosGridBody, ".modal-contato-row");
  await carregarContatosModal();
  abrirModal();
}

async function carregarContatosModal() {
  if (!empresaSelecionada?.id) {
    setFeedback(retornoModalContato, "Nenhuma empresa selecionada.", "error");
    return;
  }

  const { data, error } = await supabaseClient
    .from(TABLE_CONTACT)
    .select("id, client_id, nome, email, telefone, principal, cargo, ativo")
    .eq("client_id", empresaSelecionada.id)
    .order("principal", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    setFeedback(retornoModalContato, `Erro ao carregar contatos: ${error.message}`, "error");
    return;
  }

  preencherGridComLista(
    modalContatosGridBody,
    ".modal-contato-row",
    data || []
  );

  setFeedback(retornoModalContato, "Contatos carregados com sucesso.", "success");
}

async function salvarContatosModal() {
  if (!empresaSelecionada?.id) {
    setFeedback(retornoModalContato, "Selecione uma empresa antes de salvar contatos.", "error");
    return;
  }

  const rows = getGridContatosPayload(modalContatosGridBody, ".modal-contato-row");
  const validRows = validarContatos(rows, retornoModalContato);
  if (!validRows) return;

  try {
    if (btnModalSalvarContatos) {
      btnModalSalvarContatos.disabled = true;
      btnModalSalvarContatos.textContent = "Salvando...";
    }

    const { error: deleteError } = await supabaseClient
      .from(TABLE_CONTACT)
      .delete()
      .eq("client_id", empresaSelecionada.id);

    if (deleteError) throw new Error(deleteError.message);

    await inserirContatosDaEmpresa(empresaSelecionada.id, validRows);

    setFeedback(retornoModalContato, "Contatos salvos com sucesso.", "success");
    await carregarContatosModal();
    await atualizarListaConformeBuscaAtual();
  } catch (error) {
    setFeedback(retornoModalContato, `Erro ao salvar contatos: ${error.message}`, "error");
  } finally {
    if (btnModalSalvarContatos) {
      btnModalSalvarContatos.disabled = false;
      btnModalSalvarContatos.textContent = "Salvar contatos";
    }
  }
}

function detectarSeparadorCsv(headerLine) {
  const virgulas = (headerLine.match(/,/g) || []).length;
  const pontoVirgulas = (headerLine.match(/;/g) || []).length;
  return pontoVirgulas > virgulas ? ";" : ",";
}

function parseCsvLine(line, separator = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const textoTratado = limparTextoCsv(text || "");

  const lines = textoTratado
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const separator = detectarSeparadorCsv(lines[0]);
  const headers = parseCsvLine(lines[0], separator).map((item) =>
    limparTextoCsv(item).toLowerCase()
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = limparTextoCsv(values[index] ?? "");
    });

    return row;
  });
}

function obterValorCsv(row, chaves = []) {
  for (const chave of chaves) {
    const valor = row[chave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }
  return "";
}

async function importarCsv() {
  const file = csvInput?.files?.[0];

  if (!file) {
    setFeedback(retornoCsv, "Selecione um arquivo CSV para importar.", "error");
    return;
  }

  try {
    setFeedback(retornoCsv, "Lendo arquivo CSV...", "warning");
    const text = await file.text();
    const rows = parseCsv(text);

    if (!rows.length) {
      setFeedback(retornoCsv, "O CSV está vazio ou inválido.", "error");
      return;
    }

    const empresasMap = new Map();
    const oisDuplicadosNoCsv = new Set();

    rows.forEach((row) => {
      const empresaNomeCsv = obterValorCsv(row, ["empresa_nome"]);
      const oiCsv = obterValorCsv(row, ["oi"]);

      if (!empresaNomeCsv || !oiCsv) return;

      const key = oiCsv;

      if (!empresasMap.has(key)) {
        empresasMap.set(key, {
          empresa: {
            name: empresaNomeCsv,
            oi: oiCsv,
            active: normalizarBoolean(obterValorCsv(row, ["empresa_ativa"]), true)
          },
          contatos: []
        });
      } else {
        const empresaJaMapeada = empresasMap.get(key);
        if (empresaJaMapeada.empresa.name !== empresaNomeCsv) {
          oisDuplicadosNoCsv.add(oiCsv);
        }
      }

      const contatoNome = obterValorCsv(row, ["contato_nome", "nome_contato"]);
      const contatoEmail = obterValorCsv(row, ["contato_email", "email_contato"]);
      const contatoTelefone = obterValorCsv(row, ["contato_telefone", "telefone_contato"]);
      const contatoCargo = obterValorCsv(row, ["contato_cargo", "cargo_contato"]);

      if (contatoNome || contatoEmail || contatoTelefone || contatoCargo) {
        empresasMap.get(key).contatos.push({
          nome: contatoNome,
          email: contatoEmail,
          telefone: contatoTelefone,
          cargo: contatoCargo,
          principal: normalizarBoolean(obterValorCsv(row, ["contato_principal", "principal_contato"]), false),
          ativo: normalizarBoolean(obterValorCsv(row, ["contato_ativo", "ativo_contato"]), true)
        });
      }
    });

    let empresasNovas = 0;
    let empresasExistentes = 0;
    let contatosInseridos = 0;
    let contatosIgnorados = 0;
    let ignoradas = 0;
    const detalhes = [];

    for (const [oi, grupo] of empresasMap) {
      if (!grupo.contatos.length) {
        ignoradas++;
        detalhes.push(`${oi} (sem contatos)`);
        continue;
      }

      if (oisDuplicadosNoCsv.has(oi)) {
        ignoradas++;
        detalhes.push(`${oi} (duplicado no CSV com nomes diferentes)`);
        continue;
      }

      const principais = grupo.contatos.filter((item) => item.principal);
      if (principais.length > 1) {
        ignoradas++;
        detalhes.push(`${oi} (mais de um contato principal no CSV)`);
        continue;
      }

      let clientId;
      const empresaExistente = await buscarEmpresaPorOi(grupo.empresa.oi);

      if (empresaExistente?.id) {
        clientId = empresaExistente.id;
        empresasExistentes++;
      } else {
        const { data: insertedClient, error: insertError } = await supabaseClient
          .from(TABLE_CLIENT)
          .insert([grupo.empresa])
          .select("id")
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        clientId = insertedClient.id;
        empresasNovas++;
      }

      const resultadoContatos = await inserirContatosDaEmpresa(clientId, grupo.contatos);
      contatosInseridos += resultadoContatos.inseridos;
      contatosIgnorados += resultadoContatos.ignorados;

      if (resultadoContatos.inseridos === 0) {
        detalhes.push(`${oi} (empresa processada, mas todos os contatos já existiam)`);
      }
    }

    await atualizarListaConformeBuscaAtual();
    csvInput.value = "";

    setFeedback(
      retornoCsv,
      `Importação concluída. ${empresasNovas} empresa(s) nova(s), ${empresasExistentes} empresa(s) já existente(s), ${contatosInseridos} contato(s) inserido(s), ${contatosIgnorados} contato(s) ignorado(s) por duplicidade e ${ignoradas} registro(s) ignorado(s).${detalhes.length ? ` Detalhes: ${detalhes.join(", ")}.` : ""}`,
      "success"
    );
  } catch (error) {
    setFeedback(retornoCsv, `Erro ao importar CSV: ${error.message}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupMenu();

  if (empresaForm) {
    empresaForm.addEventListener("submit", salvarEmpresa);
  }

  if (btnSalvarEmpresa) {
    btnSalvarEmpresa.addEventListener("click", (event) => {
      event.preventDefault();
      if (empresaForm) {
        empresaForm.requestSubmit();
      } else {
        salvarEmpresa(event);
      }
    });
  }

  if (btnLimparEmpresa) {
    btnLimparEmpresa.addEventListener("click", (event) => {
      event.preventDefault();
      limparFormularioEmpresa();
    });
  }

  const firstMainRow = contatosGridBody?.querySelector(".contato-row");
  if (firstMainRow) {
    bindContatoRow(firstMainRow, contatosGridBody, ".contato-row");
  }

  const firstModalRow = modalContatosGridBody?.querySelector(".modal-contato-row");
  if (firstModalRow) {
    bindContatoRow(firstModalRow, modalContatosGridBody, ".modal-contato-row");
  }

  if (btnAdicionarContato) {
    btnAdicionarContato.addEventListener("click", (event) => {
      event.preventDefault();

      const row = cloneContatoRow(contatosGridBody, ".contato-row");
      if (!row) return;

      contatosGridBody.appendChild(row);
      bindContatoRow(row, contatosGridBody, ".contato-row");
    });
  }

  if (btnLimparContatosGrid) {
    btnLimparContatosGrid.addEventListener("click", (event) => {
      event.preventDefault();
      resetarGrid(contatosGridBody, ".contato-row");
      setFeedback(retornoEmpresa, "Linhas de contato limpas.", "warning");
    });
  }

  if (btnModalAdicionarContato) {
    btnModalAdicionarContato.addEventListener("click", (event) => {
      event.preventDefault();

      if (!empresaSelecionada?.id) {
        setFeedback(retornoModalContato, "Selecione uma empresa antes de adicionar contatos.", "error");
        return;
      }

      const row = cloneContatoRow(modalContatosGridBody, ".modal-contato-row");
      if (!row) return;

      modalContatosGridBody.appendChild(row);
      bindContatoRow(row, modalContatosGridBody, ".modal-contato-row");
    });
  }

  if (btnModalSalvarContatos) {
    btnModalSalvarContatos.addEventListener("click", (event) => {
      event.preventDefault();
      salvarContatosModal();
    });
  }

  if (btnModalLimparContatos) {
    btnModalLimparContatos.addEventListener("click", (event) => {
      event.preventDefault();
      resetarGrid(modalContatosGridBody, ".modal-contato-row");
      setFeedback(retornoModalContato, "Linhas do modal limpas.", "warning");
    });
  }

  if (btnFecharModal) {
    btnFecharModal.addEventListener("click", fecharModal);
  }

  if (modalContatoBackdrop) {
    modalContatoBackdrop.addEventListener("click", (event) => {
      if (event.target === modalContatoBackdrop) {
        fecharModal();
      }
    });
  }

  if (btnImportarCsv) {
    btnImportarCsv.addEventListener("click", (event) => {
      event.preventDefault();
      importarCsv();
    });
  }

  if (btnBuscarEmpresa) {
    btnBuscarEmpresa.addEventListener("click", async (event) => {
      event.preventDefault();
      await buscarEmpresasComFiltro();
    });
  }

  if (btnLimparBuscaEmpresa) {
    btnLimparBuscaEmpresa.addEventListener("click", (event) => {
      event.preventDefault();
      limparBuscaEmpresas();
    });
  }

  if (inputBuscaEmpresa) {
    inputBuscaEmpresa.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await buscarEmpresasComFiltro();
      }
    });
  }

  limparFormularioEmpresa();
  limparBuscaEmpresas();
});