
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const clearButton = document.getElementById("clearButton");
const message = document.getElementById("message");

function showMessage(text, type = "") {
  if (!message) return;
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function clearFields() {
  emailInput.value = "";
  passwordInput.value = "";
  showMessage("");
  emailInput.focus();
}

clearButton?.addEventListener("click", clearFields);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.log("submit interceptado");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Preencha e-mail e senha.", "error");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Acessando...";
  showMessage("Validando acesso...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    console.log("data:", data);
    console.log("error:", error);

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    showMessage("Login realizado com sucesso.", "success");
    setTimeout(() => {
    window.location.href = "./main.html";
  }, 500);
  } catch (err) {
    console.error("catch:", err);
    showMessage(err.message || "Erro ao fazer login.", "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Acessar";
  }
});