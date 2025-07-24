//=============================================================
//                GESTION DES ONGLETS
//=============================================================

// Changement d'onglet
function switchTab(tabId) {
  // Masquer tous les onglets
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // Retirer la classe active de tous les boutons
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Afficher l'onglet sélectionné
  document.getElementById(tabId).classList.add('active');

  // Activer le bouton correspondant
  document.getElementById('tab-' + tabId).classList.add('active');
}


//=============================================================
//                GESTION DES FAVORIS
//=============================================================

// Récupération des favoris depuis le navigateur
function getFavorites() {
  const stored = localStorage.getItem("bm_favorites");
  return stored ? JSON.parse(stored) : [];
}

// Chargement du profil d'un des favoris
function loadFavorite(id) {
  document.getElementById("searchInput").value = id;
  switchTab("search");
  searchPlayer();
}

// Ajout d'un favoris
function addToFavorites(id, name) {
  const favorites = getFavorites();

  if (favorites.some(fav => fav.id === id)) {
    showToast("Ce joueur est déjà dans vos favoris.","error");
    return;
  }

  favorites.push({ id, name, priority: 0 });
  saveFavorites(favorites);
  showToast("Ajouté aux favoris !","success");
  renderFavoritesList(); // Met à jour l'affichage dans l'onglet Personnalisation
}

// Sauvegarde la liste des favoris dans le navigateur
function saveFavorites(favs) {
  localStorage.setItem("bm_favorites", JSON.stringify(favs));
}

// Affichage de la liste des favoris
function renderFavoritesList() {
  const container = document.getElementById("favoritesList");
  const favorites = getFavorites();

  if (favorites.length === 0) {
    container.innerHTML = "<h3>Favoris</h3><p>Aucun favori.</p>";
    return;
  }

  // Tri croissant par priorité (non unique)
  favorites.sort((a, b) => a.priority - b.priority);
  container.innerHTML = "<h3>Favoris</h3>" + favorites.map(fav => `
    <div class="favorite-item">
      <span>
        <strong>${fav.name}</strong> 
        (ID: ${fav.id})
      </span>
      <div class="priority-container">
        <label>Priorité :</label>
        <input style="border-radius: 5px; border: 1px solid var(--border-color);padding: 0.45rem 1rem;" type="number" min="0" value="${fav.priority}" onchange="updateFavoritePriority('${fav.id}', this.value)">
      </div>
      <div class="button-container">
        <button onclick="loadFavorite('${fav.id}')">🔍 Voir</button>
        <button onclick="removeFavorite('${fav.id}')">❌</button>
      </div>
    </div>
  `).join("");
}

// Suppression d'un favoris
function removeFavorite(id) {
  const updated = getFavorites().filter(f => f.id !== id);
  saveFavorites(updated);
  showToast("Joueur supprimé de la liste des favoris.","success");
  renderFavoritesList();
}

// Met à jour l'affichage des favoris selon l'ordre de priorité
function updateFavoritePriority(id, newPriority) {
  const favorites = getFavorites();
  const fav = favorites.find(f => f.id === id);
  if (fav) {
    fav.priority = parseInt(newPriority);
    saveFavorites(favorites);
    renderFavoritesList();
  }
}


//=============================================================
//                GESTION DES EXCLUSIONS
//=============================================================

// Récupération de la liste des exclusions
function getExcludedServers() {
  const stored = localStorage.getItem('bm_excluded_servers');
  return stored ? JSON.parse(stored) : [];
}

// Affichage de la liste d'exclusion
function renderExclusionList() {
  const container = document.getElementById("exclusionsList");
  const exclusions = getExcludedServers();

  if (exclusions.length === 0) {
    container.innerHTML = "<p>Aucun serveur exclu.</p>";
    return;
  }

  container.innerHTML = exclusions.map(server => `
    <div>
      <strong>${server.name}</strong> (ID: ${server.id})
      <button onclick="removeExcludedServer('${server.id}')">❌ Supprimer</button>
    </div>
  `).join("");
}

// Suppression d'une exclusion dans la liste d'exclusion
function removeExcludedServer(id) {
  const exclusions = getExcludedServers().filter(s => s.id !== id);
  localStorage.setItem('bm_excluded_servers', JSON.stringify(exclusions));
  showToast("Serveur supprimé de la liste des exclusions","success");
  renderExclusionList(); // met à jour l'affichage
}

// Ajout d'un serveur à la liste d'exclusion
async function addExcludedServer() {
    const id = document.getElementById('excludeInput').value.trim();
    const exclusions = getExcludedServers();

  // Vérifie si le serveur est déjà exclu
  if (exclusions.some(s => s.id === id)) return;


  try {
    const response = await fetch(`https://api.battlemetrics.com/servers/${id}`);
    if (!response.ok) throw new Error("Serveur introuvable");
    const data = await response.json();
    if (data.data.relationships.game.data.id !== "rust") throw new Error("Ce n'est pas un serveur rust");
    let name = data.data.attributes.name;
    console.log(id)
    exclusions.push({ id, name });
    localStorage.setItem('bm_excluded_servers', JSON.stringify(exclusions));
    showToast("Serveur ajouté à la liste des exclusions","success");
    renderExclusionList();
  } catch (error) {
    showToast(error.message,"error");
  }
}



//=============================================================
//                CALCUL DES HEURES DE JEU
//=============================================================

// Calcul des heures de jeu et des heures de train (heures UKN)
function calculatePlaytimesFromServers(included) {
  const excludedServers = getExcludedServers(); // [{ id, name }]
  const excludedIds = excludedServers.map(server => server.id);

  let totalMs = 0;
  let uknMs = 0;

  for (const entry of included) {
    if (entry.type !== "server") continue;
    if (entry.relationships.game.data.id !== "rust") continue;

    const serverId = entry.id;
    const serverName = entry.attributes.name || "Inconnu";
    const timePlayed = entry.meta?.timePlayed || 0;

    totalMs += timePlayed;

    const lower = serverName.toLowerCase();
    const isUKN = (
      !lower.includes("build") &&
      (lower.includes("ukn") || lower.includes("train") || lower.includes("training")) && (!excludedIds.includes(serverId))
    );

    if (isUKN) {
      uknMs += timePlayed;
    }
  }

  return {
    totalHours: (totalMs / 60 / 60).toFixed(1),
    uknHours: (uknMs / 60 / 60).toFixed(1),
  };
}

//=============================================================
//                RECHERCHE JOUEUR
//=============================================================

// Recherche du profil de l'id spécifié dans l'onglet recherche
async function searchPlayer() {
  const playerId = document.getElementById('searchInput').value.trim();
  if (!playerId) return showToast("Veuillez entrer un ID.","error");

  const resultDiv = document.getElementById('searchResult');
  resultDiv.innerHTML = "🔍 Recherche en cours...";

  try {
    const response = await fetch(`https://api.battlemetrics.com/players/${playerId}?include=server`);
    if (!response.ok){
      throw new Error("Joueur introuvable");
    } 

    const data = await response.json();
    const name = data.data.attributes.name;
    const createdAt = data.data.attributes.createdAt;

    const included = data.included || [];
    const { totalHours, uknHours } = calculatePlaytimesFromServers(included);

    resultDiv.innerHTML = `
      <h3>${name}</h3>
      <p>ID : ${playerId}</p>
      <p>Date de première vue : ${new Date(createdAt).toLocaleDateString()}</p>
      <p><strong>Heures Rust :</strong> ${totalHours}h</p>
      <p><strong>Heures UKN :</strong> ${uknHours}h</p>
      <p><a style="text-decoration: underline;color: var(--text-color);" href="https://www.battlemetrics.com/players/${playerId}" target="_blank">Voir sur BattleMetrics</a></p>
    `;

    resultDiv.innerHTML += `
      <button onclick="addToFavorites('${playerId}', '${name.replace(/'/g, "\\'")}')">⭐ Ajouter aux favoris</button>
    `;
    document.getElementById('searchResult').style.display = 'block';

  } catch (error) {
    showToast(error.message,"error");
  }
}

// Recherche du profil de l'id enregistré
function searchUserProfile() {
  const id = localStorage.getItem('bm_user_id');
  if(id){
      document.getElementById("searchInput").value = id;
    switchTab("search");
    searchPlayer();
  }
}


//=============================================================
//                SAUVEGARDE USERID
//=============================================================

async function handleUserId() {
  const input = document.getElementById('userIdInput');
  const label = document.getElementById('userIdLabel');
  const button = document.getElementById('saveUserBtn');
  const playerNameDisplay = document.getElementById('savedPlayerName');
  const btnVoir = document.querySelector('#controlsUserId button:nth-child(1)');
  const btnServeur = document.querySelector('#controlsUserId button:nth-child(3)');

  let userId = localStorage.getItem('bm_user_id');

  // === Si ID existe déjà -> action = suppression ===
  if (userId) {
    input.style.display = 'none';
    label.style.display = 'none';
    button.textContent = '❌ Supprimer l\'ID';
    button.onclick = () => {
      localStorage.removeItem('bm_user_id');
      showToast('ID supprimé avec succès', 'success');
      btnVoir.style.display = "none";
      btnServeur.style.display = "none";
      playerNameDisplay.textContent = '';
      handleUserId(); // Refresh UI
    };

    try {
      const res = await fetch(`https://api.battlemetrics.com/players/${userId}?include=server`);
      const data = await res.json();
      const name = data.data.attributes.name;
      const history = data.included?.filter(e => e.type === "server") || [];

      playerNameDisplay.textContent = `Profil enregistré : ${name} (ID: ${userId})`;

      let bestServer = history.find(s => s.meta?.online === true);
      if (!bestServer && history.length > 0) {
        bestServer = history.reduce((latest, current) => {
          const currentSeen = new Date(current.meta?.lastSeen || 0);
          const latestSeen = new Date(latest.meta?.lastSeen || 0);
          return currentSeen > latestSeen ? current : latest;
        });
      }

      if (bestServer) {
        const lastServerId = bestServer.id;
        btnServeur.onclick = () => {
          window.open(`https://www.battlemetrics.com/servers/rust/${lastServerId}`, "_blank");
        };
        btnServeur.style.display = "inline-block";
      } else {
        btnServeur.style.display = "none";
      }

      btnVoir.style.display = "inline-block";
    } catch (err) {
      showToast("Impossible de charger le profil", "error");
      btnVoir.style.display = "none";
      btnServeur.style.display = "none";
    }

  } else {
    // === Si aucun ID => affichage pour saisie ===
    input.style.display = '';
    label.style.display = '';
    button.textContent = '✔️ Enregistrer';
    button.onclick = async () => {
      const newId = input.value.trim();
      if (!newId) return showToast('Veuillez entrer un ID valide', 'error');

      localStorage.setItem('bm_user_id', newId);
      showToast('ID enregistré avec succès', 'success');
      await handleUserId(); // Recharge l’interface avec les nouvelles données
    };

    btnVoir.style.display = "none";
    btnServeur.style.display = "none";
    playerNameDisplay.textContent = '';
  }
}

//=============================================================
//                GESTION DES THEMES
//=============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

//=============================================================
//                NOTIFICATIONS TOASTS
//=============================================================

function showToast(message, type = "success") {
  const container = document.querySelector('.toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Emoji selon le type
  const emoji = type === "success" ? "✔️" : "❌";
  toast.textContent = `${emoji} ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}



//=============================================================
//               DOM CONTENT LOADED
//=============================================================

window.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem('bm_user_id');
  const icon = document.getElementById('themeToggle');
  const btnVoir = document.querySelector('#controlsUserId button:nth-child(1)');
  const btnServeur = document.querySelector('#controlsUserId button:nth-child(3)');
  const playerNameDisplay = document.getElementById('savedPlayerName');

  // Appliquer le thème
  const theme = localStorage.getItem("theme") || "dark";
  applyTheme(theme);
  if (theme === "dark") {
    document.body.classList.add('dark');
    icon.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    icon.textContent = '🌙';
  }

  // Remplir l'input si ID présent
  if (id) {
    document.getElementById('userIdInput').value = id;
    try {
      const res = await fetch(`https://api.battlemetrics.com/players/${id}?include=server`);
      const data = await res.json();
      const name = data.data.attributes.name;
      const history = data.included?.filter(e => e.type === "server") || [];

      playerNameDisplay.textContent = `Profil enregistré : ${name} (ID: ${id})`;

      let bestServer = null;

      // Priorité au serveur où le joueur est online
      bestServer = history.find(s => s.meta?.online === true);

      if (!bestServer && history.length > 0) {
        // Sinon, on prend celui avec le lastSeen le plus récent
        bestServer = history.reduce((latest, current) => {
          const currentSeen = new Date(current.meta?.lastSeen || 0);
          const latestSeen = new Date(latest.meta?.lastSeen || 0);
          return currentSeen > latestSeen ? current : latest;
        });
      }

      if (bestServer) {
        const lastServerId = bestServer.id;
        btnServeur.onclick = () => {
          window.open(`https://www.battlemetrics.com/servers/rust/${lastServerId}`, "_blank");
        };
        btnServeur.style.display = "inline-block";
      } else {
        btnServeur.style.display = "none";
      }

      btnVoir.style.display = "inline-block";

    } catch (err) {
      console.error(err);
      playerNameDisplay.textContent = "❌ Impossible de charger le profil.";
      btnVoir.style.display = "none";
      btnServeur.style.display = "none";
    }
  } else {
    btnVoir.style.display = "none";
    btnServeur.style.display = "none";
  }

  // Toggle du thème
  icon.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const next = document.body.classList.contains('dark') ? 'dark' : 'light';
    applyTheme(next);
    icon.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  renderExclusionList();
  renderFavoritesList();
  handleUserId();
});