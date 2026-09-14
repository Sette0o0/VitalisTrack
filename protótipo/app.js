const screenNames = {
  login: "Entrar",
  register: "Criar conta",
  home: "Início",
  water: "Hidratação",
  meals: "Alimentação",
  "meal-form": "Nova refeição",
  activities: "Atividades",
  "active-workout": "Atividade em curso",
  progress: "Progresso",
  health: "Saúde e bem-estar",
  timeline: "Linha do tempo",
  profile: "Perfil e ajustes"
};

const screens = [...document.querySelectorAll(".app-screen")];
const mapLinks = [...document.querySelectorAll(".screen-link")];
const screenName = document.querySelector("#current-screen-name");
const sheet = document.querySelector(".bottom-sheet");
const scrim = document.querySelector(".scrim");
const snackbar = document.querySelector(".snackbar");
const snackbarText = document.querySelector("#snackbar-text");
let toastTimer;
let waterTotal = 1500;

function navigate(target, updateHash = true) {
  if (!screenNames[target]) return;

  screens.forEach((screen) => {
    const isTarget = screen.dataset.screenId === target;
    screen.classList.toggle("active", isTarget);
    if (isTarget) screen.scrollTop = 0;
  });

  mapLinks.forEach((link) => link.classList.toggle("active", link.dataset.screen === target));
  screenName.textContent = screenNames[target];
  closeOverlays();

  if (updateHash) history.replaceState(null, "", `#${target}`);
}

function showToast(message) {
  clearTimeout(toastTimer);
  snackbarText.textContent = message;
  snackbar.hidden = false;
  toastTimer = setTimeout(() => { snackbar.hidden = true; }, 3000);
}

function openSheet() {
  scrim.hidden = false;
  sheet.hidden = false;
}

function closeOverlays() {
  scrim.hidden = true;
  sheet.hidden = true;
}

function updateWater(amount) {
  waterTotal = Math.min(waterTotal + Number(amount), 4000);
  const percent = Math.min(Math.round((waterTotal / 2500) * 100), 100);
  const liters = (waterTotal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  document.querySelector("#water-total").textContent = `${waterTotal.toLocaleString("pt-BR")} mL`;
  document.querySelector("#water-percent").textContent = `${percent}%`;
  document.querySelector("#water-ring").style.setProperty("--value", percent);
  document.querySelector("#home-water-value").textContent = `${liters} L`;
  document.querySelector("#home-water-bar").style.width = `${percent}%`;
  showToast(`${Number(amount).toLocaleString("pt-BR")} mL adicionados`);
}

document.addEventListener("click", (event) => {
  const mapLink = event.target.closest("[data-screen]");
  const goLink = event.target.closest("[data-go]");
  const toastLink = event.target.closest("[data-toast]");
  const waterButton = event.target.closest("[data-add-water]");
  const dialogButton = event.target.closest("[data-dialog-open]");

  if (mapLink) navigate(mapLink.dataset.screen);
  if (goLink) navigate(goLink.dataset.go);
  if (toastLink) showToast(toastLink.dataset.toast);
  if (waterButton) updateWater(waterButton.dataset.addWater);
  if (dialogButton) document.querySelector(`#${dialogButton.dataset.dialogOpen}`).showModal();
  if (event.target.closest("[data-sheet-open]")) openSheet();
  if (event.target.closest("[data-overlay-close]") || event.target === scrim) closeOverlays();
  if (event.target.closest(".snackbar button")) snackbar.hidden = true;

  if (event.target.closest("[data-finish-workout]")) {
    navigate("activities");
    showToast("Corrida salva no histórico");
  }
  if (event.target.closest("[data-cancel-workout]")) {
    navigate("activities");
    showToast("Atividade descartada");
  }

  const tab = event.target.closest(".period-tabs button, .filter-chips button, .calendar-strip button, .segmented-buttons button");
  if (tab) {
    [...tab.parentElement.children].forEach((item) => item.classList.remove("active", "selected"));
    tab.classList.add(tab.parentElement.classList.contains("calendar-strip") || tab.parentElement.classList.contains("segmented-buttons") ? "selected" : "active");
  }
});

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigate("home");
  showToast("Login realizado com sucesso");
});

document.querySelector("#register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigate("home");
  showToast("Conta criada com sucesso");
});

document.querySelector("#meal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigate("meals");
  showToast("Refeição salva");
});

document.querySelector("#custom-water-form").addEventListener("submit", (event) => {
  const amount = Number(document.querySelector("#custom-water-input").value);
  if (amount > 0) updateWater(amount);
});

function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  document.querySelector(".theme-toggle .material-symbols-rounded").textContent = isDark ? "light_mode" : "dark_mode";
  document.querySelectorAll(".theme-checkbox").forEach((checkbox) => { checkbox.checked = isDark; });
}

document.querySelector(".theme-toggle").addEventListener("click", () => setTheme(!document.body.classList.contains("dark")));
document.querySelectorAll(".theme-checkbox").forEach((checkbox) => checkbox.addEventListener("change", () => setTheme(checkbox.checked)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeOverlays();
});

const initialScreen = location.hash.replace("#", "");
navigate(screenNames[initialScreen] ? initialScreen : "login", false);
