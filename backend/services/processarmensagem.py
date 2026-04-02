import os
import unicodedata
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import Client, create_client

load_dotenv()

API_KEY = os.getenv("API_KEY")

URL_BUSCAR_CHAT = "https://api.smclick.com.br/attendances/chats"
URL_CRIAR_CHAT = "https://api.smclick.com.br/attendances/chats"
URL_ENVIAR_MENSAGEM = "https://api.smclick.com.br/instances/messages"
URL_BUSCAR_MENSAGENS = "https://api.smclick.com.br/attendances/chats/message"


INSTANCE_ID_PADRAO = os.getenv("INSTANCE_ID")
INSTANCE_ID_WELISON = os.getenv("INSTANCE_ID_WELISON") or INSTANCE_ID_PADRAO
INSTANCE_ID_ELIEZER = os.getenv("INSTANCE_ID_ELIEZER")
DEPARTMENT_ID = os.getenv("DEPARTMENT_ID")

SUPABASE_URL = "https://elhwbybeovmkbzgoahwb.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

HEADERS = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
}

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = Flask(__name__)
CORS(app)


def valor_texto(valor) -> str:
    if valor is None:
        return ""
    return str(valor).strip()


def normalizar_telefone(telefone: str) -> str:
    telefone = valor_texto(telefone)

    if telefone.endswith(".0"):
        telefone = telefone[:-2]

    return "".join(filter(str.isdigit, telefone))


def formatar_telefone_api(telefone: str) -> str:
    telefone = normalizar_telefone(telefone)

    if telefone.startswith("55"):
        telefone = telefone[2:]

    return f"+55{telefone}"


def tratar_mensagem(mensagem: str, nome: str = "", empresa: str = "", telefone: str = "", analista: str = "") -> str:
    mensagem = valor_texto(mensagem)
    nome = valor_texto(nome)
    empresa = valor_texto(empresa)
    telefone = normalizar_telefone(telefone)
    analista = valor_texto(analista)

    mensagem = mensagem.replace("[NOME]", nome)
    mensagem = mensagem.replace("[Nome]", nome)
    mensagem = mensagem.replace("[EMPRESA]", empresa)
    mensagem = mensagem.replace("[Empresa]", empresa)
    mensagem = mensagem.replace("[Telefone]", telefone)
    mensagem = mensagem.replace("[TELEFONE]", telefone)
    mensagem = mensagem.replace("[Analista]", analista)
    mensagem = mensagem.replace("[analista]", analista)


    return mensagem


def normalizar_nome_analista(analista: str) -> str:
    texto = valor_texto(analista).lower()
    if not texto:
        return ""

    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    return " ".join(texto.split())


def obter_instance_id_por_analista(analista: str) -> str:
    analista_normalizado = normalizar_nome_analista(analista)

    if "welison" in analista_normalizado:
        if not INSTANCE_ID_WELISON:
            raise ValueError(f"INSTANCE_ID não configurado para o analista: {analista}")
        return INSTANCE_ID_WELISON

    if "eliezer" in analista_normalizado:
        if not INSTANCE_ID_ELIEZER:
            raise ValueError(f"INSTANCE_ID não configurado para o analista: {analista}")
        return INSTANCE_ID_ELIEZER

    if INSTANCE_ID_PADRAO:
        return INSTANCE_ID_PADRAO

    if INSTANCE_ID_WELISON:
        return INSTANCE_ID_WELISON

    raise ValueError(
        "Nenhuma instância válida foi encontrada. Configure INSTANCE_ID ou "
        "INSTANCE_ID_WELISON/INSTANCE_ID_ELIEZER no arquivo .env."
    )


def extrair_instance_do_chat(chat: dict) -> str | None:
    if not isinstance(chat, dict):
        return None

    candidatos_diretos = [
        chat.get("instance"),
        chat.get("instance_id"),
        chat.get("instanceId"),
    ]

    for valor in candidatos_diretos:
        if valor:
            return str(valor).strip()

    for chave in ["data", "result", "item", "chat", "attendance", "instance_data"]:
        nested = chat.get(chave)
        if isinstance(nested, dict):
            for subchave in ["instance", "instance_id", "instanceId", "id"]:
                valor = nested.get(subchave)
                if valor:
                    return str(valor).strip()

    return None


def selecionar_chat_por_instance(chats: list[dict], instance_id: str | None = None):
    if not chats:
        return None

    if not instance_id:
        return chats[0]

    for chat in chats:
        instance_chat = extrair_instance_do_chat(chat)
        if instance_chat and str(instance_chat).strip() == str(instance_id).strip():
            return chat

    return chats[0]


def extrair_lista_do_retorno(data):
    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        for key in ["results", "data", "items"]:
            valor = data.get(key)
            if isinstance(valor, list):
                return valor

    return []


def buscar_chat_por_telefone(telefone: str, instance_id: str | None = None):
    telefone_api = formatar_telefone_api(telefone)

    response = requests.get(
        URL_BUSCAR_CHAT,
        headers=HEADERS,
        params={"contact__telephone": telefone_api},
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    chats = extrair_lista_do_retorno(data)

    if chats:
        return selecionar_chat_por_instance(chats, instance_id)

    if isinstance(data, dict) and "id" in data:
        return data

    return None


def criar_chat(telefone: str, empresa: str, nome: str, instance_id: str):
    telefone_api = formatar_telefone_api(telefone)

    empresa = valor_texto(empresa)
    nome = valor_texto(nome)

    if empresa and nome:
        nome_contato = f"{empresa} - {nome}"
    elif empresa:
        nome_contato = empresa
    elif nome:
        nome_contato = nome
    else:
        nome_contato = telefone_api

    payload = {
        "instance": instance_id,
        "department": DEPARTMENT_ID,
        "type": "contact",
        "contact": {
            "name": nome_contato,
            "telephone": telefone_api,
        },
        "origin": "whatsapp",
    }

    response = requests.post(
        URL_CRIAR_CHAT,
        headers=HEADERS,
        json=payload,
        timeout=30,
    )

    if response.status_code in [200, 201]:
        return True

    if response.status_code == 400:
        try:
            body = response.json()
            msg = str(body.get("message", "")).lower()

            if "já existe um atendimento criado com esse contato" in msg:
                return True
        except Exception:
            pass

    response.raise_for_status()
    return True


def enviar_mensagem_smclick(telefone: str, mensagem: str, instance_id: str):
    telefone_api = formatar_telefone_api(telefone)

    payload = {
        "instance": instance_id,
        "type": "text",
        "content": {
            "telephone": telefone_api,
            "message": mensagem,
        },
    }

    response = requests.post(
        URL_ENVIAR_MENSAGEM,
        headers=HEADERS,
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


def extrair_protocolo(chat=None, retorno=None) -> str | None:
    fontes = [chat, retorno]

    for fonte in fontes:
        if not isinstance(fonte, dict):
            continue

        for chave in ["protocol", "protocolo", "attendance_protocol", "chat_protocol"]:
            valor = fonte.get(chave)
            if valor:
                return str(valor).strip()

        for key in ["data", "result", "item", "chat", "attendance"]:
            nested = fonte.get(key)
            if isinstance(nested, dict):
                for chave in ["protocol", "protocolo", "attendance_protocol", "chat_protocol"]:
                    valor = nested.get(chave)
                    if valor:
                        return str(valor).strip()

    return None


def atualizar_message_sending(
    message_id: str,
    status: str,
    erro: str | None = None,
    incrementar_tentativa: bool = True,
    data_envio: str | None = None,
    protocolo: str | None = None,
    respondeu: bool | None = None,
    status_followup: str | None = None,
    data_resposta: str | None = None,
):
    tentativas_atuais = buscar_tentativas_atuais(message_id) if incrementar_tentativa else 0
    payload = {
        "status": status,
        "erro": erro,
        "tentativas": tentativas_atuais + 1 if incrementar_tentativa else tentativas_atuais,
    }

    if data_envio is not None:
        payload["data_envio"] = data_envio

    if protocolo is not None:
        payload["protocolo"] = protocolo

    if respondeu is not None:
        payload["respondeu"] = respondeu

    if status_followup is not None:
        payload["status_followup"] = status_followup

    if data_resposta is not None:
        payload["data_resposta"] = data_resposta

    (
        supabase.table("message_sending")
        .update(payload)
        .eq("id", message_id)
        .execute()
    )


def buscar_mensagens_por_protocolo(protocolo: str):
    response = requests.get(
        URL_BUSCAR_MENSAGENS,
        headers=HEADERS,
        params={"protocol": protocolo},
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        for key in ["results", "data", "items", "messages"]:
            valor = data.get(key)
            if isinstance(valor, list):
                return valor

        if "message" in data and isinstance(data["message"], list):
            return data["message"]

    return []


def parse_data_iso(valor: str | None):
    texto = valor_texto(valor)
    if not texto:
        return None

    try:
        if texto.endswith("Z"):
            texto = texto.replace("Z", "+00:00")
        return datetime.fromisoformat(texto)
    except Exception:
        pass

    formatos = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
    ]

    for formato in formatos:
        try:
            return datetime.strptime(texto, formato)
        except Exception:
            continue

    return None


def extrair_data_mensagem(mensagem: dict):
    chaves = [
        "created_at",
        "createdAt",
        "date",
        "datetime",
        "timestamp",
        "sent_at",
        "sentAt",
    ]

    for chave in chaves:
        valor = mensagem.get(chave)
        data = parse_data_iso(valor)
        if data:
            return data

    return None


def mensagem_eh_do_cliente(mensagem: dict) -> bool:
    candidatos_true = {"client", "customer", "contact", "received", "inbound", "incoming", "visitor", "user"}
    candidatos_false = {"agent", "attendance", "internal", "sent", "outbound", "outgoing", "system", "bot"}

    pares = [
        mensagem.get("direction"),
        mensagem.get("type"),
        mensagem.get("origin"),
        mensagem.get("sender_type"),
        mensagem.get("senderType"),
        mensagem.get("message_type"),
        mensagem.get("messageType"),
    ]

    for valor in pares:
        texto = valor_texto(valor).lower()
        if texto in candidatos_true:
            return True
        if texto in candidatos_false:
            return False

    from_me = mensagem.get("fromMe")
    if isinstance(from_me, bool):
        return not from_me

    from_me = mensagem.get("from_me")
    if isinstance(from_me, bool):
        return not from_me

    owner = mensagem.get("owner")
    if isinstance(owner, dict):
        owner_type = valor_texto(owner.get("type")).lower()
        if owner_type in candidatos_true:
            return True
        if owner_type in candidatos_false:
            return False

    sender = mensagem.get("sender")
    if isinstance(sender, dict):
        sender_type = valor_texto(sender.get("type")).lower()
        if sender_type in candidatos_true:
            return True
        if sender_type in candidatos_false:
            return False

    return False


def buscar_telefone_por_contact_id(contact_id: str) -> str | None:
    if not contact_id:
        return None

    response = (
        supabase.table("contact")
        .select("telefone")
        .eq("id", contact_id)
        .single()
        .execute()
    )

    data = response.data or {}
    telefone = valor_texto(data.get("telefone"))

    return telefone or None


def buscar_registros_followup(template_id: str | None = None, somente_pendentes: bool = True):
    query = (
        supabase.table("message_sending")
        .select("id, template_id, contact_id, protocolo, data_envio, status, status_followup, prazo_horas")
        .not_.is_("data_envio", "null")
        .eq("status", "mensagem_enviada")
    )

    if template_id:
        query = query.eq("template_id", template_id)

    if somente_pendentes:
        query = query.in_("status_followup", ["AGUARDANDO", "SEM_RETORNO", None])

    response = query.execute()
    return response.data or []


def garantir_protocolo_do_registro(registro: dict) -> str | None:
    protocolo = valor_texto(registro.get("protocolo"))
    if protocolo:
        return protocolo

    contact_id = valor_texto(registro.get("contact_id"))
    telefone = buscar_telefone_por_contact_id(contact_id)

    if not telefone:
        return None

    chat = buscar_chat_por_telefone(telefone)
    if not chat:
        return None

    protocolo_encontrado = extrair_protocolo(chat=chat, retorno=None)

    if protocolo_encontrado:
        atualizar_message_sending(
            message_id=registro.get("id"),
            status=registro.get("status") or "mensagem_enviada",
            erro=None,
            incrementar_tentativa=False,
            protocolo=protocolo_encontrado,
        )

    return protocolo_encontrado


def avaliar_followup_registro(registro: dict):
    registro_id = registro.get("id")
    protocolo = garantir_protocolo_do_registro(registro)
    data_envio = parse_data_iso(registro.get("data_envio"))
    prazo_horas = registro.get("prazo_horas") or 6

    if not registro_id or not data_envio:
        return {
            "id": registro_id,
            "status_followup": "IGNORADO",
            "motivo": "Registro sem data_envio.",
        }

    if not protocolo:
        return {
            "id": registro_id,
            "status_followup": "IGNORADO",
            "motivo": "Não foi possível localizar protocolo pelo banco nem pelo telefone.",
        }

    mensagens = buscar_mensagens_por_protocolo(protocolo)

    resposta_cliente = None

    for mensagem in mensagens:
        data_mensagem = extrair_data_mensagem(mensagem)
        if not data_mensagem:
            continue

        if data_mensagem <= data_envio:
            continue

        if mensagem_eh_do_cliente(mensagem):
            resposta_cliente = data_mensagem
            break

    if resposta_cliente:
        data_resposta_iso = resposta_cliente.isoformat()

        atualizar_message_sending(
            message_id=registro_id,
            status="mensagem_enviada",
            erro=None,
            incrementar_tentativa=False,
            respondeu=True,
            status_followup="RESPONDIDO",
            data_resposta=data_resposta_iso,
        )

        return {
            "id": registro_id,
            "status_followup": "RESPONDIDO",
            "data_resposta": data_resposta_iso,
        }

    agora = datetime.now(timezone.utc)
    if data_envio.tzinfo is None:
        data_envio = data_envio.replace(tzinfo=timezone.utc)

    horas_decorridas = (agora - data_envio).total_seconds() / 3600
    novo_status = "SEM_RETORNO" if horas_decorridas >= int(prazo_horas) else "AGUARDANDO"

    atualizar_message_sending(
        message_id=registro_id,
        status="mensagem_enviada",
        erro=None,
        incrementar_tentativa=False,
        respondeu=False,
        status_followup=novo_status,
    )

    return {
        "id": registro_id,
        "status_followup": novo_status,
        "horas_decorridas": round(horas_decorridas, 2),
    }


@app.post("/api/enviar-mensagem")
def api_enviar_mensagem():
    try:
        body = request.get_json(force=True)

        message_id = valor_texto(body.get("message_sending_id"))
        empresa = valor_texto(body.get("empresa"))
        nome = valor_texto(body.get("nome"))
        telefone = valor_texto(body.get("telefone"))
        mensagem_original = valor_texto(body.get("mensagem"))
        analista = valor_texto(body.get("analista"))

        if not message_id:
            return jsonify({"ok": False, "erro": "message_sending_id é obrigatório."}), 400

        if not telefone:
            atualizar_message_sending(
                message_id=message_id,
                status="mensagem_erro",
                erro="Telefone é obrigatório.",
            )
            return jsonify({"ok": False, "erro": "Telefone é obrigatório."}), 400

        if not mensagem_original:
            atualizar_message_sending(
                message_id=message_id,
                status="mensagem_erro",
                erro="Mensagem é obrigatória.",
            )
            return jsonify({"ok": False, "erro": "Mensagem é obrigatória."}), 400

        instance_id = obter_instance_id_por_analista(analista)

        telefone_normalizado = normalizar_telefone(telefone)
        mensagem_final = tratar_mensagem(
            mensagem=mensagem_original,
            nome=nome,
            empresa=empresa,
            telefone=telefone_normalizado,
            analista=analista,
        )

        chat = buscar_chat_por_telefone(telefone_normalizado, instance_id=instance_id)
        if not chat:
            criar_chat(telefone_normalizado, empresa, nome, instance_id=instance_id)
            chat = buscar_chat_por_telefone(telefone_normalizado, instance_id=instance_id)

        retorno = enviar_mensagem_smclick(
            telefone_normalizado,
            mensagem_final,
            instance_id=instance_id,
        )
        protocolo = extrair_protocolo(chat=chat, retorno=retorno)

        atualizar_message_sending(
            message_id=message_id,
            status="mensagem_enviada",
            erro=None,
            data_envio=datetime.now(timezone.utc).isoformat(),
            protocolo=protocolo,
            respondeu=False,
            status_followup="AGUARDANDO",
        )

        return jsonify(
            {
                "ok": True,
                "message_sending_id": message_id,
                "telefone": formatar_telefone_api(telefone_normalizado),
                "mensagem_final": mensagem_final,
                "protocolo": protocolo,
                "instance_id_usada": instance_id,
                "analista": analista,
                "retorno": retorno,
            }
        )

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
                status="mensagem_erro",
                erro=detalhe or str(e),
            )

        return (
            jsonify(
                {
                    "ok": False,
                    "erro": "Erro ao comunicar com a SM Click.",
                    "detalhe": detalhe or str(e),
                }
            ),
            500,
        )

    except Exception as e:
        message_id = valor_texto(request.json.get("message_sending_id")) if request.is_json else ""
        if message_id:
            atualizar_message_sending(
                message_id=message_id,
                status="mensagem_erro",
                erro=str(e),
            )

        return jsonify({"ok": False, "erro": str(e)}), 500


@app.post("/api/atualizar-followup")
def api_atualizar_followup():
    try:
        body = request.get_json(silent=True) or {}

        template_id = valor_texto(body.get("template_id")) or None
        somente_pendentes = body.get("somente_pendentes", True)

        registros = buscar_registros_followup(
            template_id=template_id,
            somente_pendentes=bool(somente_pendentes),
        )

        resultados = []
        total_processados = 0
        total_respondidos = 0
        total_sem_retorno = 0
        total_aguardando = 0
        total_erros = 0

        for registro in registros:
            try:
                resultado = avaliar_followup_registro(registro)
                resultados.append(resultado)
                total_processados += 1

                status_followup = valor_texto(resultado.get("status_followup")).upper()

                if status_followup == "RESPONDIDO":
                    total_respondidos += 1
                elif status_followup == "SEM_RETORNO":
                    total_sem_retorno += 1
                elif status_followup == "AGUARDANDO":
                    total_aguardando += 1

            except Exception as e:
                total_erros += 1
                resultados.append(
                    {
                        "id": registro.get("id"),
                        "status_followup": "ERRO",
                        "erro": str(e),
                    }
                )

        return jsonify(
            {
                "ok": True,
                "template_id": template_id,
                "total_registros_encontrados": len(registros),
                "total_processados": total_processados,
                "total_respondidos": total_respondidos,
                "total_sem_retorno": total_sem_retorno,
                "total_aguardando": total_aguardando,
                "total_erros": total_erros,
                "resultados": resultados,
            }
        )

    except requests.HTTPError as e:
        detalhe = ""
        try:
            detalhe = e.response.text
        except Exception:
            detalhe = str(e)

        return (
            jsonify(
                {
                    "ok": False,
                    "erro": "Erro ao comunicar com a SM Click ao atualizar follow-up.",
                    "detalhe": detalhe or str(e),
                }
            ),
            500,
        )

    except Exception as e:
        return jsonify({"ok": False, "erro": str(e)}), 500


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "message": "Backend rodando normalmente."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6969, debug=True)