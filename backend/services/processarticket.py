from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import Client, create_client

load_dotenv()

ZENDESK_SUBDOMAIN = "db1globalsoftwaresupport"
ZENDESK_BASE_URL = f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2"

ZENDESK_AUTHORIZATION = os.getenv("ZENDESK_AUTHORIZATION")

ZENDESK_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": ZENDESK_AUTHORIZATION,
}

SUPABASE_URL = "https://elhwbybeovmkbzgoahwb.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")


GROUP_ID_ATIVO = 48846951707539

ASSIGNEE_MAP = {
    "welison": 48642609483155,
    "eliézer": 48642518395923,
    "eliezer": 48642518395923,
}

CUSTOM_FIELDS_MAP = {
    "SKU não vinculado": [
        {"id": 48845391931923, "value": "motivo_de_contato_pedidos"},
        {"id": 48845411121427, "value": "X"},
        {"id": 48845378518419, "value": "X"},
        {"id": 48845412947731, "value": "X"},
        {"id": 49289010167059, "value": "motivo_pedidos"},
        {"id": 49289235923347, "value": "pedidos_nao_importado_p_anymarket"},
        {"id": 49290242736019, "value": "nao_importado_anymarket_sku_não_vinculado"},
    ],
    "falta de atributo obrigatório": [
        {"id": 48845391931923, "value": "motivo_de_contato_anuncios"},
        {"id": 48845378518419, "value": "X"},
        {"id": 49289010167059, "value": "motivo_transmissoes"},
        {"id": 49491298231443, "value": "transmissoes_erro_ao_criar_transmissao"},
        {"id": 49491763175059, "value": "erro_criar_transmissao_falta_de_atributo_obrigatório"},
    ],
    "MultiWarehouse": [
        {"id": 48845391931923, "value": "motivo_de_contato_pedidos"},
        {"id": 48845411121427, "value": "X"},
        {"id": 48845378518419, "value": "X"},
        {"id": 48845412947731, "value": "X"},
        {"id": 49289010167059, "value": "duvidas"},
        {"id": 49495118032147, "value": "duvidas_estoque"},
        {"id": 49492932151315, "value": "cadastrar/configurar_multicd"},
    ],
    "Webnar": [
        {"id": 48845391931923, "value": "motivo_de_contato_pedidos"},
        {"id": 48845411121427, "value": "X"},
        {"id": 48845378518419, "value": "X"},
        {"id": 48845412947731, "value": "X"},
        {"id": 49289010167059, "value": "duvidas"},
        {"id": 49495118032147, "value": "duvidas_estoque"},
        {"id": 49492932151315, "value": "cadastrar/configurar_multicd"},
    ],
    "Testetemplate": [
        {"id": 48845391931923, "value": "motivo_de_contato_pedidos"},
        {"id": 48845411121427, "value": "X"},
        {"id": 48845378518419, "value": "X"},
        {"id": 48845412947731, "value": "X"},
        {"id": 49289010167059, "value": "duvidas"},
        {"id": 49495118032147, "value": "duvidas_estoque"},
        {"id": 49492932151315, "value": "cadastrar/configurar_multicd"},
    ],
}

app = Flask(__name__)
CORS(app)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def valor_texto(valor) -> str:
    if valor is None:
        return ""
    return str(valor).strip()


def normalizar_texto(valor) -> str:
    return valor_texto(valor).strip().lower()


def normalizar_telefone(telefone: str) -> str:
    telefone = valor_texto(telefone)

    if telefone.endswith(".0"):
        telefone = telefone[:-2]

    return "".join(filter(str.isdigit, telefone))


def tratar_texto_template(texto: str, nome: str = "", empresa: str = "", telefone: str = "", analista: str = "") -> str:
    texto = valor_texto(texto)
    nome = valor_texto(nome)
    empresa = valor_texto(empresa)
    telefone = normalizar_telefone(telefone)
    analista = valor_texto(analista)

    texto = texto.replace("[NOME]", nome)
    texto = texto.replace("[Nome]", nome)
    texto = texto.replace("[EMPRESA]", empresa)
    texto = texto.replace("[Empresa]", empresa)
    texto = texto.replace("[Telefone]", telefone)
    texto = texto.replace("[TELEFONE]", telefone)
    texto = texto.replace("[Analista]", analista)
    texto = texto.replace("[analista]", analista)



    return texto


def obter_group_id(nome_grupo: str):
    nome_grupo = normalizar_texto(nome_grupo)

    if nome_grupo == "ativo":
        return GROUP_ID_ATIVO

    return None


def obter_assignee_id(nome_analista: str):
    nome_analista = normalizar_texto(nome_analista)
    return ASSIGNEE_MAP.get(nome_analista)


def obter_custom_fields(motivo: str):
    motivo_normalizado = normalizar_texto(motivo)
    return CUSTOM_FIELDS_MAP.get(motivo_normalizado, [])


def buscar_usuario_por_email(email: str):
    url = f"{ZENDESK_BASE_URL}/users/search.json"
    params = {"query": f"email:{email}"}

    response = requests.get(
        url,
        headers=ZENDESK_HEADERS,
        params=params,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    users = data.get("users", [])
    return users[0] if users else None


def criar_usuario(nome: str, email: str):
    url = f"{ZENDESK_BASE_URL}/users.json"

    payload = {
        "user": {
            "name": nome if nome else email,
            "email": email,
        }
    }

    response = requests.post(
        url,
        headers=ZENDESK_HEADERS,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    return response.json().get("user", {})


def garantir_usuario(nome: str, email: str):
    usuario = buscar_usuario_por_email(email)

    if usuario:
        return usuario, "USUARIO_EXISTENTE"

    usuario = criar_usuario(nome, email)
    return usuario, "USUARIO_CRIADO"


def buscar_contatos_por_client_id(client_id: str):
    if not client_id:
        return []

    response = (
        supabase.table("contact")
        .select("*")
        .eq("client_id", client_id)
        .execute()
    )

    return response.data or []


def contato_eh_principal(contato: dict) -> bool:
    return bool(
        contato.get("is_main")
        or contato.get("principal")
        or contato.get("is_principal")
        or contato.get("main_contact")
    )


def resolver_email_principal_e_ccs(client_id: str, email_front: str):
    contatos = buscar_contatos_por_client_id(client_id)
    email_front = valor_texto(email_front).lower()

    contato_principal = None
    emails_cc = []

    for contato in contatos:
        email_contato = valor_texto(contato.get("email")).lower()
        if not email_contato:
            continue

        if contato_eh_principal(contato):
            contato_principal = contato

    email_principal = email_front

    if contato_principal:
        email_principal = valor_texto(contato_principal.get("email")).lower()

    for contato in contatos:
        email_contato = valor_texto(contato.get("email")).lower()
        if not email_contato:
            continue

        if email_contato == email_principal:
            continue

        if email_contato not in emails_cc:
            emails_cc.append(email_contato)

    if not contato_principal and email_front:
        email_principal = email_front

    return email_principal, emails_cc, contatos


def montar_email_ccs(emails_cc: list[str]):
    payload = []

    for email in emails_cc:
        email = valor_texto(email).lower()
        if not email:
            continue

        payload.append({
            "user_email": email,
            "action": "put"
        })

    return payload


def criar_ticket(
    requester_id,
    email: str,
    nome: str,
    subject: str,
    description: str,
    group_id,
    assignee_id,
    custom_fields,
    email_ccs=None
):
    url = f"{ZENDESK_BASE_URL}/tickets.json"

    ticket_data = {
        "subject": subject,
        "comment": {
            "body": description,
            "public": True,
        },
        "priority": "normal",
        "status": "new",
    }

    if requester_id:
        ticket_data["requester_id"] = requester_id
    else:
        ticket_data["requester"] = {
            "name": nome if nome else email,
            "email": email,
        }

    if group_id:
        ticket_data["group_id"] = group_id

    if assignee_id:
        ticket_data["assignee_id"] = assignee_id

    if custom_fields:
        ticket_data["custom_fields"] = custom_fields

    if email_ccs:
        ticket_data["email_ccs"] = email_ccs

    payload = {"ticket": ticket_data}

    response = requests.post(
        url,
        headers=ZENDESK_HEADERS,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    return response.json()


def buscar_tentativas_atuais(message_id: str) -> int:
    response = (
        supabase.table("message_sending")
        .select("tentativas")
        .eq("id", message_id)
        .single()
        .execute()
    )

    data = response.data or {}
    tentativas = data.get("tentativas")

    if tentativas is None:
        return 0

    try:
        return int(tentativas)
    except Exception:
        return 0


def atualizar_message_sending(
    message_id: str,
    status: str,
    erro: str | None = None,
    incrementar_tentativa: bool = True,
    data_envio: str | None = None,
):
    tentativas_atuais = buscar_tentativas_atuais(message_id) if incrementar_tentativa else 0

    payload = {
        "status": status,
        "erro": erro,
        "tentativas": tentativas_atuais + 1 if incrementar_tentativa else tentativas_atuais,
    }

    if data_envio is not None:
        payload["data_envio"] = data_envio

    (
        supabase.table("message_sending")
        .update(payload)
        .eq("id", message_id)
        .execute()
    )


@app.post("/api/criar-ticket")
def api_criar_ticket():
    try:
        body = request.get_json(force=True)

        message_id = valor_texto(body.get("message_sending_id"))
        client_id = valor_texto(body.get("client_id"))
        empresa = valor_texto(body.get("empresa"))
        nome = valor_texto(body.get("nome"))
        telefone = valor_texto(body.get("telefone"))
        email_front = valor_texto(body.get("email"))
        titulo_ticket = valor_texto(body.get("titulo_ticket"))
        descricao_ticket = valor_texto(body.get("descricao_ticket"))
        motivo = valor_texto(body.get("motivo"))
        time_nome = valor_texto(body.get("time"))
        analista = valor_texto(body.get("analista"))

        if not message_id:
            return jsonify({"ok": False, "erro": "message_sending_id é obrigatório."}), 400

        if not client_id:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro="client_id é obrigatório para resolver os e-mails do cliente.",
            )
            return jsonify({"ok": False, "erro": "client_id é obrigatório para resolver os e-mails do cliente."}), 400

        if not titulo_ticket:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro="Título do ticket é obrigatório.",
            )
            return jsonify({"ok": False, "erro": "Título do ticket é obrigatório."}), 400

        if not descricao_ticket:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro="Descrição do ticket é obrigatória.",
            )
            return jsonify({"ok": False, "erro": "Descrição do ticket é obrigatória."}), 400

        email_principal, emails_cc, _ = resolver_email_principal_e_ccs(client_id, email_front)

        if not email_principal:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro="Não foi possível identificar o e-mail principal do cliente.",
            )
            return jsonify({"ok": False, "erro": "Não foi possível identificar o e-mail principal do cliente."}), 400

        titulo_final = tratar_texto_template(
            texto=titulo_ticket,
            nome=nome,
            empresa=empresa,
            telefone=telefone,
            analista=analista,
        )

        descricao_final = tratar_texto_template(
            texto=descricao_ticket,
            nome=nome,
            empresa=empresa,
            telefone=telefone,
            analista=analista,
        )

        group_id = obter_group_id(time_nome) if time_nome else None
        assignee_id = obter_assignee_id(analista) if analista else None
        custom_fields = obter_custom_fields(motivo)
        email_ccs_payload = montar_email_ccs(emails_cc)

        usuario, status_usuario = garantir_usuario(nome, email_principal)
        requester_id = usuario.get("id")

        retorno_ticket = criar_ticket(
            requester_id=requester_id,
            email=email_principal,
            nome=nome,
            subject=titulo_final,
            description=descricao_final,
            group_id=group_id,
            assignee_id=assignee_id,
            custom_fields=custom_fields,
            email_ccs=email_ccs_payload,
        )

        ticket = retorno_ticket.get("ticket", {})
        ticket_id = ticket.get("id", "")

        atualizar_message_sending(
            message_id=message_id,
            status="ticket_criado",
            erro=None,
            data_envio=datetime.now(timezone.utc).isoformat(),
        )

        return jsonify({
            "ok": True,
            "message_sending_id": message_id,
            "ticket_id": ticket_id,
            "status_usuario": status_usuario,
            "email_principal": email_principal,
            "emails_cc": emails_cc,
            "titulo_final": titulo_final,
            "descricao_final": descricao_final,
            "retorno": retorno_ticket,
        })

    except requests.HTTPError as e:
        detalhe = ""
        try:
            detalhe = e.response.text
        except Exception:
            detalhe = str(e)

        message_id = valor_texto(request.json.get("message_sending_id")) if request.is_json else ""
        if message_id:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro=detalhe or str(e),
            )

        return jsonify({
            "ok": False,
            "erro": "Erro ao comunicar com o Zendesk.",
            "detalhe": detalhe or str(e),
        }), 500

    except Exception as e:
        message_id = valor_texto(request.json.get("message_sending_id")) if request.is_json else ""
        if message_id:
            atualizar_message_sending(
                message_id=message_id,
                status="ticket_erro",
                erro=str(e),
            )

        return jsonify({
            "ok": False,
            "erro": str(e),
        }), 500


@app.get("/api/health-ticket")
def health_ticket():
    return jsonify({"ok": True, "message": "Backend de ticket rodando normalmente."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)